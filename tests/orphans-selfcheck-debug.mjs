// 自己検査の切り分け用(結果を tasks/…/orphans-selfcheck-debug.txt に書く)。c1-unit の自己検査と同じ手順。
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeFound, findOrphans, loadUnits, upstream } from './gate-orphans.mjs';
import { UPSTREAM_REPO } from './build/root.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const up = upstream(UPSTREAM_REPO, '1.146.0');
const out = [];
const dropReg = { path: 'src/vs/workbench/contrib/search/browser/search.contribution.ts', added: [], removed: ["'search.searchView.semanticSearchBehavior': {", "'search.searchView.keywordSuggestions': {"] };
const bare = loadUnits(REPO).map((u) => ({ ...u, sections: u.id === 'C-1-ai' ? [dropReg] : [] }));
const r = findOrphans({ up, units: bare, by: 'C-1-ai' });
out.push(`bare: services ${r.services.length} settings ${r.settings.length} commands ${r.commands.length}`);
for (const f of r.settings) out.push('  ' + describeFound(f));
const extra = (sections) => bare.map((u) => (u.id === 'C-1-ai' ? { ...u, sections: [...u.sections, ...sections] } : u));
const fixLine = (f) => ({ path: f.path, added: [], removed: [f.text] });
const svc = r.services.filter((f) => f.id === 'ITerminalChatService');
const n = (x, k, pred) => x[k].filter(pred).length;
out.push('行を消す: ' + n(findOrphans({ up, units: extra(svc.map(fixLine)), by: 'C-1-ai' }), 'services', (f) => f.id === 'ITerminalChatService'));
out.push('登録を足す: ' + n(findOrphans({ up, units: extra([{ path: 'src/vs/x.ts', added: ['registerSingleton(ITerminalChatService, NullTerminalChatService, InstantiationType.Delayed);'], removed: [] }]), by: 'C-1-ai' }), 'services', (f) => f.id === 'ITerminalChatService'));
out.push('定義を足す: ' + n(findOrphans({ up, units: extra([{ path: 'src/vs/x.ts', added: ["CommandsRegistry.registerCommand('_chat.editSessions.accept', () => { });"], removed: [] }]), by: 'C-1-ai' }), 'commands', (f) => f.id === '_chat.editSessions.accept'));
out.push('型の網: ' + n(findOrphans({ up, units: extra([{ path: 'src/vs/workbench/services/search/common/search.ts', added: ['\treadonly searchView?: { semanticSearchBehavior?: string };'], removed: [] }]), by: 'C-1-ai' }), 'settings', (f) => /searchView\.ts$/.test(f.path)));
const fixCmd = r.commands.filter((f) => f.id === '_chat.editSessions.accept').map(fixLine);
out.push('呼び手の行を消す: ' + n(findOrphans({ up, units: extra(fixCmd), by: 'C-1-ai' }), 'commands', (f) => f.id === '_chat.editSessions.accept'));
writeFileSync(join(REPO, 'tasks', '2026-11-16-p5-c1-product-keys', 'orphans-selfcheck-debug.txt'), out.join('\n') + '\n');
