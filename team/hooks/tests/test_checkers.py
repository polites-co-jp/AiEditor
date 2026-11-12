"""permcheck.py と hookcheck.py のテスト。本物の permissions.json・定義・settings.json と、書き換えた一時のプロジェクトで確かめる。

実行: python -m unittest discover -s projects/ai-editor/team/hooks/tests
"""

import contextlib
import io
import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

from hookrun import FAKE_LOCALAPPDATA, HOOKS, NODE, PROJECT, make_project

sys.path.insert(0, str(HOOKS))
import hookcheck  # noqa: E402
import permcheck  # noqa: E402


def quiet(fn, *args, **kw):
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        code = fn(*args, **kw)
    return code, out.getvalue()


class PermcheckRealTest(unittest.TestCase):
    def test_real_permissions_have_no_errors(self):
        lines, errors, _ = permcheck.check_all(PROJECT)
        self.assertEqual(errors, 0, "\n".join(lines))


class PermcheckRulesTest(unittest.TestCase):
    def issues(self, data, member="cao-shen"):
        text = data if isinstance(data, str) else json.dumps(data)
        return permcheck.check_text(text, member, PROJECT)

    def errors(self, data, member="cao-shen"):
        return [m for level, m in self.issues(data, member) if level == permcheck.ERROR]

    def warns(self, data, member="cao-shen"):
        return [m for level, m in self.issues(data, member) if level == permcheck.WARN]

    def test_good(self):
        self.assertEqual(self.errors({"bash": ["git -C C:/b/wt/* diff", "node scripts/*.mjs"], "read_paths": ["./", "C:/b/"],
                                      "write_paths": ["tests/", "extensions-src/*/test/"], "write_paths_deny": ["tests/x/"],
                                      "secret_paths": ["%LOCALAPPDATA%/Shuko/secrets/"], "agents": [], "skills": []}), [])

    def test_structure(self):
        self.assertTrue(self.errors("{"))
        self.assertTrue(self.errors("[]"))
        self.assertTrue(self.errors('{"bash": [], "bash": []}'))
        self.assertTrue(self.errors({"bash": [], "web": []}))
        self.assertTrue(self.errors({"bash": "git status"}))
        self.assertTrue(self.errors({"bash": [1]}))
        self.assertTrue(self.errors('\ufeff{"bash": []}'.encode("utf-8").decode("utf-8")))
        self.assertTrue(self.warns({"bash": ["git status", "git status"], "read_paths": []}))
        self.assertTrue(self.warns({"bash": []}))  # read_paths が無い

    def test_bash(self):
        for entry in ("", " git status", "git status; x", "git diff > x", "node (x)", "git -C C:/b/** diff",
                      "* status", "git -C * diff", "git -C C:/b/wt/../x diff", "node $(x)",
                      "node --test /abs/", "node --test C:/b/", "tests/"):  # 末尾が / の書き方の書き間違い
            with self.subTest(entry=entry):
                self.assertTrue(self.errors({"bash": [entry], "read_paths": []}))
        # 末尾が / の正しい書き方（ディレクトリの下に限る）はエラーにしない
        self.assertEqual(self.errors({"bash": ["node --test tests/", "node --test extensions-src/*/test/",
                                               "node --test --test-concurrency=1 tests/", "node --test tests/unit/"],
                                      "read_paths": []}), [])

    def test_bash_dir_scoped_mistakes(self):
        # P4（verification-stage2）: 末尾が / の書き間違い。理由ごとに1つ以上のエラー
        cases = {
            "node --test ./": "プロジェクト直下",
            "git status/": "コマンド名のすぐ後ろ",
            "node */x/": "* だけの区切りで始まる",
            "node --test tests//": "空の区切り",
            "node --test */": "* だけの区切りで始まる",
            "node --test ./tests/": ". の区切り",
            "node --test tests/./x/": ". の区切り",
        }
        for entry, reason in cases.items():
            with self.subTest(entry=entry):
                errors = self.errors({"bash": [entry], "read_paths": []})
                self.assertTrue(any(reason in m for m in errors), errors)
        # verification-stage2 の s2bad の 14 行は全部エラー、s2ok の 4 行はエラーなし
        bad = ["tests/", "node --test C:/x/", "node --test /", "node --test ../", "node --test tests/../x/",
               "node --test tests\\", "node --test **/", "node --test ./", "git status/", "node --test D:/",
               "node --test a:b/", "*/", "node */x/", "node --test tests//"]
        for entry in bad:
            with self.subTest(entry=entry):
                self.assertTrue(self.errors({"bash": [entry], "read_paths": []}))
        ok = ["git status", "node --test tests/", "node --test extensions-src/*/test/", "node --test --test-concurrency=1 tests/"]
        self.assertEqual(self.errors({"bash": ok, "read_paths": []}), [])
        self.assertTrue(self.warns({"bash": ["git log --format='%h x'"], "read_paths": []}))

    def test_paths(self):
        bad_write = ("", "./", ".", "../x/", "a/../b", "a/./b", "a//b", "C:x", "/c/b/", "/x/", "~/x", "%TEMP%/x",
                     "\\\\server\\x", "C:\\b\\", "a:b", "a./", "a /", "MEASUR~1.PS1", "a**/", "*:/x", "a?",
                     ".claude/", "team/hooks/", ".git/", "C:/b/x/.git/")
        for entry in bad_write:
            with self.subTest(entry=entry):
                self.assertTrue(self.errors({"write_paths": [entry], "read_paths": []}))
        self.assertEqual(self.errors({"read_paths": ["./", "C:/b/", "docs/", "TAKE-IN.md", "extensions-src/*/test/"]}), [])
        self.assertTrue(self.errors({"read_paths": ["."]}))
        self.assertTrue(self.errors({"read_paths": ["../"]}))
        self.assertTrue(self.warns({"write_paths": ["tests/"], "write_paths_deny": ["docs/"], "read_paths": []}))
        self.assertFalse(self.warns({"write_paths": ["extensions-src/"], "write_paths_deny": ["extensions-src/*/test/"], "read_paths": []}))

    def test_secret_paths(self):
        for entry in ("", "%LOCALAPPDATA%/*/x", "%LOCALAPPDATA%/../x", "C:/x/%LOCALAPPDATA%/y", "%LOCAL APPDATA%/x",
                      "%LOCALAPPDATA/x", "C:x"):
            with self.subTest(entry=entry):
                self.assertTrue(self.errors({"secret_paths": [entry], "read_paths": []}))
        old = os.environ.pop("AI_EDITOR_TEST_UNSET", None)
        self.assertTrue(self.warns({"secret_paths": ["%AI_EDITOR_TEST_UNSET%/x/"], "read_paths": []}))
        if old is not None:
            os.environ["AI_EDITOR_TEST_UNSET"] = old

    def test_member_and_agents(self):
        self.assertTrue(self.errors({"read_paths": []}, member="nobody"))
        self.assertTrue(self.errors({"read_paths": []}, member="vlad-tepes"))
        self.assertTrue(self.errors({"agents": ["nobody"], "read_paths": []}))
        self.assertTrue(self.errors({"agents": ["../x"], "read_paths": []}))
        self.assertEqual(self.errors({"agents": ["meng-tian"], "read_paths": []}), [])

    def test_cross_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = make_project(tmp)
            shutil.rmtree(project / "team" / "departments" / "development" / "ooka-echizen")
            lines, errors, _ = permcheck.check_all(project)
            self.assertEqual(errors, 1, lines)
            self.assertIn("ooka-echizen", "\n".join(lines))


@unittest.skipIf(NODE is None, "node が見つからない")
class PermcheckJudgeTest(unittest.TestCase):
    def judge(self, *args):
        old = os.environ.get("LOCALAPPDATA")
        os.environ["LOCALAPPDATA"] = FAKE_LOCALAPPDATA
        try:
            return quiet(permcheck.main, ["--root", str(PROJECT), *args])
        finally:
            if old is not None:
                os.environ["LOCALAPPDATA"] = old

    def test_judge(self):
        self.assertEqual(self.judge("--member", "meng-tian", "--bash", "git status")[0], 0)
        self.assertEqual(self.judge("--member", "meng-tian", "--bash", "rm x")[0], 1)
        self.assertEqual(self.judge("--member", "meng-tian", "--write", "scripts/x.mjs")[0], 0)
        self.assertEqual(self.judge("--member", "meng-tian", "--write", "tests/x.mjs")[0], 1)
        self.assertEqual(self.judge("--member", "di-renjie", "--read", "docs/README.md")[0], 0)
        self.assertEqual(self.judge("--member", "di-renjie", "--read", "CLAUDE.md")[0], 0)  # 第2段: read_paths は ./
        self.assertEqual(self.judge("--member", "di-renjie", "--read", "C:/b/vscode/x")[0], 1)
        self.assertEqual(self.judge("--member", "meng-tian", "--tool", "WebFetch")[0], 0)
        self.assertEqual(self.judge("--member", "ooka-echizen", "--tool", "Edit")[0], 1)
        self.assertEqual(self.judge("--member", "vlad-tepes", "--bash", "git status")[0], 2)
        self.assertEqual(self.judge("--member", "../x", "--bash", "git status")[0], 2)

    def test_argument_errors(self):
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                permcheck.main(["--member", "meng-tian"])
            with self.assertRaises(SystemExit):
                permcheck.main(["--bash", "git status"])
            with self.assertRaises(SystemExit):
                permcheck.main(["--member", "meng-tian", "--bash", "x", "--read", "y"])


class HookcheckTest(unittest.TestCase):
    def test_real_project_passes(self):
        problems, count = hookcheck.check_all(PROJECT)
        self.assertEqual(problems, [])
        self.assertEqual(count, 5)

    def broken(self, edit):
        with tempfile.TemporaryDirectory() as tmp:
            project = make_project(tmp)
            edit(project)
            problems, _ = hookcheck.check_all(project)
            return problems

    def edit_definition(self, member, old, new):
        def edit(project):
            path = project / ".claude" / "agents" / f"{member}.md"
            text = path.read_text(encoding="utf-8")
            self.assertIn(old, text)
            path.write_text(text.replace(old, new, 1), encoding="utf-8")
        return edit

    def edit_settings(self, change):
        def edit(project):
            path = project / ".claude" / "settings.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            change(data)
            path.write_text(json.dumps(data), encoding="utf-8")
        return edit

    def test_definition_rules(self):
        cases = [
            ("cao-shen", "name: cao-shen", "name: cao-shen2"),
            ("cao-shen", "model: sonnet", "model: claude-sonnet-4"),
            ("cao-shen", "tools: Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch", "tools: \"*\""),
            ("cao-shen", "tools: Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch\n", ""),
            ("cao-shen", "model: sonnet", "model: sonnet\nhooks:\n  PreToolUse:\n    - matcher: Bash"),
            ("vlad-tepes", "model: opus", "model: opus\nhooks: {}"),
            ("di-renjie", "description:", "summary:"),
        ]
        for member, old, new in cases:
            with self.subTest(member=member, new=new):
                self.assertTrue(self.broken(self.edit_definition(member, old, new)))

    def test_missing_permissions(self):
        problems = self.broken(lambda p: shutil.rmtree(p / "team" / "departments" / "development" / "cao-shen"))
        self.assertTrue(any("permissions.json" in m for m in problems), problems)

    def test_settings_rules(self):
        hook = lambda d: d["hooks"]["PreToolUse"][0]["hooks"][0]  # noqa: E731
        cases = [
            lambda d: d.update(agent="meng-tian"),
            lambda d: d.pop("agent"),
            lambda d: d["hooks"]["PreToolUse"][0].update(matcher="Bash|Write"),
            lambda d: hook(d).pop("onFailure"),
            lambda d: hook(d).update(args=["${CLAUDE_PROJECT_DIR}/team/hooks/allowlist.js"]),
            lambda d: hook(d).update(command="node $CLAUDE_PROJECT_DIR/team/hooks/guard.js allowlist.js", args=None),
            lambda d: d["hooks"].pop("PreToolUse"),
        ]
        for n, change in enumerate(cases):
            with self.subTest(case=n):
                self.assertTrue(self.broken(self.edit_settings(change)))

    def test_missing_hook_files(self):
        self.assertTrue(self.broken(lambda p: (p / "team" / "hooks" / "guard.js").unlink()))

    def test_main_output(self):
        code, out = quiet(hookcheck.main, ["--root", str(PROJECT)])
        self.assertEqual(code, 0, out)
        self.assertIn("問題: 0 件", out)


if __name__ == "__main__":
    unittest.main()
