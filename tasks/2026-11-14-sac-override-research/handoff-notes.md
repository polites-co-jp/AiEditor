# 引き継ぎ: Smart App Control の例外の有無の調べ

- 担当: 蒙恬（meng-tian）
- 日付: 2026-11-14
- 結果: **完了**（brief の 1〜4 に出典つきの答えがある。5 も添えた）

## 成果物

- `tasks/2026-11-14-sac-override-research/sac-override.md`: 1〜4 の答えと出典、この PC で読んで確かめたこと、ユーザーへの選択肢の案 A〜D。
- `tasks/2026-11-14-sac-override-research/env-check.json`: `check-env.ps1` の出力（19:55 JST）。
- `tasks/2026-11-14-sac-override-research/ci-events-sac-14d.json`: Smart App Control のポリシーによる阻止（過去 14 日。4件）。
- `tasks/2026-11-14-sac-override-research/ci-events-14d.json`: 絞り込み無しの Code Integrity のイベント。上限の 200 件で切れている。大半は ESET の 3033 で、今回の件とは関係が無い。参考までに残した。

## 要点

1. ユーザーの「リスクを確認して実行できるはず」は、Smart App Control には当てはまらない。公式の FAQ に「There is currently no way to bypass Smart App Control protection for individual apps.」とある。
2. 「詳細情報 → 実行」は SmartScreen の仕組みで、Smart App Control がオンのあいだは止まっている。DLL・`.node` の阻止で出るのは「アプリの一部をブロックしました」の知らせだけ（「詳細情報」のリンクのみ）。読み込みは失敗する。
3. ダウンロードの印の有無は関係しない。Smart App Control は、印の無いものを含むすべての実行ファイルを確かめる（Microsoft Learn）。
4. オフにした後、またオンにできる（公式の FAQ と KB5079391）。ただし 2026-10-13 の KB5127648 で「オフの後にオンにできない」不具合が 26H2 にもあった。2026-10-28 以降の更新（KB5127936、26300.9818）で直っている。この PC の UBR は台本では分からなかった。
5. 新しく分かったこと: ビルドの最中にも、node.exe が自分で作った `bufferutil.node` を読み込んで3回止められていた（19:10・19:13・19:25）。導入は終了コード 0 で通ったので、気づかれていなかった。

## リーダーへ（ユーザーに諮るとき）

- 選択肢の案は `sac-override.md` の6節にある。A オフにする、B 信頼できる証明書で署名する、C オフにして App Control for Business の自前のポリシーに置き換える、D 別の PC・VM で確かめる、の4つ。蒙恬の見立ては A（守りを落としたくなければ C）。
- A を選ぶ場合、オフにする前に、ユーザーに `winver` で `26300.9818` 以上かを見てもらうとよい（後でオンに戻すため）。
- 19:32 に「アプリの一部をブロックしました」の知らせが出たかどうかは記録に無い。気になるなら、ユーザーに Windows セキュリティの「保護の履歴」を見てもらう。

## 確かめたこと（自分で動かした結果）

- `check-env.ps1`: `os.version` 10.0.26300.0、`smartAppControl.verifiedAndReputablePolicyState` 1（`on`）。`missing` は空。
- `p1-ci-events.ps1 -Minutes 20160 -Max 500 -Filter "0283ac0f"`: 3077 が4件。ポリシーはすべて `VerifiedAndReputableDesktop`。内訳は `winregistry.node`（Code - OSS.exe）が1件、`bufferutil.node`（node.exe）が3件。
- Web の出典は 2026-11-14 に取得した。URL は `sac-override.md` の各表にある。

## テストの入口（曹参へ）

コードは作っていない。今回の調べから、テストに足すとよい点:

- `check-env.ps1` の `smartAppControl.meaning` は 0・1・2 を `off`・`on`・`evaluation` に対応させている。この対応は Microsoft Learn「Application Control for Windows」の表と合う。値が無いときに `unknown` になることも確かめるとよい。
- `p1-ci-events.ps1 -Filter "0283ac0f"` で Smart App Control の阻止だけに絞れる。メッセージに含まれる Policy ID で絞っている。`-Max` は絞り込んだ後の件数で効く。

## docs/ との食い違い

- 02 の5節に、Smart App Control がオンだと自分のビルドが起動しないことが書かれていない。これは前のタスクの `doc-corrections.md` の A8 で既に出ている。
- 足すとよいこと:
  - ビルドの途中でも、自分で作った `.node` の読み込みが止められる（`bufferutil.node`）。
  - アプリごとの例外は無い。
  - オフの後、またオンにできる（26H2 では 2026-10-28 以降の更新が要る）。

## 未解決の点

- この PC の UBR（`26300.<UBR>`）。読む手段が今の許可に無い。ユーザーに `winver` で見てもらえば足りる。
- `winregistry.node` にダウンロードの印が無いことの直接の確かめ。代替データストリームの読み込みは、フックに止められた（回避していない）。Smart App Control は印の有無を問わないので、結論には響かない。
- 手元のビルドの `Code - OSS.exe` そのものが止められなかった理由（署名か評判か）。署名を読むコマンドは、今の許可に無い。案 B・C を選ぶときに要る。
- 案 B の Artifact Signing を、日本の個人で使えるか。調べていない。案 B を選ぶときに調べる。
- オンに戻したとき、すぐ強制になるのか、評価のモードからやり直すのか。出典に書かれていなかった。
