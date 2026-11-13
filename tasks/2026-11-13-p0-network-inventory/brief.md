# Phase 0 の 0-5: 監査の台本の検証と、本家の外向き通信の棚卸し

- 担当: ooka-echizen（大岡越前守）
- 依頼日: 2026-11-13
- 状態: 完了

## 目的

ユーザーの裁定（2026-11-13 の「通信の扱いの訂正」）で、不要な通信（データ収集、更新の確認など）はすべて止め、要る通信（Claude、git のリモート、Notion）だけを残す。そのために、本家がどこへ通信しているかを洗い出し、どの宛先をどう止めるかの表を作る。あわせて、ホスト名を取れるようにした監査の台本を確かめる。

## 入力

- docs/user-decisions.md の「通信の扱いの訂正」
- docs/07 の2.6（0-5。出力の表の列）と3.3（監査の手順。今日、名前の付け方を直した）
- 曹参: `tasks/2026-11-13-p0-netaudit-hostnames/`（hostname-design.md、handoff-notes.md、trial/）、`scripts/netaudit.ps1`、`scripts/measure.ps1`（`Start-EditorProcess` に引数を3つ足した）、`tests/netaudit.tests.ps1`
- 環境: `C:\b\p0\data\upstream-ai-disabled\`（本家で AI を止めた）、`upstream-default\`（本家の既定）、`testbed\`（VSCodium）。ワークスペースは `tmp\ws\`
- docs/04 の6.1（止める設定を足す先）、docs/03 の4節（削除の単位）

## やること

1. 曹参の直しのレビュー。
   - ネットのログを `C:\b\p0\netlog\` に置き、記録にはホスト名と回数だけを写しているか。
   - 普段使いのデータに触れないか。
   - アドレスとホストの取り違えへの備え。
   - `measure.ps1` の変更が既定の動きを変えないか。
   - テストを走らせる（netaudit 98件、measure 134件と申告）。
2. 合格なら、0-5 の本番を行う。`upstream-ai-disabled`・`upstream-default`・`testbed` の3通りで、それぞれ起動から10分。
3. `records/phase0/network-inventory.md` を書く（docs/07 の2.6 の列）。
   - 列: 宛先（ホスト名）・接続したプロセス・何のための通信か・要るか（要る / 設定で止める / 単位で消す）・止め方。
   - 「要る」は Claude・git のリモート・Notion に当たるものだけ。ほかは止め方を書く。止め方は、設定（docs/04 の6.1 に足す案）か、削除の単位（docs/03 の4節のどれか、無ければ新しい単位の案）。
   - Claude Code の CLI（claude.exe）の通信は別の表にする。
4. `records/network-allowlist.json` の最初の版を書く（要る宛先だけ）。
5. 名前が付かなかった宛先の扱い（管理者の権限で DNS クライアントのイベントログや pktmon を使うべきか）に意見があれば書く。自分では有効にしない。

## 守ること

- コードは直さない。書き込みは `records/` と `tasks/` だけ。
- 別の大岡越前守（タスク `2026-11-13-p1-verify-smoke-prepare`）が並行して、スモークの台本を公式の zip に向けて走らせている。同じ環境（`C:\b\smoke\`）に触れない。使う環境は上の3つだけ。
- `C:\b\wt\1.146.0` に触れない。
- 起動した PID の木だけを止める。`p0-stop.ps1` を使わない。
- ネットのログの中身（秘密が載りうる）を、記録やこのディレクトリに写さない。

## 完了条件

- 1 に合否と理由がある。合格なら、3通りの10分の監査の記録、`records/phase0/network-inventory.md`、`records/network-allowlist.json` がある。

## 成果物

このディレクトリに保存する。

- `verification-log.md`、`handoff-notes.md`（報告）。records/ の2つ（合格のとき）。

## 結果

合格。本家 1.146.0 の外向き通信を3通り×10分で棚卸しし、`records/phase0/network-inventory.md` と `records/network-allowlist.json` を作った。止める設定・単位を docs/02・03・04 に反映した。

## 未解決

- Claude の宛先は、自作のビルドで観測して確定する（裁定 2026-11-13）。

## 次の担当

リーダーが、止める設定を docs/04 の6.1 に、止める単位を docs/03 に反映する。
