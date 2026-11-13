'use strict';
// tests/smoke の動作確認用の拡張（試験専用。配らない）。
// 台本（tests/smoke/lib/run.mjs）が --extensionDevelopmentPath で読み込ませる。
// 環境変数 AIED_SMOKE_CONFIG の指す JSON を読み、docs/06 の5節の「自」の項目をエディタの中から確かめ、
// 結果を config.out に書き出す（確かめるたびに書き直す。完了したら done: true）。
//
// 画面の描画そのものは見ない。API で確かめられる範囲（動作中の拡張、診断、補完、タブの種類、
// ファイルの保存、ターミナルの実行、タスク、git）を確かめる。見えない部分は手の手順書（manual-checks.md）に回す。

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeoutMs, stepMs = 500) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    let v;
    try { v = await fn(); } catch { v = null; }
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(stepMs);
  }
}

function withTimeout(p, ms, what) {
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`時間切れ（${ms} ms）: ${what}`)), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

function label(item) {
  const l = item.label;
  return typeof l === 'string' ? l : (l && l.label) || '';
}

const sameFs = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

async function activate() {
  const cfgPath = process.env.AIED_SMOKE_CONFIG;
  if (!cfgPath) return;
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const ws = cfg.ws;
  // 動くのは、試験用のフォルダ（cfg.ws）を開いたウィンドウの1回だけ。newWindow で開いた2つめのウィンドウにも
  // この拡張は読み込まれ、同じ結果ファイルを done:false で上書きしてしまった（検証 2026-11-13）。
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || !folders.length || !sameFs(folders[0].uri.fsPath, ws)) return;
  const U = (rel) => vscode.Uri.file(path.join(ws, rel));
  const result = {
    startedAt: new Date().toISOString(),
    vscodeVersion: vscode.version,
    uiLanguage: vscode.env.language,
    appName: vscode.env.appName,
    checks: [],
    extensions: [],
    done: false,
  };
  // 書き出し。台本が同じファイルを読んでいる最中の rename は Windows で EPERM になる（2回目の実行で起きた）。
  // 何度か試し、だめなら直接書く。書けなくても確認は止めない（台本は書きかけの JSON を読み飛ばす）。
  const flush = () => {
    const text = JSON.stringify(result, null, 2);
    const tmp = cfg.out + '.tmp';
    for (let i = 0; i < 5; i++) {
      try {
        fs.writeFileSync(tmp, text, 'utf8');
        fs.renameSync(tmp, cfg.out);
        return;
      } catch { /* 読まれている最中。次で試す */ }
    }
    try { fs.writeFileSync(cfg.out, text, 'utf8'); } catch { /* 次の flush で書き直す */ }
  };

  async function check(id, group, title, fn, timeoutMs = 120000) {
    const t0 = Date.now();
    let status = 'pass';
    let detail = '';
    try {
      const r = await withTimeout(Promise.resolve().then(fn), timeoutMs, id);
      if (r && typeof r === 'object') { status = r.status ?? 'pass'; detail = r.detail ?? ''; } else if (typeof r === 'string') { detail = r; }
    } catch (e) {
      status = 'fail';
      detail = String((e && e.message) || e);
    }
    result.checks.push({ id, group, title, status, detail, ms: Date.now() - t0 });
    flush();
  }
  const skip = (detail) => ({ status: 'skip', detail });
  const fail = (detail) => ({ status: 'fail', detail });
  const want = (g) => cfg.groups.includes(g);

  // ---- 開く: 言語サーバーを起こすため、診断・補完を試すファイルを先に全部開く ----
  const opened = {};
  async function open(rel, show = true) {
    const doc = await vscode.workspace.openTextDocument(U(rel));
    if (show) await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: false });
    opened[rel] = doc;
    return doc;
  }
  const diags = (rel) => vscode.languages.getDiagnostics(U(rel));
  async function waitDiag(rel, sourceRx, ms) {
    return waitFor(() => { const d = diags(rel).filter((x) => sourceRx.test(String(x.source || ''))); return d.length ? d : null; }, ms, 1000);
  }
  async function completions(rel, line, character, ms) {
    const uri = U(rel);
    return waitFor(async () => {
      const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', uri, new vscode.Position(line, character));
      return list && list.items && list.items.length ? list.items.map(label) : null;
    }, ms, 2000);
  }

  // 動作中の拡張の一覧は、まず最初の状態を取る（その後の確認で増えるものがあるので、終わりにも取り直す）
  const snapshotExtensions = () => vscode.extensions.all
    .filter((e) => !e.id.startsWith('vscode.') || cfg.listBuiltins)
    .map((e) => ({ id: e.id, version: e.packageJSON.version, isActive: e.isActive, builtin: e.packageUri.fsPath.toLowerCase().includes('resources\\app\\extensions') }));

  try {
    // 言語のファイルを開く（onLanguage を起こす）
    if (want('languages')) {
      for (const rel of ['ts/bad.ts', 'py/bad.py', 'web/style.css', 'web/data.json', 'shell/bad.sh', 'ps/bad.ps1', 'data/sample.csv', '.env', 'ts/complete.ts', 'web/index.html', 'web/schema-sample.json', '.env.bad', 'bad.env']) {
        try { await open(rel); } catch (e) { result.checks.push({ id: `open.${rel}`, group: 'languages', title: `${rel} を開く`, status: 'fail', detail: String(e.message || e), ms: 0 }); }
      }
      flush();
    }

    // ================= base =================
    if (want('base')) {
      await check('base.open-folder', 'base', 'フォルダが開く', () => {
        const f = vscode.workspace.workspaceFolders;
        if (!f || !f.length) return fail('workspaceFolders が空');
        return sameFs(f[0].uri.fsPath, ws) ? f[0].uri.fsPath : fail(`別のフォルダ: ${f[0].uri.fsPath}`);
      });

      await check('base.edit-save', 'base', 'ファイルを編集して保存できる', async () => {
        const doc = await open('edit/target.txt');
        const edit = new vscode.WorkspaceEdit();
        edit.insert(doc.uri, new vscode.Position(0, 0), 'smoke-edit-');
        if (!(await vscode.workspace.applyEdit(edit))) return fail('applyEdit が false');
        if (!(await doc.save())) return fail('save が false');
        const disk = fs.readFileSync(path.join(ws, 'edit/target.txt'), 'utf8');
        return disk.startsWith('smoke-edit-before') ? '保存した内容がディスクにある' : fail(`ディスクの内容が違う: ${JSON.stringify(disk)}`);
      });

      await check('base.palette', 'base', 'コマンドパレットが開く・閉じる', async () => {
        const cmds = await vscode.commands.getCommands(true);
        if (!cmds.includes('workbench.action.showCommands')) return fail('workbench.action.showCommands が無い');
        await vscode.commands.executeCommand('workbench.action.showCommands');
        await sleep(500);
        await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
        return 'コマンドを実行できた（画面の見え方は手の確認）';
      });

      await check('base.split', 'base', 'エディタを分割できる', async () => {
        await open('edit/target.txt');
        await vscode.commands.executeCommand('workbench.action.splitEditor');
        const ok = await waitFor(() => vscode.window.tabGroups.all.length >= 2, 10000, 250);
        const n = vscode.window.tabGroups.all.length;
        await vscode.commands.executeCommand('workbench.action.joinTwoGroups');
        return ok ? `グループ ${n}` : fail(`グループが ${n} のまま`);
      });

      await check('base.minimap', 'base', 'ミニマップが有効（設定の既定）', () => {
        const v = vscode.workspace.getConfiguration('editor').get('minimap.enabled');
        return v === true ? 'editor.minimap.enabled = true（描画は手の確認）' : fail(`editor.minimap.enabled = ${v}`);
      });

      await check('base.terminal', 'base', 'ターミナル（PowerShell）でコマンドが実行できる', async () => {
        const out = path.join(path.dirname(cfg.out), 'terminal-out.txt');
        try { fs.rmSync(out, { force: true }); } catch { /* 無い */ }
        const term = vscode.window.createTerminal({ name: 'smoke', shellPath: 'powershell.exe', shellArgs: ['-NoLogo', '-NoProfile'] });
        term.show();
        // シェルが立ち上がる前に送った文字も、ptyHost が溜めて渡す。ファイルに書かせて確かめる（シェル統合に頼らない）
        term.sendText(`Set-Content -LiteralPath '${out.replace(/'/g, "''")}' -Value 'term-ok' -Encoding ascii`);
        const ok = await waitFor(() => fs.existsSync(out) && fs.readFileSync(out, 'utf8').includes('term-ok'), 60000, 500);
        term.dispose();
        return ok ? 'powershell.exe で実行された' : fail('60 秒待ってもファイルができない');
      }, 90000);

      await replaceCheck();

      await check('base.search', 'base', '全文検索（ファイル列挙と検索コマンド）', async () => {
        const found = await vscode.workspace.findFiles('**/*.ts', '**/node_modules/**', 10);
        if (!found.length) return fail('findFiles が 0 件');
        await vscode.commands.executeCommand('workbench.action.findInFiles', { query: 'smoke_needle', triggerSearch: true, isRegex: false });
        await sleep(1500);
        await vscode.commands.executeCommand('workbench.action.closePanel').then(undefined, () => {});
        return `findFiles ${found.length} 件。検索結果の件数は ripgrep の検査（base.ripgrep）で見る`;
      });

      await check('base.diff', 'base', '差分ビューが開く', async () => {
        await vscode.commands.executeCommand('vscode.diff', U('edit/a.txt'), U('edit/b.txt'), 'smoke diff');
        const ok = await waitFor(() => { const t = vscode.window.tabGroups.activeTabGroup.activeTab; return t && t.input instanceof vscode.TabInputTextDiff; }, 10000, 250);
        return ok ? 'TabInputTextDiff' : fail('差分のタブが無い');
      });

      await check('base.git', 'base', 'git: 変更の表示・ステージ・コミット', async () => {
        if (!cfg.gitOk) return skip(`git が使えない: ${cfg.gitReason || ''}`);
        const gx = vscode.extensions.getExtension('vscode.git');
        if (!gx) return fail('組み込みの vscode.git が無い');
        await gx.activate();
        const api = gx.exports.getAPI(1);
        const repo = await waitFor(() => api.repositories.find((r) => sameFs(r.rootUri.fsPath, ws)), 30000, 500);
        if (!repo) return fail('リポジトリを見つけられない');
        fs.appendFileSync(path.join(ws, 'tracked.txt'), 'changed\n');
        await repo.status();
        const changed = await waitFor(() => repo.state.workingTreeChanges.length >= 1, 20000, 500);
        if (!changed) return fail('変更が表示に出ない');
        await repo.add([path.join(ws, 'tracked.txt')]);
        await repo.status();
        const staged = await waitFor(() => repo.state.indexChanges.length >= 1, 20000, 500);
        if (!staged) return fail('ステージされない');
        const before = repo.state.HEAD && repo.state.HEAD.commit;
        await repo.commit('smoke commit');
        const log = await repo.log({ maxEntries: 1 });
        const after = repo.state.HEAD && repo.state.HEAD.commit;
        return log[0] && log[0].message === 'smoke commit' && before !== after ? 'コミットできた' : fail(`コミットの確認に失敗: ${JSON.stringify(log[0] && log[0].message)}`);
      });

      await check('base.task', 'base', 'タスクを実行できる', async () => {
        const task = new vscode.Task({ type: 'smoke' }, vscode.TaskScope.Workspace, 'smoke-task', 'smoke', new vscode.ShellExecution('echo task-ok'));
        const exit = new Promise((res) => {
          const d = vscode.tasks.onDidEndTaskProcess((e) => { if (e.execution.task.name === 'smoke-task') { d.dispose(); res(e.exitCode); } });
        });
        await vscode.tasks.executeTask(task);
        const code = await withTimeout(exit, 60000, 'task end');
        return code === 0 ? '終了コード 0' : fail(`終了コード ${code}`);
      }, 90000);

      await check('base.markdown-preview', 'base', 'Markdown のプレビュー', async () => {
        await open('docs/readme.md');
        await vscode.commands.executeCommand('markdown.showPreview');
        const ok = await waitFor(() => vscode.window.tabGroups.all.flatMap((g) => g.tabs).some((t) => t.input instanceof vscode.TabInputWebview && /markdown/i.test(t.input.viewType)), 15000, 500);
        return ok ? 'Webview のタブ（markdown.preview）' : fail('プレビューのタブが無い');
      });

      await check('base.image-preview', 'base', '画像のプレビュー', async () => {
        await vscode.commands.executeCommand('vscode.open', U('img/pixel.png'));
        const ok = await waitFor(() => { const t = vscode.window.tabGroups.activeTabGroup.activeTab; return t && t.input instanceof vscode.TabInputCustom && /image/i.test(t.input.viewType) ? t.input.viewType : null; }, 15000, 500);
        return ok ? `カスタムエディタ ${ok}` : fail('画像のプレビューが開かない');
      });

      await check('base.pdf-preview', 'base', 'PDF のプレビュー（tomoki1207.pdf）', async () => {
        const x = vscode.extensions.getExtension('tomoki1207.pdf');
        if (!x) return skip('tomoki1207.pdf が入っていない');
        const ce = (x.packageJSON.contributes && x.packageJSON.contributes.customEditors) || [];
        const viewType = ce[0] && ce[0].viewType;
        if (!viewType) return fail('manifest に customEditors が無い');
        await vscode.commands.executeCommand('vscode.openWith', U('doc/sample.pdf'), viewType);
        const ok = await waitFor(() => { const t = vscode.window.tabGroups.activeTabGroup.activeTab; return t && t.input instanceof vscode.TabInputCustom && t.input.viewType === viewType; }, 15000, 500);
        return ok ? `カスタムエディタ ${viewType}` : fail('PDF のタブが開かない');
      });

      await check('base.timeline-localhistory', 'base', 'タイムライン・ローカル履歴のコマンドがある', async () => {
        const cmds = await vscode.commands.getCommands(true);
        const need = ['timeline.refresh', 'workbench.action.localHistory.restoreViaPicker', 'workbench.action.localHistory.compareWithFile'];
        const miss = need.filter((c) => !cmds.includes(c));
        return miss.length ? fail(`無い: ${miss.join(', ')}`) : '3 つとも登録済み（履歴の実体は base.localhistory で見る）';
      });

      // 直前の確認（プレビューなど）がフォーカスを持っていることがあり、コマンドが別の場所に効く（2回目の実行で起きた）。
      // エディタにフォーカスを戻してから実行し、効かなければ数回やり直す。
      const focusEditor = async (rel) => {
        const doc = await open(rel);
        await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        await sleep(700);
        return doc;
      };

      // コマンド（editor.action.insertSnippet / formatDocument）は、ウィンドウやエディタにフォーカスが無いと効かず、
      // 3回目の実行で落ちた（フォーカスを戻しても直らなかった）。フォーカスに頼らない API で行う。
      await check('base.snippet', 'base', 'スニペットを挿入できる', async () => {
        const doc = await open('edit/snippet.txt');
        const editor = await vscode.window.showTextDocument(doc, { preview: false });
        const ok = await editor.insertSnippet(new vscode.SnippetString('smoke_${1:name}_${2:end}'), new vscode.Position(0, 0));
        const text = doc.getText();
        return ok && text.includes('smoke_name_end') ? '挿入された（TextEditor.insertSnippet）' : fail(`ok=${ok} 本文: ${JSON.stringify(text)}`);
      });

      await check('base.format', 'base', '整形（JSON）', async () => {
        const doc = await open('web/fmt.json');
        const before = doc.getText();
        let edits = null;
        for (let i = 0; i < 6 && !(edits && edits.length); i++) {
          // JSON の言語サーバーが温まっていないと空で返ることがある。数回やり直す
          edits = await vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', doc.uri, { tabSize: 2, insertSpaces: true });
          if (!(edits && edits.length)) await sleep(2000);
        }
        if (!edits || !edits.length) return fail('整形の編集が返らない');
        const we = new vscode.WorkspaceEdit();
        we.set(doc.uri, edits);
        await vscode.workspace.applyEdit(we);
        const after = doc.getText();
        return after !== before && after.includes('\n  ') ? `整形された（${edits.length} 編集）` : fail(`変わらない: ${JSON.stringify(after)}`);
      }, 60000);
    }

    // ================= claude-code =================
    if (want('claude-code')) {
      await check('claude.running', 'claude-code', 'Claude Code 拡張が動作中の拡張に出る', async () => {
        const x = vscode.extensions.getExtension('anthropic.claude-code');
        if (!x) return fail('anthropic.claude-code が入っていない');
        // 自然な起動（onStartupFinished）を待つ。こちらから activate() して取り繕わない
        const ok = await waitFor(() => x.isActive, 90000, 1000);
        return ok ? `isActive = true（${x.packageJSON.version}）` : fail('90 秒待っても isActive にならない');
      }, 120000);
    }

    // ================= languages =================
    if (want('languages')) {
      await check('lang.ts.diagnostics', 'languages', 'TS: tsserver の診断が出る', async () => {
        const d = await waitDiag('ts/bad.ts', /^ts$/i, 120000);
        return d ? `${d.length} 件: ${d.map((x) => x.code && (x.code.value ?? x.code)).join(',')}` : fail('source=ts の診断が出ない');
      }, 150000);

      await check('lang.ts.completion', 'languages', 'TS: 補完（Math.floor）', async () => {
        const p = cfg.completion.ts;
        const items = await completions(p.file, p.line, p.character, 90000);
        return items && items.includes(p.expect) ? `${items.length} 件に ${p.expect} を含む` : fail(items ? `${p.expect} が無い（${items.length} 件）` : '補完が返らない');
      }, 120000);

      await check('lang.py.importStrategy', 'languages', 'Python: basedpyright.importStrategy が useBundled', () => {
        const i = vscode.workspace.getConfiguration('basedpyright').inspect('importStrategy');
        if (!i) return fail('設定が登録されていない（basedpyright が無い）');
        const eff = vscode.workspace.getConfiguration('basedpyright').get('importStrategy');
        if (eff !== 'useBundled') return fail(`有効な値 ${JSON.stringify(eff)}（既定 ${JSON.stringify(i.defaultValue)}、ユーザー ${JSON.stringify(i.globalValue)}）`);
        if (cfg.mode === 'built' && i.defaultValue !== 'useBundled') return fail(`自作は mydist の既定で useBundled になるはずが、既定は ${JSON.stringify(i.defaultValue)}`);
        return `有効な値 useBundled（既定 ${JSON.stringify(i.defaultValue)}、ユーザー ${JSON.stringify(i.globalValue)}）`;
      });

      await check('lang.py.diagnostics', 'languages', 'Python: basedpyright の診断が出る', async () => {
        const d = await waitDiag('py/bad.py', /pyright/i, 150000);
        return d ? `${d.length} 件: ${d.map((x) => x.code && (x.code.value ?? x.code)).join(',')}` : fail('source=basedpyright の診断が出ない');
      }, 180000);

      await check('lang.html.completion', 'languages', 'HTML: 補完（div）', async () => {
        const p = cfg.completion.html;
        const items = await completions(p.file, p.line, p.character, 60000);
        return items && items.includes(p.expect) ? `${items.length} 件に ${p.expect} を含む` : fail(items ? `${p.expect} が無い（${items.length} 件）` : '補完が返らない');
      }, 90000);

      await check('lang.css.diagnostics', 'languages', 'CSS: 診断が出る（colr）', async () => {
        const d = await waitDiag('web/style.css', /^css$/i, 60000);
        return d ? `${d.length} 件` : fail('source=css の診断が出ない');
      }, 90000);

      await check('lang.css.completion', 'languages', 'CSS: 補完（color）', async () => {
        const p = cfg.completion.css;
        const items = await completions(p.file, p.line, p.character, 60000);
        return items && items.includes(p.expect) ? `${items.length} 件に ${p.expect} を含む` : fail(items ? `${p.expect} が無い（${items.length} 件）` : '補完が返らない');
      }, 90000);

      await check('lang.json.diagnostics', 'languages', 'JSON: 診断が出る（末尾のカンマ）', async () => {
        const d = await waitDiag('web/data.json', /^json$/i, 60000);
        return d ? `${d.length} 件` : fail('source=json の診断が出ない');
      }, 90000);

      await check('lang.json.completion', 'languages', 'JSON: 補完（$schema の enum の red）', async () => {
        const p = cfg.completion.json;
        const raw = await completions(p.file, p.line, p.character, 60000);
        // JSON の値の補完は、ラベルが引用符つき（"red"）で返る
        const items = raw && raw.map((s) => s.replace(/^"|"$/g, ''));
        return items && items.includes(p.expect) ? `${items.length} 件に ${p.expect} を含む（${raw.join(',')}）` : fail(items ? `${p.expect} が無い（${items.length} 件: ${raw.slice(0, 5).join(',')}）` : '補完が返らない');
      }, 90000);

      await check('lang.csv.rainbow', 'languages', 'CSV: Rainbow CSV が動き、検査のコマンドが通る', async () => {
        const x = vscode.extensions.getExtension('mechatroner.rainbow-csv');
        if (!x) return skip('mechatroner.rainbow-csv が入っていない');
        const ok = await waitFor(() => x.isActive, 30000, 500);
        if (!ok) return fail('拡張が動作中にならない');
        const cmds = ((x.packageJSON.contributes && x.packageJSON.contributes.commands) || []).map((c) => c.command);
        const lint = cmds.find((c) => /lint/i.test(c));
        if (!lint) return `動作中。検査のコマンドは manifest に見当たらない（commands: ${cmds.slice(0, 5).join(', ')}）`;
        await open('data/sample.csv');
        await vscode.commands.executeCommand(lint);
        return `動作中。${lint} を実行できた（検査の表示そのものは手の確認）`;
      });

      await check('lang.env.dotenv', 'languages', '.env: dotenv の拡張が動作中', async () => {
        const ids = ['dotenv.dotenv-vscode', 'weixu.wx-vsce-dotenv'];
        const present = ids.map((i) => vscode.extensions.getExtension(i)).filter(Boolean);
        if (!present.length) return skip('dotenv の拡張が入っていない');
        const doc = await open('.env');
        const ok = await waitFor(() => present.some((x) => x.isActive), 30000, 500);
        return ok ? `${present.filter((x) => x.isActive).map((x) => x.id).join(',')} が動作中。.env の言語 id は ${doc.languageId}（補完の中身は手の確認）` : fail('動作中にならない');
      });

      // 事実の記録だけ（合否に使わない）。どちらの dotenv の拡張を台帳に残すかはユーザーの裁定（docs/07 の2.4 の4）
      await check('lang.env.compare', 'languages', '.env: 拡張が診断・補完を出すか（事実の記録。合否に使わない）', async () => {
        const present = ['dotenv.dotenv-vscode', 'weixu.wx-vsce-dotenv'].map((i) => vscode.extensions.getExtension(i)).filter(Boolean);
        if (!present.length) return skip('dotenv の拡張が入っていない');
        await waitFor(() => present.some((x) => x.isActive), 30000, 500);
        await sleep(8000); // 診断が出るのを待つ
        const parts = [];
        for (const x of present) {
          const langs = ((x.packageJSON.contributes && x.packageJSON.contributes.languages) || [])
            .map((l) => `${l.id}[${(l.filenames || []).concat(l.filenamePatterns || [], l.extensions || []).join(' ')}]`).join(' ');
          parts.push(`拡張 ${x.id}@${x.packageJSON.version} isActive=${x.isActive} languages=${langs || 'なし'}`);
        }
        for (const rel of ['.env', '.env.bad', 'bad.env']) {
          const doc = opened[rel];
          const d = diags(rel);
          const ds = d.slice(0, 6).map((x) => `${x.source || '-'}/sev${x.severity}/L${x.range.start.line + 1}:${String(x.message).slice(0, 60)}`).join(' | ');
          parts.push(`${rel}: languageId=${doc ? doc.languageId : '未オープン'} 診断=${d.length}件${ds ? `（${ds}）` : ''}`);
        }
        for (const p of cfg.completion.env) {
          let n = 0; let labels = [];
          try {
            const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', U(p.file), new vscode.Position(p.line, p.character));
            n = list && list.items ? list.items.length : 0;
            labels = (list && list.items ? list.items : []).slice(0, 8).map(label);
          } catch (e) { labels = [`エラー: ${e.message}`]; }
          parts.push(`補完 ${p.label}(${p.file}): ${n}件${labels.length ? `（${labels.join(',')}）` : ''}`);
        }
        return { status: 'info', detail: parts.join(' ; ') };
      }, 90000);

      await check('lang.sh.shellcheck', 'languages', 'sh: ShellCheck の警告が出る', async () => {
        if (!cfg.hasShellcheck) return skip('shellcheck が PATH に無い（bash-ide-vscode は shellcheck の実体を別に要る）');
        const d = await waitDiag('shell/bad.sh', /shellcheck/i, 60000);
        return d ? `${d.length} 件` : fail('source=shellcheck の診断が出ない');
      }, 90000);

      await check('lang.ps1.session', 'languages', 'PowerShell: セッションが立ち上がり、PSScriptAnalyzer の診断が出る', async () => {
        const x = vscode.extensions.getExtension('ms-vscode.powershell');
        if (!x) return skip('ms-vscode.powershell が入っていない');
        const d = await waitDiag('ps/bad.ps1', /PSScriptAnalyzer/i, 150000);
        return d ? `${d.length} 件` : fail('source=PSScriptAnalyzer の診断が出ない');
      }, 180000);
    }

    // 全文検索の置換（docs/06 の5節「全文検索と置換」）。検索ビューで「すべて置換」を実行し、ファイルが書き換わることを見る。
    // base.search の前に呼ぶ（先に検索すると、検索ビューに前の検索語と空の置換語が残り、別のファイルを置換してしまった。実機で確認）。
    async function replaceCheck() {
      // 「すべて置換」は確認のダイアログ（Electron の本物のダイアログ）が出て、API では押せない。
      // 1件ごとの置換（search.action.replace。確認なし）を、検索結果の最初の一致に対して行う。
      // 置換の結果は、ディスクのファイルか、開いたモデル（未保存）のどちらかに現れる。
      await check('base.replace', 'base', '全文検索の置換（検索ビューの一致を1件置換できる）', async () => {
        const file = path.join(ws, 'edit', 'replace.txt');
        const before = fs.readFileSync(file, 'utf8');
        const replaced = () => {
          if (fs.readFileSync(file, 'utf8').includes('replaced_ok')) return 'disk';
          const d = vscode.workspace.textDocuments.find((x) => sameFs(x.uri.fsPath, file));
          return d && d.getText().includes('replaced_ok') ? 'model' : null;
        };
        // replaceInFiles の引数は検索語に効かなかった（実機）。findInFiles の replace 引数で検索語と置換語を渡す
        const errs = [];
        const run = async (id, arg) => { try { await vscode.commands.executeCommand(id, arg); } catch (e) { errs.push(`${id}: ${e.message}`); } };
        await run('workbench.action.findInFiles', { query: 'replace_me', replace: 'replaced_ok', triggerSearch: true, isRegex: false });
        await sleep(5000); // 検索結果が出るのを待つ
        let where = null;
        for (let i = 0; i < 3 && !where; i++) {
          await run('search.action.focusSearchList');
          await run('search.action.focusNextSearchResult');
          await run('search.action.replace');
          where = await waitFor(replaced, 6000, 500);
        }
        await vscode.commands.executeCommand('workbench.action.closePanel').then(undefined, () => {});
        return where ? `検索ビューで1件置換できた（結果は${where === 'disk' ? 'ディスク' : '開いたモデル（未保存）'}に現れた）` : fail(`置換されない（変更前: ${JSON.stringify(before)}）${errs.length ? ` コマンドの誤り: ${errs.join(' | ')}` : ''}`);
      }, 90000);
    }

    // 問題パネル: 言語の診断が出そろった後に見る（languages の組を走らせないと診断が出ないので、そのときだけ）
    if (want('base') && want('languages')) {
      await check('base.problems', 'base', '問題パネルが開き、診断が集まっている', async () => {
        await vscode.commands.executeCommand('workbench.actions.view.problems');
        const all = vscode.languages.getDiagnostics();
        const total = all.reduce((n, [, d]) => n + d.length, 0);
        return total > 0 ? `診断 ${total} 件（${all.filter(([, d]) => d.length).length} ファイル）` : fail('診断が 0 件');
      });
    }

    // 2つめのウィンドウ: 開くだけ。ログに window2 ができたかは台本の側が見る（base.window2）
    if (want('base') && cfg.openSecondWindow) {
      result.secondWindowRequestedAt = new Date().toISOString();
      flush();
      await vscode.commands.executeCommand('workbench.action.newWindow');
    }
  } catch (e) {
    result.fatal = String((e && e.stack) || e);
  }

  try {
    result.extensions = snapshotExtensions();
    const cmds = await vscode.commands.getCommands(true);
    result.commandCount = cmds.length;
    if (cfg.commandsOut) fs.writeFileSync(cfg.commandsOut, JSON.stringify(cmds.sort(), null, 1), 'utf8');
    result.diagnosticsTotal = vscode.languages.getDiagnostics().reduce((n, [, d]) => n + d.length, 0);
  } catch (e) {
    result.snapshotError = String((e && e.message) || e);
  }
  result.finishedAt = new Date().toISOString();
  result.done = true;
  // 最後の書き出しは、読まれていても確実に残す
  for (let i = 0; i < 20; i++) {
    flush();
    try { if (JSON.parse(fs.readFileSync(cfg.out, 'utf8')).done) break; } catch { /* 書きかけ */ }
    await sleep(250);
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
