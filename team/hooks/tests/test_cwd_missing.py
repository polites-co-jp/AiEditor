"""フック入力に cwd が無い・空のとき（フックの直し 3e）のテスト。2026-11-16。

- 3e: cwd を起点にする Bash の相対パス（削除の語・git の相対の -C・-C の無い format-patch・pnpm の相対の --dir・tsc の
  相対の書き出し先）を止める（前の案は、プロジェクト直下から解いて通していた。ベーコンの F7）。絶対パスの形は今までどおり
  判定する。ファイルのツール（Read・Write など）の扱いは変えない（cwd が無ければ直下から解く。R12）。
- 判定は本物の permissions.json（v2-1）と本物のフックで、tmp/b の偽の木を持つ写しのプロジェクトを使う。
- 出典: Team の tasks/2026-11-16-ai-editor-move-off-c-perms/perm-tests/test_l_round2_cwd_glob.py（CwdMissingTest）と
  test_i_pnpm_dir.py（test_cwd_missing_relative_dir_blocks）。

実行: python -m unittest discover -s projects/ai-editor/team/hooks/tests
"""

import re
import unittest

from hookrun import BuildTreeTestCase, event_without_cwd

MT, OE = "meng-tian", "ooka-echizen"

RELATIVE = (
    (MT, "rm -rf tmp/b/p2/other"),                                  # ベーコンの再現の入力（前の案は exit 0）
    (MT, "git -C tmp/b/wt/w1 status"),
    (MT, "git -C tmp/b/vscode fetch --tags"),
    (OE, "git -C tmp/b/wt/w1 diff"),
    (MT, "git -C tmp/b/wt/w1 format-patch -o out HEAD~1"),
    (MT, "pnpm --dir tmp/b/wt/w1 run gulp"),
    (MT, "pnpm --dir tmp/b/wt/w1 install"),
    (OE, "pnpm --dir tmp/b/wt/w1 install --lockfile-only --ignore-scripts"),
    (OE, "npx --prefix tmp/b/wt/w1 tsc --noEmit --outDir records/o"),
)


class CwdMissingTest(BuildTreeTestCase):
    def test_relative_forms_blocked_without_cwd(self):
        for member, command in RELATIVE:
            with self.subTest(member=member, command=command, cwd="なし"):
                self.assertBlock(event_without_cwd(self.bash(member, command)))
            with self.subTest(member=member, command=command, cwd="空"):
                self.assertBlock(self.bash(member, command, cwd=""))

    def test_reasons(self):
        self.assertBlock(event_without_cwd(self.bash(MT, "pnpm --dir tmp/b/wt/w1 install")), "cwd が無く")
        self.assertBlock(event_without_cwd(self.bash(MT, "git -C tmp/b/wt/w1 status")), "cwd が無く")
        self.assertBlock(event_without_cwd(self.bash(MT, "rm -rf tmp/b/p2/other")), "cwd が無い")

    def test_same_commands_pass_with_cwd(self):
        for member, command in RELATIVE:
            with self.subTest(member=member, command=command):
                self.assertPass(self.bash(member, command))

    def test_absolute_and_cwd_free_forms_still_judged(self):
        # 絶対パスの削除は cwd が無くても判定する（残す版は止まる）。cwd を起点にしない git の行も通る
        if not re.fullmatch(r"[A-Za-z]:/[A-Za-z0-9._@+=/-]+", self.P_SLASH):
            self.skipTest(f"一時ディレクトリのパスに rm -rf の語で許さない文字がある: {self.P_SLASH}")
        self.assertPass(event_without_cwd(self.bash(MT, f"rm -rf {self.P_SLASH}/tmp/b/p2/other")))
        self.assertBlock(event_without_cwd(self.bash(MT, f"rm -rf {self.P_SLASH}/tmp/b/p2/1.146.0-p2-all")), "残すもの")
        for member, command in ((MT, "git status"), (MT, "git diff HEAD~1"), (OE, "npx --prefix tmp/b/wt/w1 tsc --noEmit"),
                                (MT, "node scripts/move-survey.mjs --from C:/b --out tasks/x/s.json")):
            with self.subTest(member=member, command=command):
                self.assertPass(event_without_cwd(self.bash(member, command)))

    def test_file_tools_unchanged(self):
        # ファイルのツールの相対パスは、本物のフックと同じく cwd が無ければプロジェクト直下から解く（今回は変えない。R12）
        self.assertPass(event_without_cwd(self.read(MT, "docs/a.md")))
        self.assertPass(event_without_cwd(self.write(MT, "tmp/b/x.txt")))


if __name__ == "__main__":
    unittest.main()
