// 提案中の API の門を、所(メンバー)ごとに本家と突き合わせる共通の部品(テストの部品。run-all は *.test.mjs だけを走らせるので、これ自体は走らない)。
// 提案の名前の集まりを比べるだけの検査では、同じ提案の名前が別の所に出てくると抜けが見えない(C-1 の 6回目で見つかった)。
// ここでは、本家の消す extHost のファイルから「メンバー(getter・setter・メソッドを区別する) -> その中の checkProposedApiEnabled の提案の名前」を読み、
// 何もしない実装の面(lm / chat / 参加者など)のメンバーを実際に触って、提案を有効にしていない拡張で門の誤りになること、
// 有効にした拡張で誤りにならないことを確かめる。期待は本家から読む(実装の一覧から写さない)。
import assert from 'node:assert/strict';

const MEMBER_START = /^\t{1,4}((?:(?:public|private|protected|static|async|readonly)\s+)*)(get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*(?:<[^>(]*>)?\(/;
const NOT_MEMBER = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'constructor', 'super', 'await', 'throw', 'typeof', 'new']);

/**
 * 本家のファイルの本文の配列 [{ path, text }] から、メンバー -> { name, kind, gates: Set, async: boolean } を読む。
 * キーは `name`（メソッド）・`get:name`・`set:name`。宣言の行(`;` で終わらない)だけをメンバーの始まりとみなし、
 * その後の checkProposedApiEnabled をそのメンバーのものとする。
 */
export function memberGatesOf(files) {
  const map = new Map();
  for (const { text } of files) {
    let cur = null;
    for (const line of text.split('\n')) {
      const m = MEMBER_START.exec(line);
      if (m && !NOT_MEMBER.has(m[3]) && !/;\s*$/.test(line) && !/^\t+(?:this|super)\./.test(line)) {
        const kind = m[2] ? m[2].trim() : 'method';
        cur = kind === 'method' ? m[3] : `${kind}:${m[3]}`;
        if (!map.has(cur)) map.set(cur, { name: m[3], kind, gates: new Set(), async: /\basync\b/.test(m[1]) });
        else if (/\basync\b/.test(m[1])) map.get(cur).async = true;
      }
      const g = /checkProposedApiEnabled\([^,()]+(?:\([^)]*\))?[^,()]*,\s*'(\w+)'\)/.exec(line);
      if (g && cur) map.get(cur).gates.add(g[1]);
    }
  }
  return map;
}

/** メンバーを触って、結果を 'ok' | 'throws:<メッセージ>' | 'rejects:<メッセージ>' で返す。 */
async function touch(obj, name, mode, args) {
  try {
    if (mode === 'set') { obj[name] = undefined; return 'ok'; }
    const v = obj[name];
    if (typeof v === 'function' && mode === 'call') {
      const r = v.apply(obj, args ?? [undefined, undefined, undefined]);
      if (r && typeof r.then === 'function') {
        try { await r; } catch (e) { return `rejects:${e.message}`; }
      }
    }
    return 'ok';
  } catch (e) { return `throws:${e.message}`; }
}

/**
 * map: memberGatesOf の結果。surfacesFor(提案の名前の配列) -> { 面の名前: オブジェクト }。
 * callArgs: { メンバー名: 引数の配列 }（門が引数によるメンバー用。例: invokeTool は情報オブジェクトを渡したときだけ門）。
 * skip: 比べないメンバー名。
 * 返り値: { checked: ['面.名前'], bad: [...], asyncBad: [...] }
 *   bad = 提案を有効にしていない拡張で門の誤りにならない / 有効にした拡張でも門の誤りになる
 *   asyncBad = 門の誤りの出方（本家が async なら reject、そうでなければ同期で投げる）が本家と違う
 */
export async function compareMemberGates({ map, surfacesFor, callArgs = {}, skip = [] }) {
  const plain = surfacesFor([]);
  const skipSet = new Set(['dispose', 'constructor', ...skip]);
  const checked = [];
  const bad = [];
  const asyncBad = [];
  for (const info of map.values()) {
    const name = info.name;
    if (skipSet.has(name) || info.gates.size === 0) continue;
    for (const [where, obj] of Object.entries(plain)) {
      if (obj === null || obj === undefined || !(name in obj)) continue;
      const desc = Object.getOwnPropertyDescriptor(obj, name);
      const isFn = typeof desc?.value === 'function';
      // 本家のメンバーの種類と、実装の形が合うものだけを突き合わせる
      let mode;
      if (info.kind === 'method') mode = isFn ? 'call' : (desc?.get ? 'get' : null);
      else if (info.kind === 'get') mode = desc?.get || (!isFn && desc && 'value' in desc) ? 'get' : null;
      else mode = desc?.set ? 'set' : null;
      if (!mode) continue;
      checked.push(`${where}.${info.kind === 'get' ? 'get ' : info.kind === 'set' ? 'set ' : ''}${name}`);
      const target = surfacesFor([...info.gates])[where];
      const got = await touch(obj, name, mode, callArgs[name]);
      const want = mode === 'call' && info.async ? 'rejects' : 'throws';
      if (!new RegExp(`^(throws|rejects):.*CANNOT use API proposal: (${[...info.gates].join('|')})`).test(got)) {
        bad.push(`${where}.${name} (${mode}): 提案を有効にしていない拡張で、門 ${[...info.gates].join('/')} の誤りにならない: ${got}`);
      } else if (mode === 'call' && !got.startsWith(want)) {
        asyncBad.push(`${where}.${name}: 本家は${info.async ? ' async（reject する）' : '同期（投げる）'}だが、${got.split(':')[0]}`);
      }
      const ok = await touch(target, name, mode, callArgs[name]);
      if (/CANNOT use API proposal/.test(ok)) bad.push(`${where}.${name} (${mode}): 提案を有効にした拡張でも門の誤りになる: ${ok}`);
    }
  }
  return { checked, bad, asyncBad };
}

export const expectChecked = (checked, must) => {
  for (const k of must) assert.ok(checked.includes(k), `${k} が本家と突き合わせられていない（読み方の退行）。突き合わせたもの: ${checked.join(', ')}`);
};
