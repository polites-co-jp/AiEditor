"""AiEditor のメンバー定義（.claude/agents/*.md）と .claude/settings.json が、権限フックの前提どおりかを検査する。

土台は E:\\develop\\self\\Team の team/hooks/hookcheck.py。AiEditor に要る規則だけにした。

規則（どれも問題。終了コード 1）:
  定義（.claude/agents/<id>.md）ごとに:
    1. frontmatter（先頭の --- と --- の間）がある。
    2. name があり、ファイル名（<id>）と一致し、英数字・_・- だけ。allowlist.js は agent_type＝name で見分け、
       <id>.md の tools と team/departments/*/<id>/permissions.json を引くため。
    3. description がある（空でない）。
    4. model が fable / opus / sonnet / haiku のどれか。
    5. tools があり、空でなく、* を含まない（allowlist.js は tools に無いツールを止め、tools が無い・空・* のときは
       全部止める）。
    6. hooks が無い（定義のフックは登録されないことがある。守りは settings.json に置く）。
    7. リーダー（vlad-tepes）以外は team/departments/*/<id>/permissions.json がある（無いと allowlist.js が
       そのメンバーのツール呼び出しを全部止める）。2つ以上の部門にあるのも問題（最初の1つしか使われない）。
  リーダーの定義 .claude/agents/vlad-tepes.md がある。
  .claude/settings.json:
    8. JSON として読め、"agent" が "vlad-tepes"。
    9. hooks.PreToolUse に、全ツールに届く matcher（無い・""・"*"）で、次の形のフックがある:
         "type": "command", "command": "node",
         "args": ["${CLAUDE_PROJECT_DIR}/team/hooks/guard.js", "allowlist.js"], "onFailure": "block"
   10. allowlist.js・guard.js を呼ぶフックはどれも 9 の形（shell form や、起動役を通さない呼び方をしない）。
   11. 文字列の $ は ${CLAUDE_PROJECT_DIR} の形だけ。
  team/hooks/ に allowlist.js と guard.js がある。

使い方（AiEditor のルートで。Team のルートからは python projects/ai-editor/team/hooks/hookcheck.py）:
    python team/hooks/hookcheck.py
    --root <ディレクトリ> で、プロジェクトのルートを差し替える（テスト用。既定はこのファイルの2つ上）。
出力: 問題を1件1行、最後に件数の1行。終了コード: 0 = 問題なし、1 = 問題あり。
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LEADER_ID = "vlad-tepes"
MODELS = ("fable", "opus", "sonnet", "haiku")
AGENT_ID = re.compile(r"^[A-Za-z0-9_-]+$")
TOOL_NAME = re.compile(r"^[A-Za-z][A-Za-z0-9_]*(?:\(.*\))?$|^mcp__[A-Za-z0-9_-]+(?:__[A-Za-z0-9_-]+)?$")
PLACEHOLDER = "${CLAUDE_PROJECT_DIR}"
GUARD_ARGS = [PLACEHOLDER + "/team/hooks/guard.js", "allowlist.js"]
ALL_TOOLS_MATCHERS = (None, "", "*")


class ParseError(ValueError):
    pass


def frontmatter(text):
    """frontmatter のトップレベルのキーを {キー: 値} で返す。値は1行の文字列か、下に続く「- x」の列。"""
    lines = text.lstrip("\ufeff").splitlines()
    if not lines or lines[0].strip() != "---":
        raise ParseError("frontmatter が無い（先頭の行が --- ではない）")
    try:
        end = next(n for n in range(1, len(lines)) if lines[n].strip() == "---")
    except StopIteration:
        raise ParseError("frontmatter が閉じていない") from None
    result = {}
    key = None
    for line in lines[1:end]:
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        m = re.match(r"^([A-Za-z_][\w-]*)\s*:(.*)$", line)
        if m:
            key = m.group(1)
            if key in result:
                raise ParseError(f"キー {key} が2回ある")
            value = re.sub(r"\s+#.*$", "", m.group(2)).strip()
            result[key] = value if value else []
            continue
        item = re.match(r"^\s+-\s*(.*)$", line)
        if item and key is not None and isinstance(result[key], list):
            result[key].append(re.sub(r"\s+#.*$", "", item.group(1)).strip())
        elif line[:1] in (" ", "\t") and key is not None:
            continue  # 折り返しや入れ子の行（hooks の中身など）は読まない。キーがあることだけを見る
        else:
            raise ParseError(f"読めない行: {line.strip()}")
    return result


def tool_names(value):
    """tools の値を名前の列にする（allowlist.js の definitionTools と同じ読み方）。"""
    if isinstance(value, list):
        items = value
    else:
        text = value
        if text.startswith("[") and text.endswith("]"):
            text = text[1:-1]
        items = text.split(",")
    return [i.strip().strip("\"'").strip() for i in items if i.strip().strip("\"'").strip()]


def unquote(value):
    if isinstance(value, str) and len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def check_definition(path, root):
    problems = []
    where = f".claude/agents/{path.name}"
    try:
        fm = frontmatter(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ParseError) as err:
        return [f"{where}: {err}"]
    agent_id = path.stem
    name = unquote(fm.get("name"))
    if not isinstance(name, str) or not name:
        problems.append(f"{where}: name が無い")
    elif name != agent_id:
        problems.append(f"{where}: name（{name}）がファイル名（{agent_id}）と違う。allowlist.js は agent_type＝name で <name>.md を引く")
    if not AGENT_ID.match(agent_id):
        problems.append(f"{where}: ファイル名の ID が英数字・_・- だけではない")
    description = unquote(fm.get("description"))
    if not isinstance(description, str) or not description:
        problems.append(f"{where}: description が無い")
    model = unquote(fm.get("model"))
    if model not in MODELS:
        problems.append(f"{where}: model が {' / '.join(MODELS)} のどれでもない: {model!r}")
    if "tools" not in fm:
        problems.append(f"{where}: tools が無い（allowlist.js はこのメンバーのツールを全部止める）")
    else:
        names = tool_names(fm["tools"])
        if not names:
            problems.append(f"{where}: tools が空（allowlist.js はこのメンバーのツールを全部止める）")
        for n in names:
            if n == "*" or "*" in n:
                problems.append(f"{where}: tools に * がある（全ツールを持たせない。allowlist.js は全部止める）")
            elif not TOOL_NAME.match(n):
                problems.append(f"{where}: tools の名前として読めない: {n!r}")
    if "hooks" in fm:
        problems.append(f"{where}: frontmatter に hooks がある（定義のフックは登録されないことがある。守りは .claude/settings.json に置く）")
    if agent_id != LEADER_ID:
        found = sorted(root.glob(f"team/departments/*/{agent_id}/permissions.json"))
        if not found:
            problems.append(f"{where}: team/departments/*/{agent_id}/permissions.json が無い（allowlist.js はこのメンバーのツールを全部止める）")
        elif len(found) > 1:
            shown = ", ".join(p.relative_to(root).as_posix() for p in found)
            problems.append(f"{where}: permissions.json が {len(found)} つの部門にある（最初の1つしか使われない）: {shown}")
    return problems


def _strings(hook):
    values = []
    if isinstance(hook.get("command"), str):
        values.append(hook["command"])
    if isinstance(hook.get("args"), list):
        values += [a for a in hook["args"] if isinstance(a, str)]
    return values


def is_guard_hook(hook):
    return (
        hook.get("type") == "command"
        and hook.get("command") == "node"
        and hook.get("args") == GUARD_ARGS
        and hook.get("onFailure") == "block"
    )


def check_settings(path):
    where = ".claude/settings.json"
    try:
        settings = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError) as err:
        return [f"{where}: 読めない: {err}"]
    if not isinstance(settings, dict):
        return [f"{where}: トップレベルがオブジェクトではない"]
    problems = []
    if settings.get("agent") != LEADER_ID:
        problems.append(f'{where}: "agent" が "{LEADER_ID}" ではない: {settings.get("agent")!r}')
    hooks = settings.get("hooks")
    if not isinstance(hooks, dict):
        return problems + [f"{where}: hooks が無い"]
    reaches_all = False
    for event, entries in hooks.items():
        if not isinstance(entries, list):
            problems.append(f"{where}: hooks.{event} が列ではない")
            continue
        for n, entry in enumerate(entries):
            inner = entry.get("hooks") if isinstance(entry, dict) else None
            if not isinstance(inner, list):
                problems.append(f"{where}: hooks.{event}[{n}] に hooks の列が無い")
                continue
            for k, hook in enumerate(inner):
                place = f"{where}: hooks.{event}[{n}].hooks[{k}]"
                if not isinstance(hook, dict):
                    problems.append(f"{place} がオブジェクトではない")
                    continue
                texts = _strings(hook)
                for text in texts:
                    if "$" in text.replace(PLACEHOLDER, ""):
                        problems.append(f"{place}: ${{CLAUDE_PROJECT_DIR}} 以外の $ がある: {text}")
                joined = " ".join(texts)
                if "allowlist.js" in joined or "guard.js" in joined:
                    if not is_guard_hook(hook):
                        problems.append(
                            f'{place}: 権限フックの形が違う（"type": "command", "command": "node", '
                            f'"args": {json.dumps(GUARD_ARGS)}, "onFailure": "block" にする）'
                        )
                    elif event == "PreToolUse" and entry.get("matcher") in ALL_TOOLS_MATCHERS:
                        reaches_all = True
    if not reaches_all:
        problems.append(f'{where}: PreToolUse に、全ツールに届く matcher（無い・""・"*"）の allowlist.js のフックが無い')
    return problems


def check_all(root):
    problems = []
    agents_dir = root / ".claude" / "agents"
    definitions = sorted(agents_dir.glob("*.md"))
    if not (agents_dir / f"{LEADER_ID}.md").is_file():
        problems.append(f".claude/agents/{LEADER_ID}.md（リーダーの定義）が無い")
    for path in definitions:
        problems += check_definition(path, root)
    problems += check_settings(root / ".claude" / "settings.json")
    for name in ("allowlist.js", "guard.js"):
        if not (root / "team" / "hooks" / name).is_file():
            problems.append(f"team/hooks/{name} が無い")
    return problems, len(definitions)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--root", default=str(ROOT), help="プロジェクトのルート（既定はこのファイルの2つ上）")
    opts = parser.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    problems, count = check_all(Path(opts.root).resolve())
    for line in problems:
        print(line)
    print(f"定義: {count} 件、問題: {len(problems)} 件")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
