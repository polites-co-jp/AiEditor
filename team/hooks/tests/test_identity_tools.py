"""呼び出し元の見分け（agent_type）と、定義の tools の強制のテスト。

実行: python -m unittest discover -s projects/ai-editor/team/hooks/tests
"""

import json
import tempfile
import unittest

from hookrun import HookTestCase, event, make_project, run

DANGER = [
    ("Bash", {"command": "rm -rf C:/"}),
    ("Write", {"file_path": ".claude/settings.json", "content": "{}"}),
    ("Read", {"file_path": "C:/Windows/win.ini"}),
    ("Agent", {"subagent_type": "general-purpose", "prompt": "x"}),
    ("mcp__x__y", {}),
]


class LeaderAndUnknownTest(HookTestCase):
    def test_leader_is_exempt(self):
        for tool, tool_input in DANGER:
            with self.subTest(tool=tool):
                self.assertPass(event(tool, tool_input, agent_type="vlad-tepes"))
                self.assertPass(event(tool, tool_input, agent_type="vlad-tepes", agent_id="a0123456789abcdef"))

    def test_empty_or_missing_agent_type_is_exempt(self):
        for tool, tool_input in DANGER:
            with self.subTest(tool=tool):
                self.assertPass(event(tool, tool_input))
                self.assertPass(event(tool, tool_input, agent_type=""))

    def test_leader_match_is_exact(self):
        # 表記違いは通常の規則（定義を引く）で扱う。Windows では Vlad-Tepes.md が vlad-tepes.md に当たるので、
        # 定義があって permissions.json が無いとして止まる
        self.assertBlock(self.bash("Vlad-Tepes", "rm -rf C:/"))

    def test_malformed_agent_type_is_blocked(self):
        # 差し戻し1回目: 素通しは未定義・空文字・vlad-tepes の3つだけ。ID の形でない文字列は止める（土台とは違う）
        for agent_type in ("plugin:meng-tian", "../meng-tian", "meng tian", " vlad-tepes", "vlad-tepes "):
            with self.subTest(agent_type=agent_type):
                self.assertBlock(self.bash(agent_type, "git status"), "形式が不正")

    def test_builtin_agent_without_definition_is_blocked(self):
        # 定義も permissions.json も無い（組み込み）は止める。Explore だけは第2段で固定の決まりを持つ（ExploreTest）
        for agent_type in ("general-purpose", "Plan"):
            with self.subTest(agent_type=agent_type):
                for tool, tool_input in DANGER:
                    self.assertBlock(event(tool, tool_input, agent_type=agent_type), "定義も permissions.json も無い")
                self.assertBlock(self.read(agent_type, "docs/README.md"), "定義も permissions.json も無い")

    def test_definition_without_permissions_is_blocked(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = make_project(tmp)
            (project / ".claude" / "agents" / "new-member.md").write_text(
                "---\nname: new-member\ndescription: x\nmodel: opus\ntools: Read\n---\n", encoding="utf-8"
            )
            code, err = run(self.read("new-member", "docs/x.md", cwd=str(project)), project=project)
            self.assertEqual(code, 2, err)
            self.assertIn("定義があるが permissions.json が", err)

    def test_existing_member_without_permissions_is_blocked(self):
        # 一時のプロジェクトの写し（CLAUDE_PROJECT_DIR を一時ディレクトリに向ける）で、既存メンバーの
        # permissions.json だけを消す。実ファイルは書き換えない
        with tempfile.TemporaryDirectory() as tmp:
            project = make_project(tmp)
            ok = self.bash("meng-tian", "git status", cwd=str(project))
            code, err = run(ok, project=project)
            self.assertEqual(code, 0, err)  # 対照: 写しのままなら通る
            (project / "team" / "departments" / "development" / "meng-tian" / "permissions.json").unlink()
            cases = [
                ok,
                self.bash("meng-tian", "git status", cwd=str(project), agent_id="a0123456789abcdef"),
                self.read("meng-tian", "docs/README.md", cwd=str(project)),
                event("WebSearch", {"query": "x"}, agent_type="meng-tian", cwd=str(project)),
            ]
            for ev in cases:
                with self.subTest(tool=ev["tool_name"], agent_id="agent_id" in ev):
                    code, err = run(ev, project=project)
                    self.assertEqual(code, 2, err)
                    self.assertIn("定義があるが permissions.json が", err)
            for via_guard in (False, True):
                with self.subTest(via_guard=via_guard):
                    code, err = run(ok, project=project, via_guard=via_guard)
                    self.assertEqual(code, 2, err)
            # 引数の形（permcheck.py --member の呼び方）でも止まる
            code, err = run(ok, project=project, args=("meng-tian",))
            self.assertEqual(code, 2, err)
            self.assertIn("permissions.json", err)

    def test_arg_mode_requires_permissions(self):
        code, err = run(self.bash("x", "git status"), args=("vlad-tepes",))
        self.assertEqual(code, 2, err)
        code, err = run(self.bash("x", "git status"), args=("../meng-tian",))
        self.assertEqual(code, 2, err)

    def test_bad_input_is_blocked_for_arg_mode(self):
        code, _ = run(None, args=("meng-tian",), raw="not json")
        self.assertEqual(code, 2)


class JudgeSessionTest(HookTestCase):
    """di-renjie は `claude -p --agent di-renjie` のメインセッション（agent_id なし）でも、サブエージェント（agent_id あり）
    でも同じに検査する。"""

    FORMS = ({}, {"agent_id": "a0123456789abcdef"})

    def ev(self, tool, tool_input, form):
        return event(tool, tool_input, agent_type="di-renjie", **form)

    def test_allowed(self):
        # 第2段で di-renjie の read_paths は ./ になった。プロジェクトの中は読め、path を省いた Glob・Grep も通る
        for form in self.FORMS:
            with self.subTest(form=form):
                self.assertPass(self.ev("Read", {"file_path": "docs/06-update-watch-and-take-in.md"}, form))
                self.assertPass(self.ev("Read", {"file_path": "records/take-in/2026-11-20.md"}, form))
                self.assertPass(self.ev("Read", {"file_path": "TAKE-IN.md"}, form))
                self.assertPass(self.ev("Read", {"file_path": "CLAUDE.md"}, form))
                self.assertPass(self.ev("Read", {"file_path": "scripts/build.mjs"}, form))
                self.assertPass(self.ev("Grep", {"pattern": "x", "path": "removals"}, form))
                self.assertPass(self.ev("Glob", {"pattern": "**/*.md", "path": "docs"}, form))
                self.assertPass(self.ev("Glob", {"pattern": "docs/**"}, form))   # path 省略（./）で通る
                self.assertPass(self.ev("Grep", {"pattern": "x"}, form))
                self.assertPass(self.ev("StructuredOutput", {"verdict": "accept"}, form))

    def test_blocked(self):
        for form in self.FORMS:
            with self.subTest(form=form):
                self.assertBlock(self.ev("Bash", {"command": "git status"}, form), "tools")
                self.assertBlock(self.ev("Write", {"file_path": "records/take-in/x.md", "content": "x"}, form), "tools")
                self.assertBlock(self.ev("Edit", {"file_path": "TAKE-IN.md"}, form), "tools")
                self.assertBlock(self.ev("WebFetch", {"url": "https://example.com"}, form), "tools")
                self.assertBlock(self.ev("Agent", {"subagent_type": "Explore"}, form), "tools")
                self.assertBlock(self.ev("Read", {"file_path": "C:/b/vscode/README.md"}, form))  # C:/b/ は read_paths に無い
                self.assertBlock(self.ev("Read", {"file_path": "docs/../../x"}, form))            # プロジェクトの外
                self.assertBlock(self.ev("Glob", {"pattern": "../**"}, form))


class ExploreTest(HookTestCase):
    """第2段: 組み込みの Explore は permissions.json を持たないが、固定の決まりで Read・Glob・Grep だけを通す。
    読める場所は ./ と C:/b/、secret_paths は止める。ほかのツールは止める。agent_id の有無は問わない。"""

    FORMS = ({}, {"agent_id": "a0123456789abcdef"})

    def ev(self, tool, tool_input, form):
        return event(tool, tool_input, agent_type="Explore", **form)

    def test_read_glob_grep_pass(self):
        for form in self.FORMS:
            with self.subTest(form=form):
                self.assertPass(self.ev("Read", {"file_path": "docs/README.md"}, form))
                self.assertPass(self.ev("Read", {"file_path": "C:/b/vscode/package.json"}, form))
                self.assertPass(self.ev("Glob", {"pattern": "**/*.md"}, form))           # path 省略（./）
                self.assertPass(self.ev("Grep", {"pattern": "TODO"}, form))
                self.assertPass(self.ev("Glob", {"pattern": "*.ts", "path": "C:/b/wt/x"}, form))

    def test_other_tools_blocked(self):
        for form in self.FORMS:
            with self.subTest(form=form):
                self.assertBlock(self.ev("Bash", {"command": "git status"}, form), "Read・Glob・Grep だけ")
                self.assertBlock(self.ev("Write", {"file_path": "docs/x.md", "content": "x"}, form), "Read・Glob・Grep だけ")
                self.assertBlock(self.ev("Edit", {"file_path": "docs/x.md"}, form), "Read・Glob・Grep だけ")
                self.assertBlock(self.ev("Agent", {"subagent_type": "Explore"}, form), "Read・Glob・Grep だけ")
                self.assertBlock(self.ev("WebFetch", {"url": "https://example.com"}, form), "Read・Glob・Grep だけ")

    def test_outside_and_secret_blocked(self):
        for form in self.FORMS:
            with self.subTest(form=form):
                self.assertBlock(self.ev("Read", {"file_path": "E:/develop/self/Team/CLAUDE.md"}, form))
                self.assertBlock(self.ev("Read", {"file_path": "%LOCALAPPDATA%/Shuko/secrets/token"}, form), "secret_paths")
                self.assertBlock(self.ev("Glob", {"pattern": "**/*", "path": "%LOCALAPPDATA%/Shuko/watch"}, form), "secret_paths")


class ToolsTest(HookTestCase):
    """定義の tools に無いツールは止める（Agent と Task は同じ名前として扱う）。"""

    CASES = {
        "meng-tian": (["Read", "Write", "Edit", "Glob", "Grep", "Bash", "WebSearch", "WebFetch"],
                      ["Agent", "Task", "PowerShell", "NotebookEdit", "Skill", "SendMessage", "StructuredOutput", "mcp__x__y", ""]),
        "cao-shen": (["Read", "Write", "Edit", "Glob", "Grep", "Bash", "WebSearch", "WebFetch"],
                     ["Agent", "Task", "PowerShell", "NotebookEdit", "MultiEdit", "Skill"]),
        "ooka-echizen": (["Read", "Write", "Glob", "Grep", "Bash"],
                         ["Edit", "WebSearch", "WebFetch", "Agent", "Task", "PowerShell", "NotebookEdit"]),
        "di-renjie": (["Read", "Glob", "Grep", "StructuredOutput"],
                      ["Bash", "Write", "Edit", "WebSearch", "WebFetch", "Agent", "PowerShell"]),
    }

    # ツールごとに、許可の範囲で通る入力
    OK_INPUT = {
        "Read": {"file_path": "docs/README.md"},
        "Write": {"file_path": "tasks/2026-11-20-x/notes.md", "content": "x"},
        "Edit": {"file_path": "tasks/2026-11-20-x/notes.md", "old_string": "a", "new_string": "b"},
        "Glob": {"pattern": "*.md", "path": "docs"},
        "Grep": {"pattern": "x", "path": "docs"},
        "Bash": {"command": "git status"},
        "WebSearch": {"query": "vscode release notes"},
        "WebFetch": {"url": "https://code.visualstudio.com/updates", "prompt": "x"},
        "StructuredOutput": {},
    }

    def test_tools(self):
        for member, (allowed, denied) in self.CASES.items():
            for tool in allowed:
                with self.subTest(member=member, tool=tool):
                    self.assertPass(event(tool, self.OK_INPUT[tool], agent_type=member))
            for tool in denied:
                with self.subTest(member=member, tool=tool):
                    self.assertBlock(event(tool, {}, agent_type=member), "tools")

    def test_tools_formats_and_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = make_project(tmp)
            agents = project / ".claude" / "agents"
            cases = {
                "tools: [Read, \"Bash\"]\n": (["Read", "Bash"], ["Write"]),
                "tools:\n  - Read\n  - Agent(x)\n": (["Read", "Task"], ["Bash"]),
                "tools: \"*\"\n": ([], ["Read"]),
                "tools:\n": ([], ["Read"]),
                "": ([], ["Read"]),
            }
            for tools_line, (allowed, denied) in cases.items():
                (agents / "cao-shen.md").write_text(
                    f"---\nname: cao-shen\ndescription: x\nmodel: sonnet\n{tools_line}---\n", encoding="utf-8"
                )
                ok = {"Read": {"file_path": str(project / "docs" / "x.md")}, "Bash": {"command": "git status"},
                      "Task": {"subagent_type": "x"}}
                for tool in allowed:
                    with self.subTest(tools=tools_line, tool=tool):
                        ev = event(tool, ok[tool], agent_type="cao-shen", cwd=str(project))
                        code, err = run(ev, project=project)
                        if tool == "Task":  # tools にはあるが agents が空なので、Agent の検査で止まる
                            self.assertEqual(code, 2, err)
                            self.assertIn("起動を許可していない", err)
                        else:
                            self.assertEqual(code, 0, err)
                for tool in denied:
                    with self.subTest(tools=tools_line, tool=tool):
                        code, err = run(event(tool, {}, agent_type="cao-shen", cwd=str(project)), project=project)
                        self.assertEqual(code, 2, err)
                        self.assertIn("tools", err)


class GuardTest(HookTestCase):
    def test_guard_passes_through(self):
        self.assertPass(self.bash("meng-tian", "git status"), via_guard=True)
        self.assertBlock(self.bash("meng-tian", "rm -rf x"), via_guard=True)

    def test_guard_blocks_unknown_target_and_missing_script(self):
        import subprocess
        from hookrun import GUARD, NODE

        result = subprocess.run([NODE, str(GUARD), "exclusive.js"], input="{}", capture_output=True, text=True,
                                encoding="utf-8")
        self.assertEqual(result.returncode, 2)
        self.assertIn("起動を許可していない", result.stderr)
        with tempfile.TemporaryDirectory() as tmp:
            project = make_project(tmp)
            (project / "team" / "hooks" / "allowlist.js").unlink()
            code, err = run(self.bash("meng-tian", "git status"), project=project, via_guard=True)
            self.assertEqual(code, 2, err)
            (project / "team" / "hooks" / "allowlist.js").write_text("this is not javascript(", encoding="utf-8")
            code, err = run(self.bash("meng-tian", "git status"), project=project, via_guard=True)
            self.assertEqual(code, 2, err)

    def test_broken_permissions_blocks(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = make_project(tmp)
            perm = project / "team" / "departments" / "development" / "cao-shen" / "permissions.json"
            for text in ("{", json.dumps({"bash": "git status"}), json.dumps([])):
                perm.write_text(text, encoding="utf-8")
                code, err = run(self.bash("cao-shen", "git status", cwd=str(project)), project=project)
                self.assertEqual(code, 2, err)


if __name__ == "__main__":
    unittest.main()
