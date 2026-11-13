# docs/ との食い違いと、直す案（蒙恬 p2-units-b。直すのはリーダー）

## 1. docs/03 の4節 B-2: `contrib/onboarding` は消せない（残る部品が使う）

- 事実: 1.146.0 の `src/vs/workbench/contrib/onboarding` は、案内の枠組み（スポットライト・ツアー・お試しの窓）。残す部品が import している: `contrib/update/browser/releaseNotesEditor.ts`・`releaseNotesTryouts.ts`、`contrib/codeEditor/browser/diffEditorTryout.contribution.ts`、`contrib/sessionChanges/browser/changesView.ts`。ほかに chat・sessions（C-1 で消える側）の約70ファイル。
- 実装: B-2 では残し、`kept` に理由を書いた。
- 直す案: docs/03 の表の B-2 の「消すもの」から `contrib/onboarding（desktop の onboardingTryout を含む）` を外し、「注意」に「`contrib/onboarding` は残る部品（リリースノート・差分エディタのお試し）が使うので残す。C-1 の後に使い手が残らなければ消す」と書く。C-1 の行に候補として足す。

## 2. docs/03 の4節 B-6: 部品 `contrib/emergencyAlert` を消すことを足した

- 事実: `emergencyAlertUrl`・`profileTemplatesUrl` は 1.146.0 の OSS の product.json に無い。読む部品は値が無ければ通信しない。0-5 の `main.vscode-cdn.net` は Microsoft の配布の zip の product.json から来ていた。
- 実装: 2つのキーは `product.overlay.json` の `removeIfPresent` に置いた（単位の `productRemove` に置くと毎回「本家に無い」の警告になる）。部品 `contrib/emergencyAlert` は、裁定（2026-11-12）の「不要な外部通信は送信処理ごと外す」に合わせて消した。
- 直す案: 表の B-6 の「消すもの」を「`contrib/emergencyAlert`（緊急の知らせの取得）。product.json の `emergencyAlertUrl`・`profileTemplatesUrl` は 1.146.0 に無いので overlay の `removeIfPresent` で見張る」に直す。docs/02 の3節の表の `emergencyAlertUrl、profileTemplatesUrl` の行の扱いを「本家が足したら remove（B-6）」に直す。部品を消すことを採らないなら、`unit.json` の `delete` と `removeLines` を外す。

## 3. docs/02 の3節: overlay の3つめの項目 `removeIfPresent` と、足したキー

- 事実: docs/02 は「`set` と `remove` の2つを持つ」と書くが、「本家が足したら remove」の行を `remove` に置くと毎回警告が出る。apply.mjs の担当と合わせて3つめの項目 `removeIfPresent` を作った（`tasks/2026-11-13-p2-apply/apply-design.md` の2.2）。
- docs に無いキーを4つ `removeIfPresent` に足した: `appCenter`（クラッシュの報告の送り先。`src/mainImpl.ts` 515行）、`settingsSearchUrl`、`npsSurveyUrl`、`mcpGallery`。どれも 1.146.0 の OSS の product.json に無く、入ると外への通信が起きる。
- `tasConfig` は 1.146.0 の OSS の product.json に無かったので、B-2 ではなく `removeIfPresent` に置いた。
- 直す案: 3節の冒頭を「`set`・`remove`・`removeIfPresent`（本家が足したら外して警告）の3つ」に直し、表の「本家が足したら remove」の行に上の4つと `tasConfig`・`emergencyAlertUrl`・`profileTemplatesUrl` を足す。

## 4. docs/02 の3節: `builtInExtensions` の扱い

- リーダーの指示（2026-11-14）で overlay の `set` に `builtInExtensions: []` を入れた。表の「set（A-3）」のとおりだが、overlay は単位の有効・無効によらず当たる。表の「扱い」を「set（overlay。A-3 の有効・無効によらない）」に直す案。

## 5. docs/03 の4節: 新しい単位 B-7-terminal-suggest

- リーダーの指示（2026-11-14）で作った。表の段階 B に行を足す案: 「B-7-terminal-suggest | `contrib/terminalContrib/suggest`、設定 `terminal.integrated.suggest.*`。拡張 API の補完の提供者の登録は何もしない実装にする | 組み込み拡張 `terminal-suggest` は A-7 が消す」。

## 6. docs/04 の6.1: mydist の既定に1件足した

- `terminal.integrated.suggest.enabled: false`（window スコープ。ソースで確かめた: `terminalSuggestConfiguration.ts` 84行はスコープを書かず、`terminalConfiguration.ts` の登録の節にもスコープが無いので、既定の window になる）。外す時期は「B-7 の後」。表に行を足す案。
- 同じ表の `workbench.startupEditor: none`（「B-2 の後に要否を見る」）は、B-2 で設定そのものが登録されなくなる。B-2 を有効にしたら外してよい。

## 7. docs/03 の3.1: `kept` と `delete` の関係

- apply.mjs は `delete` のフォルダを丸ごと消す。フォルダの中の1ファイルを残すときは、`delete` にファイルやサブフォルダを並べるしかない（B-1 の `editTelemetry`、B-3 の `issue`、B-4 の `outline`）。docs/03 の3.1 の例（`delete` に `contrib/debug`、`kept` に `contrib/debug/common/debug.ts`）は、この実装では `debug.ts` も消える。例を直す案。

## 9. リーダーの判断（2026-11-14）で足したもの

- docs/03 の4節の表: B-1 の「消すもの」に `contrib/terminalContrib/telemetry`、B-7 の行に `services/suggest`（候補の小さな窓。本体ではターミナルの入力候補だけが使う）を足す。
- docs/02 の2節: `patches/` の例に `30-proxy-direct-without-settings.patch`（`http.proxy` も環境変数も無いときに direct にして WPAD を止める）、`scripts/` に `make-icons.mjs`（仮のアイコンの PNG・ICO を書き出す）を足す。
- `records/phase0/network-inventory.md` の5節の「未確認: WPAD の止め方」を「`patches/30` で止める。自作のビルドの監査で確かめる」に直す。
- docs/03 の7節（関門）か6節: B-2・B-7 を有効にするときは、mydist の既定から、その単位が消す設定（`workbench.startupEditor`、`terminal.integrated.suggest.enabled`）を外す必要がある（apply.mjs の `registeredKeys` が `unregistered` で fail にする）。手順に書くか、apply.mjs で単位の `absentSettings` を見て許すか（`handoff-notes.md` の追記の「未解決」の1）。

## 8. docs/03 の4節 B-1: 表に無い削除

- `src/vs/platform/telemetry/test/browser/1dsAppender.test.ts`（1DS の型を import）と `src/vs/workbench/test/browser/componentFixtures/aiStats.fixture.ts`（消した editStats を import）も消した。依存は `remote/package.json`・`remote/web/package.json` からも外した。表の「消すもの」に足す案。
