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
  for (const key of cfg.settings ?? []) {
    try { snap.settings[key] = vscode.workspace.getConfiguration().inspect(key) !== undefined; } catch (e) { snap.errors.push(`setting ${key}: ${e.message}`); }
  }
  try { snap.extensions = vscode.extensions.all.map((x) => ({ id: x.id, active: x.isActive })); } catch (e) { snap.errors.push(`extensions: ${e.message}`); }
  snap.done = true;
  fs.writeFileSync(cfg.out, JSON.stringify(snap, null, 1), 'utf8');
};
exports.deactivate = function deactivate() {};
