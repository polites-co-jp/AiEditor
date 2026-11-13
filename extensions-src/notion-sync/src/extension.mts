// 拡張の入口（docs/05 の4節・7節・9節）。vscode の API と、同期の部品（sync.mts）をつなぐだけにする。
// トークンは SecretStorage（context.secrets）にだけ置く。ログ・設定・エラーの文に書かない。

import * as vscode from "vscode";
import * as os from "node:os";
import * as path from "node:path";
import { createNotionClient, type FetchLike } from "./notion-client.mts";
import { normalizePageId, isSyncableName, compareNames } from "./names.mts";
import { normalizeIgnoredKeys } from "./settings-filter.mts";
import { fileBaseStore, userDirFileStore, userDirFromGlobalStorage } from "./stores.mts";
import { readDiffs, runSync, type ConflictInfo, type ForceChoice, type SyncDeps, type SyncMode, type SyncResult } from "./sync.mts";
import { toLocalText } from "./text.mts";

const SECRET_KEY = "notionSync.token";
const SCHEME = "notion-sync";
const SAVE_DEBOUNCE_MS = 5000;

type State = "synced" | "unsynced" | "conflict" | "syncing";

class RemoteContent implements vscode.TextDocumentContentProvider {
  private readonly docs = new Map<string, string>();
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.emitter.event;
  set(uri: vscode.Uri, text: string) {
    this.docs.set(uri.toString(), text);
    this.emitter.fire(uri);
  }
  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.docs.get(uri.toString()) ?? "";
  }
  dispose() {
    this.emitter.dispose();
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const out = vscode.window.createOutputChannel("Notion 同期", { log: true });
  const status = vscode.window.createStatusBarItem("notionSync.status", vscode.StatusBarAlignment.Left, 0);
  status.name = "Notion 同期";
  const remote = new RemoteContent();
  context.subscriptions.push(out, status, remote, vscode.workspace.registerTextDocumentContentProvider(SCHEME, remote));

  const userDir = userDirFromGlobalStorage(context.globalStorageUri.fsPath);
  const baseFile = path.join(context.globalStorageUri.fsPath, "sync-base.json");
  const store = userDirFileStore(userDir);
  const baseStore = fileBaseStore(baseFile);
  out.info(`User フォルダ: ${userDir}`);

  let lastResult: SyncResult | null = null;
  let lastConflicts: ConflictInfo[] = [];
  let state: State = "unsynced";
  let reason = "";
  let tokenWarned = false;

  const config = () => vscode.workspace.getConfiguration("notionSync");
  const enabled = () => config().get<boolean>("enabled", false) === true;

  function render() {
    if (!enabled()) {
      status.hide();
      return;
    }
    const map: Record<State, string> = {
      synced: "$(check) 同期済み",
      unsynced: "$(sync-ignored) 未同期",
      conflict: "$(warning) 競合あり",
      syncing: "$(sync~spin) 同期中",
    };
    status.text = map[state];
    const lines = ["Notion 同期"];
    if (reason) lines.push(reason);
    if (lastResult?.rev != null) lines.push(`rev ${lastResult.rev}`);
    status.tooltip = lines.join("\n");
    status.command = state === "conflict" ? "notionSync.showDiff" : "notionSync.import";
    status.show();
  }

  async function makeDeps(): Promise<SyncDeps | string> {
    const pageId = normalizePageId(config().get<string>("pageId", ""));
    if (!pageId) return "notionSync.pageId が無いか読めない";
    const token = await context.secrets.get(SECRET_KEY);
    if (!token) return "トークンが無い（コマンド「Notion 同期: トークンを設定」）";
    const api = createNotionClient({ token, fetch: globalThis.fetch as unknown as FetchLike });
    return {
      api,
      store,
      baseStore,
      pageId,
      ignoredSettings: normalizeIgnoredKeys(config().get<unknown>("ignoredSettings", [])),
      machine: os.hostname(),
      now: () => new Date(),
      defaultEol: process.platform === "win32" ? "\r\n" : "\n",
      log: (m) => out.info(m),
    };
  }

  // 同期は1つずつ（走っている間のきっかけは、終わった後に1回にまとめる）
  let chain: Promise<unknown> = Promise.resolve();
  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const p = chain.then(job, job);
    chain = p.catch(() => undefined);
    return p;
  }

  function sync(mode: SyncMode, opts: { force?: Record<string, ForceChoice>; manual?: boolean } = {}): Promise<SyncResult | null> {
    return enqueue(async () => {
      if (!enabled() && !opts.manual) return null;
      const deps = await makeDeps();
      if (typeof deps === "string") {
        state = "unsynced";
        reason = deps;
        render();
        if (opts.manual) void vscode.window.showWarningMessage(`Notion 同期: ${deps}`);
        else if (!tokenWarned && enabled()) {
          tokenWarned = true;
          void vscode.window.showWarningMessage(`Notion 同期: ${deps}`, "トークンを設定").then((c) => {
            if (c) void vscode.commands.executeCommand("notionSync.setToken");
          });
        }
        return null;
      }
      const prevState = state;
      state = "syncing";
      render();
      const r = await runSync(deps, { mode, force: opts.force });
      lastResult = r;
      for (const w of r.warnings) out.warn(w);
      for (const s of r.skipped) out.warn(`${s.name}: ${s.reason}`);
      if (r.status === "offline" || r.status === "error") {
        state = "unsynced";
        reason = r.error ?? "";
        out.error(reason);
        if (opts.manual) void vscode.window.showErrorMessage(`Notion 同期: ${reason}`);
      } else if (r.status === "conflict") {
        state = "conflict";
        lastConflicts = r.conflicts;
        reason = `競合: ${r.conflicts.map((c) => c.name).join(", ")}`;
        void vscode.window
          .showWarningMessage(`Notion 同期: 手元と Notion の両方が変わった（${r.conflicts.map((c) => c.name).join(", ")}）`, "差分を見る")
          .then((c) => {
            if (c) void vscode.commands.executeCommand("notionSync.showDiff");
          });
      } else {
        lastConflicts = [];
        // export だけ・import だけのときに残したものがあれば、同期済みとは言わない
        if (r.pending.length > 0) {
          state = prevState === "conflict" ? "conflict" : "unsynced";
          reason = `残り: ${r.pending.map((p) => `${p.name}（${p.decision === "import" ? "取り込み" : "書き出し"}）`).join(", ")}`;
        } else {
          state = "synced";
          reason = r.skipped.length ? `扱わなかった: ${r.skipped.map((s) => s.name).join(", ")}` : "";
        }
        const done = [...r.imported, ...r.deletedLocal].length + [...r.exported, ...r.deletedRemote].length;
        if (opts.manual) {
          void vscode.window.showInformationMessage(
            done ? `Notion 同期: 取り込み ${r.imported.length + r.deletedLocal.length}、書き出し ${r.exported.length + r.deletedRemote.length}` : "Notion 同期: 変わったものは無い",
          );
        }
      }
      render();
      return r;
    });
  }

  // 保存のきっかけ: 5 秒待ってまとめて書き出す
  let timer: ReturnType<typeof setTimeout> | undefined;
  function scheduleExport() {
    if (!enabled()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void sync("export");
    }, SAVE_DEBOUNCE_MS);
  }
  context.subscriptions.push({ dispose: () => timer && clearTimeout(timer) });

  const userUri = vscode.Uri.file(userDir);
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(userUri, "{settings.json,keybindings.json,tasks.json,snippets/*.json,snippets/*.code-snippets}"),
  );
  context.subscriptions.push(
    watcher,
    watcher.onDidChange(scheduleExport),
    watcher.onDidCreate(scheduleExport),
    watcher.onDidDelete(scheduleExport),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.uri.scheme !== "file") return;
      const rel = path.relative(userDir, doc.uri.fsPath).split(path.sep).join("/");
      if (isSyncableName(rel)) scheduleExport();
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("notionSync.enabled")) {
        render();
        if (enabled()) void sync("both");
      } else if (e.affectsConfiguration("notionSync.ignoredSettings") || e.affectsConfiguration("notionSync.pageId")) {
        scheduleExport();
      }
    }),
    context.secrets.onDidChange((e) => {
      if (e.key === SECRET_KEY) tokenWarned = false;
    }),
  );

  // 差分を見る・競合を解く
  async function openDiff(c: ConflictInfo): Promise<void> {
    const left = vscode.Uri.from({ scheme: SCHEME, path: `/${c.name}`, query: `t=${Date.now()}` });
    const eol = process.platform === "win32" ? "\r\n" : "\n";
    remote.set(left, c.remoteAsLocal === null ? "" : toLocalText(c.remoteAsLocal, eol));
    let right: vscode.Uri;
    if (c.local === null) {
      right = vscode.Uri.from({ scheme: SCHEME, path: `/local/${c.name}`, query: `t=${Date.now()}` });
      remote.set(right, "");
    } else {
      right = vscode.Uri.file(path.join(userDir, ...c.name.split("/")));
    }
    await vscode.commands.executeCommand("vscode.diff", left, right, `${c.name}（Notion ↔ 手元）`, { preview: false });
  }

  async function resolve(c: ConflictInfo): Promise<void> {
    const items: Array<vscode.QuickPickItem & { id: "local" | "remote" | "manual" | "none" }> = [
      { id: "local", label: "手元を採る", description: "手元の中身を Notion に書き出す" },
      { id: "remote", label: "Notion を採る", description: "Notion の中身で手元を置き換える" },
      { id: "manual", label: "手で直して書き出す", description: "右（手元）を直して保存し、終わったら書き出す" },
      { id: "none", label: "今はしない" },
    ];
    const pick = await vscode.window.showQuickPick(items, { title: `${c.name} の競合`, ignoreFocusOut: true });
    if (!pick || pick.id === "none") return;
    if (pick.id === "manual") {
      const go = await vscode.window.showInformationMessage(
        `${c.name}: 右側（手元）を直して保存してから「書き出す」を押す`,
        "書き出す",
      );
      if (go !== "書き出す") return;
      const fileUri = vscode.Uri.file(path.join(userDir, ...c.name.split("/")));
      const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === fileUri.toString());
      if (open?.isDirty) await open.save();
      await sync("both", { force: { [c.name]: "local" }, manual: true });
      return;
    }
    await sync("both", { force: { [c.name]: pick.id }, manual: true });
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("notionSync.import", () => sync("import", { manual: true })),
    vscode.commands.registerCommand("notionSync.export", () => sync("export", { manual: true })),
    vscode.commands.registerCommand("notionSync.showDiff", async () => {
      let list: ConflictInfo[] = lastConflicts;
      const conflictNames = new Set(list.map((c) => c.name));
      if (list.length === 0) {
        const deps = await makeDeps();
        if (typeof deps === "string") {
          void vscode.window.showWarningMessage(`Notion 同期: ${deps}`);
          return;
        }
        try {
          list = await readDiffs(deps);
        } catch (e) {
          void vscode.window.showErrorMessage(`Notion 同期: ${(e as Error).message}`);
          return;
        }
      }
      if (list.length === 0) {
        void vscode.window.showInformationMessage("Notion 同期: 手元と Notion に違いは無い");
        return;
      }
      const sorted = [...list].sort((a, b) => compareNames(a.name, b.name));
      const chosen =
        sorted.length === 1
          ? sorted[0]
          : (
              await vscode.window.showQuickPick(
                sorted.map((c) => ({ label: c.name, description: conflictNames.has(c.name) ? "競合" : "違いあり", c })),
                { title: "差分を見るファイル" },
              )
            )?.c;
      if (!chosen) return;
      await openDiff(chosen);
      await resolve(chosen);
    }),
    vscode.commands.registerCommand("notionSync.setToken", async () => {
      const token = await vscode.window.showInputBox({
        title: "Notion 同期: トークンを設定",
        prompt: "設定ページだけに接続した内部インテグレーションのトークン（OS の保護の仕組みで保存する。settings.json には書かない）",
        password: true,
        ignoreFocusOut: true,
        validateInput: (v) => (v.trim().length < 20 ? "トークンが短すぎる" : undefined),
      });
      if (!token) return;
      await context.secrets.store(SECRET_KEY, token.trim());
      out.info("トークンを保存した");
      if (!enabled() && normalizePageId(config().get<string>("pageId", ""))) {
        const c = await vscode.window.showInformationMessage("Notion 同期: トークンを保存した。同期を有効にするか", "有効にする");
        if (c) await config().update("enabled", true, vscode.ConfigurationTarget.Global);
      } else if (enabled()) {
        void sync("both");
      } else {
        void vscode.window.showInformationMessage("Notion 同期: トークンを保存した。notionSync.pageId を設定してから notionSync.enabled を true にする");
      }
    }),
    vscode.commands.registerCommand("notionSync.clearToken", async () => {
      await context.secrets.delete(SECRET_KEY);
      out.info("トークンを消した");
      state = "unsynced";
      reason = "トークンが無い";
      render();
      void vscode.window.showInformationMessage("Notion 同期: トークンを消した");
    }),
  );

  render();
  // 起動のきっかけ（onStartupFinished）: Notion を読み、取り込み・書き出しが要るかを確かめる
  if (enabled()) void sync("both");
}

export function deactivate(): void {
  // 後始末は context.subscriptions が行う
}
