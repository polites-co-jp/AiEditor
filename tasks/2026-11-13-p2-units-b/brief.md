# Phase 2: 段階 B の削除の単位（B-1〜B-6）、product.overlay.json、既定の設定のパッチ、ブランド

- 担当: meng-tian（蒙恬）
- 依頼日: 2026-11-13
- 状態: 完了

## 目的

ユーザーの指示（2026-11-13）で、当初の設計を満たすまで機能の削除を実装する。段階 B（軽い部分）の単位と、product.json の上書き、application スコープの設定の既定を入れるパッチ、ブランドの資産を作る。

## 入力

- docs/03 の2節・3節・4節の段階 B の表（B-1 テレメトリの差し替え〜B-6 online-feeds）・5.2・5.3・9節
- docs/02 の3節（product.overlay.json の表。`shukoConfigurationDefaults`、AI のキーは C-1 の時期など、remove の時期）
- `tasks/2026-11-13-p1-ledger-mydist-decisions/app-scope-options.md`（案B-2: `src/vs/platform/configuration/common/configurationRegistry.ts` の登録の直後で、product.json の `shukoConfigurationDefaults` を既定として登録する。リーダーが採った）
- docs/user-decisions.md（通信の扱いの訂正、0-5 の後）、`records/phase0/network-inventory.md` の5節
- 作業ツリー: `C:\b\wt\1.146.0`（読むだけ）。パッチを作る作業ツリーは `git -C C:/b/vscode worktree add C:/b/wt/dev-b 1.146.0` で別に作る

## やること

1. `product.overlay.json` を作る（docs/02 の3節の表のとおり。時期が単位に結びつくキーは、単位の `productRemove` に置くか overlay に置くかを表の「扱い」に従う）。`shukoConfigurationDefaults` の `extensions.allowed` は、台帳（`extensions.lock.json`）の8件の ID と `"*": false`。
2. `patches/` に、`shukoConfigurationDefaults` を既定として登録する小さなパッチを作る（案B-2。型の補いを含む）。番号つきの名前にする。
3. `removals/B-1-telemetry/` 〜 `removals/B-6-online-feeds/` を作る。各単位に `unit.json`（`enabled: false`、`order` は 200 台）、`README.md`、要れば `edits.patch`。
   - B-1 は「何もしない実装への差し替え」を含む（docs/03 の表）。
   - B-6 は `emergencyAlertUrl`・`profileTemplatesUrl` が 1.146.0 にあるか、どの部品が通信するかをソースで確かめる。WPAD の止め方も調べる。
   - 型検査とビルドはまだ走らせられない。参照の残りは `grep` で見つけ、型検査で確かめる点を README の「未確認」に書く。
4. ブランドの資産（`assets/`）: アイコンなどの置き換えが要る場所を本家のソースで洗い出し、仮のアイコン（自作の簡単なもの。他者の著作物を使わない）を置くか、置き場所と要るサイズの一覧を作る。どちらにしたかを書く。
5. 作った単位とパッチを、`dev-b` の作業ツリーで当てられるか確かめる（`apply.mjs` は別の蒙恬が並行して作っている。出来ていれば使い、無ければ手で確かめる）。

## 守ること

- 書き込みは `removals/B-*`、`patches/`、`product.overlay.json`、`assets/`、`tasks/`、`C:\b\wt\dev-b` だけ。ほかの蒙恬が並行して `scripts/apply.mjs`（p2-apply）、`removals/A-*`・`builtin/keep.json`（p2-units-a）、`scripts/build.mjs` など（p2-build-switch）を作る。それらを書かない。
- Claude Code が使う受け手（docs/03 の9節）を消さない。
- `C:\b\wt\1.146.0` を書き換えない。依存の導入とビルドは走らせない。

## 完了条件

- `product.overlay.json`、既定の設定のパッチ、B-1〜B-6 の単位、ブランドの資産（またはその一覧）があり、作業ツリーで当てた（または当て方を確かめた）記録がある。

## 成果物

このディレクトリに保存する。

- `units-b-notes.md`: 単位ごとの中身と根拠、未確認の点。
- `trial-log.md`、`doc-corrections.md`、`handoff-notes.md`（報告）。

## 結果

採用。B-1〜B-7、`product.overlay.json`、パッチ 20（application スコープの既定）・30（WPAD）、アイコンと `make-icons.mjs`。検証で合格。

## 未解決

- 型検査・ビルド・関門は道具の導入の後。

## 次の担当

ooka-echizen（大岡越前守）: 検証する。
