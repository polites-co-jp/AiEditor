# docs と食い違った点・仕様が足りず決めた点

## docs と食い違った点・直す案

1. **docs/07 の2.1 / 3.2 の `C:\b\p0\ws\` は `tmp\ws\` に変わった**（裁定 2026-11-13）。台本の既定値は直した。蒙恬の `scripts/p0-ws.ps1`・`scripts/p0-launch.ps1`（と依頼書）にはまだ `C:\b\p0\ws` が残っている（`p0-ws.ps1` は `-Workspace` と `ws-info.json` の置き場所の既定も）。蒙恬の担当なので触れていない。
2. **Node 24 では `node --test tests/` が動かない**（フォルダを受け付けない。Node 22 以降の仕様）。docs と権限の定義にある `node --test tests/` の形を、`node --test` のグロブ（`tests/*.test.mjs`）か引数なしに変える必要がある。引数なしだと `*.test.mjs` を自動で探す。権限の書き換えはユーザーの承認が要るので、私は変えていない。
3. **`Get-DnsClientCache` が空**（この環境、非管理者）。docs/07 の3.3 の2「始めと終わりに `Get-DnsClientCache`」だけではホスト名が付かない場合がある。実機での切り分け後に、3.3 に「管理者で実行 / pktmon を併用」を足すか決める。

4. **差し戻し後に分かったこと（2026-11-13）**
   - docs/07 の3.2 の1「起動」には `VSCODE_PORTABLE` と、**親の `ELECTRON_RUN_AS_NODE`・`VSCODE_*` を外すこと**が要る（残っていると Code.exe は node として動き、終了コード 9 で終わる。claude 経由で起動する台本では必ず起きる）。蒙恬の `p0-launch.ps1` も同じ状況で起動するなら同じ対策が要る。
   - docs/07 の3.2 の6「役割を `CommandLine` から付ける」: 1.146.0 では拡張ホスト・ptyHost・共有プロセスが同じ `--utility-sub-type=node.mojom.NodeService` で、`CommandLine` から区別できない（`utility-node` まで）。区別が要るなら別の手段（親子関係、ETW など）を決める。
   - 本家の既定のまま（AI 有効）で `copilot-runtime.exe`（`@github\copilot-sdk`）が常駐する。0-4・0-5 の材料になる。
   - 蒙恬の env-setup.md 6節にある「`measure.ps1` の `-Workspace` の既定は `C:\b\p0\ws` のまま」は、直して `tmp\ws` になった。
6. **docs/07 の3.2 の2「CLI（`-r`）で決まった2つのファイル（TS と Python）を開く」（リーダーが docs を直す）**: 2つのファイルを1回の `-r` で渡すと、見えるのは最後の1つだけで、もう1つは背景のタブのまま言語が有効にならず、その言語サーバーが起動しない（1.146.0 で確かめた: TS だけ起動し、`onLanguage:python` が来なかった）。**ファイルは1つずつ、10 秒あけて `-r` で開く**と、両方の言語が有効になる。3.2 の2をそう直す案。台本は `Open-EditorFiles`（既定の間隔 10 秒）で行っている。
   - あわせて、`powershell -File` では `-OpenFiles a,b` が配列でなく1つの文字列になるので（5.1 の仕様）、台本は `,` で分け、ちょうど2つで存在することを確かめる。docs の使い方の例にこの注意を足す案。
   - さらに、basedpyright 1.40.2 は Python 拡張（`ms-python.python`）が無いと有効化に失敗し（`Python extension is not installed or is disabled`）、Python の言語サーバーのプロセスが出ない。台帳に Python 拡張が無い。0-4 の基準値の「言語サーバーが動いた状態」の定義と、台帳に Python 拡張を足すか（ユーザーの裁定）に関わる。
7. Node 24 の件は変わらず（`node tests/<名前>.mjs` に直した）。

## 仕様が足りず自分で決めた点

- 毎回「新しいデータの置き場所」: ひな形（`<名前>\user`・`ext`）を `C:\b\p0\run\<ラベル>-<回>\` に毎回 robocopy で写し、終わったら消す。docs/07 の3.1 は「新しく作る」だけで、作り方を書いていない。拡張は台帳のものが入ったひな形から写すので、「第三者の拡張が同じ版」の条件は満たす。
- 捨てる回は先に行い、記録は残して数えない（`Kind=warmup`）。
- ワークスペースの `tasks.json` は台本が書かない。無ければ止まる（`-SkipTaskCheck` で回避）。
- 合否の「範囲」は2つの範囲の大きいほう。減りが範囲より小さい合格は `WithinRange` で印を付ける。中央値が等しいときは不合格。
- メインプロセスの特定: 名前 + `--type=` なし + 回ごとの `--user-data-dir` を含むコマンドライン。起動した PID だけに頼らない（再起動する起動器でも拾うため）。
- 役割の語彙（measure-design.md）。実機のコマンドラインでの確認は未了。
- 監査: 初めに起動してから 0 秒を数える。ループバックは宛先にしない。宛先は「グループ（editor / claude）+ ホスト名または IP + ポート」。回数は見えたサンプル数。DNS は 30 秒ごとにも取って合算する。新しい宛先は IP でなくホスト名で比べる。許した一覧にないものがあっても終了コードは 0（合否は大岡越前守）。
- 許した一覧の形（netaudit-design.md）。`reason` を必須にした、`*` 単独を禁止した。
- 出力の置き場所の既定: 監査は `records/network-audits/<日付>-<ラベル>/`（docs には `records/phase0/network-inventory.md` と `records/network-allowlist.json` しか無い。生の出力用に別フォルダを決めた）。
- `convertKeybindings` のテスト: 出力から mac/linux/win を除く、デバッグ系のコマンドを落とす、と読んだ。docs/04 の6.2 は「抜き出す」「消した機能のコマンドの項目は落とす」とだけ書き、1引数の関数がどのコマンドを落とすかは約束に無い。実装がこの読みと違えば、仕様の食い違いとして報告し直す（今回は通った）。
