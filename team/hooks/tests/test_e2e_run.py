"""e2e_run.py のうち、claude を起動しない部分の単体テスト。

- --list が手順と操作の一覧を出す
- scrub_env が Claude Code の渡す環境変数を外す
- 起動の引数: 権限の確認を外さない（dontAsk）・--allowedTools は副作用の無いものだけ・プロンプトが最後
- 手順のプロンプトに、削除・外部への通信・git の書き換えが無く、書き込みは e2e/ か存在しない一時の場所だけ
- stream-json の tool_result から、止めた／フックは通した／通した／判定できない を見分ける
- 期待と照らした OK / FAIL / UNKNOWN と、手順 8・9・11 の判定
- 1回の流れ（run_claude を差し替え）と、手順 6 の guard の退避と復帰（一時のファイルで）

実行: python -m unittest discover -s projects/ai-editor/team/hooks/tests
"""

import contextlib
import io
import json
import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import e2e_run

HOOK_DENIAL = ("PreToolUse:Bash hook error: [node ${CLAUDE_PROJECT_DIR}/team/hooks/guard.js allowlist.js]: "
               "[allowlist] di-renjie: 定義の tools に無いツールです: Bash")
HOOK_DENIAL_SHORT = "PreToolUse:Bash hook error: [command hook 3]: [allowlist] meng-tian: ホワイトリストに無いコマンドです"
GUARD_MISSING = ("PreToolUse:Read hook error: [node ${CLAUDE_PROJECT_DIR}/team/hooks/guard.js allowlist.js]: "
                 "Error: Cannot find module 'E:/develop/self/Team/projects/ai-editor/team/hooks/guard.js'")
DONTASK_DENIAL = ("Permission to use Bash has been denied because Claude Code is running in don't ask mode. "
                  "IMPORTANT: You may attempt to accomplish this action using other tools")
DEFAULT_DENIAL = "Claude requested permissions to use Write, but you haven't granted it yet."


def tool_use(tid, name, inp=None, parent=None):
    return json.dumps({"type": "assistant", "parent_tool_use_id": parent, "message": {"content": [
        {"type": "tool_use", "id": tid, "name": name, "input": inp or {}}]}})


def tool_result(tid, content, error=None, parent=None):
    block = {"type": "tool_result", "tool_use_id": tid, "content": content}
    if error is not None:
        block["is_error"] = error
    return json.dumps({"type": "user", "parent_tool_use_id": parent, "message": {"content": [block]}})


def result_event(denials=(), structured=None):
    ev = {"type": "result", "subtype": "success",
          "permission_denials": [{"tool_name": "x", "tool_use_id": d, "tool_input": {}} for d in denials]}
    if structured is not None:
        ev["structured_output"] = structured
    return json.dumps(ev)


def one(name, content, error=None, denials=()):
    """1回の呼び出しの stream-json を作って読み、その分類を返す。"""
    text = "\n".join([tool_use("t1", name), tool_result("t1", content, error), result_event(denials)])
    return e2e_run.parse_stream_json(text)["calls"][0]["outcome"]


class ListTest(unittest.TestCase):
    def test_list_steps_has_all_ids_and_cases(self):
        text = e2e_run.list_steps()
        self.assertIn("番号", text)
        for sid, c in e2e_run.iter_cases():
            self.assertIn(str(sid), text)
            self.assertIn(c["label"], text)

    def test_main_list_returns_zero(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = e2e_run.main(["--list"])
        self.assertEqual(code, 0)
        self.assertIn("手順", out.getvalue())

    def test_unknown_step_is_rejected(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = e2e_run.main(["999"])
        self.assertEqual(code, 2)


class ScrubEnvTest(unittest.TestCase):
    # E1: 前は CLAUDE_ で始まる変数を全部外し、CLAUDE_CODE_GIT_BASH_PATH も消えて子の claude に Bash が出なかった。
    # 外すのは親のセッションに結びつく変数だけ。環境の設定は残す。
    SESSION = ("CLAUDE_PROJECT_DIR", "CLAUDECODE", "CLAUDE_AGENT", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_SSE_PORT",
               "CLAUDE_ENV_FILE", "CLAUDE_PLUGIN_ROOT", "CLAUDE_CODE_SESSION_ID", "CLAUDE_SESSION_ID",
               "claudecode", "claude_code_sse_port")  # 小文字も外す
    SETTINGS = ("PATH", "HOME", "SHELL", "CLAUDE_CODE_GIT_BASH_PATH", "CLAUDE_CODE_SHELL", "CLAUDE_CONFIG_DIR",
                "CLAUDE_CODE_MAX_OUTPUT_TOKENS", "CLAUDE_CODE_ASSETS", "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL",
                "MY_SESSION_ID", "PORT")

    def test_removes_only_session_vars(self):
        base = {key: "x" for key in self.SESSION + self.SETTINGS}
        env = e2e_run.scrub_env(base)
        for key in self.SESSION:
            self.assertNotIn(key, env, key)
        for key in self.SETTINGS:
            self.assertIn(key, env, key)

    def test_git_bash_path_survives_for_run_claude(self):
        seen = {}

        def fake_run(cmd, **kw):
            seen["env"] = kw["env"]
            return subprocess.CompletedProcess(cmd, 0, stdout=result_event(), stderr="")

        with tempfile.TemporaryDirectory() as tmp, \
                mock.patch.object(e2e_run, "claude_bin", return_value="claude"), \
                mock.patch.object(e2e_run.subprocess, "run", side_effect=fake_run), \
                mock.patch.dict(os.environ, {"CLAUDE_CODE_GIT_BASH_PATH": "C:/Git/bin/bash.exe",
                                             "CLAUDE_CODE_SSE_PORT": "1234", "CLAUDECODE": "1"}):
            e2e_run.run_claude([], "p", Path(tmp) / "o.jsonl", 5)
        self.assertEqual(seen["env"].get("CLAUDE_CODE_GIT_BASH_PATH"), "C:/Git/bin/bash.exe")
        self.assertNotIn("CLAUDE_CODE_SSE_PORT", seen["env"])
        self.assertNotIn("CLAUDECODE", seen["env"])


def touch(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"")
    return path


class GitBashTest(unittest.TestCase):
    """E1（差し戻し2回目）: 子の env に CLAUDE_CODE_GIT_BASH_PATH が無ければ Git Bash の bash.exe を探して足す。
    Git の置き場は一時のディレクトリに作る（本物の Git は見ない）。"""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(os.path.realpath(self._tmp.name))
        # Git for Windows の形（標準でない場所。E:\ProgramFiles\Git と同じ並び）
        self.git = self.tmp / "ProgramFiles" / "Git"
        self.bash = touch(self.git / "bin" / "bash.exe")
        touch(self.git / "bin" / "git.exe")
        self.cmd_git = touch(self.git / "cmd" / "git.exe")
        self.mingw_git = touch(self.git / "mingw64" / "bin" / "git.exe")
        self.usr_bash = touch(self.git / "usr" / "bin" / "bash.exe")
        touch(self.git / "git-bash.exe")
        # WSL の bash（Git の根を持たない）
        self.wsl_bash = touch(self.tmp / "Windows" / "System32" / "bash.exe")

    def tearDown(self):
        self._tmp.cleanup()

    def which(self, table):
        return lambda name: None if table.get(name) is None else str(table[name])

    def test_from_git_on_path(self):
        for git in (self.cmd_git, self.mingw_git, self.git / "bin" / "git.exe"):
            with self.subTest(git=str(git)):
                path, how = e2e_run.find_git_bash(self.which({"git": git, "bash": self.wsl_bash}))
                self.assertEqual(Path(path), self.bash)
                self.assertIn('shutil.which("git")', how)

    def test_from_bash_only_when_it_is_git_bash(self):
        path, how = e2e_run.find_git_bash(self.which({"git": None, "bash": self.usr_bash}))
        self.assertEqual(Path(path), self.bash)
        self.assertIn('shutil.which("bash")', how)
        # WSL の bash は使わない
        path, how = e2e_run.find_git_bash(self.which({"git": None, "bash": self.wsl_bash}))
        self.assertIsNone(path)
        self.assertIn("見つからない", how)
        # git が Git の根を持たない場所（shim など）なら bash へ進む
        shim = touch(self.tmp / "scoop" / "shims" / "git.exe")
        path, _ = e2e_run.find_git_bash(self.which({"git": shim, "bash": self.usr_bash}))
        self.assertEqual(Path(path), self.bash)
        self.assertEqual(e2e_run.find_git_bash(self.which({}))[0], None)

    def test_child_env_adds_only_when_missing(self):
        which = self.which({"git": self.cmd_git})
        env, info = e2e_run.child_env({"PATH": "x", "CLAUDECODE": "1"}, which)
        self.assertEqual(Path(env["CLAUDE_CODE_GIT_BASH_PATH"]), self.bash)
        self.assertTrue(info["added"])
        self.assertNotIn("CLAUDECODE", env)
        # 親にあればそのまま（大文字小文字を問わない）
        for key in ("CLAUDE_CODE_GIT_BASH_PATH", "claude_code_git_bash_path"):
            with self.subTest(key=key):
                env, info = e2e_run.child_env({key: "D:/Git/bin/bash.exe"}, which)
                self.assertEqual(env, {key: "D:/Git/bin/bash.exe"})
                self.assertFalse(info["added"])
                self.assertEqual(info["CLAUDE_CODE_GIT_BASH_PATH"], "D:/Git/bin/bash.exe")
        # 見つからなければ足さない
        env, info = e2e_run.child_env({"PATH": "x"}, self.which({"bash": self.wsl_bash}))
        self.assertNotIn("CLAUDE_CODE_GIT_BASH_PATH", env)
        self.assertIsNone(info["CLAUDE_CODE_GIT_BASH_PATH"])

    def test_run_claude_adds_git_bash_to_env_and_records_it(self):
        seen = {}

        def fake_run(cmd, **kw):
            seen["env"] = kw["env"]
            return subprocess.CompletedProcess(cmd, 0, stdout=result_event(), stderr="")

        table = {"git": self.cmd_git, "bash": self.wsl_bash, "claude": "claude"}
        environ = {k: v for k, v in os.environ.items() if k.upper() != "CLAUDE_CODE_GIT_BASH_PATH"}
        out = self.tmp / "run" / "step1-x.jsonl"
        with mock.patch.object(e2e_run.shutil, "which", side_effect=self.which(table)), \
                mock.patch.object(e2e_run.subprocess, "run", side_effect=fake_run), \
                mock.patch.dict(os.environ, environ, clear=True):
            e2e_run.run_claude([], "p", out, 5)
        self.assertEqual(Path(seen["env"]["CLAUDE_CODE_GIT_BASH_PATH"]), self.bash)
        # 何を足したかを jsonl の横に残す
        record = json.loads(e2e_run.spawn_record_path(out).read_text(encoding="utf-8"))
        self.assertEqual(e2e_run.spawn_record_path(out).name, "step1-x.spawn.json")
        self.assertTrue(record["env"]["added"])
        self.assertEqual(Path(record["env"]["CLAUDE_CODE_GIT_BASH_PATH"]), self.bash)
        self.assertIn("# env: CLAUDE_CODE_GIT_BASH_PATH=", out.read_text(encoding="utf-8"))

    def test_bash_case_is_unknown_without_git_bash(self):
        called = []
        missing = {"CLAUDE_CODE_GIT_BASH_PATH": None, "added": False, "source": "見つからない: x"}
        ctx = {"id": 1, "dir": self.tmp / "run", "timeout": 5, "git_bash": missing}
        bash_case = e2e_run.STEPS[1]["cases"][0]
        with mock.patch.object(e2e_run, "run_claude", side_effect=lambda *a, **k: called.append(a)):
            label, verdict, notes = e2e_run.run_case(ctx, e2e_run.STEPS[1], bash_case)
        self.assertEqual(called, [])          # 流さない
        self.assertEqual(verdict, "UNKNOWN")
        self.assertIn("判定できない（Git Bash が無い", notes[0])
        record = json.loads((self.tmp / "run" / f"step1-{label}.spawn.json").read_text(encoding="utf-8"))
        self.assertIn("Git Bash が無い", record["skipped"])

    def test_non_bash_case_runs_without_git_bash(self):
        missing = {"CLAUDE_CODE_GIT_BASH_PATH": None, "added": False, "source": "x"}
        ctx = {"id": 2, "dir": self.tmp / "run", "timeout": 5, "git_bash": missing}
        read_case = e2e_run.STEPS[2]["cases"][0]
        text = "\n".join([tool_use("t1", "Read"), tool_result("t1", "1\t# AiEditor", False)])
        with mock.patch.object(e2e_run, "run_claude", return_value=(0, text)) as run:
            verdict = e2e_run.run_case(ctx, e2e_run.STEPS[2], read_case)[1]
        self.assertEqual(run.call_count, 1)
        self.assertEqual(verdict, "OK")

    def test_real_environment(self):
        # この PC の git から求まる bash.exe が、実在する Git の bin/bash.exe であること（git が無ければ飛ばす）
        import shutil
        if e2e_run.git_root_of(shutil.which("git")) is None:
            self.skipTest("Git for Windows の git が PATH に無い")
        path, _ = e2e_run.find_git_bash()
        self.assertTrue(Path(path).is_file(), path)
        self.assertEqual([Path(path).parent.name.lower(), Path(path).name.lower()], ["bin", "bash.exe"])

    def test_needs_bash(self):
        labels = {c["label"] for _, c in e2e_run.iter_cases() if e2e_run.needs_bash(c)}
        self.assertEqual(labels, {"leader-bash-permission", "leader-bash-allowed", "bash-blocked"})


class RunDirTest(unittest.TestCase):
    def test_new_dir_per_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            now = 1_800_000_000
            first = e2e_run.new_run_dir(tmp, now)
            second = e2e_run.new_run_dir(tmp, now)       # 同じ秒でも前回を上書きしない
            self.assertTrue(first.is_dir() and second.is_dir())
            self.assertRegex(first.name, r"^\d{8}-\d{6}$")
            self.assertEqual(second.name, first.name + "-2")
            self.assertEqual(first.parent, Path(tmp))


class BuildCmdTest(unittest.TestCase):
    def test_source_has_no_bypass_permissions(self):
        source = Path(e2e_run.__file__).read_text(encoding="utf-8").lower()
        self.assertNotIn("bypasspermissions", source)
        self.assertNotIn("dangerously-skip-permissions", source)

    def test_cmd_uses_dontask(self):
        cmd = e2e_run.build_cmd("claude", ["--agent", "di-renjie"], "p")
        i = cmd.index("--permission-mode")
        self.assertEqual(cmd[i + 1], "dontAsk")
        self.assertEqual(cmd.count("--permission-mode"), 1)
        self.assertFalse(any("bypass" in a.lower() or "skip-permissions" in a.lower() for a in cmd))

    def test_prompt_is_last_and_not_swallowed_by_allowed_tools(self):
        cmd = e2e_run.build_cmd("claude", ["--allowedTools", "Bash(git status)"], "PROMPT")
        self.assertEqual(cmd[-1], "PROMPT")
        self.assertEqual(cmd[-3:-1], ["--max-turns", e2e_run.MAX_TURNS])
        # --allowedTools の値の直後は決まった引数（プロンプトを許可の列として読ませない）
        i = cmd.index("--allowedTools")
        self.assertTrue(cmd[i + 2].startswith("--"))

    def test_forbidden_args_are_rejected(self):
        for args in (["--permission-mode", "bypassPermissions"], ["--permission-mode", "acceptEdits"],
                     ["--permission-mode=dontAsk"], ["--dangerously-skip-permissions"],
                     ["--allow-dangerously-skip-permissions"], ["--setting-sources", "user"], ["--bare"],
                     ["--add-dir", "C:/"], ["--allowedTools", "Bash"], ["--allowedTools", "Write"],
                     ["--allowedTools", "Bash(git status:*)"], ["--allowedTools", "Bash(git push)"],
                     ["--allowedTools=Bash(git status)"], ["--allowed-tools", "Edit"], ["--allowedTools"]):
            with self.subTest(args=args), self.assertRaises(ValueError):
                e2e_run.build_cmd("claude", args, "p")

    def test_all_cases_build(self):
        for sid, c in e2e_run.iter_cases():
            with self.subTest(step=sid, case=c["label"]):
                cmd = e2e_run.build_cmd("claude", c["args"], c["prompt"])
                self.assertEqual(cmd[-1], c["prompt"])
                self.assertIn("dontAsk", cmd)

    def test_run_claude_spawns_with_dontask_in_project(self):
        seen = {}

        def fake_run(cmd, **kw):
            seen["cmd"], seen["kw"] = cmd, kw
            return subprocess.CompletedProcess(cmd, 0, stdout=result_event(), stderr="")

        with tempfile.TemporaryDirectory() as tmp, \
                mock.patch.object(e2e_run, "claude_bin", return_value="claude"), \
                mock.patch.object(e2e_run.subprocess, "run", side_effect=fake_run), \
                mock.patch.dict(os.environ, {"CLAUDECODE": "1"}):
            code, _ = e2e_run.run_claude(["--agent", "meng-tian"], "p", Path(tmp) / "o.jsonl", 5)
            self.assertTrue((Path(tmp) / "o.jsonl").exists())
        self.assertEqual(code, 0)
        cmd = seen["cmd"]
        self.assertEqual(cmd[cmd.index("--permission-mode") + 1], "dontAsk")
        self.assertFalse(any("bypass" in a.lower() for a in cmd))
        self.assertEqual(Path(seen["kw"]["cwd"]), e2e_run.PROJECT)
        self.assertNotIn("CLAUDECODE", seen["kw"]["env"])


class PromptSafetyTest(unittest.TestCase):
    FORBIDDEN = ("削除", "消して", "消す", "rm ", "del ", "remove", "push", "commit", "reset", "clean", "checkout",
                 "rebase", "fetch", "clone", "curl", "wget", "http", "invoke-webrequest", "webfetch", "websearch",
                 "npm", "pnpm", "npx", "node ", "powershell", "Edit ツール")

    def test_prompts_have_no_side_effect_words(self):
        for sid, c in e2e_run.iter_cases():
            # 手順 11 の「PowerShell ツールで、git status」だけは許す（Explore に Bash が無いときの止まる側の例）
            low = c["prompt"].replace("PowerShell ツールで、git status", "").lower()
            for word in self.FORBIDDEN:
                with self.subTest(step=sid, case=c["label"], word=word):
                    self.assertNotIn(word.lower(), low)
            # git は git status だけ
            for m in re.finditer(r"git\s+(\S+)", c["prompt"]):
                self.assertEqual(m.group(1), "status", (sid, c["label"]))

    def test_tools_are_side_effect_free_except_marked_writes(self):
        for sid, c in e2e_run.iter_cases():
            with self.subTest(step=sid, case=c["label"]):
                self.assertIn(c["tool"], ("Read", "Glob", "Grep", "Bash", "Write", "StructuredOutput", "Agent"))
                self.assertIn(c["expect"], e2e_run.EXPECTS)
                if c["tool"] == "Bash":
                    self.assertIn("git status", c["prompt"])
                if c["tool"] == "Write" or "Write" in c["prompt"]:
                    self.assertTrue(c.get("writes"), "書き込ませる手順は writes に先を書く")

    def test_writes_are_marks_under_e2e_or_nonexistent_tmp(self):
        e2e_dir = e2e_run.E2E_DIR.resolve()
        tmp_parent = (e2e_run.PROJECT / "tasks").resolve()
        count = 0
        for sid, c in e2e_run.iter_cases():
            for p in c.get("writes", ()):
                count += 1
                p = Path(p).resolve()
                with self.subTest(step=sid, path=str(p)):
                    under_e2e = e2e_dir in p.parents
                    under_tmp = p.parent.parent == tmp_parent and p.parent.name.startswith("e2e-tmp-")
                    self.assertTrue(under_e2e or under_tmp, p)
                    self.assertIn(p.name, c["prompt"])
        self.assertEqual(count, 3)

    def test_guard_off_step_uses_only_harmless_tools(self):
        for c in e2e_run.STEPS[6]["cases"]:
            self.assertIn(c["tool"], e2e_run.READ_TOOLS)
            self.assertFalse(c.get("writes"))
            self.assertEqual(c["args"], ["--agent", "meng-tian"])

    def test_allowed_tools_only_git_status(self):
        found = [c for _, c in e2e_run.iter_cases() if "--allowedTools" in c["args"]]
        self.assertTrue(found)
        for c in found:
            i = c["args"].index("--allowedTools")
            self.assertEqual(c["args"][i + 1], "Bash(git status)")

    def test_premise_case_exists(self):
        # PreToolUse が許可の確認より前に動く裏づけ: リーダーの Bash git status を「フックは通した」と見る手順
        c = e2e_run.STEPS[1]["cases"][0]
        self.assertEqual((c["tool"], c["expect"], c["args"]), ("Bash", "hook_passed", []))


class ClassifyTest(unittest.TestCase):
    def test_hook_denials_are_blocked(self):
        self.assertEqual(one("Bash", HOOK_DENIAL, True), "blocked")
        self.assertEqual(one("Bash", HOOK_DENIAL_SHORT, True), "blocked")
        self.assertEqual(one("Read", "[guard] allowlist.js を読み込めないため止めました", True), "blocked")
        # 起動役に届かない（guard.js が無い）とき: 印は無いが PreToolUse のフックの誤りの形
        self.assertEqual(one("Read", GUARD_MISSING, True), "blocked")

    def test_hook_denial_in_permission_denials_is_still_blocked(self):
        # フックの拒否も permission_denials に入る（過去の実測）。見分けは文で行う
        self.assertEqual(one("Bash", HOOK_DENIAL, True, denials=["t1"]), "blocked")

    def test_permission_denials_are_hook_passed(self):
        self.assertEqual(one("Bash", DONTASK_DENIAL, True, denials=["t1"]), "hook_passed")
        self.assertEqual(one("Write", DEFAULT_DENIAL, True), "hook_passed")

    def test_executed(self):
        self.assertEqual(one("Bash", "On branch main\nnothing to commit", False), "executed")
        self.assertEqual(one("Read", "1\t# AiEditor", None), "executed")  # is_error が無い
        # 実行して返った中身に印の文字があっても、誤りでなければ通した
        self.assertEqual(one("Read", "1\tフックは [allowlist] で始まる文を出す", False), "executed")

    def test_content_as_text_blocks(self):
        self.assertEqual(one("Bash", [{"type": "text", "text": HOOK_DENIAL}], True), "blocked")
        self.assertEqual(one("Bash", [{"type": "text", "text": DONTASK_DENIAL}], True), "hook_passed")

    def test_undetermined_forms(self):
        self.assertEqual(one("Bash", HOOK_DENIAL + "\n" + DONTASK_DENIAL, True), "undetermined")  # 両方
        self.assertEqual(one("Read", "File does not exist.", True), "undetermined")  # 知らない誤り
        self.assertEqual(one("Read", "ok", False, denials=["t1"]), "undetermined")  # 誤りでないのに拒否の列
        self.assertEqual(one("Bash", HOOK_DENIAL, False), "undetermined")  # 誤りの印なしでフックの文
        self.assertEqual(one("Bash", DONTASK_DENIAL, None), "undetermined")
        # 結果が無い（時間切れ）
        parsed = e2e_run.parse_stream_json(tool_use("t1", "Read"))
        self.assertEqual(parsed["calls"][0]["outcome"], "undetermined")
        self.assertEqual(e2e_run.classify_result(None), "undetermined")


class ParseStreamJsonTest(unittest.TestCase):
    def test_calls_parent_markers_structured(self):
        lines = [
            "not json",
            "[e2e] 時間切れ",
            tool_use("a1", "Agent", {"subagent_type": "Explore"}),
            tool_use("s1", "Glob", {"pattern": "docs/**/*.md"}, parent="a1"),
            tool_result("s1", "docs/README.md", False, parent="a1"),
            tool_use("s2", "Bash", {"command": "ls docs"}, parent="a1"),
            tool_result("s2", HOOK_DENIAL, True, parent="a1"),
            tool_result("a1", "1", False),
            tool_use("a1", "Agent"),  # 同じ id は1回だけ数える
            result_event(denials=["s2"], structured={"verdict": "accept"}),
        ]
        parsed = e2e_run.parse_stream_json("\n".join(lines))
        self.assertEqual(parsed["tools"], ["Agent", "Glob", "Bash"])
        by = {c["id"]: c for c in parsed["calls"]}
        self.assertIsNone(by["a1"]["parent"])
        self.assertEqual(by["s1"]["parent"], "a1")
        self.assertEqual([by[i]["outcome"] for i in ("a1", "s1", "s2")], ["executed", "executed", "blocked"])
        self.assertTrue(parsed["markers"][0].startswith("PreToolUse:Bash hook error"))
        self.assertTrue(parsed["structured"])
        self.assertEqual(parsed["denied"], {"s2"})


class DecideVerdictTest(unittest.TestCase):
    def test_judge_outcome_matrix(self):
        table = {
            "block":       {"blocked": "OK", "hook_passed": "FAIL", "executed": "FAIL", "undetermined": "UNKNOWN"},
            "pass":        {"blocked": "FAIL", "hook_passed": "OK", "executed": "OK", "undetermined": "UNKNOWN"},
            "hook_passed": {"blocked": "FAIL", "hook_passed": "OK", "executed": "UNKNOWN", "undetermined": "UNKNOWN"},
            "executed":    {"blocked": "FAIL", "hook_passed": "UNKNOWN", "executed": "OK", "undetermined": "UNKNOWN"},
            "observe":     {"blocked": "OK", "hook_passed": "OK", "executed": "OK", "undetermined": "UNKNOWN"},
        }
        for expect, row in table.items():
            for outcome, want in row.items():
                with self.subTest(expect=expect, outcome=outcome):
                    self.assertEqual(e2e_run.judge_outcome(outcome, expect), want)
        with self.assertRaises(ValueError):
            e2e_run.judge_outcome("blocked", "maybe")

    def p(self, *outcomes, name="Bash", parent=None):
        return {"calls": [{"id": f"t{i}", "name": name, "parent": parent, "input": {}, "outcome": o}
                          for i, o in enumerate(outcomes)], "markers": [], "structured": False}

    def test_decide_combines_fail_unknown_ok(self):
        self.assertEqual(e2e_run.decide_verdict(self.p("blocked"), "block", "Bash"), "OK")
        self.assertEqual(e2e_run.decide_verdict(self.p("blocked", "hook_passed"), "block", "Bash"), "FAIL")
        self.assertEqual(e2e_run.decide_verdict(self.p("blocked", "undetermined"), "block", "Bash"), "UNKNOWN")
        self.assertEqual(e2e_run.decide_verdict(self.p(), "block", "Bash"), "UNKNOWN")  # 呼ばれなかった
        self.assertEqual(e2e_run.decide_verdict(self.p("blocked", name="Read"), "block", "Bash"), "UNKNOWN")
        # サブエージェントの中の呼び出しはメインの判定に数えない
        self.assertEqual(e2e_run.decide_verdict(self.p("executed", parent="a1"), "block", "Bash"), "UNKNOWN")
        self.assertEqual(e2e_run.decide_verdict(self.p("blocked", name="Task"), "block", "Agent"), "OK")

    def test_select_relative_paths(self):
        parsed = {"calls": [
            {"id": "1", "name": "Read", "parent": None, "input": {"file_path": "E:\\x\\docs\\README.md"},
             "outcome": "executed"},
            {"id": "2", "name": "Read", "parent": None, "input": {"file_path": "README.md"}, "outcome": "blocked"},
        ], "markers": []}
        self.assertEqual(e2e_run.decide_verdict(parsed, "block", "Read", e2e_run.is_relative_path_call), "OK")
        for path, rel in (("README.md", True), ("./README.md", True), (".", True), ("C:/b/x", False), ("/c/x", False),
                          ("\\\\srv\\x", False), ("~/x", False), ("%LOCALAPPDATA%/x", False)):
            self.assertEqual(e2e_run.is_relative_path_call({"input": {"file_path": path}}), rel, path)
            self.assertEqual(e2e_run.is_relative_path_call({"input": {"path": path}}), rel, path)  # Glob・Grep
        self.assertFalse(e2e_run.is_relative_path_call({"input": {"pattern": "*.md"}}))  # path 省略は数えない

    def test_step9_expectations(self):
        # E3: 相対の Read は実機で通った。Glob・Grep の相対の path は分かっていないので記録する（observe）
        cases = {c["label"]: c for c in e2e_run.STEPS[9]["cases"]}
        self.assertEqual(e2e_run.STEPS[9]["cwd"], e2e_run.PROJECT / "docs")
        self.assertEqual((cases["subdir-relative-read"]["tool"], cases["subdir-relative-read"]["expect"]), ("Read", "pass"))
        self.assertEqual((cases["subdir-relative-glob"]["tool"], cases["subdir-relative-glob"]["expect"]), ("Glob", "observe"))
        self.assertEqual((cases["subdir-relative-grep"]["tool"], cases["subdir-relative-grep"]["expect"]), ("Grep", "observe"))
        for c in cases.values():
            self.assertIs(c["select"], e2e_run.is_relative_path_call)
        glob = {"calls": [{"id": "1", "name": "Glob", "parent": None, "input": {"path": ".", "pattern": "*.md"},
                           "outcome": "blocked"}], "markers": []}
        self.assertEqual(e2e_run.default_judge(glob, cases["subdir-relative-glob"])[0], "OK")
        self.assertIn("止めた", e2e_run.default_judge(glob, cases["subdir-relative-glob"])[1][0])

    def test_judge_structured(self):
        so = lambda o, s: {"calls": [{"id": "1", "name": "StructuredOutput", "parent": None, "input": {},
                                      "outcome": o}], "markers": [], "structured": s}
        self.assertEqual(e2e_run.judge_structured(so("executed", True), {})[0], "OK")
        self.assertEqual(e2e_run.judge_structured(so("blocked", False), {})[0], "FAIL")
        self.assertEqual(e2e_run.judge_structured(so("executed", False), {})[0], "UNKNOWN")

    def test_judge_explore(self):
        def parsed(*subs, agent="executed", text=HOOK_DENIAL):
            calls = [{"id": "a1", "name": "Agent", "parent": None, "input": {}, "outcome": agent}]
            calls += [{"id": f"s{i}", "name": n, "parent": "a1", "input": {}, "outcome": o,
                       "text": text if o == "blocked" else ""}
                      for i, (n, o) in enumerate(subs)]
            return {"calls": calls, "markers": []}

        ok = parsed(("Glob", "executed"), ("Read", "executed"), ("Bash", "blocked"))
        self.assertEqual(e2e_run.judge_explore(ok, {})[0], "OK")
        # 差し戻し2回目: Bash が無く PowerShell が止まった場合も止まる側の例あり
        ok_ps = parsed(("Glob", "executed"), ("PowerShell", "blocked"))
        self.assertEqual(e2e_run.judge_explore(ok_ps, {})[0], "OK")
        self.assertEqual(e2e_run.judge_explore(parsed(("Read", "blocked")), {})[0], "FAIL")
        self.assertEqual(e2e_run.judge_explore(parsed(("Bash", "hook_passed")), {})[0], "FAIL")  # fail-open
        self.assertEqual(e2e_run.judge_explore(parsed(("Read", "executed"), ("PowerShell", "hook_passed")), {})[0],
                         "FAIL")
        self.assertEqual(e2e_run.judge_explore(parsed(), {})[0], "UNKNOWN")
        self.assertEqual(e2e_run.judge_explore(parsed(("Read", "executed"), agent="blocked"), {})[0], "FAIL")
        # E4: 止まる側の例（Bash・PowerShell が [allowlist] で止まった）が無ければ OK にしない
        self.assertEqual(e2e_run.judge_explore(parsed(("Glob", "executed"), ("Read", "executed")), {})[0], "UNKNOWN")
        self.assertEqual(e2e_run.judge_explore(parsed(("Bash", "blocked")), {})[0], "UNKNOWN")  # 読み取りが無い
        # [allowlist] の文でない止まり方（guard の誤りなど）や、Bash・PowerShell 以外の止まりは例に数えない
        guard = parsed(("Read", "executed"), ("Bash", "blocked"), text="[guard] allowlist.js を読み込めない")
        self.assertEqual(e2e_run.judge_explore(guard, {})[0], "UNKNOWN")
        self.assertEqual(e2e_run.judge_explore(parsed(("Read", "executed"), ("WebFetch", "blocked")), {})[0], "UNKNOWN")

    def test_step11_asks_explore_for_one_disallowed_call(self):
        c = e2e_run.STEPS[11]["cases"][0]
        self.assertIn("Bash ツールがあれば Bash ツールで、無ければ PowerShell ツールで、git status", c["prompt"])
        self.assertIn("1回だけ", c["prompt"])
        self.assertIs(c["judge"], e2e_run.judge_explore)


class RunCaseTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)
        self.ctx = {"id": 3, "dir": self.dir, "timeout": 5}

    def tearDown(self):
        self._tmp.cleanup()

    def run_with(self, c, text, code=0, effect=None):
        def fake(args, prompt, out, timeout, cwd=None):
            if effect:
                effect()
            return code, text
        with mock.patch.object(e2e_run, "run_claude", side_effect=fake):
            return e2e_run.run_case(self.ctx, {}, c)

    def test_blocked_write_is_ok(self):
        mark = self.dir / "m.txt"
        c = e2e_run.case("w", [], "p", "Write", "block", "op", writes=[mark])
        text = "\n".join([tool_use("t1", "Write"), tool_result("t1", HOOK_DENIAL, True)])
        self.assertEqual(self.run_with(c, text)[1], "OK")

    def test_created_file_is_fail_even_if_stream_says_blocked(self):
        mark = self.dir / "m.txt"
        c = e2e_run.case("w", [], "p", "Write", "block", "op", writes=[mark])
        text = "\n".join([tool_use("t1", "Write"), tool_result("t1", HOOK_DENIAL, True)])
        label, verdict, notes = self.run_with(c, text, effect=lambda: mark.write_text("x"))
        self.assertEqual(verdict, "FAIL")
        self.assertTrue(any("書き込まれた" in n for n in notes))

    def test_hook_passed_write_ok_and_timeout_unknown(self):
        c = e2e_run.case("w", [], "p", "Write", "pass", "op")
        text = "\n".join([tool_use("t1", "Write"), tool_result("t1", DONTASK_DENIAL.replace("Bash", "Write"), True)])
        self.assertEqual(self.run_with(c, text)[1], "OK")
        self.assertEqual(self.run_with(c, text, code=None)[1], "UNKNOWN")


class GuardBackupTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.guard = Path(self._tmp.name) / "guard.js"
        self.guard.write_text("// original guard\n", encoding="utf-8")
        self.before = e2e_run.sha256_of(self.guard)

    def tearDown(self):
        self._tmp.cleanup()

    def test_restores_and_sees_off_during_body(self):
        seen = {}

        def body(off):
            seen["off_exists"] = off.exists()
            seen["guard_gone"] = not self.guard.exists()
            return "done"

        result = e2e_run.disable_and_restore(self.guard, body, bak_dir=self._tmp.name)
        self.assertEqual(result, "done")
        self.assertTrue(seen["off_exists"])
        self.assertTrue(seen["guard_gone"])
        self.assertTrue(self.guard.exists())
        self.assertFalse(self.guard.with_suffix(".js.off").exists())
        self.assertEqual(e2e_run.sha256_of(self.guard), self.before)

    def test_restores_even_when_body_raises(self):
        with self.assertRaises(ValueError):
            e2e_run.disable_and_restore(self.guard, lambda off: (_ for _ in ()).throw(ValueError("x")),
                                        bak_dir=self._tmp.name)
        self.assertTrue(self.guard.exists())
        self.assertEqual(e2e_run.sha256_of(self.guard), self.before)

    def test_restores_from_backup_when_off_deleted(self):
        # body の中で off を消してしまっても、写しから戻す
        def body(off):
            os.remove(off)
            return None

        e2e_run.disable_and_restore(self.guard, body, bak_dir=self._tmp.name)
        self.assertTrue(self.guard.exists())
        self.assertEqual(e2e_run.sha256_of(self.guard), self.before)

    def test_step6_runs_with_guard_off_and_restores(self):
        seen = {}

        def fake(args, prompt, out, timeout, cwd=None):
            seen["guard_gone"] = not self.guard.exists()
            seen["args"] = args
            return 0, "\n".join([tool_use("t1", "Read"), tool_result("t1", GUARD_MISSING, True)])

        ctx = {"id": 6, "dir": Path(self._tmp.name), "timeout": 5}
        with mock.patch.object(e2e_run, "GUARD", self.guard), \
                mock.patch.object(e2e_run, "run_claude", side_effect=fake):
            results = e2e_run.run_step(6, ctx)
        self.assertEqual([r[1] for r in results], ["OK"])
        self.assertTrue(seen["guard_gone"])
        self.assertTrue(self.guard.exists())
        self.assertEqual(e2e_run.sha256_of(self.guard), self.before)


if __name__ == "__main__":
    unittest.main()
