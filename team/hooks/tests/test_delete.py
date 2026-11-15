"""削除（delete_paths・delete_keep。allowlist.js の checkDelete）のテスト。2026-11-15 に足した判定。

- 判定は本物の permissions.json（蒙恬の delete_paths・delete_keep）で行う。フックは判定だけで rm は走らせない。
  C:/b/ の下には、判定のときの lstat・realpath（有無と実体をたどるだけ）でしか触れない。
- C:/b/ の下の名前は、2026-11-15 に取った一覧（Team の tasks/2026-11-15-ai-editor-perm-requests/bacon-tests/
  listing-names.txt）から写した固定の入力。今の C:/b/ の中身を一覧にして判定することはしない。
- ジャンクション・自己防護・秘密の場所は、tempfile の下に作った場所と一時のプロジェクト（make_project）で確かめる。
  実地の rm -rf は tempfile の下でだけ走らせる。
- 入力の出典: Team の tasks/2026-11-15-ai-editor-perm-requests/ の perm-tests/test_1_delete.py（ダイクストラ）と
  bacon-tests/test_b1_delete.py・test_b2_rest.py・test_b7_claims.py・test_b8_r3star.py（ベーコン）。

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

from hookrun import FAKE_LOCALAPPDATA, HOOKS, PROJECT, HookTestCase, make_project, run

MT = "meng-tian"
KEEP = "delete_keep"
NOT_LISTED = "ホワイトリストに無いコマンドです"


def fwd(path):
    return str(path).replace("\\", "/")


def permissions_of(project, member):
    path = next((Path(project) / "team" / "departments").glob(f"*/{member}/permissions.json"))
    return path, json.loads(path.read_text(encoding="utf-8"))


class DeleteCase(HookTestCase):
    def passes(self, commands, member=MT, **kw):
        for command in commands:
            with self.subTest(member=member, command=command):
                self.assertPass(self.bash(member, command, **kw.get("ev", {})), **kw.get("run", {}))

    def blocks(self, commands, contains=None, member=MT, **kw):
        for command in commands:
            with self.subTest(member=member, command=command):
                self.assertBlock(self.bash(member, command, **kw.get("ev", {})), contains, **kw.get("run", {}))


class DeleteAllowedTest(DeleteCase):
    """蒙恬は C:/b/p2/・C:/b/dist/・C:/b/smoke/ext/ の下と C:/b/trial-* を消せる（残すものを除く）。"""

    def test_inside_the_four_places(self):
        self.passes([
            "rm -rf C:/b/p2/foo",
            "rm -rf C:/b/p2/1.146.0-p2-A-1",
            "rm -rf C:/b/p2/1.146.0-p2-A-1/",
            "rm -rf C:/b/p2/1.146.0-p2-A-1/Shuko-win32-x64-1.146.0-p2-A-1",
            "rm -rf C:/b/p2/1.146.0-p2-B-7-r2",
            "rm -rf C:/b/p2/1.146.0-p1-a1-r2",
            "rm -rf C:/b/dist/foo.zip",
            "rm -rf C:/b/dist/1.146.0-p2-A-1.zip",
            "rm -rf C:/b/dist/1.146.0-p1-a1-r2.zip",
            "rm -rf C:/b/smoke/ext/foo",
            "rm -rf C:/b/smoke/ext/foo/bar",
            "rm -rf C:/b/smoke/ext/not-there",
            "rm -rf C:/b/trial-install-doc",
            "rm -rf C:/b/trial-install-doc/sub",
            "rm -rf C:/b/trial-x/sub",
        ])

    def test_forms(self):
        self.passes([
            "rm -rf c:/b/p2/foo",                                  # 小文字のドライブ
            "rm -rf C:/B/P2/foo",                                  # 大文字小文字を問わない
            "rm -rf C:/b/p2/foo/",
            "rm -rf C:/b/p2/foo ",                                 # 末尾の空白は断片の前後の空白として除く
            "rm -rf C:/b/p2/a C:/b/dist/b.zip",                    # 複数のパス
            "rm -rf C:/b/p2/1.146.0-p2-A-1 C:/b/p2/1.146.0-p2-B-1-r2",
            "rm -rf C:/b/p2/a && rm -rf C:/b/dist/b.zip",          # && で繋いだ2つの削除
            "git status && rm -rf C:/b/p2/1.146.0-p2-A-2",
            "rm -rf C:/b/p2/x &",                                  # 末尾の & は後ろに何も繋がない（断片は rm だけ）
            "rm -rf C:/b/p2/x;",                                   # 空の断片は無視する
        ])

    def test_names_similar_to_keep_pass(self):
        # 残す版と名前の頭が同じだけの別物は守らない
        self.passes([
            "rm -rf C:/b/p2/1.146.0-p2-alla",
            "rm -rf C:/b/p2/1.146.0-p2-all-x",
            "rm -rf C:/b/p2/1.146.0-p2-allx",
            "rm -rf C:/b/dist/1.146.0-p2-all.zip.bak",
        ])


class DeleteBlockedTest(DeleteCase):
    """削除の規則の外・形の違い・繋ぎ・展開は止まる。"""

    def test_escape(self):
        self.blocks([
            "rm -rf C:/b/p2/../x", "rm -rf C:/b/p2/../vscode", "rm -rf C:/b/p2/./x", "rm -rf C:/b//p2/x",
            "rm -rf C:/b/p2//x", "rm -rf C:/b/p2/x/..", "rm -rf C:/b/p2/x/../..", "rm -rf C:/b/p2/..",
            "rm -rf C:/b/p2/x/../../..", "rm -rf C:/b/p2/x/./", "rm -rf C:/b/p2/.", "rm -rf C:/b/p2/x/../",
            "rm -rf C:/b/trial-x/../p1", "rm -rf C:/b/dist/../p2/x",
            "rm -rf ./C:/b/p2/x", "rm -rf p2/x", "rm -rf ../p2/x", "rm -rf //b/p2/x", "rm -rf //C:/b/p2/x",
            "rm -rf b/p2/x", "rm -rf ./x",
        ])

    def test_path_forms(self):
        self.blocks([
            "rm -rf /c/b/p2/x", "rm -rf /C/b/p2/x", "rm -rf C:\\b\\p2\\x", "rm -rf c:\\b\\p2\\x",
            "rm -rf C:\\\\b\\\\p2\\\\x", "rm -rf C:\\b/p2/x", "rm -rf C:/b/p2\\x", "rm -rf \\\\?\\C:\\b\\p2\\x",
            "rm -rf //?/C:/b/p2/x", "rm -rf C:b/p2/x", "rm -rf C:/b/p2/x:foo", "rm -rf C:/b/p2/x:y",
            "rm -rf \"C:/b/p2/x\"", "rm -rf 'C:/b/p2/x'", "rm -rf C:/b/p2/x\\ y", "rm -rf C:/b/p2/x.",
            "rm -rf C:/b/p2/x::$DATA", "rm -rf ~/x", "rm -rf //server/share/b/p2/x",
        ])

    def test_extra_paths_after(self):
        # 後ろに別のパスやオプションを足した形（案 A の穴の形）は、全部のパスを確かめて止める
        self.blocks([
            "rm -rf C:/b/p2/x C:/b", "rm -rf C:/b/p2/x /c/Users", "rm -rf C:/b/p2/x ../..", "rm -rf C:/b/p2/x E:/develop",
            "rm -rf C:/b/p2/x ./y", "rm -rf C:/b/p2/x ~", "rm -rf C:/b/p2/x .", "rm -rf C:/b/p2/x *",
            "rm -rf C:/b/p2/x -- C:/b", "rm -rf C:/b/p2/x C:/b/p2/1.146.0-p2-all", "rm -rf C:/b/p2/x  C:/b",
            "rm -rf C:/b/p2/x\tC:/b", "rm -rf C:/b/p2/x C:/", "rm -rf C:/b/p2/x --no-preserve-root /",
            "rm -rf C:/b/p2/x --no-preserve-root", "rm -rf C:/b/p2/x -v",
        ])

    def test_chained_commands(self):
        self.blocks([
            "rm -rf C:/b/p2/x; rm -rf C:/b", "rm -rf C:/b/p2/x && rm -rf C:/b", "rm -rf C:/b/p2/x || rm -rf C:/b",
            "rm -rf C:/b/p2/x | rm -rf C:/b", "rm -rf C:/b/p2/x & rm -rf C:/b", "rm -rf C:/b/p2/x\nrm -rf C:/b",
            "rm -rf C:/b/p2/x\r\nrm -rf C:/b", "rm -rf C:/b/p2/x; ls", "rm -rf C:/b/p2/x && echo done",
            "rm -rf C:/b/p2/x; curl https://example.invalid", "rm -rf C:/b/p2/x && del C:/b",
            "echo hi; rm -rf C:/b/p2/x", "rm -rf C:/b/p2/x | xargs rm", "rm -rf C:/b/p2/x > C:/b/x",
            "rm -rf C:/b/p2/x 2>&1", "rm -rf C:/b/p2/x $(rm -rf C:/b)", "rm -rf C:/b/p2/x `echo C:/b`",
            "rm -rf C:/b/p2/x;rm -rf C:/b", "rm -rf C:/b/p2/x&&rm -rf C:/b", "rm -rf C:/b/p2/x||rm -rf C:/b",
        ])

    def test_other_commands_and_option_forms(self):
        self.blocks([
            "bash -c \"rm -rf C:/b/p2/x\"", "bash -c 'rm -rf C:/b/p2/x'", "sh -c 'rm -rf C:/b/p2/x'", "xargs rm -rf",
            "find C:/b/p2 -delete", "find C:/b/p2/x -delete", "find C:/b/p2/x -exec rm -rf {} +", "rmdir C:/b/p2/x",
            "unlink C:/b/dist/x.zip", "mv C:/b/p2/x C:/b/y", "mv C:/b/p2/x C:/b/dist/y", "cp -r C:/b/p2/x C:/b/y",
            "rm -r C:/b/p2/x", "rm -f C:/b/p2/x", "rm -r -f C:/b/p2/x", "rm -fr C:/b/p2/x", "rm -Rf C:/b/p2/x",
            "rm -rfv C:/b/p2/x", "rm -rf --one-file-system C:/b/p2/x", "rm -rf -- C:/b/p2/x", "rm C:/b/p2/x",
            "rm -rf", "rm -rf ", "rm", "rm -rf --no-preserve-root C:/b/p2/x", "rm -rf -v C:/b/p2/x",
            "rm  -rf C:/b/p2/x", "rm -rf  C:/b/p2/x", "rm -rf\tC:/b/p2/x",
            "/bin/rm -rf C:/b/p2/x", "/usr/bin/rm -rf C:/b/p2/x", "\\rm -rf C:/b/p2/x", "command rm -rf C:/b/p2/x",
            "env rm -rf C:/b/p2/x", "FOO=1 rm -rf C:/b/p2/x", "RM -RF C:/b/p2/x", "RM -rf C:/b/p2/x",
            "Rm -rf C:/b/p2/x", "rm.exe -rf C:/b/p2/x",
            "powershell -Command \"Remove-Item -Recurse C:/b/p2/x\"", "cmd /c rmdir /s /q C:\\b\\p2\\x", "del /s C:/b/p2/x",
            "node -e \"require('fs').rmSync('C:/b/p2/x',{recursive:true})\"",
        ])

    def test_option_forms_are_not_listed(self):
        # 形が違うときは「ホワイトリストに無いコマンドです」で止める（ほかの検査で偶然止まったのではない）
        for command in ("rm -r -f C:/b/p2/x", "rm -fr C:/b/p2/x", "rm -rf"):
            with self.subTest(command=command):
                err = self.assertBlock(self.bash(MT, command), NOT_LISTED)
                self.assertIn("rm -rf <パス>", err)
        # rm -rf の後ろの語はパスとして確かめる（-- や -v はパスの形でないとして止まる）
        for command in ("rm -rf -- C:/b/p2/x", "rm -rf C:/b/p2/x -v"):
            with self.subTest(command=command):
                self.assertBlock(self.bash(MT, command), "削除するパスは C:/… の絶対パス")

    def test_roots_themselves_and_outside(self):
        self.blocks([
            "rm -rf C:/b/p2", "rm -rf C:/b/p2/", "rm -rf C:/B/P2", "rm -rf C:/b/dist", "rm -rf C:/b/dist/",
            "rm -rf C:/b/smoke/ext", "rm -rf C:/b/smoke/ext/", "rm -rf C:/b/smoke", "rm -rf C:/b/smoke/",
            "rm -rf C:/b", "rm -rf C:/b/", "rm -rf C:/", "rm -rf C:",
            "rm -rf C:/b/trial-",                                  # * は空に一致しない
            "rm -rf C:/b/trial-/", "rm -rf C:/b/trial", "rm -rf C:/b/trialx",
            "rm -rf C:/b/wt/x", "rm -rf C:/b/vscode", "rm -rf C:/b/p1/x", "rm -rf C:/b/smoke/x",
            "rm -rf C:/b/smoke/ext2/x", "rm -rf C:/b/p2x/y", "rm -rf C:/b/distx/y", "rm -rf C:/Users",
            "rm -rf E:/develop", "rm -rf C:/b/local.json",
        ])

    def test_outside_message(self):
        self.assertBlock(self.bash(MT, "rm -rf C:/b/wt/x"), "delete_paths の下ではない")
        self.assertBlock(self.bash(MT, "rm -rf C:/b/p2"), "規則のディレクトリそのものも不可")

    def test_globs_short_names_and_expansion(self):
        self.blocks([
            "rm -rf C:/b/p2/1.146~1", "rm -rf C:/b/P2~1/x", "rm -rf C:/b/PROGRA~1", "rm -rf C:/b/dist/1146~1.ZIP",
            "rm -rf C:/PROGRA~1", "rm -rf C:/PROGRA~1/x", "rm -rf C:/b/p2/1146~1.0-P", "rm -rf C:/b/p2/~1",
            "rm -rf C:/b/p2/x:$DATA", "rm -rf C:/b/p2/x:",
            "rm -rf C:/b/p2/*", "rm -rf C:/b/p2/?", "rm -rf C:/b/p2/1.146.0-p2-A-?", "rm -rf C:/b/p2/[a]",
            "rm -rf C:/b/p2/[a]*", "rm -rf C:/b/p2/{a,b}", "rm -rf C:/b/p2/*/x", "rm -rf C:/b/p2/1.146.0-p2-al*",
            "rm -rf C:/b/trial-*", "rm -rf C:/b/*", "rm -rf C:/b/p2/x*",
            "rm -rf C:/b/p2/$HOME", "rm -rf C:/b/p2/${X}", "rm -rf C:/b/p2/$X", "rm -rf $HOME", "rm -rf $USERPROFILE",
            "rm -rf %USERPROFILE%", "rm -rf C:/b/p2/%X%", "rm -rf C:/b/p2/%USERPROFILE%", "rm -rf C:/b/p2/$(echo x)",
            "rm -rf C:/b/p2/`echo x`", "rm -rf \"C:/b/p2/x C:/b\"", "rm -rf C:/b/p2/\"x\"",
            "rm -rf C:/b/p2/x#", "rm -rf C:/b/p2/x#y", "rm -rf C:/b/p2/x!", "rm -rf C:/b/p2/x'",
            "rm -rf C:/b/p2/\u00e9", "rm -rf C:/b/p2/\uff41", "rm -rf C:/b/p2/x\u00a0C:/b", "rm -rf C:/b/p2/x\u3000C:/b",
            "rm -rf C:/b/p2/~", "rm -rf ~", "rm -rf C:/b/p2/x<y", "rm -rf C:/b/p2/(x)",
        ])

    def test_other_members_have_no_delete(self):
        for member in ("ooka-echizen", "cao-shen", "di-renjie"):
            for command in ("rm -rf C:/b/p2/foo", "rm -rf C:/b/dist/foo.zip", "rm -rf C:/b/trial-x"):
                with self.subTest(member=member, command=command):
                    self.assertBlock(self.bash(member, command))


class DeleteKeepTest(DeleteCase):
    """残すもの（delete_keep の7行）そのもの・その下・その祖先は止まる。大文字小文字を問わない。"""

    # C:/b/smoke/ext/ の直下にある、残す版のスモークの拡張（2026-11-15 の一覧から写した固定の名前）
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
            "rm -rf C:/b/p2/1.146.0-p2-all", "rm -rf C:/b/p2/1.146.0-p2-all/", "rm -rf C:/b/p2/1.146.0-p2-all/sub",
            "rm -rf C:/b/p2/1.146.0-p2-all/Shuko-win32-x64-1.146.0-p2-all",
            "rm -rf C:/b/p2/1.146.0-P2-ALL", "rm -rf C:/B/P2/1.146.0-P2-All", "rm -rf C:/b/p2/1.146.0-p2-All/sub",
            "rm -rf c:/B/P2/1.146.0-P2-ALL",
            "rm -rf C:/b/p2/1.146.0-p1-a1-r3", "rm -rf C:/b/p2/1.146.0-p1-a1-r3/x",
            "rm -rf C:/b/dist/1.146.0-p2-all.zip", "rm -rf C:/b/dist/1.146.0-p2-all.ZIP", "rm -rf C:/b/dist/1.146.0-P2-ALL.Zip",
            "rm -rf C:/b/dist/1.146.0-P2-ALL.ZIP", "rm -rf C:/b/dist/1.146.0-p2-all.zip/",
            "rm -rf C:/b/dist/1.146.0-p1-a1-r3.zip", "rm -rf C:/b/dist/1.146.0-p1-a1-r3.ZIP",
            "rm -rf C:/b/p2/foo C:/b/p2/1.146.0-p2-all",           # 複数のパスに混ぜたもの
            "rm -rf C:/b/p2/1.146.0-p2-A-1 C:/b/p2/1.146.0-p2-all",
        ], KEEP)

    def test_keep_with_trailing_dots_and_streams(self):
        # 末尾の点や代替データストリームの形も止まる（理由は形の検査か残すもの）
        self.blocks([
            "rm -rf C:/b/p2/1.146.0-p2-all.", "rm -rf C:/b/p2/1.146.0-p2-all..", "rm -rf C:/b/p2/1.146.0-p2-all::$DATA",
            "rm -rf C:/b/p2/1.146.0-p2-all:x", "rm -rf C:/b/dist/1.146.0-p2-all.zip.", "rm -rf C:/b/dist/1.146.0-p2-all.zip..",
        ])

    def test_smoke_keep(self):
        for name in self.SMOKE_KEEP:
            with self.subTest(name=name):
                self.assertBlock(self.bash(MT, f"rm -rf C:/b/smoke/ext/{name}"), KEEP)
        self.blocks([
            "rm -rf C:/b/smoke/ext/1.146.0-P1-A1-R3",
            "rm -rf C:/b/smoke/ext/1.146.0-p1-a1-r3.MARKER.JSON",
            "rm -rf C:/b/smoke/ext/1.146.0-P2-ALL-1.MARKER.JSON",
            "rm -rf C:/b/smoke/ext/1.146.0-P2-ALL-2",
            "rm -rf c:/B/SMOKE/EXT/1.146.0-p2-all-1.marker.json",
            "rm -rf C:/b/smoke/ext/1.146.0-p1-a1-r3/",
            "rm -rf C:/b/smoke/ext/1.146.0-p1-a1-r3/sub",
            "rm -rf C:/b/smoke/ext/1.146.0-p2-all-2/sub",
            "rm -rf C:/b/smoke/ext/1.146.0-p2-all-4",                 # p2-all* はまだ無い名前も守る
            "rm -rf C:/b/smoke/ext/1.146.0-p2-all-4.marker.json",
            "rm -rf C:/b/smoke/ext/foo C:/b/smoke/ext/1.146.0-p2-all-3",
            "rm -rf C:/b/smoke/ext/1.146.0-p2-A-1 C:/b/smoke/ext/1.146.0-p2-all-3",
        ], KEEP)
        self.blocks(["rm -rf C:/b/smoke/ext/1.146.0-p1-a1-r3."])

    def test_smoke_others_pass(self):
        self.passes([f"rm -rf C:/b/smoke/ext/{name}" for name in self.SMOKE_OTHERS])
        self.passes([
            "rm -rf C:/b/smoke/ext/1.146.0-p2-A-1 C:/b/smoke/ext/1.146.0-p2-A-1.marker.json",
            # r3 はフォルダとマーカーの2行に分けたので、頭が同じだけの名前は守らない
            "rm -rf C:/b/smoke/ext/1.146.0-p1-a1-r3x",
            "rm -rf C:/b/smoke/ext/1.146.0-p1-a1-r3x.marker.json",
            "rm -rf C:/b/smoke/ext/1.146.0-p1-a1-r2",
            # * は空に一致しないので、p2-all* は 1.146.0-p2-all そのもの（今は無い）を守らない
            "rm -rf C:/b/smoke/ext/1.146.0-p2-all",
        ])

    def test_keep_star_does_not_match_empty(self):
        # delete_keep の * も空に一致しない。r3* の1行だけでは、フォルダそのもの（1.146.0-p1-a1-r3）を守れない
        # （ベーコンの再実測 bacon-tests/results-recheck-r3star.txt と同じ入力）。一時のプロジェクトで keep を組み替える
        with tempfile.TemporaryDirectory() as tmp:
            project = make_project(tmp)
            path, perms = permissions_of(project, MT)
            perms["delete_keep"] = [k for k in perms["delete_keep"] if "smoke/ext" not in k] + ["C:/b/smoke/ext/1.146.0-p1-a1-r3*"]
            path.write_text(json.dumps(perms, indent=2), encoding="utf-8")
            kw = {"ev": {"cwd": str(project)}, "run": {"project": project}}
            self.passes(["rm -rf C:/b/smoke/ext/1.146.0-p1-a1-r3"], **kw)
            self.blocks(["rm -rf C:/b/smoke/ext/1.146.0-p1-a1-r3.marker.json",
                         "rm -rf C:/b/smoke/ext/1.146.0-p1-a1-r3x"], KEEP, **kw)


class DeleteToolAndRmLineTest(DeleteCase):
    """削除は Bash ツールだけ。bash の行に rm を書くと、後ろのパスが確かめられない（permcheck が誤りにする理由）。"""

    def test_powershell_tool(self):
        # 今の蒙恬の tools に PowerShell は無い（checkTool で止まる）
        self.assertBlock(self.bash(MT, "rm -rf C:/b/p2/foo") | {"tool_name": "PowerShell"}, "定義の tools に無い")
        with tempfile.TemporaryDirectory() as tmp:
            project = make_project(tmp)
            definition = project / ".claude" / "agents" / f"{MT}.md"
            text = definition.read_text(encoding="utf-8").replace("tools: Read,", "tools: PowerShell, Read,", 1)
            definition.write_text(text, encoding="utf-8")
            for command in ("rm -rf C:/b/p2/foo", "rm -rf C:/b/dist/foo.zip"):
                with self.subTest(command=command):
                    ev = self.bash(MT, command, cwd=str(project))
                    self.assertPass(ev, project=project)
                    self.assertBlock(ev | {"tool_name": "PowerShell"}, "Bash ツールでだけ", project=project)

    def test_rm_line_in_bash_is_a_hole(self):
        # bash の行（前方一致）が先に一致すると checkDelete を通らない。permcheck は rm で始まる行を誤りにする
        # （PermcheckDeleteKeysTest.test_rm_bash_line_is_error）
        with tempfile.TemporaryDirectory() as tmp:
            project = make_project(tmp)
            path, perms = permissions_of(project, MT)
            perms["bash"] = perms["bash"] + ["rm -rf C:/b/p2/*"]
            path.write_text(json.dumps(perms, indent=2), encoding="utf-8")
            kw = {"ev": {"cwd": str(project)}, "run": {"project": project}}
            self.passes(["rm -rf C:/b/p2/x C:/b", "rm -rf C:/b/p2/1.146.0-p2-all"], **kw)
            self.blocks(["rm -rf C:/b/p2/x; rm -rf C:/b", "rm -rf C:/b/p2/x/../.."], **kw)


@unittest.skipUnless(sys.platform == "win32", "ジャンクションは Windows だけ")
class DeleteFilesystemTest(DeleteCase):
    """tempfile の下に作った場所で、ジャンクション・残すものの祖先・自己防護・秘密の場所を確かめる。"""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        import _winapi

        cls.tmp = os.path.realpath(tempfile.mkdtemp(prefix="ai-editor-hooks-del-"))
        cls.links = []
        cls.addClassCleanup(cls._cleanup)
        base = Path(cls.tmp)
        if not re.fullmatch(r"[A-Za-z]:/[A-Za-z0-9._@+=/-]+", fwd(base)):
            raise unittest.SkipTest(f"一時ディレクトリのパスに rm -rf の語で許さない文字がある: {base}")
        cls.b = b = fwd(base)
        for d in ("p2/keepme/sub", "p2/other/deep", "p2/real/inner", "outside/data", "dist"):
            (base / d).mkdir(parents=True, exist_ok=True)
        (base / "outside" / "precious.txt").write_text("x", encoding="utf-8")
        (base / "dist" / "keep.zip").write_text("", encoding="utf-8")
        (base / "dist" / "other.zip").write_text("", encoding="utf-8")
        cls.project = make_project(base / "projtmp")
        (cls.project / "docs").mkdir()
        links = {
            "p2/alias": "p2/keepme", "p2/ALIAS2": "p2/keepme", "p2/outer": "outside", "p2/toproj": "projtmp/proj",
            "p2/rootj": ".", "p2/up": "p2", "dist/z": "p2/keepme", "p2/other/inner": "p2/keepme",
            "p2/toclaude": "projtmp/proj/.claude",
        }
        for link, target in links.items():
            _winapi.CreateJunction(os.path.normpath(str(base / target)), os.path.normpath(str(base / link)))
            cls.links.append(base / link)
        path, perms = permissions_of(cls.project, MT)
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
                     f"rm -rf {b}/p2/nonexist", f"rm -rf {b}/p2/keepmeX"], **self.at(self.project))

    def test_keep_and_its_ancestors(self):
        b = self.b
        self.blocks([f"rm -rf {b}/p2/keepme", f"rm -rf {b}/p2/keepme/sub", f"rm -rf {b}/p2/keepme/sub/x",
                     f"rm -rf {b}/dist/keep.zip"], KEEP, **self.at(self.project))

    def test_junctions_pointing_into_keep(self):
        b = self.b
        self.blocks([f"rm -rf {b}/p2/alias", f"rm -rf {b}/p2/alias/sub", f"rm -rf {b}/p2/ALIAS2", f"rm -rf {b}/p2/alias2/sub",
                     f"rm -rf {b}/dist/z", f"rm -rf {b}/dist/z/sub"], KEEP, **self.at(self.project))

    def test_junctions_pointing_outside(self):
        b = self.b
        self.blocks([
            f"rm -rf {b}/p2/outer", f"rm -rf {b}/p2/outer/data", f"rm -rf {b}/p2/toproj", f"rm -rf {b}/p2/toproj/team",
            f"rm -rf {b}/p2/rootj", f"rm -rf {b}/p2/rootj/projtmp", f"rm -rf {b}/p2/up", f"rm -rf {b}/p2/up/keepme",
            f"rm -rf {b}/p2/toclaude", f"rm -rf {b}/p2/toclaude/agents",
        ], **self.at(self.project))

    def test_junction_itself_into_keep_is_blocked(self):
        # 消してよい名前の中にあるジャンクション（先は残すもの）を直接指すと、realpath が残すものなので止まる
        self.blocks([f"rm -rf {self.b}/p2/other/inner"], KEEP, **self.at(self.project))
        # 削除の場所そのものへのジャンクションの下にある、消してよい名前は通る
        self.passes([f"rm -rf {self.b}/p2/up/other"], **self.at(self.project))

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
        self.passes([f"rm -rf {self.b}/p2/real2"], **self.at(self.project))
        rm = shutil.which("rm")
        if rm is None:
            self.skipTest("rm が見つからない（Git Bash の rm の実地の確かめを省く）")
        self.assertTrue(str(target).startswith(self.tmp))
        subprocess.run([rm, "-rf", fwd(target)], check=True, timeout=60)
        self.assertFalse(target.exists())
        self.assertTrue((base / "outside" / "precious.txt").exists(), "rm がジャンクションの先を消した")


if __name__ == "__main__":
    unittest.main()
