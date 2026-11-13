// claude -p の起動（docs/06 の7.1、CLAUDE.md の狄仁傑の起動の注意、リーダーの判断 2026-11-14）。
// 引数の組み立て・子の環境変数・出力の読み取りは純粋な関数。runClaude だけが子のプロセスを起動する。
// 設計: tasks/2026-11-14-p3-take-in/take-in-design.md の5節。
//
// オプションの書き方は https://code.claude.com/docs/en/cli-reference と https://code.claude.com/docs/en/headless で確かめた（2026-11-14）:
//   -p / --output-format json / --json-schema（結果は structured_output）/ --agent / --add-dir / --tools / --allowedTools /
//   --disallowedTools / --permission-mode（default・acceptEdits・plan・auto・dontAsk・bypassPermissions）/ --strict-mcp-config /
//   --append-system-prompt-file / --no-session-persistence / --max-turns / --model / --setting-sources / --bare

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { VERDICT_SCHEMA } from "./verdict.mjs";

// 子に渡さない環境変数。
//   ANTHROPIC_API_KEY・ANTHROPIC_AUTH_TOKEN: API キーを使わない（チームの規約。ログインした CLI を使う）
//   CLAUDE_CODE_SIMPLE: --bare と同じになり、フックが読まれない（判定役の守りが効かなくなる）
//   CLAUDECODE・CLAUDE_CODE_ENTRYPOINT: Claude Code の中から台本を走らせたときに付く（入れ子の起動と見なされないため）
//   ELECTRON_RUN_AS_NODE・ELECTRON_NO_ATTACH_CONSOLE・VSCODE_*: build.mjs の childEnv と同じ（エディタの統合ターミナルから走らせたとき）
export const CLAUDE_ENV_DROP = Object.freeze(["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_SIMPLE", "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"]);

export function claudeChildEnv(base = process.env) {
  const env = {};
  const removed = [];
  const drop = new Set(CLAUDE_ENV_DROP.map((k) => k.toUpperCase()));
  for (const [k, v] of Object.entries(base || {})) {
    const K = k.toUpperCase();
    if (drop.has(K) || /^(ELECTRON_RUN_AS_NODE|ELECTRON_NO_ATTACH_CONSOLE)$/.test(K) || /^VSCODE_/.test(K)) removed.push(k);
    else env[k] = v;
  }
  return { env, removed: removed.sort() };
}

// 修理の構造化出力の schema。
export const REPAIR_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["status", "summary", "fixes", "needsJudgment"],
  properties: {
    status: { type: "string", enum: ["fixed", "partial", "gave-up"] },
    summary: { type: "string", description: "直したことの要約（日本語）" },
    fixes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["file", "owner", "why"],
        properties: {
          file: { type: "string", description: "直したファイル（作業ツリーかビルドリポジトリからの相対パス）" },
          owner: { type: "string", description: "unit:<単位の ID> か patch:<パッチのファイル名> か unknown" },
          why: { type: "string" },
        },
      },
    },
    needsJudgment: { type: "array", items: { type: "string" }, description: "意図を変えないと直せない点（要判断）" },
  },
});

export const PROBE_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["ok", "agent"],
  properties: { ok: { type: "boolean" }, agent: { type: "string" } },
});

// claude -p の起動の形を組み立てる。返り値 { cmd, args, cwd, env, input, envRemoved, kind }。
//   kind 'verdict': 判定。cwd はビルドリポジトリの直下、--agent di-renjie、--bare なし、--setting-sources なし（project を外さない）。
//   kind 'repair':  修理。cwd は本家の作業ツリー、ビルドリポジトリを --add-dir。Bash を渡さない（git diff と status は台本が依頼文に入れる）。
//   kind 'probe':   試し（take-in.mjs probe-claude）。判定と同じ形で、schema と依頼文だけ違う。
// prompt は短い依頼文（引数で渡す）。input は標準入力で渡す本文（修理の依頼。長いので引数にしない）。
export function buildClaudeInvocation({
  kind,
  repoRoot,
  worktree,
  builderWorktree = null,
  env = process.env,
  prompt,
  input = null,
  claudePath = "claude",
  schema = null,
  model = null,
  maxTurns = null,
  rulesFile = null,
} = {}) {
  if (!["verdict", "repair", "probe"].includes(kind)) throw new Error(`kind が verdict・repair・probe のどれでもない: ${kind}`);
  if (!repoRoot) throw new Error("repoRoot が無い");
  if (typeof prompt !== "string" || !prompt) throw new Error("prompt が無い");
  const { env: childEnvironment, removed } = claudeChildEnv(env);
  const args = ["-p", "--output-format", "json"];
  let cwd;
  if (kind === "verdict" || kind === "probe") {
    cwd = path.resolve(repoRoot);
    args.push("--agent", "di-renjie");
    args.push("--json-schema", JSON.stringify(schema || (kind === "probe" ? PROBE_SCHEMA : VERDICT_SCHEMA)));
    args.push("--permission-mode", "dontAsk");
    args.push("--strict-mcp-config");
    args.push("--no-session-persistence");
    args.push("--max-turns", String(maxTurns || (kind === "probe" ? 5 : 60)));
  } else {
    if (!worktree) throw new Error("修理には worktree（本家の作業ツリー）が要る");
    cwd = path.resolve(worktree);
    args.push("--json-schema", JSON.stringify(schema || REPAIR_SCHEMA));
    args.push("--tools", "Read,Glob,Grep,Edit,Write");
    args.push("--permission-mode", "acceptEdits");
    args.push("--strict-mcp-config");
    args.push("--disallowedTools", "mcp__*");
    args.push("--add-dir", path.resolve(builderWorktree || repoRoot));
    args.push("--append-system-prompt-file", path.resolve(rulesFile || path.join(builderWorktree || repoRoot, "TAKE-IN.md")));
    args.push("--no-session-persistence");
    args.push("--max-turns", String(maxTurns || 80));
  }
  if (model) args.push("--model", model);
  args.push(prompt);
  const c = claudeCommandOf(claudePath);
  return { kind, cmd: c.cmd, args: [...c.prefixArgs, ...args], cwd, env: childEnvironment, input, envRemoved: removed };
}

// 記録に残す形（JSON の schema と依頼文は長いので縮める。env は名前も書かない）。
export function describeInvocation(inv) {
  const args = inv.args.map((a, i) => (inv.args[i - 1] === "--json-schema" ? `<schema ${a.length} 文字>` : a));
  return { kind: inv.kind, cmd: inv.cmd, args, cwd: inv.cwd, envRemoved: inv.envRemoved, stdinChars: inv.input ? inv.input.length : 0 };
}

// --output-format json の出力（1つの JSON）を読む。
export function parseClaudeOutput(text) {
  const t = String(text || "").trim();
  if (!t) return { ok: false, error: "出力が空" };
  let o;
  try {
    o = JSON.parse(t);
  } catch {
    // 前に警告の行が混ざったときのため、最後の行を試す
    const last = t.split(/\r?\n/).filter(Boolean).pop();
    try {
      o = JSON.parse(last);
    } catch (err) {
      return { ok: false, error: `JSON として読めない: ${err.message}` };
    }
  }
  if (Array.isArray(o)) o = o.filter((x) => x && x.type === "result").pop() || o[o.length - 1];
  const out = {
    ok: false,
    structured: o && o.structured_output !== undefined ? o.structured_output : null,
    result: o && typeof o.result === "string" ? o.result : null,
    isError: !!(o && o.is_error),
    subtype: (o && o.subtype) || null,
    sessionId: (o && o.session_id) || null,
    costUsd: o && typeof o.total_cost_usd === "number" ? o.total_cost_usd : null,
    numTurns: (o && o.num_turns) || null,
    error: null,
  };
  if (out.isError) out.error = out.result || out.subtype || "is_error";
  else if (out.structured === null || out.structured === undefined) out.error = "structured_output が無い";
  else out.ok = true;
  return out;
}

// claude の実行ファイルの候補: PATH（where.exe）と、公式のインストーラーの置き場所（%USERPROFILE%\.local\bin\claude.exe。
// https://code.claude.com/docs/en/setup）。返り値は候補の配列（見つかった順）。
export function claudeCandidates(env = process.env, { exists = fs.existsSync } = {}) {
  const out = [];
  const r = spawnSync("where.exe", ["claude"], { encoding: "utf8", env, windowsHide: true });
  if (r.status === 0) out.push(...r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
  const home = env.USERPROFILE || env.HOME;
  if (home) {
    const p = path.join(home, ".local", "bin", "claude.exe");
    if (exists(p) && !out.some((x) => x.toLowerCase() === p.toLowerCase())) out.push(p);
  }
  return out;
}

// npm の .cmd の包み（shim）の中身から、実際に走らせるもの（.exe か、node で走らせる .js）を取り出す。
// cmd.exe を通すと JSON の schema などの引数の引用が崩れるので、.cmd を直接は起動しない。
// 返り値 { cmd, prefixArgs } か null。cmdDir は .cmd のあるフォルダ（%dp0% の中身）。
export function parseCmdShim(text, cmdDir, nodePath = process.execPath) {
  const t = String(text || "");
  const hits = [...t.matchAll(/%~?dp0%?\\?([^"%\r\n]+?\.(exe|js|cjs|mjs))"/gi)].map((m) => ({ rel: m[1].replace(/^\\/, ""), ext: m[2].toLowerCase() }));
  const exe = hits.find((h) => h.ext === "exe" && !/\\node\.exe$/i.test(h.rel) && !/^node\.exe$/i.test(h.rel));
  if (exe) return { cmd: path.join(cmdDir, exe.rel), prefixArgs: [] };
  const js = hits.find((h) => h.ext !== "exe");
  if (js) return { cmd: nodePath, prefixArgs: [path.join(cmdDir, js.rel)] };
  return null;
}

// 起動に使うもの。.exe があればそれ、無ければ npm の .cmd の中身を読んで決める。返り値 { cmd, prefixArgs, via } か null。
export function resolveClaudeCommand(candidates, { read = (p) => fs.readFileSync(p, "utf8"), exists = fs.existsSync } = {}) {
  const list = Array.isArray(candidates) ? candidates : [];
  const exe = list.find((p) => /\.exe$/i.test(p));
  if (exe) return { cmd: exe, prefixArgs: [], via: exe };
  for (const c of list.filter((p) => /\.cmd$/i.test(p))) {
    let text;
    try {
      text = read(c);
    } catch {
      continue;
    }
    const r = parseCmdShim(text, path.dirname(c));
    if (r && exists(r.cmd) && (!r.prefixArgs.length || exists(r.prefixArgs[0]))) return { ...r, via: c };
  }
  return null;
}

// 起動に使う claude（後方互換。.exe のパスか null）。
export function findClaude(env = process.env) {
  const r = resolveClaudeCommand(claudeCandidates(env));
  return r ? r : null;
}

// claudePath は文字列（実行ファイル）か { cmd, prefixArgs }（resolveClaudeCommand の返り値）。
export function claudeCommandOf(claudePath) {
  if (claudePath && typeof claudePath === "object") return { cmd: claudePath.cmd, prefixArgs: Array.isArray(claudePath.prefixArgs) ? claudePath.prefixArgs : [] };
  return { cmd: claudePath || "claude", prefixArgs: [] };
}

export function claudeVersion(claudePath, env = process.env) {
  const c = claudeCommandOf(claudePath);
  const r = spawnSync(c.cmd, [...c.prefixArgs, "--version"], { encoding: "utf8", env: claudeChildEnv(env).env, windowsHide: true, timeout: 60000 });
  if (r.error || r.status !== 0) return { ok: false, error: r.error ? r.error.message : (r.stderr || "").trim() };
  const m = /(\d+\.\d+\.\d+)/.exec(r.stdout || "");
  return { ok: true, version: m ? m[1] : null, raw: (r.stdout || "").trim() };
}

// 起動する。.cmd は shell が要り、引数の引用が崩れるので扱わない（.exe だけ）。
export function runClaude(inv, { timeoutMs = 60 * 60 * 1000 } = {}) {
  return new Promise((resolve) => {
    if (/\.(cmd|bat)$/i.test(inv.cmd)) {
      resolve({ exitCode: null, stdout: "", stderr: `${inv.cmd} は .cmd。claude.exe を --claude で渡す`, seconds: 0 });
      return;
    }
    const t0 = Date.now();
    const child = spawn(inv.cmd, inv.args, { cwd: inv.cwd, env: inv.env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on("data", (c) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c) => (stderr += c.toString("utf8")));
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ exitCode: null, stdout, stderr: `${stderr}\n${err.message}`, seconds: (Date.now() - t0) / 1000 });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code, stdout, stderr, seconds: (Date.now() - t0) / 1000 });
    });
    if (inv.input) child.stdin.write(inv.input);
    child.stdin.end();
  });
}
