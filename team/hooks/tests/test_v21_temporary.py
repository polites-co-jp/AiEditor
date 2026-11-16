"""v2-1（2026-11-16 に当てた段）の蒙恬の一時の行のテスト。C:/b の古い clone と作業ツリーから、tmp/b/vscode へ取り込む。

当てた行（本物の meng-tian/permissions.json。perm-proposal.md の1.1節・4.6節）:
- bash_exact (a) builds: git -C tmp/b/vscode fetch C:/b/vscode refs/heads/builds/<8本>:refs/heads/builds/<同じ名前> の1行
  （+ なし。名前の完全一致）
- bash_exact (b) keep: git -C tmp/b/vscode fetch C:/b/wt/<名前> HEAD:refs/heads/keep/wt-<名前> の10行（作業ツリーの名指し。U11）
- bash_exact (c): git -C tmp/b/vscode for-each-ref refs/heads/builds refs/heads/keep（取り込んだ枝を確かめる。読むだけ）
- bash: git -C C:/b/wt/* status（今の行を残した。消す前の確かめ）
- read_paths の C:/b/（3人。古いログを読む用）は test_read の ReadCDriveV21Test が見る。

【v2-2・v2-3 を当てたときに直す】（perm-proposal.md の「本物のテストの直し（v2-1 を当てたとき）」の節）
- v2-2: (a)・(b) の11行が外れる。FetchLinesTest の「通る」は「止まる」に変える（test_builds_line_passes・
  test_each_named_line_passes・RealLinesTest.test_meng_tian_temporary_lines）。C:/b の直下の15個の delete_paths と
  bash_exact の rmdir C:/b が一時に入るので、RealLinesTest.test_only_listed_c_b_lines の許す集合に rmdir C:/b を足し、
  蒙恬の delete_paths の C:/b の15行を許す形に直す。曹参・大岡越前守の read_paths の C:/b/ が外れるので
  RealLinesTest.test_read_paths_c_b_until_v2_2 を直す。for-each-ref と C:/b/wt/* status は残る。
- v2-3: for-each-ref・C:/b/wt/* status・rmdir C:/b・15行・蒙恬の read_paths の C:/b/ も外れる（ListAndStatusTest と
  V22ChecksTest の「通る」を「止まる」に変え、RealLinesTest を「C:/b を含む行が無い」に変える）。
止まる側の確かめ（食い違った名前・10個の外・+ や後ろに足した形・ほかの3人）は、どの段でも止まるのでそのまま使える。
C:/b の形の判定では、フックが判定のときに本物の C:/b の lstat・realpath をする（中身は読まない。判定は有無に依らない）。
作業ツリーの名前は、実在に頼らない名前（zz-hooktest）にした所がある。

判定は本物の permissions.json と本物のフックで、tmp/b の偽の木を持つ写しのプロジェクト（git -C tmp/b/vscode の 3c の
ため）を使う。本物の C:/b・tmp/b・clone では git を走らせない。出典: Team の tasks/2026-11-16-ai-editor-move-off-c-perms/
perm-tests/test_o_round5.py（FetchLineHookTest）と test_q_round7.py（NamedLinesHookTest）。

実行: python -m unittest discover -s projects/ai-editor/team/hooks/tests
"""

import json
import unittest

from hookrun import BuildTreeTestCase, PROJECT

MT, CS, OE, DR = "meng-tian", "cao-shen", "ooka-echizen", "di-renjie"

# 古い clone（C:/b/vscode）の builds/*（2026-11-16 に refs/heads/builds の直下と packed-refs を読んで数えた8本）
OLD_BUILDS = ("1.146.0-p2-B-1-r2", "1.146.0-p2-B-2-r2", "1.146.0-p2-B-3-r2", "1.146.0-p2-B-4-r2", "1.146.0-p2-B-5-r2",
              "1.146.0-p2-B-6-r2", "1.146.0-p2-B-7-r2", "1.146.0-p2-all")
BUILDS_LINE = "git -C tmp/b/vscode fetch C:/b/vscode " + " ".join(
    f"refs/heads/builds/{n}:refs/heads/builds/{n}" for n in OLD_BUILDS)
WT_LINE = "git -C tmp/b/vscode fetch C:/b/wt/* HEAD:refs/heads/keep/wt-*"  # U11 で置き換える前の1行（止まることの記録）
WT_NAMED = ("1.145.3", "dev-a", "dev-a-apply", "dev-b", "dev-c1", "dev-c3", "p1-a1", "p2", "trial-bwt", "verify-p2")
WT_NAMED_LINES = [f"git -C tmp/b/vscode fetch C:/b/wt/{n} HEAD:refs/heads/keep/wt-{n}" for n in WT_NAMED]
LIST_LINE = "git -C tmp/b/vscode for-each-ref refs/heads/builds refs/heads/keep"
C_B_STATUS = "git -C C:/b/wt/* status"
# C:/b/wt の直下の作業ツリー（2026-11-16 に数えた12個。survey-c-before-move.json の12個と同じ名前）
OLD_WORKTREES = ("1.145.3", "1.146.0", "dev-a", "dev-a-apply", "dev-apply", "dev-b", "dev-c1", "dev-c3", "p1-a1", "p2",
                 "trial-bwt", "verify-p2")


def real_permissions(member):
    path = next((PROJECT / "team" / "departments").glob(f"*/{member}/permissions.json"))
    return json.loads(path.read_text(encoding="utf-8"))


def wt(src, keep):
    return f"git -C tmp/b/vscode fetch C:/b/wt/{src} HEAD:refs/heads/keep/wt-{keep}"


class RealLinesTest(unittest.TestCase):
    """本物の permissions.json の C:/b の行が、v2-1 の一時の行だけであること（フックは通さない）。"""

    def test_meng_tian_temporary_lines(self):
        p = real_permissions(MT)
        self.assertIn(BUILDS_LINE, p["bash_exact"])
        self.assertEqual([x for x in p["bash_exact"] if "C:/b/wt/" in x], WT_NAMED_LINES)  # 10行、この並び
        self.assertIn(LIST_LINE, p["bash_exact"])
        self.assertIn(C_B_STATUS, p["bash"])
        self.assertNotIn(WT_LINE, p["bash_exact"])
        for line in [BUILDS_LINE] + WT_NAMED_LINES:
            self.assertNotIn("*", line)
            self.assertNotIn("+", line)
        self.assertEqual(sorted(set(OLD_WORKTREES) - set(WT_NAMED)), ["1.146.0", "dev-apply"])

    def test_only_listed_c_b_lines(self):
        allowed = {C_B_STATUS, BUILDS_LINE, *WT_NAMED_LINES}
        for member in (MT, CS, OE, DR):
            p = real_permissions(member)
            with self.subTest(member=member):
                lines = [x for x in p.get("bash", []) + p.get("bash_exact", []) if "C:/b" in x]
                self.assertTrue(set(lines) <= allowed, lines)
                if member != MT:
                    self.assertEqual(lines, [])
                self.assertFalse([x for x in p.get("write_paths", []) if "C:/b" in x])
                self.assertFalse([x for x in p.get("delete_paths", []) + p.get("delete_keep", []) if "C:/b" in x])

    def test_read_paths_c_b_until_v2_2(self):
        # 【v2-2・v2-3 を当てたときに直す】曹参・大岡越前守は v2-2、蒙恬は v2-3 で C:/b/ が外れる
        for member in (MT, CS, OE):
            with self.subTest(member=member):
                self.assertEqual(real_permissions(member)["read_paths"], ["./", "C:/b/"])
        self.assertNotIn("C:/b/", real_permissions(DR)["read_paths"])


class FetchCase(BuildTreeTestCase):
    def passes(self, member, commands):
        for command in commands:
            with self.subTest(member=member, command=command[:90]):
                self.assertPass(self.bash(member, command))

    def blocks(self, member, commands):
        for command in commands:
            with self.subTest(member=member, command=command[:90]):
                self.assertBlock(self.bash(member, command))


class FetchLinesTest(FetchCase):
    """(a) builds の1行と (b) 名指しの10行（U11）。v2-1 の蒙恬だけが打てる。"""

    def test_builds_line_passes(self):
        self.passes(MT, [BUILDS_LINE])

    def test_each_named_line_passes(self):
        self.passes(MT, WT_NAMED_LINES)

    def test_outside_the_ten_and_star_line_blocked(self):
        # 残る2つ（1.146.0・dev-apply。HEAD は本家のタグ 1.146.0）と、置き換える前の1行の文字どおりの形は止まる
        self.blocks(MT, [wt("1.146.0", "1.146.0"), wt("dev-apply", "dev-apply"), WT_LINE])

    def test_mismatched_names_blocked(self):
        n = len(WT_NAMED)
        forms = set()
        for i, name in enumerate(WT_NAMED):
            forms.add(wt(name, WT_NAMED[(i + 1) % n]))  # 隣の名前の keep へ
            forms.add(wt(name, WT_NAMED[(i - 1) % n]))
        forms |= {wt("p2", "dev-b"), wt("dev-a", "p2"), wt("verify-p2", "p2"), wt("p2", "verify-p2"),
                  wt("dev-c1", "p2"), wt("1.145.3", "p1-a1"), wt("p2", "1.146.0-p5-c-all"),
                  wt("p2", "p2-x"), wt("p2", "x"), wt("p2", "P2")}
        self.assertEqual(len(forms), 30)  # 隣の名前の20形と、ほかの10形
        self.blocks(MT, sorted(forms))

    def test_worktrees_outside_the_ten_blocked(self):
        commands = []
        for name in ("1.146.0", "dev-apply", "VSCode-win32-x64", "1.146.0.prepare.json", "dev-a2", "p2-x", "p",
                     "verify", "x", "dev-c2", "1.145.4", "P2", "DEV-A"):
            commands += [wt(name, name), wt(name, "p2")]
        self.blocks(MT, commands)

    def test_plus_and_trailing_forms_blocked(self):
        forms = []
        for line in WT_NAMED_LINES:
            forms += [line.replace("HEAD:", "+HEAD:"), line + " --update-head-ok", line + " -f"]
        base = wt("p2", "p2")
        forms += [
            base + " --force", base + " --prune", base + " HEAD:refs/heads/main",
            base + " refs/heads/main:refs/heads/keep/x", base + " HEAD:refs/heads/keep/wt-dev-b",
            base + "; rm -rf tmp/b/p2/1.146.0-p2-all", base + " && git -C tmp/b/vscode branch -D builds/x",
            base.replace("git -C tmp/b/vscode fetch", "git -C tmp/b/vscode fetch --upload-pack=x"),
            base.replace("git -C", "git -c core.fsmonitor=x -C"),
            base.replace("C:/b/wt/p2", "c:/b/wt/p2"), base.replace("C:/b/wt/p2", "C:/b/wt/p2/"),
            base.replace("C:/b/wt/p2", "C:/b/wt/p2/.."), base.replace("C:/b/wt/p2", "C:\\b\\wt\\p2"),
            base.replace("tmp/b/vscode", "./tmp/b/vscode"),
            base.replace("HEAD:", "main:"), base.replace("HEAD:refs/heads/keep/wt-p2", "HEAD:refs/heads/keep/wt-p2/x"),
            base.replace("HEAD:refs/heads/keep/wt-p2", "HEAD:refs/heads/builds/wt-p2"),
            base.replace("HEAD:refs/heads/keep/wt-p2", "HEAD:keep/wt-p2"),
            base.rsplit(" ", 1)[0],  # 先を省いた形（FETCH_HEAD だけに書く）も、行のとおりでないので止まる
            base.replace("C:/b/wt/p2", "tmp/b/wt/1.146.0"), base.replace("-C tmp/b/vscode", "-C tmp/b/wt/1.146.0"),
        ]
        self.blocks(MT, forms)

    def test_builds_line_variants_blocked(self):
        self.blocks(MT, [
            BUILDS_LINE + " --update-head-ok", BUILDS_LINE + " --prune", BUILDS_LINE + " -f", BUILDS_LINE + " --force",
            BUILDS_LINE + " refs/heads/main:refs/heads/builds/x",
            BUILDS_LINE.replace(" refs/heads/builds/1.146.0-p2-all:", " +refs/heads/builds/1.146.0-p2-all:"),
            BUILDS_LINE.replace(":refs/heads/builds/1.146.0-p2-all", ":refs/heads/builds/1.146.0-p5-c-all"),
            BUILDS_LINE.rsplit(" ", 1)[0],  # refspec を1つ減らした形も止まる（完全一致。行のとおりに全部を打つ）
            BUILDS_LINE.replace("git -C tmp/b/vscode fetch", "git -C tmp/b/vscode fetch --upload-pack=x"),
            BUILDS_LINE.replace("git -C", "git -c core.fsmonitor=x -C"),
            BUILDS_LINE.replace("C:/b/vscode", "C:/b/vscode/"), BUILDS_LINE.replace("C:/b/vscode", "c:/b/vscode"),
            BUILDS_LINE.replace("tmp/b/vscode", "./tmp/b/vscode"),
            # 依頼の形（行の * はフックの STAR になり、打った * に一致しない）
            "git -C tmp/b/vscode fetch C:/b/vscode +refs/heads/builds/*:refs/heads/builds/* +refs/heads/keep/*:refs/heads/keep/*",
        ])

    def test_other_members_blocked(self):
        for member in (CS, OE, DR):
            self.blocks(member, [BUILDS_LINE, LIST_LINE] + WT_NAMED_LINES[:3])


class ListAndStatusTest(FetchCase):
    """(c) for-each-ref と、残した git -C C:/b/wt/* status（v2-2 まで。v2-3 で外れる）。"""

    def test_list_line_passes_and_variants_blocked(self):
        self.passes(MT, [LIST_LINE])
        self.blocks(MT, [LIST_LINE + " --format=%(refname)", LIST_LINE.replace("for-each-ref", "for-each-ref --shell"),
                         "git -C tmp/b/vscode for-each-ref", "git -C tmp/b/vscode for-each-ref refs/heads/builds",
                         LIST_LINE + " refs/heads/main", LIST_LINE.replace("tmp/b/vscode", "C:/b/vscode")])

    def test_c_b_status_passes(self):
        # C:/b はプロジェクトの外なので 3c の対象外。消す前の確かめ（git -C C:/b/wt/<名前> status --porcelain）に使う
        self.passes(MT, ["git -C C:/b/wt/zz-hooktest status --porcelain", "git -C C:/b/wt/zz-hooktest status"])
        self.blocks(OE, ["git -C C:/b/wt/zz-hooktest status"])
        self.blocks(MT, ["git -C C:/b/wt/zz-hooktest status --porcelain > x", "git -C C:/b/vscode status",
                         "git -C C:/b/wt/zz-hooktest/.. status", "git -C C:/b/wt/zz-hooktest stash list"])


class V22ChecksTest(FetchCase):
    """v2-2 の前に課がする確かめ（perm-proposal.md の「v2-2 の前に課がする確かめ」の節）のコマンドが、蒙恬の v2-1 の
    許可で通ること。足りない確かめ（stash list・reflog・rev-list）は止まること。名前は実在に頼らない名前にした。
    【v2-3 を当てたときに直す】C:/b/wt/* status と for-each-ref が外れるので、通る側を止まる側に移す。"""

    def test_checks_pass_for_meng_tian(self):
        self.passes(MT, [
            LIST_LINE,
            "git -C C:/b/wt/zz-hooktest status --porcelain=v2 --branch --show-stash --untracked-files=all",
            "git -C C:/b/wt/zz-hooktest status --porcelain",
            "node scripts/move-survey.mjs --from C:/b --no-caches --out tasks/2026-11-17-before-v2-2/survey-c-before-v2-2.json",
            "node scripts/move-survey.mjs --from C:/b --no-caches --only take-in,take-in-trial,notion-sync-trial,p4-watch,tmp "
            "--out tasks/2026-11-17-before-v2-2/survey-c-five.json",
        ])
        for path in ("C:/b/zz-hooktest/.git/packed-refs", "C:/b/zz-hooktest/.git/refs/heads/builds/x",
                     "C:/b/zz-hooktest/.git/worktrees/zz/logs/HEAD", "tasks/2026-11-15-move-off-c/survey-c-before-move.json"):
            with self.subTest(read=path):
                self.assertPass(self.read(MT, path))
        self.assertPass(self.ev("Glob", {"pattern": "*/HEAD", "path": "C:/b/zz-hooktest/.git/worktrees"}, MT))

    def test_missing_checks_are_blocked(self):
        # 今の許可では打てない（perm-proposal.md の節の「足りない確かめ」）
        self.blocks(MT, [
            "git -C C:/b/vscode stash list", "git -C C:/b/wt/zz-hooktest stash list",
            "git -C C:/b/vscode reflog", "git -C C:/b/wt/zz-hooktest reflog",
            "git -C C:/b/vscode rev-list --reflog --not --branches --tags",
            "git -C C:/b/vscode for-each-ref refs/heads/builds",
            "ls C:/b", "dir C:\\b",
        ])

    def test_old_c_b_rows_blocked(self):
        # v2-1 で tmp/b に置き換えた前の C:/b の行は、どれも止まる（v2-2・v2-3 でも止まる）
        self.blocks(MT, [
            "git -C C:/b/wt/p2 checkout main", "git -C C:/b/wt/p2 clean -xfd", "git -C C:/b/wt/p2 commit -m x",
            "git -C C:/b/wt/p2 diff", "git -C C:/b/vscode worktree remove --force C:/b/wt/p2",
            "git -C C:/b/vscode worktree remove C:/b/wt/p2", "git -C C:/b/vscode worktree prune",
            "git -C C:/b/vscode branch keep/wt-p2", "git -C C:/b/wt/p2 branch keep/wt-p2",
            "git -C C:/b/vscode fetch --tags", "pnpm --dir C:/b/wt/p2 install", "npx --prefix C:/b/wt/p2 tsc --noEmit",
            "git clone https://github.com/microsoft/vscode.git C:/b/vscode",
        ])
        self.blocks(CS, ["pnpm --dir C:/b/wt/p2 run smoketest"])
        self.blocks(OE, ["git -C C:/b/wt/p2 checkout -- pnpm-lock.yaml",
                         "pnpm --dir C:/b/wt/p2 install --lockfile-only --ignore-scripts"])


if __name__ == "__main__":
    unittest.main()
