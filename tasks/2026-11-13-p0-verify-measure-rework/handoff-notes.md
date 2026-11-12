# 引き継ぎ（大岡越前守 → ヴラド・ツェペシュ）: Phase 0 の検証（3）

フックが SubagentHandback を止めた（定義の tools に無い）。そのため、報告はこの文書に書く。詳しい記録は `verification-log.md`。

## 判定

- **曹参の台本（measure.ps1・netaudit.ps1）: 不合格。** 直すところは1つで、小さな修正で済む（B-5）。
- **曹参の単体テスト4本: 合格。** 88、65、79、27件がすべて通った。
- **蒙恬の A-1〜A-3: 合格。**
- **蒙恬の A-4: 導入待ち。** `node_modules/ovsx` と lockfile がまだ無い。

## 台本が不合格の理由（B-5、要修正、曹参）

書かれた使い方の `-File ... -OpenFiles <TS>,<Py>` では、2つのファイルが開かない。

- Windows PowerShell 5.1 の `-File` では `a,b` が配列にならず、`"a,b"` という1つの文字列になる。
- その結果 `-r` に、存在しない1つのパスが渡る。
- 私の実行の `summary.json` の `OpenFiles` は1要素だった。曹参の試し（`trial/out-real`）も `"a.ts,b.py"` の1要素で、同じ状態だった。
- 回のデータが消える前に `exthost.log` を見た。`onLanguage:python`（パスの末尾が .py のため）はあったが、`onLanguage:typescript` は無く、tsserver のプロセスも無かった。TS のファイル自体は `tmp\ws` にあることを確かめた。

docs/07 の3.2 の2を満たさず、このままでは 0-4 の基準値が小さく出る。

**直し方の案:**

- 本体で `,` を区切りとして分ける。
- 2つあること、存在することを確かめ、満たさなければ止める。
- netaudit も同じように直す。
- `-File` で起動するテストを足す。
- measure-design.md・netaudit-design.md の試しの記述も直す。

## そのほかは確かめられた

- **B-1:** `-File` 起動で `-Workspace` を省いても、`tmp\ws` で動いた。
- **B-2:** VSCODE_PORTABLE で環境の argv.json が効いた（子のコマンドラインに `--lang=ja`）。普段使いの argv.json は3つとも作られず、`DailyArgvTouched` は空だった。
- **環境変数の除去:** claude から起動しても Code.exe は普通に起動した。
- **B-3・B-4:** どちらも直っていた。
- **ターミナル:** tasks.json のタスクで開いた。ptyHost の子に `OpenConsole.exe` と `powershell.exe -NoLogo -NoProfile` がある。
- **claude.exe の分離:** パネルを使っていないので0件で、「含めた」と「含めない」の合計が同じ値になった。
- **節目の一時停止:** `-r` の後、120秒の待ちの前に `Read-Host` で止まる。docs/07 の3.2 のとおり（読んで確認。実際の一時停止は本番で）。
- **netaudit の出力:** 60秒で30サンプル、宛先8件、claude の表は別で、docs/07 の3.3 の形どおり。DNS キャッシュが空になる件は前回から既知。
- **軽微（曹参、合否には響かない）:**
  - B-6: json の言語サーバー `jsonServerMain` が役割 `other` になる（正規表現が `.js` を求めるため）。
  - B-7: netaudit の `FirstSeenSeconds` が取り始めの時刻を基準にしていて、最大でサンプル1回分ずれる。

## 役割を区別できない件の影響（依頼書の2）

- **合否には響かない。** 3.4 は合計だけで決まる。
- **「重い部分を示す」目的には大きく響く。** 今回の1回では、`utility-node` の5プロセスが 595 MiB で、合計 1,412 MiB の約42%を占めた。この中に、削る候補の AgentHost（194 MiB、子に copilot-runtime 104 MiB）と、残す部品が混ざっている。
  - 拡張ホスト: 171 MiB
  - ptyHost: 82 MiB
  - 残りの2つ: 82 MiB と 67 MiB
- **手がかりは CSV に残っているので、0-4 は止めなくてよい。**
  - 拡張ホストは `--inspect-port=0` で分かる。
  - ptyHost は子の OpenConsole とシェルで分かる。
  - AgentHost は子の copilot-runtime で分かる。
- Phase 2 の比較の前に、役割を付け直す処理を足すことを勧める（曹参）。docs/07 の3.2 の6への書き足しも勧める（リーダー）。

## 蒙恬の A-1〜A-3（差分と試し）

試しは、tasks の下に置いた台帳と `--result`、`--only pdf,dotenv --skip defender` で行った。

- **A-1:** `isOvsxSuccess` は、終了コード 0 で `Signature is valid.` があるときだけ通す。指摘に合う。
- **A-2:** 飛ばした defender は `skipped` に、ovsx は `failed` に入り、`ok: false`、終了コード 1 になった。
- **A-3:** `mergeLock` が次のとおり動いた。
  - 今の台帳の行がある pdf は、ID の大文字小文字を問わずそのまま残した。
  - 今の台帳に無い行は書かなかった。
  - 検証に無い行は後ろに残した。
  - `lockWrite` が記録された。
- **A-4:** 入っていないときは npx を呼ばず `error` になった（`declared: 1.4.0`、`installed: null`）。導入後の実際の起動（`node bin/ovsx`）はまだ確かめていない。

## 気づいた点（合否には響かない）

- **O-1:** `--only` で走らせると、ほかの拡張は前の結果を判定し直さずに台帳へ書く。ovsx を導入したら、Claude Code の走らせ直しは `--only` なしで9件とも行うことを勧める。
- **O-2:** 今の台帳の Claude Code の行は `soak: fail`（前の台本が書いたもの）。走らせ直しでまた通らなければ、この行がそのまま残る。
- **O-3:** 新しい関数4つ（`isOvsxSuccess`・`judgeChecks`・`mergeLock`・`checkPinnedTool`）のテストがまだ無い。曹参への依頼を勧める。
- **対象外:** upstream-default で basedpyright の起動が失敗していた。B-5 のせいかは切り分けていない。

## 守ったこと

- 本番の5回の計測と10分の監査は行っていない。
- 本番の verify-result.json と extensions.lock.json は書き換えていない。
- lock-verify は、走らせた2件の `C:\b\p0\vsix\<拡張>\sig\` と files.json を同じ中身で書き直す。
- 回のデータ（`C:\b\p0\run\ooka-trial-*`）は台本が消した。
- コードは直していない。

## 次の手

- B-5 を曹参に差し戻す。直った版で、私が同じ1回の試しをもう一度行う。
- `pnpm install` の後に、A-4 の確認を私に依頼する。

## 記録

- `tasks/2026-11-13-p0-verify-measure-rework/verification-log.md`
- `tasks/2026-11-13-p0-verify-measure-rework/trial/measure-upstream/`
- `tasks/2026-11-13-p0-verify-measure-rework/trial/netaudit-upstream/`
- `tasks/2026-11-13-p0-verify-measure-rework/trial-lock/`（lock.json・verify-result.json）
