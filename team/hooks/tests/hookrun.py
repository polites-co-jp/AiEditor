"""テストの共通部品: allowlist.js を node で呼び、終了コードと stderr を返す。

- 本物のプロジェクト（projects/ai-editor）を CLAUDE_PROJECT_DIR にして、実際の permissions.json と定義を読ませる。
- LOCALAPPDATA は呼び出しごとに渡す（既定はテストの一時ディレクトリ。本物の %LOCALAPPDATA% は使わない）。
- 一時のプロジェクト（本物の定義と permissions.json を写したもの）を作る make_project も置く。
- 一時のプロジェクトに仮のメンバーを足す add_member と、素の node --check を許す仮のメンバーを持つ
  一時のプロジェクト（bare_node_check_project）も置く。実ファイルの permissions.json に頼らず、
  テスト用の許可でフックの固定の検査を確かめるため。
- ビルドの置き場所 tmp/b の偽の木を持つ一時のプロジェクト（make_build_project・build_project）と、その上で判定する
  土台 BuildTreeTestCase も置く（2026-11-16。C:/b から tmp/b へ移した権限〔v2-1〕に合わせた）。フックの 3c（git -C の先の
  .git）・3d（pnpm --dir の先の package.json）・3a（相対パスの削除の realpath）は、判定のときにプロジェクトの中の
  tmp/b を lstat する。本物の tmp/b に頼らず、写しの下に同じ名前を作って確かめるため。本物の tmp/ は写さない。
- __pycache__ を残さない: sys.dont_write_bytecode を立て、終了時に tests/ と hooks/ の __pycache__ の .pyc を消す
  （unittest が読み込んだテストのモジュール自身の .pyc は、立てる前に書かれるため）。
"""

import sys

sys.dont_write_bytecode = True

import atexit  # noqa: E402
import json  # noqa: E402
import os  # noqa: E402
import shutil  # noqa: E402
import subprocess  # noqa: E402
import tempfile  # noqa: E402
import unittest  # noqa: E402
from pathlib import Path  # noqa: E402

HOOKS = Path(__file__).resolve().parent.parent
PROJECT = HOOKS.parent.parent  # projects/ai-editor
ALLOWLIST = HOOKS / "allowlist.js"
GUARD = HOOKS / "guard.js"
NODE = shutil.which("node")
GIT = shutil.which("git")


def _drop_bytecode():
    """tests/ と hooks/ の __pycache__ の .pyc を消し、空になった __pycache__ を消す（ほかの物には触れない）。"""
    for cache in (Path(__file__).resolve().parent / "__pycache__", HOOKS / "__pycache__"):
        if not cache.is_dir():
            continue
        for pyc in cache.glob("*.pyc"):
            try:
                pyc.unlink()
            except OSError:
                pass
        try:
            cache.rmdir()
        except OSError:
            pass


atexit.register(_drop_bytecode)

# 秘密の置き場の代わり（実在しなくてよい。テストの外では作らない）
_LOCAL_TMP = tempfile.mkdtemp(prefix="ai-editor-hooks-local-")
atexit.register(shutil.rmtree, _LOCAL_TMP, True)
FAKE_LOCALAPPDATA = os.path.realpath(_LOCAL_TMP)


def event(tool_name, tool_input, agent_type=None, agent_id=None, cwd=None):
    e = {"hook_event_name": "PreToolUse", "tool_name": tool_name, "tool_input": tool_input}
    if agent_type is not None:
        e["agent_type"] = agent_type
    if agent_id is not None:
        e["agent_id"] = agent_id
    e["cwd"] = str(PROJECT) if cwd is None else cwd
    return e


def run(ev, project=None, args=(), local=None, via_guard=False, env_extra=None, raw=None):
    """allowlist.js（または guard.js 経由）を呼ぶ。(終了コード, stderr) を返す。"""
    project = Path(project or PROJECT)
    env = dict(os.environ)
    env["CLAUDE_PROJECT_DIR"] = str(project)
    env["LOCALAPPDATA"] = FAKE_LOCALAPPDATA if local is None else local
    if env_extra:
        for key, value in env_extra.items():
            if value is None:
                env.pop(key, None)
            else:
                env[key] = value
    hooks = project / "team" / "hooks"
    script = [str(hooks / "guard.js"), "allowlist.js"] if via_guard else [str(hooks / "allowlist.js")]
    result = subprocess.run(
        [NODE, *script, *args],
        input=raw if raw is not None else json.dumps(ev),
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
        timeout=30,
    )
    return result.returncode, result.stderr


def make_project(tmp):
    """本物の定義・permissions.json・フックを写した一時のプロジェクトを作り、そのパス（realpath）を返す。"""
    root = Path(os.path.realpath(tmp)) / "proj"
    shutil.copytree(PROJECT / ".claude" / "agents", root / ".claude" / "agents")
    shutil.copytree(PROJECT / "team" / "departments", root / "team" / "departments")
    (root / "team" / "hooks").mkdir(parents=True)
    for name in ("allowlist.js", "guard.js"):
        shutil.copy2(HOOKS / name, root / "team" / "hooks" / name)
    shutil.copy2(PROJECT / ".claude" / "settings.json", root / ".claude" / "settings.json")
    return root


# ---- tmp/b の偽の木（2026-11-16。C:/b から tmp/b へ移した権限 v2-1 に合わせた） ----

# 作業ツリー（.git ファイルと package.json を持つ）。テストの固定の入力が使う名前
BUILD_WORKTREES = ("x", "1.96", "w1", "p2", "1.146.0", "1.146.0-p2-all", "1.146.0-p5-c1", "withpkg")
# 作業ツリーでないフォルダ（.git も package.json も無い。gulp の出力・外し損ねた跡の役）
BUILD_PLAIN_DIRS = ("plain", "VSCode-win32-x64")
# extensions-src の下の、package.json を持つフォルダ（本物にもある名前。3d の判定を本物と同じにするため）
EXTENSION_DIRS = ("mydist", "notion-sync")
# 残す版などの、判定に出てくる名前（中身は空）
BUILD_DIRS = (
    "p1/1.146.0-p1-a1-r3", "p2/1.146.0-p2-all", "p2/other", "p2/1.146.0-p5-c-all/logs", "p2/1.146.0-p5-c-all-r2/logs",
    "p2/1.146.0-p5-c-all-r2-ooka/logs", "smoke/ext/1.146.0-p1-a1-r3", "smoke/ext/1.146.0-p2-all-1",
    "smoke/ext/1.146.0-p5-c-all-1/logs", "smoke/ext/1.146.0-p5r2-1/logs", "smoke/ext/1.146.0-p4-x", "cache", "netlog",
)
BUILD_FILES = (
    "dist/1.146.0-p2-all.zip", "dist/1.146.0-p1-a1-r3.zip", "dist/1.146.0-p5-c-all.zip", "dist/1.146.0-p5-c-all-r2.zip",
    "dist/other.zip", "smoke/ext/1.146.0-p1-a1-r3.marker.json", "smoke/ext/1.146.0-p5-c-all-1.marker.json",
)


def make_git_dir(git_dir, head="ref: refs/heads/main\n"):
    """git がリポジトリとして読む最低限の .git ディレクトリ（HEAD・objects/・refs/）を作る（3c の形を満たす）。"""
    git_dir = Path(git_dir)
    (git_dir / "objects").mkdir(parents=True)
    (git_dir / "refs" / "heads").mkdir(parents=True)
    (git_dir / "HEAD").write_bytes(head.encode("utf-8"))
    (git_dir / "config").write_text("[core]\n", encoding="utf-8")


def make_worktree(path, clone):
    """作業ツリーの役のフォルダ（.git ファイル〔フックは中身を見ない〕と package.json）を作る。"""
    path = Path(path)
    path.mkdir(parents=True, exist_ok=True)
    (path / ".git").write_text(f"gitdir: {Path(clone) / '.git' / 'worktrees' / path.name}\n", encoding="utf-8")
    (path / "package.json").write_text('{"name":"wt","private":true}\n', encoding="utf-8")


def add_build_tree(root):
    """一時のプロジェクト root に、tmp/b の偽の木と extensions-src の package.json を作る。"""
    root = Path(root)
    if root.resolve() == PROJECT.resolve():
        raise ValueError("本物のプロジェクトには偽の木を作らない")
    b = root / "tmp" / "b"
    make_git_dir(b / "vscode" / ".git")
    for name in BUILD_WORKTREES:
        make_worktree(b / "wt" / name, b / "vscode")
    for name in BUILD_PLAIN_DIRS:
        (b / "wt" / name).mkdir(parents=True)
    make_worktree(b / "wt-r2" / "1.146.0", b / "vscode")  # 課の作業の跡（tmp/b/wt/* の外。R19）
    for rel in BUILD_DIRS:
        (b / rel).mkdir(parents=True, exist_ok=True)
    for rel in BUILD_FILES:
        (b / rel).parent.mkdir(parents=True, exist_ok=True)
        (b / rel).write_bytes(b"x")
    for name in EXTENSION_DIRS:
        (root / "extensions-src" / name).mkdir(parents=True, exist_ok=True)
        (root / "extensions-src" / name / "package.json").write_text('{"name":"ext","private":true}\n', encoding="utf-8")
    for name in ("docs", "scripts", "tasks"):
        (root / name).mkdir(exist_ok=True)


def make_build_project(tmp):
    """make_project の写しに tmp/b の偽の木を足した一時のプロジェクト（書き換えてよい1回きりのもの）を返す。"""
    root = make_project(tmp)
    add_build_tree(root)
    return root


_build_project = None


def build_project():
    """tmp/b の偽の木を持つ一時のプロジェクト（書き換えない共用のもの）。モジュールで1つだけ作り、終了時に消す。"""
    global _build_project
    if _build_project is None:
        tmp = tempfile.mkdtemp(prefix="ai-editor-hooks-build-")
        atexit.register(shutil.rmtree, tmp, True)
        _build_project = make_build_project(tmp)
    return _build_project


def fwd(path):
    return str(path).replace("\\", "/")


def add_member(project, agent_id, permissions, tools="Read, Bash", department="development"):
    """一時のプロジェクトに、仮のメンバー（定義と permissions.json）を足す。本物のプロジェクトには使わない。"""
    project = Path(project)
    if project.resolve() == PROJECT.resolve():
        raise ValueError("本物のプロジェクトには仮のメンバーを足さない")
    definition = project / ".claude" / "agents" / f"{agent_id}.md"
    definition.write_text(
        f"---\nname: {agent_id}\ndescription: テスト用の仮のメンバー\nmodel: haiku\ntools: {tools}\n---\n\nテスト用。\n",
        encoding="utf-8",
    )
    member_dir = project / "team" / "departments" / department / agent_id
    member_dir.mkdir(parents=True)
    (member_dir / "permissions.json").write_text(json.dumps(permissions, ensure_ascii=False, indent=2), encoding="utf-8")


# 素の node --check を許す仮のメンバー。2026-11-13 に meng-tian・cao-shen の node --check は
# <ディレクトリ>/ の行に絞られ（末尾が / の行の決まりにより、オプションを書けない）、本物の許可では
# 「フックの node のオプションの検査が止めすぎない」ことを確かめられなくなったため。
BARE_NODE_CHECK = "node-check-probe"
_bare_project = None


def bare_node_check_project():
    """meng-tian の permissions.json の写しから node --check の行を除き、素の「node --check」1行を足した
    仮のメンバー（BARE_NODE_CHECK）を持つ一時のプロジェクトのパスを返す。モジュールで1つだけ作り、終了時に消す。"""
    global _bare_project
    if _bare_project is None:
        tmp = tempfile.mkdtemp(prefix="ai-editor-hooks-bare-")
        atexit.register(shutil.rmtree, tmp, True)
        project = make_project(tmp)
        source = next((project / "team" / "departments").glob("*/meng-tian/permissions.json"))
        permissions = json.loads(source.read_text(encoding="utf-8"))
        bash = [line for line in permissions["bash"] if not (line == "node --check" or line.startswith("node --check "))]
        permissions["bash"] = bash + ["node --check"]
        add_member(project, BARE_NODE_CHECK, permissions)
        _bare_project = project
    return _bare_project


class HookTestCase(unittest.TestCase):
    """allowlist.js を呼ぶテストの土台。assertPass / assertBlock を持つ。"""

    @classmethod
    def setUpClass(cls):
        if NODE is None:
            raise unittest.SkipTest("node が見つからない")

    def assertPass(self, ev, **kw):
        code, err = run(ev, **kw)
        self.assertEqual(code, 0, f"通るはずが止まった: {json.dumps(ev, ensure_ascii=False)}\n{err}")

    def assertBlock(self, ev, contains=None, **kw):
        code, err = run(ev, **kw)
        self.assertEqual(code, 2, f"止まるはずが通った（{code}）: {json.dumps(ev, ensure_ascii=False)}\n{err}")
        if contains:
            self.assertIn(contains, err)
        return err

    def assertPassBareNodeCheck(self, command):
        """素の node --check を許す仮のメンバー（bare_node_check_project）で、command が通ることを確かめる。"""
        project = bare_node_check_project()
        self.assertPass(self.bash(BARE_NODE_CHECK, command, cwd=str(project)), project=project)

    # よく使う形
    def bash(self, member, command, **kw):
        return event("Bash", {"command": command}, agent_type=member, **kw)

    def write(self, member, file_path, **kw):
        return event("Write", {"file_path": file_path, "content": "x"}, agent_type=member, **kw)

    def read(self, member, file_path, **kw):
        return event("Read", {"file_path": file_path}, agent_type=member, **kw)


class BuildTreeTestCase(HookTestCase):
    """tmp/b の偽の木を持つ一時のプロジェクト（build_project。本物の定義・permissions.json・フックの写し）で判定する土台。
    bash / read / write の cwd と、assertPass / assertBlock の project は、渡さなければその写しになる。
    本物の権限（v2-1）の tmp/b の行を、本物の tmp/b に頼らずに確かめるため。"""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.project = build_project()
        cls.P = str(cls.project)
        cls.P_SLASH = fwd(cls.project)

    def assertPass(self, ev, **kw):
        kw.setdefault("project", self.project)
        return super().assertPass(ev, **kw)

    def assertBlock(self, ev, contains=None, **kw):
        kw.setdefault("project", self.project)
        return super().assertBlock(ev, contains, **kw)

    def ev(self, tool, tool_input, member, **kw):
        kw.setdefault("cwd", str(self.project))
        return event(tool, tool_input, agent_type=member, **kw)

    def bash(self, member, command, **kw):
        return self.ev("Bash", {"command": command}, member, **kw)

    def write(self, member, file_path, **kw):
        return self.ev("Write", {"file_path": file_path, "content": "x"}, member, **kw)

    def read(self, member, file_path, **kw):
        return self.ev("Read", {"file_path": file_path}, member, **kw)


def event_without_cwd(ev):
    """フック入力から cwd を外した写し（3e。cwd の無い入力）。"""
    ev = dict(ev)
    ev.pop("cwd", None)
    return ev
