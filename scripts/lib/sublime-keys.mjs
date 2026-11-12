// Sublime Text のキー割り当て（ms-vscode.sublime-keybindings）を mydist 用に変換する純粋な関数（docs/04 の6.2）。
//
// 約束（曹参のテストと共有。名前と形を変えない）:
//   convertKeybindings(sublimeKeybindings) -> 変換した keybindings の配列
//   findConflicts(a, b)                    -> [{ key, a, b }]
//
// 変換の規則（docs/04 の6.2）:
//   - Windows 向けのキー: `win` があればそれ、無ければ `key`。どちらも無い項目と、選んだキーが `none` の項目は落とす。
//   - 出力は `key`・`command` と、元にあれば `when`・`args`。`mac`・`linux`・`win` は持たない（Windows 専用のため）。
//     `args` は docs/04 の6.2 に書かれていないが、無いとコマンドの意味が変わるので残す。
//   - 消した機能（デバッグなど）のコマンドを指す項目は落とす。落とした項目と理由は convertKeybindingsDetailed で取れる。
//   - 知らない修飾キーを含むキー（例 `ctr+shift+[`）の項目は落とす（理由 `invalid-key`。2026-11-13 リーダーの決定）。
//   - 項目の順と重複はそのまま（並べ替えも重複の除去もしない）。

/**
 * 消す機能のコマンドの判定（docs/03 の4節の単位に対応）。
 * 先頭の `-`（割り当ての取り消し）は外して判定する。大文字小文字は区別する（`/i` は付けない）。
 */
export const REMOVED_COMMAND_RULES = [
  { unit: 'C-1-ai', test: /(^|\.)(chat|inlineChat|quickchat|mcp|copilot|languageModels?)(\.|$)/ },
  { unit: 'C-1-ai', test: /^workbench\.action\.(chat|quickchat|openChat|toggleChat)/i },
  { unit: 'C-2-debug', test: /(^|\.)debug(\.|$)/ },
  { unit: 'C-2-debug', test: /^editor\.action\.debug|Breakpoint/ },
  { unit: 'C-3-remote', test: /(^|\.)(remote|remoteHub|remoteTunnel|tunnel)(\.|$)/ },
  { unit: 'C-4-notebook', test: /(^|\.)(notebook|interactive|jupyter)(\.|$)/ },
  { unit: 'C-5-extension-gallery', test: /^workbench\.extensions\.(action\.)?(installExtensions?|showRecommendedExtensions|showPopularExtensions|search)/ },
  { unit: 'C-6-settings-sync', test: /(^|\.)userDataSync(\.|$)/ },
  { unit: 'C-7-breadcrumbs-outline', test: /breadcrumbs/i },
  { unit: 'B-4-outline-view', test: /^outline\.|^workbench\.action\.(focus|toggle)Outline/ },
  { unit: 'B-5-theme-switching', test: /^workbench\.action\.(selectTheme|selectIconTheme|selectProductIconTheme|toggleLightDarkThemes|browseColorThemesInMarketplace)$/ },
  { unit: 'B-2-onboarding-experiments-surveys', test: /^workbench\.action\.(openWalkthrough|showWelcomePage|showInteractivePlayground)$|^welcome\./ },
  { unit: 'B-3-issue-share', test: /^workbench\.action\.(openIssueReporter|reportIssue|share)/ },
];

/** コマンドが消す機能を指すなら、その単位の名前を返す。指さなければ null。 */
export function removedUnitOf(command, rules = REMOVED_COMMAND_RULES) {
  if (typeof command !== 'string' || command === '') return null;
  const c = command.startsWith('-') ? command.slice(1) : command;
  for (const r of rules) {
    if (r.test.test(c)) return r.unit;
  }
  return null;
}

/**
 * 1項目の Windows 向けの見え方（`win` があればそれ、無ければ `key`）。キーが無ければ null。
 * 選んだキーが `none`（元の 4.1.10 で「この OS には割り当てない」の意味で使われている）のときも null。
 * `win` が `none` なら `key` には戻らない。
 */
export function toWindowsKeybinding(item) {
  if (!item || typeof item !== 'object') return null;
  const key = typeof item.win === 'string' && item.win.trim() !== '' ? item.win
    : (typeof item.key === 'string' && item.key.trim() !== '' ? item.key : null);
  if (key === null || key.trim().toLowerCase() === 'none') return null;
  const out = { key, command: item.command };
  if (item.when !== undefined) out.when = item.when;
  if (item.args !== undefined) out.args = item.args;
  return out;
}

/**
 * 変換して、落とした項目も返す。
 * @param {object[]} sublimeKeybindings 元の contributes.keybindings
 * @param {{ removedCommandRules?: { unit: string, test: RegExp }[] }} [options]
 * @returns {{ keybindings: object[], dropped: { item: object, reason: 'no-command'|'no-windows-key'|'invalid-key'|'removed-feature', unit?: string, unknown?: string[] }[] }}
 */
export function convertKeybindingsDetailed(sublimeKeybindings, options = {}) {
  const rules = options.removedCommandRules ?? REMOVED_COMMAND_RULES;
  if (!Array.isArray(sublimeKeybindings)) throw new TypeError('keybindings は配列で渡す');
  const keybindings = [];
  const dropped = [];
  for (const item of sublimeKeybindings) {
    if (!item || typeof item !== 'object' || typeof item.command !== 'string' || item.command === '') {
      dropped.push({ item, reason: 'no-command' });
      continue;
    }
    const kb = toWindowsKeybinding(item);
    if (kb === null) {
      dropped.push({ item, reason: 'no-windows-key' });
      continue;
    }
    const unknown = unknownModifiersOf(kb.key);
    if (unknown.length > 0) {
      // 元の書き誤り（4.1.10 の `ctr+shift+[`）。直さずに落とす（2026-11-13 リーダーの決定）
      dropped.push({ item, reason: 'invalid-key', unknown });
      continue;
    }
    const unit = removedUnitOf(item.command, rules);
    if (unit !== null) {
      dropped.push({ item, reason: 'removed-feature', unit });
      continue;
    }
    keybindings.push(kb);
  }
  return { keybindings, dropped };
}

/** 約束の関数。変換した keybindings の配列を返す。 */
export function convertKeybindings(sublimeKeybindings, options = {}) {
  return convertKeybindingsDetailed(sublimeKeybindings, options).keybindings;
}

const MODIFIER_ORDER = ['ctrl', 'shift', 'alt', 'meta'];
const MODIFIER_ALIASES = { ctrl: 'ctrl', control: 'ctrl', shift: 'shift', alt: 'alt', option: 'alt', meta: 'meta', cmd: 'meta', win: 'meta', super: 'meta' };

function normalizeChord(chord) {
  let s = chord.toLowerCase().trim();
  if (s === '+') return '+';
  let key;
  // 「+」そのものをキーにする書き方（例 `ctrl++`）
  if (s.endsWith('++')) {
    key = '+';
    s = s.slice(0, -2);
  }
  const parts = s.split('+').map((p) => p.trim()).filter((p) => p !== '');
  if (key === undefined) key = parts.pop() ?? '';
  const mods = new Set(parts.map((p) => MODIFIER_ALIASES[p] ?? p));
  const known = MODIFIER_ORDER.filter((m) => mods.has(m));
  const unknown = [...mods].filter((m) => !MODIFIER_ORDER.includes(m)).sort();
  return [...known, ...unknown, key].join('+');
}

/** キーの文字列を正規化する（小文字、修飾キーの順を ctrl・shift・alt・meta に、和音は空白1つで区切る）。 */
export function normalizeKey(key) {
  if (typeof key !== 'string') return '';
  return key.trim().split(/\s+/).filter((c) => c !== '').map(normalizeChord).join(' ');
}

/**
 * 知らない修飾キーの名前（例 元の 4.1.10 にある `ctr+shift+[` の `ctr`）を返す。無ければ空の配列。
 * convertKeybindingsDetailed は、これが空でない項目を `invalid-key` として落とす。
 */
export function unknownModifiersOf(key) {
  const n = normalizeKey(key);
  const out = [];
  for (const chord of n.split(' ')) {
    const parts = chord === '+' ? [] : chord.endsWith('++') ? chord.slice(0, -2).split('+') : chord.split('+').slice(0, -1);
    for (const p of parts) if (p !== '' && !MODIFIER_ORDER.includes(p)) out.push(p);
  }
  return out;
}

/** `when` の正規化（前後の空白を落とし、連続する空白を1つに）。無いものは空文字。 */
export function normalizeWhen(when) {
  if (when === undefined || when === null) return '';
  return String(when).trim().replace(/\s+/g, ' ');
}

/**
 * 衝突の一覧。同じキー（正規化したもの）で、`when` が両方とも無いか同じもの。
 * a・b の各要素は VS Code の keybindings の形（`key` を見る。Windows 向けに変換済みのものを渡す）。
 * 並びは a の順、同じ a の中では b の順。
 * @returns {{ key: string, a: object, b: object }[]} `key` は正規化したキー
 */
export function findConflicts(a, b) {
  return pairsBySameKey(a, b).filter(({ a: x, b: y }) => normalizeWhen(x.when) === normalizeWhen(y.when));
}

/**
 * 参考: 同じキーで `when` が違うもの（約束の「衝突」ではないが、条件しだいで重なりうる）。
 * @returns {{ key: string, a: object, b: object }[]}
 */
export function findSameKeyDifferentWhen(a, b) {
  return pairsBySameKey(a, b).filter(({ a: x, b: y }) => normalizeWhen(x.when) !== normalizeWhen(y.when));
}

function pairsBySameKey(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) throw new TypeError('a と b は配列で渡す');
  const index = new Map();
  for (const y of b) {
    if (!y || typeof y.key !== 'string') continue;
    const k = normalizeKey(y.key);
    if (!index.has(k)) index.set(k, []);
    index.get(k).push(y);
  }
  const pairs = [];
  for (const x of a) {
    if (!x || typeof x.key !== 'string') continue;
    const k = normalizeKey(x.key);
    for (const y of index.get(k) ?? []) pairs.push({ key: k, a: x, b: y });
  }
  return pairs;
}
