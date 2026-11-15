"""bash_exact（断片の全体に一致するときだけ通す許可）と、2026-11-15 に大岡越前守へ足した行のテスト。

- 判定は本物の permissions.json（大岡越前守の bash の5行と bash_exact の4行）で行う。
- bash と bash_exact の違いそのものは、一時のプロジェクトの仮のメンバー（add_member）で確かめる。
- 完全一致にした理由の実地の確かめ（PowerShell が同じ引数の2回目を拒む・disk-usage.mjs の --out は後勝ち）は、
  tempfile の下でだけ走らせる。
- 入力の出典: Team の tasks/2026-11-15-ai-editor-perm-requests/ の perm-tests/test_2_ooka.py（ダイクストラ）と
  bacon-tests/test_b3_ooka_tools.py（ベーコン）。

実行: python -m unittest discover -s projects/ai-editor/team/hooks/tests
"""

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from hookrun import NODE, PROJECT, HookTestCase, add_member, make_project

OE = "ooka-echizen"
PS = "powershell -NoProfile -ExecutionPolicy Bypass -File"
W = "C:/b/wt/1.146.0-p2-all"


class OokaNewLinesTest(HookTestCase):
    """大岡越前守の確かめの行（2026-11-15）。"""

    ALLOWED = [
        f"git -C {W} status", f"git -C {W} status --porcelain", "git -C C:/b/wt/1.146.0-p5-c1 status",
        f"git -C {W} diff", f"git -C {W} diff 1.146.0 HEAD --stat", "git -C C:/b/wt/x diff --name-only",
        f"git -C {W} checkout 1.146.0", f"git -C {W} checkout 1.147.1", f"git -C {W} checkout -- pnpm-lock.yaml",
        f"pnpm --dir {W} install --lockfile-only --ignore-scripts",
        "node scripts/disk-usage.mjs records=records",
        f"{PS} scripts/p1-ci-events.ps1 -OutFile tasks/2026-11-16-x/ci-events.json",
        f"{PS} scripts/p1-ci-events.ps1 -OutFile tasks/x/ci.json -Minutes 30",
        f"{PS} scripts/check-env.ps1 -OutFile tasks/2026-11-16-x/env-check.json",
        f"{PS} scripts/check-env.ps1 -OutFile tasks/x/env-check.json -WorkTree C:/b/wt/x",
        f"{PS} scripts/p1-launch-check.ps1 -OutFile tasks/x/launch.json",
        f"{PS} scripts/p1-launch-check.ps1 -OutFile tasks/x/launch-check.json -Zip C:/b/dist/1.146.0-p2-all.zip",
    ]

    BLOCKED = [
        # checkout はタグの形（点を2つ含む1語）とロックファイルだけ。後ろに足せない
        f"git -C {W} checkout main", f"git -C {W} checkout builds/1.146.0-p2-all", f"git -C {W} checkout HEAD~1",
        f"git -C {W} checkout -f 1.146.0", f"git -C {W} checkout 1.146.0 -f", f"git -C {W} checkout 1.146.0 -- .",
        f"git -C {W} checkout -b 1.146.0", f"git -C {W} checkout -b 1.2.3", f"git -C {W} checkout -- .",
        f"git -C {W} checkout -- pnpm-lock.yaml package.json", f"git -C {W} checkout -- pnpm-lock.yaml .",
        f"git -C {W} checkout 1.146.0 pnpm-lock.yaml", f"git -C {W} checkout -f", f"git -C {W} checkout --force 1.146.0",
        f"git -C {W} checkout 1.146.0 1.146.1", f"git -C {W} checkout", f"git -C {W} checkout .",
        f"git -C {W} checkout ../1.146.0", "git -C C:/b/vscode checkout 1.146.0", "git -C C:/b/wt/x/y checkout 1.146.0",
        "git -C C:/b/wt/.. checkout 1.146.0", f"git -C {W}/../x checkout 1.146.0", "git -C C:/b/wt/x/.. checkout 1.146.0",
        f"git -C {W} checkout 1.146.0; git -C {W} clean -xfd",
        # status・diff は固定の検査が効く。ほかのサブコマンドは無い
        f"git -C {W} diff --output=C:/x.txt", f"git -C {W} diff --no-index a b", f"git -C {W} status --porcelain > x",
        f"git -C {W} -c core.fsmonitor=x status", f"git -C {W} -c core.pager=x status", "git -C C:/b/vscode status",
        f"git -C {W} clean -xfd", f"git -C {W} reset --hard",
        # pnpm は完全一致だけ
        f"pnpm --dir {W} install --lockfile-only --ignore-scripts --dir C:/Users",
        f"pnpm --dir {W} install --lockfile-only --ignore-scripts --lockfile-dir C:/x",
        f"pnpm --dir {W} install --lockfile-only --ignore-scripts --no-ignore-scripts",
        f"pnpm --dir {W} install --lockfile-only --ignore-scripts --pnpmfile x.js",
        f"pnpm --dir {W} install --lockfile-only", f"pnpm --dir {W} install",
        f"pnpm --dir {W} install --ignore-scripts --lockfile-only",
        f"pnpm --dir {W} install --lockfile-only --ignore-scripts && node x.js",
        # disk-usage は完全一致だけ（--out を足せない）
        "node scripts/disk-usage.mjs", "node scripts/disk-usage.mjs records=records --out .claude/settings.json",
        "node scripts/disk-usage.mjs --out .claude/settings.json records=records", "node scripts/disk-usage.mjs records=records --out x",
        "node scripts/disk-usage.mjs records=records  --out x", "node scripts/disk-usage.mjs records=records --out=x",
        "node scripts/disk-usage.mjs records=records records=..", "node scripts/disk-usage.mjs records=C:/b",
        "node scripts/disk-usage.mjs records=records;rm x",
        # PowerShell の3台本は -OutFile tasks/<1つ>/<名前>.json を先頭に持つ形だけ
        f"{PS} scripts/p1-ci-events.ps1", f"{PS} scripts/p1-ci-events.ps1 -Minutes 5", f"{PS} scripts/check-env.ps1",
        f"{PS} scripts/p1-ci-events.ps1 -OutFile .claude/settings.json", f"{PS} scripts/check-env.ps1 -OutFile .claude/settings.json",
        f"{PS} scripts/check-env.ps1 -OutFile team/hooks/allowlist.js", f"{PS} scripts/check-env.ps1 -OutFile tasks/x/y.md",
        f"{PS} scripts/check-env.ps1 -OutFile tasks/x/env.md", f"{PS} scripts/check-env.ps1 -OutFile tasks/x/y/z.json",
        f"{PS} scripts/check-env.ps1 -OutFile tasks/../x.json", f"{PS} scripts/check-env.ps1 -OutFile tasks/../package.json",
        f"{PS} scripts/check-env.ps1 -OutFile tasks/../team/x.json", f"{PS} scripts/check-env.ps1 -OutFile tasks/./x.json",
        f"{PS} scripts/check-env.ps1 -OutFile tasks/x/../../.claude/x.json", f"{PS} scripts/check-env.ps1 -OutFile C:/b/x.json",
        f"{PS} scripts/p1-ci-events.ps1 -OutFile C:/b/x.json", f"{PS} scripts/check-env.ps1 -OutFile tasks/*/*.json",
        f"{PS} scripts/check-env.ps1 -OutFile tasks/x/y.json:stream", f"{PS} scripts/check-env.ps1 -OutFile tasks\\x\\y.json",
        f"{PS} scripts/check-env.ps1 -Out x -OutFile tasks/x/y.json", f"{PS} scripts/check-env.ps1 -WorkTree x -OutFile .claude/s.json",
        f"{PS} scripts/check-env.ps1 -WorkTree C:/b/wt/x -OutFile tasks/x/env.json",
        f"{PS} scripts/check-env.ps1 -OutFile tasks/x/y.json; node x.mjs", f"{PS} scripts/check-env.ps1 -OutFile tasks/x/y.json | tee x",
        f"{PS} scripts/other.ps1 -OutFile tasks/x/y.json",
    ]

    def test_allowed(self):
        for command in self.ALLOWED:
            with self.subTest(command=command):
                self.assertPass(self.bash(OE, command))

    def test_blocked(self):
        for command in self.BLOCKED:
            with self.subTest(command=command):
                self.assertBlock(self.bash(OE, command))

    def test_other_members_do_not_get_the_lines(self):
        for member in ("cao-shen", "di-renjie"):
            for command in (f"git -C {W} checkout 1.146.0", "node scripts/disk-usage.mjs records=records",
                            f"{PS} scripts/check-env.ps1 -OutFile tasks/x/env.json"):
                with self.subTest(member=member, command=command):
                    self.assertBlock(self.bash(member, command))

    # ---- 残る穴の記録（受け入れたもの。perm-proposal.md の 2.4・2.5） ----

    def test_tag_star_also_matches_option_like_words(self):
        # * は - と = を含むので、*.*.* は点を2つ含むオプション風の語にも一致する（効くのは作業ツリーの中だけ）
        for command in (f"git -C {W} checkout --orphan=a.b.c", f"git -C {W} checkout --pathspec-from-file=a.b.c",
                        f"git -C {W} checkout 1.146.0-rc.1", f"git -C {W} checkout v1.146.0"):
            with self.subTest(command=command):
                self.assertPass(self.bash(OE, command))

    def test_second_outfile_is_left_to_powershell(self):
        # フックは2回目の -OutFile を止めない。止めるのは PowerShell（PowerShellDuplicateParamTest）
        self.assertPass(self.bash(OE, f"{PS} scripts/check-env.ps1 -OutFile tasks/x/a.json -OutFile .claude/settings.json"))


class BashExactSemanticsTest(HookTestCase):
    """同じ行を bash（前方一致）と bash_exact（完全一致）に置いたときの違いを、仮のメンバーで確かめる。"""

    LINE = "pnpm --dir C:/b/wt/* install --lockfile-only --ignore-scripts"
    PREFIX, EXACT = "bash-prefix-probe", "bash-exact-probe"

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._tmp = tempfile.mkdtemp(prefix="ai-editor-hooks-exact-")
        cls.addClassCleanup(shutil.rmtree, cls._tmp, True)
        cls.project = make_project(cls._tmp)
        add_member(cls.project, cls.PREFIX, {"bash": [cls.LINE, "git status"], "read_paths": ["./"]})
        add_member(cls.project, cls.EXACT, {"bash": ["git status"], "bash_exact": [cls.LINE, "git -C C:/b/wt/* checkout *.*.*"],
                                            "read_paths": ["./"]})

    def judge(self, member, command):
        return self.bash(member, command, cwd=str(self.project)), {"project": self.project}

    def test_exact_command_passes_both(self):
        for member in (self.PREFIX, self.EXACT):
            with self.subTest(member=member):
                ev, kw = self.judge(member, "pnpm --dir C:/b/wt/x install --lockfile-only --ignore-scripts")
                self.assertPass(ev, **kw)

    def test_trailing_words(self):
        # 前方一致は後ろに語を足せる（今のフックはどれも止めない）。完全一致は止める
        for command in ("pnpm --dir C:/b/wt/x install --lockfile-only --ignore-scripts --dir C:/Users",
                        "pnpm --dir C:/b/wt/x install --lockfile-only --ignore-scripts --lockfile-dir C:/x",
                        "pnpm --dir C:/b/wt/x install --lockfile-only --ignore-scripts --no-ignore-scripts"):
            with self.subTest(command=command):
                ev, kw = self.judge(self.PREFIX, command)
                self.assertPass(ev, **kw)
                ev, kw = self.judge(self.EXACT, command)
                self.assertBlock(ev, "ホワイトリストに無いコマンドです", **kw)

    def test_star_in_exact_line(self):
        # bash_exact の * は bash と同じ STAR（1区切りの一部。/・..・空に一致しない）
        for command, ok in (("git -C C:/b/wt/x checkout 1.146.0", True), ("git -C C:/b/wt/x/y checkout 1.146.0", False),
                            ("git -C C:/b/wt/.. checkout 1.146.0", False), ("git -C C:/b/wt/x checkout 1.146", False),
                            ("git -C C:/b/wt/x checkout 1.146.0 -f", False)):
            with self.subTest(command=command):
                ev, kw = self.judge(self.EXACT, command)
                (self.assertPass if ok else self.assertBlock)(ev, **kw)

    def test_segments_are_matched_one_by_one(self):
        # 区切りで繋いだ形は断片ごとに照合する（どちらの断片も完全一致なら通る）
        ev, kw = self.judge(self.EXACT, "git status && git -C C:/b/wt/x checkout 1.146.0")
        self.assertPass(ev, **kw)
        ev, kw = self.judge(self.EXACT, "git -C C:/b/wt/x checkout 1.146.0 && git log")
        self.assertBlock(ev, **kw)


@unittest.skipUnless(shutil.which("powershell"), "powershell が見つからない")
class PowerShellDuplicateParamTest(unittest.TestCase):
    """-File の台本に同じ引数を2回渡すと、PowerShell が拒み、どちらにも書かないことを確かめる（tempfile の下。
    Windows PowerShell 5.1）。行に -OutFile tasks/*/*.json を含めた守りは、これに頼っている。"""

    def setUp(self):
        self.tmp = Path(os.path.realpath(tempfile.mkdtemp(prefix="ai-editor-hooks-ps-")))
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.script = self.tmp / "t.ps1"
        self.script.write_text("param([string]$WorkTree, [string]$OutFile)\n"
                               "Set-Content -LiteralPath $OutFile -Value x\n", encoding="ascii")

    def ps(self, *args):
        return subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(self.script), *args],
                              capture_output=True, text=True, timeout=120)

    def test_single_writes(self):
        a = self.tmp / "a.json"
        r = self.ps("-OutFile", str(a))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(a.exists())

    def test_duplicate_rejected(self):
        for second in ("-OutFile", "-Out", "-o", "-OutFile:"):
            with self.subTest(second=second):
                a, b = self.tmp / f"a{len(second)}.json", self.tmp / f"b{len(second)}.json"
                extra = [f"{second}{b}"] if second.endswith(":") else [second, str(b)]
                r = self.ps("-OutFile", str(a), *extra)
                self.assertNotEqual(r.returncode, 0, r.stdout + r.stderr)
                self.assertFalse(a.exists())
                self.assertFalse(b.exists())


@unittest.skipUnless(NODE, "node が見つからない")
class DiskUsageOutLastWinsTest(unittest.TestCase):
    """disk-usage.mjs の写し（tempfile の下）で、--out を2回渡すと後の方に書くことを確かめる（完全一致にした理由）。"""

    def test_last_out_wins(self):
        source = PROJECT / "scripts" / "disk-usage.mjs"
        if not source.exists():
            self.skipTest("scripts/disk-usage.mjs が無い")
        tmp = Path(os.path.realpath(tempfile.mkdtemp(prefix="ai-editor-hooks-du-")))
        self.addCleanup(shutil.rmtree, tmp, True)
        script = tmp / "disk-usage.mjs"
        shutil.copy2(source, script)
        a, b = tmp / "a.json", tmp / "b.json"
        r = subprocess.run([NODE, str(script), "--out", str(a), "--out", str(b), f"none={tmp / 'none'}"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertFalse(a.exists())
        self.assertTrue(b.exists())
        self.assertIn("freeGB", json.loads(b.read_text(encoding="utf-8"))["drive"])


if __name__ == "__main__":
    unittest.main()
