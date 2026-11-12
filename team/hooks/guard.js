#!/usr/bin/env node
// 権限フック（allowlist.js）の起動役。スクリプトを読み込めないときに止める側へ倒す。
// 土台は E:\develop\self\Team の team/hooks/guard.js（起動してよいスクリプトを allowlist.js だけにした）。
//
// Claude Code は、フックの終了コードが 2 のときだけツールを止め、それ以外の失敗（node の
// MODULE_NOT_FOUND や構文エラーは exit 1）は素通しにする。そこで、スクリプトが無い・構文エラー・
// 読み込み中や実行中の想定外の例外を、すべて exit 2 に揃える。
//
// 使い方（.claude/settings.json から exec form で呼ぶ）:
//   "command": "node",
//   "args": ["${CLAUDE_PROJECT_DIR}/team/hooks/guard.js", "allowlist.js"],
//   "onFailure": "block"
// - 第1引数は、このファイルと同じディレクトリにある、起動してよいスクリプト名（TARGETS）に限る。
// - 残りの引数はそのままスクリプトへ渡す。process.argv は、スクリプトを直接
//   `node <スクリプト> <引数...>` で起動したときと同じ形に直してから require する。
// - この起動役そのものに node がたどり着けないとき（ファイルが無いなど）は、ここでは止められない。
//   それは Claude Code の "onFailure": "block" で止める。

const path = require("path");

const TARGETS = new Set(["allowlist.js"]);

function fail(message) {
  process.stderr.write(`[guard] ${message}（フックを実行できないため止めました）\n`);
  process.exit(2);
}

process.on("uncaughtException", (err) => fail(`想定外の例外: ${(err && err.message) || err}`));

const name = process.argv[2];
if (!TARGETS.has(name)) fail(`起動を許可していないスクリプトです: ${name}`);

const target = path.join(__dirname, name);
process.argv = [process.argv[0], target, ...process.argv.slice(3)];
try {
  require(target);
} catch (err) {
  fail(`${name} を読み込めません: ${(err && err.message) || err}`);
}
