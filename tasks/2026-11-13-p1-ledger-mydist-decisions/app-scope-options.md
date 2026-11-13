# application スコープの6件の既定を変える2つの案（事実と推奨）

- 書いた人: 蒙恬（2026-11-13）。リーダーの依頼の4。案は決めず、事実と推奨だけを書く。
- 対象の6件（docs/04 の6.1）: `extensions.allowed`、`telemetry.telemetryLevel: off`、`update.mode: none`、`workbench.enableExperiments: false`、`extensions.autoUpdate: "off"`、`extensions.autoCheckUpdates: false`
- 出典は、本家 1.146.0 の作業ツリー `C:\b\wt\1.146.0`（タグの commit `69047191fc427f2f92828279aae1d90d8eeda7ab`）。読んだだけで、ビルドも依存の導入もしていない。`git -C C:/b/wt/1.146.0 status` で変更が無いことを確かめた。行番号はすべて 1.146.0 のもの。

## 1. 先に分かったこと

### 1.1 product.json には、設定の既定を入れる仕組みが無い（デスクトップ版）

- product.json の型 `IProductConfiguration`（`src/vs/base/common/product.ts`）に、設定の既定を持つキーは無い。`configurationDefaults` という名前で検索しても、product.ts には出てこない。
- 設定の既定を外から渡す口は1つだけある。web 版の起動の引数 `IWorkbenchConstructionOptions.configurationDefaults`（`src/vs/workbench/browser/web.api.ts` 315行）で、`src/vs/workbench/services/configuration/browser/configuration.ts` 48〜50行が `environmentService.options?.configurationDefaults` を読む。デスクトップ版の環境のサービス（`src/vs/workbench/services/environment/electron-browser/environmentService.ts`）は `options` を持たないので、デスクトップ版では使えない。
- product.json の `extensionConfigurationPolicy`（product.ts 297行）は、**拡張が登録する設定**にポリシーを付ける口（`src/vs/workbench/api/common/configurationExtensionPoint.ts` 296〜325行）。本体の設定（6件はすべて本体の設定）には効かない。既定を変えるものでもない。

### 1.2 ただし product.json のキーが無いと、6件のうち5件は設定の値によらず働かない

1.146.0 の OSS の `product.json` には `enableTelemetry`・`aiConfig`・`updateUrl`・`tasConfig`・`extensionsGallery` のどれも無い（作業ツリーの `product.json` を検索して確かめた。docs/02 の3節の記述とも合う）。そのため次の5件は、設定の既定が本家のままでも働かない。

| 設定 | 働かない理由（ソース） | 働く条件 |
|---|---|---|
| `telemetry.telemetryLevel` | `supportsTelemetry`（`src/vs/platform/telemetry/common/telemetryUtils.ts` 96〜102行）は、ビルドした製品（`isBuilt` は `VSCODE_DEV` が無いとき真。`src/vs/platform/environment/common/environmentService.ts` 231行）では `productService.enableTelemetry` が無いと false。false のとき、画面側の送り手は `NullTelemetryService`（`src/vs/workbench/services/telemetry/electron-browser/telemetryService.ts` 47〜73行）。拡張に渡す水準も NONE になる（`src/vs/workbench/api/browser/mainThreadTelemetry.ts` 45〜50行。`vscode.env.isTelemetryEnabled` が false） | product.json に `enableTelemetry` が入ったとき |
| `update.mode` | 本体の更新のサービスは、`productService.updateUrl` か `commit` が無いと、起動時に「永久に無効」にする（`src/vs/platform/update/electron-main/abstractUpdateService.ts` 206〜210行）。`update.mode` を読むのはこの後（238行） | product.json に `updateUrl` が入ったとき |
| `workbench.enableExperiments` | 実験を有効にする条件 `experimentsEnabled`（`src/vs/workbench/services/telemetry/common/workbenchTelemetryUtils.ts` 16〜27行）は、`!!productService.tasConfig` と、テレメトリの水準が USAGE であることを含む。どちらも満たさない | product.json に `tasConfig` が入り、テレメトリが動いたとき |
| `extensions.autoUpdate`・`extensions.autoCheckUpdates` | 拡張のギャラリーは、`extensionsGallery.serviceUrl` が無いと使えない（`src/vs/platform/extensionManagement/common/extensionGalleryManifestService.ts` 32行。`isEnabled()` は `extensionGalleryService.ts` 696〜698行）。拡張の照会や取得は、`isEnabled()` が偽だと何もしない（`src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts` 1007・1544・1571・2132行） | product.json に `extensionsGallery` が入ったとき |

設定の画面には本家の既定（`on` など）がそのまま出る。見た目だけの問題で、通信は起きない。

### 1.3 `extensions.allowed` は product.json では代わりがきかない

`extensions.allowed` は、拡張を入れるときと有効にするときの判定に使われる。

- `AllowedExtensionsService`（`src/vs/platform/extensionManagement/common/allowedExtensionsService.ts` 55〜65行）が `configurationService.getValue('extensions.allowed')` を読む。
- VSIX を入れるときの判定（`src/vs/platform/extensionManagement/node/extensionManagementService.ts` 157行。CLI の `--install-extension` も通る）と、ユーザーの拡張を有効にするときの判定（`src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts` 475行。`ExtensionType.User` だけが対象で、組み込み拡張は対象外）に使う。

product.json の `extensionPublisherOrgs`（同ファイル 45行）は発行元の照合に使うもので、許可の一覧の代わりにはならない。この1件は、設定の既定を変える以外に方法が無い（下の4の「参考」のポリシーを除く）。

### 1.4 拡張の既定の検査を緩めるパッチは、解決にならない

`configurationExtensionPoint.ts` 217行の `allowedScopes` に application を足せば、mydist に書いた既定が画面側では効く。しかし次の理由で、6件の答えにならない。

- 拡張の `configurationDefaults` を処理するのは画面側（renderer）の拡張の受け口だけ。main のプロセス、共有のプロセス、CLI のプロセスは、拡張の受け口を処理しない。
- `update.mode` は main のプロセスが読む（`abstractUpdateService.ts` 238行）。`extensions.allowed` の VSIX の判定は、共有のプロセスか CLI のプロセスが行う（`node/extensionManagementService.ts` 157行）。
- これらのプロセスには mydist の既定が届かない（推定。拡張の受け口が `src/vs/workbench/api/` にあることからの推定で、走らせては確かめていない）。

## 2. 案A: product.json の上書き（`product.overlay.json`）

### 2.1 できること

- 設定の既定は入れられない（1.1）。
- できるのは、機能が使うキーを入れないこと（`remove`）。5件（1.2）はこれで働かなくなる。1.146.0 の OSS の product.json にはもともと無いので、今は何もしなくてよい。
- `extensions.allowed` はできない（1.3）。

### 2.2 毎週の取り込みでの壊れやすさ

- **壊れにくい。** パッチが無いので、本家のコードの変更で当たらなくなることが無い。
- **危ういのは本家が OSS の product.json に、`enableTelemetry`・`aiConfig`・`updateUrl`・`tasConfig`・`extensionsGallery` のどれかを足したとき。** 足されると、該当する機能が黙って動き出す。
  - 防ぎ方: `apply.mjs` で、これらのキーが本家の product.json にあれば `remove` するか止める。docs/02 の3節の表には今 `tasConfig` だけが「あれば remove」として載っている。残りの4つ（`enableTelemetry`・`aiConfig`・`updateUrl`・`extensionsGallery`）を同じ扱いで足す案がある。docs/02 の3節の71行は「これらは足さない」と書くだけで、本家が足したときの扱いは書いていない。
- **5件の働きを本体から消す削除の単位が入れば、この依存は薄くなる。** B-1（テレメトリ）、B-2（実験）、C-5（拡張のギャラリー）がそれ。

## 3. 案B: 小さなパッチ

### B-1: 設定ごとに既定の値を書き換える（6か所）

| 設定 | ファイル | 行 | 今の値 → 変える値 |
|---|---|---|---|
| `extensions.allowed` | `src/vs/platform/extensionManagement/common/extensionManagement.ts` | 756 | `default: '*'` → 台帳の ID の object |
| `telemetry.telemetryLevel` | `src/vs/platform/telemetry/common/telemetryService.ts` | 347 | `'default': TelemetryConfiguration.ON` → `TelemetryConfiguration.OFF` |
| `update.mode` | `src/vs/platform/update/common/update.config.contribution.ts` | 22 | `default: 'default'` → `'none'` |
| `workbench.enableExperiments` | `src/vs/workbench/services/assignment/common/assignmentService.ts` | 656 | `'default': true` → `false` |
| `extensions.autoUpdate` | `src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts` | 146 | `default: 'on'` → `'off'` |
| `extensions.autoCheckUpdates` | 同上 | 192 | `default: true` → `false` |

- 登録の場所で値を変えるので、その設定を登録するすべてのプロセス（main・共有・CLI・画面）で既定が変わる。
- `extensions.allowed` は台帳の ID をソースに書くことになる。台帳に拡張を足す・外すたびにパッチを書き直し、本体を作り直す必要がある（版は書かないので、版を上げるだけなら要らない）。
- ポリシーの一覧（`build/lib/policies/policyData.jsonc`）はあらかじめ作られたファイルで、既定の値の変更では変わらない（検索で確かめた）。

### B-2: product.json のキーを既定として登録する、汎用の小さなパッチ（1か所）

- `src/vs/platform/configuration/common/configurationRegistry.ts` の 1179〜1180行の直後（`const configurationRegistry = new ConfigurationRegistry(); Registry.add(Extensions.Configuration, configurationRegistry);`）に数行を足す。product.json の独自のキー（仮に `shukoConfigurationDefaults`）があれば、それを `configurationRegistry.registerDefaultConfigurations([{ overrides: … }])` で登録する。
  - このファイルは既に product を読み込んでいる（17行の `import product from '../../product/common/product.js'`。1253行で使っている）。新しい import は要らない。
- 値は `product.overlay.json` の `set` に書く。6件すべて（`extensions.allowed` の object を含む）をここに置ける。
- 既定の登録で `source` を付けなければ、`disallowConfigurationDefault` の印も越えて効く（`configurationRegistry.ts` 1114〜1123行）。スコープの検査は拡張の受け口にしか無い（1.4）ので、application スコープでも効く。
- 同じ仕組みの前例が本家にある。Agents の画面の既定を `registerDefaultConfigurations` で入れている（`src/vs/sessions/contrib/configuration/browser/configuration.contribution.ts` 39〜47行）。ただしそのファイルの注は、この方法を「最後の手段」と書いている。
- product の中身は、main・共有・CLI のプロセスでは `globalThis._VSCODE_PRODUCT_JSON` から、画面側では preload の設定から読まれる（`src/vs/platform/product/common/product.ts` 27〜68行）。どのプロセスでも同じキーが見える見込み（走らせては確かめていない）。
- 台帳の ID が変わったら `product.overlay.json` の値を変える。パッチそのものは変わらない。値が台帳と合っているかは、単体テストで照合できる（曹参の担当）。
- `IProductConfiguration` の型にキーが無いので、パッチの中で型の補い（キャストか、`src/vs/base/common/product.ts` への1行）が要る。後者にするとパッチは2ファイルになる。

### 毎週の取り込みでの壊れやすさ

| 案 | 当たらなくなる恐れ | 理由 |
|---|---|---|
| B-1 | 中 | 6か所が5ファイルに散る。どれも設定の登録の塊の中で、説明の文（`localize`）やポリシーの項目が書き換わると文脈が変わる。`extensions.allowed` は 1.96 から、`extensions.autoUpdate` は 1.125 でポリシーが付いた（`minimumVersion`）ように、この周りは時々変わる。`git am -3` の3方向の合わせで多くは通る見込み |
| B-2 | 低 | 1か所だけで、足す場所の目印（`new ConfigurationRegistry()` と `Registry.add(...)` の2行）は、設定の登録の仕組みの根幹で動きにくい。設定のキーの名前は product.json の側にあるので、本家が設定の名前を変えたときはパッチは当たったまま、既定だけが効かなくなる。気づくには、スモークで既定値を見る項目が要る |

## 4. 推奨（決めるのはリーダー）

1. **5件（`telemetry.telemetryLevel`・`update.mode`・`workbench.enableExperiments`・`extensions.autoUpdate`・`extensions.autoCheckUpdates`）は、案A を主にする。** product.json にキーを入れないことで、すでに働いていない。`apply.mjs` で、本家が `enableTelemetry`・`aiConfig`・`updateUrl`・`tasConfig`・`extensionsGallery` を足したら remove するか止める（docs/02 の3節の表に4つを足す）。
2. **`extensions.allowed` は案B-2 にする。** product.json では代わりがきかず（1.3）、B-1 は台帳が変わるたびにパッチを書き直すことになる。B-2 なら、パッチは1か所で動かず、値は `product.overlay.json` に置ける。
3. B-2 を入れるなら、上の5件の既定も同じキーに入れることを勧める。設定の画面の表示が実際と合い、将来どれかのキーが product.json に戻ったときの守りにもなる。費用は `product.overlay.json` の数行だけ。

## 参考: ポリシー（2つの案の外。決める材料として）

- 6件のうち4件はポリシーを持つ。`extensions.allowed`（`AllowedExtensions`）、`telemetry.telemetryLevel`（`TelemetryLevel`）、`extensions.autoUpdate`（`ExtensionsAutoUpdate`）、`update.mode`（`UpdateMode`。`update.config.contribution.ts` 32〜33行）。
- Windows では、main のプロセスが `product.win32RegValueName` の名前でレジストリのポリシーを読む（`src/vs/code/electron-main/main.ts` 220〜225行の `NativePolicyService`）。
- ポリシーは既定ではなく値の固定になる。ユーザーは設定で変えられなくなる。
- 読むレジストリの場所（HKLM か HKCU か）は、ネイティブのモジュール `@vscode/policy-watcher` の中で決まり、確かめていない。
- ビルドの外（PC のレジストリ）に状態を置くことになるので、勧めない。
