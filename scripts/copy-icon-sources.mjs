// アイコンの元の絵（VS Code の公式のアイコンと Claude の印）を、リポジトリの中の scripts/icon-src/ へ写す。
// Node.js の標準の部品だけを使う。写したファイルと、写した元の場所・SHA-256 を scripts/icon-src/SOURCES.json に書く。
//
// 元の絵（2026-11-17。tasks/2026-11-17-icon/brief.md）:
//   VS Code: 公式の 1.146.0 の展開 <buildRoot>\official\vscode-1.146.0\69047191fc\resources\app\out\media\code-icon.svg
//   Claude : Claude Code 拡張 2.1.322 の VSIX（<buildRoot>\cache\vsix\anthropic.claude-code-2.1.322@win32-x64\
//            Anthropic.claude-code-2.1.322@win32-x64.vsix）の中の extension/resources/claude-logo.svg
//            （入れた拡張の resources\claude-logo.svg と同じ版の同じファイル。VSIX は同じフォルダの .sha256 と照合する）
//
// 使い方:
//   node scripts/copy-icon-sources.mjs [--build-root <dir>]
//     --build-root の既定は local.json（%LOCALAPPDATA%\Shuko\local.json）の buildRoot（無ければ <リポジトリ>\tmp\b）。
//   make-icons.mjs はこの写しだけを読む（ビルドのたびに tmp\b や拡張のフォルダを読まない）。
//   写しの置き場所が assets/ の外なのは、apply.mjs が assets/ の下を作業ツリーへ写すため。

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEntry } from "./lib/zip-read.mjs";
import { resolveLocalConfig } from "./lib/local-config.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ICON_SRC_DIR = path.join(REPO, "scripts", "icon-src");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const defaultBuildRoot = () => resolveLocalConfig().buildRoot;

// 表示用: リポジトリの下ならリポジトリからの相対パス（/ 区切り）
function shown(p) {
  const rel = path.relative(REPO, p);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel.split(path.sep).join("/") : p;
}

function main(argv) {
  let buildRoot = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--build-root" && argv[i + 1]) buildRoot = path.resolve(argv[++i]);
    else {
      console.error(`知らない引数: ${argv[i]}\n使い方: node scripts/copy-icon-sources.mjs [--build-root <dir>]`);
      return 2;
    }
  }
  buildRoot ??= defaultBuildRoot();

  const vscodeSvg = path.join(buildRoot, "official", "vscode-1.146.0", "69047191fc", "resources", "app", "out", "media", "code-icon.svg");
  const vsixDir = path.join(buildRoot, "cache", "vsix", "anthropic.claude-code-2.1.322@win32-x64");
  const vsix = path.join(vsixDir, "Anthropic.claude-code-2.1.322@win32-x64.vsix");
  const vsixSha = path.join(vsixDir, "Anthropic.claude-code-2.1.322@win32-x64.sha256");
  const entry = "extension/resources/claude-logo.svg";

  for (const f of [vscodeSvg, vsix, vsixSha]) {
    if (!existsSync(f)) {
      console.error(`[copy-icon-sources] 元の絵が無い: ${f}`);
      return 1;
    }
  }
  const vsixBuf = readFileSync(vsix);
  const vsixActual = sha256(vsixBuf);
  const vsixPublished = readFileSync(vsixSha, "utf8").trim().split(/\s+/)[0].toLowerCase();
  if (vsixActual !== vsixPublished) {
    console.error(`[copy-icon-sources] VSIX の SHA-256 が .sha256 と違う: 実際 ${vsixActual} 公開 ${vsixPublished}`);
    return 1;
  }
  const claude = readEntry(vsixBuf, entry);
  if (!claude) {
    console.error(`[copy-icon-sources] VSIX に ${entry} が無い`);
    return 1;
  }
  const vscode = readFileSync(vscodeSvg);

  mkdirSync(ICON_SRC_DIR, { recursive: true });
  writeFileSync(path.join(ICON_SRC_DIR, "vscode-code-icon.svg"), vscode);
  writeFileSync(path.join(ICON_SRC_DIR, "claude-logo.svg"), claude);
  const sources = {
    note: "アイコンの元の絵の写し。scripts/copy-icon-sources.mjs が書く。make-icons.mjs はこの写しだけを読む",
    files: [
      {
        file: "scripts/icon-src/vscode-code-icon.svg",
        sha256: sha256(vscode),
        from: shown(vscodeSvg),
        what: "VS Code 1.146.0（公式の Windows 版の展開）のタイトルバーのアイコン",
      },
      {
        file: "scripts/icon-src/claude-logo.svg",
        sha256: sha256(claude),
        from: `${shown(vsix)}!/${entry}`,
        fromSha256: vsixActual,
        what: "Claude Code 拡張 2.1.322（Open VSX の win32-x64 の VSIX）の Claude の印",
      },
    ],
  };
  writeFileSync(path.join(ICON_SRC_DIR, "SOURCES.json"), JSON.stringify(sources, null, 2) + "\n");
  for (const f of sources.files) console.log(`[copy-icon-sources] ${f.file} ← ${f.from} (sha256 ${f.sha256})`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
