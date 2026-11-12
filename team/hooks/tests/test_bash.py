"""Bash（と PowerShell）のコマンドの検査のテスト。実際の permissions.json に対して allowlist.js を呼ぶ。
本物の許可では書けない形（node --check のオプション）は、一時のプロジェクトの仮のメンバーで確かめる
（hookrun.bare_node_check_project）。

実行: python -m unittest discover -s projects/ai-editor/team/hooks/tests
"""

import json
import tempfile
import unittest

from hookrun import BARE_NODE_CHECK, PROJECT, HookTestCase, bare_node_check_project, event, make_project, run


class MemberCommandsTest(HookTestCase):
    # 第2段で書き換えた後の permissions.json に合わせた、許可するコマンドの代表。
    # 4人の bash の行それぞれに1つ以上（止めすぎていないかを見る）。
    ALLOWED = {
        "meng-tian": [
            "git status",
            "git diff --stat",
            "git log --oneline -5",
            "git worktree list",
            "git -C C:/b/vscode fetch --tags",
            "git -C C:/b/vscode worktree add C:/b/wt/release-1.96",
            "git -C C:/b/vscode worktree remove C:/b/wt/1.96",
            "git -C C:/b/vscode worktree prune",
            "git -C C:/b/vscode tag --list",
            "git -C C:/b/wt/1.96 status",
            "git -C C:/b/wt/x diff HEAD~1",
            "git -C C:/b/wt/x apply patches/0001-remove.patch",
            "git -C C:/b/wt/x am -3",
            "git -C C:/b/wt/x am --abort",
            "git -C C:/b/wt/x am --continue",
            "git -C C:/b/wt/x format-patch --stdout HEAD~1",
            "git -C C:/b/wt/x format-patch HEAD~1",            # 第2段: -o 無しは作業場所（C:/b/wt/x、書き込み先の中）に書くので通す
            "git -C C:/b/wt/x format-patch -o patches HEAD~1",  # 第2段: -o の値は -C の先から解く（C:/b/wt/x/patches）
            "git -C C:/b/wt/x checkout",
            "git -C C:/b/wt/x clean -xfd",
            "git -C C:/b/wt/x rerere",
            "git -C C:/b/wt/x add",
            "git -C C:/b/wt/x commit -m x",
            "git clone https://github.com/microsoft/vscode.git C:/b/vscode",
            "node scripts/build.mjs",
            "node scripts/apply.mjs --dry-run",
            "node tools/watch/watch.mjs",
            "node --check scripts/build.mjs",
            "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1",
            "powershell -NoProfile -ExecutionPolicy Bypass -File tools/watch/register.ps1",
            "pnpm --dir C:/b/wt/x install",
            "pnpm --dir C:/b/wt/x run gulp",
            "pnpm --dir C:/b/wt/x run compile",
            "pnpm --dir C:/b/wt/x run smoketest",
            "pnpm --dir extensions-src/mydist install",
            "pnpm --dir extensions-src/mydist run build",
            "npx --prefix C:/b/wt/x tsc --noEmit",
            "npx ovsx verify-signature x.vsix",
            "pwsh --version",
            "node --version",
            "git --version",
            "git status && git diff",
        ],
        "cao-shen": [
            "git status",
            "git show HEAD",
            "node --test tests/",                                 # 第2段: ディレクトリそのもの
            "node --test tests/unit/watch.test.mjs",              # 第2段: その下のパス
            "node --test tests/a.test.mjs tests/b.test.mjs",      # 第2段: 下のパスが複数でも通る
            "node --test extensions-src/mydist/test/x.test.mjs",
            "node --test extensions-src/mydist/test/",
            "node tests/build.test.mjs",
            "node --check tests/a.mjs",
            "pnpm --dir extensions-src/mydist run test",
            "powershell -NoProfile -ExecutionPolicy Bypass -File tests/smoke.ps1",
            "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure.ps1",
            "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/netaudit.ps1",
            "pnpm --dir C:/b/wt/x run smoketest",
        ],
        "ooka-echizen": [
            "git show HEAD",
            "node --test tests/",
            "node --test tests/unit/a.test.mjs",
            "node --test extensions-src/mydist/test/x.test.mjs",
            "node tests/build.test.mjs",
            "node scripts/apply.mjs",
            "node scripts/build.mjs",
            "node scripts/lock-verify.mjs",
            "pnpm --dir extensions-src/mydist run test",
            "pnpm --dir C:/b/wt/x run smoketest",
            "npx --prefix C:/b/wt/x tsc --noEmit",
            "powershell -NoProfile -ExecutionPolicy Bypass -File tests/smoke.ps1",
            "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure.ps1",
            "sha256sum C:/b/out/Shuko.zip",
        ],
    }

    BLOCKED = {
        "meng-tian": [
            "rm -rf C:/b/wt/x",
            "git commit -m x",                            # -C C:/b/wt/* の外では commit できない
            "git push",
            "git -C C:/b/vscode checkout main",          # checkout は wt/* だけ
            "git -C C:/b/vscode fetch origin",           # 第2段: fetch は --tags だけ
            "git -C C:/b/wt/x/y status",                  # * は1区切り
            "git -C C:/b/wt/.. status",                   # * は .. に一致しない
            "git -C C:/b/wt/. status",
            "git -C C:/b/wt/... status",
            "git -C C:/b/wt/x. status",                   # 末尾の点
            "git -C C:/b/wt/ status",                     # * は空に一致しない
            "git -C C:/b/wt/* status",                    # * そのもの（シェルの展開）
            "git -C C:/b/wt/a?c status",
            "git -C C:/b/wt/$HOME status",
            "git -C C:/b/wt/~1 status",
            "git -C C:/b/wt/x:y status",
            "git -C C:\\b\\wt\\x status",                 # \ は許可の / と一致しない
            "git -C \"C:/b/wt/x\" status",                # 引用符は * に含まれない
            "pnpm --dir extensions-src/mydist build",     # 第2段: run build が要る
            "pnpm --dir extensions-src/.. install",
            "pnpm --dir extensions-src/ install",
            "pnpm --dir extensions-src/a/../.. install",
            "node scripts/sub/x.mjs",
            "node scripts/../x.mjs",
            "node scripts/x.js",
            "node -e 1",
            "node tests/x.mjs",
            "npx tsc",
            "Git status",                                  # 大文字小文字は区別する
            "FOO=1 node scripts/build.mjs",
            "git status; rm x",
            "git status & rm x",
            "git status | rm x",
            "git status\nrm x",
            "git log --output=x.txt",
            "git log --output x.txt",
            "git diff -o x",
            "git -C C:/b/wt/x format-patch -o C:/Windows/Temp HEAD~1",  # 第2段: 書き込み先の外
            "git diff > x.txt",
            "git diff $(rm x)",
            "git diff `rm x`",
            "node --check (Remove-Item x)",               # PowerShell では括弧が式として評価される
            "node scripts/build.mjs (rm x)",
        ],
        "cao-shen": [
            "node scripts/build.mjs",
            "node --test records/x.mjs",                  # node --test は tests/・extensions-src/*/test/ の下だけ
            "node --test tests/a.mjs records/x.mjs",      # 2語目が外。全部を確かめる
            "node --test tests/../records/x.mjs",         # .. は不可
            "pnpm --dir extensions-src/mydist build",     # run test が要る
            "pnpm --dir extensions-src/.. run test",
            "pnpm --dir extensions-src/mydist/x run test",
            "pnpm --dir C:/b/wt/.. run smoketest",
            "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/switch.ps1",
            "powershell -NoProfile -ExecutionPolicy Bypass -File tests/../scripts/x.ps1",
            "git -C C:/b/vscode fetch",
            "sha256sum x",
        ],
        "ooka-echizen": [
            "node --check x.mjs",
            "node scripts/switch.mjs",
            "node --test records/x.mjs",                  # #12: 自分が書ける records/ を実行できない
            "git -C C:/b/vscode fetch",
            "pnpm --dir C:/b/wt/x install",
            "npx --prefix C:/b/wt/.. tsc --noEmit",
            "rm records/x.md",
        ],
    }

    def test_allowed(self):
        for member, commands in self.ALLOWED.items():
            for command in commands:
                with self.subTest(member=member, command=command):
                    self.assertPass(self.bash(member, command))

    def test_blocked(self):
        for member, commands in self.BLOCKED.items():
            for command in commands:
                with self.subTest(member=member, command=command):
                    self.assertBlock(self.bash(member, command))

    def test_block_reasons(self):
        reasons = {
            "git -C C:/b/wt/.. status": "ホワイトリストに無い",
            "pnpm --dir extensions-src/.. install": "ホワイトリストに無い",
            "git status; rm x": "ホワイトリストに無いコマンドです: rm x",
            "git log --output=x.txt": "git のファイルへ書き出す",
            "git -C C:/b/wt/x format-patch -o C:/Windows/Temp HEAD~1": "format-patch の書き出し",
            "node --check (Remove-Item x)": "括弧",
            "git diff > x.txt": "リダイレクト",
        }
        for command, reason in reasons.items():
            with self.subTest(command=command):
                self.assertBlock(self.bash("meng-tian", command), reason)

    def test_subagent_form_is_the_same(self):
        self.assertPass(self.bash("meng-tian", "git status", agent_id="a0123456789abcdef"))
        self.assertBlock(self.bash("meng-tian", "rm x", agent_id="a0123456789abcdef"))


class SecondStageForkRulesTest(HookTestCase):
    """第2段でフックに足した、全員に効く固定の決まり（permissions.json の bash とは別）。"""

    def test_node_dangerous_options(self):
        # 1.1 node のオプション。スクリプトの前でも後ろでも止める
        for command in (
            "node --check --require ./x.cjs scripts/build.mjs",
            "node --import ./x.mjs scripts/build.mjs",
            "node -r ./x.cjs scripts/build.mjs",
            "node -e 1",
            "node --eval 1",
            "node -p 1",
            "node --print 1",
            "node --loader ./l.mjs scripts/build.mjs",
            "node --experimental-loader=./l.mjs scripts/build.mjs",
            "node --require=./x.cjs scripts/build.mjs",
            "node scripts/build.mjs --require ./x.cjs",         # スクリプトの後ろに隠しても止める
            "node --conditions foo --require ./x.cjs scripts/build.mjs",
            "node -pe 1",                                        # まとめ書き
        ):
            with self.subTest(command=command):
                self.assertBlock(self.bash("meng-tian", command), "node の危険なオプション")

    def test_test_reporter_destination(self):
        # 1.1: node --test --test-reporter-destination は任意の場所に書けるので止める（cao-shen・ooka）
        for member in ("cao-shen", "ooka-echizen"):
            self.assertBlock(
                self.bash(member, "node --test --test-reporter-destination=.claude/settings.json tests/"),
                "node の危険なオプション",
            )

    def test_node_options_env(self):
        # 1.2 NODE_OPTIONS はコマンドの文字列のどこに現れても止める
        for command in (
            "NODE_OPTIONS=--require=./x.js node scripts/build.mjs",
            "env NODE_OPTIONS=--require=./x.js node scripts/build.mjs",
            "set NODE_OPTIONS=--require=./x.js",
            "$env:NODE_OPTIONS='--require ./x.js'",
            "node_options=--require=./x.js node --version",
        ):
            with self.subTest(command=command):
                self.assertBlock(self.bash("meng-tian", command), "NODE_OPTIONS")

    def test_pnpm_npx_exec_dlx_yes(self):
        # 1.3 pnpm・npx の exec・dlx・--yes・-y
        for command, reason in {
            "pnpm --dir C:/b/wt/x exec calc.exe": "exec",
            "pnpm --dir extensions-src/x dlx cowsay": "dlx",
            "pnpm --dir C:/b/wt/x install --yes": "yes",
            "npx -y create-foo": "未確認",
        }.items():
            with self.subTest(command=command):
                self.assertBlock(self.bash("meng-tian", command), reason)

    def test_git_dangerous_options(self):
        # 1.4 git の -c・--config・--upload-pack・--receive-pack・--template・--exec・--unsafe-paths・--directory・--no-index
        for command in (
            "git -c core.hooksPath=C:/b/h status",
            "git -C C:/b/vscode -c core.pager=calc fetch --tags",   # グローバルの位置
            "git -C C:/b/vscode fetch --tags --upload-pack=calc.exe",
            "git clone https://github.com/microsoft/vscode.git C:/b/vscode --template=C:/b/t",
            "git clone https://github.com/microsoft/vscode.git C:/b/vscode --config core.hooksPath=C:/b/h",
            "git -C C:/b/wt/x apply --unsafe-paths patches/p.patch",
            "git -C C:/b/wt/x am --directory=C:/x patches/p.patch",
            "git -C C:/b/wt/x fetch --receive-pack=calc",
            "git diff --no-index C:/Windows/win.ini x",
        ):
            with self.subTest(command=command):
                self.assertBlock(self.bash("meng-tian", command))

    def test_upper_c_is_not_confused_with_lower_c(self):
        # -C（大文字。作業ディレクトリ）は -c（設定の上書き）と取り違えない
        self.assertPass(self.bash("meng-tian", "git -C C:/b/wt/x status"))

    def test_tsc_output_options(self):
        # 1.5 tsc の --outDir などは書き込み先と照合する
        for member in ("meng-tian", "ooka-echizen"):
            for command in (
                "npx --prefix C:/b/wt/x tsc --noEmit --outDir .claude",
                "npx --prefix C:/b/wt/x tsc --outDir E:/develop/self/Team/projects/ai-editor/.claude",
                "npx --prefix C:/b/wt/x tsc --build",
                "npx --prefix C:/b/wt/x tsc -b",
            ):
                with self.subTest(member=member, command=command):
                    self.assertBlock(self.bash(member, command))

    def test_tsc_output_to_writable_place_passes(self):
        # 止めすぎない: 書き込み先の中への出力は通る（meng-tian は C:/b/ が書ける）。
        # bash の許可は tsc --noEmit まで。その後ろに --outDir を足した形でフックの照合を見る
        self.assertPass(self.bash("meng-tian", "npx --prefix C:/b/wt/x tsc --noEmit --outDir C:/b/wt/x/out"))


P_SLASH = str(PROJECT).replace("\\", "/")
CLAUDE_DIR = f"{P_SLASH}/.claude/"


class Stage2RecheckTest(HookTestCase):
    """第2段の差し戻し（verification-stage2.md の H1・H2・H4・H5・P1）。同じ危険なオプションを別の書き方にした形。"""

    def blocks(self, member, commands, contains=None):
        for command in commands:
            with self.subTest(member=member, command=command):
                self.assertBlock(self.bash(member, command), contains)

    def passes(self, member, commands):
        for command in commands:
            with self.subTest(member=member, command=command):
                self.assertPass(self.bash(member, command))

    # ---- H2・H1: node ----

    def test_h2_node_underscore_forms(self):
        self.blocks("meng-tian", [
            "node --check --experimental_loader=x a.mjs",            # verification-stage2 H2 の入力
            "node --check --test_reporter_destination=x a.mjs",      # 同
            "node --check --experimental_loader x a.mjs",
            "node --check --test_reporter-destination=x a.mjs",
            "node scripts/build.mjs --experimental_loader ./l.mjs",
        ], "node の危険なオプション")
        self.blocks("cao-shen", ["node --test --test_reporter_destination=.claude/settings.json tests/"],
                    "node の危険なオプション")

    def test_h1_node_long_options_case(self):
        # 決めたこと: 長い形は小文字にそろえて止める（node は区別するが、止めすぎにならない）。短い -R は止めない
        self.blocks("meng-tian", [
            "node --check --Require x a.mjs",                        # verification-stage2 H1 の入力
            "node --check --IMPORT=x a.mjs",
            "node --check --Experimental_Loader=x a.mjs",
        ], "node の危険なオプション")

    def test_node_not_overblocked(self):
        self.passes("meng-tian", ["node --check scripts/build.mjs", "node scripts/build.mjs --dry-run"])
        self.passes("cao-shen", ["node --test tests/", "node --test tests/a_b.test.mjs"])
        # 2026-11-13 から本物の node --check は <ディレクトリ>/ の行だけで、オプションを書けない。
        # フックの node のオプションの検査が止めすぎないことは、素の node --check を許す仮のメンバーで見る
        for command in ("node --check --max_old_space_size=4096 scripts/a.mjs",):
            with self.subTest(member=BARE_NODE_CHECK, command=command):
                self.assertPassBareNodeCheck(command)

    # ---- H4: git の長いオプションの省略形と -c のまとめ書き ----

    def test_h4_inputs_from_verification(self):
        self.blocks("meng-tian", [
            "git -C C:/b/wt/x apply --unsafe p.patch",
            "git -C C:/b/wt/x apply --direct=.claude p.patch",
            "git -C C:/b/vscode fetch --tags --upload=calc",
            "git clone https://github.com/microsoft/vscode.git C:/b/vscode -ccore.hooksPath=C:/b/h",
            "git clone https://github.com/microsoft/vscode.git C:/b/vscode --conf core.hooksPath=C:/b/h",
            "git clone https://github.com/microsoft/vscode.git C:/b/vscode --templ=C:/b/t",
        ], "git の危険なオプション")
        self.blocks("cao-shen", ["git diff --no-ind a b"], "git の危険なオプション")

    def test_h4_every_abbreviation_from_the_minimum(self):
        # 表（build-notes 12.1）の最短の長さから名前の全体まで、空白で値を分ける形と = の形の両方を止める
        table = {"config": 1, "upload-pack": 1, "receive-pack": 1, "template": 1, "exec": 1,
                 "unsafe-paths": 1, "directory": 1, "no-index": 4}
        for name, shortest in table.items():
            for n in range(shortest, len(name) + 1):
                opt = "--" + name[:n]
                for command in (f"git -C C:/b/wt/x apply {opt} p.patch", f"git -C C:/b/wt/x apply {opt}=x p.patch",
                                f"git -C C:/b/vscode fetch --tags {opt.upper()}=x"):
                    with self.subTest(command=command):
                        self.assertBlock(self.bash("meng-tian", command), "git の危険なオプション")
        # 最短より短い --n・--no・--no- は no-index としては止めない（否定の接頭辞。ここではホワイトリストの照合だけ）
        for opt in ("--n", "--no", "--no-"):
            with self.subTest(opt=opt):
                code_err = self.bash("cao-shen", f"git diff {opt} a b")
                self.assertPass(code_err)

    def test_h4_output_abbreviations(self):
        # 既存の --output 系も同じ決まり（--output-directory の先頭 1 文字以上）
        for opt in ("--o", "--ou", "--outp", "--output", "--output-d", "--output-dir"):
            for command in (f"git log {opt}=x.txt", f"git diff {opt} x.txt", f"git show {opt}=x"):
                with self.subTest(command=command):
                    self.assertBlock(self.bash("meng-tian", command), "ファイルへ書き出す")

    def test_h4_short_c_bundles(self):
        self.blocks("meng-tian", [
            "git clone https://github.com/microsoft/vscode.git C:/b/vscode -cfoo",
            "git clone https://github.com/microsoft/vscode.git C:/b/vscode -qccore.hooksPath=C:/b/h",
            "git clone https://github.com/microsoft/vscode.git C:/b/vscode -qc core.hooksPath=C:/b/h",
        ], "git の危険なオプション")
        # 12.12: clone 以外のサブコマンドの後ろの -c は設定を与えない（status は -c を拒み、commit の -c は
        # <commit> の再利用）。止めない（O2）
        self.passes("meng-tian", [
            "git -C C:/b/wt/x status -ccore.pager=calc",
            "git -C C:/b/wt/x commit -m x -ccore.hooksPath=C:/b/h",
        ])

    def test_h4_not_overblocked(self):
        # 書き換え後の meng-tian の git の行の、ふつうの使い方（省略しない名前・-C の大文字）は通る
        self.passes("meng-tian", [
            "git -C C:/b/wt/x am -3",
            "git -C C:/b/wt/x am -3 patches/0001-x.patch",
            "git -C C:/b/wt/x am --abort",
            "git -C C:/b/wt/x am --continue",
            "git -C C:/b/wt/x commit -m x",
            "git -C C:/b/wt/x commit -m \"fix: update the list\"",
            "git -C C:/b/wt/x clean -xfd",
            "git -C C:/b/vscode fetch --tags",
            "git -C C:/b/vscode fetch --tags --prune",
            "git -C C:/b/vscode fetch --tags --update-head-ok",
            "git -C C:/b/vscode worktree add C:/b/wt/x release/1.96",
            "git -C C:/b/vscode worktree remove C:/b/wt/x",
            "git -C C:/b/vscode worktree prune",
            "git -C C:/b/vscode tag --list",
            "git -C C:/b/wt/x apply --check patches/p.patch",
            "git -C C:/b/wt/x apply --3way --reject --exclude=x --include=y patches/p.patch",
            "git -C C:/b/wt/x diff --stat --name-only --no-color --unified=3 --diff-filter=M",
            "git -C C:/b/wt/x checkout -- src/a.ts",
            "git log --oneline --decorate --date=iso --topo-order --reverse --no-merges -n 5",
            "git diff --cached --no-ext-diff",
            "git show --name-status HEAD",
            "git clone https://github.com/microsoft/vscode.git C:/b/vscode",
        ])

    # ---- H5: format-patch の書き出し先 ----

    def test_h5_inputs_from_verification(self):
        self.blocks("meng-tian", [
            f"git -C C:/b/wt/x format-patch -o patches/ -o {CLAUDE_DIR} main",
            f"git -C C:/b/wt/x format-patch -o patches/ --output-directory={CLAUDE_DIR} main",
            f"git -C C:/b/wt/x format-patch --output-dir={CLAUDE_DIR} main",
            f"git -C C:/b/wt/x format-patch --stdout -o {CLAUDE_DIR} main",
        ], ".claude/・team/・.git はメンバーが書けない場所")

    def test_h5_every_output_is_checked(self):
        self.blocks("meng-tian", [
            f"git -C C:/b/wt/x format-patch -o {CLAUDE_DIR} -o patches/ main",     # 最初のものが外
            f"git -C C:/b/wt/x format-patch -o patches/ -o C:/b/wt/x/p -o {CLAUDE_DIR} main",
            f"git -C C:/b/wt/x format-patch --output {CLAUDE_DIR} main",
            f"git -C C:/b/wt/x format-patch --o={CLAUDE_DIR} main",
            f"git -C C:/b/wt/x format-patch --output-d {CLAUDE_DIR} main",
            f"git -C C:/b/wt/x format-patch -ko {CLAUDE_DIR} main",                # まとめ書きの -o
            f"git -C C:/b/wt/x format-patch -3o {CLAUDE_DIR} main",
            f"git -C C:/b/wt/x format-patch main --stdout --output-directory {CLAUDE_DIR}",
            "git -C C:/b/wt/x format-patch -o patches -o C:/Windows/Temp HEAD~1",       # 書き込み先の外
        ])
        # 値の前に値を取る文字がある o は、-o かどうか決められないので止める
        self.blocks("meng-tian", ["git -C C:/b/wt/x format-patch -Sfoo main"], "決められない")
        # -o の値が無い・$ がある
        self.blocks("meng-tian", ["git -C C:/b/wt/x format-patch main -o", "git -C C:/b/wt/x format-patch -o $HOME main"])

    def test_h5_not_overblocked(self):
        self.passes("meng-tian", [
            "git -C C:/b/wt/x format-patch --stdout HEAD~1",
            "git -C C:/b/wt/x format-patch HEAD~1",
            "git -C C:/b/wt/x format-patch -o patches HEAD~1",
            "git -C C:/b/wt/x format-patch -o patches -o C:/b/wt/x/out HEAD~1",
            "git -C C:/b/wt/x format-patch --stdout -o patches HEAD~1",
            "git -C C:/b/wt/x format-patch -ko patches HEAD~1",
            "git -C C:/b/wt/x format-patch --output-dir=patches -1 HEAD",
            f"git -C C:/b/wt/x format-patch -o {P_SLASH}/patches/ HEAD~1",
        ])

    # ---- P1: tsc ----

    def test_p1_noemit_with_value(self):
        for member in ("ooka-echizen", "meng-tian"):
            self.blocks(member, [
                "npx --prefix C:/b/wt/x tsc --noEmit false -p records/tsconfig.json",   # verification-stage2 P1 の入力
                "npx --prefix C:/b/wt/x tsc --noEmit=false -p records/tsconfig.json",
                "npx --prefix C:/b/wt/x tsc --noEmit FALSE",
                "npx --prefix C:/b/wt/x tsc --noEmit -noEmit false",
                "npx --prefix C:/b/wt/x tsc --noEmit --noemit false",
            ], "--noEmit に値を続けた形")

    def test_p1_other_uncheckable_tsc_forms(self):
        for member in ("ooka-echizen", "meng-tian"):
            self.blocks(member, [
                "npx --prefix C:/b/wt/x tsc --noEmit --incremental -p records/tsconfig.json",
                "npx --prefix C:/b/wt/x tsc --noEmit -i",
                "npx --prefix C:/b/wt/x tsc --noEmit --composite",
                "npx --prefix C:/b/wt/x tsc --noEmit --init",
                "npx --prefix C:/b/wt/x tsc --noEmit -build",
                "npx --prefix C:/b/wt/x tsc --noEmit @records/args.txt",
                "npx --prefix C:/b/wt/x tsc --noEmit -outDir .claude",                     # - 1 つの長い形
                "npx --prefix C:/b/wt/x tsc --noEmit -OUTFILE=.claude/x.js",
            ])

    def test_p1_not_overblocked(self):
        self.passes("ooka-echizen", [
            "npx --prefix C:/b/wt/x tsc --noEmit",
            "npx --prefix C:/b/wt/x tsc --noEmit -p C:/b/wt/x/src/tsconfig.json",
            "npx --prefix C:/b/wt/x tsc --noEmit --project C:/b/wt/x/src/tsconfig.json --pretty false",
            "npx --prefix C:/b/wt/x tsc --noEmit true",
            "npx --prefix C:/b/wt/x tsc --noEmit --outDir records/o",
        ])


class GitWriteArgsTest(HookTestCase):
    """git のファイルの名前を値に取って書き出す引数（build-notes 12.11）。--build-fake-ancestor・--separate-git-dir と、
    format-patch の --output をファイルとして照合すること。"""

    WRITE = "ファイルへ書き出す"

    def blocks(self, member, commands, contains=None):
        for command in commands:
            with self.subTest(member=member, command=command):
                self.assertBlock(self.bash(member, command), contains)

    def passes(self, member, commands):
        for command in commands:
            with self.subTest(member=member, command=command):
                self.assertPass(self.bash(member, command))

    def test_build_fake_ancestor_inputs(self):
        self.blocks("meng-tian", [
            "git -C C:/b/wt/x apply --build-fake-ancestor=C:/b/x.idx patches/p.patch",   # 前回の報告の形
            f"git -C C:/b/wt/x apply --build-fake-ancestor={CLAUDE_DIR}x.idx patches/p.patch",
            "git -C C:/b/wt/x apply --build-fake-ancestor .claude/x.idx patches/p.patch",
            "git -C C:/b/wt/x apply --check patches/p.patch --build-fake-ancestor=x.idx",  # 後ろの位置
            "git -C C:/b/wt/x apply --BUILD-FAKE-ANCESTOR=x.idx patches/p.patch",
        ], self.WRITE)

    def test_build_fake_ancestor_every_abbreviation_any_subcommand(self):
        # 最短 --b（1 文字）から名前の全体まで。どのサブコマンドでも止める（apply 以外は git が拒む見込みでも止める）
        name = "build-fake-ancestor"
        for n in range(1, len(name) + 1):
            opt = "--" + name[:n]
            for command in (f"git -C C:/b/wt/x apply {opt}=x.idx p.patch",
                            f"git -C C:/b/wt/x apply {opt} x.idx p.patch",
                            f"git -C C:/b/wt/x am -3 {opt}=x.idx",
                            f"git -C C:/b/wt/x format-patch {opt.upper()}=x.idx HEAD~1"):
                with self.subTest(command=command):
                    self.assertBlock(self.bash("meng-tian", command), self.WRITE)

    def test_separate_git_dir_inputs(self):
        clone = "git clone https://github.com/microsoft/vscode.git C:/b/vscode"
        self.blocks("meng-tian", [
            f"{clone} --separate-git-dir={CLAUDE_DIR}g",
            f"{clone} --separate-git-dir C:/b/g",
            f"{clone} --sep=.claude/g",
            f"{clone} --s .claude/g",
        ], self.WRITE)

    def test_separate_git_dir_every_abbreviation_any_subcommand(self):
        name = "separate-git-dir"
        clone = "git clone https://github.com/microsoft/vscode.git C:/b/vscode"
        for n in range(1, len(name) + 1):
            opt = "--" + name[:n]
            for command in (f"{clone} {opt}=C:/b/g", f"{clone} {opt} C:/b/g",
                            f"git -C C:/b/wt/x status {opt.upper()}=x"):
                with self.subTest(command=command):
                    self.assertBlock(self.bash("meng-tian", command), self.WRITE)

    def test_format_patch_output_is_also_checked_as_a_file(self):
        # --output=<ファイル> は 1 つのファイルに書く。ディレクトリの下としてだけ照合すると、write_paths_deny の
        # ファイルの規則（tasks/*/brief.md・scripts/measure.ps1）に当たらなかった
        self.blocks("meng-tian", [
            f"git -C C:/b/wt/x format-patch --output={P_SLASH}/tasks/a/brief.md HEAD~1",
            f"git -C C:/b/wt/x format-patch --output {P_SLASH}/scripts/measure.ps1 HEAD~1",
            f"git -C C:/b/wt/x format-patch --stdout --output={P_SLASH}/TASKS/a/BRIEF.md HEAD~1",
        ], "write_paths_deny")
        self.blocks("meng-tian", [
            "git -C C:/b/wt/x format-patch --output=C:/Windows/Temp/x.patch HEAD~1",
            f"git -C C:/b/wt/x format-patch --output={P_SLASH}/.claude/settings.json HEAD~1",
        ])

    def test_meng_tian_git_lines_not_overblocked(self):
        # meng-tian の git の行の、ふつうの使い方（省略しない名前）は通る。--binary・--branch・--single-branch・
        # --shallow-since・--skip・--stat など、b・s で始まる省略しない名前も止めない
        self.passes("meng-tian", [
            "git status",
            "git status --short --branch",
            "git diff --stat --summary",
            "git log --oneline --branches -n 3",
            "git show --stat HEAD",
            "git -C C:/b/vscode fetch --tags --shallow-since=2025-01-01",
            "git -C C:/b/vscode worktree add C:/b/wt/x release/1.96",
            "git -C C:/b/vscode worktree add C:/b/wt/x -b work/x release/1.96",
            "git -C C:/b/vscode worktree remove C:/b/wt/x",
            "git -C C:/b/vscode worktree prune",
            "git -C C:/b/vscode tag --list",
            "git -C C:/b/wt/x status --short --branch",
            "git -C C:/b/wt/x diff --stat",
            "git -C C:/b/wt/x apply --check --stat --summary --binary patches/p.patch",
            "git -C C:/b/wt/x apply --3way --index patches/p.patch",
            "git -C C:/b/wt/x am -3 --signoff patches/0001-x.patch",
            "git -C C:/b/wt/x am --abort",
            "git -C C:/b/wt/x am --continue",
            "git -C C:/b/wt/x format-patch -o patches HEAD~1",
            "git -C C:/b/wt/x format-patch --output-directory patches --cover-letter HEAD~3",
            "git -C C:/b/wt/x format-patch --output=C:/b/wt/x/all.patch HEAD~3",
            "git -C C:/b/wt/x format-patch --output=patches/all.patch HEAD~3",
            f"git -C C:/b/wt/x format-patch --output={P_SLASH}/patches/all.patch HEAD~3",
            "git -C C:/b/wt/x checkout -- src/a.ts",
            "git -C C:/b/wt/x checkout -b work/x",
            "git -C C:/b/wt/x clean -xfd",
            "git -C C:/b/wt/x rerere status",
            "git -C C:/b/wt/x rerere diff",
            "git -C C:/b/wt/x add -A",
            "git -C C:/b/wt/x add src/a.ts",
            "git -C C:/b/wt/x commit -m x --signoff",
            "git clone https://github.com/microsoft/vscode.git C:/b/vscode",
            "git clone https://github.com/microsoft/vscode.git C:/b/vscode --single-branch --shallow-submodules --depth 1",
        ])


class Stage2bRecheckTest(HookTestCase):
    """差し戻し2回目（verification-stage2b.md の O2・N5。build-notes 12.12）。"""

    DANGER = "git の危険なオプション"
    NODE = "node の危険なオプション"
    CLONE = "git clone https://github.com/microsoft/vscode.git C:/b/vscode"

    def blocks(self, member, commands, contains=None):
        for command in commands:
            with self.subTest(member=member, command=command):
                self.assertBlock(self.bash(member, command), contains)

    def passes(self, member, commands):
        for command in commands:
            with self.subTest(member=member, command=command):
                self.assertPass(self.bash(member, command))

    # ---- O2: -c はグローバルの位置と clone の後ろだけで止める ----

    def test_o2_subcommand_c_is_not_blocked(self):
        # ls-files の -c は --cached、log・diff の -c は結合差分。設定を与えないので止めない
        for member in ("meng-tian", "cao-shen", "ooka-echizen"):
            self.passes(member, [
                "git ls-files -co --exclude-standard",           # verification-stage2b O2 の入力
                "git ls-files -c",
                "git ls-files -c -o -z",
                "git log -c",
                "git log -c -n 3",
                "git diff -c",
            ])
        self.passes("meng-tian", [
            "git -C C:/b/wt/x commit -m x -c HEAD",              # commit の -c <commit>（メッセージの再利用）
            "git -C C:/b/wt/x diff -c",
        ])

    def test_o2_global_position_c_is_blocked(self):
        self.blocks("meng-tian", [
            "git -c x=y status",
            "git -ccore.x=y status",                             # くっつけ書き
            "git -ccore.hooksPath=C:/b/h status",
            "git -C C:/b/wt/x -c core.pager=calc status",       # -C の後ろもグローバルの位置
            "git -C C:/b/wt/x -ccore.pager=calc status",
            "git --git-dir C:/b/x -c x=y status",                # 値を取るグローバルオプションの後ろ
            "git --shallow-file status -c x=y log",             # --shallow-file は status を値に取る（12.12 で足した）
            "git -c x=y",                                        # サブコマンドが無ければ全部がグローバルの位置
            "git -qc x=y status",                                # まとめ書き
        ], self.DANGER)

    def test_o2_clone_c_is_blocked(self):
        self.blocks("meng-tian", [
            "git clone -c x=y https://github.com/microsoft/vscode.git C:/b/vscode",
            f"{self.CLONE} -c x=y",
            f"{self.CLONE} -ccore.hooksPath=C:/b/h",
            f"{self.CLONE} -qc core.hooksPath=C:/b/h",
            f"{self.CLONE} --config=core.hooksPath=C:/b/h",
            f"git -C C:/b clone -c x=y {self.CLONE[10:]}",
            "git Clone -c x=y https://github.com/microsoft/vscode.git C:/b/vscode",   # 名前の大文字小文字を問わない
        ], self.DANGER)

    def test_o2_long_config_still_blocked_everywhere(self):
        # 長い --config（省略形を含む）はこれまでどおりどの位置でも止める
        self.blocks("meng-tian", ["git -C C:/b/wt/x apply --config=x p.patch", "git log --conf x"], self.DANGER)

    # ---- N5: node の短いオプションのくっつけ書き ----

    def test_n5_short_options_with_glued_values(self):
        self.blocks("meng-tian", [
            "node --check -rC:/b/e.cjs a.mjs",                   # verification-stage2b N5 の入力
            "node --check -r./x.cjs a.mjs",
            "node --check -e1 a.mjs",
            "node --check -p1 a.mjs",
            "node --check -pe 1",
            "node --check -ir x a.mjs",
            "node scripts/build.mjs -rC:/b/e.cjs",               # スクリプトの後ろでも止める
        ], self.NODE)
        self.blocks("cao-shen", ["node --check -rC:/b/e.cjs a.mjs"], self.NODE)

    def test_n5_conditions_is_not_blocked(self):
        # -C（--conditions）とその値は巻き込まない（値に r・e・p があっても）。
        # 本物の node --check はオプションを書けない（2026-11-13）ので、素の node --check を許す仮のメンバーで見る
        for command in (
            "node --check -Cproduction scripts/a.mjs",
            "node --check -C production scripts/a.mjs",
            "node --check -Cdevelopment scripts/a.mjs",
        ):
            with self.subTest(member=BARE_NODE_CHECK, command=command):
                self.assertPassBareNodeCheck(command)
        self.passes("meng-tian", [
            "node --check scripts/a.mjs",
            "node scripts/build.mjs -o C:/b/out",
        ])

    def test_n5_long_abbreviation_is_not_blocked(self):
        # node は長いオプションの省略形を受け付けない見込み（build-notes 12.12）。止めない。
        # 本物の node --check はオプションを書けない（2026-11-13）ので、素の node --check を許す仮のメンバーで見る
        with self.subTest(member=BARE_NODE_CHECK):
            self.assertPassBareNodeCheck("node --check --req=x a.mjs")


class NodeCheckScopedTest(HookTestCase):
    """2026-11-13 の permissions.json の書き換え（build-notes 11.6 の H3・N3・N4）。node --check を
    meng-tian は scripts/・tools/・extensions-src/、cao-shen は tests/・extensions-src/ の下だけに絞った。
    末尾が / の行の決まりにより、オプションも、ほかの場所のファイルも書けない。"""

    NOT_LISTED = "ホワイトリストに無いコマンドです"

    BLOCKED = {
        "meng-tian": [
            "node --check --test a.mjs",
            "node --check --run build",
            "node --check --env-file=x.env scripts/a.mjs",
            "node --check records/x.mjs",
            "node --check scripts/a.mjs --run build",     # パスの後ろに置いても止まる（後ろの語も全部パスに限る）
        ],
        "cao-shen": [
            "node --check --diagnostic-dir=.claude tests/a.mjs",
            "node --check scripts/a.mjs",
        ],
    }

    ALLOWED = {
        "meng-tian": ["node --check scripts/build.mjs"],
        "cao-shen": ["node --check tests/unit/a.test.mjs"],
    }

    def test_blocked_as_not_listed(self):
        # 止まった理由が「ホワイトリストに無い」であること（node の危険なオプションなど、別の検査で偶然
        # 止まったのではないこと）まで確かめる
        for member, commands in self.BLOCKED.items():
            for command in commands:
                with self.subTest(member=member, command=command):
                    err = self.assertBlock(self.bash(member, command), self.NOT_LISTED)
                    self.assertIn(f"{member}: {self.NOT_LISTED}: {command}", err)

    def test_allowed(self):
        for member, commands in self.ALLOWED.items():
            for command in commands:
                with self.subTest(member=member, command=command):
                    self.assertPass(self.bash(member, command))

    def test_probe_member_is_only_in_the_temporary_project(self):
        # 止めすぎの確認に使う仮のメンバーは一時のプロジェクトにだけいて、本物には足していない
        project = bare_node_check_project()
        self.assertNotEqual(project.resolve(), PROJECT.resolve())
        self.assertTrue(list((project / "team" / "departments").glob(f"*/{BARE_NODE_CHECK}/permissions.json")))
        self.assertFalse(list((PROJECT / "team" / "departments").glob(f"*/{BARE_NODE_CHECK}/permissions.json")))
        self.assertFalse((PROJECT / ".claude" / "agents" / f"{BARE_NODE_CHECK}.md").exists())

    def test_probe_member_still_gets_the_fixed_node_checks(self):
        # 仮のメンバーでも、フックの固定の node の検査は効く（素の node --check の許可が抜け道になっていない。
        # 止めすぎの確認が「何でも通る」ことで偽って通っていないことの裏付け）
        project = bare_node_check_project()
        for command in ("node --check --require ./x.cjs a.mjs", "node --check -rC:/b/e.cjs a.mjs",
                        "node --check --experimental_loader=x a.mjs"):
            with self.subTest(command=command):
                self.assertBlock(self.bash(BARE_NODE_CHECK, command, cwd=str(project)), "node の危険なオプション",
                                 project=project)
        with self.subTest(command="node scripts/sub/x.mjs"):
            self.assertBlock(self.bash(BARE_NODE_CHECK, "node scripts/sub/x.mjs", cwd=str(project)), self.NOT_LISTED,
                             project=project)


class RegressionTest(HookTestCase):
    """build-notes 7節の穴（#1〜#3・#9〜#12）が、permissions.json の書き換えと第2段の実装で塞がったこと。
    番号ごとに、前回通った入力が今は止まる。"""

    def block(self, member, command):
        with self.subTest(member=member, command=command):
            self.assertBlock(self.bash(member, command))

    def test_hole_1_pnpm_exec_dlx(self):
        self.block("meng-tian", "pnpm --dir C:/b/wt/x exec calc.exe")
        self.block("meng-tian", "pnpm --dir extensions-src/x dlx cowsay")

    def test_hole_2_node_preload_and_reporter(self):
        self.block("meng-tian", "node --check --require ./tests/x.cjs tests/a.mjs")
        self.block("cao-shen", "node --test --test-reporter-destination=.claude/settings.json tests/")
        self.block("ooka-echizen", "node --test --test-reporter-destination=.claude/settings.json tests/")

    def test_hole_3_worktree_add_anywhere(self):
        self.block("meng-tian", "git -C C:/b/vscode worktree add E:/develop/self/Team/projects/ai-editor/.claude/x")

    def test_hole_9_fetch_upload_pack_and_clone_template(self):
        self.block("meng-tian", "git -C C:/b/vscode fetch --upload-pack=calc.exe file:///C:/x")
        self.block("meng-tian", "git clone https://github.com/microsoft/vscode.git C:/b/vscode --template=C:/b/t")
        self.block("meng-tian", "git clone https://github.com/microsoft/vscode.git C:/b/vscode --config core.hooksPath=C:/b/h")

    def test_hole_10_apply_unsafe_paths(self):
        self.block("meng-tian", "git -C C:/b/wt/x apply --unsafe-paths patches/p.patch")
        self.block("meng-tian", "git -C C:/b/wt/x am --directory=C:/x patches/p.patch")

    def test_hole_11_tsc_outdir(self):
        self.block("meng-tian", "npx --prefix C:/b/wt/x tsc --outDir .claude")
        self.block("ooka-echizen", "npx --prefix C:/b/wt/x tsc --outDir .claude")

    def test_hole_12_ooka_runs_records(self):
        self.block("ooka-echizen", "node --test records/x.mjs")


class SecretInCommandTest(HookTestCase):
    """secret_paths（%LOCALAPPDATA%/Shuko/watch/・secrets/）がコマンドの文字列に現れたら止める。
    LOCALAPPDATA はテストの一時ディレクトリ（hookrun.FAKE_LOCALAPPDATA）。"""

    def commands(self):
        from hookrun import FAKE_LOCALAPPDATA

        local = FAKE_LOCALAPPDATA
        slash = local.replace("\\", "/")
        msys = "/" + slash[0].lower() + slash[2:]
        return [
            f"git diff --no-index {local}\\Shuko\\secrets\\token x",
            f"git diff --no-index {slash}/Shuko/secrets/token x",
            f"git diff --no-index {slash.upper()}/SHUKO/SECRETS/token x",
            f"git diff --no-index {slash}//Shuko/./secrets/token x",
            f"git diff --no-index {slash}/Shuko/x/../secrets/token x",
            f"git diff --no-index {msys}/Shuko/watch/state.json x",
            "git diff --no-index %LOCALAPPDATA%/x x",
            "git diff --no-index $env:LOCALAPPDATA/x x",
            "git diff --no-index ${env:LOCALAPPDATA}/x x",
            "git diff --no-index $LOCALAPPDATA/x x",
            "git diff --no-index ~/AppData/Local/Shuko/secrets/token x",
            "git diff --no-index ~/AppData/Local/Shu\"\"ko/secrets/token x",
            "git diff --no-index ~/AppData/Local/Shu\\ko/secrets/token x",
            "git diff --no-index '~/AppData/Local/Shuko/watch/x' y",
        ]

    def test_blocked_for_every_member_with_bash(self):
        for member in ("meng-tian", "cao-shen", "ooka-echizen"):
            for command in self.commands():
                with self.subTest(member=member, command=command):
                    self.assertBlock(self.bash(member, command), "secret_paths")

    def test_unexpandable_env_blocks(self):
        self.assertBlock(self.bash("meng-tian", "git status"), "展開できない", env_extra={"LOCALAPPDATA": None})
        self.assertBlock(self.bash("meng-tian", "git status"), "展開できない", local="")

    def test_unrelated_commands_still_pass(self):
        self.assertPass(self.bash("meng-tian", "node tools/watch/watch.mjs"))
        self.assertPass(self.bash("meng-tian", "git log --grep Shuko"))


class PowerShellTest(HookTestCase):
    """PowerShell ツールにも同じ規則が効く（今は誰の tools にも無いので、一時のプロジェクトで tools に足して確かめる）。"""

    def test_powershell_uses_bash_rules(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = make_project(tmp)
            definition = project / ".claude" / "agents" / "meng-tian.md"
            text = definition.read_text(encoding="utf-8").replace("tools: Read,", "tools: PowerShell, Read,", 1)
            definition.write_text(text, encoding="utf-8")

            def ps(command):
                return event("PowerShell", {"command": command}, agent_type="meng-tian", cwd=str(project))

            for command in ("git status", "node scripts/build.mjs", "git -C C:/b/wt/x status"):
                with self.subTest(command=command):
                    code, err = run(ps(command), project=project)
                    self.assertEqual(code, 0, err)
            for command in (
                "Remove-Item -Recurse x",
                "git status; Remove-Item x",
                "node --check (Remove-Item x)",
                "node scripts/build.mjs $(Remove-Item x)",
                "git -C C:/b/wt/.. status",
                "git diff --no-index $env:LOCALAPPDATA/Shuko/secrets/t x",
                "git diff --output=x",
                "git status > x",
            ):
                with self.subTest(command=command):
                    code, err = run(ps(command), project=project)
                    self.assertEqual(code, 2, err)


if __name__ == "__main__":
    unittest.main()
