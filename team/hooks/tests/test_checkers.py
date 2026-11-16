"""permcheck.py と hookcheck.py のテスト。本物の permissions.json・定義・settings.json と、書き換えた一時のプロジェクトで確かめる。

2026-11-16（Team の tasks/2026-11-16-ai-editor-move-off-c-perms の v2-1）:
- permcheck.py の直し f2（delete_paths・delete_keep の相対パスの要素）の判定を PermcheckRelativeDeleteTest に取り込んだ
  （出典: 同じタスクの perm-tests/test_g_permcheck.py）。
- 蒙恬の delete_keep は C:/b の7行から tmp/b の9行になった（U7 で1行を外し、U8 で3行を足した）。
  test_real_meng_tian_keeps_the_seven_entries を test_real_meng_tian_keeps_the_nine_entries に置き換えた。
- 狄仁傑の read_paths の絞り込み（U3）で、PermcheckJudgeTest の --read CLAUDE.md は通る（0）から止まる（1）に変えた。
- PermcheckJudgeDeleteTest は、tmp/b の偽の木を持つ写しのプロジェクトを --root にして tmp/b の形で判定する
  （本物の tmp/b に頼らない）。

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

from hookrun import FAKE_LOCALAPPDATA, HOOKS, NODE, PROJECT, build_project, make_project

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
        self.assertEqual(self.judge("--member", "di-renjie", "--read", "TAKE-IN.md")[0], 0)
        # 第2段で read_paths は ./ になり（このときは 0）、2026-11-16 の U3 で TAKE-IN.md・docs/・records/take-in/ に絞った
        self.assertEqual(self.judge("--member", "di-renjie", "--read", "CLAUDE.md")[0], 1)
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


class PermcheckNewKeysTest(unittest.TestCase):
    """2026-11-15 に足した項目（bash_exact・delete_paths・delete_keep）の検査。
    出典: Team の tasks/2026-11-15-ai-editor-perm-requests/ の perm-tests/test_1_delete.py・test_2_ooka.py。"""

    def issues(self, data, member="meng-tian"):
        return permcheck.check_text(json.dumps(data), member, PROJECT)

    def errors(self, data, member="meng-tian"):
        return [m for level, m in self.issues(data, member) if level == permcheck.ERROR]

    def warns(self, data, member="meng-tian"):
        return [m for level, m in self.issues(data, member) if level == permcheck.WARN]

    def real(self, member):
        path = next((PROJECT / "team" / "departments").glob(f"*/{member}/permissions.json"))
        return path.read_text(encoding="utf-8")

    def test_real_files_have_no_errors_or_warnings(self):
        for member in ("meng-tian", "ooka-echizen"):
            with self.subTest(member=member):
                issues = permcheck.check_text(self.real(member), member, PROJECT)
                self.assertEqual(issues, [])

    def test_real_meng_tian_keeps_the_nine_entries(self):
        # 2026-11-16（v2-1）: C:/b の7行を tmp/b に移し、何も無い場所を指していた p2/1.146.0-p1-a1-r3 を外し（U7）、
        # 新しい段階 C の版の3行を足した（U8）。前の名前は test_real_meng_tian_keeps_the_seven_entries（C:/b の7行）
        keep = json.loads(self.real("meng-tian"))["delete_keep"]
        expected = ["tmp/b/p2/1.146.0-p2-all", "tmp/b/dist/1.146.0-p2-all.zip", "tmp/b/dist/1.146.0-p1-a1-r3.zip",
                    "tmp/b/smoke/ext/1.146.0-p1-a1-r3", "tmp/b/smoke/ext/1.146.0-p1-a1-r3.marker.json",
                    "tmp/b/smoke/ext/1.146.0-p2-all*", "tmp/b/p2/1.146.0-p5*", "tmp/b/dist/1.146.0-p5*",
                    "tmp/b/smoke/ext/1.146.0-p5*"]
        self.assertEqual(sorted(keep), sorted(expected))
        self.assertNotIn("tmp/b/p2/1.146.0-p1-a1-r3", keep)  # U7
        self.assertFalse([k for k in keep if k.startswith("C:/b")])

    def test_real_meng_tian_delete_paths(self):
        # v2-1 の delete_paths は tmp/b の4行。【v2-2 を当てたときに直す】v2-2 は C:/b の直下の15個を一時に足す
        paths = json.loads(self.real("meng-tian"))["delete_paths"]
        self.assertEqual(sorted(paths), sorted(["tmp/b/p2/", "tmp/b/dist/", "tmp/b/smoke/ext/", "tmp/b/trial-*"]))

    def test_bad_delete_entries(self):
        for entry in ("", " C:/b/p2/", "C:/", "C:/b/", "C:/b", "C:/b/*", "C:/*/x/", "C:/b*/x/", "b/p2/", "/c/b/p2/",
                      "C:\\b\\p2\\", "%TEMP%/x/y/", "C:/b/p2/../x/", "C:/b/./p2/", "C:/b/P2~1/", "C:/b/p2//x/",
                      "C:/b/p 2/", "C:/b/p2/x$/", "C:/b/p2/x:y/", "C:/b/**/x/"):
            for key in ("delete_paths", "delete_keep"):
                with self.subTest(key=key, entry=entry):
                    self.assertTrue(self.errors({"read_paths": [], key: [entry]}))

    def test_good_delete_entries(self):
        self.assertEqual(self.errors({"read_paths": [], "delete_paths": ["C:/b/p2/", "C:/b/trial-*", "C:/b/smoke/ext/", "D:/x/y"]}),
                         [])
        smoke = ["C:/b/smoke/ext/1.146.0-p1-a1-r3", "C:/b/smoke/ext/1.146.0-p1-a1-r3.marker.json",
                 "C:/b/smoke/ext/1.146.0-p2-all*"]
        data = {"read_paths": [], "delete_paths": ["C:/b/smoke/ext/"], "delete_keep": smoke}
        self.assertEqual(self.errors(data), [])
        self.assertEqual(self.warns(data), [])

    def test_keep_outside_warns(self):
        warns = self.warns({"read_paths": [], "delete_paths": ["C:/b/p2/"], "delete_keep": ["C:/b/wt/x"]})
        self.assertTrue(any("delete_keep" in w for w in warns), warns)
        warns = self.warns({"read_paths": [], "delete_paths": ["C:/b/p2/"], "delete_keep": ["C:/b/p2"]})
        self.assertTrue(any("delete_keep" in w for w in warns), warns)  # 規則のディレクトリそのものは消せないので効かない
        self.assertEqual(self.warns({"read_paths": [], "delete_paths": ["C:/b/trial-*"], "delete_keep": ["C:/b/trial-x/keep"]}), [])

    def test_rm_bash_line_is_error(self):
        for entry in ("rm -rf C:/b/p2/*", "rm -rf C:/b/dist/*", "rm -rf C:/b/smoke/ext/*", "rm -rf C:/b/trial-*",
                      "rm -rf C:/b/p2/", "rm x"):
            for key in ("bash", "bash_exact"):
                with self.subTest(key=key, entry=entry):
                    errors = self.errors({"read_paths": [], key: [entry]})
                    self.assertTrue(any("rm" in m for m in errors), errors)

    def test_bash_exact(self):
        self.assertEqual(self.errors({"read_paths": [], "bash_exact": ["git -C C:/b/wt/* checkout *.*.*",
                                                                        "node scripts/disk-usage.mjs records=records"]},
                                     "ooka-echizen"), [])
        bad = self.issues({"read_paths": [], "bash_exact": ["node --test tests/", "x; y", ""]}, "ooka-echizen")
        self.assertEqual(sum(1 for level, _ in bad if level == permcheck.ERROR), 3)
        self.assertTrue(any("bash_exact の行の末尾が /" in m for _, m in bad))

    def test_unknown_key_still_error(self):
        self.assertTrue(self.errors({"read_paths": [], "delete": ["C:/b/p2/"]}))
        self.assertTrue(self.errors({"read_paths": [], "bash_prefix": ["git status"]}))

    def test_read_paths_cannot_hold_env(self):
        # 依頼 2 の「%APPDATA%\\Code の有無と更新時刻だけ」は read_paths に書けない（% は secret_paths だけで展開する）
        errors = self.errors({"read_paths": ["./", "%APPDATA%/Code/"]}, "ooka-echizen")
        self.assertTrue(any("%" in m for m in errors), errors)


@unittest.skipIf(NODE is None, "node が見つからない")
class ReadPathsEnvHookTest(unittest.TestCase):
    """read_paths の %APPDATA%/… は、フックも展開せずに捨てる（読むことを許さない）。一時のプロジェクトで確かめる。"""

    def test_env_entry_is_ignored(self):
        from hookrun import event, run

        with tempfile.TemporaryDirectory() as tmp:
            project = make_project(Path(tmp) / "p")
            appdata = Path(os.path.realpath(tmp)) / "appdata"
            path = next((project / "team" / "departments").glob("*/ooka-echizen/permissions.json"))
            perms = json.loads(path.read_text(encoding="utf-8"))
            perms["read_paths"] = perms["read_paths"] + ["%APPDATA%/Code/", "%APPDATA%/Code - OSS/"]
            path.write_text(json.dumps(perms, indent=2), encoding="utf-8")
            target = str(appdata / "Code" / "User" / "settings.json")
            code, err = run(event("Read", {"file_path": target}, agent_type="ooka-echizen", cwd=str(project)),
                            project=project, env_extra={"APPDATA": str(appdata)})
            self.assertEqual(code, 2, err)
            self.assertIn("読むことを許可していない", err)


class PermcheckRelativeDeleteTest(unittest.TestCase):
    """f2（2026-11-16）: delete_paths・delete_keep の相対パスの要素（プロジェクト直下から）。直下の下の区切りが3つ以上
    （tmp/・tmp/b は誤り）、最初の区切りに * が無い、.claude・team・.git にかからない、./・../・/・- で始まらない。
    出典: Team の tasks/2026-11-16-ai-editor-move-off-c-perms/perm-tests/test_g_permcheck.py（test_relative_delete_entry_rules・
    test_bash_entries_rm_and_rmdir・test_keep_outside_delete_paths_warns）。"""

    BAD = ["tmp/", "tmp", "./tmp/b/x", "../x", "/tmp/b/x", "tmp/../x", "tmp/b/../x", ".claude/x", "team/hooks",
           "tmp/b/.git/x", "*/b", "t*/b/x", "tmp\\b\\x", "-x/y", "tmp//b", "tmp/b/x:y", "tmp/b/*", "tmp/b/x y",
           "~/tmp/b", "%TEMP%/b", "C:/b", "C:/b/", "C:/*/x", "C:/b/*", "tmp/b/x.", "tmp/b/PROGRA~1",
           "tmp/b", "tmp/b/", "TMP/B", "docs/x", "b/p2/"]
    GOOD = ["tmp/b/p2/", "tmp/b/trial-*", "tmp/b/p2/1.146.0-p2-all", "tmp/b/smoke/ext/1.146.0-p2-all*",
            "tmp/b/p2/1.146.0-p5*", "C:/b/wt", "C:/b/tests-ac-*", "E:/develop/self/Team/projects/ai-editor/tmp/b/p2/",
            "tmp/b/vscode", "tmp/b/logs", "tmp/b/work-b", "tmp/b/official/", "tmp/b/cache/", "tmp/b/smoke/"]

    def test_relative_delete_entry_rules(self):
        for entry in self.BAD:
            with self.subTest(entry=entry):
                self.assertTrue(any(level == permcheck.ERROR for level, _ in permcheck.delete_entry_issues(entry)), entry)
        for entry in self.GOOD:
            with self.subTest(entry=entry):
                self.assertEqual(permcheck.delete_entry_issues(entry), [], entry)

    def test_whole_files_with_relative_entries(self):
        for key in ("delete_paths", "delete_keep"):
            with self.subTest(key=key, entry="tmp/b"):
                data = {"read_paths": [], "delete_paths": ["tmp/b/p2/"], key: ["tmp/b"]}
                errors = [m for level, m in permcheck.check_text(json.dumps(data), "meng-tian", PROJECT)
                          if level == permcheck.ERROR]
                self.assertTrue(errors)
        data = {"read_paths": [], "delete_paths": ["tmp/b/p2/", "tmp/b/trial-*"],
                "delete_keep": ["tmp/b/p2/1.146.0-p2-all", "tmp/b/p2/1.146.0-p5*"]}
        self.assertEqual(permcheck.check_text(json.dumps(data), "meng-tian", PROJECT), [])

    def test_keep_outside_delete_paths_warns(self):
        # U7: 残す版の本当の置き場所 tmp/b/p1/… は、どの delete_paths の下にも無いので警告になる（守る行は要らない）
        data = {"read_paths": [], "delete_paths": ["tmp/b/p2/"], "delete_keep": ["tmp/b/p1/1.146.0-p1-a1-r3"]}
        found = permcheck.check_text(json.dumps(data), "meng-tian", PROJECT)
        self.assertEqual([level for level, _ in found], [permcheck.WARN], found)

    def test_bash_entries_rm_and_rmdir(self):
        self.assertTrue(any(level == permcheck.ERROR for level, _ in permcheck.bash_entry_issues("rm -rf C:/b", exact=True)))
        self.assertTrue(any(level == permcheck.ERROR for level, _ in permcheck.bash_entry_issues("rm -rf tmp/b/p2/*")))
        self.assertEqual(permcheck.bash_entry_issues("rmdir C:/b", exact=True), [])  # v2-2 の一時の行の形

    def test_real_files_of_all_members_clean(self):
        for member in ("meng-tian", "cao-shen", "ooka-echizen", "di-renjie"):
            path = next((PROJECT / "team" / "departments").glob(f"*/{member}/permissions.json"))
            with self.subTest(member=member):
                self.assertEqual(permcheck.check_text(path.read_text(encoding="utf-8"), member, PROJECT), [])


@unittest.skipIf(NODE is None, "node が見つからない")
class PermcheckJudgeDeleteTest(unittest.TestCase):
    """permcheck.py --member の判定でも、削除の規則が効く（本物の permissions.json）。2026-11-16（v2-1）から削除の
    規則は tmp/b の相対パスなので、tmp/b の偽の木を持つ写しのプロジェクト（build_project）を --root にして判定する。"""

    def judge(self, *args):
        old = os.environ.get("LOCALAPPDATA")
        os.environ["LOCALAPPDATA"] = FAKE_LOCALAPPDATA
        try:
            return quiet(permcheck.main, ["--root", str(build_project()), *args])
        finally:
            if old is not None:
                os.environ["LOCALAPPDATA"] = old

    def test_judge(self):
        self.assertEqual(self.judge("--member", "meng-tian", "--bash", "rm -rf tmp/b/p2/foo")[0], 0)
        self.assertEqual(self.judge("--member", "meng-tian", "--bash", "rm -rf tmp/b/p2/1.146.0-p2-all")[0], 1)
        self.assertEqual(self.judge("--member", "meng-tian", "--bash", "rm -rf tmp/b/p2/foo tmp/b")[0], 1)
        # v2-1 は C:/b を消せない。【v2-2 を当てたときに直す】v2-2 は C:/b/p2 を一時の delete_paths に足すので 0 になる
        # （v2-3 で 1 に戻る）
        self.assertEqual(self.judge("--member", "meng-tian", "--bash", "rm -rf C:/b/p2/foo")[0], 1)
        self.assertEqual(self.judge("--member", "ooka-echizen", "--bash", "rm -rf tmp/b/p2/foo")[0], 1)
        self.assertEqual(self.judge("--member", "ooka-echizen", "--bash", "git -C tmp/b/wt/x checkout 1.146.0")[0], 0)
        self.assertEqual(self.judge("--member", "ooka-echizen", "--bash", "git -C tmp/b/wt/x checkout 1.146.0 -f")[0], 1)
        self.assertEqual(self.judge("--member", "ooka-echizen", "--bash", "git -C tmp/b/wt/plain checkout 1.146.0")[0], 1)  # 3c


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
            # 2026-11-15 に tools へ SubagentHandback を足した（tasks/2026-11-15-ai-editor-perm-requests の 4）
            ("cao-shen", "tools: Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch, SubagentHandback\n", "tools: \"*\"\n"),
            ("cao-shen", "tools: Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch, SubagentHandback\n", ""),
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
