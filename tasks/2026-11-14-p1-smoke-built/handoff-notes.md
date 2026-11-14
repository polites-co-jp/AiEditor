# 引き渡しの覚え: Phase 1 の締め（A-1 を当てたビルドのスモーク）

- 担当: 大岡越前守、2026-11-14
- 記録: `records/phase1/smoke-built-1.146.0-p1-a1.md`
- 実行の置き場所: `C:\b\smoke\runs\p1-a1-20261114T121032\`（`.keep` を置いた）

## 判定: 不合格

Claude Code の組の自動の3項目（claude.running・claude.exthost-log・claude.lock）は PASS。しかし FAIL が5つあり、そのうち4つと新しい誤りの大半は、A-1 にも「Code - OSS・上書き無し」にも当たらない。原因はビルドの手順にある。ターミナルが開かないので、docs/06 の5節の手の項目「統合ターミナルの `claude` が IDE に接続する」も、このビルドでは通らない。

## 確かめた成果

- 蒙恬のビルド（`C:\b\wt\VSCode-win32-x64\`。zip `C:\b\dist\1.146.0-p1-a1-r2.zip` と同じ。zip の SHA-256 は一致）
- 曹参・蒙恬のスモークの台本（`tests/smoke-run.mjs`、`tests/smoke.test.mjs`）

## 根拠

1. `node --test tests/smoke.test.mjs` → 75/75 合格
2. `node tests/smoke-run.mjs --build C:/b/wt/VSCode-win32-x64 --label p1-a1 --mode built --prime --baseline C:/b/smoke/baseline-official-1.146.0.json --timeout 300` → **PASS 43 / FAIL 5 / SKIP 0 / INFO 9**、終了コード 1
   - FAIL: base.terminal、base.task、lang.ps1.session、base.ui-language、errors.new（9件）
3. 原因: 出力の product.json に `commit` が無い（スモークの見出しも `Code - OSS 1.146.0 / undefined`）
   - 本家の `build/lib/getVersion.ts` は、`BUILD_SOURCEVERSION` が無ければ `build/lib/git.ts` で `<root>\.git\HEAD` を読む。作業ツリー `C:\b\wt\p1-a1\` の `.git` はファイル（`gitdir: ...`）なので読めず、commit は undefined になる
   - `src/vs/amdX.ts` は `isBuilt = Boolean(product.commit)` で決める。false だと `node_modules.asar` ではなく、出力に無い `node_modules\` から読む。xterm が読めず、ターミナルが作れない。タスクと PowerShell のセッションもターミナルを使うので、一緒に落ちる。新しい誤りの「An unknown error occurred」×5 と exthost の `{"isTrusted":true}` は、この読み込みの失敗（DOM の Event での reject）。時刻はターミナルを作った時刻と重なる。prime のログにも、asar ではないパスの `tree-sitter.wasm` の ENOENT がある
   - `src/vs/base/node/nls.ts` は、`!commit` なら言語パックを使わない。そのため表示は英語（base.ui-language）
   - プロセスの木に OpenConsole.exe と pwsh.exe が無い（公式にはある）
4. 説明できる違い: トンネルの誤り×2（Code - OSS の product.json）、`copilot-runtime.exe` が無い（A-1）、公式の AgentHostCustomizationMarketplace の誤り×60 が出ない（A-1 と見られる）、prime の `No default agent contributed`（A-1）、`importStrategy` の既定が `useBundled`（mydist が効いた）
   - Claude Code の `Remote Control auto-enable failed` は推定で仕分けた。このビルドでは起動時に Claude のビューがセカンダリサイドバーに開き、claude.exe が起動した。mydist の `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` で Remote Control が始まらなかったと見られる（ログに `essential-traffic-only`、`bridge not enabled`）。ビューが開くのは A-1 の影響と見られる。どちらも確かめていない
5. Smart App Control の件: `@vscode/deviceid`・`native-keymap`・`native-is-elevated` を含む行は、どのログにも無い。エディタは最後まで動いた。ただ、オンのときも止められたことはログに出ず Code Integrity のイベントにだけ出ていたので、ログだけでは「消えた」とは言い切れない（下の「許可」を参照）

## 不合格の点（直す必要があるところ）

- **蒙恬のビルドの手順（`scripts/build.mjs`）**: 作業ツリーでビルドすると product.json に `commit` が入らない。gulp の手順（型検査・パッケージ化）に、40桁の commit を入れた `BUILD_SOURCEVERSION` を環境変数で渡すなどして、commit を入れる必要がある。入れる値（本家の commit `69047191fc…` か、作業ツリーの HEAD `72f45433…` か）は設計の判断なので、リーダーが決める。あわせて、出力の product.json に `commit` があることを後処理の確かめ（docs/02 の4節の7）に足すとよい
- 出力の配置（直下）は commit を入れても変わらない見込み。`build/lib/util.ts` の `getVersionedResourcesFolder` は、product.json に `win32VersionedUpdate` が無ければ空を返すため
- 直したビルドで、このスモークを走らせ直す。その後、手の項目（docs/06 の5節。パネルでの送信、統合ターミナルの `claude` の接続など）をユーザーが行う

## 許可について（走らせていないもの）

- Smart App Control をオフにした後の Code Integrity のイベントを見るには、`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-ci-events.ps1` が要る。ネイティブのモジュールが今回止められていないことを、イベントで確かめるため。検証役の許可には無いので、走らせていない

## 記録

- `e:\develop\self\Team\projects\ai-editor\records\phase1\smoke-built-1.146.0-p1-a1.md`
- `e:\develop\self\Team\projects\ai-editor\tasks\2026-11-14-p1-smoke-built\handoff-notes.md`（この覚え）
- `C:\b\smoke\runs\p1-a1-20261114T121032\smoke-result.md`・`smoke-result.json`・`probe-result.json`
