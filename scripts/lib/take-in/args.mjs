// take-in.mjs の引数とラベル・ブランチの名前。純粋な関数だけ。読み込んでも何も走らない。
// 設計: tasks/2026-11-14-p3-take-in/take-in-design.md の2節。

import { selectCoreSteps } from "./steps.mjs";

export class ArgError extends Error {}

export const USAGE = `使い方:
  node scripts/take-in.mjs core <tag> [--label <label>] [--commit <sha>] [--prev-tag <tag>] [--from <手順>] [--to <手順>]
       [--net-env <dir>] [--net-previous <path>] [--net-duration <秒>] [--smoke-baseline <json>] [--repair-model <model>]
       [共通のオプション]
  node scripts/take-in.mjs ext <id> [<version>] [--security] [--now <ISO 8601>] [共通のオプション]
  node scripts/take-in.mjs probe-claude [--claude <path>] [--out <dir>]
共通のオプション:
  --dry-run  --config <local.json>  --build-root <dir>  --install-root <dir>  --claude <path>
  --no-repair  --max-repair <n>  --skip-judge  --no-writeback  --watch-state <path>
試しのためのオプション（build.mjs の --take-in-dir と同じ考え。判定役はビルドリポジトリの外を読めないので、判定まで走らせるときは使わない）:
  --records-dir <dir>  記録の置き場所（既定 records/take-in/<label>）
  --builder-worktree <dir>  取り込みのブランチの作業ツリー（既定 <buildRoot>\\take-in\\<label>\\repo。渡したときは作らない）
  --editor-dir <dir>  手順 6・7 で試すエディタ（既定 展開した版のフォルダ、無ければ gulp の出力）
  --net-env <dir>  通信の監査の環境を作らずにこれを使う（既定は新しい版の CLI と台帳で作る。docs/06 の9節）
手順（core）: prepare(1) apply(2) repair(3) checks(4) build(5) smoke(6) netaudit(7) judge(9) record(10)
設計: tasks/2026-11-14-p3-take-in/take-in-design.md`;

const LABEL_RE = /^[0-9A-Za-z][0-9A-Za-z._-]*$/;
const TAG_RE = /^\d+\.\d+\.\d+$/;
const EXT_ID_RE = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9.-]*$/i;
const VERSION_RE = /^\d+\.\d+\.\d+([-.+][0-9A-Za-z.-]+)?$/;

export function extLabel(id, version) {
  return `ext-${String(id).toLowerCase()}-${version}`;
}

export function branchFor(label) {
  if (!LABEL_RE.test(String(label))) throw new ArgError(`ラベルの形が違う: ${label}`);
  return `take-in/${label}`;
}

export function parseTakeInArgs(argv) {
  const a = {
    command: null, tag: null, id: null, version: null,
    dryRun: false, label: null, config: null, buildRoot: null, installRoot: null, claude: null,
    noRepair: false, maxRepair: 3, skipJudge: false, noWriteback: false, watchState: null,
    commit: null, prevTag: null, from: null, to: null, netEnv: null, netPrevious: null, netDuration: 600,
    smokeBaseline: null, repairModel: null, security: false, now: null, out: null,
    builderWorktree: null, recordsDir: null, editorDir: null,
  };
  const args = Array.isArray(argv) ? [...argv] : [];
  const cmd = args.shift();
  if (!cmd) throw new ArgError("サブコマンドが無い（core・ext・probe-claude）");
  if (!["core", "ext", "probe-claude"].includes(cmd)) throw new ArgError(`知らないサブコマンド: ${cmd}（core・ext・probe-claude）`);
  a.command = cmd;
  const pos = [];
  const need = (i, name) => {
    if (i >= args.length || String(args[i]).startsWith("--")) throw new ArgError(`${name} に値が無い`);
    return args[i];
  };
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    switch (x) {
      case "--dry-run": a.dryRun = true; break;
      case "--label": a.label = need(++i, x); break;
      case "--config": a.config = need(++i, x); break;
      case "--build-root": a.buildRoot = need(++i, x); break;
      case "--install-root": a.installRoot = need(++i, x); break;
      case "--claude": a.claude = need(++i, x); break;
      case "--no-repair": a.noRepair = true; break;
      case "--max-repair": {
        const n = Number(need(++i, x));
        if (!Number.isInteger(n) || n < 1 || n > 10) throw new ArgError(`--max-repair は 1〜10 の整数: ${args[i]}`);
        a.maxRepair = n;
        break;
      }
      case "--skip-judge": a.skipJudge = true; break;
      case "--no-writeback": a.noWriteback = true; break;
      case "--watch-state": a.watchState = need(++i, x); break;
      case "--commit": a.commit = need(++i, x); break;
      case "--prev-tag": a.prevTag = need(++i, x); break;
      case "--from": a.from = need(++i, x); break;
      case "--to": a.to = need(++i, x); break;
      case "--net-env": a.netEnv = need(++i, x); break;
      case "--net-previous": a.netPrevious = need(++i, x); break;
      case "--net-duration": {
        const n = Number(need(++i, x));
        if (!Number.isInteger(n) || n < 10) throw new ArgError(`--net-duration は 10 以上の整数: ${args[i]}`);
        a.netDuration = n;
        break;
      }
      case "--smoke-baseline": a.smokeBaseline = need(++i, x); break;
      case "--repair-model": a.repairModel = need(++i, x); break;
      case "--security": a.security = true; break;
      case "--now": a.now = need(++i, x); break;
      case "--out": a.out = need(++i, x); break;
      case "--builder-worktree": a.builderWorktree = need(++i, x); break;
      case "--records-dir": a.recordsDir = need(++i, x); break;
      case "--editor-dir": a.editorDir = need(++i, x); break;
      default:
        if (String(x).startsWith("--")) throw new ArgError(`知らない引数: ${x}`);
        pos.push(x);
    }
  }
  const coreOnly = ["commit", "prevTag", "from", "to", "netEnv", "netPrevious", "smokeBaseline", "repairModel"];
  const extOnly = ["now"];
  if (cmd === "core") {
    if (pos.length !== 1) throw new ArgError(pos.length ? `core の引数が多い: ${pos.join(" ")}` : "core にタグが無い（node scripts/take-in.mjs core <tag>）");
    a.tag = pos[0];
    if (!TAG_RE.test(a.tag)) throw new ArgError(`タグの形が違う（例 1.147.0）: ${a.tag}`);
    if (a.prevTag && !TAG_RE.test(a.prevTag)) throw new ArgError(`--prev-tag の形が違う: ${a.prevTag}`);
    if (a.commit && !/^[0-9a-f]{40}$/i.test(a.commit)) throw new ArgError(`--commit は 40 桁の SHA: ${a.commit}`);
    if (a.security) throw new ArgError("--security は ext だけ");
    for (const k of extOnly) if (a[k] !== null) throw new ArgError(`--${k} は ext だけ`);
    try {
      selectCoreSteps(a.from, a.to);
    } catch (err) {
      throw new ArgError(err.message);
    }
  } else if (cmd === "ext") {
    if (pos.length < 1) throw new ArgError("ext に拡張の ID が無い（node scripts/take-in.mjs ext <id> [<version>]）");
    if (pos.length > 2) throw new ArgError(`ext の引数が多い: ${pos.join(" ")}`);
    a.id = pos[0].toLowerCase();
    if (!EXT_ID_RE.test(a.id)) throw new ArgError(`拡張の ID の形が違う（例 anthropic.claude-code）: ${pos[0]}`);
    a.version = pos[1] || null;
    if (a.version && !VERSION_RE.test(a.version)) throw new ArgError(`版の形が違う: ${a.version}`);
    for (const k of coreOnly) if (a[k] !== null) throw new ArgError(`--${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} は core だけ`);
  } else {
    if (pos.length) throw new ArgError(`probe-claude に引数は要らない: ${pos.join(" ")}`);
  }
  if (a.label !== null && !LABEL_RE.test(a.label)) throw new ArgError(`ラベルの形が違う: ${a.label}`);
  if (a.command === "ext" && a.label && a.version && a.label !== extLabel(a.id, a.version)) {
    throw new ArgError(`ext のラベルは ${extLabel(a.id, a.version)} にする（--label を省く）`);
  }
  return a;
}
