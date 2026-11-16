"""削除（delete_paths・delete_keep。allowlist.js の checkDelete）のテスト。2026-11-15 に足した判定。

- 判定は本物の permissions.json（蒙恬の delete_paths・delete_keep）で行う。フックは判定だけで rm は走らせない。
- 2026-11-16（Team の tasks/2026-11-16-ai-editor-move-off-c-perms の v2-1）: 蒙恬の delete_paths・delete_keep は
  C:/b/… から、プロジェクト直下からの相対パス tmp/b/… に移った（フックの直し 3a）。固定の入力を C:/b/… から tmp/b/… に
  直し、tmp/b の偽の木を持つ写しのプロジェクト（hookrun.BuildTreeTestCase）で判定する。本物の tmp/b・C:/b の中身には
  頼らない（判定の lstat・realpath は写しの下に当たる）。直した入力の期待（通る・止まる）は、次の2つを除いて変えていない。
    - U7: delete_keep の C:/b/p2/1.146.0-p1-a1-r3 は、tmp/b に移すときに外した（その場所に版は無く、本当の置き場所の
      tmp/b/p1/ はどの delete_paths の下にも無い）。tmp/b/p2/1.146.0-p1-a1-r3 は消せる側に、tmp/b/p1/1.146.0-p1-a1-r3 は
      消せない側（delete_paths の外）に置いた（DeleteKeepTest.test_u7_misplaced_keep_row_removed）。
    - U8: 新しい段階 C の版（tmp/b/p2/1.146.0-p5*・tmp/b/dist/1.146.0-p5*・tmp/b/smoke/ext/1.146.0-p5*）を残す版に足した
      （U8KeepTest）。
  止まる側の C:/b/… の入力も、tmp/b の同じ形に直した（C:/b は消せる場所ではなくなったので、C:/b のままでは
  「.. で抜ける」などの守りを確かめたことにならない）。v2-1 で C:/b の削除が止まることは CDriveDeleteV21Test が見る。
- C:/b/ の下の名前（2026-11-15 に取った一覧。Team の tasks/2026-11-15-ai-editor-perm-requests/bacon-tests/
  listing-names.txt）は、tmp/b/ の下の同じ名前として使う。
- ジャンクション・自己防護・秘密の場所は、tempfile の下に作った場所と一時のプロジェクト（make_project）で確かめる。
  実地の rm -rf は tempfile の下でだけ走らせる。
- 入力の出典: Team の tasks/2026-11-15-ai-editor-perm-requests/ の perm-tests/test_1_delete.py（ダイクストラ）と
  bacon-tests/test_b1_delete.py・test_b2_rest.py・test_b7_claims.py・test_b8_r3star.py（ベーコン）。tmp/b の相対パスの
  削除（3a）と U8 は、Team の tasks/2026-11-16-ai-editor-move-off-c-perms/perm-tests/test_c_delete.py・test_p_round6.py
  （U8KeepTest）から取り込んだ。

実行: python -m unittest discover -s projects/ai-editor/team/hooks/tests
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from hookrun import FAKE_LOCALAPPDATA, BuildTreeTestCase, fwd, make_build_project, make_project

MT = "meng-tian"
KEEP = "delete_keep"
NOT_LISTED = "ホワイトリストに無いコマンドです"
ABS_WORD = re.compile(r"[A-Za-z]:/[A-Za-z0-9._@+=/-]+")


def permissions_of(project, member):
    path = next((Path(project) / "team" / "departments").glob(f"*/{member}/permissions.json"))
    return path, json.loads(path.read_text(encoding="utf-8"))


class DeleteCase(BuildTreeTestCase):
    def passes(self, commands, member=MT, **kw):
        for command in commands:
            with self.subTest(member=member, command=command):
                self.assertPass(self.bash(member, command, **kw.get("ev", {})), **kw.get("run", {}))

    def blocks(self, commands, contains=None, member=MT, **kw):
        for command in commands:
            with self.subTest(member=member, command=command):
                self.assertBlock(self.bash(member, command, **kw.get("ev", {})), contains, **kw.get("run", {}))

    def abs_or_skip(self):
        """写しのプロジェクトの絶対パス（/ 区切り）。rm -rf の語で許さない文字があれば飛ばす。"""
        if not ABS_WORD.fullmatch(self.P_SLASH):
            self.skipTest(f"一時ディレクトリのパスに rm -rf の語で許さない文字がある: {self.P_SLASH}")
        return self.P_SLASH


class DeleteAllowedTest(DeleteCase):
    """蒙恬は tmp/b/p2/・tmp/b/dist/・tmp/b/smoke/ext/ の下と tmp/b/trial-* を消せる（残すものを除く）。"""

    def test_inside_the_four_places(self):
        self.passes([
            "rm -rf tmp/b/p2/foo",
            "rm -rf tmp/b/p2/1.146.0-p2-A-1",
            "rm -rf tmp/b/p2/1.146.0-p2-A-1/",
            "rm -rf tmp/b/p2/1.146.0-p2-A-1/Shuko-win32-x64-1.146.0-p2-A-1",
            "rm -rf tmp/b/p2/1.146.0-p2-B-7-r2",
            "rm -rf tmp/b/p2/1.146.0-p1-a1-r2",
            "rm -rf tmp/b/p2/other",                               # 写しの下に実在する名前
            "rm -rf tmp/b/dist/foo.zip",
            "rm -rf tmp/b/dist/1.146.0-p2-A-1.zip",
            "rm -rf tmp/b/dist/1.146.0-p1-a1-r2.zip",
            "rm -rf tmp/b/dist/other.zip",
            "rm -rf tmp/b/smoke/ext/foo",
            "rm -rf tmp/b/smoke/ext/foo/bar",
            "rm -rf tmp/b/smoke/ext/not-there",
            "rm -rf tmp/b/trial-install-doc",
            "rm -rf tmp/b/trial-install-doc/sub",
            "rm -rf tmp/b/trial-x/sub",
        ])

    def test_forms(self):
        p = self.abs_or_skip()
        self.passes([
            f"rm -rf {p}/tmp/b/p2/foo",                            # 絶対パスで打っても同じ場所として通る
            f"rm -rf {p[0].lower()}{p[1:]}/tmp/b/p2/foo",          # 小文字のドライブ
            f"rm -rf {p.upper()}/TMP/B/P2/foo",                    # 大文字小文字を問わない（絶対パス）
            "rm -rf TMP/B/P2/foo",                                 # 大文字小文字を問わない（相対パス）
            "rm -rf tmp/b/p2/foo/",
            "rm -rf tmp/b/p2/foo ",                                # 末尾の空白は断片の前後の空白として除く
            "rm -rf tmp/b/p2/a tmp/b/dist/b.zip",                  # 複数のパス
            "rm -rf tmp/b/p2/1.146.0-p2-A-1 tmp/b/p2/1.146.0-p2-B-1-r2",
            f"rm -rf tmp/b/p2/a {p}/tmp/b/dist/b.zip",             # 相対と絶対を混ぜたもの
            "rm -rf tmp/b/p2/a && rm -rf tmp/b/dist/b.zip",        # && で繋いだ2つの削除
            "git status && rm -rf tmp/b/p2/1.146.0-p2-A-2",
            "rm -rf tmp/b/p2/x &",                                 # 末尾の & は後ろに何も繋がない（断片は rm だけ）
            "rm -rf tmp/b/p2/x;",                                  # 空の断片は無視する
        ])

    def test_names_similar_to_keep_pass(self):
        # 残す版と名前の頭が同じだけの別物は守らない
        self.passes([
            "rm -rf tmp/b/p2/1.146.0-p2-alla",
            "rm -rf tmp/b/p2/1.146.0-p2-all-x",
            "rm -rf tmp/b/p2/1.146.0-p2-allx",
            "rm -rf tmp/b/dist/1.146.0-p2-all.zip.bak",
        ])


class DeleteBlockedTest(DeleteCase):
    """削除の規則の外・形の違い・繋ぎ・展開は止まる。"""

    def test_escape(self):
        self.blocks([
            "rm -rf tmp/b/p2/../x", "rm -rf tmp/b/p2/../vscode", "rm -rf tmp/b/p2/./x", "rm -rf tmp/b//p2/x",
            "rm -rf tmp//b/p2/x", "rm -rf tmp/b/p2//x", "rm -rf tmp/b/p2/x/..", "rm -rf tmp/b/p2/x/../..",
            "rm -rf tmp/b/p2/..", "rm -rf tmp/b/p2/x/../../..", "rm -rf tmp/b/p2/x/./", "rm -rf tmp/b/p2/.",
            "rm -rf tmp/b/p2/x/../", "rm -rf tmp/b/trial-x/../p1", "rm -rf tmp/b/dist/../p2/x",
            "rm -rf tmp/b/p2/x/../../../../.claude", "rm -rf ../ai-editor/tmp/b/p2/x",
            "rm -rf ./tmp/b/p2/x", "rm -rf p2/x", "rm -rf ../p2/x", "rm -rf //b/p2/x", "rm -rf //tmp/b/p2/x",
            "rm -rf b/p2/x", "rm -rf ./x",
        ])

    def test_path_forms(self):
        p = self.P_SLASH
        msys = "/" + p[0].lower() + p[2:]
        self.blocks([
            f"rm -rf {msys}/tmp/b/p2/x", "rm -rf /tmp/b/p2/x", "rm -rf tmp\\b\\p2\\x", "rm -rf TMP\\B\\P2\\x",
            "rm -rf tmp\\\\b\\\\p2\\\\x", "rm -rf tmp\\b/p2/x", "rm -rf tmp/b/p2\\x", f"rm -rf \\\\?\\{self.P}\\tmp\\b\\p2\\x",
            f"rm -rf //?/{p}/tmp/b/p2/x", f"rm -rf {p[:2]}tmp/b/p2/x", "rm -rf tmp/b/p2/x:foo", "rm -rf tmp/b/p2/x:y",
            "rm -rf \"tmp/b/p2/x\"", "rm -rf 'tmp/b/p2/x'", "rm -rf tmp/b/p2/x\\ y", "rm -rf tmp/b/p2/x.",
            "rm -rf tmp/b/p2/x::$DATA", "rm -rf ~/x", "rm -rf ~/tmp/b/p2/x", "rm -rf //server/share/tmp/b/p2/x",
            "rm -rf -x/y", "rm -rf .tmp/b/p2/x",
        ])

    def test_extra_paths_after(self):
        # 後ろに別のパスやオプションを足した形（案 A の穴の形）は、全部のパスを確かめて止める
        self.blocks([
            "rm -rf tmp/b/p2/x tmp/b", "rm -rf tmp/b/p2/x tmp", "rm -rf tmp/b/p2/x /c/Users", "rm -rf tmp/b/p2/x ../..",
            "rm -rf tmp/b/p2/x E:/develop", "rm -rf tmp/b/p2/x ./y", "rm -rf tmp/b/p2/x ~", "rm -rf tmp/b/p2/x .",
            "rm -rf tmp/b/p2/x *", "rm -rf tmp/b/p2/x -- tmp/b", "rm -rf tmp/b/p2/x tmp/b/p2/1.146.0-p2-all",
            "rm -rf tmp/b/p2/x  tmp/b", "rm -rf tmp/b/p2/x\ttmp/b", "rm -rf tmp/b/p2/x C:/",
            "rm -rf tmp/b/p2/x --no-preserve-root /", "rm -rf tmp/b/p2/x --no-preserve-root", "rm -rf tmp/b/p2/x -v",
            "rm -rf tmp/b/p2/x .claude", "rm -rf tmp/b/p2/x team/hooks", "rm -rf tmp/b/p2/x docs",
        ])

    def test_chained_commands(self):
        self.blocks([
            "rm -rf tmp/b/p2/x; rm -rf tmp/b", "rm -rf tmp/b/p2/x && rm -rf tmp/b", "rm -rf tmp/b/p2/x || rm -rf tmp/b",
            "rm -rf tmp/b/p2/x | rm -rf tmp/b", "rm -rf tmp/b/p2/x & rm -rf tmp/b", "rm -rf tmp/b/p2/x\nrm -rf tmp/b",
            "rm -rf tmp/b/p2/x\r\nrm -rf tmp/b", "rm -rf tmp/b/p2/x; ls", "rm -rf tmp/b/p2/x && echo done",
            "rm -rf tmp/b/p2/x; curl https://example.invalid", "rm -rf tmp/b/p2/x && del tmp/b",
            "echo hi; rm -rf tmp/b/p2/x", "rm -rf tmp/b/p2/x | xargs rm", "rm -rf tmp/b/p2/x > tmp/b/x",
            "rm -rf tmp/b/p2/x 2>&1", "rm -rf tmp/b/p2/x $(rm -rf tmp/b)", "rm -rf tmp/b/p2/x `echo tmp/b`",
            "rm -rf tmp/b/p2/x;rm -rf tmp/b", "rm -rf tmp/b/p2/x&&rm -rf tmp/b", "rm -rf tmp/b/p2/x||rm -rf tmp/b",
        ])

    def test_other_commands_and_option_forms(self):
        self.blocks([
            "bash -c \"rm -rf tmp/b/p2/x\"", "bash -c 'rm -rf tmp/b/p2/x'", "sh -c 'rm -rf tmp/b/p2/x'", "xargs rm -rf",
            "find tmp/b/p2 -delete", "find tmp/b/p2/x -delete", "find tmp/b/p2/x -exec rm -rf {} +", "rmdir tmp/b/p2/x",
            "unlink tmp/b/dist/x.zip", "mv tmp/b/p2/x tmp/b/y", "mv tmp/b/p2/x tmp/b/dist/y", "cp -r tmp/b/p2/x tmp/b/y",
            "rm -r tmp/b/p2/x", "rm -f tmp/b/p2/x", "rm -r -f tmp/b/p2/x", "rm -fr tmp/b/p2/x", "rm -Rf tmp/b/p2/x",
            "rm -rfv tmp/b/p2/x", "rm -rf --one-file-system tmp/b/p2/x", "rm -rf -- tmp/b/p2/x", "rm tmp/b/p2/x",
            "rm -rf", "rm -rf ", "rm", "rm -rf --no-preserve-root tmp/b/p2/x", "rm -rf -v tmp/b/p2/x",
            "rm  -rf tmp/b/p2/x", "rm -rf  tmp/b/p2/x", "rm -rf\ttmp/b/p2/x",
            "/bin/rm -rf tmp/b/p2/x", "/usr/bin/rm -rf tmp/b/p2/x", "\\rm -rf tmp/b/p2/x", "command rm -rf tmp/b/p2/x",
            "env rm -rf tmp/b/p2/x", "FOO=1 rm -rf tmp/b/p2/x", "RM -RF tmp/b/p2/x", "RM -rf tmp/b/p2/x",
            "Rm -rf tmp/b/p2/x", "rm.exe -rf tmp/b/p2/x",
            "powershell -Command \"Remove-Item -Recurse tmp/b/p2/x\"", "cmd /c rmdir /s /q tmp\\b\\p2\\x", "del /s tmp/b/p2/x",
            "node -e \"require('fs').rmSync('tmp/b/p2/x',{recursive:true})\"",
        ])

    def test_option_forms_are_not_listed(self):
        # 形が違うときは「ホワイトリストに無いコマンドです」で止める（ほかの検査で偶然止まったのではない）
        for command in ("rm -r -f tmp/b/p2/x", "rm -fr tmp/b/p2/x", "rm -rf"):
            with self.subTest(command=command):
                err = self.assertBlock(self.bash(MT, command), NOT_LISTED)
                self.assertIn("rm -rf <パス>", err)
        # rm -rf の後ろの語はパスとして確かめる（-- や -v はパスの形でないとして止まる）
        for command in ("rm -rf -- tmp/b/p2/x", "rm -rf tmp/b/p2/x -v"):
            with self.subTest(command=command):
                self.assertBlock(self.bash(MT, command), "削除するパスは C:/… の絶対パス")

    def test_roots_themselves_and_outside(self):
        self.blocks([
            "rm -rf tmp/b/p2", "rm -rf tmp/b/p2/", "rm -rf TMP/B/P2", "rm -rf tmp/b/dist", "rm -rf tmp/b/dist/",
            "rm -rf tmp/b/smoke/ext", "rm -rf tmp/b/smoke/ext/", "rm -rf tmp/b/smoke", "rm -rf tmp/b/smoke/",
            "rm -rf tmp/b", "rm -rf tmp/b/", "rm -rf tmp", "rm -rf C:/", "rm -rf C:",
            "rm -rf tmp/b/trial-",                                 # * は空に一致しない
            "rm -rf tmp/b/trial-/", "rm -rf tmp/b/trial", "rm -rf tmp/b/trialx",
            "rm -rf tmp/b/wt/x", "rm -rf tmp/b/wt", "rm -rf tmp/b/vscode", "rm -rf tmp/b/p1/x", "rm -rf tmp/b/smoke/x",
            "rm -rf tmp/b/smoke/ext2/x", "rm -rf tmp/b/p2x/y", "rm -rf tmp/b/distx/y",
            # v2-1b（2026-11-17）: 「rm -rf tmp/b/wt-r2/1.146.0」は一度だけの片づけ（delete_paths の tmp/b/wt-r2。v2-2 まで）で
            # 通るので外し、似た名前の2形を足した（通る側は test_build_root.WtR2OutsideRowsTest.test_one_time_cleanup_until_v2_2）。
            # 【v2-3 を当てたときに直す】"rm -rf tmp/b/wt-r2/1.146.0" をここへ戻す
            "rm -rf tmp/b/wt-r2x/y", "rm -rf tmp/b/wt-r4",
            "rm -rf tmp/b/cache", "rm -rf tmp/b/netlog", "rm -rf C:/Users", "rm -rf E:/develop", "rm -rf tmp/b/local.json",
            "rm -rf docs", "rm -rf scripts/x.mjs", "rm -rf .claude/agents", "rm -rf team", "rm -rf .git",
            "rm -rf tmp/b/p2/x/.git", "rm -rf tmp/b/p2/.git",
        ])

    def test_outside_message(self):
        self.assertBlock(self.bash(MT, "rm -rf tmp/b/wt/x"), "delete_paths の下ではない")
        self.assertBlock(self.bash(MT, "rm -rf tmp/b/p2"), "規則のディレクトリそのものも不可")

    def test_globs_short_names_and_expansion(self):
        self.blocks([
            "rm -rf tmp/b/p2/1.146~1", "rm -rf tmp/b/P2~1/x", "rm -rf tmp/b/PROGRA~1", "rm -rf tmp/b/dist/1146~1.ZIP",
            "rm -rf C:/PROGRA~1", "rm -rf C:/PROGRA~1/x", "rm -rf tmp/b/p2/1146~1.0-P", "rm -rf tmp/b/p2/~1",
            "rm -rf tmp/b/p2/x:$DATA", "rm -rf tmp/b/p2/x:",
            "rm -rf tmp/b/p2/*", "rm -rf tmp/b/p2/?", "rm -rf tmp/b/p2/1.146.0-p2-A-?", "rm -rf tmp/b/p2/[a]",
            "rm -rf tmp/b/p2/[a]*", "rm -rf tmp/b/p2/{a,b}", "rm -rf tmp/b/p2/*/x", "rm -rf tmp/b/p2/1.146.0-p2-al*",
            "rm -rf tmp/b/trial-*", "rm -rf tmp/b/*", "rm -rf tmp/b/p2/x*", "rm -rf t*/b/p2/x",
            "rm -rf tmp/b/p2/$HOME", "rm -rf tmp/b/p2/${X}", "rm -rf tmp/b/p2/$X", "rm -rf $HOME", "rm -rf $USERPROFILE",
            "rm -rf %USERPROFILE%", "rm -rf tmp/b/p2/%X%", "rm -rf tmp/b/p2/%USERPROFILE%", "rm -rf tmp/b/p2/$(echo x)",
            "rm -rf tmp/b/p2/`echo x`", "rm -rf \"tmp/b/p2/x tmp/b\"", "rm -rf tmp/b/p2/\"x\"",
            "rm -rf tmp/b/p2/x#", "rm -rf tmp/b/p2/x#y", "rm -rf tmp/b/p2/x!", "rm -rf tmp/b/p2/x'",
            "rm -rf tmp/b/p2/\u00e9", "rm -rf tmp/b/p2/\uff41", "rm -rf tmp/b/p2/x\u00a0tmp/b", "rm -rf tmp/b/p2/x\u3000tmp/b",
            "rm -rf tmp/b/p2/~", "rm -rf ~", "rm -rf tmp/b/p2/x<y", "rm -rf tmp/b/p2/(x)",
        ])

    def test_other_members_have_no_delete(self):
        for member in ("ooka-echizen", "cao-shen", "di-renjie"):
            for command in ("rm -rf tmp/b/p2/foo", "rm -rf tmp/b/dist/foo.zip", "rm -rf tmp/b/trial-x"):
                with self.subTest(member=member, command=command):
                    self.assertBlock(self.bash(member, command))


class RelativeDeleteWhereTest(DeleteCase):
    """3a: 相対パスの削除は、フック入力の cwd がプロジェクト直下のときだけ通す（2026-11-16。cwd の無い入力は
    test_cwd_missing）。出典: Team の tasks/2026-11-16-ai-editor-move-off-c-perms/perm-tests/test_c_delete.py。"""

    def test_cwd_not_root(self):
        p = self.abs_or_skip()
        docs = str(self.project / "docs")
        self.assertBlock(self.bash(MT, "rm -rf tmp/b/p2/other", cwd=docs), "作業ディレクトリがプロジェクト直下")
        self.assertPass(self.bash(MT, f"rm -rf {p}/tmp/b/p2/other", cwd=docs))
        self.assertBlock(self.bash(MT, f"rm -rf {p}/tmp/b/p2/1.146.0-p2-all", cwd=docs), KEEP)

    def test_absolute_forms_of_keep_and_roots(self):
        p = self.abs_or_skip()
        self.blocks([f"rm -rf {p}/tmp/b/p2/1.146.0-p2-all", f"rm -rf {p.upper()}/TMP/B/P2/1.146.0-P2-ALL"], KEEP)
        self.blocks([f"rm -rf {p}/tmp/b/p2", f"rm -rf {p}/tmp", f"rm -rf {p}", f"rm -rf {p}/.claude",
                     f"rm -rf {p}/tmp/b/p2/../../../team"])

    @unittest.skipUnless(sys.platform == "win32", "ジャンクションは Windows だけ")
    def test_junction_inside_project_to_keep(self):
        # tmp/b/p2/alias -> tmp/b/p2/1.146.0-p2-all（ジャンクション）。realpath の形で残すものに当たって止まる。
        # 共用の写しを書き換えないよう、1回きりの写しで作る
        import _winapi

        with tempfile.TemporaryDirectory() as tmp:
            project = make_build_project(tmp)
            alias = project / "tmp" / "b" / "p2" / "alias"
            _winapi.CreateJunction(str(project / "tmp" / "b" / "p2" / "1.146.0-p2-all"), str(alias))
            try:
                kw = {"ev": {"cwd": str(project)}, "run": {"project": project}}
                self.blocks(["rm -rf tmp/b/p2/alias", "rm -rf tmp/b/p2/alias/sub"], KEEP, **kw)
                self.passes(["rm -rf tmp/b/p2/other"], **kw)
            finally:
                os.rmdir(alias)  # ジャンクションだけを外す（先は消さない）


class DeleteKeepTest(DeleteCase):
    """残すもの（delete_keep の9行。v2-1）そのもの・その下・その祖先は止まる。大文字小文字を問わない。"""

    # tmp/b/smoke/ext/ の直下にある、残す版のスモークの拡張（2026-11-15 の C:/b の一覧から写した固定の名前）
    SMOKE_KEEP = (
        "1.146.0-p1-a1-r3", "1.146.0-p1-a1-r3.marker.json",
        "1.146.0-p2-all-1", "1.146.0-p2-all-1.marker.json",
        "1.146.0-p2-all-2", "1.146.0-p2-all-2.marker.json",
        "1.146.0-p2-all-3", "1.146.0-p2-all-3.marker.json",
    )
    # 同じ一覧の、残す版でないスモークの拡張（一部）
    SMOKE_OTHERS = (
        "1.146.0-p2-A-1", "1.146.0-p2-A-1.marker.json", "1.146.0-p2-A-1-b2",
        "1.146.0-p2-B-2-r2-run2", "1.146.0-p2-B-7-r2.marker.json",
        "1.146.0-p1-a1", "1.146.0-p1-a1.marker.json",
        "1.146.0-official", "1.146.0-take-in-trial-official-1.146.0-1",
    )

    def test_p2_and_dist_keep(self):
        self.blocks([
            "rm -rf tmp/b/p2/1.146.0-p2-all", "rm -rf tmp/b/p2/1.146.0-p2-all/", "rm -rf tmp/b/p2/1.146.0-p2-all/sub",
            "rm -rf tmp/b/p2/1.146.0-p2-all/Shuko-win32-x64-1.146.0-p2-all",
            "rm -rf tmp/b/p2/1.146.0-P2-ALL", "rm -rf TMP/B/P2/1.146.0-P2-All", "rm -rf tmp/b/p2/1.146.0-p2-All/sub",
            "rm -rf tmp/B/P2/1.146.0-P2-ALL",
            "rm -rf tmp/b/dist/1.146.0-p2-all.zip", "rm -rf tmp/b/dist/1.146.0-p2-all.ZIP", "rm -rf tmp/b/dist/1.146.0-P2-ALL.Zip",
            "rm -rf tmp/b/dist/1.146.0-P2-ALL.ZIP", "rm -rf tmp/b/dist/1.146.0-p2-all.zip/",
            "rm -rf tmp/b/dist/1.146.0-p1-a1-r3.zip", "rm -rf tmp/b/dist/1.146.0-p1-a1-r3.ZIP",
            "rm -rf tmp/b/p2/foo tmp/b/p2/1.146.0-p2-all",           # 複数のパスに混ぜたもの
            "rm -rf tmp/b/p2/1.146.0-p2-A-1 tmp/b/p2/1.146.0-p2-all",
        ], KEEP)

    def test_u7_misplaced_keep_row_removed(self):
        # U7（2026-11-16。意図した期待の変更）: 前の delete_keep の C:/b/p2/1.146.0-p1-a1-r3 は何も無い場所を指していた
        # （版は p1/ にある）ので、tmp/b に移すときに外した。前は C:/b/p2/1.146.0-p1-a1-r3 を「残すもの」として止まる側に
        # 持っていた。今は tmp/b/p2/1.146.0-p1-a1-r3 は消せる（何も無い場所）。本当の置き場所 tmp/b/p1/… は
        # delete_paths の外なので消せない
        self.passes(["rm -rf tmp/b/p2/1.146.0-p1-a1-r3", "rm -rf tmp/b/p2/1.146.0-p1-a1-r3/x"])
        self.blocks(["rm -rf tmp/b/p1/1.146.0-p1-a1-r3", "rm -rf tmp/b/p1"], "delete_paths の下ではない")

    def test_keep_with_trailing_dots_and_streams(self):
        # 末尾の点や代替データストリームの形も止まる（理由は形の検査か残すもの）
        self.blocks([
            "rm -rf tmp/b/p2/1.146.0-p2-all.", "rm -rf tmp/b/p2/1.146.0-p2-all..", "rm -rf tmp/b/p2/1.146.0-p2-all::$DATA",
            "rm -rf tmp/b/p2/1.146.0-p2-all:x", "rm -rf tmp/b/dist/1.146.0-p2-all.zip.", "rm -rf tmp/b/dist/1.146.0-p2-all.zip..",
        ])

    def test_smoke_keep(self):
        for name in self.SMOKE_KEEP:
            with self.subTest(name=name):
                self.assertBlock(self.bash(MT, f"rm -rf tmp/b/smoke/ext/{name}"), KEEP)
        self.blocks([
            "rm -rf tmp/b/smoke/ext/1.146.0-P1-A1-R3",
            "rm -rf tmp/b/smoke/ext/1.146.0-p1-a1-r3.MARKER.JSON",
            "rm -rf tmp/b/smoke/ext/1.146.0-P2-ALL-1.MARKER.JSON",
            "rm -rf tmp/b/smoke/ext/1.146.0-P2-ALL-2",
            "rm -rf TMP/B/SMOKE/EXT/1.146.0-p2-all-1.marker.json",
            "rm -rf tmp/b/smoke/ext/1.146.0-p1-a1-r3/",
            "rm -rf tmp/b/smoke/ext/1.146.0-p1-a1-r3/sub",
            "rm -rf tmp/b/smoke/ext/1.146.0-p2-all-2/sub",
            "rm -rf tmp/b/smoke/ext/1.146.0-p2-all-4",                 # p2-all* はまだ無い名前も守る
            "rm -rf tmp/b/smoke/ext/1.146.0-p2-all-4.marker.json",
            "rm -rf tmp/b/smoke/ext/foo tmp/b/smoke/ext/1.146.0-p2-all-3",
            "rm -rf tmp/b/smoke/ext/1.146.0-p2-A-1 tmp/b/smoke/ext/1.146.0-p2-all-3",
        ], KEEP)
        self.blocks(["rm -rf tmp/b/smoke/ext/1.146.0-p1-a1-r3."])

    def test_smoke_others_pass(self):
        self.passes([f"rm -rf tmp/b/smoke/ext/{name}" for name in self.SMOKE_OTHERS])
        self.passes([
            "rm -rf tmp/b/smoke/ext/1.146.0-p2-A-1 tmp/b/smoke/ext/1.146.0-p2-A-1.marker.json",
            # r3 はフォルダとマーカーの2行に分けたので、頭が同じだけの名前は守らない
            "rm -rf tmp/b/smoke/ext/1.146.0-p1-a1-r3x",
            "rm -rf tmp/b/smoke/ext/1.146.0-p1-a1-r3x.marker.json",
            "rm -rf tmp/b/smoke/ext/1.146.0-p1-a1-r2",
            # * は空に一致しないので、p2-all* は 1.146.0-p2-all そのもの（今は無い）を守らない（R13）
            "rm -rf tmp/b/smoke/ext/1.146.0-p2-all",
        ])

    def test_keep_star_does_not_match_empty(self):
        # delete_keep の * も空に一致しない。r3* の1行だけでは、フォルダそのもの（1.146.0-p1-a1-r3）を守れない
        # （ベーコンの再実測 bacon-tests/results-recheck-r3star.txt と同じ入力）。一時のプロジェクトで keep を組み替える
        with tempfile.TemporaryDirectory() as tmp:
            project = make_build_project(tmp)
            path, perms = permissions_of(project, MT)
            perms["delete_keep"] = [k for k in perms["delete_keep"] if "smoke/ext" not in k] + ["tmp/b/smoke/ext/1.146.0-p1-a1-r3*"]
            path.write_text(json.dumps(perms, indent=2), encoding="utf-8")
            kw = {"ev": {"cwd": str(project)}, "run": {"project": project}}
            self.passes(["rm -rf tmp/b/smoke/ext/1.146.0-p1-a1-r3"], **kw)
            self.blocks(["rm -rf tmp/b/smoke/ext/1.146.0-p1-a1-r3.marker.json",
                         "rm -rf tmp/b/smoke/ext/1.146.0-p1-a1-r3x"], KEEP, **kw)


class U8KeepTest(DeleteCase):
    """U8（2026-11-16。フェルミの判断で残す側に倒した）: 新しい段階 C の版（p5）を残す版に足した3行
    tmp/b/p2/1.146.0-p5*・tmp/b/dist/1.146.0-p5*・tmp/b/smoke/ext/1.146.0-p5*。v2-1〜v2-3 のどれにもある。
    出典: Team の tasks/2026-11-16-ai-editor-move-off-c-perms/perm-tests/test_p_round6.py（U8KeepTest）。

    【v2-1c を当てたときに直す】（Team の tasks/2026-11-16-ai-editor-perm-requests-2 の perm-proposal.md 8.2節）p5 の
    前方一致の3行が、r4 を名指しした5行（tmp/b/p2/1.146.0-p5-c-all-r4・…-r4-ooka・tmp/b/dist/1.146.0-p5-c-all-r4.zip・
    tmp/b/smoke/ext/1.146.0-p5r4-1・…-p5r4-1.marker.json）に替わる。test_rows_in_real_permissions は「r4 の5行があり、
    p5 の3行が無い」に、test_p5_versions_cannot_be_deleted は (1) r4 の5つ（その下・大文字小文字違い・絶対パス・祖先）が
    消せない、(2) 古い p5 の版（perm-tests/test_e_delete.py の OLD_P5 の25個）が消せる、の2つに分ける。偽の木
    （hookrun.BUILD_DIRS・BUILD_FILES）に、r4 の5つの名前と古い版の名前（-r3・-r3c・-r3c-ooka・-r3b.zip・p5r3c-* など）を足す。
    v2-2・v2-3 も同じ（v2-1c の delete_keep を引き継ぐ）。"""

    # 2026-11-16 に1階層だけ見た名前（perm-proposal.md の「U8 で足した行」）
    P5_NAMES = {
        "p2": ("1.146.0-p5-c-all", "1.146.0-p5-c-all-r2", "1.146.0-p5-c-all-r2-ooka"),
        "dist": ("1.146.0-p5-c-all.zip", "1.146.0-p5-c-all-r2.zip"),
        "smoke/ext": ("1.146.0-p5-c-all-1", "1.146.0-p5-c-all-1.marker.json", "1.146.0-p5r2-1",
                      "1.146.0-p5r2-1.marker.json", "1.146.0-p5r2-2", "1.146.0-p5r2-2.marker.json", "1.146.0-p5r2-3",
                      "1.146.0-p5r2-3.marker.json"),
    }

    def test_rows_in_real_permissions(self):
        _, perms = permissions_of(self.project, MT)
        self.assertTrue({"tmp/b/p2/1.146.0-p5*", "tmp/b/dist/1.146.0-p5*", "tmp/b/smoke/ext/1.146.0-p5*"}
                        <= set(perms["delete_keep"]))

    def test_p5_versions_cannot_be_deleted(self):
        p = self.abs_or_skip()
        for folder, names in self.P5_NAMES.items():
            for name in names:
                for form in (f"tmp/b/{folder}/{name}", f"TMP/B/{folder.upper()}/{name.upper()}", f"{p}/tmp/b/{folder}/{name}"):
                    with self.subTest(form=form):
                        self.assertBlock(self.bash(MT, f"rm -rf {form}"), KEEP)
            if not names[0].endswith((".zip", ".json")):
                with self.subTest(inside=names[0]):
                    self.assertBlock(self.bash(MT, f"rm -rf tmp/b/{folder}/{names[0]}/logs"), KEEP)
        for ancestor in ("tmp/b/p2", "tmp/b/dist", "tmp/b/smoke/ext", "tmp/b/smoke"):
            with self.subTest(ancestor=ancestor):
                self.assertBlock(self.bash(MT, f"rm -rf {ancestor}"))

    def test_others_still_deletable(self):
        self.passes(["rm -rf tmp/b/p2/other", "rm -rf tmp/b/dist/other.zip", "rm -rf tmp/b/smoke/ext/1.146.0-p4-x",
                     # * は空に一致しないので、名前が 1.146.0-p5 ちょうどの物は守られない（そういう名前は無い）
                     "rm -rf tmp/b/p2/1.146.0-p5", "rm -rf tmp/b/dist/1.146.0-p4.zip"])


class CDriveDeleteV21Test(DeleteCase):
    """v2-1（2026-11-16）の蒙恬は C:/b を消せない（delete_paths・delete_keep に C:/b の行が無い）。

    【v2-2 を当てたときに直す】v2-2 は C:/b の直下の15個（cache・dist・logs・notion-sync-trial・p0・p1・p2・p4-watch・
    smoke・take-in・take-in-trial・tmp・vscode・work-b・wt）の delete_paths と bash_exact の rmdir C:/b を一時に足す。
    そのとき test_c_b_not_deletable_in_v2_1 の C:/b/<15個> の形と rmdir C:/b は通るようになるので、このテストを
    「15個とその下・rmdir C:/b は通り、C:/b そのもの・15個の外・.git の名指しは止まる」に直す（perm-proposal.md の
    「本物のテストの直し（v2-1 を当てたとき）」の節）。v2-3 では C:/b の行が無くなり、今の形に戻る。"""

    def test_c_b_not_deletable_in_v2_1(self):
        self.blocks(["rm -rf C:/b/p2/foo", "rm -rf C:/b/p2/1.146.0-p2-all", "rm -rf C:/b/dist/foo.zip",
                     "rm -rf C:/b/smoke/ext/foo", "rm -rf C:/b/trial-x", "rm -rf C:/b/wt", "rm -rf C:/b/vscode",
                     "rm -rf C:/b", "rmdir C:/b", "rm -rf C:/b/wt/p2"])
        self.assertBlock(self.bash(MT, "rm -rf C:/b/p2/foo"), "delete_paths の下ではない")


class DeleteToolAndRmLineTest(DeleteCase):
    """削除は Bash ツールだけ。bash の行に rm を書くと、後ろのパスが確かめられない（permcheck が誤りにする理由）。"""

    def test_powershell_tool(self):
        # 今の蒙恬の tools に PowerShell は無い（checkTool で止まる）
        self.assertBlock(self.bash(MT, "rm -rf tmp/b/p2/foo") | {"tool_name": "PowerShell"}, "定義の tools に無い")
        with tempfile.TemporaryDirectory() as tmp:
            project = make_build_project(tmp)
            definition = project / ".claude" / "agents" / f"{MT}.md"
            text = definition.read_text(encoding="utf-8").replace("tools: Read,", "tools: PowerShell, Read,", 1)
            definition.write_text(text, encoding="utf-8")
            for command in ("rm -rf tmp/b/p2/foo", "rm -rf tmp/b/dist/foo.zip"):
                with self.subTest(command=command):
                    ev = self.bash(MT, command, cwd=str(project))
                    self.assertPass(ev, project=project)
                    self.assertBlock(ev | {"tool_name": "PowerShell"}, "Bash ツールでだけ", project=project)

    def test_rm_line_in_bash_is_a_hole(self):
        # bash の行（前方一致）が先に一致すると checkDelete を通らない。permcheck は rm で始まる行を誤りにする
        # （PermcheckDeleteKeysTest.test_rm_bash_line_is_error）
        with tempfile.TemporaryDirectory() as tmp:
            project = make_build_project(tmp)
            path, perms = permissions_of(project, MT)
            perms["bash"] = perms["bash"] + ["rm -rf tmp/b/p2/*"]
            path.write_text(json.dumps(perms, indent=2), encoding="utf-8")
            kw = {"ev": {"cwd": str(project)}, "run": {"project": project}}
            self.passes(["rm -rf tmp/b/p2/x tmp/b", "rm -rf tmp/b/p2/1.146.0-p2-all"], **kw)
            self.blocks(["rm -rf tmp/b/p2/x; rm -rf tmp/b", "rm -rf tmp/b/p2/x/../.."], **kw)


@unittest.skipUnless(sys.platform == "win32", "ジャンクションは Windows だけ")
class DeleteFilesystemTest(DeleteCase):
    """tempfile の下に作った場所で、ジャンクション・残すものの祖先・自己防護・秘密の場所を確かめる（絶対パスの規則）。"""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        import _winapi

        cls.tmp = os.path.realpath(tempfile.mkdtemp(prefix="ai-editor-hooks-del-"))
        cls.links = []
        cls.addClassCleanup(cls._cleanup)
        base = Path(cls.tmp)
        if not ABS_WORD.fullmatch(fwd(base)):
            raise unittest.SkipTest(f"一時ディレクトリのパスに rm -rf の語で許さない文字がある: {base}")
        cls.b = b = fwd(base)
        for d in ("p2/keepme/sub", "p2/other/deep", "p2/real/inner", "outside/data", "dist"):
            (base / d).mkdir(parents=True, exist_ok=True)
        (base / "outside" / "precious.txt").write_text("x", encoding="utf-8")
        (base / "dist" / "keep.zip").write_text("", encoding="utf-8")
        (base / "dist" / "other.zip").write_text("", encoding="utf-8")
        cls.fsproject = make_project(base / "projtmp")
        (cls.fsproject / "docs").mkdir()
        links = {
            "p2/alias": "p2/keepme", "p2/ALIAS2": "p2/keepme", "p2/outer": "outside", "p2/toproj": "projtmp/proj",
            "p2/rootj": ".", "p2/up": "p2", "dist/z": "p2/keepme", "p2/other/inner": "p2/keepme",
            "p2/toclaude": "projtmp/proj/.claude",
        }
        for link, target in links.items():
            _winapi.CreateJunction(os.path.normpath(str(base / target)), os.path.normpath(str(base / link)))
            cls.links.append(base / link)
        path, perms = permissions_of(cls.fsproject, MT)
        perms["delete_paths"] = [f"{b}/p2/", f"{b}/dist/"]
        perms["delete_keep"] = [f"{b}/p2/keepme", f"{b}/dist/keep.zip"]
        path.write_text(json.dumps(perms, indent=2), encoding="utf-8")
        # delete_paths を一時のプロジェクトの親と仮の LOCALAPPDATA にした、広すぎる仮の権限（自己防護と秘密の確かめ用）
        cls.wide = make_project(base / "widetmp")
        path, perms = permissions_of(cls.wide, MT)
        perms["delete_paths"] = [f"{b}/widetmp/", f"{fwd(FAKE_LOCALAPPDATA)}/"]
        perms.pop("delete_keep", None)
        path.write_text(json.dumps(perms, indent=2), encoding="utf-8")

    @classmethod
    def _cleanup(cls):
        for link in reversed(cls.links):  # ジャンクションを外してから消す（先を消さない）
            try:
                os.rmdir(link)
            except OSError:
                pass
        shutil.rmtree(cls.tmp, True)

    def at(self, project):
        return {"ev": {"cwd": str(project)}, "run": {"project": project}}

    def test_plain_inside(self):
        b = self.b
        self.passes([f"rm -rf {b}/p2/other", f"rm -rf {b}/p2/real/inner", f"rm -rf {b}/dist/other.zip",
                     f"rm -rf {b}/p2/nonexist", f"rm -rf {b}/p2/keepmeX"], **self.at(self.fsproject))

    def test_keep_and_its_ancestors(self):
        b = self.b
        self.blocks([f"rm -rf {b}/p2/keepme", f"rm -rf {b}/p2/keepme/sub", f"rm -rf {b}/p2/keepme/sub/x",
                     f"rm -rf {b}/dist/keep.zip"], KEEP, **self.at(self.fsproject))

    def test_junctions_pointing_into_keep(self):
        b = self.b
        self.blocks([f"rm -rf {b}/p2/alias", f"rm -rf {b}/p2/alias/sub", f"rm -rf {b}/p2/ALIAS2", f"rm -rf {b}/p2/alias2/sub",
                     f"rm -rf {b}/dist/z", f"rm -rf {b}/dist/z/sub"], KEEP, **self.at(self.fsproject))

    def test_junctions_pointing_outside(self):
        b = self.b
        self.blocks([
            f"rm -rf {b}/p2/outer", f"rm -rf {b}/p2/outer/data", f"rm -rf {b}/p2/toproj", f"rm -rf {b}/p2/toproj/team",
            f"rm -rf {b}/p2/rootj", f"rm -rf {b}/p2/rootj/projtmp", f"rm -rf {b}/p2/up", f"rm -rf {b}/p2/up/keepme",
            f"rm -rf {b}/p2/toclaude", f"rm -rf {b}/p2/toclaude/agents",
        ], **self.at(self.fsproject))

    def test_junction_itself_into_keep_is_blocked(self):
        # 消してよい名前の中にあるジャンクション（先は残すもの）を直接指すと、realpath が残すものなので止まる
        self.blocks([f"rm -rf {self.b}/p2/other/inner"], KEEP, **self.at(self.fsproject))
        # 削除の場所そのものへのジャンクションの下にある、消してよい名前は通る
        self.passes([f"rm -rf {self.b}/p2/up/other"], **self.at(self.fsproject))

    def test_self_protection(self):
        proj = fwd(self.wide)
        self.blocks([f"rm -rf {proj}", f"rm -rf {proj}/.claude", f"rm -rf {proj}/team/hooks", f"rm -rf {proj}/x/.git"],
                    "プロジェクトそのもの", **self.at(self.wide))
        self.blocks([f"rm -rf {self.b}/widetmp"], **self.at(self.wide))      # プロジェクトの祖先
        self.passes([f"rm -rf {proj}/docs"], **self.at(self.wide))

    def test_secret_paths(self):
        local = fwd(FAKE_LOCALAPPDATA)
        self.blocks([f"rm -rf {local}/Shuko", f"rm -rf {local}/Shuko/secrets/x", f"rm -rf {local}/Shuko/watch"],
                    **self.at(self.wide))
        self.passes([f"rm -rf {local}/other"], **self.at(self.wide))

    def test_junction_inside_target_is_not_inspected(self):
        # 残る穴の確かめ: 消す対象の中にあるジャンクションの先は、フックは見ない（通る）。
        # Git Bash の rm -rf がジャンクションの先を消さないことを、tempfile の下でだけ実地に確かめる
        import _winapi

        base = Path(self.tmp)
        target = base / "p2" / "real2"
        target.mkdir()
        _winapi.CreateJunction(str(base / "outside"), str(target / "jx"))
        self.links.append(target / "jx")
        self.passes([f"rm -rf {self.b}/p2/real2"], **self.at(self.fsproject))
        rm = shutil.which("rm")
        if rm is None:
            self.skipTest("rm が見つからない（Git Bash の rm の実地の確かめを省く）")
        self.assertTrue(str(target).startswith(self.tmp))
        subprocess.run([rm, "-rf", fwd(target)], check=True, timeout=60)
        self.assertFalse(target.exists())
        self.assertTrue((base / "outside" / "precious.txt").exists(), "rm がジャンクションの先を消した")


if __name__ == "__main__":
    unittest.main()
