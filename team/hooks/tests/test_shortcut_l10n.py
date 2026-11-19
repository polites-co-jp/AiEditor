"""デスクトップのショートカット（A）と、古い日本語パックを外す許可（B）のテスト。2026-11-18 に当てた段 v2-1b+AB の行。

当てた行（本物の permissions.json。Team の tasks/2026-11-17-ai-editor-shortcut-l10n-perms/perm-proposal.md の 2節）:
- A: 蒙恬の bash_exact に A_CREATE（デスクトップの Shuko.lnk を作る1行）、大岡越前守の bash_exact に A_READ（その .lnk の
  TargetPath・WorkingDirectory を読む1行）。どちらも powershell -EncodedCommand の1行で、中身の台本（CREATE_PS・READ_PS）を
  UTF-16LE の Base64 にして行に埋める。台本の中のパスは決め打ちの絶対パス。
- B: 蒙恬の bash_exact に B_UNINSTALL（`<shuko.cmd> --uninstall-extension=*.*`。= でつなぐ形）、read_paths に B_READ
  （languagepacks.json のファイル1つ）。

行の正本はこのファイルの上の定数（tasks/ の下に頼らない）。本物の permissions.json の行が、これと同じであることを照らす。
行を変えるとき（installRoot やデスクトップの場所を変えるとき。perm-proposal.md の R34）は、権限の承認と同じ往復で、
ここの定数と期待も直す。

- RealLinesTest: 本物の permissions.json を読むだけ（フックは通さない）。
- ShortcutHookTest・UninstallHookTest: 本物の定義・permissions.json・フックを tempfile の下に写したプロジェクトで、
  本物のフック（allowlist.js）に判定させる。languagepacks.json の読み取りは、フックが判定のときに lstat・realpath を
  するので、写しの permissions.json の B_READ の1つだけを tempfile の下の同じ形のパスに置き換えて照らす（本物の
  %APPDATA%\\Shuko を渡さない）。
- ShortcutEffectsTest: A の行を Git Bash から PowerShell に渡し、tempfile の下で .lnk を作る・読む。行の中の2つのパス
  （デスクトップと installRoot）だけを tempfile の下に置き換えた写しの行で走らせる。本物のデスクトップ・
  %LOCALAPPDATA%\\Programs\\Shuko・%APPDATA%\\Shuko は指さない。本物の行そのものは走らせず、引数が Git Bash を通って
  変わらないことだけを、先頭の powershell を「引数を書き出す python」に替えて確かめる。Git Bash か PowerShell が無ければ
  skip する（4秒ほど）。

【v2-1c・v2-2・v2-3 を当てたとき】今回の行は残る（perm-proposal.md の 2.4節）。RealLinesTest.test_outside_read_paths の
C:/b/ は v2-2・v2-3 で外れるが、このテストは C:/b/ を除いて照らすので直さなくてよい（C:/b/ は test_v21_temporary が見る）。

出典: Team の同じタスクの perm-tests/（test_f_shape.ScriptTest・test_a_hook_shortcut.py・test_b_hook_uninstall.py・
test_c_shortcut_effects.py）。

【2026-11-20 改名の段1（Shuko → Sukuna）】Team の tasks/2026-11-20-ai-editor-rename-sukuna-perms/perm-proposal.md の 1.2・1.3。
Shuko の4行（A_CREATE・A_READ・B_UNINSTALL・B_READ）は残し、Sukuna の組（S_CREATE・S_READ・S_UNINSTALL・S_LANGPACKS）を
足した。期待は「Shuko の組と Sukuna の組」。sukuna.cmd は移行（switch.ps1）の後にできるので、このテストでは在るかを
見ない（文字列が %LOCALAPPDATA% と一致することだけを見る）。【段2で】Shuko の組を外し、is_file を Sukuna の CLI に移す。
秘密の場所の Sukuna の行（1.1）と移行の台本の行（1.5）は test_rename_sukuna.py が見る。

実行: python -m unittest discover -s projects/ai-editor/team/hooks/tests
"""

import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import unittest
from pathlib import Path

from hookrun import PROJECT, HookTestCase, event, make_project, run

MT, CS, OE, DR = "meng-tian", "cao-shen", "ooka-echizen", "di-renjie"
MEMBERS = (MT, CS, OE, DR)

# ---- 行の正本 ----

DESKTOP = "C:\\Users\\kou_z\\OneDrive\\デスクトップ"               # 既知のフォルダの Desktop。最後の区切りは NFC
INSTALL_ROOT = "C:\\Users\\kou_z\\AppData\\Local\\Programs\\Shuko"  # local.json の既定 %LOCALAPPDATA%\Programs\Shuko

CREATE_PS = "\n".join([
    "$ErrorActionPreference = 'Stop'",
    f"$lnk = '{DESKTOP}\\Shuko.lnk'",
    f"$cur = '{INSTALL_ROOT}\\current'",
    "[IO.File]::Delete($lnk)",
    "$ws = New-Object -ComObject WScript.Shell",
    "$s = $ws.CreateShortcut($lnk)",
    "$s.TargetPath = $cur + '\\Shuko.exe'",
    "$s.WorkingDirectory = $cur",
    "$s.Save()",
    "$r = $ws.CreateShortcut($lnk)",
    "'TargetPath=' + $r.TargetPath",
    "'WorkingDirectory=' + $r.WorkingDirectory",
    "'Arguments=' + $r.Arguments",
]) + "\n"

READ_PS = "\n".join([
    "$ErrorActionPreference = 'Stop'",
    f"$lnk = '{DESKTOP}\\Shuko.lnk'",
    "if (-not [IO.File]::Exists($lnk)) { 'missing'; exit 3 }",
    "$r = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)",
    "'TargetPath=' + $r.TargetPath",
    "'WorkingDirectory=' + $r.WorkingDirectory",
]) + "\n"

PS_PREFIX = "powershell -NoProfile -NonInteractive -EncodedCommand "


def encode(script):
    return base64.b64encode(script.encode("utf-16-le")).decode("ascii")


def decode(b64):
    return base64.b64decode(b64, validate=True).decode("utf-16-le")


def ps_line(script):
    return PS_PREFIX + encode(script)


A_CREATE = ps_line(CREATE_PS)
A_READ = ps_line(READ_PS)

SHUKO_CMD = "C:/Users/kou_z/AppData/Local/Programs/Shuko/current/bin/shuko.cmd"
B_UNINSTALL = f"{SHUKO_CMD} --uninstall-extension=*.*"
B_READ = "C:/Users/kou_z/AppData/Roaming/Shuko/languagepacks.json"
B_TODAY = f"{SHUKO_CMD} --uninstall-extension=MS-CEINTL.vscode-language-pack-ja"  # 2026-11-18 に打つ形（B_UNINSTALL に当たる）

# ---- 改名の段1（2026-11-20）の Sukuna の組。台本は Shuko の台本の Shuko を Sukuna にしただけ ----

SUKUNA_INSTALL_ROOT = "C:\\Users\\kou_z\\AppData\\Local\\Programs\\Sukuna"  # local.json の既定 %LOCALAPPDATA%\Programs\Sukuna

S_CREATE_PS = "\n".join([
    "$ErrorActionPreference = 'Stop'",
    f"$lnk = '{DESKTOP}\\Sukuna.lnk'",
    f"$cur = '{SUKUNA_INSTALL_ROOT}\\current'",
    "[IO.File]::Delete($lnk)",
    "$ws = New-Object -ComObject WScript.Shell",
    "$s = $ws.CreateShortcut($lnk)",
    "$s.TargetPath = $cur + '\\Sukuna.exe'",
    "$s.WorkingDirectory = $cur",
    "$s.Save()",
    "$r = $ws.CreateShortcut($lnk)",
    "'TargetPath=' + $r.TargetPath",
    "'WorkingDirectory=' + $r.WorkingDirectory",
    "'Arguments=' + $r.Arguments",
]) + "\n"

S_READ_PS = "\n".join([
    "$ErrorActionPreference = 'Stop'",
    f"$lnk = '{DESKTOP}\\Sukuna.lnk'",
    "if (-not [IO.File]::Exists($lnk)) { 'missing'; exit 3 }",
    "$r = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)",
    "'TargetPath=' + $r.TargetPath",
    "'WorkingDirectory=' + $r.WorkingDirectory",
]) + "\n"

S_CREATE = ps_line(S_CREATE_PS)
S_READ = ps_line(S_READ_PS)
SUKUNA_CMD = "C:/Users/kou_z/AppData/Local/Programs/Sukuna/current/bin/sukuna.cmd"
S_UNINSTALL = f"{SUKUNA_CMD} --uninstall-extension=*.*"
S_LANGPACKS = "C:/Users/kou_z/AppData/Roaming/Sukuna/languagepacks.json"
S_TODAY = f"{SUKUNA_CMD} --uninstall-extension=MS-CEINTL.vscode-language-pack-ja"


def real_permissions(member):
    path = next((PROJECT / "team" / "departments").glob(f"*/{member}/permissions.json"))
    return json.loads(path.read_text(encoding="utf-8"))


def rows(predicate):
    """4人の bash・bash_exact の行のうち predicate に当たるものを {(メンバー, 欄, 行)} で返す。"""
    out = set()
    for member in MEMBERS:
        p = real_permissions(member)
        for key in ("bash", "bash_exact"):
            for line in p.get(key, []):
                if predicate(line):
                    out.add((member, key, line))
    return out


def is_outside(entry):
    """read_paths の要素が、プロジェクトの外を指す形か（絶対パス・ドライブ・~・環境変数）。"""
    return bool(re.match(r"^([A-Za-z]:|/|\\|~|%|\$)", entry))


def secret_needles(entry, env):
    """allowlist.js の compileSecrets と同じ needles（文字列の検査に使う語）を、Python で組む。"""
    names = re.findall(r"%([^%]*)%", entry)
    expanded = re.sub(r"%([^%]*)%", lambda m: env.get(m.group(1), m.group(0)), entry)
    key = os.path.normpath(expanded).replace("\\", "/").lower().rstrip("/")
    needles = {key, f"/{key[0]}/{key[3:]}"}
    for n in (x.lower() for x in names):
        needles |= {f"%{n}%", f"$env:{n}", f"${{env:{n}}}", f"${n}", f"${{{n}}}"}
    tail = entry[entry.rfind("%") + 1:].replace("\\", "/").lower().strip("/")
    if tail:
        needles.add(tail)
    return needles


class RealLinesTest(unittest.TestCase):
    """本物の permissions.json の A・B の行（フックは通さない）。"""

    def test_encoded_command_lines_are_the_four(self):
        # Shuko の2行と Sukuna の2行（2026-11-20 改名の段1）。【段2で】Shuko の2行を外す
        self.assertEqual(rows(lambda x: "encodedcommand" in x.lower()),
                         {(MT, "bash_exact", A_CREATE), (OE, "bash_exact", A_READ),
                          (MT, "bash_exact", S_CREATE), (OE, "bash_exact", S_READ)})

    def test_powershell_lines_unchanged_otherwise(self):
        # powershell の行は、A の2行と Sukuna の2行のほかは前からの行だけ（-EncodedCommand・-Command の行を足していない）
        for member, key, line in rows(lambda x: "powershell" in x.lower()):
            with self.subTest(member=member, line=line[:80]):
                if line not in (A_CREATE, A_READ, S_CREATE, S_READ):
                    self.assertNotIn("-command", line.lower())
                    self.assertNotIn("-enc", line.lower())

    def test_shuko_cmd_line_is_meng_tian_only(self):
        self.assertEqual(rows(lambda x: "shuko.cmd" in x.lower()), {(MT, "bash_exact", B_UNINSTALL)})
        self.assertEqual(rows(lambda x: "sukuna.cmd" in x.lower()), {(MT, "bash_exact", S_UNINSTALL)})
        self.assertEqual(rows(lambda x: "uninstall-extension" in x.lower()),
                         {(MT, "bash_exact", B_UNINSTALL), (MT, "bash_exact", S_UNINSTALL)})
        self.assertFalse(rows(lambda x: "--install-extension" in x.lower()))  # 入れる操作の行は無い

    def test_outside_read_paths(self):
        # プロジェクトの外を指す read_paths は、蒙恬の languagepacks.json の2行（Shuko・Sukuna）だけ（C:/b/ は v2-2 までの
        # 一時の行。test_v21_temporary.RealLinesTest.test_read_paths_c_b_until_v2_2 が見る）。【段2で】B_READ を外す
        for member in MEMBERS:
            outside = [x for x in real_permissions(member).get("read_paths", []) if is_outside(x) and x != "C:/b/"]
            with self.subTest(member=member):
                self.assertEqual(outside, [B_READ, S_LANGPACKS] if member == MT else [])
        self.assertFalse(B_READ.endswith("/"))  # 末尾が / でない要素は、そのファイルだけに一致する
        self.assertFalse(S_LANGPACKS.endswith("/"))
        for member in MEMBERS:
            p = real_permissions(member)
            with self.subTest(member=member, keys="write・delete"):
                for key in ("write_paths", "delete_paths", "delete_keep"):
                    self.assertFalse([x for x in p.get(key, []) if re.search(r"shuko|sukuna|onedrive", x.lower())], key)

    def test_lines_carry_the_scripts(self):
        mt, oe = real_permissions(MT)["bash_exact"], real_permissions(OE)["bash_exact"]
        for line, script, where in ((A_CREATE, CREATE_PS, mt), (A_READ, READ_PS, oe), (S_CREATE, S_CREATE_PS, mt),
                                    (S_READ, S_READ_PS, oe)):
            with self.subTest(script=script.splitlines()[1]):
                self.assertIn(line, where)
                self.assertEqual(line, PS_PREFIX + encode(script))
                self.assertEqual(decode(line.split(" ")[-1]), script)
                self.assertEqual(line.split(" ")[:-1], ["powershell", "-NoProfile", "-NonInteractive", "-EncodedCommand"])

    def test_scripts_name_only_the_fixed_paths(self):
        lnk = f"'{DESKTOP}\\Shuko.lnk'"
        cur = f"'{INSTALL_ROOT}\\current'"
        self.assertEqual(CREATE_PS.count("'C:\\"), 2)
        self.assertIn(lnk, CREATE_PS)
        self.assertIn(cur, CREATE_PS)
        self.assertEqual(READ_PS.count("'C:\\"), 1)
        self.assertIn(lnk, READ_PS)
        self.assertEqual(CREATE_PS.count(".Save()"), 1)
        self.assertNotIn("Save", READ_PS)
        for word in ("Arguments =", "IconLocation =", "Hotkey =", "Invoke", "Start-Process", "Remove-Item", "$env:"):
            self.assertNotIn(word, CREATE_PS)
            self.assertNotIn(word, READ_PS)
        self.assertTrue(DESKTOP.endswith("\\OneDrive\\デスクトップ"))
        self.assertEqual([f"U+{ord(c):04X}" for c in DESKTOP.split("\\")[-1]],
                         ["U+30C7", "U+30B9", "U+30AF", "U+30C8", "U+30C3", "U+30D7"])  # NFC（プ は U+30D7 の1字）
        # Sukuna の台本は、Shuko の台本の Shuko を Sukuna にしただけ（パスは同じ2つの形）
        self.assertEqual(S_CREATE_PS, CREATE_PS.replace("Shuko", "Sukuna"))
        self.assertEqual(S_READ_PS, READ_PS.replace("Shuko", "Sukuna"))
        self.assertIn(f"'{DESKTOP}\\Sukuna.lnk'", S_READ_PS)
        self.assertIn(f"'{SUKUNA_INSTALL_ROOT}\\current'", S_CREATE_PS)

    def test_base64_starts_and_ends_plainly(self):
        # MSYS の引数の変換の手がかりになる形（/ や - で始まる・=/ を含む）が無い
        for line in (A_CREATE, A_READ, S_CREATE, S_READ):
            b64 = line.split(" ")[-1]
            self.assertFalse(b64.startswith(("/", "-")))
            self.assertNotIn("=/", b64)

    def test_no_wildcard_in_the_a_lines(self):
        # bash_exact の * は STAR（区切り1つの一部）として読まれる。決め打ちの4行には * も ? もフックの特別な文字も無い
        for line in (A_CREATE, A_READ, S_CREATE, S_READ):
            for ch in "*?[]{}$`'\"\\;|&<>()%~":
                self.assertNotIn(ch, line)
            self.assertTrue(line.isascii())

    def test_new_lines_hit_no_secret_needle(self):
        # secret_paths の文字列の検査（allowlist.js の checkSecretText）に、今回の行が当たらない（Sukuna の秘密の場所を
        # 足した後の secret_paths で照らす）
        for member, new in ((MT, [A_CREATE, B_UNINSTALL, B_TODAY, S_CREATE, S_UNINSTALL, S_TODAY]), (OE, [A_READ, S_READ])):
            needles = set()
            for entry in real_permissions(member).get("secret_paths", []):
                needles |= secret_needles(entry, os.environ)
            self.assertTrue(needles, member)
            for line in new:
                low = line.lower().replace("\\", "/")
                with self.subTest(member=member, line=line[:50]):
                    self.assertFalse([n for n in needles if n in low])

    def test_paths_match_this_pc(self):
        # 行の中のパスが、この PC の %LOCALAPPDATA%・%APPDATA% と一致する（環境変数を照らすだけ。shuko.cmd は stat だけ）
        if sys.platform != "win32" or "LOCALAPPDATA" not in os.environ or "APPDATA" not in os.environ:
            self.skipTest("Windows の %LOCALAPPDATA%・%APPDATA% が無い")
        local = os.environ["LOCALAPPDATA"].replace("\\", "/")
        roaming = os.environ["APPDATA"].replace("\\", "/")
        self.assertEqual(SHUKO_CMD, f"{local}/Programs/Shuko/current/bin/shuko.cmd")
        self.assertEqual(B_READ, f"{roaming}/Shuko/languagepacks.json")
        self.assertEqual(INSTALL_ROOT, os.environ["LOCALAPPDATA"] + "\\Programs\\Shuko")
        self.assertTrue(Path(SHUKO_CMD).is_file())
        # Sukuna の組は文字列だけを照らす（sukuna.cmd は移行の後にできる。【段2で】is_file をこちらに移す）
        self.assertEqual(SUKUNA_CMD, f"{local}/Programs/Sukuna/current/bin/sukuna.cmd")
        self.assertEqual(S_LANGPACKS, f"{roaming}/Sukuna/languagepacks.json")
        self.assertEqual(SUKUNA_INSTALL_ROOT, os.environ["LOCALAPPDATA"] + "\\Programs\\Sukuna")


# ---- フックの判定（本物の定義・permissions.json・フックの写しで） ----

def _rmtree(path):
    shutil.rmtree(path, ignore_errors=True)


class CopyHookCase(HookTestCase):
    """本物の定義・permissions.json・フックを写した一時のプロジェクトで判定する土台。SUBST は {本物の文字列: 置き換え}
    で、写しの permissions.json の文字列に当てる（当たる数を COUNT で照らす。それ以外は本物とバイトまで同じ）。"""

    SUBST = {}
    COUNT = {}

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._tmp = Path(os.path.realpath(tempfile.mkdtemp(prefix="ai-editor-hooks-a-b-")))
        cls.addClassCleanup(_rmtree, cls._tmp)
        cls.project = make_project(cls._tmp)
        for member in MEMBERS:
            target = next((cls.project / "team" / "departments").glob(f"*/{member}/permissions.json"))
            text = target.read_text(encoding="utf-8")
            for old, new in cls.SUBST.items():
                o, n = json.dumps(old)[1:-1], json.dumps(new)[1:-1]
                if text.count(o) != cls.COUNT.get((member, old), 0):
                    raise AssertionError(f"置き換える文字列の数が違う: {member} {old}")
                text = text.replace(o, n)
            target.write_text(text, encoding="utf-8")

    def judge(self, member, tool, tool_input):
        return run(event(tool, tool_input, agent_type=member, cwd=str(self.project)), project=self.project)

    def passes(self, member, commands):
        for c in commands:
            with self.subTest(member=member, command=c[:120]):
                code, err = self.judge(member, "Bash", {"command": c})
                self.assertEqual(code, 0, f"通るはずが止まった: {member}: {c[:200]!r}\n{err}")

    def blocks(self, member, commands, contains=None):
        for c in commands:
            with self.subTest(member=member, command=c[:120]):
                code, err = self.judge(member, "Bash", {"command": c})
                self.assertEqual(code, 2, f"止まるはずが通った（{code}）: {member}: {c[:200]!r}\n{err}")
                if contains:
                    self.assertIn(contains, err)

    def tool_passes(self, member, tool, tool_input):
        with self.subTest(member=member, tool=tool, input=str(tool_input)[:120]):
            code, err = self.judge(member, tool, tool_input)
            self.assertEqual(code, 0, f"通るはずが止まった: {member}: {tool} {tool_input}\n{err}")

    def tool_blocks(self, member, tool, tool_input):
        with self.subTest(member=member, tool=tool, input=str(tool_input)[:120]):
            code, err = self.judge(member, tool, tool_input)
            self.assertEqual(code, 2, f"止まるはずが通った（{code}）: {member}: {tool} {tool_input}\n{err}")


def flip(ch):
    if ch.isalpha():
        return ch.swapcase()
    return "A" if ch != "A" else "B"


def mutations(line):
    """1文字でも違う形・足した形（29形）。"""
    prefix, b64 = line.rsplit(" ", 1)
    out = []
    for i in (0, 1, len(b64) // 2, len(b64) - 3, len(b64) - 1):
        out.append(f"{prefix} {b64[:i]}{flip(b64[i])}{b64[i + 1:]}")
    out += [
        f"{prefix} {b64[:-1]}",                     # 1文字欠ける
        f"{prefix} {b64}A",                          # 1文字足す
        f"{line} -Command Remove-Item x",            # 後ろに足す
        f"{line} x",
        f"{line} -NoExit",
        f"{line}; whoami",
        f"{line} && whoami",
        f"{line} | Out-File x",
        f"X=1 {line}",                               # 前に環境変数
        f"PSModulePath=x {line}",
        f"env {line}",
        f"command {line}",
        line.replace("powershell ", "powershell.exe ", 1),
        line.replace("powershell ", "PowerShell ", 1),
        line.replace("powershell ", "pwsh ", 1),
        line.replace("powershell ", "C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe ", 1),
        line.replace(" -NoProfile", "", 1),
        line.replace("-NoProfile -NonInteractive", "-NonInteractive -NoProfile", 1),
        line.replace("-EncodedCommand", "-encodedcommand", 1),
        line.replace("-EncodedCommand", "-enc", 1),
        line.replace("-EncodedCommand", "-e", 1),
        line.replace("-NoProfile ", "-NoProfile  ", 1),  # 空白2つ
        f"{prefix} '{b64}'",                          # 引用符
        f'{prefix} "{b64}"',
    ]
    return out


class ShortcutHookTest(CopyHookCase):
    """A の2行の判定。持ち主にだけ通り、1文字でも違う形・足した形・別の台本の形は止まる。"""

    def test_lines_pass_for_owners_only(self):
        self.passes(MT, [A_CREATE, S_CREATE])
        self.passes(OE, [A_READ, S_READ])
        self.blocks(MT, [A_READ, S_READ], contains="ホワイトリストに無い")
        self.blocks(OE, [A_CREATE, S_CREATE], contains="ホワイトリストに無い")
        self.blocks(CS, [A_CREATE, A_READ, S_CREATE, S_READ])
        self.blocks(DR, [A_CREATE, A_READ, S_CREATE, S_READ])

    def test_surrounding_spaces_only(self):
        # フックは断片の前後の空白を落としてから照らす（語は増えない）
        self.passes(MT, [f" {A_CREATE}", f"{A_CREATE} ", f" {S_CREATE}"])
        self.passes(OE, [f"{A_READ}  ", f"{S_READ} "])

    def test_mutations_blocked(self):
        for member, line in ((MT, A_CREATE), (OE, A_READ), (MT, S_CREATE), (OE, S_READ)):
            forms = mutations(line)
            self.assertEqual(len(forms), 29)
            self.assertNotIn(line, forms)
            self.blocks(member, forms)

    def test_other_scripts_with_the_same_prefix_blocked(self):
        other = CREATE_PS.replace("$cur + '\\Shuko.exe'", "'C:\\Windows\\System32\\cmd.exe'")
        self.assertNotEqual(other, CREATE_PS)
        self.blocks(MT, [ps_line(other), ps_line(CREATE_PS + "Remove-Item x\n"),
                         ps_line(CREATE_PS.replace("Shuko.lnk", "Shuko2.lnk"))])
        self.blocks(OE, [ps_line(READ_PS.replace("Shuko.lnk", "Shuko2.lnk")), ps_line(READ_PS + "Remove-Item x\n"),
                         ps_line(CREATE_PS)])
        # Sukuna の行も同じ（名前を取り違えた形・改行を CR LF にした形・NFD の形も止まる）
        self.blocks(MT, [ps_line(S_CREATE_PS.replace("Sukuna.lnk", "Sukuna2.lnk")), ps_line(S_CREATE_PS + "Remove-Item x\n"),
                         ps_line(CREATE_PS.replace("Shuko.lnk", "Sukuna.lnk")), ps_line(S_CREATE_PS.replace("\n", "\r\n")),
                         ps_line(unicodedata.normalize("NFD", S_CREATE_PS))])
        self.blocks(OE, [ps_line(S_READ_PS.replace("Sukuna.lnk", "Sukuna2.lnk")), ps_line(S_CREATE_PS)])

    def test_command_form_blocked(self):
        # -Command の二重引用符の形は、括弧でフックに止まる（採らなかった書き方。perm-proposal.md の 4.1節）
        script = "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('x.lnk'); $s.Save()"
        self.blocks(MT, [f'powershell -NoProfile -Command "{script}"'], contains="括弧")


# B の行の形（perm-proposal.md の 5.2節）
CMD = SHUKO_CMD
U = f"{CMD} --uninstall-extension="
# 通る形（値は STAR.STAR）。上の4つが用途。下は、通るが害の無い形（値が - で始まる・= を含む・.vsix で終わる・@ 付き）
USE = ["MS-CEINTL.vscode-language-pack-ja", "ms-ceintl.vscode-language-pack-ja", "mechatroner.rainbow-csv",
       "anthropic.claude-code"]
HARMLESS = ["--install-extension=evil.vsix", "-x.y", "--extensions-dir=x.y", "x.vsix", "a.b@1.0.0", "a.b.c", "a.b=c"]
BLOCKED = [
    # 空白でつないだ形（依頼の前方一致の形）と、後ろに足した形
    f"{CMD} --uninstall-extension MS-CEINTL.vscode-language-pack-ja",
    f"{U}MS-CEINTL.vscode-language-pack-ja --force",
    f"{U}MS-CEINTL.vscode-language-pack-ja --extensions-dir C:/x",
    f"{U}MS-CEINTL.vscode-language-pack-ja --extensions-dir=x.y",
    f"{U}MS-CEINTL.vscode-language-pack-ja --user-data-dir x",
    f"{U}MS-CEINTL.vscode-language-pack-ja --install-extension a.b",
    f"{U}MS-CEINTL.vscode-language-pack-ja b.c",
    f"{U}MS-CEINTL.vscode-language-pack-ja --uninstall-extension=b.c",
    f"{U}MS-CEINTL.vscode-language-pack-ja --profile x",
    f"{U}MS-CEINTL.vscode-language-pack-ja; whoami",
    f"{U}MS-CEINTL.vscode-language-pack-ja && whoami",
    f"{U}MS-CEINTL.vscode-language-pack-ja | x",
    # 値の形
    f"{U}a", f"{U}a.", f"{U}.", f"{U}", f"{U}a/b.c", f"{U}a\\b.c", f"{U}C:/x.vsix", f"{U}../x.vsix", f"{U}a.b,c.d",
    f'{U}"a.b"', f"{U}'a.b'", f"{U}$X.b", f"{U}%X%.b", f"{U}a.b*", f"{U}a~1.b", f"{U}a b.c", f"{U}a.b c.d",
    # 前に環境変数・前置き
    f"ELECTRON_RUN_AS_NODE=1 {U}a.b", f"VSCODE_PORTABLE=C:/x {U}a.b", f"VSCODE_DEV=1 {U}a.b", f"env {U}a.b",
    f"command {U}a.b",
    # CLI の場所と、ほかの操作
    f"{CMD.replace('/', chr(92))} --uninstall-extension=a.b",
    f"{CMD.replace('C:/Users/kou_z', 'c:/users/kou_z')} --uninstall-extension=a.b",
    f"{CMD.replace('C:/', '/c/')} --uninstall-extension=a.b",
    "shuko --uninstall-extension=a.b", "shuko.cmd --uninstall-extension=a.b",
    f"{CMD.replace('/current/', '/versions/1.146.0-1/')} --uninstall-extension=a.b",
    f"{CMD[:-4]} --uninstall-extension=a.b",
    f"{CMD} --install-extension=a.b", f"{CMD} --list-extensions", f"{CMD} --uninstall-extension=a.b --force",
    f"{CMD} --force --uninstall-extension=a.b", f"{CMD} --uninstall-extension a.b",
]
# languagepacks.json と同じフォルダのほかの物（写しに作る名前。本物の %APPDATA%\Shuko の中身は見ない）
SIBLINGS = ["Local State", "Preferences", "machineid", "languagepacks.json.bak", "User/settings.json",
            "User/globalStorage/state.vscdb", "Local Storage/leveldb/000003.log", "Network/Cookies"]


class UninstallHookTest(CopyHookCase):
    """B の行の判定。外す行は = でつないだ1語の値だけが通り、languagepacks.json は蒙恬がそのファイルだけを読める。
    読み取りは、写しの B_READ を tempfile の下の同じ形のパスに置き換えて照らす（setUpClass で SUBST を決める）。"""

    @classmethod
    def setUpClass(cls):
        tmp = Path(os.path.realpath(tempfile.mkdtemp(prefix="ai-editor-hooks-appdata-")))
        cls.addClassCleanup(_rmtree, tmp)
        cls.shuko = tmp / "AppData" / "Roaming" / "Shuko"
        cls.lp = cls.shuko / "languagepacks.json"
        cls.sukuna = tmp / "AppData" / "Roaming" / "Sukuna"
        cls.slp = cls.sukuna / "languagepacks.json"
        for base in (cls.shuko, cls.sukuna):
            for rel in ["languagepacks.json"] + SIBLINGS:
                (base / rel).parent.mkdir(parents=True, exist_ok=True)
                (base / rel).write_text("{}\n", encoding="utf-8")
        fake, sfake = str(cls.lp).replace("\\", "/"), str(cls.slp).replace("\\", "/")
        if fake.lower() == B_READ.lower() or sfake.lower() == S_LANGPACKS.lower():
            raise AssertionError("置き換えたパスが本物と同じ")
        cls.SUBST = {B_READ: fake, S_LANGPACKS: sfake}
        cls.COUNT = {(MT, B_READ): 1, (MT, S_LANGPACKS): 1}
        super().setUpClass()

    def test_today_line(self):
        self.passes(MT, [B_TODAY, S_TODAY])
        for member in (CS, OE, DR):
            self.blocks(member, [B_TODAY, S_TODAY])
        self.blocks(CS, [B_TODAY, S_TODAY], contains="ホワイトリストに無い")
        self.blocks(OE, [B_TODAY, S_TODAY], contains="ホワイトリストに無い")

    def test_values_that_pass(self):
        self.passes(MT, [U + v for v in USE + HARMLESS])
        self.passes(MT, [f"{SUKUNA_CMD} --uninstall-extension={v}" for v in USE + HARMLESS + ["sukuna.notion-sync"]])

    def test_blocked_forms(self):
        self.assertEqual(len(BLOCKED), 46)
        self.blocks(MT, BLOCKED)
        # Sukuna の CLI でも同じ46形が止まる（CLI の場所と名前を Sukuna にした形）
        sukuna = [b.replace("Shuko", "Sukuna").replace("shuko", "sukuna") for b in BLOCKED]
        self.assertFalse([b for b in sukuna if "shuko" in b.lower()])
        self.assertIn(f"{SUKUNA_CMD} --uninstall-extension MS-CEINTL.vscode-language-pack-ja", sukuna)
        self.blocks(MT, sukuna)
        # 名前を取り違えた形（Sukuna の場所の shuko.cmd・Shuko の場所の sukuna.cmd）も止まる
        self.blocks(MT, [f"{SUKUNA_CMD.replace('sukuna.cmd', 'shuko.cmd')} --uninstall-extension=a.b",
                         f"{SHUKO_CMD.replace('shuko.cmd', 'sukuna.cmd')} --uninstall-extension=a.b"])

    def test_env_var_install_root_cannot_be_written(self):
        # installRoot に合わせて %LOCALAPPDATA% や $LOCALAPPDATA で書く形は、secret_paths（%LOCALAPPDATA%/Shuko/…）の
        # 文字列の検査に当たって止まる。だから決め打ちの絶対パスで書く
        for form in ("%LOCALAPPDATA%/Programs/Shuko/current/bin/shuko.cmd", "$LOCALAPPDATA/Programs/Shuko/current/bin/shuko.cmd",
                     "${LOCALAPPDATA}/Programs/Shuko/current/bin/shuko.cmd"):
            self.blocks(MT, [f"{form} --uninstall-extension=a.b"], contains="secret_paths")

    def test_read_only_that_file(self):
        lp = str(self.lp)
        self.tool_passes(MT, "Read", {"file_path": lp})
        self.tool_passes(MT, "Read", {"file_path": lp.replace("\\", "/")})
        self.tool_passes(MT, "Grep", {"pattern": "ja", "path": lp})
        for member in (CS, OE, DR):
            self.tool_blocks(member, "Read", {"file_path": lp})
        for rel in SIBLINGS:
            self.tool_blocks(MT, "Read", {"file_path": str(self.shuko / rel)})
        self.tool_blocks(MT, "Read", {"file_path": str(self.shuko)})
        self.tool_blocks(MT, "Glob", {"pattern": "*", "path": str(self.shuko)})
        self.tool_blocks(MT, "Grep", {"pattern": "x", "path": str(self.shuko)})
        self.tool_blocks(MT, "Read", {"file_path": lp + ":x"})
        self.tool_blocks(MT, "Read", {"file_path": lp + "x"})
        # 大文字小文字だけ違う形は同じファイル（NTFS は区別しない）なので通る
        self.tool_passes(MT, "Read", {"file_path": lp.replace("languagepacks", "LANGUAGEPACKS")})

    def test_read_only_the_sukuna_file(self):
        # 2026-11-20 改名の段1: Sukuna の languagepacks.json も、そのファイルだけ
        slp = str(self.slp)
        self.tool_passes(MT, "Read", {"file_path": slp})
        self.tool_passes(MT, "Grep", {"pattern": "ja", "path": slp})
        for member in (CS, OE, DR):
            self.tool_blocks(member, "Read", {"file_path": slp})
        for rel in SIBLINGS:
            self.tool_blocks(MT, "Read", {"file_path": str(self.sukuna / rel)})
        self.tool_blocks(MT, "Read", {"file_path": str(self.sukuna)})
        self.tool_blocks(MT, "Glob", {"pattern": "*", "path": str(self.sukuna)})
        self.tool_blocks(MT, "Grep", {"pattern": "x", "path": str(self.sukuna)})
        self.tool_blocks(MT, "Read", {"file_path": slp + ":x"})
        self.tool_blocks(MT, "Read", {"file_path": slp + "x"})

    def test_cannot_write_it(self):
        for tool, extra in (("Write", {"content": "{}"}), ("Edit", {"old_string": "a", "new_string": "b"})):
            self.tool_blocks(MT, tool, {"file_path": str(self.lp), **extra})
            self.tool_blocks(MT, tool, {"file_path": str(self.slp), **extra})


# ---- A の行の効き目（tempfile の下の写しの行で） ----

NFC = unicodedata.normalize("NFC", "デスクトップ")
NFD = unicodedata.normalize("NFD", "デスクトップ")


def find_git_bash():
    """Git for Windows の bash.exe（WSL の bash ではない）。見つからなければ None。"""
    if sys.platform != "win32":
        return None
    cands = [Path(os.environ["SHELL"])] if os.environ.get("SHELL", "").lower().endswith("bash.exe") else []
    git = shutil.which("git")
    if git:
        g = Path(git).resolve()
        for up in (g.parent.parent, g.parent.parent.parent):
            cands += [up / "bin" / "bash.exe", up / "usr" / "bin" / "bash.exe"]
    cands += [Path(r"C:\Program Files\Git\bin\bash.exe"), Path(r"C:\Program Files\Git\usr\bin\bash.exe")]
    for c in cands:
        if c.is_file():
            r = subprocess.run([str(c), "--version"], capture_output=True, text=True, encoding="utf-8", errors="replace")
            # Git for Windows の bash は x86_64-pc-msys（新しい版は x86_64-pc-cygwin）と名乗る。WSL の bash は linux-gnu
            if r.returncode == 0 and ("pc-msys" in r.stdout or "pc-cygwin" in r.stdout):
                return str(c)
    return None


GIT_BASH = find_git_bash()
POWERSHELL = shutil.which("powershell") if sys.platform == "win32" else None


def to_bash_path(p):
    return str(p).replace("\\", "/")


def ps_quote(path):
    return "'" + str(path).replace("'", "''") + "'"


@unittest.skipIf(GIT_BASH is None or POWERSHELL is None, "Git Bash か PowerShell が無い")
class ShortcutEffectsTest(unittest.TestCase):
    """A の行を Git Bash から PowerShell に渡して、tempfile の下で .lnk を作る・読む。"""

    @classmethod
    def setUpClass(cls):
        import _winapi
        cls.tmp = Path(os.path.realpath(tempfile.mkdtemp(prefix="ai-editor-hooks-lnk-")))
        cls.addClassCleanup(_rmtree, cls.tmp)
        cls.desk = cls.tmp / "Users" / "kou_z" / "OneDrive" / NFC
        cls.desk.mkdir(parents=True)
        cls.root = cls.tmp / "AppData" / "Local" / "Programs" / "Shuko"
        ver = cls.root / "versions" / "1.146.0-6"
        ver.mkdir(parents=True)
        (ver / "Shuko.exe").write_bytes(b"MZ fake")
        _winapi.CreateJunction(str(ver), str(cls.root / "current"))
        cls.sroot = cls.tmp / "AppData" / "Local" / "Programs" / "Sukuna"  # 2026-11-20 改名の段1
        sver = cls.sroot / "versions" / "1.146.0-p5-c-all-r7"
        sver.mkdir(parents=True)
        (sver / "Sukuna.exe").write_bytes(b"MZ fake")
        _winapi.CreateJunction(str(sver), str(cls.sroot / "current"))
        cls.dump = cls.tmp / "dump_args.py"
        cls.dump.write_text(
            "import json, sys\n"
            "open(sys.argv[1], 'w', encoding='utf-8').write(json.dumps(sys.argv[2:], ensure_ascii=False))\n",
            encoding="utf-8")

    def setUp(self):
        for p in list(self.desk.iterdir()):
            p.unlink()
        self.other = self.desk / "memo.txt"
        self.other.write_text("ほかのファイル\n", encoding="utf-8")

    # ---- 走らせる道具（tempfile の下のパスだけを渡す） ----

    def safe(self, script):
        """走らせる台本が、本物のデスクトップ・installRoot・%APPDATA% を指さないこと。"""
        low = script.lower()
        for real in (DESKTOP, INSTALL_ROOT, "\\AppData\\Roaming\\Shuko", SUKUNA_INSTALL_ROOT, "\\AppData\\Roaming\\Sukuna"):
            if real.lower() in low.replace(str(self.tmp).lower(), "<tmp>"):
                raise AssertionError(f"本物のパスを指す台本は走らせない: {real}")
        return script

    def run_bash(self, line):
        """許可の行を、Git Bash の bash -c にそのまま渡して走らせる（Claude Code の Bash ツールと同じ渡り方）。"""
        if line.startswith(PS_PREFIX):
            self.safe(decode(line.split(" ")[-1]))
        r = subprocess.run([GIT_BASH, "-c", line], cwd=str(self.tmp), capture_output=True, timeout=300)
        return r.returncode, r.stdout.decode("utf-8", "replace"), r.stderr.decode("utf-8", "replace")

    def run_ps(self, script):
        """テストの中で .lnk を確かめるための PowerShell。"""
        self.safe(script)
        r = subprocess.run([POWERSHELL, "-NoProfile", "-NonInteractive", "-EncodedCommand", encode(script)],
                           capture_output=True, timeout=120)
        return r.returncode, r.stdout.decode("utf-8", "replace"), r.stderr.decode("utf-8", "replace")

    def lnk_props(self, lnk):
        script = ("[Console]::OutputEncoding = [Text.Encoding]::UTF8\n"
                  f"$r = (New-Object -ComObject WScript.Shell).CreateShortcut({ps_quote(lnk)})\n"
                  "$o = [ordered]@{TargetPath=$r.TargetPath; WorkingDirectory=$r.WorkingDirectory; Arguments=$r.Arguments;"
                  " IconLocation=$r.IconLocation; Hotkey=$r.Hotkey; WindowStyle=$r.WindowStyle; Description=$r.Description}\n"
                  "$o | ConvertTo-Json -Compress\n")
        code, out, err = self.run_ps(script)
        self.assertEqual(code, 0, f"lnk を読めない: {err}")
        return json.loads(out.strip().splitlines()[-1])

    # ---- 置き換えた写しの行 ----

    def variant(self, script, desk=None):
        desk = self.desk if desk is None else desk
        self.assertEqual(script.count(DESKTOP), 1)
        out = script.replace(DESKTOP, str(desk))
        if INSTALL_ROOT in script:
            self.assertEqual(script.count(INSTALL_ROOT), 1)
            out = out.replace(INSTALL_ROOT, str(self.root))
        if SUKUNA_INSTALL_ROOT in script:
            self.assertEqual(script.count(SUKUNA_INSTALL_ROOT), 1)
            out = out.replace(SUKUNA_INSTALL_ROOT, str(self.sroot))
        return ps_line(self.safe(out))

    def test_variant_differs_only_in_paths(self):
        for real_line, script in ((A_CREATE, CREATE_PS), (A_READ, READ_PS)):
            with self.subTest(script=script.splitlines()[1]):
                v = self.variant(script)
                self.assertTrue(v.startswith(PS_PREFIX))
                self.assertEqual(v.split(" ")[:-1], real_line.split(" ")[:-1])  # 前の4語は同じ
                back = decode(v.split(" ")[-1]).replace(str(self.desk), DESKTOP).replace(str(self.root), INSTALL_ROOT)
                self.assertEqual(back, decode(real_line.split(" ")[-1]))
                self.assertEqual(decode(real_line.split(" ")[-1]), script)

    # ---- Git Bash の渡り方 ----

    def args_via_bash(self, line):
        """行の先頭の powershell を、引数を書き出す python に替えて Git Bash に渡す（powershell は走らない）。"""
        out = self.tmp / "args.json"
        if out.exists():
            out.unlink()
        prog = f"{to_bash_path(sys.executable)} {to_bash_path(self.dump)} {to_bash_path(out)}"
        self.assertTrue(line.startswith("powershell "))
        r = subprocess.run([GIT_BASH, "-c", prog + line[len("powershell"):]], cwd=str(self.tmp), capture_output=True,
                           timeout=300)
        self.assertEqual(r.returncode, 0, r.stderr.decode("utf-8", "replace"))
        return json.loads(out.read_text(encoding="utf-8"))

    def test_real_line_args_survive_git_bash(self):
        for line in (A_CREATE, A_READ, self.variant(CREATE_PS), self.variant(READ_PS)):
            with self.subTest(line=line[:60]):
                self.assertEqual(self.args_via_bash(line), line.split(" ")[1:])

    def test_command_form_would_be_changed_by_git_bash(self):
        # 比べるための確かめ（-Command の案を採らない理由の1つ）。二重引用符の中の $ は Git Bash が展開する
        got = self.args_via_bash('powershell -NoProfile -Command "$s = $ws.CreateShortcut($lnk)"')
        self.assertEqual(got, ["-NoProfile", "-Command", " = .CreateShortcut()"])

    # ---- 作る行 ----

    def create(self, desk=None):
        return self.run_bash(self.variant(CREATE_PS, desk))

    def test_create_makes_exactly_one_lnk(self):
        code, out, err = self.create()
        self.assertEqual(code, 0, err)
        exe = str(self.root / "current" / "Shuko.exe")
        self.assertEqual(out.split(), [f"TargetPath={exe}", f"WorkingDirectory={self.root / 'current'}", "Arguments="])
        self.assertEqual(sorted(p.name for p in self.desk.iterdir()), ["Shuko.lnk", "memo.txt"])
        self.assertEqual(self.other.read_text(encoding="utf-8"), "ほかのファイル\n")
        props = self.lnk_props(self.desk / "Shuko.lnk")
        self.assertEqual(props["TargetPath"], exe)  # current を通したまま（版のフォルダに解かない）
        self.assertIn("\\current\\", props["TargetPath"])
        self.assertEqual(props["WorkingDirectory"], str(self.root / "current"))
        self.assertEqual(props["Arguments"], "")
        self.assertEqual(props["Hotkey"], "")
        self.assertEqual(props["WindowStyle"], 1)
        self.assertEqual(props["Description"], "")
        self.assertIn(props["IconLocation"], (",0", f"{exe},0"))

    def test_recreate_drops_old_properties(self):
        lnk = self.desk / "Shuko.lnk"
        code, _, err = self.run_ps(
            f"$s = (New-Object -ComObject WScript.Shell).CreateShortcut({ps_quote(lnk)})\n"
            f"$s.TargetPath = {ps_quote(self.tmp / 'evil.exe')}\n"
            "$s.Arguments = '--evil --user-data-dir x'\n"
            f"$s.IconLocation = {ps_quote(self.tmp / 'evil.ico')} + ',3'\n"
            "$s.Hotkey = 'Ctrl+Alt+Q'\n$s.Description = 'old'\n$s.WindowStyle = 7\n$s.Save()\n")
        self.assertEqual(code, 0, err)
        self.assertEqual(self.lnk_props(lnk)["Arguments"], "--evil --user-data-dir x")
        code, out, err = self.create()
        self.assertEqual(code, 0, err)
        props = self.lnk_props(lnk)
        self.assertEqual(props["TargetPath"], str(self.root / "current" / "Shuko.exe"))
        self.assertEqual((props["Arguments"], props["Hotkey"], props["Description"], props["WindowStyle"]), ("", "", "", 1))
        self.assertNotIn("evil", props["IconLocation"])

    def test_nfd_desktop_name_is_a_different_folder(self):
        nfd_desk = self.desk.parent / NFD
        self.assertNotEqual(str(nfd_desk), str(self.desk))
        self.assertFalse(nfd_desk.exists())
        code, out, err = self.create(desk=nfd_desk)
        self.assertNotEqual(code, 0)
        self.assertFalse(nfd_desk.exists())  # 分解した形のフォルダは作らない
        self.assertEqual(sorted(p.name for p in self.desk.iterdir()), ["memo.txt"])

    def test_missing_desktop_fails_without_creating(self):
        gone = self.tmp / "Users" / "kou_z" / "Desktop"
        code, out, err = self.create(desk=gone)
        self.assertNotEqual(code, 0)
        self.assertFalse(gone.exists())

    # ---- 読む行（大岡越前守） ----

    def test_read_line_reads_two_values_and_does_not_save(self):
        code, _, err = self.create()
        self.assertEqual(code, 0, err)
        lnk = self.desk / "Shuko.lnk"
        before = (lnk.read_bytes(), lnk.stat().st_mtime_ns)
        code, out, err = self.run_bash(self.variant(READ_PS))
        self.assertEqual(code, 0, err)
        self.assertEqual(out.split(), [f"TargetPath={self.root / 'current' / 'Shuko.exe'}",
                                       f"WorkingDirectory={self.root / 'current'}"])
        self.assertEqual((lnk.read_bytes(), lnk.stat().st_mtime_ns), before)
        self.assertEqual(sorted(p.name for p in self.desk.iterdir()), ["Shuko.lnk", "memo.txt"])
        self.assertNotIn("Save", READ_PS)

    def test_sukuna_lines_make_and_read_one_lnk(self):
        # 2026-11-20 改名の段1: Sukuna の作る行は Sukuna.lnk だけを作り、Shuko.lnk には触れない。読む行は保存しない
        old = self.desk / "Shuko.lnk"
        old.write_bytes(b"old shuko lnk")
        for script, real_line in ((S_CREATE_PS, S_CREATE), (S_READ_PS, S_READ)):
            v = self.variant(script)
            back = decode(v.split(" ")[-1]).replace(str(self.desk), DESKTOP).replace(str(self.sroot), SUKUNA_INSTALL_ROOT)
            self.assertEqual(back, decode(real_line.split(" ")[-1]))
        code, out, err = self.run_bash(self.variant(S_CREATE_PS))
        self.assertEqual(code, 0, err)
        exe = str(self.sroot / "current" / "Sukuna.exe")
        self.assertEqual(out.split(), [f"TargetPath={exe}", f"WorkingDirectory={self.sroot / 'current'}", "Arguments="])
        self.assertEqual(sorted(p.name for p in self.desk.iterdir()), ["Shuko.lnk", "Sukuna.lnk", "memo.txt"])
        self.assertEqual(old.read_bytes(), b"old shuko lnk")
        lnk = self.desk / "Sukuna.lnk"
        before = (lnk.read_bytes(), lnk.stat().st_mtime_ns)
        code, out, err = self.run_bash(self.variant(S_READ_PS))
        self.assertEqual(code, 0, err)
        self.assertEqual(out.split(), [f"TargetPath={exe}", f"WorkingDirectory={self.sroot / 'current'}"])
        self.assertEqual((lnk.read_bytes(), lnk.stat().st_mtime_ns), before)
        self.assertEqual(self.args_via_bash(S_CREATE), S_CREATE.split(" ")[1:])

    def test_read_line_missing_lnk_exits_3(self):
        code, out, err = self.run_bash(self.variant(READ_PS))
        self.assertEqual(code, 3, err)
        self.assertEqual(out.split(), ["missing"])
        self.assertEqual(sorted(p.name for p in self.desk.iterdir()), ["memo.txt"])


if __name__ == "__main__":
    unittest.main()
