# Smart App Control に止められたものを、確認のうえで実行できるか

- 担当: 蒙恬（meng-tian）
- 調べた日: 2026-11-14（Web の出典の取得日はすべて 2026-11-14）
- やったこと: Web の出典を読み、この PC の状態を読むだけの台本で確かめた。PC の設定は変えていない。

## 結論

ユーザーの見立て「止められても、リスクを確認して実行できるはず」は、**Smart App Control には当てはまらない**。

- Microsoft の公式の FAQ に「アプリごとに Smart App Control を素通りさせる方法は、今のところ無い」とある。
- 「詳細情報 → 実行」で通せるのは SmartScreen のほうで、別の仕組みである。しかも Smart App Control がオンのあいだ、SmartScreen のこの確かめは止まっている。
- 今回のように DLL や `.node` の読み込みが止められたときに出るのは、知らせだけである（「詳細情報」へのリンクのみ）。実行を選ぶボタンは無い。
- 選べるのは、オフにする（今の Windows 11 では後でまたオンにできる）、信頼できる発行元の証明書で署名する、の2つ。オフにしたうえで、自分で書いた App Control for Business のポリシーに置き換える道もある。

## 1. アプリごとに許せるか。SmartScreen の「詳細情報 → 実行」との違い

**答え: 許せない。** 許可の一覧も、例外も、「実行する」の確認も無い。

| 事実 | 出典 |
|---|---|
| 「How can I tell Smart App Control to let this one specific app through?」への答えは「There is currently no way to bypass Smart App Control protection for individual apps.」。代わりの道として、オフにすることと、開発者に署名を頼むことを挙げる | Microsoft サポート「Smart App Control Frequently Asked Questions」 https://support.microsoft.com/en-us/topic/what-is-smart-app-control-285ea03d-fa88-4d56-882e-6698afdb7003 |
| 実行を許す条件は2つだけ。Microsoft のクラウドの評価で安全と見込めるもの、または Trusted Root Program の CA が出した証明書で署名されたもの。「Malware, Potentially Unwanted Apps (PUA), and unknown, unsigned code are blocked by default.」 | Microsoft Learn「Smart App Control」（ms.date 2026-09-30） https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/overview |
| 「Code can be signed with any certificate, but Smart App Control only considers certificates issued by trusted providers.」（自己署名の証明書は数に入らない） | Microsoft Learn「Sign your app for Smart App Control compliance」（ms.date 2026-09-25） https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control |
| SmartScreen は、署名の無いファイルに「Windows protected your PC」の警告を出す。利用者は「Run anyway」を選べば実行できる（企業のポリシーで止められることはある）。自己署名でも同じ扱い | Microsoft Learn「SmartScreen reputation for Windows app developers」（ms.date 2026-05-04） https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation |
| 同じページの注: 「On Windows 11 devices, the Smart App Control feature may supersede SmartScreen Application Reputation. ... Smart App Control signature checks apply to all executable files, not just those downloaded from the Internet.」 | 同上 |
| SmartScreen の評価は「More Info」→「Run anyway」で通り抜けられる。「When Windows 11's Smart App Control feature is enabled, SmartScreen AppRep is disabled as redundant.」 | Eric Lawrence「SmartScreen Application Reputation, with Pictures」（2023-08-23、2026-09-08 更新） https://textslashplain.com/2023/08/23/smartscreen-application-reputation-in-pictures |
| SmartScreen が確かめるのは入口のプログラムの評判だけ。Smart App Control はそれより深く、OS のローダーやスクリプトのエンジンが読み込むすべてのコード（DLL・スクリプトなど）の信頼と署名を確かめる。「Enabling SAC causes SmartScreen Application Reputation to be disabled.」。危ない種類のファイルを止めるダイアログについても「this dialog box does not offer an override」 | Eric Lawrence「Smart App Control」（2026-04-28） https://textslashplain.com/2026/04/28/smart-app-control/ |

違いのまとめ:

| | SmartScreen（アプリの評判） | Smart App Control |
|---|---|---|
| 確かめる対象 | ダウンロードの印が付いていて、シェルから開いた入口の実行ファイル | OS のローダーが読み込むすべてのコード（exe・DLL・`.node` など）。印の有無を問わない |
| 止めたとき | 警告の画面。「詳細情報 → 実行」で通せる | 止めるだけ。通す操作は無い |
| アプリごとの許可 | 警告ごとに「実行」を選べる | 無い（公式の FAQ） |
| Smart App Control がオンのとき | 止まっている（重なるため） | — |

補足（Eric Lawrence について）: Microsoft で SmartScreen や Edge にかかわってきた人の個人のブログである。公式の文書ではないが、上の Microsoft Learn の記述と食い違う点は無い。

## 2. ダウンロードの印（Mark of the Web）の有無で扱いが変わるか

**答え: 今回のような実行ファイルや DLL・`.node` の読み込みでは変わらない。** 印が無くても確かめられ、止められる。印で扱いが変わるのは、別の2つの場面である。

| 事実 | 出典 |
|---|---|
| 「Smart App Control signature checks apply to all executable files, not just those downloaded from the Internet.」 | Microsoft Learn「SmartScreen reputation for Windows app developers」（上と同じ） |
| Smart App Control は、OS のローダーとスクリプトのエンジンが読み込むすべてのコードの信頼と署名を確かめる。これとは別に、出どころの信頼できない特定の種類のファイルは、シェルから開くこと自体を止める | Eric Lawrence「Smart App Control」（上と同じ） |
| 危ない拡張子（.JS・.COM・.PS1 など）を止めるのは「when they're downloaded from the internet」のとき | Microsoft サポート「Smart App Control has blocked an app with a dangerous file extension」 https://support.microsoft.com/en-US/Windows/Security/Threat-Malware-Protection/smart-app-control-has-blocked-an-app-with-a-dangerous-file-extension |
| SmartScreen の評価が動くのは、印の付いたファイルを `ShellExecute()` で実行したとき | Eric Lawrence「SmartScreen Application Reputation, with Pictures」（上と同じ） |

印で扱いが変わる場面:

- Smart App Control が、危ない種類のファイルをシェルから開かせないとき。
- SmartScreen の評価（ただし Smart App Control がオンのあいだは止まっている）。

今回の当てはめ: `winregistry.node` は、この PC で node-gyp が作ったファイルである。印は付いていない見込みで、それでも止められた（イベント 3077）。上の「印の有無を問わない」と合う。

- 印が無いことは、まだ直接は確かめていない。代替データストリーム `Zone.Identifier` を読もうとしたが、フックが代替データストリームの読み込みを許していないので止めた（回避はしていない）。
- 「印を消せば通る」という道は、今回のファイルには効かない見込み（推定）。

## 3. オフにした後、またオンにできるか

**答え: 今の Windows 11 では、クリーンインストールをしなくても、またオンにできる。** 公式の文書にそう書いてある。ただし、条件が2つと、最近の不具合が1つある。

| 事実 | 出典 |
|---|---|
| 「You are able to disable Smart App Control in the Windows Security App settings. Recent Windows updates allow Smart App Control to be re‑enabled without requiring a clean installation.」 | Microsoft サポート FAQ（上と同じ） |
| 同じ FAQ に古い記述も残っている。「任意の診断データ」をオフにしているとオフになり、オンにするにはリセットか再インストールが要る | 同上 |
| 2025-11-07 の Insider Preview Build 26220.7070: 「you will now be able to switch SAC off or on without any clean install requirement」。場所は「Windows Security > App & Browser Control > Smart App Control settings」。「gradually being rolled out」の見出しの下に書かれていた | Windows Insider Blog https://blogs.windows.com/windows-insider/2025/11/07/announcing-windows-11-insider-preview-build-26220-7070-dev-beta-channels/ |
| 一般向けには 2026-03-26 の KB5079391（OS Builds 26200.8116 / 26100.8116、プレビュー）: 「You can turn Smart App Control (SAC) on or off without needing a clean install.」「... is now beginning to roll out.」 | https://support.microsoft.com/en-us/topic/march-26-2026-kb5079391-os-builds-26200-8116-and-26100-8116-preview-7c9e2275-b9ba-4068-aeb0-23da42b81d3b |
| 「Previously, Smart App Control could not be turned back on if you ever turned it off. That limitation has been removed in Windows 11 version 25H2」（Windows Security アプリの v1000.29554 以降） | Eric Lawrence「Smart App Control」（上と同じ） |
| **不具合**: 2026-10-13 の KB5127648（OS Builds 26300.9711・26200.9711・26100.9711。対象に 26H2 を含む）の既知の問題「You might be unable to turn on Smart App Control」。オフにしてあった PC では、オンにする操作が灰色になることがある。オンのままの PC は影響を受けない | https://support.microsoft.com/en-us/servicing/os/windows-11/2026/10/kb5127648-windows-11-24h2-25h2-26h2-security-update |
| 同じ既知の問題について「This issue was resolved for Windows 11, versions 26H2 and 25H2, by Windows updates released on and after October 28, 2026」（KB5127936）。24H2 は 2026-11-10 以降の更新（KB5132061）で直った | 同上 |
| 2026-10-28 の KB5127936（OS Builds 26300.9818・26200.9818、プレビューで任意の更新）が「This update fixes an issue where you might be unable to turn on Smart App Control in the Windows Security app」 | https://support.microsoft.com/en-us/servicing/os/windows-11/2026/10/kb5127936-windows-11-25h2-26h2-update |

この PC（10.0.26300 = 26H2）への当てはめ:

- 26H2 は、KB5127648 の既知の問題の対象に入っている。「オフの後にオンにする」操作が 26H2 にあることは、この既知の問題の書き方から読み取れる。
- 戻せるかどうかは、この PC の更新の番号（`26300.<UBR>`）で決まる。2026-10-28 以降の更新（26300.9818 以上の見込み）が入っていれば、灰色になる不具合は直っている。
- `check-env.ps1` は `10.0.26300.0` までしか出さず、UBR は分からなかった。オフにする前に、`winver` か「設定 → システム → バージョン情報」で、ユーザーに `26300.9818` 以上かを見てもらうのがよい。
- 一般向けの機能は「段階的に配る」と書かれている（KB5079391）。この PC でトグルが出ているかは、ユーザーが Windows セキュリティの画面で見るまで分からない。
- 任意の診断データがオフだと、Smart App Control 自体が使えない（FAQ の古い記述。今も当てはまるかは確かめていない）。
- また、オンに戻したとき、いきなり強制（オン）になるのか、評価のモードからやり直すのかは、出典に書かれていない（未確認）。

## 4. 3077 で止められたとき、確認の画面は出るか

**答え: 確認の画面（実行するかを選ぶ画面）は出ない。** 読み込みは失敗する。出るのは「Smart App Control がこのアプリの一部をブロックしました」の知らせで、ボタンは「詳細情報」だけである。アプリが動き続けるかどうかは、アプリ次第である。

| 事実 | 出典 |
|---|---|
| アプリ・サービス・ハードウェアの部品が、正しく署名されていないドライバー・アプリ・その他のファイルを読み込もうとしたときに、「Smart App Control has blocked part of this app」の知らせを出す。アプリの残りは動き続けることがあるが、止められたファイルに頼る機能は動かない。知らせには「Learn more」があり、FAQ へ案内する。知らせが消えたら、Windows セキュリティ →「ウイルスと脅威の防止」→「保護の履歴」で、どのファイルが止められたかを見られる。止められた部分を許す手順は書かれていない | Microsoft サポート「Smart App Control has blocked part of this app」 https://support.microsoft.com/en-us/topic/smart-app-control-has-blocked-part-of-this-app-0729fff1-48bf-4b25-aa97-632fe55ccca2 |
| 「If an application tries to load an unknown unsigned DLL (e.g. a plugin)」のとき、利用者には「Part of this app has been blocked」の知らせが出る | Eric Lawrence「Smart App Control」（上と同じ） |
| 3077 は「the main App Control block event for enforced policies. It indicates that the file didn't pass your policy and was blocked.」。3033 は「should occur alongside a 3077 event if caused by App Control policy」。どちらも、利用者に問う流れは書かれていない | Microsoft Learn「Understanding App Control event IDs」 https://learn.microsoft.com/en-us/windows/security/application-security/application-control/app-control-for-business/operations/event-id-explanations |

今回の当てはめ:

- `Code - OSS.exe` の main プロセスが `winregistry.node` を読み込もうとした。OS は読み込みを断り、Electron 側には「An Application Control policy has blocked this file.」の誤りが返った。エディタは 10 秒以内に終了コード 1 で終わった（`tasks/2026-11-13-p1-build-upstream/build-log.md` の 5.7）。
- 読み込みの関数が失敗で返るだけで、OS が待って利用者に問う流れは無い。止める判定は、読み込みの時点で終わっている。
- 19:32 に知らせが出たかどうかは記録に無い。ユーザーに「保護の履歴」を見てもらえば分かる。ただし、この PC の主のウイルス対策は ESET の見込み（推定）で、その場合に履歴がどう出るかは確かめていない。

## 5. この PC で読むだけで確かめたこと（2026-11-14 19:55〜19:58 JST）

設定は変えていない。台本は読むだけのもの。

- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1 -OutFile tasks/2026-11-14-sac-override-research/env-check.json`
  - `os.version`: `10.0.26300.0`（Windows 11 Pro。UBR は出ない）。
  - `smartAppControl`: `verifiedAndReputablePolicyState` 1、`meaning` `on`。今もオン（強制）である。
  - この値の意味（0 オフ、1 強制、2 評価）は Microsoft Learn「Application Control for Windows」（ms.date 2026-08-18）の表のとおり。 https://learn.microsoft.com/en-us/windows/security/application-security/application-control/app-control-for-business/appcontrol
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p1-ci-events.ps1 -Minutes 20160 -Max 500 -Filter "0283ac0f" -OutFile tasks/2026-11-14-sac-override-research/ci-events-sac-14d.json`
  - Smart App Control のポリシー（Policy ID `{0283ac0f-fff1-49ae-ada1-8a933130cad6}`、名前 `VerifiedAndReputableDesktop`）による阻止を、ログに残る範囲で過去 14 日ぶん並べた。結果は 3077 が4件だけ。
  - 1件は既知のもの。19:32:34 に `Code - OSS.exe` が `winregistry.node` を読み込もうとした。
  - **新しく分かったこと**: 残りの3件は、ビルドの最中のもの。19:10:53・19:13:07・19:25:10 に、`C:\Program Files\nodejs\node.exe` が `C:\b\wt\1.146.0\node_modules\bufferutil\build\Release\bufferutil.node` を読み込もうとして止められた。時刻は、1回目と2回目の依存の導入（build-log の 5.3・5.6）の中に当たる。それでも導入は終了コード 0 で通った。`bufferutil` は無くても動く作りだからと見られる（推定）。
  - つまり、出力を起動するときだけでなく、ビルドの途中やテストで node.exe が自分で作った `.node` を読み込む場面でも、同じく止められる。
- `p1-ci-events.ps1 -Minutes 20160 -Max 200`（絞り込み無し。`ci-events-14d.json`）
  - 上限の 200 件がすべて 2026-11-14 の分で埋まった。大半は 3033 で、`C:\Program Files\ESET\ESET Security\ekrn.exe` や `svchost.exe` が `Program Files` の下のファイルを読み込もうとしたもの。
  - 3033 は Smart App Control が無くても出ることがある（上の Learn の表）。3077 が伴っていないので、今回の件とは関係が無い（推定）。ESET が入っていることは、ここから分かった。
- まだ分からないこと: `Code - OSS.exe` そのもの（手元のビルドの実行ファイル）は止められず、起動した。3077 は出ていない。なぜ通ったか（Electron の配布物の署名が残っているのか、評判で通ったのか）は確かめていない。署名を読むコマンドは、今の許可に無い。

## 6. ユーザーへの選択肢の案

前提: 「止められたものを確認して実行する」道は無い（1・4）。そのうえで考えられる道は次の4つ（並びは蒙恬の見立ての順。最後の決定はユーザー）。

| 案 | 中身 | よい点 | 気になる点 |
|---|---|---|---|
| A. Smart App Control をオフにする | Windows セキュリティ → アプリとブラウザーの制御 → スマート アプリ コントロールの設定で「オフ」 | 手間が無い。自分のビルドがそのまま動く見込み。今の Windows 11 では、後でまたオンにできる（3） | PC 全体で、評判の無い未署名のコードが止められなくなる。ウイルス対策（ESET の見込み）は残る。オンに戻す前に、UBR が 26300.9818 以上かを確かめる（KB5127648 の不具合） |
| B. オンのまま、信頼できる発行元の証明書で署名する | 出力のネイティブのファイル（`*.exe`・`*.dll`・`*.node`）すべてに、Trusted Root Program の CA の証明書で署名する。Microsoft は Artifact Signing を勧める | PC の守りは今のまま | 費用がかかる（SmartScreen の Learn のページでは Artifact Signing は月 9.99 ドルから）。発行元の本人確認が要る。個人で日本から使えるかは確かめていない。毎週の取り込みのたびに署名の手順が要る。ビルドの途中に読み込まれる `.node`（`bufferutil.node` など）は、署名の前に読み込まれるので止められたまま（推定） |
| C. オフにして、App Control for Business の自前のポリシーに置き換える | Smart App Control のポリシー（`%windir%\schemas\CodeIntegrity\ExamplePolicies\SmartAppControl.xml`）を元に、自分の証明書（自己署名でもよい。社内の PKI で署名したコードを独自の規則で許す例が Learn にある）を許す規則を足して入れる。Windows 11 Pro で使える | Smart App Control に近い守りを保ったまま、自分のビルドだけを許せる | 設計と保守の手間が大きい。署名していないポリシーは、管理者の権限があれば外せる。`C:\b\` のように利用者が書ける場所を、場所の規則で許すのは危ない（Learn の「FilePath rules」の注意）。評判で許す ISG の設定は、別の注意事項がある |
| D. Smart App Control がオフの別の PC か仮想マシンでビルドし、起動を確かめる | この PC はそのまま | この PC の守りは変わらない | 「この PC で普段使いする」という目的に合わない。確かめの場にしかならない |

C の出典:

- Microsoft Learn「Application Control for Windows」（上と同じ）: 「since we built it entirely upon App Control for Business, you can create a policy with the same security and compatibility as Smart App Control that also trusts the line-of-business (LOB) apps your organization needs.」。Windows Pro で使える、という表もある。
- Microsoft Learn「Use the Smart App Control policy to build your starter base policy」（ms.date 2025-03-09） https://learn.microsoft.com/en-us/windows/security/application-security/application-control/app-control-for-business/design/create-appcontrol-policy-for-lightly-managed-devices

蒙恬の見立て:

- 利用者は1人で、毎週取り込んでビルドし直す。この使い方に、手間と効き目が合うのは A である。
- PC の守りを落としたくないなら C。ただし、ポリシーの設計は今回の範囲（ビルドのリポジトリ）の外の仕事になる。
- B は、毎週の署名とビルドの途中の阻止が残るので、勧めない。
