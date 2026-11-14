// 消えたことの確認用。AIED_ABSENT_CONFIG の JSON ({ out, settings: string[], settleMs }) を読み、
// 登録済みのコマンドと、指定された設定キーが登録されているかを out に書く。書いたら何もしない（終了は run-absent.mjs が外から行う）。
const vscode = require('vscode');
const fs = require('fs');

exports.activate = async function activate() {
  const cfgPath = process.env.AIED_ABSENT_CONFIG;
  if (!cfgPath) return;
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  // 起動直後は他の拡張が登録しきっていないので、少し待つ
  await new Promise((r) => setTimeout(r, cfg.settleMs ?? 5000));
  const snap = { startedAt: new Date().toISOString(), commands: [], settings: {}, extensions: [], errors: [] };
  try { snap.commands = (await vscode.commands.getCommands(true)).sort(); } catch (e) { snap.errors.push(`commands: ${e.message}`); }
  // inspect(key) は登録の無いキーでも、中身が全部 undefined のオブジェクトを返す（!== undefined は常に true になる）。
  // 登録の有無は、設定の登録簿が持つ既定値（defaultValue）で見る。登録されたキーは型に応じた既定値を必ず持つ。
  // 拡張の contributes.configuration は、起動していない拡張のものも extensions.all の packageJSON から見る。
  const manifestKeys = new Set();
  try {
    for (const x of vscode.extensions.all) {
      const conf = x.packageJSON?.contributes?.configuration;
      for (const c of Array.isArray(conf) ? conf : conf ? [conf] : []) for (const k of Object.keys(c?.properties ?? {})) manifestKeys.add(k);
    }
  } catch (e) { snap.errors.push(`manifest settings: ${e.message}`); }
  snap.settingsVia = {};
  for (const key of cfg.settings ?? []) {
    try {
      const ins = vscode.workspace.getConfiguration().inspect(key);
      const viaRegistry = ins !== undefined && ins !== null && ins.defaultValue !== undefined;
      const viaManifest = manifestKeys.has(key);
      snap.settings[key] = viaRegistry || viaManifest;
      snap.settingsVia[key] = viaRegistry && viaManifest ? 'registry+manifest' : viaRegistry ? 'registry' : viaManifest ? 'manifest' : 'none';
    } catch (e) { snap.errors.push(`setting ${key}: ${e.message}`); }
  }
  try { snap.extensions = vscode.extensions.all.map((x) => ({ id: x.id, active: x.isActive })); } catch (e) { snap.errors.push(`extensions: ${e.message}`); }
  snap.done = true;
  fs.writeFileSync(cfg.out, JSON.stringify(snap, null, 1), 'utf8');
};
exports.deactivate = function deactivate() {};
