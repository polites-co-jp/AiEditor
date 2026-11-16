"""許した形を実際に走らせて、git がどこに作り・どれを外すかを見る見張り（判定でなく効き目のテスト）。2026-11-17 に取り込んだ。

出典: Team の tasks/2026-11-16-ai-editor-perm-requests-2 の proposal/tests/test_worktree_effects.py（perm-proposal.md 5.5節）。
v2-1b（2026-11-17 に当てた段）と同時に、本物のテストへ足した。中身は案のまま（道具は hookrun の GIT・PROJECT）。

v2-1 の git -C tmp/b/vscode worktree add tmp/b/wt/* は、判定のテストでは通ったが、git は -C の先からの相対で読むので、
作業ツリーは tmp/b/vscode/tmp/b/wt/<名前> にできた。判定だけのテストでは見つからない類なので、蒙恬の本物の permissions.json の
worktree add・remove の行を、そのままの語で（* に名前を入れて）tempfile の下のプロジェクトの形で走らせる。

- add の行: できた場所が、行のパスを -C の先から解いた場所であり、clone（-C の先）の中でなく、tmp/b の下であること。
- remove の行: 外れたのが、行のパスを -C の先から解いた作業ツリーだけであること。後ろの一致（git の find_worktree_by_suffix）で
  別の作業ツリーを外さないことも見るため、同じ後ろを持つ作業ツリー（おとり）を clone の中と tmp/b/wt に置いておく。
- 行の表（test_worktree_lines_are_the_fixed_table）: 上の2つは「tmp/b の下に収まるか」を見るので、tmp/b の下に収まる広げ方
  （../wt-r2/* の add、../*/* の remove など）を見つけない。そこで、4人の bash・bash_exact のうち worktree を含む行を、
  （メンバー, 欄, 行）の表 FIXED（いつもある行）と ONE_TIME（一度だけの片づけ。全部あるか全部無いか）に固定する。
  表に無い行・表の行の欠け・欄の違いは落ちる。行を変えるときは、この表も一緒に直す（権限の承認と同じ往復で）。
本物の git は tempfile の下の使い捨てのリポジトリだけで使う（本物の tmp/b・clone には触れない）。

段との関係: v2-1b・v2-1c・v2-2 は FIXED＋ONE_TIME、v2-3 は FIXED だけ。どちらも許すので、v2-1c・v2-2・v2-3 を当てても
このファイルは直さずに通る。【v2-3 を当てた後に直す（任意）】ONE_TIME と INSIDE_CLONE_OK の一度だけの行は、v2-3 の後は
要らない。外すなら、行の表を FIXED だけに締め、INSIDE_CLONE_OK を空にする（ONE_TIME の行が戻ったら落ちるようになる）。

実行: python -m unittest discover -s team/hooks/tests（AiEditor の直下で）
"""

import json
import os
import posixpath
import re
import shlex
import shutil
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path

from hookrun import GIT, PROJECT

LINE = re.compile(r"^git -C (\S+) worktree (add|remove) (\S+)$")


def git(*args, cwd=None, check=True):
    env = dict(os.environ, GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM="1", GIT_TERMINAL_PROMPT="0",
               GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@example.invalid", GIT_COMMITTER_NAME="t",
               GIT_COMMITTER_EMAIL="t@example.invalid")
    r = subprocess.run([GIT, *args], cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                       env=env, timeout=120)
    if check and r.returncode != 0:
        raise AssertionError(f"git {' '.join(args)} が失敗した: {r.stderr}")
    return r


def rmtree_force(path):
    def onexc(func, p, _exc):
        try:
            os.chmod(p, stat.S_IWRITE)
            func(p)
        except OSError:
            pass
    shutil.rmtree(path, onexc=onexc)


def worktree_lines(member="meng-tian"):
    p = next((PROJECT / "team" / "departments").glob(f"*/{member}/permissions.json"))
    data = json.loads(p.read_text(encoding="utf-8"))
    return [l for l in data.get("bash", []) + data.get("bash_exact", []) if l.startswith("git -C ") and " worktree " in l]


# 作業ツリーを扱う行の表（メンバー, 欄, 行）。2026-11-16 の2通目の案（v2-1b〜v2-3）
FIXED = {
    ("meng-tian", "bash", "git worktree list"),
    ("meng-tian", "bash", "git -C tmp/b/vscode worktree add ../wt/*"),
    ("meng-tian", "bash", "git -C tmp/b/vscode worktree prune"),
    ("meng-tian", "bash_exact", "git -C tmp/b/vscode worktree remove ../wt/*"),
    ("cao-shen", "bash", "git worktree list"),
    ("ooka-echizen", "bash", "git worktree list"),
}
# 一度だけの片づけの行（v2-1b〜v2-2 にだけある。v2-3 で外す）
ONE_TIME = {
    ("meng-tian", "bash_exact", "git -C tmp/b/vscode worktree remove ./tmp/b/wt/c1fix"),
    ("meng-tian", "bash_exact", "git -C tmp/b/vscode worktree remove ../wt-r2/1.146.0"),
    ("meng-tian", "bash_exact", "git -C tmp/b/vscode worktree remove ../wt-r3/1.146.0"),
    ("meng-tian", "bash_exact", "git -C tmp/b/vscode worktree remove ../wt-r3b/1.146.0"),
    ("meng-tian", "bash_exact", "git -C tmp/b/vscode worktree remove ../wt-r3c/1.146.0"),
}


def worktree_rows(departments):
    """departments（team/departments）の下の全員の bash・bash_exact から、worktree を含む行（大文字小文字を問わない）。"""
    rows = set()
    for p in sorted(Path(departments).glob("*/*/permissions.json")):
        data = json.loads(p.read_text(encoding="utf-8"))
        for key in ("bash", "bash_exact"):
            for line in data.get(key, []):
                if "worktree" in line.lower():
                    rows.add((p.parent.name, key, line))
    return rows


class WorktreeLinesTableTest(unittest.TestCase):
    def test_worktree_lines_are_the_fixed_table(self):
        rows = worktree_rows(PROJECT / "team" / "departments")
        allowed = (FIXED, FIXED | ONE_TIME)
        self.assertIn(rows, allowed, "worktree を含む行が表と違う。"
                      f"表に無い行: {sorted(rows - FIXED - ONE_TIME)}、欠けた行: {sorted(FIXED - rows)}、"
                      f"一度だけの行の一部だけ: {sorted(rows & ONE_TIME) if rows & ONE_TIME != ONE_TIME else []}")


class WorktreeEffectsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if GIT is None:
            raise unittest.SkipTest("git が見つからない")
        cls.lines = worktree_lines()

    def sandbox(self):
        tmp = tempfile.mkdtemp(prefix="ai-editor-wt-effects-")
        self.addCleanup(rmtree_force, tmp)
        P = Path(os.path.realpath(tmp)) / "proj"
        clone = P / "tmp" / "b" / "vscode"
        clone.mkdir(parents=True)
        git("init", "-q", "-b", "main", str(clone))
        (clone / "a.txt").write_text("x\n", encoding="utf-8")
        git("-C", str(clone), "add", "-A")
        git("-C", str(clone), "commit", "-q", "-m", "c1")
        git("-C", str(clone), "tag", "base")
        return P, clone

    def registered(self, clone):
        out = git("-C", str(clone), "worktree", "list", "--porcelain").stdout
        return {Path(l[9:]).resolve() for l in out.splitlines() if l.startswith("worktree ")}

    def test_lines_exist(self):
        self.assertTrue(any(LINE.match(l) and LINE.match(l).group(2) == "add" for l in self.lines), self.lines)
        self.assertTrue(any(LINE.match(l) and LINE.match(l).group(2) == "remove" for l in self.lines), self.lines)

    def test_add_lands_where_the_line_says(self):
        for line in self.lines:
            m = LINE.match(line)
            if not m or m.group(2) != "add":
                continue
            with self.subTest(line=line):
                P, clone = self.sandbox()
                cmd = line.replace("*", "probe") + " base"
                r = git(*shlex.split(cmd)[1:], cwd=P, check=False)
                self.assertEqual(r.returncode, 0, r.stderr)
                want = (P / posixpath.normpath(posixpath.join(m.group(1), m.group(3).replace("*", "probe")))).resolve()
                self.assertTrue((want / ".git").is_file(), f"{cmd}: {want} にできていない")
                self.assertIn(want, self.registered(clone))
                self.assertFalse(str(want).lower().startswith(str(clone.resolve()).lower() + os.sep), f"{cmd}: clone の中にできた")
                self.assertTrue(str(want).lower().startswith(str((P / "tmp" / "b").resolve()).lower() + os.sep))

    # clone の中の作業ツリーを、わざと名指しして外す一度だけの行（誤ってできた tmp/b/vscode/tmp/b/wt/c1fix。v2-1b〜v2-2）
    INSIDE_CLONE_OK = {"git -C tmp/b/vscode worktree remove ./tmp/b/wt/c1fix"}

    def remove_case(self, line, m, with_target):
        P, clone = self.sandbox()
        rel = m.group(3).replace("*", "probe")
        want = (P / posixpath.normpath(posixpath.join(m.group(1), rel))).resolve()
        # 同じ後ろの名前を持つおとり（clone の中・tmp/b の下・tmp/b/wt-zz の下）
        tail = Path(*Path(rel).parts[-2:])
        decoys = {(clone / "tmp" / "b" / tail).resolve(), (P / "tmp" / "b" / tail).resolve(),
                  (P / "tmp" / "b" / "wt-zz" / tail.name).resolve()} - {want}
        for d in ([want] if with_target else []) + sorted(decoys):
            git("-C", str(clone), "worktree", "add", "-q", "--detach", str(d), "base")
        r = git(*shlex.split(line.replace("*", "probe"))[1:], cwd=P, check=False)
        for d in decoys:
            self.assertTrue(d.exists(), f"{line}: おとり {d} まで外れた")
            self.assertIn(d, self.registered(clone))
        return r, want, clone, P

    def test_remove_hits_only_the_named_one(self):
        for line in self.lines:
            m = LINE.match(line)
            if not m or m.group(2) != "remove":
                continue
            with self.subTest(line=line):
                r, want, clone, P = self.remove_case(line, m, with_target=True)
                self.assertEqual(r.returncode, 0, r.stderr)
                self.assertFalse(want.exists(), f"{line}: {want} が外れていない")
                inside = str(want).lower().startswith(str(clone.resolve()).lower() + os.sep)
                self.assertEqual(inside, line in self.INSIDE_CLONE_OK, f"{line}: 外す先 {want} が clone の中かどうかが想定と違う")
                self.assertTrue(str(want).lower().startswith(str((P / "tmp" / "b").resolve()).lower() + os.sep))

    def test_remove_without_target_touches_nothing(self):
        """名指しの先が無いときは、後ろの一致で別の作業ツリーを外さず、失敗する。"""
        for line in self.lines:
            m = LINE.match(line)
            if not m or m.group(2) != "remove":
                continue
            with self.subTest(line=line):
                r, want, _, _ = self.remove_case(line, m, with_target=False)
                self.assertNotEqual(r.returncode, 0, f"{line}: 先が無いのに成功した（別の作業ツリーを外した）")


if __name__ == "__main__":
    unittest.main()
