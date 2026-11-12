"""書き込み（Write / Edit / MultiEdit / NotebookEdit）の検査のテスト。実際の permissions.json に対して allowlist.js を呼ぶ。

実行: python -m unittest discover -s projects/ai-editor/team/hooks/tests
"""

import os
import tempfile
import unittest
from pathlib import Path

from hookrun import FAKE_LOCALAPPDATA, PROJECT, HookTestCase, event, make_project, run

P = str(PROJECT)
P_SLASH = P.replace("\\", "/")
P_MSYS = "/" + P_SLASH[0].lower() + P_SLASH[2:]


class MemberWriteTest(HookTestCase):
    ALLOWED = {
        "meng-tian": [
            "scripts/build.mjs",
            "scripts/lib/read-secret.ps1",
            "tools/watch/watch.mjs",
            "removals/telemetry/README.md",
            "patches/0001-x.patch",
            "assets/icon.png",
            "builtin/mydist/package.json",
            "extensions-src/mydist/src/extension.ts",
            "extensions-src/mydist/tests/x.ts",          # test/ ではない
            "extensions.lock.json",
            "upstream.json",
            "product.overlay.json",
            "TAKE-IN.md",
            "package.json",
            ".gitignore",
            "tasks/2026-11-20-x/notes.md",
            "C:/b/wt/x/src/main.ts",
            "C:\\b\\wt\\x\\src\\main.ts",
            "c:/B/WT/x/src/main.ts",
            "/c/b/wt/x/src/main.ts",
            f"{P}\\scripts\\build.mjs",
            f"{P_SLASH}/scripts/build.mjs",
            f"{P_MSYS}/scripts/build.mjs",
            "SCRIPTS/Build.mjs",
            "scripts/./build.mjs",
            "docs/../scripts/build.mjs",
        ],
        "cao-shen": [
            "tests/build.test.mjs",
            "tests/smoke/smoke.ps1",
            "extensions-src/mydist/test/extension.test.ts",
            "scripts/measure.ps1",
            "scripts/netaudit.ps1",
            "Scripts\\Measure.ps1",
            "tasks/2026-11-20-x/test-notes.md",
        ],
        "ooka-echizen": [
            "records/gate-phase1.md",
            "records/take-in/2026-11-20.md",
            "tasks/2026-11-20-x/verification-2026-11-20.md",
        ],
    }

    BLOCKED = {
        "meng-tian": [
            # 他人の書き込み先・write_paths_deny
            "tests/x.mjs",
            "Tests/x.mjs",
            "tests\\x.mjs",
            "extensions-src/mydist/test/x.ts",
            "extensions-src/MyDist/TEST/x.ts",
            "scripts/measure.ps1",
            "scripts/MEASURE.PS1",
            "scripts\\netaudit.ps1",
            "records/gate.md",
            "docs/01-requirements.md",
            "scripts/../docs/x.md",
            "scripts/../tests/x.mjs",
            # 書き方を変えたすり抜け
            "tests./x.mjs",
            "tests /x.mjs",
            "scripts/measure.ps1.",
            "scripts/measure.ps1 ",
            "scripts/measure.ps1::$DATA",
            "scripts/measure.ps1:stream",
            "scripts/MEASUR~1.PS1",
            "TESTS~1/x.mjs",
            "\\\\?\\" + P + "\\tests\\x.mjs",
            "\\\\.\\" + P + "\\tests\\x.mjs",
            "//?/" + P_SLASH + "/tests/x.mjs",
            "\\\\localhost\\c$\\b\\x",
            "//localhost/c$/b/x",
            "C:scripts/x.mjs",
            "/scripts/x.mjs",
            "~/x.mjs",
            "scripts/a*b.mjs",
            "scripts/a?.mjs",
            "scripts/a\u0000.mjs",
            # write_paths の外
            "CLAUDE.md",
            "README.md",
            "x.md",
            "scriptsx/a.mjs",
            "scripts",
            "C:/bx/y",
            "C:/b",
            "C:/b/../x",
            "C:/x",
            "E:/develop/self/Team/CLAUDE.md",
            # 自己防護（permissions.json に関係なく）
            ".claude/settings.json",
            ".claude/settings.local.json",
            ".Claude/Settings.json",
            ".claude/agents/meng-tian.md",
            "team/hooks/allowlist.js",
            "team/departments/development/meng-tian/permissions.json",
            "team/roster.md",
            "team/templates/brief.md",
            ".git/config",
            ".git/hooks/pre-commit",
            "C:/b/vscode/.git/hooks/post-checkout",
            "C:/b/wt/x/.GIT/config",
            f"{P}\\.claude\\settings.json",
            f"{P_MSYS}/team/hooks/guard.js",
            "scripts/../.claude/settings.json",
        ],
        "cao-shen": [
            "scripts/build.mjs",
            "scripts/measure.ps1.",
            "scripts/measure.ps1::$DATA",
            "scripts/measure.ps1/x",
            "extensions-src/mydist/src/x.ts",
            "extensions-src/test/x.ts",                   # * は区切り1つ（空ではない）
            "extensions-src/a/b/test/x.ts",
            "extensions-src/mydist/test",                 # ディレクトリそのもの
            "records/x.md",
            "docs/x.md",
            "C:/b/wt/x/a.ts",
            "tests/../scripts/x.mjs",
            "tests/../.claude/settings.json",
            ".claude/settings.json",
            "team/hooks/allowlist.js",
        ],
        "ooka-echizen": [
            "scripts/build.mjs",
            "tests/x.mjs",
            "docs/x.md",
            "records./x.md",
            "records/../docs/x.md",
            "RECORD~1/x.md",
            "C:/b/x",
            ".claude/settings.json",
            ".git/config",
        ],
        "di-renjie": [
            "records/take-in/x.md",                       # tools に Write が無い
        ],
    }

    def test_allowed(self):
        for member, paths in self.ALLOWED.items():
            for p in paths:
                with self.subTest(member=member, path=p):
                    self.assertPass(self.write(member, p))

    def test_blocked(self):
        for member, paths in self.BLOCKED.items():
            for p in paths:
                with self.subTest(member=member, path=p):
                    self.assertBlock(self.write(member, p))

    def test_block_reasons(self):
        # すり抜けの形が、狙った理由で止まっていることを確かめる（別の理由で偶然止まっていないか）
        reasons = {
            "tests./x.mjs": "末尾が . か空白",
            "scripts/measure.ps1.": "末尾が . か空白",
            "scripts/measure.ps1::$DATA": "コロン",
            "scripts/MEASUR~1.PS1": "8.3",
            "\\\\?\\C:\\b\\x": "UNC",
            "//server/share/x": "UNC",
            "C:scripts/x.mjs": "ドライブ相対",
            "/scripts/x.mjs": "ドライブの無い",
            "scripts/MEASURE.PS1": "write_paths_deny",
            "scripts\\netaudit.ps1": "write_paths_deny",
            "extensions-src/MyDist/TEST/x.ts": "write_paths_deny",
            "scripts/../docs/x.md": "許可していない場所",   # 第2段: meng-tian の deny から docs/ が外れた。許可外として止まる
            ".Claude/Settings.json": ".claude/・team/・.git",
            "team/roster.md": ".claude/・team/・.git",
            "C:/b/wt/x/.GIT/config": ".claude/・team/・.git",
            "C:/b/../x": "許可していない場所",
            "CLAUDE.md": "許可していない場所",
        }
        for p, reason in reasons.items():
            with self.subTest(path=p):
                self.assertBlock(self.write("meng-tian", p), reason)

    def test_edit_and_multiedit_use_the_same_rules(self):
        self.assertPass(event("Edit", {"file_path": "scripts/build.mjs", "old_string": "a", "new_string": "b"}, agent_type="meng-tian"))
        self.assertBlock(event("Edit", {"file_path": "tests/x.mjs", "old_string": "a", "new_string": "b"}, agent_type="meng-tian"))
        self.assertBlock(event("Edit", {"file_path": ".claude/settings.json"}, agent_type="cao-shen"))
        self.assertBlock(event("Edit", {}, agent_type="meng-tian"))
        self.assertBlock(event("Write", {"file_path": 1}, agent_type="meng-tian"))
        # NotebookEdit・MultiEdit は今は誰の tools にも無いので、一時のプロジェクトで tools に足して確かめる
        with tempfile.TemporaryDirectory() as tmp:
            project = make_project(tmp)
            definition = project / ".claude" / "agents" / "meng-tian.md"
            text = definition.read_text(encoding="utf-8").replace("tools: Read,", "tools: NotebookEdit, MultiEdit, Read,", 1)
            definition.write_text(text, encoding="utf-8")
            cases = [
                ("NotebookEdit", {"notebook_path": "scripts/a.ipynb", "new_source": "x"}, 0),
                ("NotebookEdit", {"notebook_path": "tests/a.ipynb", "new_source": "x"}, 2),
                ("NotebookEdit", {"file_path": "scripts/a.ipynb", "new_source": "x"}, 2),  # notebook_path が無い
                ("MultiEdit", {"file_path": "scripts/a.mjs", "edits": []}, 0),
                ("MultiEdit", {"file_path": ".claude/settings.json", "edits": []}, 2),
            ]
            for tool, tool_input, want in cases:
                with self.subTest(tool=tool, tool_input=tool_input):
                    code, err = run(event(tool, tool_input, agent_type="meng-tian", cwd=str(project)), project=project)
                    self.assertEqual(code, want, err)

    def test_secret_paths_override_write_paths(self):
        # LOCALAPPDATA を C:/b/ の下に向けると、meng-tian の write_paths（C:/b/）の中に秘密が来る（ディスクには書かない）
        local = "C:\\b\\fake-local"
        self.assertPass(self.write("meng-tian", "C:/b/fake-local/Shuko/other.txt"), local=local)
        for p in ("C:/b/fake-local/Shuko/secrets/token", "C:\\B\\FAKE-LOCAL\\shuko\\watch\\state.json",
                  "/c/b/fake-local/Shuko/secrets/x", "C:/b/fake-local/Shuko/x/../secrets/y"):
            with self.subTest(path=p):
                self.assertBlock(self.write("meng-tian", p), "secret_paths", local=local)

    def test_relative_path_needs_project_cwd(self):
        self.assertBlock(self.write("meng-tian", "scripts/x.mjs", cwd="C:\\b\\wt\\x"), "相対パス")
        self.assertPass(self.write("meng-tian", f"{P}\\scripts\\x.mjs", cwd="C:\\b\\wt\\x"))
        self.assertPass(self.write("meng-tian", "scripts/x.mjs", cwd=P_SLASH.upper()))


@unittest.skipUnless(os.name == "nt", "ジャンクションは Windows だけ")
class JunctionTest(HookTestCase):
    """実在するジャンクションの先が、write_paths の外・deny・自己防護・秘密なら止める。"""

    def setUp(self):
        import _winapi

        self._tmp = tempfile.TemporaryDirectory()
        self.project = make_project(self._tmp.name)
        self.local = os.path.realpath(self._tmp.name) + "\\local"
        secrets = Path(self.local) / "Shuko" / "secrets"
        secrets.mkdir(parents=True)
        (self.project / "scripts").mkdir()
        (self.project / "docs").mkdir()
        (self.project / "tests").mkdir()
        links = {
            "to-docs": self.project / "docs",
            "to-tests": self.project / "tests",
            "to-claude": self.project / ".claude",
            "to-secrets": secrets,
            "to-outside": Path(os.path.realpath(self._tmp.name)),
        }
        for name, target in links.items():
            _winapi.CreateJunction(str(target), str(self.project / "scripts" / name))

    def tearDown(self):
        self._tmp.cleanup()

    def check(self, member, file_path, tool="Write"):
        ev = event(tool, {"file_path": file_path, "content": "x"}, agent_type=member, cwd=str(self.project))
        return run(ev, project=self.project, local=self.local)

    def test_junctions(self):
        code, err = self.check("meng-tian", "scripts/plain.mjs")
        self.assertEqual(code, 0, err)
        for p in ("scripts/to-docs/x.md", "scripts/to-tests/x.mjs", "scripts/to-claude/settings.json",
                  "scripts/to-secrets/token", "scripts/to-outside/x.txt", "scripts/to-docs/new/deep/x.md"):
            with self.subTest(path=p):
                code, err = self.check("meng-tian", p)
                self.assertEqual(code, 2, err)

    def test_read_through_junction_to_secret(self):
        code, err = self.check("cao-shen", "scripts/to-secrets/token", tool="Read")
        self.assertEqual(code, 2, err)
        self.assertIn("secret_paths", err)
        code, err = self.check("cao-shen", "scripts/to-docs/x.md", tool="Read")
        self.assertEqual(code, 0, err)


if __name__ == "__main__":
    unittest.main()
