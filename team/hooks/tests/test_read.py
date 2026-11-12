"""読み込み（Read / Glob / Grep）と secret_paths の検査のテスト。実際の permissions.json に対して allowlist.js を呼ぶ。
LOCALAPPDATA はテストの一時ディレクトリ（hookrun.FAKE_LOCALAPPDATA）か、一時のプロジェクトの中にする。

実行: python -m unittest discover -s projects/ai-editor/team/hooks/tests
"""

import os
import tempfile
import unittest

from hookrun import FAKE_LOCALAPPDATA, PROJECT, HookTestCase, event, make_project, run

P = str(PROJECT)
P_SLASH = P.replace("\\", "/")
MEMBERS_WITH_ALL = ("meng-tian", "cao-shen", "ooka-echizen")  # read_paths が ./ と C:/b/


class ReadTest(HookTestCase):
    def test_project_and_build_root(self):
        for member in MEMBERS_WITH_ALL:
            for p in ("docs/README.md", "CLAUDE.md", ".claude/agents/meng-tian.md", "team/hooks/allowlist.js",
                      f"{P}\\docs\\README.md", "/" + P_SLASH[0].lower() + P_SLASH[2:] + "/CLAUDE.md",
                      "C:/b/vscode/package.json", "c:\\B\\wt\\x\\src\\main.ts", "/c/b/wt/x/a.ts"):
                with self.subTest(member=member, path=p):
                    self.assertPass(self.read(member, p))

    def test_outside_is_blocked(self):
        for member in MEMBERS_WITH_ALL:
            for p in ("C:/Windows/win.ini", "C:/bx/y", "C:/b/../Windows/win.ini", "../../CLAUDE.md",
                      "E:/develop/self/Team/CLAUDE.md", "docs/../../x", "~/.claude.json",
                      "C:docs/x", "\\\\?\\C:\\b\\x", "\\\\server\\share\\x", "docs/x.md::$DATA",
                      "docs./x.md", "DOCS~1/x.md", f"{FAKE_LOCALAPPDATA}\\Shuko\\other.txt"):
                with self.subTest(member=member, path=p):
                    self.assertBlock(self.read(member, p))

    def test_judge_read_paths(self):
        # 第2段で di-renjie の read_paths は ./（プロジェクト全体）になった。中は読める、外と秘密と壊れた形は止まる
        ok = ("records/take-in/x.md", "docs/a/b.md", "TAKE-IN.md", "take-in.md", "upstream.json",
              "removals/x/README.md", "extensions.lock.json", "records/gate.md", "scripts/x.mjs",
              "CLAUDE.md", "upstream.json.bak", ".claude/settings.json")
        ng = ("C:/b/x", "../CLAUDE.md", "E:/develop/self/Team/CLAUDE.md", "docs/../../x", "~/.claude.json",
              "docs./x.md", "docs/x.md::$DATA")
        for p in ok:
            with self.subTest(path=p):
                self.assertPass(self.read("di-renjie", p))
        for p in ng:
            with self.subTest(path=p):
                self.assertBlock(self.read("di-renjie", p))


class GlobGrepTest(HookTestCase):
    def glob(self, member, pattern, path=None, **kw):
        tool_input = {"pattern": pattern}
        if path is not None:
            tool_input["path"] = path
        return event("Glob", tool_input, agent_type=member, **kw)

    def grep(self, member, path=None, glob=None, **kw):
        tool_input = {"pattern": "TODO"}
        if path is not None:
            tool_input["path"] = path
        if glob is not None:
            tool_input["glob"] = glob
        return event("Grep", tool_input, agent_type=member, **kw)

    def test_allowed(self):
        for member in MEMBERS_WITH_ALL:
            with self.subTest(member=member):
                self.assertPass(self.glob(member, "**/*.mjs"))
                self.assertPass(self.glob(member, "src/**/*.ts", "C:/b/wt/x"))
                self.assertPass(self.grep(member))
                self.assertPass(self.grep(member, "scripts", "*.{mjs,ps1}"))
                self.assertPass(self.grep(member, "C:\\b\\vscode"))

    def test_blocked(self):
        for member in MEMBERS_WITH_ALL:
            cases = [
                self.glob(member, "../**/*.md"),
                self.glob(member, "docs/../../x/*"),
                self.glob(member, "..\\x\\*"),
                self.glob(member, "/c/Users/**"),
                self.glob(member, "C:/Users/**"),
                self.glob(member, "~/**"),
                self.glob(member, "{docs,/c/Users}/**"),
                self.glob(member, "*.md", "C:/"),
                self.glob(member, "*.md", "C:/b/.."),
                self.glob(member, "*.md", "E:/develop/self/Team"),
                self.glob(member, "*.md", ".."),
                self.grep(member, "C:/Users"),
                self.grep(member, glob="../*"),
                self.grep(member, glob="C:/x/*"),
                self.grep(member, glob=1),
                self.glob(member, "*.md", cwd="C:\\Users"),       # path 省略時は cwd
                self.grep(member, cwd="C:\\Users"),
                self.glob(member, None),
            ]
            for n, ev in enumerate(cases):
                with self.subTest(member=member, case=n):
                    self.assertBlock(ev)

    def test_search_root_containing_secret_is_blocked(self):
        # 探す範囲の下に秘密の場所があれば止める（read_paths の中に秘密を置いた一時のプロジェクトで）
        with tempfile.TemporaryDirectory() as tmp:
            project = make_project(tmp)
            local = str(project / "local")
            os.makedirs(os.path.join(local, "Shuko", "secrets"))
            kw = {"project": project, "local": local}
            for ev in (
                self.grep("cao-shen", cwd=str(project)),                       # 直下（秘密を含む）
                self.glob("cao-shen", "**/*", str(project / "local"), cwd=str(project)),
                self.grep("cao-shen", "local/Shuko", cwd=str(project)),
                event("Read", {"file_path": "local/Shuko/secrets/token"}, agent_type="cao-shen", cwd=str(project)),
                event("Read", {"file_path": "LOCAL\\shuko\\WATCH\\state.json"}, agent_type="cao-shen", cwd=str(project)),
                event("Read", {"file_path": "local/Shuko/x/../secrets/t"}, agent_type="cao-shen", cwd=str(project)),
                event("Write", {"file_path": "tests/../local/Shuko/secrets/t"}, agent_type="cao-shen", cwd=str(project)),
            ):
                with self.subTest(ev=ev):
                    code, err = run(ev, **kw)
                    self.assertEqual(code, 2, err)
                    self.assertIn("secret_paths", err)
            ok = self.grep("cao-shen", "docs", cwd=str(project))
            code, err = run(ok, **kw)
            self.assertEqual(code, 0, err)
            ok = event("Read", {"file_path": "local/Shuko/other.txt"}, agent_type="cao-shen", cwd=str(project))
            code, err = run(ok, **kw)
            self.assertEqual(code, 0, err)


class SecretEnvTest(HookTestCase):
    def test_unexpandable_env_blocks_file_tools(self):
        for ev in (self.read("cao-shen", "docs/README.md"), self.write("cao-shen", "tests/x.mjs"),
                   self.read("di-renjie", "docs/README.md")):
            with self.subTest(ev=ev):
                self.assertBlock(ev, "展開できない", env_extra={"LOCALAPPDATA": None})

    def test_tools_without_paths_do_not_need_env(self):
        self.assertPass(event("WebSearch", {"query": "x"}, agent_type="meng-tian"), env_extra={"LOCALAPPDATA": None})

    def test_secret_under_real_localappdata_form(self):
        for member in ("meng-tian", "cao-shen", "ooka-echizen", "di-renjie"):
            for p in (f"{FAKE_LOCALAPPDATA}\\Shuko\\secrets\\token", f"{FAKE_LOCALAPPDATA}/shuko/WATCH/x",
                      "%LOCALAPPDATA%/Shuko/secrets/token"):
                with self.subTest(member=member, path=p):
                    self.assertBlock(self.read(member, p))


if __name__ == "__main__":
    unittest.main()
