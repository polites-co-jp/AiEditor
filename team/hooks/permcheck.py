"""AiEditor のメンバーごとの permissions.json（team/departments/<部門>/<id>/permissions.json）が、allowlist.js の
規則で効く書き方になっているかを検査する。あわせて、あるメンバーのある操作が allowlist.js で通るかを試す。

土台は E:\\develop\\self\\Team の team/hooks/permcheck.py。書式を AiEditor の新書式に合わせた。

規則（ERROR は終了コード 1。WARN は終了コードに影響しない）:
  a. ERROR JSON として読めない（BOM・NaN・Infinity も読めないとする）。トップレベルがオブジェクトでない。
  b. ERROR キーの重複（JSON.parse は最後の値だけを使う）。
  c. ERROR 未知のキー。使えるのは bash / write_paths / write_paths_deny / read_paths / secret_paths / agents / skills。
  d. ERROR 値が文字列の配列でない（allowlist.js は配列でない値を見るとそのメンバーの呼び出しを全部止める）。
     WARN  同じ配列の中の重複。
  e. bash の許可1つ:
     ERROR 空・前後に空白・末尾が \\。
     末尾が / の行は「コマンド 語… ディレクトリ/」（ディレクトリの下に限る許可）とみなし、次を ERROR にする:
           語が1つだけ（コマンドだけ）・ディレクトリの語がコマンド名のすぐ後ろ（git status/ と見分けられない）・
           最後の語が絶対パス・ドライブ・コロンを含む・空の区切り（tests//）・プロジェクト直下（./）・. の区切り・
           * だけの区切りで始まる（*/x/）。
     ERROR 区切り（&& || ; | & 改行）、$( ・`・<・>・(・) を含む（allowlist.js が分ける・止めるので一致しない）。
     ERROR * の置き方: ** がある、先頭の語（コマンド名）に * がある、* だけの語がある。
           * は「パスの1区切りの一部」に一致する（/・\\・空白・引用符などを含まず、末尾が . でない）。
     ERROR .. の区切りを含む語がある（* の外で外へ出る形を許可にしない）。
     WARN  中身のある単一引用符 '...' を含む（土台と同じ。ふつうの書き方では一致しない）。
  f. パスの要素（write_paths / write_paths_deny / read_paths）1つ:
     ERROR 空・前後に空白・\\ を含む（/ で書く）・.. の区切り・. の区切り・空の区切り（a//b）。
     ERROR ./ は read_paths だけ（プロジェクト全体）。ほかの「直下そのもの」（. など）は誤り。
     ERROR ~ で始まる・% を含む（環境変数は secret_paths だけ）・ドライブの無い / 始まり・/c/ の Git Bash 形（C:/ で書く）・
           ドライブ相対（C:foo）・ドライブ以外のコロン・< > " | ?・末尾が . か空白の区切り・~ と数字の区切り（8.3 短縮名）。
     ERROR ** がある、ドライブの区切りに * がある。
     ERROR write_paths の要素が自己防護の場所（.claude/・team/・.git）にかかる（allowlist.js が固定で止めるので効かない）。
     WARN  write_paths_deny の要素が、どの write_paths の下にも無い（効かない）。
  g. secret_paths の要素1つ:
     ERROR 空・前後に空白・* を含む・.. の区切り・%NAME% が先頭以外にある・NAME が英数字と _ でない。
     ERROR 展開した後のパスが f の止める形（ドライブ相対・UNC など）。
     WARN  今の環境で環境変数が展開できない（allowlist.js はそのメンバーのファイルと Bash の呼び出しを止める）。
  h. ERROR agents の ID の形式が不正、または .claude/agents/<id>.md が無い。skills の要素が空・前後に空白。
  i. ERROR 置き場のディレクトリ名（メンバー ID）の形式が不正、または .claude/agents/<id>.md が無い。
     ERROR リーダー（vlad-tepes）の permissions.json がある（allowlist.js はリーダーを検査しないので効かない）。
     WARN  read_paths が無い（Read・Glob・Grep が全部止まる）。
  全部を検査するとき（--file なし）だけ:
  j. ERROR 同じメンバー ID の permissions.json が複数の部門にある。
  k. ERROR 定義 .claude/agents/<id>.md があるのに permissions.json が無い（リーダーを除く）。

使い方（AiEditor のルートで。Team のルートからは python projects/ai-editor/team/hooks/permcheck.py ...）:
    python team/hooks/permcheck.py                                  # 全員の permissions.json
    python team/hooks/permcheck.py --file <案の permissions.json>   # 1ファイルだけ（メンバー ID は親ディレクトリ名）
    python team/hooks/permcheck.py --member <id> --bash "<コマンド>"  # Bash で通るか
    python team/hooks/permcheck.py --member <id> --write <パス>      # Write で通るか
    python team/hooks/permcheck.py --member <id> --read <パス>       # Read で通るか
    python team/hooks/permcheck.py --member <id> --tool <名前>       # そのツールが定義の tools で通るか（入力は空）
    --root <ディレクトリ> で、プロジェクトのルートを差し替える（テスト用。既定はこのファイルの2つ上）。

出力: 問題を1件1行（「ERROR <相対パス>: <内容>」「WARN <相対パス>: <内容>」）、最後に件数の1行。
終了コード: 0 = エラーなし（警告だけを含む）、1 = エラーあり、2 = 引数の誤り。
--member の判定は allowlist.js を node で呼んで行う（規則を Python に書き写さない）。PreToolUse のイベントを
stdin で渡し、CLAUDE_PROJECT_DIR を ROOT、cwd を ROOT にする。環境変数（LOCALAPPDATA など）はそのまま渡す。
終了コード: 0 = 通る、1 = 止まる（allowlist.js のメッセージを添える）、
2 = 判定できない（node が無い・permissions.json が無い・ID の形式が不正・想定外の終了）。
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HOOKS_DIR = Path(__file__).resolve().parent
ROOT = HOOKS_DIR.parents[1]
ALLOWLIST_JS = HOOKS_DIR / "allowlist.js"

ERROR = "ERROR"
WARN = "WARN"
KEYS = ("bash", "write_paths", "write_paths_deny", "read_paths", "secret_paths", "agents", "skills")
PATH_KEYS = ("write_paths", "write_paths_deny", "read_paths")
LEADER_ID = "vlad-tepes"
SELF_PROTECTED = (".claude", "team", ".git")
AGENT_ID = re.compile(r"^[A-Za-z0-9_-]+$")
SEPARATORS = ("&&", "||", ";", "|", "&", "\n")
FORBIDDEN = ("$(", "`", "<", ">", "(", ")")
JS_SPACE = "\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
EDGE_SPACE = re.compile(f"\\A[{JS_SPACE}]|[{JS_SPACE}]\\Z")
ENV_REF = re.compile(r"%([^%]*)%")
ENV_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def q(value):
    return json.dumps(value, ensure_ascii=False)


# ---- bash ----


def strip_single_quoted(command):
    """allowlist.js の stripSingleQuoted と同じ置き換え（WARN の判定にだけ使う）。"""
    if '"' in command or "\\" in command:
        return command
    return re.sub(r"'[^']*'", "''", command)


def dir_scoped_issues(entry):
    """末尾が / の bash の許可（「コマンド 語… ディレクトリ/」）の書き間違い。"""
    issues = []
    words = entry.split()
    last = words[-1] if words else ""
    if len(words) < 2:
        issues.append((ERROR, "末尾が / の書き方は「コマンド … ディレクトリ/」の形にする（コマンドだけでは危険）"))
    elif len(words) < 3:
        issues.append((ERROR, "末尾が / の語がコマンド名のすぐ後ろにある（git status/ のような、コマンド名・サブコマンドに / が"
                              "付いた書き間違いと見分けられない）。コマンドとディレクトリの間にサブコマンドかオプションを置く"))
    if last.startswith("/") or re.match(r"^[A-Za-z]:", last) or ":" in last:
        issues.append((ERROR, "末尾が / の書き方の最後の語が絶対パス・ドライブ・コロンを含む（下に限る相対ディレクトリにする）"))
    if "//" in last:
        issues.append((ERROR, "末尾が / の書き方の最後の語に空の区切りがある（tests// など）"))
    segs = [s for s in last.split("/") if s]
    if all(s == "." for s in segs):
        issues.append((ERROR, "末尾が / の書き方のディレクトリがプロジェクト直下（./ など。下に限る意味が無い）"))
    elif "." in segs:
        issues.append((ERROR, "末尾が / の書き方のディレクトリに . の区切りがある"))
    if segs and segs[0] == "*":
        issues.append((ERROR, "末尾が / の書き方のディレクトリが * だけの区切りで始まる（直下のどのディレクトリにも一致し、"
                              ".claude・.git の下も含む）"))
    return issues


def bash_entry_issues(entry):
    if entry == "":
        return [(ERROR, "空文字。どのコマンドにも一致しない")]
    issues = []
    if EDGE_SPACE.search(entry):
        issues.append((ERROR, "前後に空白がある。allowlist.js は前後の空白を除いた断片と比べるので一致しない"))
    if entry.endswith("\\"):
        issues.append((ERROR, "末尾が \\。「完全一致」か「許可＋半角空白」でしか一致しない（ファイル名まで書く）"))
    elif entry.endswith("/"):
        # ディレクトリの下に限る書き方（例 node --test tests/）。末尾の / は誤りにしないが、書き間違いは見逃さない。
        issues += dir_scoped_issues(entry)
    for sep in SEPARATORS:
        if sep in entry:
            issues.append((ERROR, f"区切り {q(sep)} を含む。allowlist.js は区切りごとに分けて比べるので一致しない"))
            break
    for token in FORBIDDEN:
        if token in entry:
            issues.append((ERROR, f"{q(token)} を含む。allowlist.js はこれを含むコマンドを照合の前に止める"))
            break
    words = entry.split()
    if "**" in entry:
        issues.append((ERROR, "** がある（* はパスの1区切りの一部にだけ一致する）"))
    if words and "*" in words[0]:
        issues.append((ERROR, "先頭の語（コマンド名）に * がある"))
    if any(w == "*" for w in words):
        issues.append((ERROR, "* だけの語がある（* はパスの1区切りの一部として、/ の後などに置く）"))
    if any(".." in re.split(r"[\\/]", w) for w in words):
        issues.append((ERROR, ".. の区切りを含む語がある（外へ出る形を許可にしない）"))
    if not any(level == ERROR for level, _ in issues) and strip_single_quoted(entry) != entry:
        issues.append((WARN, "中身のある単一引用符 '...' を含む（ふつうの書き方では一致しない）"))
    return issues


# ---- パス ----


def path_shape_issues(body):
    """展開や ./ の扱いを済ませたパスの、allowlist.js が止める・使わない形の一覧。"""
    issues = []
    if "\\" in body:
        issues.append("\\ を含む（/ で書く）")
    if body.startswith("~"):
        issues.append("~ で始まる")
    if body.startswith("//"):
        issues.append("UNC・\\\\?\\ の形")
    elif re.match(r"^/[A-Za-z](?:/|$)", body):
        issues.append("/c/ の Git Bash 形（C:/ で書く）")
    elif body.startswith("/"):
        issues.append("ドライブの無い / 始まり")
    if re.match(r"^[A-Za-z]:(?!/)", body):
        issues.append("ドライブ相対（C:foo）")
    rest = body[2:] if re.match(r"^[A-Za-z]:/", body) else body
    if ":" in rest:
        issues.append("ドライブ以外のコロン（代替データストリームなど）")
    if re.search(r'[<>"|?]', body):
        issues.append('Windows のパスに使えない文字（< > " | ?）')
    parts = body.split("/")
    for i, seg in enumerate(parts):
        if seg == "..":
            issues.append(".. の区切り")
        elif seg == ".":
            issues.append(". の区切り")
        elif seg == "" and 0 < i < len(parts) - 1:
            issues.append("空の区切り（a//b）")
        elif seg and re.search(r"[. ]$", seg):
            issues.append(f"末尾が . か空白の区切り: {seg}")
        elif re.search(r"~\d", seg):
            issues.append(f"8.3 短縮名らしい区切り: {seg}")
    if "**" in body:
        issues.append("** がある（* は1区切りの一部）")
    if re.match(r"^[A-Za-z*]*\*[A-Za-z*]*:", body):
        issues.append("ドライブの区切りに * がある")
    return list(dict.fromkeys(issues))


def path_entry_issues(entry, key):
    if entry == "":
        return [(ERROR, "空文字。allowlist.js は使わない")]
    issues = []
    if EDGE_SPACE.search(entry):
        issues.append((ERROR, "前後に空白がある。allowlist.js は使わない"))
    if entry == "./":
        if key != "read_paths":
            issues.append((ERROR, "./（プロジェクト全体）は read_paths だけに書ける"))
        return issues
    if entry.strip("./") == "":
        return issues + [(ERROR, "プロジェクト直下そのもの。read_paths なら ./ と書く。ほかのキーには書けない")]
    if "%" in entry:
        issues.append((ERROR, "% を含む（環境変数は secret_paths だけで展開する）"))
    issues += [(ERROR, m) for m in path_shape_issues(entry)]
    if key == "write_paths":
        first = entry.split("/")[0].lower()
        if first in SELF_PROTECTED or ".git" in entry.lower().split("/"):
            issues.append((ERROR, ".claude/・team/・.git にかかる。allowlist.js が固定で止めるので効かない"))
    return issues


def secret_entry_issues(entry):
    if entry == "":
        return [(ERROR, "空文字")]
    issues = []
    if EDGE_SPACE.search(entry):
        issues.append((ERROR, "前後に空白がある"))
    if "*" in entry:
        issues.append((ERROR, "* は secret_paths では使えない"))
    refs = list(ENV_REF.finditer(entry))
    if entry.count("%") % 2:
        issues.append((ERROR, "% の数が合わない"))
    for m in refs:
        if m.start() != 0:
            issues.append((ERROR, f"%{m.group(1)}% が先頭にない（環境変数は先頭に1つだけ書く）"))
        if not ENV_NAME.match(m.group(1)):
            issues.append((ERROR, f"環境変数の名前が英数字と _ ではない: {q(m.group(1))}"))
    body = entry
    if refs and refs[0].start() == 0:
        value = os.environ.get(refs[0].group(1))
        if not value:
            issues.append((WARN, f"今の環境で %{refs[0].group(1)}% を展開できない（allowlist.js はこのメンバーのファイルと Bash の呼び出しを止める）"))
            value = "C:/expanded"
        body = value.replace("\\", "/") + entry[refs[0].end():]
    issues += [(ERROR, m) for m in path_shape_issues(body) if not m.startswith("\\ を含む")]
    return issues


def _under(entry, base):
    """write_paths_deny の要素 entry が、write_paths の要素 base の下（または同じ）か（* は区切り1つ）。"""
    e = [s for s in entry.lower().split("/") if s]
    b = [s for s in base.lower().split("/") if s]
    if not base.endswith("/"):
        return e == b
    if len(e) < len(b):
        return False
    return all(re.fullmatch(re.escape(bs).replace(r"\*", "[^/]+"), es) or es == bs for bs, es in zip(b, e))


# ---- ファイル1つ ----


def _reject_constant(name):
    raise ValueError(f"JSON に無い値 {name}")


def _where(key, index, value):
    return f"{key}[{index}] {q(value)}"


def check_text(text, member_id, root):
    issues = []
    if not AGENT_ID.match(member_id):
        issues.append((ERROR, f"置き場のメンバー ID の形式が不正（英数字・_・- だけ）: {member_id}"))
    elif not (root / ".claude" / "agents" / f"{member_id}.md").is_file():
        issues.append((ERROR, f"置き場のメンバー ID の定義 .claude/agents/{member_id}.md が無い"))
    if member_id == LEADER_ID:
        issues.append((ERROR, "リーダーの permissions.json は allowlist.js が使わない（リーダーは検査の対象外）"))

    key_orders = []

    def keep_keys(pairs):
        key_orders.append([k for k, _ in pairs])
        return dict(pairs)

    try:
        data = json.loads(text, parse_constant=_reject_constant, object_pairs_hook=keep_keys)
    except ValueError as err:
        return issues + [(ERROR, f"JSON として読めない: {err}")]
    if not isinstance(data, dict):
        return issues + [(ERROR, "トップレベルがオブジェクトではない")]
    keys = key_orders[-1]
    for key in dict.fromkeys(k for k in keys if keys.count(k) > 1):
        issues.append((ERROR, f"キー {q(key)} が {keys.count(key)} 回ある（最後の値だけが使われる）"))
    for key in data:
        if key not in KEYS:
            issues.append((ERROR, f"未知のキー {q(key)}（使えるのは {' / '.join(KEYS)}）"))

    lists = {}
    for key in KEYS:
        if key not in data:
            continue
        value = data[key]
        if not isinstance(value, list):
            issues.append((ERROR, f"{key} が配列ではない（allowlist.js はこのメンバーの呼び出しを全部止める）: {q(value)}"))
            continue
        good = True
        seen = set()
        for i, item in enumerate(value):
            if not isinstance(item, str):
                issues.append((ERROR, f"{key}[{i}] が文字列ではない: {q(item)}"))
                good = False
                continue
            if item in seen:
                issues.append((WARN, f"{_where(key, i, item)}: 重複"))
            seen.add(item)
        if good:
            lists[key] = value

    for i, item in enumerate(lists.get("bash", [])):
        issues += [(level, f"{_where('bash', i, item)}: {m}") for level, m in bash_entry_issues(item)]
    for key in PATH_KEYS:
        for i, item in enumerate(lists.get(key, [])):
            issues += [(level, f"{_where(key, i, item)}: {m}") for level, m in path_entry_issues(item, key)]
    for i, item in enumerate(lists.get("secret_paths", [])):
        issues += [(level, f"{_where('secret_paths', i, item)}: {m}") for level, m in secret_entry_issues(item)]
    for i, item in enumerate(lists.get("agents", [])):
        if not AGENT_ID.match(item):
            issues.append((ERROR, f"{_where('agents', i, item)}: ID の形式が不正"))
        elif not (root / ".claude" / "agents" / f"{item}.md").is_file():
            issues.append((ERROR, f"{_where('agents', i, item)}: .claude/agents/{item}.md が無い"))
    for i, item in enumerate(lists.get("skills", [])):
        if item == "" or EDGE_SPACE.search(item):
            issues.append((ERROR, f"{_where('skills', i, item)}: 空か前後に空白がある"))
    for i, item in enumerate(lists.get("write_paths_deny", [])):
        if not any(_under(item, base) for base in lists.get("write_paths", [])):
            issues.append((WARN, f"{_where('write_paths_deny', i, item)}: どの write_paths の下にも無い（効かない）"))
    if "read_paths" not in data:
        issues.append((WARN, "read_paths が無い（Read・Glob・Grep が全部止まる）"))
    return issues


def _display(path, root):
    try:
        return path.resolve().relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def check_file(path, root):
    path = Path(path)
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as err:
        issues = [(ERROR, f"読めない: {err}")]
    else:
        issues = check_text(text, path.resolve().parent.name, root)
    shown = _display(path, root)
    return [(level, f"{level} {shown}: {message}") for level, message in issues]


def cross_file_issues(root, files):
    issues = []
    by_member = {}
    for path in files:
        by_member.setdefault(path.parent.name, []).append(path)
    for member_id, paths in by_member.items():
        if len(paths) > 1:
            shown = ", ".join(_display(p, root) for p in paths)
            issues.append(f"team/departments/*/{member_id}/permissions.json: {len(paths)} つの部門にある（最初の1つしか使われない）: {shown}")
    for definition in sorted((root / ".claude" / "agents").glob("*.md")):
        if definition.stem == LEADER_ID or definition.stem in by_member:
            continue
        issues.append(f"{_display(definition, root)}: 定義があるのに permissions.json が無い（allowlist.js はこのメンバーのツールを全部止める）")
    return issues


def check_all(root, files=None):
    cross = files is None
    if cross:
        files = sorted(root.glob("team/departments/*/*/permissions.json"))
        if not files:
            return [f"{ERROR} team/departments: permissions.json が1つも無い（--root を確かめる）"], 1, 0
    lines = []
    for path in files:
        lines += check_file(path, root)
    if cross:
        lines += [(ERROR, f"{ERROR} {message}") for message in cross_file_issues(root, files)]
    errors = sum(1 for level, _ in lines if level == ERROR)
    return [line for _, line in lines], errors, len(lines) - errors


# ---- --member ----


def judge(root, member, tool_name, tool_input, shown):
    """allowlist.js で、そのメンバーのその呼び出しが通るかを答える。終了コードを返す。"""
    if not AGENT_ID.match(member):
        print(f"判定できない: メンバー ID の形式が不正（英数字・_・- だけ）: {member}")
        return 2
    if not list(root.glob(f"team/departments/*/{member}/permissions.json")):
        print(f"判定できない: {member} の permissions.json が team/departments/*/{member}/ に無い")
        return 2
    node = shutil.which("node")
    if node is None:
        print("判定できない: node が見つからない")
        return 2
    event = {
        "hook_event_name": "PreToolUse",
        "agent_type": member,
        "cwd": str(root),
        "tool_name": tool_name,
        "tool_input": tool_input,
    }
    try:
        result = subprocess.run(
            [node, str(ALLOWLIST_JS), member],
            input=json.dumps(event),
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=dict(os.environ, CLAUDE_PROJECT_DIR=str(root)),
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired) as err:
        print(f"判定できない: allowlist.js を実行できない: {err}")
        return 2
    message = (result.stderr or "").strip()
    if result.returncode == 0:
        print(f"通る: {member}: {shown}")
        return 0
    if result.returncode == 2:
        print(f"止まる: {member}: {shown}")
        print(message)
        return 1
    print(f"判定できない: allowlist.js が終了コード {result.returncode} で終わった: {message}")
    return 2


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--root", default=str(ROOT), help="プロジェクトのルート（既定はこのファイルの2つ上）")
    parser.add_argument("--file", help="この permissions.json だけを検査する（メンバー ID は親ディレクトリ名）")
    parser.add_argument("--member", help="判定するメンバーの ID（--bash / --write / --read / --tool のどれか1つと使う）")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--bash", help="Bash のコマンド")
    group.add_argument("--write", help="Write の file_path")
    group.add_argument("--read", help="Read の file_path")
    group.add_argument("--tool", help="ツールの名前（入力は空）")
    opts = parser.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    root = Path(opts.root).resolve()
    asked = [(name, getattr(opts, name)) for name in ("bash", "write", "read", "tool") if getattr(opts, name) is not None]
    if (opts.member is None) != (not asked):
        parser.error("--member と、--bash / --write / --read / --tool のどれか1つを一緒に指定する")
    if opts.member is not None:
        if opts.file:
            parser.error("--file と --member は一緒に使えない")
        kind, value = asked[0]
        if kind == "bash":
            return judge(root, opts.member, "Bash", {"command": value}, value)
        if kind == "write":
            return judge(root, opts.member, "Write", {"file_path": value, "content": ""}, f"Write {value}")
        if kind == "read":
            return judge(root, opts.member, "Read", {"file_path": value}, f"Read {value}")
        return judge(root, opts.member, value, {}, f"ツール {value}")

    lines, errors, warnings = check_all(root, [Path(opts.file)] if opts.file else None)
    for line in lines:
        print(line)
    print(f"エラー: {errors} 件、警告: {warnings} 件")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
