# 引き継ぎ: 0-5 監査の台本の検証と、本家の外向き通信の棚卸し（大岡越前守）

## 完了報告

- 判定: 曹参の台本の直しは**合格**。0-5 の本番（3通り×10分）を行い、棚卸しの表と許可の一覧の最初の版を書いた。
- 確かめた成果: 曹参の `scripts/netaudit.ps1`（ホスト名の取得）、`scripts/measure.ps1`（`Start-EditorProcess` の引数3つ）、`tests/netaudit.tests.ps1`（31件を足した）、`tasks/2026-11-13-p0-netaudit-hostnames/`。
- 根拠:
  - `tests/netaudit.tests.ps1` passed 98 / failed 0、`tests/measure.tests.ps1` passed 134 / failed 0（どちらも申告どおり）。
  - 差分を読んだ。ネットのログは `C:\b\p0\netlog\` に置かれ、記録に写るのはホスト名と回数だけ。普段使いのデータを指す変更は無く、止めるのは起動した PID の木だけ。共有の CDN アドレスで取り違えないよう、`Map` と `AnswerMap` を分け、ホストごとの照合を足してある。measure.ps1 は、新しい引数を省けば従来と同じ動き。
  - 実機の4回（10分×3、30秒×1）とも、普段使いの `argv.json` に変化は無く、作業データも残らなかった。記録には URL もトークンらしい文字列も無い。
- 不合格の点: なし。合否に響かない指摘が3件あり、直すのは曹参（verification-log.md の1.6）。
  1. Node の接続が、Chromium の開いたアドレスと同じアドレスへ行くと、行に Chromium 側の強い名前が付く。ホストを見落とすことにはならない（ホストごとの表には別に出る）。
  2. `ExtraEnv` の戻しに単体テストが無い。
  3. 台本の冒頭の説明で、出力のファイル名が古い（`netlog-hosts.csv` → `named-hosts.csv`）。
- 記録:
  - `tasks/2026-11-13-p0-network-inventory/verification-log.md`
  - `records/phase0/network-inventory.md`（棚卸しの表）
  - `records/network-allowlist.json`（最初の版。要る宛先だけ）
  - `records/network-audits/2026-11-13-p05-upstream-ai-disabled/`、`...-p05-upstream-default/`、`...-p05-testbed/`（各回の audit.md・destinations.csv/json・named-hosts.csv・samples.csv・dns-cache.csv）
  - `tasks/2026-11-13-p0-network-inventory/allowlist-draft.json`（実行に使った下書き）、`allowlist-check/`（一覧の形式を確かめた30秒の回）

## 棚卸しの要点

- 本家 1.146.0 は、AI を止めても次の5件に必ず通信する。いずれも「要る」ではない。
  - `mobile.events.data.microsoft.com`（テレメトリ）
  - `default.exp-tas.com`（実験の設定）
  - `update.code.visualstudio.com`（更新の確認）
  - `marketplace.visualstudio.com`（ギャラリー）
  - `main.vscode-cdn.net`（product.json の controlUrl・emergencyAlertUrl などのどれか。未確認）
- AI が既定のままだと、さらに Node 側から次の宛先へ通信する。`chat.disableAIFeatures: true` で止まった。
  - `exp.individual.githubcopilot.com`
  - AgentHost の `github.com`・`release-assets.githubusercontent.com`・GitHub の CDN
- 試験台（VSCodium）は `open-vsx.org` と `raw.githubusercontent.com` の2件だけ。
- 止め方の多くは、docs/04 の6.1 にある既定の設定と、既存の単位（B-1・B-2・C-5・A-1・C-1）で足りる。新しく要るのは2つ。
  - `main.vscode-cdn.net` を止める product.json のキーの削除（新しい単位の案 B-6-online-feeds と、C-1 の remove に足すキー）
  - WPAD（`wpad` の名前の問い合わせ）の扱い
- 要る通信（Claude・git・Notion）は、3回とも1件も出なかった。

## リーダーへ（判断が要ること）

1. **claude.exe の表が空。** パネルを開かない起動の監査では claude.exe が起動しない。Claude の宛先を観測で確かめるには、パネルを開いて決まった1文を送る監査を1回行う必要がある。これは手で行うので、ユーザーの手が要る。それまでは、許可の一覧の Claude の行は裁定から書いた仮のもの（`*.anthropic.com` は claude.exe だけに絞った）。
2. **Claude Code 自身の付帯の通信。** Claude Code の CLI は、API のほかにテレメトリやエラーの報告を送ることがある（一般に知られた挙動。この監査では観測していない）。裁定では「Claude（Claude Code の拡張と CLI が使う宛先）」を要るとしている。CLI のデータ収集も止める対象に入れるか（Claude Code の環境変数で付帯の通信を切る方法がある）は、ユーザーに諮る事項だと考える。私は決めていない。
3. **docs への反映**（依頼書の「次の担当」）: 6.1 の候補4件を確定させること、B-6 の案、C-1 の product.json の remove に足すキー。表は `records/phase0/network-inventory.md` の5節。

## 名前が付かなかった宛先の扱い（依頼書の5。意見）

- 今回、名前が付かなかったのは upstream-default の Node 側の3件だけ。どれも Node のデバッグ出力でホスト名の一覧は取れていて、アドレスとの対応だけが推定だった。止める対象（AI の通信）で、`chat.disableAIFeatures` で消えることも確かめた。**0-5 の目的（止める宛先を洗い出す）には、管理者の権限は要らなかった**。
- 管理者の権限（DNS クライアントのイベントログ、pktmon）が効くのは、claude.exe の宛先を確かめる回と、自作のビルドの関門（`absentHosts`）で「短い接続も含めて1件も出ない」ことを確かめる場面。勧めるのは、DNS クライアントのイベントログだけを、claude.exe の監査の回に限って有効にすること（pktmon はパケットまで取るので、秘密に近い）。有効にするかはユーザーの判断で、私は有効にしていない。

## 後片付け（私の権限ではできない）

- `C:\b\p0\netlog\` に、今回の4回分のネットのログと Node の出力（`p05-*`）が残っている。秘密を含むものとして扱い、要らなくなったら消す。
- `C:\b\p0\run\` の作業データは、台本が4回とも消した（`RunDataLeftOver` は空）。
