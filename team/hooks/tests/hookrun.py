"""テストの共通部品: allowlist.js を node で呼び、終了コードと stderr を返す。

- 本物のプロジェクト（projects/ai-editor）を CLAUDE_PROJECT_DIR にして、実際の permissions.json と定義を読ませる。
- LOCALAPPDATA は呼び出しごとに渡す（既定はテストの一時ディレクトリ。本物の %LOCALAPPDATA% は使わない）。
- 一時のプロジェクト（本物の定義と permissions.json を写したもの）を作る make_project も置く。
- 一時のプロジェクトに仮のメンバーを足す add_member と、素の node --check を許す仮のメンバーを持つ
  一時のプロジェクト（bare_node_check_project）も置く。実ファイルの permissions.json に頼らず、
  テスト用の許可でフックの固定の検査を確かめるため。
"""

import atexit
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

HOOKS = Path(__file__).resolve().parent.parent
PROJECT = HOOKS.parent.parent  # projects/ai-editor
ALLOWLIST = HOOKS / "allowlist.js"
GUARD = HOOKS / "guard.js"
NODE = shutil.which("node")

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
