"""読み込み（Read / Glob / Grep）と secret_paths の検査のテスト。実際の permissions.json に対して allowlist.js を呼ぶ。
LOCALAPPDATA はテストの一時ディレクトリ（hookrun.FAKE_LOCALAPPDATA）か、一時のプロジェクトの中にする。

2026-11-16（Team の tasks/2026-11-16-ai-editor-move-off-c-perms の v2-1）:
- ビルドの置き場所は tmp/b（./ の中）に移った。tmp/b の下を読む判定は、tmp/b の偽の木を持つ写しのプロジェクト
  （BuildTreeReadTest。本物の tmp/b に頼らない）で行う。
- 3人の read_paths の C:/b/ は v2-1 の間だけ残る一時の行。C:/b を読める判定は ReadCDriveV21Test に分けた
  （v2-2・v2-3 を当てたときに直す。クラスの説明）。C:/b の下の名前は、実在に頼らない名前にした。
- 狄仁傑の read_paths は ./ から TAKE-IN.md・docs/・records/take-in/ に絞られた（U3）。test_judge_read_paths の
  通る側の8つ（.claude/settings.json・CLAUDE.md・extensions.lock.json・records/gate.md・removals/x/README.md・
  scripts/x.mjs・upstream.json・upstream.json.bak）は止まる側に移した（意図した期待の変更）。
- 5a（探す範囲）: 直下からの Glob の **/*.mjs は tmp/ の大きな木に入りうるので止まる。GlobGrepTest.test_allowed の
  その入力を scripts/**/*.mjs に替え、**/*.mjs は止まる側の例に移した（意図した期待の変更。5a の判定は test_search_scope）。

実行: python -m unittest discover -s projects/ai-editor/team/hooks/tests
"""

import os
import tempfile
import unittest

from hookrun import FAKE_LOCALAPPDATA, PROJECT, BuildTreeTestCase, HookTestCase, event, make_project, run

P = str(PROJECT)
P_SLASH = P.replace("\\", "/")
MEMBERS_WITH_ALL = ("meng-tian", "cao-shen", "ooka-echizen")  # read_paths が ./（v2-1 の間は C:/b/ も）
C_B_NAME = "no-such-hooktest"  # C:/b の下の、実在に頼らない名前（判定は lstat・realpath でしか触れない）


class ReadTest(HookTestCase):
    def test_project_and_build_root(self):
        for member in MEMBERS_WITH_ALL:
            for p in ("docs/README.md", "CLAUDE.md", ".claude/agents/meng-tian.md", "team/hooks/allowlist.js",
                      f"{P}\\docs\\README.md", "/" + P_SLASH[0].lower() + P_SLASH[2:] + "/CLAUDE.md"):
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
        # 第2段で di-renjie の read_paths は ./（プロジェクト全体）になり、2026-11-16（U3）で判定に使う場所
        # TAKE-IN.md・docs/・records/take-in/ に絞られた。その中は読める、外と秘密と壊れた形は止まる。
        # 前は通る側にあった8つ（upstream.json から .claude/settings.json まで）は、U3 で止まる側に移した
        ok = ("records/take-in/x.md", "records/take-in/1.146.0/upstream/releases.json", "docs/a/b.md", "TAKE-IN.md",
              "take-in.md", "DOCS/A.md")
        ng = ("C:/b/x", "../CLAUDE.md", "E:/develop/self/Team/CLAUDE.md", "docs/../../x", "~/.claude.json",
              "docs./x.md", "docs/x.md::$DATA",
              # U3 で止まる側に移した8つ（前は ./ で読めた）
              ".claude/settings.json", "CLAUDE.md", "extensions.lock.json", "records/gate.md", "removals/x/README.md",
              "scripts/x.mjs", "upstream.json", "upstream.json.bak",
              # U3 の絞り込みの境目
              "records/builds/1.146.0.json", "records/take-inx/y.md", "records/x.md", "TAKE-IN.md.bak", "TAKE-IN.md/x",
              "docsx/a.md", "tmp/b/wt/1.146.0/README.md", "builtin/keep.json", "docs/../CLAUDE.md")
        for p in ok:
            with self.subTest(path=p):
                self.assertPass(self.read("di-renjie", p))
        for p in ng:
            with self.subTest(path=p):
                self.assertBlock(self.read("di-renjie", p))


class ReadCDriveV21Test(HookTestCase):
    """v2-1（2026-11-16）の間だけ、3人の read_paths に C:/b/ が残る（古いログを読む用。perm-proposal.md の1節）。

    【v2-2・v2-3 を当てたときに直す】v2-2 で曹参・大岡越前守の C:/b/ が、v2-3 で蒙恬の C:/b/ が外れる。そのとき
    test_c_b_readable_in_v2_1 と GlobGrepTest.test_allowed_c_b_v2_1 の、その人の C:/b の入力は止まる側に移す
    （perm-proposal.md の「本物のテストの直し（v2-1 を当てたとき）」の節）。狄仁傑はもともと読めない。"""

    def test_c_b_readable_in_v2_1(self):
        for member in MEMBERS_WITH_ALL:
            for p in (f"C:/b/{C_B_NAME}/package.json", f"c:\\B\\{C_B_NAME}\\x\\src\\main.ts", f"/c/b/{C_B_NAME}/x/a.ts"):
                with self.subTest(member=member, path=p):
                    self.assertPass(self.read(member, p))

    def test_judge_cannot_read_c_b(self):
        self.assertBlock(self.read("di-renjie", f"C:/b/{C_B_NAME}/README.md"), "読むことを許可していない")


class BuildTreeReadTest(BuildTreeTestCase):
    """tmp/b（./ の中）を読む判定。tmp/b の偽の木を持つ写しのプロジェクトで確かめる（2026-11-16）。"""

    def test_members_read_build_root(self):
        for member in MEMBERS_WITH_ALL:
            for p in ("tmp/b/vscode/package.json", "tmp\\b\\wt\\x\\src\\main.ts", f"{self.P_SLASH}/tmp/b/wt/x/a.ts",
                      "tmp/b/netlog/x.json"):
                with self.subTest(member=member, path=p):
                    self.assertPass(self.read(member, p))

    def test_judge_does_not_read_build_root(self):
        # U3: 狄仁傑は tmp/ の下（作業ツリー・展開した版・ネットのログ）を読めない
        for p in ("tmp/b/vscode/package.json", "tmp/b/wt/x/README.md", "tmp/b/netlog/x.json"):
            with self.subTest(path=p):
                self.assertBlock(self.read("di-renjie", p), "読むことを許可していない")


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
        # 2026-11-16: 直下からの **/*.mjs は 5a で止まるので scripts/**/*.mjs に替えた（**/*.mjs は test_root_recursive_glob）。
        # C:/b を探す形は test_allowed_c_b_v2_1 に分けた
        for member in MEMBERS_WITH_ALL:
            with self.subTest(member=member):
                self.assertPass(self.glob(member, "scripts/**/*.mjs"))
                self.assertPass(self.glob(member, "*.md"))
                self.assertPass(self.grep(member))
                self.assertPass(self.grep(member, "scripts", "*.{mjs,ps1}"))
                self.assertPass(self.grep(member, glob="**/*.md"))

    def test_root_recursive_glob(self):
        # 5a（2026-11-16）: 直下からの **/*.mjs は tmp/ の大きな木に入りうるので止まる（前は通る側の例だった）
        for member in MEMBERS_WITH_ALL:
            with self.subTest(member=member):
                self.assertBlock(self.glob(member, "**/*.mjs"), "tmp/")

    def test_allowed_c_b_v2_1(self):
        # 【v2-2・v2-3 を当てたときに直す】v2-1 の間だけ、3人とも C:/b の下を探せる（ReadCDriveV21Test の説明）
        for member in MEMBERS_WITH_ALL:
            with self.subTest(member=member):
                self.assertPass(self.glob(member, "src/**/*.ts", f"C:/b/{C_B_NAME}/x"))
                self.assertPass(self.grep(member, f"C:\\b\\{C_B_NAME}"))

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
