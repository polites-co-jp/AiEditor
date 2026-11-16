"""pnpm の --dir の先と置き場所のオプション（フックの直し 3d）のテスト。2026-11-16。

- 3d: pnpm の --dir・-C（--dir=…・-C<値>・後ろに足した2つ目も）の先がプロジェクトの中（直下そのものは除く）なら、そこに
  package.json（ファイル）が要る（無い先も止める）。pnpm が上へたどり、直下の pnpm-lock.yaml・node_modules を書き換えるため。
- 3d の続き（N2）: 先（か置き場所のオプションの先）が直下かその中になりうるとき、2つ目の --dir・-C と、置き場所を変える
  オプション（--lockfile-dir・--modules-dir など。省略形・= 付き・大文字・_・--config.<キー>）を値を問わず止める。
- 3d の続き（N5）: pnpm・npx の後ろの語と tsc の後ろの語に、シェルが語を変える書き方（単一引用符の外の $、引用符の外の
  { } * ? [ ] ~）があれば止める。
- 判定は本物の permissions.json（v2-1）と本物のフックで、tmp/b の偽の木を持つ写しのプロジェクトを使う。実地の pnpm と
  Git Bash の展開の確かめ（PnpmDirSemanticsTest・PnpmLocationSemanticsTest・ExpandedArgvTest）は重いので、ここには
  入れず Team の tasks/2026-11-16-ai-editor-move-off-c-perms/perm-tests/ に残した（判定だけを取り込んだ）。
- 出典: 同じタスクの perm-tests/test_i_pnpm_dir.py（PnpmDirGuardTest）、test_m_round3.py（PnpmLocationGuardTest）、
  test_n_round4.py（ShellExpansionGuardTest）。案の段（final・stage2）の権限で確かめていた入力を、v2-1 の権限で確かめる。

実行: python -m unittest discover -s projects/ai-editor/team/hooks/tests
"""

import shutil
import tempfile
import unittest

from hookrun import BuildTreeTestCase, fwd, make_build_project

MT, CS, OE = "meng-tian", "cao-shen", "ooka-echizen"


class PnpmCase(BuildTreeTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # クラス専用の写し（package.json の無い作業ツリーなどを足すため。共用の写しは書き換えない）
        tmp = tempfile.mkdtemp(prefix="ai-editor-hooks-pnpm-")
        cls.addClassCleanup(shutil.rmtree, tmp, True)
        cls.project = make_build_project(tmp)
        cls.P = str(cls.project)
        cls.P_SLASH = fwd(cls.project)
        wt = cls.project / "tmp" / "b" / "wt"
        (wt / "nopkg").mkdir()
        (wt / "dirpkg" / "package.json").mkdir(parents=True)  # package.json という名前のフォルダ（ファイルではない）
        (cls.project / "extensions-src" / "nopkg").mkdir()

    def passes(self, pairs):
        for member, command in pairs:
            with self.subTest(member=member, command=command):
                self.assertPass(self.bash(member, command))

    def blocks(self, pairs, contains=None):
        errs = []
        for member, command in pairs:
            with self.subTest(member=member, command=command):
                errs.append(self.assertBlock(self.bash(member, command), contains))
        return errs


class PnpmDirGuardTest(PnpmCase):
    """3d（2回目の改訂 F1）: --dir の先の package.json。"""

    def test_blocks_dir_without_package_json(self):
        self.blocks([
            (MT, "pnpm --dir tmp/b/wt/nopkg install"),
            (MT, "pnpm --dir tmp/b/wt/nopkg run gulp"),
            (MT, "pnpm --dir tmp/b/wt/nopkg run compile"),
            (MT, "pnpm --dir tmp/b/wt/plain install"),           # 作業ツリーでないフォルダ
            (MT, "pnpm --dir tmp/b/wt/nonexistent install"),     # 無い先（止める側に倒す）
            (MT, "pnpm --dir tmp/b/wt/w1 install --dir tmp/b/wt/nopkg"),   # 後ろに足した2つ目の --dir
            (MT, "pnpm --dir tmp/b/wt/w1 install -C tmp/b/wt/nopkg"),
            (MT, "pnpm --dir tmp/b/wt/w1 install --dir=tmp/b/wt/nopkg"),
            (MT, "pnpm --dir extensions-src/nopkg install"),
            (MT, "pnpm --dir tmp/b/wt/dirpkg install"),
            (MT, "pnpm --dir tmp/b/wt/w1 install -Ctmp/b/wt/nopkg"),
            (CS, "pnpm --dir tmp/b/wt/nopkg run smoketest"),
            (OE, "pnpm --dir tmp/b/wt/nopkg run smoketest"),
            (OE, "pnpm --dir tmp/b/wt/nopkg install --lockfile-only --ignore-scripts"),
            (MT, "pnpm --dir tmp/b/wt/nonexistent run gulp"),
        ], "package.json")

    def test_passes_use_forms(self):
        self.passes([
            (MT, "pnpm --dir tmp/b/wt/w1 install"),
            (MT, "pnpm --dir tmp/b/wt/p2 run gulp"),
            (MT, "pnpm --dir tmp/b/wt/p2 run compile"),
            (MT, "pnpm --dir tmp/b/wt/p2 run smoketest"),
            (MT, "pnpm --dir extensions-src/mydist install"),
            (MT, "pnpm --dir extensions-src/mydist run build"),
            (CS, "pnpm --dir tmp/b/wt/p2 run smoketest"),
            (OE, "pnpm --dir tmp/b/wt/p2 run smoketest"),
            (OE, "pnpm --dir tmp/b/wt/p2 install --lockfile-only --ignore-scripts"),
        ])

    def test_npx_prefix_is_not_checked(self):
        # npx --prefix は 3d の対象外（npx は cwd の node_modules/.bin を使い、--prefix の先を見ない。F8・R5）
        self.passes([(MT, "npx --prefix tmp/b/wt/nopkg tsc --noEmit"), (OE, "npx --prefix tmp/b/wt/nopkg tsc --noEmit")])

    def test_root_and_reason_order(self):
        # 直下そのものは 3d の対象外（許可の照合で止まる）。exec・dlx の理由が先に出る
        err = self.assertBlock(self.bash(MT, "pnpm --dir extensions-src/.. install"), "ホワイトリストに無い")
        self.assertNotIn("package.json", err)
        self.assertBlock(self.bash(MT, "pnpm --dir extensions-src/x dlx cowsay"), "dlx")


class PnpmLocationGuardTest(PnpmCase):
    """3d の続き（3回目の改訂 N2）: 2つ目の --dir・-C と置き場所を変えるオプション。"""

    W = "pnpm --dir tmp/b/wt/w1 install --ignore-scripts"
    BLOCK = [
        # ベーコンの再現（実地で直下に lock と node_modules ができた3形）
        f"{W} --dir .", f"{W} --dir ./", f"{W} --lockfile-dir ../../../..",
        # 2つ目の --dir・-C（先が直下・外・作業ツリーのどれでも）
        f"{W} --dir=.", f"{W} -C .", f"{W} -C.", f"{W} --di .", f"{W} --dir ..", f"{W} --dir ../../../../..",
        f"{W} --dir tmp/b/wt/p2", f"{W} --dir C:/Users", "pnpm --dir tmp/b/wt/w1 run gulp --dir .",
        "pnpm --dir tmp/b/wt/w1 run gulp -- --dir .",
        # 置き場所を変えるオプション（= 付き・省略形・大文字・_・--config.<キー>）
        f"{W} --lockfile-dir=../../../..", f"{W} --lockfile-dir C:/x", f"{W} --lockfile-d ../../../..",
        f"{W} --lockfile ../../../..", f"{W} --LOCKFILE-DIR=../../../..", f"{W} --lockfile_dir=../../../..",
        f"{W} --modules-dir ../../../../node_modules", f"{W} --virtual-store-dir ../../../../.pnpm",
        f"{W} --store-dir ../../../../store", f"{W} --global-dir ../../../../g", f"{W} --global-bin-dir x",
        f"{W} --cache-dir x", f"{W} --state-dir x", f"{W} --workspace-dir .", f"{W} --prefix .", f"{W} --global",
        f"{W} --config.lockfile-dir=../../../..", f"{W} --config.modules-dir ../../../..",
        f"{W} --lockfile-dir {{abs}}",
    ]

    def test_blocks_second_dir_and_location_options(self):
        self.blocks([(MT, c.replace("{abs}", self.P_SLASH)) for c in self.BLOCK], "pnpm")
        # 大岡越前守の bash_exact の行の後ろに足した形も止まる（もともと bash_exact で止まる）
        self.blocks([(OE, f"pnpm --dir tmp/b/wt/p2 install --lockfile-only --ignore-scripts {extra}")
                     for extra in ("--dir .", "--lockfile-dir ../../../..")])
        self.assertBlock(self.bash(CS, "pnpm --dir tmp/b/wt/p2 run smoketest --dir ."), "2つ以上")
        self.assertBlock(self.bash(CS, "pnpm --dir tmp/b/wt/p2 run smoketest --lockfile-dir=../../../.."), "置き場所")

    def test_use_forms_pass(self):
        self.passes([
            (MT, "pnpm --dir tmp/b/wt/w1 install"), (MT, "pnpm --dir tmp/b/wt/p2 install --ignore-scripts"),
            (MT, "pnpm --dir tmp/b/wt/p2 run gulp"), (MT, "pnpm --dir tmp/b/wt/p2 run compile"),
            (MT, "pnpm --dir tmp/b/wt/p2 run smoketest"), (MT, "pnpm --dir extensions-src/mydist install"),
            (MT, "pnpm --dir tmp/b/wt/p2 install --frozen-lockfile"), (MT, "pnpm --dir tmp/b/wt/p2 install --lockfile-only"),
            (CS, "pnpm --dir tmp/b/wt/p2 run smoketest"), (OE, "pnpm --dir tmp/b/wt/p2 run smoketest"),
            (OE, "pnpm --dir tmp/b/wt/p2 install --lockfile-only --ignore-scripts"),
        ])


UP = "../../../.."
B = "pnpm --dir tmp/b/wt/withpkg install --ignore-scripts"
# ベーコンの21形（verification-bacon.md の「再検証（3回目）」の N5。実地で直下に lock と node_modules ができた形）
BACON_21 = [
    f"{B} $'--dir' .", f"{B} $'--lockfile-dir' {UP}", f"{B} $'-C' .", f"{B} -$'C' .", f"{B} --$'dir' .",
    f"{B} $'\\x2d\\x2ddir' .", f"{B} $'\\055\\055dir' .", f"{B} $'--dir=.'", f"{B} $'--dir'=.",
    f"{B} $\"--dir\" .", f"{B} $\"--lockfile-dir\" {UP}",
    f"{B} {{--dir,.}}", f"{B} {{--lockfile-dir,{UP}}}",
    f"{B} --dir$UNSET_X .", f"{B} --dir${{UNSET_X}} .", f"{B} --lockfile-dir$UNSET_X {UP}", f"{B} --${{UNSET_X}}dir .",
    f"{B} $UNSET_X--dir .", f"{B} --dir$IFS.", f"{B} --lockfile-dir$IFS{UP}", f"{B} --dir${{IFS}}.",
]
BACON_OTHER = [
    f"{B} --dir=$'.'", f"{B} --lockfile-dir=$'..'", f"{B} --lockfile-dir={{{UP},x}}", f"{B} -{{C,C}} .", f"{B} --di{{r,r}} .",
    f"{B} -C$UNSET_X .", f"{B} -C$IFS.", f"{B} --dir=${{UNSET_X:-.}}", f"{B} --dir ${{UNSET_X:-.}}", f"{B} --dir ${{HOME:0:0}}.",
    f"{B} --dir $(echo .)", f"{B} --dir `echo .`", f"{B} --dir <(echo .)", f"{B} --dir \"$(echo .)\"",
    f"{B} --dir \\.", f"{B} --dir ./\\.", f"{B} -\\C .", f"{B} \\-\\-dir .",
]
# シェルが引用符・\ を外した後にオプション名になる書き方（3d が外した後の語で照らす）
SAME_CLASS = [
    f"{B} --'dir' .", f"{B} \"--di\"r .", f"{B} --\\dir .", f"{B} -'C' .", f"{B} '-C' .", f"{B} \"-C\" .",
    f"{B} '--dir' .", f"{B} --d'i'r=.", f"{B} --dir\\=.", f"{B} --lock''file-dir {UP}", f"{B} \"--lockfile-dir\" {UP}",
    f"{B} --lockfile-di\\r {UP}", f"{B} --lockfile\\-dir {UP}", f"{B} --di\"r=.\"", f"{B} \"--dir=.\"", f"{B} '--dir=.'",
    f"{B} '--lockfile-dir={UP}'", f"{B} --'config.lockfile-dir'={UP}", f"{B} -- '--dir' .",
]
GLOB_TILDE = [
    f"{B} --d?r .", f"{B} --di[r] .", f"{B} --di* .", f"{B} -[C] .", f"{B} -? .", f"{B} --dir ~", f"{B} --lockfile-dir ~",
    f"{B} --lockfile-dir=~/x", f"{B} ~/x", f"{B} {{}}", f"{B} --dir{{}} .",
]
T = "npx --prefix tmp/b/wt/p2 tsc --noEmit"
TSC_FORMS = [
    (MT, f"{T} $'--outDir' x"), (MT, f"{T} --out$'Dir' x"), (MT, f"{T} {{--outDir,x}}"), (MT, f"{T} --outDir$UNSET_X x"),
    (MT, f"{T} --outDir$IFS x"), (MT, f"{T} $\"--outDir\" x"), (MT, f"{T} --out{{Dir,Dir}} x"), (MT, f"{T} --outD?r x"),
    (OE, f"{T} $'--outDir' x"), (OE, f"{T} {{--outDir,x}}"),
]
TSC_DIRECT = [  # tsc がコマンドの位置でないところ（node の台本の引数）に現れる形。tsc の検査が止める
    (MT, "node scripts/x.mjs tsc $'--outDir' x"), (MT, "node scripts/x.mjs tsc {--outDir,x}"),
    (MT, "node scripts/x.mjs tsc --outDir$UNSET_X x"),
]
USE_FORMS = [
    (MT, "pnpm --dir tmp/b/wt/p2 install"), (MT, "pnpm --dir tmp/b/wt/p2 install --ignore-scripts"),
    (MT, "pnpm --dir tmp/b/wt/p2 install --frozen-lockfile --offline"), (MT, "pnpm --dir tmp/b/wt/p2 install --frozen-lockfile"),
    (MT, "pnpm --dir tmp/b/wt/p2 install --lockfile-only"), (MT, "pnpm --dir tmp/b/wt/p2 install --filter outer"),
    (MT, "pnpm --dir tmp/b/wt/p2 install -r"), (MT, "pnpm --dir tmp/b/wt/w1 install"),
    (MT, "pnpm --dir tmp/b/wt/p2 run gulp"), (MT, "pnpm --dir tmp/b/wt/p2 run gulp compile-build"),
    (MT, "pnpm --dir tmp/b/wt/p2 run compile"), (MT, "pnpm --dir tmp/b/wt/p2 run smoketest"),
    (MT, "pnpm --dir tmp/b/wt/p2 run smoketest -- --grep foo"), (MT, "pnpm --dir tmp/b/wt/1.146.0 run smoketest"),
    (MT, "pnpm --dir extensions-src/mydist install"), (MT, "pnpm --dir extensions-src/mydist run build"),
    (MT, "npx --prefix tmp/b/wt/p2 tsc --noEmit"), (MT, "npx ovsx verify-signature x.vsix"),
    (CS, "pnpm --dir tmp/b/wt/p2 run smoketest"), (CS, "pnpm --dir extensions-src/mydist run test"),
    (OE, "pnpm --dir tmp/b/wt/p2 run smoketest"), (OE, "pnpm --dir tmp/b/wt/p2 install --lockfile-only --ignore-scripts"),
    (OE, "npx --prefix tmp/b/wt/p2 tsc --noEmit"), (OE, "pnpm --dir extensions-src/mydist run test"),
]
QUOTED_SAFE = [  # 引用符の中の * { } $ は、シェルが変えない（止めない）
    (MT, "pnpm --dir tmp/b/wt/p2 run smoketest -- --grep 'a*b'"),
    (MT, "pnpm --dir tmp/b/wt/p2 run smoketest -- --grep \"foo bar\""),
    (MT, "pnpm --dir tmp/b/wt/p2 run gulp 'x{a,b}'"),
    (MT, "pnpm --dir tmp/b/wt/p2 run smoketest -- --grep '$HOME'"),
]


class ShellExpansionGuardTest(PnpmCase):
    """3d の続き（4回目の改訂 N5）: シェルが語を変える書き方。"""

    def test_bacon_21_are_blocked(self):
        self.blocks([(MT, c) for c in BACON_21], "シェルが語を変える書き方")

    def test_bacon_other_shell_forms_stay_blocked(self):
        self.blocks([(MT, c) for c in BACON_OTHER])

    def test_same_class_quote_and_escape_are_blocked(self):
        # 引用符の連結・\ は展開ではない。シェルが外した後の語が --dir・-C・--lockfile-dir になり、3d が止める
        for err in self.blocks([(MT, c) for c in SAME_CLASS], "pnpm"):
            if err is not None:
                self.assertTrue("2つ以上" in err or "置き場所" in err, err)

    def test_glob_and_tilde_are_blocked(self):
        self.blocks([(MT, c) for c in GLOB_TILDE])

    def test_tsc_forms_are_blocked(self):
        self.blocks(TSC_FORMS, "シェルが語を変える書き方")
        self.blocks(TSC_DIRECT, "tsc の語")
        self.assertBlock(self.bash(MT, f"{T} --outDir=x"), "tsc")  # = 付きの --outDir は書き込み先と照らす（前から）

    def test_other_members_lines_with_shell_forms_are_blocked(self):
        self.blocks([(MT, "pnpm --dir tmp/b/wt/p2 run gulp $'--dir' ."),
                     (OE, "pnpm --dir tmp/b/wt/p2 install --lockfile-only --ignore-scripts $'--dir' ."),
                     (CS, "pnpm --dir tmp/b/wt/p2 run smoketest $'--dir' ."),
                     (CS, "pnpm --dir tmp/b/wt/p2 run smoketest --dir$UNSET_X ."),
                     (CS, "pnpm --dir extensions-src/mydist run test {--dir,.}")])

    def test_use_forms_pass(self):
        self.passes(USE_FORMS + QUOTED_SAFE)

    def test_overblocking_unquoted_glob_chars(self):
        # 止めすぎ（4回目の改訂の記録）: 引用符の外の * は、シェルが変えない形でも止まる。引用符で囲めば通る
        self.assertBlock(self.bash(MT, "pnpm --dir tmp/b/wt/p2 run smoketest -- --grep a*b"), "シェルが語を変える書き方")
        self.assertPass(self.bash(MT, "pnpm --dir tmp/b/wt/p2 run smoketest -- --grep 'a*b'"))


if __name__ == "__main__":
    unittest.main()
