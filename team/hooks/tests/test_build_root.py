"""ビルドの置き場所 tmp/b（v2-1）の Bash の判定と、git -C の先の .git（フックの直し 3c）のテスト。2026-11-16。

- 判定は本物の permissions.json（v2-1。蒙恬・曹参・大岡越前守の tmp/b の行）と本物のフックで行う。tmp/b の偽の木を
  持つ写しのプロジェクト（hookrun.build_project）を CLAUDE_PROJECT_DIR にする。本物の tmp/b・C:/b・clone には触れない。
- 3c: git -C の先がプロジェクトの中（直下そのものは除く）なら、そこに .git が要る。.git がディレクトリなら HEAD（バイトの
  まま ref: refs/<空白を含まない ASCII> か 40・64桁の小文字の16進。末尾は改行1つまで）・objects/・refs/ がそろうこと。
  本物の git は tempfile の下の使い捨てのリポジトリだけで使う（ネットに出ない。clone も手元の使い捨ての元から）。
- 出典: Team の tasks/2026-11-16-ai-editor-move-off-c-perms/perm-tests/ の test_b_bash_paths.py（UseCommandsTest・
  PathFormsTest・GitWorkdirGuardTest・RelativeWorkdirTest）、test_k_git_round2.py（GitMarkerTest）、test_m_round3.py
  （GitHeadFormTest・RealGitShapesTest）、test_o_round5.py（V2StagesHookTest の wt-r2）。案の段（final・v2-3 など）の
  権限で確かめていた入力を、本物の v2-1 の権限で確かめる形にした（ずっと使う tmp/b の行は v2-1〜v2-3 で同じ）。

実行: python -m unittest discover -s projects/ai-editor/team/hooks/tests
"""

import os
import shutil
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path

from hookrun import GIT, BuildTreeTestCase, make_build_project, make_git_dir, run

MT, CS, OE = "meng-tian", "cao-shen", "ooka-echizen"

USE = {
    MT: [
        "git -C tmp/b/vscode fetch --tags",
        # v2-1b（2026-11-17）: -C の先からの相対 ../wt/* に直った（v2-1 の tmp/b/wt/… は clone の中を指した）
        "git -C tmp/b/vscode worktree add ../wt/1.147.0 1.147.0",
        "git -C tmp/b/vscode worktree remove ../wt/1.146.0",
        "git -C tmp/b/vscode worktree prune",
        "git -C tmp/b/vscode worktree prune -v",                 # prune は前方一致のまま（後ろの語で消える物は増えない。4.5）
        "git -C tmp/b/vscode tag --list",
        "git -C tmp/b/wt/1.146.0 status --porcelain",
        "git -C tmp/b/wt/1.146.0 diff HEAD~1",
        "git -C tmp/b/wt/1.146.0 apply --check x.patch",
        "git -C tmp/b/wt/1.146.0 am -3 x.patch",
        "git -C tmp/b/wt/1.146.0 am --abort",
        "git -C tmp/b/wt/1.146.0 am --continue",
        "git -C tmp/b/wt/1.146.0 format-patch --stdout HEAD~1",
        "git -C tmp/b/wt/1.146.0 format-patch -o out HEAD~1",
        "git -C tmp/b/wt/1.146.0 checkout 1.146.0",
        "git -C tmp/b/wt/1.146.0 clean -xfd",
        "git -C tmp/b/wt/1.146.0 rerere",
        "git -C tmp/b/wt/1.146.0 add -A",
        "git -C tmp/b/wt/1.146.0 commit -m x",
        "git clone https://github.com/microsoft/vscode.git tmp/b/vscode",
        "pnpm --dir tmp/b/wt/1.146.0 install",
        "pnpm --dir tmp/b/wt/1.146.0 run gulp",
        "pnpm --dir tmp/b/wt/1.146.0 run compile",
        "pnpm --dir tmp/b/wt/1.146.0 run smoketest",
        "npx --prefix tmp/b/wt/1.146.0 tsc --noEmit",
        "node scripts/move-build-root.mjs --from C:/b --dry-run --out tasks/2026-11-17-move-off-c-run/move-plan.json",
    ],
    CS: ["pnpm --dir tmp/b/wt/1.146.0 run smoketest"],
    OE: [
        "pnpm --dir tmp/b/wt/1.146.0 run smoketest",
        "npx --prefix tmp/b/wt/1.146.0 tsc --noEmit",
        "git -C tmp/b/wt/1.146.0 status",
        "git -C tmp/b/wt/1.146.0 diff",
        "git -C tmp/b/wt/1.146.0 checkout 1.147.0",
        "git -C tmp/b/wt/1.146.0 checkout -- pnpm-lock.yaml",
        "pnpm --dir tmp/b/wt/1.146.0 install --lockfile-only --ignore-scripts",
    ],
}


def git(*args, cwd=None, check=True):
    """本物の git（tempfile の下だけ）。利用者の設定を読まない。"""
    env = dict(os.environ, GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM="1", GIT_TERMINAL_PROMPT="0",
               GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@example.invalid", GIT_COMMITTER_NAME="t",
               GIT_COMMITTER_EMAIL="t@example.invalid", GIT_EDITOR="true")
    r = subprocess.run([GIT, *args], cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                       env=env, timeout=120)
    if check and r.returncode != 0:
        raise AssertionError(f"git {' '.join(args)} が失敗した: {r.stderr}")
    return r


def rmtree_force(path):
    """git の objects の読み取り専用のファイルも消す（tempfile の下だけに使う）。"""
    def onexc(func, p, _exc):
        try:
            os.chmod(p, stat.S_IWRITE)
            func(p)
        except OSError:
            pass
    shutil.rmtree(path, onexc=onexc)


def own_build_project(cls, prefix):
    """クラス専用の、書き換えてよい写しのプロジェクト（tmp/b の偽の木つき）。クラスの終わりに消す。"""
    tmp = tempfile.mkdtemp(prefix=prefix)
    cls.addClassCleanup(rmtree_force, tmp)
    return make_build_project(tmp)


def make_outer_repo(p):
    """写しのプロジェクトそのものを git のリポジトリにする（tmp/ は .gitignore）。docs/a.md をコミットしておく。"""
    (p / ".gitignore").write_text("tmp/\n", encoding="utf-8")
    (p / "docs").mkdir(exist_ok=True)
    (p / "docs" / "a.md").write_text("x", encoding="utf-8")
    git("init", "-q", "-b", "main", str(p))
    git("-C", str(p), "add", "-A")
    git("-C", str(p), "commit", "-q", "-m", "base")
    return Path(git("-C", str(p), "rev-parse", "--show-toplevel").stdout.strip()).resolve()


class BuildRootCase(BuildTreeTestCase):
    def passes(self, member, commands, **kw):
        for command in commands:
            with self.subTest(member=member, command=command):
                self.assertPass(self.bash(member, command, **kw.get("ev", {})), **kw.get("run", {}))

    def blocks(self, member, commands, contains=None, **kw):
        for command in commands:
            with self.subTest(member=member, command=command):
                self.assertBlock(self.bash(member, command, **kw.get("ev", {})), contains, **kw.get("run", {}))

    def at(self, project):
        return {"ev": {"cwd": str(project)}, "run": {"project": project}}


class UseCommandsTest(BuildRootCase):
    """依頼の用途のコマンド（3人）が、v2-1 の本物の権限で通る（tmp/b のずっと使う行。v2-2・v2-3 でも同じ行）。"""

    def test_use_commands_pass(self):
        for member, commands in USE.items():
            self.passes(member, commands)

    def test_remove_is_exact(self):
        # worktree remove は bash_exact（後ろに --force・-f を足せない。4.2）。v2-1b（2026-11-17）で ../wt/* の形に直した
        # （v2-1 の tmp/b/wt/… の形は行そのものに一致しないので、--force を足しても足さなくても止まり、確かめにならない）
        self.blocks(MT, ["git -C tmp/b/vscode worktree remove ../wt/1.146.0 --force",
                         "git -C tmp/b/vscode worktree remove --force ../wt/1.146.0",
                         "git -C tmp/b/vscode worktree remove ../wt/1.146.0 -f",
                         "git -C tmp/b/vscode worktree remove -f ../wt/1.146.0"])
        # 一度だけの行（v2-1b〜v2-2）も完全一致で、後ろ・前に足せない。【v2-3 を当てたときに直す】行が外れるので、
        # この3形は落ちないが確かめの意味が無くなる。このループを外す（行そのものが止まることは WtR2OutsideRowsTest が見る）
        for line in ("git -C tmp/b/vscode worktree remove ./tmp/b/wt/c1fix",
                     "git -C tmp/b/vscode worktree remove ../wt-r2/1.146.0"):
            self.blocks(MT, [line + " --force", line + " -f", line.replace("remove ", "remove --force ")])


class PathFormsTest(BuildRootCase):
    """書き方の違い・.. は止まる（許可は書かれた形の文字で照らす）。"""

    def test_other_spellings_are_blocked(self):
        for command in (
            "git -C ./tmp/b/wt/1.146.0 status",
            f"git -C {self.P_SLASH}/tmp/b/wt/1.146.0 status",
            "git -C tmp\\b\\wt\\1.146.0 status",
            "git -C tmp\\\\b\\\\wt\\\\1.146.0 status",
            "git -C TMP/B/wt/1.146.0 status",
            "git -C tmp/B/wt/1.146.0 status",
            "git -C Tmp/b/WT/1.146.0 status",
            "pnpm --dir ./tmp/b/wt/1.146.0 run smoketest",
            f"pnpm --dir {self.P_SLASH}/tmp/b/wt/1.146.0 run smoketest",
            "pnpm --dir TMP/B/WT/1.146.0 run smoketest",
            "npx --prefix tmp\\b\\wt\\1.146.0 tsc --noEmit",
        ):
            for member in (MT, OE):
                with self.subTest(member=member, command=command):
                    self.assertBlock(self.bash(member, command))

    def test_dotdot_escapes_are_blocked(self):
        for command in (
            "git -C tmp/b/wt/.. status",
            "git -C tmp/b/wt/../../.. status",
            "git -C tmp/b/wt/x/../../../.claude status",
            "git -C tmp/b/wt/1.146.0/../../../.. checkout -- .",
            "git -C tmp/b/wt/1.146.0/.. clean -xfd",
            "pnpm --dir tmp/b/wt/../../.. run smoketest",
            "pnpm --dir tmp/b/wt/1.146.0/../../../../extensions-src/x install",
            "npx --prefix tmp/b/wt/.. tsc --noEmit",
            "git -C tmp/b/wt/... status",
            "git -C tmp/b/wt/1.146.0. status",
        ):
            for member in (MT, CS, OE):
                with self.subTest(member=member, command=command):
                    self.assertBlock(self.bash(member, command))


class WtR2OutsideRowsTest(BuildRootCase):
    """tmp/b/wt-r2 は tmp/b/wt/* の外（* は1区切り）。だれも直接の git・pnpm・npx を打てない（R19・U9）。
    v2-1b（2026-11-17）から v2-2 までは、蒙恬の一度だけの片づけの行（名指しの worktree remove と、フォルダごとの rm -rf）
    だけが通る（Team の tasks/2026-11-16-ai-editor-perm-requests-2 の perm-proposal.md 7.1節）。"""

    # 片づけで外す古い作業ツリーのフォルダ（v2-1b〜v2-2 の一度だけの行）
    OLD_WT_DIRS = ("wt-r2", "wt-r3", "wt-r3b", "wt-r3c")

    def test_wt_r2_blocked(self):
        for member, command in (
            (MT, "git -C tmp/b/wt-r2/1.146.0 status"), (MT, "pnpm --dir tmp/b/wt-r2/1.146.0 install"),
            (MT, "git -C tmp/b/vscode worktree remove tmp/b/wt-r2/1.146.0"),   # v2-1 の書き方（一度だけの行は ../wt-r2/…）
            (MT, "git -C tmp/b/vscode worktree add tmp/b/wt-r2/x 1.146.0"),
            (MT, "git -C tmp/b/vscode worktree add ../wt-r2/x 1.146.0"),      # add は ../wt/* だけ
            (OE, "git -C tmp/b/wt-r2/1.146.0 status"), (OE, "git -C tmp/b/wt-r2/1.146.0 checkout -- pnpm-lock.yaml"),
            (CS, "pnpm --dir tmp/b/wt-r2/1.146.0 run smoketest"),
            # v2-1b（2026-11-17）: 「rm -rf tmp/b/wt-r2」は一度だけの片づけで v2-2 まで通るので、test_one_time_cleanup_until_v2_2
            # へ移した。【v2-3 を当てたときに直す】(MT, "rm -rf tmp/b/wt-r2") をここへ戻す
        ):
            with self.subTest(member=member, command=command):
                self.assertBlock(self.bash(member, command))

    def test_one_time_cleanup_until_v2_2(self):
        """一度だけの片づけ（v2-1b〜v2-2）。名指しの remove の5行と、4つのフォルダの rm -rf が蒙恬だけに通る。
        【v2-3 を当てたときに直す】行が外れるので、passes を blocks に変える（test_one_time_cleanup_variants_blocked は
        そのまま使える）。"""
        removes = ["git -C tmp/b/vscode worktree remove ./tmp/b/wt/c1fix"] + [
            f"git -C tmp/b/vscode worktree remove ../{d}/1.146.0" for d in self.OLD_WT_DIRS]
        deletes = [f"rm -rf tmp/b/{d}" for d in self.OLD_WT_DIRS] + ["rm -rf tmp/b/wt-r2/1.146.0"]
        self.passes(MT, removes + deletes)
        for member in (CS, OE, "di-renjie"):
            self.blocks(member, removes + deletes)

    def test_one_time_cleanup_variants_blocked(self):
        """一度だけの行に似た形は、どの段でも止まる。"""
        self.blocks(MT, [
            # remove: 似た名前・上る形・広げた形・書き方の違い
            "git -C tmp/b/vscode worktree remove ../wt-r2/1.146.1", "git -C tmp/b/vscode worktree remove ../wt-r2/x",
            "git -C tmp/b/vscode worktree remove ../wt-r4/1.146.0", "git -C tmp/b/vscode worktree remove ../wt-r2",
            "git -C tmp/b/vscode worktree remove ../wt-r2/1.146.0/..", "git -C tmp/b/vscode worktree remove ../wt-r2/../wt/x",
            "git -C tmp/b/vscode worktree remove ./tmp/b/wt/c1fix2", "git -C tmp/b/vscode worktree remove ./tmp/b/wt/x",
            "git -C tmp/b/vscode worktree remove tmp/b/wt/c1fix", "git -C tmp/b/vscode worktree remove .\\tmp\\b\\wt\\c1fix",
            "git -C tmp/b/vscode worktree remove ../WT-R2/1.146.0", "git -C tmp/b/vscode worktree remove ..\\wt-r2\\1.146.0",
            # rm -rf: 似た名前・祖先・別のフォルダ（tmp/b/wt と、その下の c1fix は消せない）
            "rm -rf tmp/b/wt-r", "rm -rf tmp/b/wt-r2x", "rm -rf tmp/b/wt-r2x/y", "rm -rf tmp/b/wt-r4", "rm -rf tmp/b/wt",
            "rm -rf tmp/b/wt/c1fix", "rm -rf tmp/b/vscode", "rm -rf tmp/b/vscode/tmp", "rm -rf tmp/b/wt-r2/..",
            "rm -rf tmp/b/wt-r2/../wt", "rm -rf ./tmp/b/wt-r2", "rm -rf tmp/b/wt-r*",
        ])


class GitWorkdirGuardTest(BuildRootCase):
    """3c: 作業ツリーでないフォルダ（.git が無い）を git -C で指すと、git は上へたどりこのプロジェクトのリポジトリで動く。
    今の権限の行の形のまま通る入力なので、フックの固定の検査で止める。"""

    HOLE = [
        (MT, "git -C tmp/b/wt/plain checkout -- ../../../.."),
        (MT, "git -C tmp/b/wt/plain commit -m x"),
        (MT, "git -C tmp/b/wt/VSCode-win32-x64 clean -xfd"),
        (MT, "git -C tmp/b/wt/plain am -3 x.patch"),
        (MT, "git -C tmp/b/wt/plain add -A"),
        (OE, "git -C tmp/b/wt/plain checkout -- pnpm-lock.yaml"),
        (OE, "git -C tmp/b/wt/plain checkout 1.146.0"),
        (OE, "git -C tmp/b/wt/plain status"),
        (MT, "git -C tmp/b/wt/not-there status"),
        (MT, "git -C tmp/b/vscode/src status"),
    ]

    def test_hole_is_blocked(self):
        for member, command in self.HOLE:
            with self.subTest(member=member, command=command):
                self.assertBlock(self.bash(member, command), ".git が無い")

    def test_repos_and_root_pass(self):
        self.passes(MT, ["git -C tmp/b/wt/w1 status", "git -C tmp/b/vscode tag --list", "git status", "git diff"])


class RelativeWorkdirTest(BuildRootCase):
    """git -C の相対の値は cwd から解く（git と同じ）。format-patch の書き出し先の照合もそこを起点にする。"""

    def test_format_patch_output_resolves_from_relative_c(self):
        self.assertPass(self.bash(MT, "git -C tmp/b/wt/1.146.0 format-patch -o out HEAD~1"))
        self.assertPass(self.bash(MT, "git -C tmp/b/wt/1.146.0 format-patch -o ../../../../tasks/x HEAD~1"))
        self.assertBlock(self.bash(MT, "git -C tmp/b/wt/1.146.0 format-patch -o ../../../../.claude HEAD~1"), ".claude/")
        self.assertBlock(self.bash(MT, "git -C tmp/b/wt/1.146.0 format-patch -o ../../../../docs HEAD~1"), "許可していない")
        self.assertBlock(self.bash(MT, "git -C tmp/b/wt/1.146.0 format-patch -o ../../../../team/hooks HEAD~1"))
        self.assertBlock(self.bash(MT, "git -C tmp/b/wt/1.146.0 format-patch -o ../../vscode/.git HEAD~1"), ".git")

    def test_cwd_inside_project_but_not_root(self):
        docs = str(self.project / "docs")
        # cwd が docs/ なら、git の -C tmp/b/wt/1.146.0 は docs/tmp/b/wt/1.146.0（.git が無い）を指す。3c で止まる
        self.assertBlock(self.bash(MT, "git -C tmp/b/wt/1.146.0 status", cwd=docs), ".git が無い")
        self.assertBlock(self.bash(MT, "rm -rf tmp/b/p2/other", cwd=docs), "作業ディレクトリがプロジェクト直下")

    def test_cwd_outside_project_format_patch(self):
        outside = str(self.project.parent)  # tempfile の下の、プロジェクトの外
        # 書き出し先は outside を起点に解くので、書き込み先の外として止まる
        self.assertBlock(self.bash(MT, "git -C tmp/b/wt/1.146.0 format-patch -o out HEAD~1", cwd=outside), "許可していない")

    @unittest.expectedFailure
    def test_known_hole_r4_cwd_outside_project(self):
        # 既知の穴 R4（perm-proposal.md 8節）: cwd がプロジェクトの外にあると、相対の tmp/b/... は文字の照合で通り、
        # git は <cwd>/tmp/b/... を指す（メンバーは cd の許可を持たず、cwd は直下から動かない見込み）。守りの期待
        # （止まる）のまま、今は通るので落ちる。塞いだら expectedFailure を外す
        self.assertBlock(self.bash(MT, "git -C tmp/b/wt/1.146.0 status", cwd=str(self.project.parent)))


@unittest.skipUnless(GIT, "git が見つからない")
class GitMarkerTest(BuildRootCase):
    """3c の .git の中身（2回目の改訂 F3）。写しのプロジェクトそのものを git のリポジトリにし、tmp/b/wt の下にいろいろな
    .git を置く。git が外側へたどる形は全部止まり、最低限の .git と .git ファイルは通ることを、同じ場所の本物の git の
    --show-toplevel と突き合わせて確かめる。"""

    VARIANTS = {
        "empty-dir": lambda d: (d / ".git").mkdir(),
        "head-only": lambda d: ((d / ".git").mkdir(), (d / ".git" / "HEAD").write_text("ref: refs/heads/main\n")),
        "no-objects": lambda d: ((d / ".git" / "refs").mkdir(parents=True),
                                 (d / ".git" / "HEAD").write_text("ref: refs/heads/main\n")),
        "bad-head": lambda d: ((d / ".git" / "refs").mkdir(parents=True), (d / ".git" / "objects").mkdir(),
                               (d / ".git" / "HEAD").write_text("garbage\n")),
        "head-is-dir": lambda d: ((d / ".git" / "refs").mkdir(parents=True), (d / ".git" / "objects").mkdir(),
                                  (d / ".git" / "HEAD").mkdir()),
        "minimal": lambda d: make_git_dir(d / ".git"),
        "detached-sha": lambda d: make_git_dir(d / ".git", head="a" * 40 + "\n"),
    }

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.p = own_build_project(cls, "ai-editor-hooks-gitmarker-")
        cls.top = make_outer_repo(cls.p)
        for name, make in cls.VARIANTS.items():
            d = cls.p / "tmp" / "b" / "wt" / name
            d.mkdir(parents=True)
            make(d)

    def git_top(self, d):
        r = git("-C", str(d), "rev-parse", "--show-toplevel", check=False)
        return Path(r.stdout.strip()).resolve() if r.returncode == 0 and r.stdout.strip() else None

    def test_every_dir_git_walks_up_from_is_blocked(self):
        walked = []
        for name in self.VARIANTS:
            outer = self.git_top(self.p / "tmp" / "b" / "wt" / name) == self.top
            with self.subTest(variant=name, git_uses_outer_repo=outer):
                if outer:
                    walked.append(name)
                    self.assertBlock(self.bash(MT, f"git -C tmp/b/wt/{name} status", cwd=str(self.p)), ".git が無い",
                                     project=self.p)
        # 少なくとも空・HEAD だけ・objects 無しの3つは、git が外側へたどる（ベーコンの 3e-more）
        self.assertTrue({"empty-dir", "head-only", "no-objects"} <= set(walked), walked)

    def test_minimal_git_dir_is_a_repo_and_passes(self):
        for name in ("minimal", "detached-sha"):
            with self.subTest(variant=name):
                self.assertNotEqual(self.git_top(self.p / "tmp" / "b" / "wt" / name), self.top)
                self.passes(MT, [f"git -C tmp/b/wt/{name} status"], **self.at(self.p))
                self.passes(OE, [f"git -C tmp/b/wt/{name} diff"], **self.at(self.p))

    def test_git_file_still_passes(self):
        # 作業ツリーの .git ファイルは中身を見ない（設計どおり。R16）
        self.passes(MT, ["git -C tmp/b/wt/w1 status", "git -C tmp/b/vscode fetch --tags"], **self.at(self.p))


H40 = "a" * 40
# ベーコンの再現の入力（Team の tasks/2026-11-16-ai-editor-move-off-c-perms/bacon-tests/round2/tF3/test_f3_ws.py の
# VARIANTS）。見えない文字は \u で書いた
BACON_VARIANTS = [
    ("lead-sp", " ref: refs/heads/main\n"), ("lead-tab", "\tref: refs/heads/main\n"), ("lead-nl", "\nref: refs/heads/main\n"),
    ("lead-crlf", "\r\nref: refs/heads/main\n"), ("lead-vt", "\x0bref: refs/heads/main\n"),
    ("lead-ff", "\x0cref: refs/heads/main\n"), ("lead-nbsp", "\u00a0ref: refs/heads/main\n"),
    ("lead-bom", "\ufeffref: refs/heads/main\n"), ("lead-ideo-sp", "\u3000ref: refs/heads/main\n"),
    ("lead-hex-sp", " " + H40 + "\n"), ("lead-hex-bom", "\ufeff" + H40 + "\n"), ("lead-hex-nl", "\n" + H40 + "\n"),
    ("trail-sp", "ref: refs/heads/main \n"), ("trail-tab", "ref: refs/heads/main\t\n"),
    ("trail-nbsp", "ref: refs/heads/main\u00a0\n"), ("trail-nl2", "ref: refs/heads/main\n\n\n"),
    ("trail-hex-sp", H40 + "  \n"), ("trail-hex-nbsp", H40 + "\u00a0\n"), ("mid-tab", "ref:\trefs/heads/main\n"),
    ("mid-nbsp", "ref:\u00a0refs/heads/main\n"), ("hex-nonl", H40), ("hex-crlf", H40 + "\r\n"),
]
BACON_HOLES = [name for name, _ in BACON_VARIANTS if name.startswith("lead-")]  # 前の案が通し、git が外側へたどった12形
GOOD_HEADS = [
    ("good-ref", "ref: refs/heads/main\n"), ("good-ref-nonl", "ref: refs/heads/main"),
    ("good-ref-crlf", "ref: refs/heads/main\r\n"), ("good-ref-slash", "ref: refs/heads/builds/1.146.0-p2-all\n"),
    ("good-hex40", H40 + "\n"), ("good-hex64", "b" * 64 + "\n"),
]
ODD_HEADS = [  # git が読むかどうかを問わず止める側（止めすぎ。害は無い。R15）
    ("odd-upper-hex", "A" * 40 + "\n"), ("odd-ref-nospace", "ref:refs/heads/main\n"), ("odd-ref-2sp", "ref:  refs/heads/main\n"),
    ("odd-ref-empty-name", "ref: refs/\n"), ("odd-ref-space-in-name", "ref: refs/heads/a b\n"),
    ("odd-two-lines", "ref: refs/heads/main\nref: refs/heads/x\n"), ("odd-hex41", "a" * 41 + "\n"),
    ("odd-lone-cr", "ref: refs/heads/main\r"), ("odd-nul", "ref: refs/heads/main\x00\n"),
]


@unittest.skipUnless(GIT, "git が見つからない")
class GitHeadFormTest(BuildRootCase):
    """3c の HEAD の形（3回目の改訂 N1）。HEAD をバイトのまま、git が書く形とだけ照らす。"""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.p = own_build_project(cls, "ai-editor-hooks-githead-")
        cls.top = make_outer_repo(cls.p)
        wt = cls.p / "tmp" / "b" / "wt"
        for name, head in BACON_VARIANTS + GOOD_HEADS + ODD_HEADS:
            g = wt / name / ".git"
            g.mkdir(parents=True)
            (g / "HEAD").write_bytes(head.encode("utf-8"))  # ベーコンと同じく UTF-8 のバイトで書く
            (g / "objects").mkdir()
            (g / "refs").mkdir()

    def git_stays(self, d):
        """本物の git が d をリポジトリとして読み、外側（写しのプロジェクト）へたどらないか。"""
        r = git("-C", str(d), "rev-parse", "--show-toplevel", check=False)
        top = Path(r.stdout.strip()).resolve() if r.returncode == 0 and r.stdout.strip() else None
        return top != self.top

    def code(self, member, command):
        return run(self.bash(member, command, cwd=str(self.p)), project=self.p)

    def test_bacon_variants_never_pass_where_git_walks_up(self):
        holes = []
        for name, head in BACON_VARIANTS:
            stays = self.git_stays(self.p / "tmp" / "b" / "wt" / name)
            code, _ = self.code(MT, f"git -C tmp/b/wt/{name} status")
            with self.subTest(variant=name, git_stays=stays):
                self.assertIn(code, (0, 2))
                if code == 0 and not stays:
                    holes.append(name)
        self.assertEqual(holes, [], "フックが通し、git が外側へたどる形が残っている")

    def test_bacon_holes_are_blocked_and_git_really_walks_up(self):
        for name in BACON_HOLES:
            with self.subTest(variant=name):
                self.assertFalse(self.git_stays(self.p / "tmp" / "b" / "wt" / name), f"{name}: git がその場所に留まった")
                for member, command in ((MT, f"git -C tmp/b/wt/{name} status"), (OE, f"git -C tmp/b/wt/{name} diff"),
                                        (OE, f"git -C tmp/b/wt/{name} checkout -- pnpm-lock.yaml"),
                                        (MT, f"git -C tmp/b/wt/{name} checkout -- ../../../../docs/a.md")):
                    code, err = self.code(member, command)
                    self.assertEqual(code, 2, f"{member}: {command}\n{err}")
                    self.assertIn(".git が無い", err)

    def test_bacon_damage_reproduction_is_blocked(self):
        # ベーコンの実地の再現: lead-sp で checkout -- ../../../../docs/a.md は、外側の未コミットの編集を消す。フックは止める
        doc = self.p / "docs" / "a.md"
        doc.write_text("uncommitted", encoding="utf-8")
        try:
            code, err = self.code(MT, "git -C tmp/b/wt/lead-sp checkout -- ../../../../docs/a.md")
            self.assertEqual(code, 2, err)
            # 止めなかったら起きること（tempfile の下の写しで、本物の git を直接打って確かめる）
            r = git("-C", str(self.p / "tmp" / "b" / "wt" / "lead-sp"), "checkout", "--", "../../../../docs/a.md", check=False)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(doc.read_text(encoding="utf-8"), "x")  # 外側の未コミットの編集が消えた
        finally:
            doc.write_text("x", encoding="utf-8")

    def test_good_heads_pass_and_git_stays(self):
        for name, _ in GOOD_HEADS:
            with self.subTest(variant=name):
                self.assertTrue(self.git_stays(self.p / "tmp" / "b" / "wt" / name), f"{name}: git が外側へたどった")
                self.passes(MT, [f"git -C tmp/b/wt/{name} status"], **self.at(self.p))
                self.passes(OE, [f"git -C tmp/b/wt/{name} diff"], **self.at(self.p))

    def test_odd_heads_are_blocked(self):
        for name, _ in ODD_HEADS:
            with self.subTest(variant=name):
                self.blocks(MT, [f"git -C tmp/b/wt/{name} status"], ".git が無い", **self.at(self.p))

    def test_head_symlink_is_blocked(self):
        # HEAD がシンボリックリンクなら止める（中身で照らせない）。作れない環境では飛ばす
        g = self.p / "tmp" / "b" / "wt" / "head-link" / ".git"
        make_git_dir(g)
        target = g / "HEAD.real"
        (g / "HEAD").rename(target)
        try:
            os.symlink(target, g / "HEAD")
        except OSError:
            self.skipTest("シンボリックリンクを作れない")
        self.blocks(MT, ["git -C tmp/b/wt/head-link status"], ".git が無い", **self.at(self.p))


@unittest.skipUnless(GIT, "git が見つからない")
class RealGitShapesTest(BuildRootCase):
    """3c の止めすぎの確かめ。git clone（手元の使い捨ての元から）・git worktree add・git init が作る本物の .git が通る。"""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.p = own_build_project(cls, "ai-editor-hooks-realgit-")
        cls.top = make_outer_repo(cls.p)
        src_tmp = tempfile.mkdtemp(prefix="ai-editor-hooks-gitsrc-")
        cls.addClassCleanup(rmtree_force, src_tmp)
        src = Path(os.path.realpath(src_tmp)) / "src"
        git("init", "-q", "-b", "main", str(src))
        (src / "a.txt").write_text("1\n", encoding="utf-8")
        git("-C", str(src), "add", "a.txt")
        git("-C", str(src), "commit", "-q", "-m", "c1")
        git("-C", str(src), "tag", "1.146.0")
        b = cls.p / "tmp" / "b"
        rmtree_force(b / "vscode")  # 偽の木の clone を、本物の clone に置き換える
        git("clone", "-q", str(src), str(b / "vscode"))
        git("-C", str(b / "vscode"), "worktree", "add", "-q", str(b / "wt" / "real-wt"), "1.146.0")
        git("clone", "-q", str(src), str(b / "wt" / "clone-ref"))
        git("clone", "-q", str(src), str(b / "wt" / "clone-detached"))
        git("-C", str(b / "wt" / "clone-detached"), "checkout", "-q", "--detach")
        git("init", "-q", "-b", "main", str(b / "wt" / "init-empty"))
        cls.sha256 = git("init", "-q", "--object-format=sha256", "-b", "main", str(b / "wt" / "init-sha256"),
                         check=False).returncode == 0

    def test_real_shapes_pass(self):
        b = self.p / "tmp" / "b"
        head = (b / "wt" / "clone-detached" / ".git" / "HEAD").read_bytes()
        self.assertRegex(head.decode("ascii"), r"^[0-9a-f]{40}\n$")  # 前提: 切り離した HEAD は40桁と改行
        names = ["real-wt", "clone-ref", "clone-detached", "init-empty"] + (["init-sha256"] if self.sha256 else [])
        for name in names:
            with self.subTest(name=name):
                self.passes(MT, [f"git -C tmp/b/wt/{name} status"], **self.at(self.p))
                self.passes(OE, [f"git -C tmp/b/wt/{name} diff"], **self.at(self.p))
        self.assertTrue((b / "wt" / "real-wt" / ".git").is_file())  # 作業ツリーは .git ファイル
        self.passes(MT, ["git -C tmp/b/vscode fetch --tags", "git -C tmp/b/vscode tag --list",
                         "git -C tmp/b/vscode worktree prune", "git -C tmp/b/vscode worktree remove ../wt/real-wt"],
                    **self.at(self.p))
        # v2-1b（2026-11-17）: 判定だけを見る。git で実際にどれを外すかは test_worktree_effects.py が見る


if __name__ == "__main__":
    unittest.main()
