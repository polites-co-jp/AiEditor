# 引き継ぎ（蒙恬 → ヴラド・ツェペシュ）: basedpyright が Python 拡張なしで起動しない件の調べ

SubagentHandback は権限のフックで止められるため、この文書を報告とする。本文は `basedpyright-probe.md`。

- 結果: 完了（調べ物。判断は含めない）

## 要点

1. basedpyright 1.40.2 の拡張は `ms-python.python` を依存に持たない（manifest に `extensionDependencies`・`extensionPack` なし）。失敗するのは、既定の `basedpyright.importStrategy: "fromEnvironment"` が Python 拡張の API で環境を探すため。公式の文書（https://docs.basedpyright.com/latest/installation/ides/ ）と issue #1188（https://github.com/DetachHead/basedpyright/issues/1188 、2025-04 起票、open）が、回避に「Python 拡張を入れる」か「`basedpyright.importStrategy: "useBundled"`」を挙げている。取得日は 2026-11-13。
2. 実機（本家 1.146.0、`upstream-default` と同じ拡張・設定の新しい環境 `bp-probe-a`〜`d`）で確かめた:
   - そのまま → 失敗（同じ誤り）
   - `python.defaultInterpreterPath`・`python.pythonPath` に `C:\Python314\python.exe` → 失敗（同じ誤り）
   - `useBundled` → 起動し、`sample.py` を解析した（`basedpyright.log` に `checking: ... sample.py`）
   - `useBundled` と Python の場所 → 起動し、`Setting pythonPath ... c:\Python314\python.exe` で解析した
3. 同梱のサーバーを LSP で直に動かすと、`sample.py` の2行目に `reportOperatorIssue`（エラー）と `reportUnknownVariableType`（警告）の診断が返った。PATH から Python を外しても同じ診断が返った（Python 本体なしでも型の検査は動く。入っているパッケージの型は Python があるときだけ解決される）。画面の問題パネルに出るかは、ユーザーの手の確かめが要る。
4. `ms-python.python` を足す場合: Open VSX の最新は 2026.4.0（2026-03-13、6.8 MB、MIT、verified、発行 open-vsx）で、GitHub の最新 2026.10.0 より古い。`extensionPack` に Pylance（Open VSX に無い）・debugpy・python-envs。manifest にデバッガ（`python`）、ブレークポイント、AI の言語モデルツール6件、`codeActionAI`・ノートブック系の提案中 API、walkthrough 2件がある（C-1・C-2・C-4・B-2 で消す受け手に当たる）。本家の product.json はこの拡張の提案中 API を許可している。
5. 代わりの候補（事実だけ）: `astral-sh.ty` 2026.96.0、`meta.pyrefly` 1.4.9001、`ms-pyright.pyright` 1.1.402（Open VSX では 2025-06 で止まっている）、`charliermarsh.ruff`（リンター）。どれも依存・パックなし。

## 成果物

- `E:\develop\self\Team\projects\ai-editor\tasks\2026-11-13-p0-basedpyright-probe\basedpyright-probe.md`
- 台本（新規）: `scripts/p0-openvsx-meta.mjs`（Open VSX のメタデータと manifest。VSIX は取らない）、`scripts/p0-lsp-probe.mjs`（言語サーバーを LSP で直に動かして診断を取る。ファイルは読むだけ）
- 台本（変更）: `scripts/lib/p0-common.ps1` に環境 `bp-probe-a`〜`d` を足した（`p0-env.ps1 -All` で作り直される。要らなければ外す）
- 記録: `C:\b\p0\data\bp-probe-*\user\user-data\logs\`（`exthost.log`、`detachhead.basedpyright\basedpyright.log`）、`C:\b\p0\probe\openvsx\`

## 守ったこと

- 手の確かめの環境（`upstream-ai-disabled`・`testbed` など）は起動も作り直しもしていない。
- 起動したのは `bp-probe-a`〜`d` だけで、毎回、起動した PID の木だけを止めた。
- `C:\b\p0\scratch\sample.py` は開いて読んだだけで、保存していない。

## 未解決・伝えること

- 画面の問題パネルに basedpyright の診断が出るか（`useBundled` のとき）は、ユーザーの手の確かめで見る必要がある。エディタの LSP の記録の設定（`basedpyright.trace.server`）は効かなかった。
- `bp-probe-a` の1回目の起動で、ファイルの場所の指定を誤った（Bash の中で `\` が落ち、`C:bp0scratchsample.py` という存在しない場所を開いた）。保存はしていないので、ファイルは作られていない見込み。
- 曹参の計測（0-4）の基準値は、今のままでは Python の言語サーバーが動かない状態の値になる。`useBundled` を計測の環境に入れるか、`mydist` の既定に入れるかなどは、ユーザーの裁定が要る。

---

## 追記（2026-11-13 07:40 JST）: 裁定の反映

結果: 完了。詳しくは `basedpyright-probe.md` の6節。新しい台本2本の使い方は5節。

1. `extensions-src/mydist/package.json` の `configurationDefaults` に `"basedpyright.importStrategy": "useBundled"` を足した。`extensions-src/mydist/README.md` に理由と裁定を書いた。
2. `scripts/lib/p0-common.ps1` の計測の設定に同じ値を足し、`upstream-default` と `testbed-measure` だけを `p0-env.ps1 -Name` で作り直した（導入は全部終了コード 0）。2つの `settings.json` と `p0-env.json` の `settings` が `task.allowAutomaticTasks: on`、`security.workspace.trust.enabled: false`、`basedpyright.importStrategy: useBundled` であることを読んで確かめた。
3. `bp-probe-a`〜`d` は `InAll = $false` で `-All` の対象から外した（`p0-env.ps1 -List` に `all=False`）。土台の設定から `importStrategy` を除くので、中身は試しのときのまま。ログは消していない。
4. 手の確かめの環境は起動も作り直しもしていない。`-All` は走らせていない。
5. 確かめ:
   - `scripts/p0-check-ps.ps1`: 11 本とも誤り無し。
   - `upstream-default` を1回だけ短く起動した（`sample.py` だけを開き 30 秒、pid 44192 の木 12 プロセスだけを止めた）。`exthost.log` に `[error]` は無く、basedpyright は `onLanguage:python` で起動した。`basedpyright.log` に `basedpyright language server 1.40.2 starting`、`Python extension not found`、`Assuming Python version 3.14.7.final.0`。
   - その後、計測のひな形に初回の起動の名残を残さないため `upstream-default` をもう一度作り直した。**そのため、この起動のログはデータの場所から消えている**（上の行は消える前に読んで写した）。ログを残す必要があったなら、私の手順の誤り。もう一度起動してログを別の場所に写すには、写すための台本か許可が要る。

伝えること:

- `mydist` の環境は `extensions-src\mydist` を直に読むので、ユーザーが次に起動したときから `basedpyright.importStrategy` の既定が入る。0-9 の5項目の確かめには影響しない。
- `tasks/2026-11-13-p0-envs-mydist-keys/env-setup.md` の4節の表の `upstream-default`・`testbed-measure` の「ユーザー設定」の列は、`basedpyright.importStrategy` が無いままになっている。ユーザーが読んでいる手順書なので、今回は触れていない。直してよいときに知らせてほしい。
- 曹参の `measure.ps1` は環境のひな形を写して使うので、作り直した後のひな形で測れば `useBundled` が効く。
