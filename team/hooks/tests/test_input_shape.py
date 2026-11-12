"""差し戻し1回目の対応のテスト: 改行・制御文字の扱いと、フック入力の形の検査。

- 1. CR 単独・U+0085・U+2028・U+2029・\\v・\\f などを含むコマンドは止まる。CR LF は LF と同じ区切り。
     bash の行継続（\\ LF・\\ CR LF）の読み方は変わらない。
- 2. トップレベルがオブジェクトでない、agent_type が文字列でない、tool_input・command・パスの引数の形が違う
     入力は止まる。素通しは agent_type が未定義・空文字・vlad-tepes のときだけ。

実行: python -m unittest discover -s projects/ai-editor/team/hooks/tests
"""

import json
import tempfile
import unittest

from hookrun import PROJECT, HookTestCase, event, make_project, run

# 区切りとして数えずに止める文字
BAD_CHARS = {
    "CR": "\r",
    "VT": "\x0b",
    "FF": "\x0c",
    "NEL": "\x85",
    "LS": "\u2028",
    "PS": "\u2029",
    "FS": "\x1c",
    "GS": "\x1d",
    "RS": "\x1e",
    "NUL": "\x00",
    "ESC": "\x1b",
    "DEL": "\x7f",
    "C1": "\x9b",
}


def shapes(bad):
    """bad を区切りに使うコマンドの形。"""
    return [
        f"git status {bad} calc",
        f"git status{bad}calc",
        f"git status {bad}calc",
        f"git status{bad} calc",
        f"git status {bad}",
        f"{bad}git status",
        f"git status\n{bad}calc",
        f"git status && git diff {bad} calc",
        f"git log --grep '{bad}'",  # 単一引用符の中でも止める
    ]


class LineBreakTest(HookTestCase):
    def test_bad_line_chars_are_blocked_for_every_member_with_bash(self):
        for member in ("meng-tian", "cao-shen", "ooka-echizen"):
            for name, bad in BAD_CHARS.items():
                for command in shapes(bad):
                    with self.subTest(member=member, char=name, command=repr(command)):
                        self.assertBlock(self.bash(member, command), "区切りとして扱えない改行・制御文字")

    def test_reported_case(self):
        # 検証で通っていた形（verification.md 3 の a・b）
        for command in ("git status \r calc", "git status \u2028 calc", "git status \x85 calc", "git status \u2029 calc"):
            with self.subTest(command=repr(command)):
                err = self.assertBlock(self.bash("meng-tian", command))
                self.assertIn("U+", err)

    def test_crlf_is_one_newline(self):
        self.assertPass(self.bash("meng-tian", "git status\r\ngit diff"))
        self.assertPass(self.bash("meng-tian", "git status\r\ngit diff\r\n"))
        self.assertPass(self.bash("meng-tian", "git status\r\n\r\ngit diff --stat"))
        self.assertBlock(self.bash("meng-tian", "git status\r\ncalc"), "ホワイトリストに無いコマンドです: calc")
        self.assertBlock(self.bash("meng-tian", "git status \r\n calc"), "ホワイトリストに無いコマンドです: calc")
        # CR CR LF の前の CR は単独の CR
        self.assertBlock(self.bash("meng-tian", "git status\r\r\ngit diff"), "区切りとして扱えない")

    def test_tab_is_not_a_bad_char(self):
        # タブは改行・制御文字の検査では止めない。「許可＋半角空白」の前方一致にならないので、照合で止まる
        err = self.assertBlock(self.bash("meng-tian", "git status\t--short"))
        self.assertNotIn("区切りとして扱えない", err)
        self.assertIn("ホワイトリストに無い", err)
        self.assertPass(self.bash("meng-tian", "git log --oneline -5\t"))  # 末尾のタブは trim で落ちる

    def test_line_continuation_reading_is_kept(self):
        # bash の行継続をつないでから検査する箇所（置換・括弧の検査と git の書き出し）は、LF でも CR LF でも効く
        cases = {
            "git diff $\\\n(rm x)": "コマンド置換",
            "git diff $\\\r\n(rm x)": "コマンド置換",
            "git log --out\\\nput=x.txt": "git のファイルへ書き出す",
            "git log --out\\\r\nput=x.txt": "git のファイルへ書き出す",
            # 第2段: format-patch はサブコマンド名を行継続で割っても読み取り、-o の書き出し先を照合する
            "git -C C:/b/wt/x format-pa\\\r\ntch -o C:/Windows HEAD~1": "format-patch の書き出し",
        }
        for command, reason in cases.items():
            with self.subTest(command=repr(command)):
                self.assertBlock(self.bash("meng-tian", command), reason)
        # 行継続の後ろも断片として許可に照らす（後ろが許可に無ければ止まる。これまでと同じ）
        self.assertBlock(self.bash("meng-tian", "git status \\\ncalc"), "ホワイトリストに無いコマンドです: calc")
        self.assertBlock(self.bash("meng-tian", "git status \\\r\ncalc"), "ホワイトリストに無いコマンドです: calc")

    def test_powershell_tool_too(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = make_project(tmp)
            definition = project / ".claude" / "agents" / "meng-tian.md"
            text = definition.read_text(encoding="utf-8").replace("tools: Read,", "tools: PowerShell, Read,", 1)
            definition.write_text(text, encoding="utf-8")

            def ps(command):
                return event("PowerShell", {"command": command}, agent_type="meng-tian", cwd=str(project))

            code, err = run(ps("git status\r\ngit diff"), project=project)
            self.assertEqual(code, 0, err)
            for name, bad in BAD_CHARS.items():
                for command in (f"git status {bad} Remove-Item x", f"git status{bad}Remove-Item x"):
                    with self.subTest(char=name, command=repr(command)):
                        code, err = run(ps(command), project=project)
                        self.assertEqual(code, 2, err)
                        self.assertIn("区切りとして扱えない", err)


class TopLevelShapeTest(HookTestCase):
    MEMBER_EVENT = {"hook_event_name": "PreToolUse", "agent_type": "meng-tian", "tool_name": "Bash",
                    "tool_input": {"command": "rm -rf x"}, "cwd": str(PROJECT)}

    def test_non_object_input_is_blocked(self):
        raws = ["[1]", "[]", "[{}]", json.dumps([self.MEMBER_EVENT]), '"x"', "1", "true", "false", "null", "{"]
        for raw in raws:
            for via_guard in (False, True):
                with self.subTest(raw=raw, via_guard=via_guard):
                    code, err = run(None, raw=raw, via_guard=via_guard)
                    self.assertEqual(code, 2, err)

    def test_non_object_input_is_blocked_in_arg_mode(self):
        for raw in ("[1]", "null", '"x"'):
            with self.subTest(raw=raw):
                code, err = run(None, raw=raw, args=("meng-tian",))
                self.assertEqual(code, 2, err)


class AgentTypeShapeTest(HookTestCase):
    def ev(self, agent_type, tool="Write", tool_input=None):
        e = {"hook_event_name": "PreToolUse", "tool_name": tool,
             "tool_input": tool_input or {"file_path": "E:/x", "content": "x"}, "cwd": str(PROJECT),
             "agent_type": agent_type}
        return e

    def test_non_string_agent_type_is_blocked(self):
        for agent_type in (["meng-tian"], ["vlad-tepes"], [], {"id": "meng-tian"}, {}, 1, 0, True, False, None):
            with self.subTest(agent_type=agent_type):
                self.assertBlock(self.ev(agent_type), "agent_type が文字列ではない")
                self.assertBlock(self.ev(agent_type, "Bash", {"command": "git status"}), "agent_type が文字列ではない")

    def test_only_three_values_pass_through(self):
        # 未定義
        e = self.ev("x")
        del e["agent_type"]
        self.assertPass(e)
        # 空文字・vlad-tepes
        self.assertPass(self.ev(""))
        self.assertPass(self.ev("vlad-tepes"))
        # それ以外の文字列は検査される（似た形でも）
        for agent_type in ("Vlad-Tepes", "vlad-tepes-x", " ", "Explore", "plugin:vlad-tepes"):
            with self.subTest(agent_type=agent_type):
                self.assertBlock(self.ev(agent_type))


class ToolInputShapeTest(HookTestCase):
    def raw_event(self, member, tool, tool_input, **extra):
        e = {"hook_event_name": "PreToolUse", "agent_type": member, "tool_name": tool, "cwd": str(PROJECT)}
        if tool_input is not ...:
            e["tool_input"] = tool_input
        e.update(extra)
        return e

    def test_tool_input_must_be_object(self):
        for tool_input in (..., None, [], ["git status"], "git status", 1, True):
            for tool, member in (("Bash", "meng-tian"), ("Read", "di-renjie"), ("StructuredOutput", "di-renjie"),
                                 ("WebSearch", "meng-tian")):
                with self.subTest(tool=tool, tool_input=tool_input):
                    self.assertBlock(self.raw_event(member, tool, tool_input), "tool_input がオブジェクトではない")

    def test_tool_name_and_event_name_and_cwd_must_be_strings(self):
        ok_input = {"command": "git status"}
        self.assertPass(self.raw_event("meng-tian", "Bash", ok_input))  # 対照
        for bad in (["Bash"], None, 1, {}):
            with self.subTest(tool_name=bad):
                self.assertBlock(self.raw_event("meng-tian", bad, ok_input), "tool_name が文字列ではない")
            with self.subTest(hook_event_name=bad):
                self.assertBlock(self.raw_event("meng-tian", "Bash", ok_input, hook_event_name=bad),
                                 "hook_event_name が文字列ではない")
            with self.subTest(cwd=bad):
                self.assertBlock(self.raw_event("meng-tian", "Bash", ok_input, cwd=bad), "cwd が文字列ではない")
        # cwd が配列のとき、相対パスをプロジェクト直下から解く扱い（不明）にしない
        self.assertBlock(self.raw_event("cao-shen", "Read", {"file_path": "tests/a.mjs"}, cwd=[str(PROJECT)]))

    def test_command_must_be_a_nonempty_string(self):
        for member in ("meng-tian", "cao-shen", "ooka-echizen"):
            for command in (["git status"], ["git status", "calc"], {"0": "git status"}, 1, True, None):
                with self.subTest(member=member, command=command):
                    self.assertBlock(self.raw_event(member, "Bash", {"command": command}), "command が文字列ではない")
            with self.subTest(member=member, command="(無い)"):
                self.assertBlock(self.raw_event(member, "Bash", {"description": "x"}), "command が文字列ではない")
            for command in ("", " ", "\n", ";", " && ", "\r\n"):
                with self.subTest(member=member, command=repr(command)):
                    self.assertBlock(self.raw_event(member, "Bash", {"command": command}), "空のコマンド")

    def test_path_arguments_must_be_strings(self):
        bad_values = (["docs/README.md"], {"p": "docs/README.md"}, 1, True, None)
        for bad in bad_values:
            for member, tool, key in (
                ("meng-tian", "Write", "file_path"),
                ("meng-tian", "Edit", "file_path"),
                ("cao-shen", "Read", "file_path"),
                ("di-renjie", "Read", "file_path"),
            ):
                with self.subTest(member=member, tool=tool, value=bad):
                    self.assertBlock(self.raw_event(member, tool, {key: bad, "content": "x"}), "文字列ではない")
            with self.subTest(tool="Glob pattern", value=bad):
                self.assertBlock(self.raw_event("cao-shen", "Glob", {"pattern": bad, "path": "docs"}), "文字列ではない")
            with self.subTest(tool="Glob path", value=bad):
                self.assertBlock(self.raw_event("cao-shen", "Glob", {"pattern": "*.md", "path": bad}), "文字列ではない")
            with self.subTest(tool="Grep path", value=bad):
                self.assertBlock(self.raw_event("cao-shen", "Grep", {"pattern": "x", "path": bad}), "文字列ではない")
            with self.subTest(tool="Grep glob", value=bad):
                self.assertBlock(self.raw_event("cao-shen", "Grep", {"pattern": "x", "path": "docs", "glob": bad}),
                                 "文字列ではない")
        # 無い file_path も止まる
        for member, tool in (("meng-tian", "Write"), ("meng-tian", "Edit"), ("cao-shen", "Read")):
            with self.subTest(member=member, tool=tool, value="(無い)"):
                self.assertBlock(self.raw_event(member, tool, {"path": "docs/README.md"}), "文字列ではない")
        # 対照: 文字列なら通る（cao-shen は read_paths に ./ を持つ）
        self.assertPass(self.raw_event("cao-shen", "Glob", {"pattern": "*.md", "path": "docs"}))
        self.assertPass(self.raw_event("cao-shen", "Grep", {"pattern": "x", "path": "docs", "glob": "*.md"}))
        self.assertPass(self.raw_event("cao-shen", "Glob", {"pattern": "*.md"}))  # path を省いたとき
        self.assertPass(self.raw_event("cao-shen", "Glob", {"pattern": "*.md", "path": ""}))


if __name__ == "__main__":
    unittest.main()
