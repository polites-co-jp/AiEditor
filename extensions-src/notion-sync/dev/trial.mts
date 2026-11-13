// 試し: 差し替えた Notion（fake-notion.mts）と、メモリの手元2台（PC-A・PC-B）で、
// 取り込み・書き出し・競合・手での直し・rev の追い越し・429・分割・上限・消したファイル・つながらないときを流す。
// build.mjs --trial から呼ぶ。本物の Notion には接続しない。

import { FakeNotion, fakeResponse } from "./fake-notion.mts";
import { createNotionClient, NotionApiError } from "../src/notion-client.mts";
import { promises as fsp } from "node:fs";
import * as path from "node:path";
import { fileBaseStore, memoryBaseStore, memoryFileStore, userDirFileStore, userDirFromGlobalStorage, type BaseStore, type FileStore } from "../src/stores.mts";
import { runSync, readDiffs, type SyncDeps, type SyncResult } from "../src/sync.mts";
import { splitText, toRichText, hashText } from "../src/text.mts";
import { stripIgnored, mergeIgnored } from "../src/settings-filter.mts";
import { decide } from "../src/decide.mts";

const TOKEN = "ntn_TRIAL_TOKEN_DO_NOT_LOG_0123456789abcdef";
const PAGE = "0123abcd-0123-4abc-8def-0123456789ab";
const IGNORED = ["terminal.integrated.defaultProfile.windows"];

let failures = 0;
function check(label: string, cond: boolean, detail = ""): void {
  console.log(`  ${cond ? "OK  " : "NG  "} ${label}${detail ? `  (${detail})` : ""}`);
  if (!cond) failures++;
}

function summary(r: SyncResult): string {
  const parts = [`status=${r.status}`, `rev=${r.rev}`];
  if (r.imported.length) parts.push(`imported=[${r.imported}]`);
  if (r.exported.length) parts.push(`exported=[${r.exported}]`);
  if (r.deletedLocal.length) parts.push(`deletedLocal=[${r.deletedLocal}]`);
  if (r.deletedRemote.length) parts.push(`deletedRemote=[${r.deletedRemote}]`);
  if (r.conflicts.length) parts.push(`conflicts=[${r.conflicts.map((c) => c.name)}]`);
  if (r.pending.length) parts.push(`pending=[${r.pending.map((p) => `${p.name}:${p.decision}`)}]`);
  if (r.skipped.length) parts.push(`skipped=[${r.skipped.map((s) => s.name)}]`);
  if (r.warnings.length) parts.push(`warnings=${r.warnings.length}`);
  if (r.error) parts.push(`error=${r.error}`);
  return parts.join(" ");
}

export async function main(): Promise<boolean> {
  const fake = new FakeNotion({ token: TOKEN, pageId: PAGE, pageSize: 3 });
  const sleeps: number[] = [];
  let clock = Date.parse("2026-11-14T09:00:00Z");
  const api = createNotionClient({
    token: TOKEN,
    fetch: fake.fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
    minIntervalMs: 350,
  });
  const logs: string[] = [];
  const mk = (machine: string, store: FileStore, base: BaseStore): SyncDeps => ({
    api, store, baseStore: base, pageId: PAGE, ignoredSettings: IGNORED, machine,
    now: () => new Date(clock), defaultEol: "\r\n", log: (m) => logs.push(`[${machine}] ${m}`),
  });

  // ---- 純粋な部品の確かめ ----
  console.log("部品: 2000 文字の境目での分割");
  {
    const s = "a".repeat(1999) + "😀" + "b".repeat(10);
    const parts = splitText(s);
    check("サロゲートペアを切らない（1つ目は 1999 文字）", parts[0].length === 1999 && parts.join("") === s, parts.map((p) => p.length).join(","));
    const exact = "x".repeat(4000);
    check("ちょうど 4000 文字は 2 要素", splitText(exact).length === 2);
    check("4001 文字は 3 要素", splitText(exact + "y").length === 3);
    let threw = false;
    try {
      toRichText("z".repeat(200_001));
    } catch {
      threw = true;
    }
    check("200,001 文字は TooLargeError", threw);
    check("200,000 文字は 100 要素", toRichText("z".repeat(200_000)).length === 100);
  }
  console.log("部品: 競合の3通り");
  check("手元だけ変わった → export", decide("L2", "R1", { local: "L1", remote: "R1" }) === "export");
  check("Notion だけ変わった → import", decide("L1", "R2", { local: "L1", remote: "R1" }) === "import");
  check("両方変わった → conflict", decide("L2", "R2", { local: "L1", remote: "R1" }) === "conflict");
  check("両方同じ中身に変わった → converged", decide("X", "X", { local: "L1", remote: "R1" }) === "converged");
  console.log("部品: ignoredSettings の保ち方");
  {
    const local = '{\n\t// 手元のコメント\n\t"editor.fontSize": 14,\n\t"terminal.integrated.defaultProfile.windows": "PowerShell",\n\t"files.eol": "\\n"\n}';
    const shared = stripIgnored(local, IGNORED);
    check("書き出す形からキーが消え、コメントは残る", !shared.includes("defaultProfile") && shared.includes("// 手元のコメント"), JSON.stringify(shared));
    const remote = '{\n\t"editor.fontSize": 16,\n\t"terminal.integrated.defaultProfile.windows": "Git Bash"\n}';
    const merged = mergeIgnored(remote, local, IGNORED);
    check("取り込む形は Notion の値＋手元の PC ごとの値", merged.includes('"editor.fontSize": 16') && merged.includes('"PowerShell"') && !merged.includes("Git Bash"), JSON.stringify(merged));
    const mergedNoLocal = mergeIgnored(remote, '{\n\t"a": 1\n}', IGNORED);
    check("手元に無い PC ごとのキーは Notion からも入れない", !mergedNoLocal.includes("defaultProfile"), JSON.stringify(mergedNoLocal));
  }

  // ---- 流れ ----
  const aStore = memoryFileStore({
    "settings.json":
      '{\r\n\t// PC-A の設定\r\n\t"editor.fontSize": 14,\r\n\t"terminal.integrated.defaultProfile.windows": "PowerShell",\r\n\t"long.value": "' +
      "あ".repeat(4500) + '"\r\n}\r\n',
    "keybindings.json": '[\r\n\t{ "key": "ctrl+k ctrl+t", "command": "workbench.action.selectTheme" }\r\n]\r\n',
    "snippets/python.json": '{\n\t"main": { "prefix": "main", "body": ["if __name__ == \\"__main__\\":"] }\n}\n',
  });
  const aBase = memoryBaseStore();
  const A = mk("PC-A", aStore, aBase);
  const bStore = memoryFileStore({
    "settings.json": '{\r\n\t"terminal.integrated.defaultProfile.windows": "Git Bash"\r\n}\r\n',
  });
  const bBase = memoryBaseStore();
  const B = mk("PC-B", bStore, bBase);

  console.log("流れ1: PC-A が空のページへ初めて書き出す");
  let r = await runSync(A, { mode: "both" });
  console.log(`  ${summary(r)}`);
  check("3 ファイルを書き出し、rev 1", r.status === "synced" && r.exported.length === 3 && r.rev === 1);
  const snap1 = fake.snapshot();
  check("ページの先頭が manifest の見出しとコード", snap1[0].type === "heading_2" && snap1[0].text === "manifest" && snap1[1].type === "code");
  const settingsCode = snap1[snap1.findIndex((b) => b.text === "settings.json") + 1].text;
  check("Notion の settings.json に PC ごとのキーが無い", !settingsCode.includes("defaultProfile"));
  const settingsBlock = [...fake.blocks.values()].find((b) => b.type === "code" && JSON.stringify(b).includes("long.value"));
  const items = (settingsBlock?.code as { rich_text: unknown[] }).rich_text.length;
  check("4500 文字超の settings.json は rich_text 3 要素に分かれる", items === 3, `${items} 要素`);

  console.log("流れ2: PC-B が初めて同期（手元に別の settings.json）→ 競合");
  r = await runSync(B, { mode: "both" });
  console.log(`  ${summary(r)}`);
  check("settings.json は競合、keybindings と snippets は取り込み", r.status === "conflict" && r.conflicts[0]?.name === "settings.json" && r.imported.length === 2);
  check("競合の Notion の側は B の PC ごとの値を足した形", (r.conflicts[0]?.remoteAsLocal ?? "").includes("Git Bash"));
  check("ページ送り（1回 3 ブロック）をたどって 8 ブロックを読んだ", fake.calls.some((c) => c.path.includes("start_cursor=")) && fake.snapshot().length === 8);
  console.log("流れ2b: PC-B が「Notion を採る」");
  r = await runSync(B, { mode: "both", force: { "settings.json": "remote" } });
  console.log(`  ${summary(r)}`);
  const bSettings = (await bStore.read("settings.json")) ?? "";
  check("取り込んだ settings.json に A の値と B の PC ごとの値", r.status === "synced" && bSettings.includes('"editor.fontSize": 14') && bSettings.includes("Git Bash") && !bSettings.includes("PowerShell"));
  check("B の改行は CRLF のまま", bSettings.includes("\r\n"));

  console.log("流れ3: PC-B が keybindings を直して保存（export）");
  await bStore.write("keybindings.json", '[\r\n\t{ "key": "ctrl+alt+t", "command": "workbench.action.terminal.new" }\r\n]\r\n');
  r = await runSync(B, { mode: "export" });
  console.log(`  ${summary(r)}`);
  check("keybindings を書き出し、rev 2", r.exported.join() === "keybindings.json" && r.rev === 2);
  r = await runSync(B, { mode: "export" });
  check("変わりが無ければ Notion を呼ばない", r.contacted === false && r.status === "synced");

  console.log("流れ4: PC-A が起動（both）→ Notion だけ変わった keybindings を取り込む");
  r = await runSync(A, { mode: "both" });
  console.log(`  ${summary(r)}`);
  check("keybindings を取り込む", r.imported.join() === "keybindings.json" && r.status === "synced");
  check("A の keybindings が B のものになった", ((await aStore.read("keybindings.json")) ?? "").includes("ctrl+alt+t"));

  console.log("流れ5: 両方が settings.json を別々に直す → 後から同期した側が競合");
  await bStore.write("settings.json", ((await bStore.read("settings.json")) as string).replace('"editor.fontSize": 14', '"editor.fontSize": 18'));
  await aStore.write("settings.json", ((await aStore.read("settings.json")) as string).replace('"editor.fontSize": 14', '"editor.fontSize": 12'));
  r = await runSync(B, { mode: "export" });
  console.log(`  B: ${summary(r)}`);
  r = await runSync(A, { mode: "export" });
  console.log(`  A: ${summary(r)}`);
  check("A は競合（自動でマージしない）", r.status === "conflict" && r.conflicts[0]?.name === "settings.json");
  check("A の手元は書き換えていない", ((await aStore.read("settings.json")) ?? "").includes('"editor.fontSize": 12'));
  console.log("流れ5b: PC-A が「手元を採る」");
  r = await runSync(A, { mode: "both", force: { "settings.json": "local" } });
  console.log(`  ${summary(r)}`);
  check("A の settings.json を書き出し", r.exported.join() === "settings.json" && r.status === "synced");
  r = await runSync(B, { mode: "both" });
  console.log(`  B: ${summary(r)}`);
  const bS2 = (await bStore.read("settings.json")) ?? "";
  check("B が A の値を取り込み、B の PC ごとの値は残る", bS2.includes('"editor.fontSize": 12') && bS2.includes("Git Bash"));

  console.log("流れ6: Notion で本文を手で直す（manifest はそのまま）");
  fake.handEdit("snippets/python.json", '{\n\t"main": { "prefix": "pymain", "body": ["pass"] }\n}');
  r = await runSync(A, { mode: "both" });
  console.log(`  ${summary(r)}`);
  check("Notion だけが変わったとして取り込み、警告を出す", r.imported.join() === "snippets/python.json" && r.warnings.some((w) => w.includes("manifest と合わない")));

  console.log("流れ7: 書き出す直前にほかの PC が書いた（rev の追い越し）");
  await aStore.write("tasks.json", '{\n\t"version": "2.0.0",\n\t"tasks": []\n}\n');
  let bumped = false;
  fake.beforeRequest = ({ method, path }) => {
    if (!bumped && method === "GET" && /^\/blocks\/[^/]+$/.test(path)) {
      bumped = true;
      fake.bumpManifestRev();
    }
  };
  r = await runSync(A, { mode: "export" });
  fake.beforeRequest = null;
  console.log(`  ${summary(r)}`);
  check("読み直してやり直し、tasks.json を書き出す", bumped && r.status === "synced" && r.exported.join() === "tasks.json");
  check("やり直しのログが残る", logs.some((l) => l.includes("読み直してやり直す")));

  console.log("流れ8: 429（Retry-After: 2）を1回返す");
  let once = false;
  fake.beforeRequest = () => {
    if (once) return null;
    once = true;
    return fakeResponse(429, { object: "error", status: 429, code: "rate_limited", message: "slow down" }, { "Retry-After": "2" });
  };
  const sleepsBefore = sleeps.length;
  await aStore.write("tasks.json", '{\n\t"version": "2.0.0",\n\t"tasks": [{ "label": "x" }]\n}\n');
  r = await runSync(A, { mode: "export" });
  fake.beforeRequest = null;
  console.log(`  ${summary(r)}  待ち=${sleeps.slice(sleepsBefore).join(",")}ms`);
  check("2000ms 待ってやり直し、書き出せた", sleeps.slice(sleepsBefore).includes(2000) && r.status === "synced");
  check("流れ7の書き出しで manifest が手での直しに合わせ直され、警告が消えた", r.warnings.length === 0, `警告 ${r.warnings.length}`);

  console.log("流れ9: 手元で snippets を消す → Notion から消す → もう1台からも消える");
  await aStore.remove("snippets/python.json");
  r = await runSync(A, { mode: "export" });
  console.log(`  A: ${summary(r)}`);
  check("Notion から消した", r.deletedRemote.join() === "snippets/python.json" && !fake.snapshot().some((b) => b.text === "snippets/python.json"));
  r = await runSync(B, { mode: "both" });
  console.log(`  B: ${summary(r)}`);
  check("B の手元からも消えた", r.deletedLocal.includes("snippets/python.json") && (await bStore.read("snippets/python.json")) === null);

  console.log("流れ10: 200,000 文字を超えるファイルは書き出さない");
  await aStore.write("snippets/big.json", '{"x":"' + "x".repeat(200_100) + '"}');
  const callsBefore = fake.calls.filter((c) => c.method !== "GET").length;
  r = await runSync(A, { mode: "export" });
  console.log(`  ${summary(r)}`);
  check("error で止まり、何も書かない", r.status === "error" && fake.calls.filter((c) => c.method !== "GET").length === callsBefore && /長すぎる/.test(r.error ?? ""));
  await aStore.remove("snippets/big.json");

  console.log("流れ11: 構文の誤りのある手元のファイルは扱わない");
  await aStore.write("keybindings.json", "[ { \"key\": ");
  r = await runSync(A, { mode: "export" });
  console.log(`  ${summary(r)}`);
  check("skipped に入り、書き出さない", r.skipped.some((s) => s.name === "keybindings.json") && !r.exported.includes("keybindings.json"));

  console.log("流れ12: つながらない");
  const offline = createNotionClient({ token: TOKEN, fetch: async () => { throw new TypeError("fetch failed"); }, sleep: async () => {}, minIntervalMs: 0 });
  await aStore.write("tasks.json", '{\n\t"version": "2.0.0"\n}\n');
  r = await runSync({ ...A, api: offline }, { mode: "export" });
  console.log(`  ${summary(r)}`);
  check("status offline（次のきっかけでやり直す）", r.status === "offline");

  console.log("流れ13: トークンが違う → エラーの文にトークンが入らない");
  const bad = createNotionClient({ token: "ntn_WRONG_TOKEN_abcdefghijklmnopqrstuvwxyz", fetch: fake.fetch, sleep: async () => {}, minIntervalMs: 0 });
  let msg = "";
  try {
    await bad.listChildren(PAGE);
  } catch (e) {
    msg = (e as Error).message;
    check("NotionApiError 401", e instanceof NotionApiError && e.status === 401, msg);
  }
  const allText = [msg, ...logs, JSON.stringify(aBase.state), JSON.stringify(bBase.state)].join("\n");
  check("エラー・ログ・基底にトークンが無い", !allText.includes(TOKEN) && !allText.includes("ntn_WRONG"));

  console.log("流れ14: 差分を見る（読むだけ）");
  await aStore.write("keybindings.json", "[]\n");
  const diffs = await readDiffs(A);
  check("差分の一覧に tasks.json と keybindings.json", diffs.some((d) => d.name === "tasks.json") && diffs.some((d) => d.name === "keybindings.json"), diffs.map((d) => d.name).join(","));

  console.log("流れ15: 呼び出しの間隔（平均 3 回/秒を超えない）");
  const gaps = sleeps.filter((ms) => ms > 0 && ms <= 350);
  check("350ms の間隔を空けた", gaps.length > 0, `間隔の待ち ${gaps.length} 回`);

  console.log("流れ16: 本物のファイル（C:\\b\\notion-sync-trial\\User）で取り込み・書き出し");
  {
    const root = process.env.NOTION_SYNC_TRIAL_DIR ?? "C:\\b\\notion-sync-trial";
    await fsp.rm(root, { recursive: true, force: true });
    const userDir = path.join(root, "User");
    const globalStorage = path.join(userDir, "globalStorage", "shuko.notion-sync");
    await fsp.mkdir(path.join(userDir, "snippets"), { recursive: true });
    await fsp.writeFile(path.join(userDir, "settings.json"), '{\r\n\t"terminal.integrated.defaultProfile.windows": "cmd"\r\n}\r\n');
    const C = mk("PC-C", userDirFileStore(userDir), fileBaseStore(path.join(globalStorage, "sync-base.json")));
    r = await runSync(C, { mode: "both", force: { "settings.json": "remote" } });
    console.log(`  ${summary(r)}`);
    const onDisk = await fsp.readFile(path.join(userDir, "settings.json"), "utf8");
    const names = (await fsp.readdir(userDir)).sort().join(",");
    check("ファイルに取り込み、PC ごとの値（cmd）を保つ", r.status === "synced" && onDisk.includes('"cmd"') && onDisk.includes('"editor.fontSize": 12'), names);
    check("一時ファイルが残らない", !names.includes(".tmp"));
    const baseJson = JSON.parse(await fsp.readFile(path.join(globalStorage, "sync-base.json"), "utf8"));
    check("globalStorage に sync-base.json", baseJson.pageId === PAGE && typeof baseJson.files["settings.json"]?.local === "string");
    let rejected = false;
    try {
      await userDirFileStore(userDir).write("snippets/../../evil.json", "{}");
    } catch {
      rejected = true;
    }
    check("User フォルダの外の名前は書かない", rejected);
    check("globalStorage の2つ上が User フォルダ", userDirFromGlobalStorage(globalStorage) === userDir);
  }

  console.log("");
  console.log(`manifest（最後）: ${fake.snapshot()[1].text.replace(/\s+/g, " ")}`);
  console.log(`基底（PC-A）: ${JSON.stringify(aBase.state)}`);
  console.log(`settings.json の sha256（PC-A の共有する形）: ${hashText(stripIgnored((await aStore.read("settings.json")) ?? "", IGNORED))}`);
  console.log(`Notion への呼び出し: ${fake.calls.length} 回（GET ${fake.calls.filter((c) => c.method === "GET").length}、PATCH ${fake.calls.filter((c) => c.method === "PATCH").length}、DELETE ${fake.calls.filter((c) => c.method === "DELETE").length}）`);
  console.log("ログ（同期の部品が出したもの）:");
  for (const l of logs) console.log(`  ${l}`);
  console.log("");
  console.log(failures === 0 ? "試し: すべて期待どおり" : `試し: 期待と違うものが ${failures} 件`);
  return failures === 0;
}
