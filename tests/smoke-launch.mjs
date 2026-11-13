// 手で確かめる項目（tasks/2026-11-13-p1-smoke/manual-checks.md）のために、自動のスモークと同じ環境でエディタを起動し、
// 手を離す。終わるときはユーザーがウィンドウを閉じる（台本は止めない）。
// 実行: node tests/smoke-launch.mjs [--build <dir>] [--label <名前>] [--mode upstream|built] [--locale ja|none] [--no-prime]
// 普段使いのデータ（%APPDATA%\Code、~\.vscode、~\.vscode-oss）には触れない。~/.claude は Claude Code の認証のために共有される。
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_BUILD, SMOKE_ROOT, cleanEditorEnv, listProcesses, removeOwnLocks, resolveEditor, resolveVsixRoot, snapshotLocks, stopTree, treeFromProcesses } from './smoke/lib/common.mjs';
import { buildUserSettings, defaultExtensionIds, findVsix, prepareExtensions, prepareRunDir, readLedger } from './smoke/lib/env.mjs';
import { createWorkspace } from './smoke/lib/fixtures.mjs';
import { REPO_ROOT } from './smoke/lib/run.mjs';

try {
  const a = process.argv.slice(2);
  const get = (k, d) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : d; };
  const build = get('build', DEFAULT_BUILD);
  const label = get('label', 'manual');
  const mode = get('mode', 'upstream');
  const locale = get('locale', 'ja');
  const editor = resolveEditor(build);
  if (!editor.portableOk) throw new Error('product.json に "target" がある（ポータブルにできない）。普段使いのデータを避けられないので止める');
  const ledger = readLedger(join(REPO_ROOT, 'extensions.lock.json'));
  const vsixRoot = resolveVsixRoot({ vsixRoot: get('vsix-root', null) }); // 既定 <buildRoot>\cache\vsix
  const vsix = defaultExtensionIds(ledger).map((id) => {
    const f = findVsix(id, ledger.find((e) => e.id.toLowerCase() === id.toLowerCase())?.version, vsixRoot);
    return { id, version: f.version, path: f.path };
  });
  const ext = prepareExtensions({ editor, vsix, profile: `${editor.version}-${label}`, log: console.log });
  const run = prepareRunDir({ label, mode, argv: locale === 'none' ? {} : { locale }, settings: buildUserSettings(mode, { 'security.workspace.trust.enabled': true }) });
  const ws = join(run.runDir, 'ws');
  createWorkspace(ws);
  const args = [ws, '--user-data-dir', run.userData, '--extensions-dir', ext.extDir, `--logsPath=${run.logs}`, '--skip-release-notes', '--skip-welcome', '--disable-updates'];
  const env = cleanEditorEnv(process.env, run.portable);
  // 新しいユーザーデータの初回の起動は、言語パックがまだ登録されておらず、表示が英語になる
  // （全7回の実行で uiLanguage が en。languagepacks.json は起動の後にできる）。
  // そこで、一度起動して languagepacks.json ができたら止め、起動し直してから手を離す。--no-prime で省ける。
  if (locale !== 'none' && !a.includes('--no-prime')) {
    console.log('日本語の表示のため、一度起動して言語パックが登録されるのを待つ（最大90秒）。このウィンドウは自動で閉じる。');
    const locksBefore = snapshotLocks(); // prime が作る ~/.claude/ide/*.lock を後で見分けるため
    const prime = spawn(editor.exe, args, { env, stdio: 'ignore' });
    const packs = join(run.userData, 'languagepacks.json');
    const end = Date.now() + 90000;
    while (Date.now() < end && !existsSync(packs)) await new Promise((r) => setTimeout(r, 1000));
    await new Promise((r) => setTimeout(r, 5000));
    const primePids = treeFromProcesses(listProcesses(), prime.pid).map((p) => Number(p.ProcessId));
    stopTree(prime.pid, editor.exe); // 起動した PID の木だけを止める
    await new Promise((r) => setTimeout(r, 4000));
    // 強制終了した prime の .lock は残る。smoke-run と同じ規則（起動の後に増え、pid が prime の木にあるか、開いたフォルダが一致）のものだけを消す
    const removed = removeOwnLocks(locksBefore, primePids, [ws]);
    console.log(existsSync(packs) ? '言語パックが登録された。起動し直す。' : '言語パックが登録されなかった（90秒）。そのまま起動する。');
    console.log(`prime が作った .lock を ${removed.length} 個消した（他の .lock には触れない）。`);
  }
  const child = spawn(editor.exe, args, { env, stdio: 'ignore', detached: true });
  child.unref();
  console.log(`起動した: PID ${child.pid}`);
  console.log(`相手: ${editor.exe}（${editor.version}）`);
  console.log(`置き場所: ${run.runDir}（${SMOKE_ROOT} の下。普段使いのデータとは別）`);
  console.log('手の確認が終わったら、エディタのウィンドウを閉じる。');
} catch (e) {
  console.error(`smoke-launch: ${e.message}`);
  process.exit(2);
}
