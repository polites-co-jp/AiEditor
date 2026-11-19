"""改名（Shuko → Sukuna）の段1のテスト。2026-11-20 に当てた行のうち、秘密の場所（1.1）と移行の台本の行（1.5）を見る。
ショートカット（1.2）と拡張を外す CLI・言語パックの一覧（1.3）は test_shortcut_l10n.py が見る。

当てた行（Team の tasks/2026-11-20-ai-editor-rename-sukuna-perms/perm-proposal.md の 1.1・1.5）:
- 1.1: 4人の secret_paths と allowlist.js の EXPLORE_ALLOWLIST.secret_paths に、%LOCALAPPDATA%/Sukuna/watch/ と
  %LOCALAPPDATA%/Sukuna/secrets/ を足した（Shuko の2つは残す）。
- 1.5: 蒙恬の bash_exact に、移行の台本の4行（一覧・本番・試しの一覧・試しの本番）。前方一致の行にはしない
  （後ろに -ConfigPath・位置引数・2つ目の -SandboxRoot を足せるため）。今の一般の行
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/*.ps1` の * は / をまたがないので、scripts/migrate/ の
  下の台本はこの4行の形でしか打てない（台本の中から別の台本を起こすことは、フックでは塞がない。docs/08 の決まり）。

行の正本はこのファイルの上の定数（tasks/ の下に頼らない）。

- RealLinesTest: 本物の permissions.json と allowlist.js を読むだけ（フックは通さない）。
- SecretSukunaHookTest: 本物の定義・permissions.json・フックを tempfile の下に写したプロジェクトで判定する。
  LOCALAPPDATA は写しの中の tmp/local（read_paths の ./ と蒙恬の write_paths の tmp/ の中）に置き、その下の Sukuna は
  作らない（まだ無い場所）。秘密の場所の行が無ければ通る入力なので、止まる理由が secret_paths であることを確かめられる
  （test_read.GlobGrepTest.test_search_root_containing_secret_is_blocked と同じ形）。
- MigrateHookTest: 4行が蒙恬にだけ通り、形を変えた行（引数を足す・場所を変える・順を変える・前に環境変数）が止まる。

【段2で】Shuko の2つの secret_paths を外すときは、SHUKO_SECRETS の期待を外す。移行が済んで 1.5 の4行を外すときは、
MigrateHookTest の「通る」を「止まる」に変え、RealLinesTest.test_migrate_lines_meng_tian_only を「行が無い」に変える。

実行（Team のルートで）: python team/hooks/run_tests.py suite projects/ai-editor/team/hooks/tests
"""

import json
import os
import re
import shutil
import tempfile
import unittest
from pathlib import Path

from hookrun import HOOKS, PROJECT, HookTestCase, event, make_project, run

MT, CS, OE, DR = "meng-tian", "cao-shen", "ooka-echizen", "di-renjie"
MEMBERS = (MT, CS, OE, DR)

SHUKO_SECRETS = ["%LOCALAPPDATA%/Shuko/watch/", "%LOCALAPPDATA%/Shuko/secrets/"]
SUKUNA_SECRETS = ["%LOCALAPPDATA%/Sukuna/watch/", "%LOCALAPPDATA%/Sukuna/secrets/"]

MIG = "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migrate/migrate-from-shuko.ps1"
T = "tmp/b/trial-migrate"
MIG_LINES = (f"{MIG} -List", f"{MIG} -Apply", f"{MIG} -SandboxRoot {T} -List", f"{MIG} -SandboxRoot {T} -Apply")
GENERAL_PS1 = "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/*.ps1"


def real_permissions(member):
    path = next((PROJECT / "team" / "departments").glob(f"*/{member}/permissions.json"))
    return json.loads(path.read_text(encoding="utf-8"))


def _rmtree(path):
    shutil.rmtree(path, ignore_errors=True)


class RealLinesTest(unittest.TestCase):
    def test_secret_paths_of_the_four(self):
        for member in MEMBERS:
            with self.subTest(member=member):
                self.assertEqual(real_permissions(member)["secret_paths"], SHUKO_SECRETS + SUKUNA_SECRETS)

    def test_explore_allowlist_has_the_four(self):
        text = (HOOKS / "allowlist.js").read_text(encoding="utf-8")
        block = re.search(r"const EXPLORE_ALLOWLIST = \{(.*?)\n\};", text, re.S).group(1)
        m = re.search(r"^\s*secret_paths: (\[.*\]),$", block, re.M)
        self.assertEqual(json.loads(m.group(1)), SHUKO_SECRETS + SUKUNA_SECRETS)
        self.assertEqual(len(re.findall(r"secret_paths:", block)), 1)

    def test_migrate_lines_meng_tian_only(self):
        found = set()
        for member in MEMBERS:
            p = real_permissions(member)
            for key in ("bash", "bash_exact"):
                for line in p.get(key, []):
                    if "migrate" in line.lower():
                        found.add((member, key, line))
        self.assertEqual(found, {(MT, "bash_exact", line) for line in MIG_LINES})
        for line in MIG_LINES:
            for ch in "*?[]{}$`'\"\\;|&<>()%~":
                self.assertNotIn(ch, line)

    def test_general_line_stays_one_level(self):
        # 一般の行は残る（configure.ps1・switch.ps1 などを打つ）。* は区切り1つの一部なので scripts/migrate/ の下に届かない
        self.assertIn(GENERAL_PS1, real_permissions(MT)["bash"])
        self.assertFalse([x for x in real_permissions(MT)["bash"] if "scripts/migrate" in x or "scripts/**" in x])


class SecretSukunaHookTest(HookTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._tmp = Path(os.path.realpath(tempfile.mkdtemp(prefix="ai-editor-hooks-sukuna-")))
        cls.addClassCleanup(_rmtree, cls._tmp)
        cls.project = make_project(cls._tmp)
        for d in ("tmp/local", "docs/local", "docs"):
            (cls.project / d).mkdir(parents=True, exist_ok=True)
        if (cls.project / "tmp" / "local" / "Sukuna").exists():
            raise AssertionError("Sukuna を作らない")

    def judge(self, ev, local="tmp/local"):
        return run(ev, project=self.project, local=str(self.project / local))

    def blocked(self, tool, tool_input, member, local="tmp/local"):
        with self.subTest(member=member, tool=tool, input=str(tool_input)[:100]):
            code, err = self.judge(event(tool, tool_input, agent_type=member, cwd=str(self.project)), local)
            self.assertEqual(code, 2, err)
            self.assertIn("secret_paths", err)

    def passed(self, tool, tool_input, member, local="tmp/local"):
        with self.subTest(member=member, tool=tool, input=str(tool_input)[:100]):
            code, err = self.judge(event(tool, tool_input, agent_type=member, cwd=str(self.project)), local)
            self.assertEqual(code, 0, err)

    def test_read_not_yet_existing_places(self):
        p = str(self.project)
        fwd = p.replace("\\", "/")
        forms = ["tmp/local/Sukuna/watch/state.json", "tmp/local/Sukuna/watch/notion-token.dpapi",
                 "tmp/local/Sukuna/secrets/token", "tmp/local/Sukuna/watch", "TMP\\LOCAL\\SUKUNA\\WATCH\\state.json",
                 f"{p}\\tmp\\local\\Sukuna\\watch\\state.json", f"{fwd}/tmp/local/Sukuna/secrets/t",
                 "/" + fwd[0].lower() + fwd[2:] + "/tmp/local/Sukuna/watch/state.json",
                 "tmp/local/Sukuna/x/../watch/state.json", "tmp/local/Sukuna/./secrets/t"]
        for member in (MT, CS, OE, "Explore"):
            for f in forms:
                self.blocked("Read", {"file_path": f}, member)
        self.blocked("Read", {"file_path": "docs/local/Sukuna/watch/state.json"}, DR, local="docs/local")

    def test_search_not_yet_existing_places(self):
        for member in (MT, CS, OE, "Explore"):
            self.blocked("Glob", {"pattern": "*", "path": "tmp/local/Sukuna"}, member)
            self.blocked("Glob", {"pattern": "Sukuna/watch/*", "path": "docs"}, member)
            self.blocked("Grep", {"pattern": "x", "path": "tmp/local/Sukuna/secrets"}, member)
            self.blocked("Grep", {"pattern": "x", "path": "docs", "glob": "sukuna/watch/*"}, member)
        self.blocked("Grep", {"pattern": "x", "path": "docs/local/Sukuna"}, DR, local="docs/local")

    def test_write_and_bash_text(self):
        self.blocked("Write", {"file_path": "tmp/local/Sukuna/watch/state.json", "content": "x"}, MT)
        for member in (MT, CS, OE):
            for c in ("git diff tmp/local/Sukuna/watch/state.json", "git diff C:\\Users\\x\\AppData\\Local\\Sukuna\\secrets\\t",
                      "git diff Suku''na/watch", "git diff Sukuna/x/../watch"):
                self.blocked("Bash", {"command": c}, member)

    def test_neighbours_and_shuko(self):
        for member in (MT, CS, OE, "Explore"):
            self.passed("Read", {"file_path": "tmp/local/Sukuna/local.json"}, member)  # watch/・secrets/ の外
            self.blocked("Read", {"file_path": "tmp/local/Shuko/watch/state.json"}, member)  # Shuko は残る


TRIAL_FORMS = [
    f"{MIG} -SandboxRoot {T}-x -List", f"{MIG} -SandboxRoot {T}/../.. -List", f"{MIG} -SandboxRoot {T}/sub -List",
    f"{MIG} -SandboxRoot C:/x/trial-migrate -List", f"{MIG} -SandboxRoot:{T} -List", f"{MIG} -List -SandboxRoot {T}",
    f"{MIG} -SandboxRoot {T} -List -SandboxRoot C:/x", f"{MIG} -SandboxRoot {T} -List -Apply",
    f"{MIG} -SandboxRoot {T} -List -ConfigPath tmp/x.json", f"{MIG} -SandboxRoot {T} -List tmp/x.json",
    f"{MIG} -SandboxRoot {T} -List -Bogus", f"{MIG} -SandboxRoot {T}",
]
PROD_FORMS = [
    f"{MIG} -List -Apply", f"{MIG} -List x", f"{MIG} -Apply -SandboxRoot C:/x", f"{MIG} -Apply -ConfigPath tmp/x.json",
    f"{MIG} -list", f"{MIG} -L", f"{MIG}", f"APPDATA=C:/x {MIG} -Apply", f"LOCALAPPDATA=tmp/x {MIG} -Apply",
    f"env APPDATA=C:/x {MIG} -Apply", f"command {MIG} -Apply", MIG.replace("powershell ", "pwsh ", 1) + " -Apply",
    MIG.replace(" -NoProfile", "", 1) + " -Apply", f"{MIG} -Apply; whoami",
]
SCRIPT_FORMS = [
    MIG.replace("scripts/migrate/", "scripts/./migrate/") + " -List",
    MIG.replace("scripts/migrate/", "scripts/migrate/../migrate/") + " -List",
    MIG.replace("scripts/migrate/migrate-from-shuko.ps1", "scripts\\migrate\\migrate-from-shuko.ps1") + " -List",
    MIG.replace("scripts/migrate/", "Scripts/Migrate/") + " -List",
    MIG.replace("scripts/migrate/migrate-from-shuko.ps1", '"scripts/migrate/migrate-from-shuko.ps1"') + " -List",
    MIG.replace("scripts/migrate/", "./scripts/migrate/") + " -List",
]


class MigrateHookTest(HookTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._tmp = Path(os.path.realpath(tempfile.mkdtemp(prefix="ai-editor-hooks-migrate-")))
        cls.addClassCleanup(_rmtree, cls._tmp)
        cls.project = make_project(cls._tmp)

    def judge(self, member, command):
        return run(event("Bash", {"command": command}, agent_type=member, cwd=str(self.project)), project=self.project)

    def test_four_lines_pass_for_meng_tian_only(self):
        for line in MIG_LINES:
            with self.subTest(line=line):
                code, err = self.judge(MT, line)
                self.assertEqual(code, 0, err)
                for member in (CS, OE, DR):
                    code, err = self.judge(member, line)
                    self.assertEqual(code, 2, f"{member}: {err}")

    def test_changed_forms_blocked(self):
        self.assertEqual((len(TRIAL_FORMS), len(PROD_FORMS), len(SCRIPT_FORMS)), (12, 14, 6))
        for form in TRIAL_FORMS + PROD_FORMS + SCRIPT_FORMS:
            with self.subTest(command=form):
                code, err = self.judge(MT, form)
                self.assertEqual(code, 2, err)


if __name__ == "__main__":
    unittest.main()
