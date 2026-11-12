#!/usr/bin/env node
// AiEditor のメンバーごとのホワイトリストを強制する PreToolUse のフック。
// 土台は E:\develop\self\Team の team/hooks/allowlist.js（Bash の検査をそのまま引き継ぎ、書式を AiEditor の
// permissions.json に合わせた。ops-log・Notion・SendMessage の記録など Team 固有の仕組みは持ち込まない）。
// 作成の記録: E:\develop\self\Team\tasks\2026-11-12-ai-editor-hooks\build-notes.md
//
// 呼び方（.claude/settings.json の PreToolUse。matcher は "*"＝全ツール。起動役 guard.js を exec form で通す）:
//   "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/team/hooks/guard.js", "allowlist.js"], "onFailure": "block"
// 試しの呼び方（permcheck.py --member とテスト）: node team/hooks/allowlist.js <メンバー ID>
//
// 1. 呼び出し元の見分け（フック入力の agent_type）
//    - 引数なし（本番）: agent_type で決める。main（agent_id なし。`claude -p --agent di-renjie` のメインセッション）も
//      サブエージェント（agent_id あり）も、同じ agent_type なら同じに検査する。
//      検査せずに通す（exit 0）のは、agent_type が未定義・空文字・vlad-tepes（リーダー。完全一致）の3つだけ。
//      文字列でない値（null・配列など）、英数字と _ と - 以外を含む文字列（plugin:name など）、
//      permissions.json（team/departments/*/<id>/permissions.json）の無いもの（定義だけあるもの、
//      組み込みの Explore・general-purpose なども）は止める。
//    - 引数あり: 引数の ID で検査する。形式違い・permissions.json が無いときは止める。
//    入力の形: トップレベルがオブジェクトでない（配列・null など）ときは誰でも止める。メンバーの呼び出しでは、
//    hook_event_name・tool_name・cwd が文字列でない、tool_input がオブジェクトでない、Bash / PowerShell の
//    command が文字列でない・空のとき、ファイルのツールのパスが文字列でないときに止める。
// 2. 定義の tools: tool_name が定義の frontmatter の tools に無ければ止める（Agent と旧名 Task は同じに扱う）。
//    tools が無い・空・* のときは全部止める。
// 3. Bash / PowerShell: CR 単独・U+0085・U+2028・U+2029・\v・\f などの改行・制御文字（タブ・LF・CR LF 以外）を
//    含むコマンドは止める。区切り（&& || ; | & LF・CR LF）で分けた断片が、全部 bash の許可に「完全一致」か「許可＋半角空白」の
//    前方一致で一致するときだけ通す。許可の * はパスの1区切りの一部に一致する（下の STAR）。末尾が / の許可
//    （node --test tests/ など）は、そのディレクトリの下のパス（.. を含まない）に限って一致する（buildDirScopedMatcher）。
//    $( ・`・<・>・(・) を含むコマンド、secret_paths が文字列に現れるコマンドは止める。
//    第2段: permissions.json の bash とは別に、全員に効く固定の検査（checkCommandSafety）で次を止める——node の
//    危険なオプション（--require・--import・-r・-e・--eval・-p・--loader・--experimental-loader・--test-reporter-destination。
//    長い形は _ を - に、大文字を小文字にそろえて比べる）、環境変数 NODE_OPTIONS、pnpm・npx の exec・dlx・--yes・-y、
//    git の -c（設定を与える -c。グローバルの位置と clone の後ろだけ。まとめ書き・くっつけ書きを含む。12.12）・
//    --config・--upload-pack・--receive-pack・--template・--exec・
//    --unsafe-paths・--directory・--no-index・--output・--build-fake-ancestor・--separate-git-dir（どれも省略形を含む。
//    build-notes 12.1・12.11）。git format-patch の -o・--output-directory（全部。--output はファイルとしても）と tsc の
//    書き出し先は、そのメンバーの書き込み先（4 と同じ規則）と照合して、外なら止める。tsc の照合できない
//    形（--build・--incremental・--composite・--init・--noEmit false・@ファイル）は止める。
// 3b. 組み込みの Explore（agent_type＝Explore）は permissions.json を持たないが、固定の決まりで Read・Glob・Grep だけを
//    通す（読める場所は ./ と C:/b/、secret_paths は止める）。general-purpose・Plan・plugin:x は止める。
// 4. Write / Edit / MultiEdit / NotebookEdit: write_paths に一致し、write_paths_deny と固定の自己防護
//    （プロジェクト直下の .claude/・team/・.git/ と、どこであれ .git の区切り）に一致しないときだけ通す。
// 5. Read / Glob / Grep: read_paths に一致するときだけ通す（Glob・Grep は path。省略時は cwd かプロジェクト直下）。
//    Glob の pattern と Grep の glob に .. ・絶対パス・コロンがあれば止める。
// 6. secret_paths（%NAME% を展開）: 4・5 の対象がその下（Glob・Grep は、探す範囲がその親でも）なら止める。
//    展開できない環境変数があれば、ファイルと Bash / PowerShell の呼び出しを止める。
// 7. Agent / Task は agents、Skill は skills、SendMessage は "main" か agents に限る（今は全員が空）。
//    WebSearch・WebFetch・StructuredOutput などそれ以外のツールは、定義の tools にあれば通す。
// パスはそろえてから比べる（区切りの \ と /、大文字小文字、. と .. の解決、/c/… の Git Bash 形）。止める形:
//   空・制御文字、\\?\・\\.\・UNC（先頭が区切り2つ）、~ で始まる、ドライブの無い / 始まり（/c/… は除く）、
//   ドライブ相対（C:foo）、ドライブ以外のコロン（::$DATA など）、< > " | ? *、末尾が . か空白の区切り（a.、x.ps1.）、
//   8.3 短縮名らしい区切り（~ と数字）、cwd がプロジェクト直下でないときの相対パス。
// 実在する一番深い親を realpath でたどった先でも同じ判定をする（ジャンクション・シンボリックリンク対策）。
// 想定外の例外は exit 2（止める）にそろえる。

const fs = require("fs");
const path = require("path");

const pw = path.win32;
const LEADER_AGENT_ID = "vlad-tepes";
const AGENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const LIST_KEYS = ["bash", "write_paths", "write_paths_deny", "read_paths", "secret_paths", "agents", "skills"];
const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const SELF_PROTECTED = [".claude/", "team/", ".git/"];
// 組み込みの Explore の固定の権限（permissions.json は持てない）。読める場所は ./ と C:/b/、秘密は止める。
const EXPLORE_TOOLS = new Set(["Read", "Glob", "Grep"]);
const EXPLORE_ALLOWLIST = {
  bash: [],
  write_paths: [],
  write_paths_deny: [],
  read_paths: ["./", "C:/b/"],
  secret_paths: ["%LOCALAPPDATA%/Shuko/watch/", "%LOCALAPPDATA%/Shuko/secrets/"],
  agents: [],
  skills: [],
};

function block(message) {
  process.stderr.write(`[allowlist] ${message}\n`);
  process.exit(2);
}

process.on("uncaughtException", (err) => block(`想定外の例外のため止めました: ${(err && err.message) || err}`));

// JSON のオブジェクト（{ }）か。配列・null・文字列・数・真偽値は違う。
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const PROJECT_DIR = pw.resolve(process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, "..", ".."));

// ---- 呼び出し元 ----

function findAgentDir(agentId) {
  const departmentsDir = pw.join(PROJECT_DIR, "team", "departments");
  let departments = [];
  try {
    departments = fs.readdirSync(departmentsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch {
    // 部門のディレクトリが無ければ「見つからない」
  }
  for (const department of departments) {
    const dir = pw.join(departmentsDir, department.name, agentId);
    if (fs.existsSync(pw.join(dir, "permissions.json"))) return dir;
  }
  return null;
}

function definitionFile(agentId) {
  return pw.join(PROJECT_DIR, ".claude", "agents", `${agentId}.md`);
}

function resolveAgent(argId, event) {
  if (argId !== undefined) {
    if (!AGENT_ID_PATTERN.test(argId)) block(`引数のメンバー ID の形式が不正なため止めました: ${argId}`);
    const agentDir = findAgentDir(argId);
    if (!agentDir) block(`${argId} の permissions.json が team/departments/*/${argId}/ に無いため止めました`);
    return { agentId: argId, agentDir };
  }
  // 検査せずに通すのは、agent_type が未定義・空文字・vlad-tepes（完全一致）の3つだけ。
  // 文字列でない値（null・配列など）、ID の形でない文字列（plugin:name など）、permissions.json の無いもの
  // （組み込みの Explore・general-purpose なども）は止める（差し戻し1回目で止める側に倒した）。
  const agentType = event.agent_type;
  if (agentType === undefined || agentType === "" || agentType === LEADER_AGENT_ID) return null;
  if (typeof agentType !== "string") {
    block(`フック入力の agent_type が文字列ではないため止めました: ${JSON.stringify(agentType)}`);
  }
  if (!AGENT_ID_PATTERN.test(agentType)) {
    block(`agent_type の形式が不正（英数字・_・- 以外を含む）なため止めました: ${agentType}`);
  }
  // 組み込みの Explore は、permissions.json を持たないが、固定の決まりで Read・Glob・Grep だけを通す（6）。
  // general-purpose・Plan・plugin:x などは、下の「定義も permissions.json も無い」で止める（今のまま）。
  if (agentType === "Explore") return { agentId: "Explore", explore: true };
  const agentDir = findAgentDir(agentType);
  if (agentDir) return { agentId: agentType, agentDir };
  if (fs.existsSync(definitionFile(agentType))) {
    block(
      `${agentType} は .claude/agents/${agentType}.md に定義があるが permissions.json が ` +
        `team/departments/*/${agentType}/ に無いため止めました（リーダーに権限の用意を依頼してください）`,
    );
  }
  block(
    `${agentType} は定義も permissions.json も無い（組み込み・プラグインのエージェントなど）ため止めました` +
      `（使うならリーダーに定義と権限の用意を依頼してください）`,
  );
}

function loadAllowlist(agentDir, agentId) {
  const file = pw.join(agentDir, "permissions.json");
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    block(`${agentId} の permissions.json (${file}) を読めないため止めました: ${err.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    block(`${agentId} の permissions.json がオブジェクトではないため止めました`);
  }
  const allowlist = {};
  for (const key of LIST_KEYS) {
    const value = Object.prototype.hasOwnProperty.call(parsed, key) ? parsed[key] : [];
    // 配列でない値は書き間違いとみなし、無制限にも空にもせず止める
    if (!Array.isArray(value)) block(`${agentId} の permissions.json の ${key} が配列ではないため止めました`);
    allowlist[key] = value.filter((item) => typeof item === "string");
  }
  return allowlist;
}

// ---- 定義の tools ----

// frontmatter の tools を読む。「tools: A, B」「tools: [A, B]」「tools:」の下の「- A」の3つの書き方を読む。
// Agent(x) のような括弧の指定は名前だけを見る。読めない・無い・空・* なら null。
function definitionTools(agentId) {
  let text;
  try {
    text = fs.readFileSync(definitionFile(agentId), "utf8");
  } catch {
    return null;
  }
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0].trim() !== "---") return null;
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
  if (end < 0) return null;
  const body = lines.slice(1, end);
  const start = body.findIndex((line) => /^tools\s*:/.test(line));
  if (start < 0) return null;
  let value = body[start].replace(/^tools\s*:/, "").replace(/\s+#.*$/, "").trim();
  let items;
  if (value === "") {
    items = [];
    for (let i = start + 1; i < body.length; i++) {
      const m = /^\s+-\s*(.*)$/.exec(body[i]);
      if (m) items.push(m[1].replace(/\s+#.*$/, ""));
      else if (body[i].trim() === "" || /^\s+#/.test(body[i])) continue;
      else break;
    }
  } else {
    if (value.startsWith("[") && value.endsWith("]")) value = value.slice(1, -1);
    items = value.split(",");
  }
  const names = items
    .map((item) => item.trim().replace(/^["']|["']$/g, "").split("(")[0].trim())
    .filter(Boolean);
  if (names.length === 0 || names.includes("*")) return null;
  return new Set(names);
}

function checkTool(toolName, agentId) {
  const tools = definitionTools(agentId);
  if (!tools) {
    block(`${agentId}: 定義 .claude/agents/${agentId}.md の tools を読めない（無い・空・* を含む）ため、すべて止めます`);
  }
  const aliases = toolName === "Agent" || toolName === "Task" ? ["Agent", "Task"] : [toolName];
  if (!aliases.some((name) => tools.has(name))) {
    block(`${agentId}: 定義の tools に無いツールです: ${toolName || "(名前なし)"}（使えるのは ${[...tools].join(", ")}）`);
  }
}

// ---- Bash / PowerShell（区切り・置換・リダイレクト・git の書き出しは土台と同じ） ----

// CR LF は1つの改行として区切る（LF と同じ。後ろの CR は trim でも落ちる）。
// CR 単独・そのほかの縦の区切り文字は、ここへ来る前に checkLineBreaks が止める。
function splitCommand(command) {
  return command
    .split(/&&|\|\||\r\n|[;|&\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

// 単一引用符の中はシェルが何も解釈しない。ダブルクォートやバックスラッシュが無いときだけ、
// 単一引用符の中身を空にしてから検査する（引用の入れ子による検査すり抜けを避けるため）。
function stripSingleQuoted(command) {
  if (command.includes('"') || command.includes("\\")) return command;
  return command.replace(/'[^']*'/g, "''");
}

// 許可の * が一致する文字列: パスの1区切りの一部。/・\・空白・引用符・シェルや PowerShell が解釈する文字
// （* ? [ ] { } $ ~ : % など）を含まず、空でなく、末尾が . でない（. と ..、... のような点だけのもの、
// Windows が末尾の点を落とす x. の形には一致しない）。
const STAR = "[A-Za-z0-9._@+=-]*[A-Za-z0-9_@+=-]";

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 許可1つを正規表現にする。「完全一致」か「許可＋半角空白」で始まるものに一致する。
function compileCommand(allowed) {
  const body = allowed.split("*").map(escapeRegExp).join(STAR);
  return new RegExp(`^${body}(?: |$)`);
}

// コマンドの断片を語に分ける（引用符を外した text）。断片には区切り（&& || ; | &）が無い前提。
function wordsOf(segment) {
  const segs = shellSegments(segment, SHELL_MODES[0]);
  return segs.length ? segs[0].map((w) => w.text) : [];
}

// 許可の区切り（* は1区切りに一致）1つを、1つのパスの区切りに一致する正規表現にする。
function segRegExp(seg) {
  return new RegExp(`^${seg.split("*").map(escapeRegExp).join("[^/]+")}$`);
}

// 末尾が / の許可（例 node --test tests/）に、コマンドの断片が一致するか。
// 先頭の語（コマンド・オプション）は許可どおり、最後のディレクトリ以降の語はどれもそのディレクトリの下のパス。
function buildDirScopedMatcher(entry) {
  const parts = entry.split(/\s+/).filter(Boolean);
  const dirToken = parts[parts.length - 1].replace(/\/+$/, "");
  const lead = parts.slice(0, -1);
  const leadRes = lead.map((w) => new RegExp(`^${w.split("*").map(escapeRegExp).join(STAR)}$`));
  const dirSegs = dirToken.split("/").filter(Boolean).map((s) => (s.includes("*") ? segRegExp(s) : s));
  return (segment) => {
    const cmdWords = wordsOf(segment);
    if (cmdWords.length < lead.length + 1) return false;
    for (let i = 0; i < lead.length; i++) if (!leadRes[i].test(cmdWords[i])) return false;
    for (let i = lead.length; i < cmdWords.length; i++) if (!pathUnderDir(cmdWords[i], dirSegs)) return false;
    return true;
  };
}

// 語が、dirSegs の指すディレクトリそのものか、その下のパスか。.. ・絶対・\ ・グロブ・コロン・末尾の点や空白は不可。
function pathUnderDir(word, dirSegs) {
  if (word === "" || word.startsWith("-")) return false;
  if (word.includes("\\") || /[*?[\]{}]/.test(word) || word.includes(":") || word.startsWith("/")) return false;
  const segs = word.split("/").filter(Boolean);
  if (segs.length < dirSegs.length) return false;
  for (const s of segs) {
    if (s === "..") return false;
    if (/[. ]$/.test(s)) return false;
  }
  for (let i = 0; i < dirSegs.length; i++) {
    const d = dirSegs[i];
    if (typeof d === "string" ? d !== segs[i] : !d.test(segs[i])) return false;
  }
  return true;
}

// 許可1つを、断片を受け取り真偽を返す照合器にする。末尾が / のものは「ディレクトリの下」の規則で照合する。
function buildMatcher(entry) {
  if (entry.endsWith("/")) return buildDirScopedMatcher(entry);
  const re = compileCommand(entry);
  return (segment) => re.test(segment);
}

const SHELL_MODES = [
  { escapes: true, crlfContinues: true, single: "'", double: '"' },
  { escapes: true, crlfContinues: false, single: "'", double: '"' },
  { escapes: false, single: "'‘’‚‛", double: '"“”„' },
];

function lineContinuationLength(command, i, mode) {
  if (!mode.escapes || command[i] !== "\\") return 0;
  if (command[i + 1] === "\n") return 2;
  if (mode.crlfContinues && command[i + 1] === "\r" && command[i + 2] === "\n") return 3;
  return 0;
}

function shellSegments(command, mode) {
  const segments = [];
  let words = [];
  let word = null;
  let commandPosition = true;
  const startWord = () => {
    if (!word) {
      word = { text: "", bare: "", expands: false, command: commandPosition };
      commandPosition = false;
    }
  };
  const endWord = () => {
    if (word) words.push(word);
    word = null;
  };
  const endSegment = () => {
    endWord();
    if (words.length > 0) segments.push(words);
    words = [];
    commandPosition = true;
  };
  let i = 0;
  while (i < command.length) {
    const c = command[i];
    const continuation = lineContinuationLength(command, i, mode);
    if (continuation > 0) {
      i += continuation;
    } else if (mode.single.includes(c)) {
      startWord();
      let j = i + 1;
      while (j < command.length && !mode.single.includes(command[j])) j++;
      const inner = command.slice(i + 1, j);
      word.text += inner;
      word.bare += "\0".repeat(inner.length);
      i = j + 1;
    } else if (mode.double.includes(c)) {
      startWord();
      let j = i + 1;
      while (j < command.length && !mode.double.includes(command[j])) {
        const inner = lineContinuationLength(command, j, mode);
        if (inner > 0) {
          j += inner;
          continue;
        }
        if (mode.escapes && command[j] === "\\" && j + 1 < command.length) j++;
        else if (command[j] === "$") word.expands = true;
        word.text += command[j];
        word.bare += "\0";
        j++;
      }
      i = j + 1;
    } else if (";|&\n".includes(c)) {
      endSegment();
      i++;
    } else if (c === "(" || c === ")") {
      endWord();
      commandPosition = c === "(";
      i++;
    } else if (/\s/.test(c)) {
      endWord();
      i++;
    } else if (mode.escapes && c === "\\" && i + 1 < command.length) {
      startWord();
      word.text += command[i + 1];
      word.bare += "\0";
      i += 2;
    } else {
      startWord();
      if (c === "$") word.expands = true;
      word.text += c;
      word.bare += c;
      i++;
    }
  }
  endSegment();
  return segments;
}

const COMMAND_PREFIX_WORDS = new Set([
  "command", "exec", "env", "nohup", "time", "builtin",
  "if", "then", "else", "elif", "do", "while", "until", "!", "{", "}",
]);
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

function isGitWord(text) {
  const base = text.split(/[\\/]/).pop().toLowerCase();
  return base === "git" || base === "git.exe" || base === "git.cmd";
}

// 次の語を値に取る git のグローバルオプション（git.c の handle_options。= 付きの形は 1 語なので含めない）。
// -c をグローバルの位置でだけ止めるため、サブコマンドの位置を git と同じに求める。値を取るものを取りこぼすと、
// その値をサブコマンドと見誤り、後ろのグローバルの -c を見逃すので、全部を書く（--shallow-file を含む）。
const GIT_GLOBAL_WITH_VALUE = new Set([
  "-C", "-c", "--config-env", "--git-dir", "--work-tree", "--namespace", "--super-prefix", "--attr-source",
  "--shallow-file",
]);
const GIT_DIFF_FAMILY = new Set([
  "diff", "diff-files", "diff-index", "diff-tree", "difftool", "log", "show", "whatchanged", "reflog",
  "range-diff", "shortlog", "rev-list", "stash", "format-patch",
]);
const DIFF_SHORT_VALUE_CHARS = "UGSOlMCBXILnv";
const BRACE_EXPANSION = /\{[^{}]*(?:,|\.\.)[^{}]*\}/;

// git の長いオプションの名前（-- の後ろ、= の前。小文字にそろえる）。-- で始まらない語・-- だけの語は null。
function gitLongName(text) {
  if (!text.startsWith("--") || text === "--") return null;
  const eq = text.indexOf("=");
  return (eq >= 0 ? text.slice(2, eq) : text.slice(2)).toLowerCase();
}

// git（parse-options）は長いオプションを、曖昧でない範囲で先頭だけに省略して受け付ける（--unsafe → --unsafe-paths）。
// 名前が full の先頭 min 文字以上と一致すれば、その省略形とみなす。サブコマンドごとの曖昧さは計算せず、止める側に倒す。
function isAbbrevOf(name, full, min) {
  return name !== null && name.length >= min && full.startsWith(name);
}

// 書き出しの --output（diff 系）と --output-directory（format-patch）。output-directory の省略形として一つにまとめて見る
// （--o・--out・--output・--output-dir・--output-d… のどれも）。
const GIT_OUTPUT = { name: "output-directory", min: 1 };
function isGitOutputLong(text) {
  return isAbbrevOf(gitLongName(text), GIT_OUTPUT.name, GIT_OUTPUT.min);
}

// --output と同じ類の、ファイル・ディレクトリの名前を値に取って書き出す長いオプション。照合せず、どのサブコマンドでも
// 止める（省略形を含む。build-notes 12.1 の表・12.11）。--build-fake-ancestor は apply の一時の index のファイル、
// --separate-git-dir は clone・init の git のディレクトリ。
const GIT_WRITE_LONG = [
  { name: "build-fake-ancestor", min: 1, reason: "--build-fake-ancestor（省略形を含む）は一時の index のファイルを書き出す" },
  { name: "separate-git-dir", min: 1, reason: "--separate-git-dir（省略形を含む）は git のディレクトリを指定した場所に作る" },
];
function gitWriteLongReason(text) {
  const name = gitLongName(text);
  const found = GIT_WRITE_LONG.find((o) => isAbbrevOf(name, o.name, o.min));
  return found ? found.reason : null;
}

function shortOptionHas(text, target, valueChars) {
  if (!/^-[^-]/.test(text)) return false;
  for (const ch of text.slice(1)) {
    if (ch === target) return true;
    if (valueChars.includes(ch)) return false;
  }
  return false;
}

// 1.4 git の危険なオプション。長いオプションは、グローバルの位置でもサブコマンドの後ろでも、= 付きでも止め、
// 名前の先頭 min 文字以上の省略形まで止める（build-notes 12.1 の表）。
// -c（小文字。設定を与える）は、設定を与える位置——グローバルの位置（サブコマンドより前）と clone の後ろ——でだけ、
// 1 つの - で始まる語に小文字の c があれば止める（-c・-cfoo・-ccore.hooksPath=…・-qc のまとめ書き）。
// サブコマンドの後ろの -c は意味が違い（ls-files の --cached、commit の -c <commit>、log・diff の結合差分）、
// 設定を与えないので止めない（12.12）。-C（大文字。作業ディレクトリ）は c を含まないので止まらない。
// checkShortC: その語が設定を与える位置にあるか。
const DANGEROUS_GIT_LONG = [
  { name: "config", min: 1 },
  { name: "upload-pack", min: 1 },
  { name: "receive-pack", min: 1 },
  { name: "template", min: 1 },
  { name: "exec", min: 1 },
  { name: "unsafe-paths", min: 1 },
  { name: "directory", min: 1 },
  { name: "no-index", min: 4 }, // --no-i から（--n・--no・--no- は否定の接頭辞そのもの）
];
function isDangerousGitOption(text, checkShortC) {
  if (checkShortC && /^-[^-]/.test(text) && text.includes("c")) return true;
  const name = gitLongName(text);
  return DANGEROUS_GIT_LONG.some((o) => isAbbrevOf(name, o.name, o.min));
}

function baseName(text) {
  return text.split(/[\\/]/).pop();
}

// グローバルオプションを読み飛ばしてサブコマンドの位置を求める。-C <dir> は作業場所に積む（git は -C の先で動く）。
function gitGlobals(args, cwdWin) {
  let k = 0;
  let workdir = cwdWin;
  while (k < args.length && args[k].text.startsWith("-")) {
    if (GIT_GLOBAL_WITH_VALUE.has(args[k].text)) {
      if (args[k].text === "-C" && k + 1 < args.length && workdir !== null) {
        const r = normalizePath(args[k + 1].text, true, workdir);
        workdir = r.error ? null : r.win;
      }
      k += 2;
    } else {
      k += 1;
    }
  }
  return { subIndex: k, workdir };
}

// format-patch 以外の、必ず・または任意にファイルへ書き出すサブコマンドと引数（従来の判定）。
function gitWriteReason(args, subIndex) {
  for (const word of args) {
    if (word.expands) return { word: word.text, reason: "単一引用符の外の $（変数展開）は、展開後の引数を確かめられない" };
    if (BRACE_EXPANSION.test(word.bare)) return { word: word.text, reason: "ブレース展開 {a,b} は、展開後の引数を確かめられない" };
    if (isGitOutputLong(word.text)) return { word: word.text, reason: "--output（省略形・--output-directory を含む）はファイルへ書き出す" };
  }
  const sub = args[subIndex].text;
  const rest = args.slice(subIndex + 1);
  const label = `git ${sub}`;
  if (sub === "bugreport" || sub === "diagnose") return { word: sub, reason: `${label} は必ずファイルを書く` };
  if (sub === "bundle" && rest.some((word) => word.text === "create")) {
    return { word: "create", reason: "git bundle create はバンドルのファイルを書く" };
  }
  if (sub === "archive") {
    for (const word of rest) {
      if (shortOptionHas(word.text, "o", "")) {
        return { word: word.text, reason: "git archive の -o / --output はファイルへ書き出す" };
      }
    }
  }
  if (GIT_DIFF_FAMILY.has(sub)) {
    for (const word of rest) {
      if (shortOptionHas(word.text, "o", DIFF_SHORT_VALUE_CHARS)) {
        return { word: word.text, reason: `${label} の -o は書き出しの指定として止める` };
      }
    }
  }
  return null;
}

// format-patch の短いオプションのうち、値を取らないもの（-n・-N・-s・-k・-p・-q と、-3 のような数）。
// この文字だけが前にある o は -o（-ko dir・-nodir など）とみなす。
const FORMAT_PATCH_FLAG_CHARS = /^[nNskpq0-9]*$/;

// format-patch の書き出し先の指定を、現れた順に全部返す（[{ word, value }]。値が無ければ value は null）。
// 長い形は --output-directory の省略形すべて（--o・--output・--output-dir・--output-d… と = 付き）、短い形は -o・
// -o<値>・まとめ書き（-ko <値>）。前に値を取る文字がある o（-Sfoo など）は、値の一部か -o かを決められないので止める。
function formatPatchOutputs(rest, agentId, rawCommand) {
  const outs = [];
  const next = (i) => ({ word: rest[i + 1] || null, value: rest[i + 1] ? rest[i + 1].text : null });
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i].text;
    if (t.startsWith("--")) {
      if (!isGitOutputLong(t)) continue;
      // --output（省略しない形）は、diff の --output=<ファイル>（1つのファイルに全部書く）として読まれうる。
      // ディレクトリとしてもファイルとしても照合する（12.11）
      const asFile = gitLongName(t) === "output";
      const eq = t.indexOf("=");
      if (eq >= 0) {
        outs.push({ word: rest[i], value: t.slice(eq + 1), asFile });
      } else {
        outs.push({ ...next(i), asFile });
        i += 1;
      }
    } else if (/^-[^-]/.test(t) && t.includes("o")) {
      const k = t.indexOf("o");
      if (!FORMAT_PATCH_FLAG_CHARS.test(t.slice(1, k))) {
        block(`${agentId}: format-patch の ${t} が -o（書き出し先）を含むか決められないため止めました: ${rawCommand}`);
      }
      if (k + 1 < t.length) {
        outs.push({ word: rest[i], value: t.slice(k + 1) });
      } else {
        outs.push(next(i));
        i += 1;
      }
    }
  }
  return outs;
}

// 1.5 git format-patch の書き出し先を、そのメンバーの書き込み先と照合する。
// -o / --output-directory（省略形を含む）は、現れたものを全部照合する（最後のものだけ・最初のものだけにしない）。
// どれも無ければ、--stdout なら画面出力（リダイレクトは別途禁止）として通し、無ければ作業場所に書くとして照合する。
// --stdout と -o を併用しても、-o の先を照合する（git に任せない）。
// 相対パスは作業場所（-C の先、無ければ cwd）から解く。パッチは「ディレクトリの下のファイル」として照合する。
// --output（省略しない形）だけは、その先そのものもファイルとして照合する（write_paths_deny のファイルの規則に当てるため）。
function checkFormatPatch(args, rest, workdir, allowlist, secrets, ctx, rawCommand) {
  const agentId = ctx.agentId;
  for (const w of args) {
    if (w.expands || BRACE_EXPANSION.test(w.bare)) {
      block(`${agentId}: format-patch の引数に $ やブレース展開があり、書き出し先を確かめられないため止めました: ${rawCommand}`);
    }
  }
  const outs = formatPatchOutputs(rest, agentId, rawCommand);
  if (outs.length === 0 && rest.some((w) => w.text === "--stdout")) return;
  if (workdir === null) block(`${agentId}: git -C の作業場所を解けないため format-patch を止めました: ${rawCommand}`);
  const dirs = [];
  const files = [];
  for (const o of outs) {
    if (o.value === null || !o.word) block(`${agentId}: format-patch の書き出し先を確かめられないため止めました: ${rawCommand}`);
    const r = normalizePath(o.value, true, workdir);
    if (r.error) block(`${agentId}: format-patch の書き出し先を止めました（${r.error}）: ${rawCommand}`);
    dirs.push(r.win);
    if (o.asFile) files.push(r.win);
  }
  if (dirs.length === 0) dirs.push(workdir);
  for (const dir of dirs) {
    checkWriteWin(pw.join(dir, "0001-x.patch"), allowlist, secrets, agentId, rawCommand, "format-patch の書き出し");
  }
  for (const file of files) {
    checkWriteWin(file, allowlist, secrets, agentId, rawCommand, "format-patch の --output の書き出し");
  }
}

// 1.1 node の危険なオプション。スクリプトのパスの前後を問わず、語のどこに現れても止める（止める側に倒す。
// 値を取る別オプション node --conditions foo --require evil app.js の後ろに隠す抜け道を塞ぐため）。
// 長いオプションは、名前（= の前）を小文字にし、_ を - にそろえてから比べる。node は名前の _ を - と同じに読む
// （--experimental_loader）。大文字小文字は node が区別する（--Require は node が拒む）が、小文字にそろえても止めすぎに
// ならないので止める側に倒した。短いオプション（-r・-e・-p）は大文字小文字を区別したまま（-C は node の --conditions）。
// 短いオプションは、- 1 つで始まる語の中に r・e・p が現れれば、値がくっついていても（-rC:/b/e.cjs・-pe）止める。
// ただし -C で始まる語は --conditions とその値（-Cproduction など）なので止めない（12.12）。
// 長いオプションの省略形（--req=x）は node が受け付けない見込みなので止めない（build-notes 12.12）。
const DANGEROUS_NODE_LONG = [
  "--require", "--import", "--eval", "--print", "--loader", "--experimental-loader", "--test-reporter-destination",
];
function nodeLongName(text) {
  const eq = text.indexOf("=");
  return (eq >= 0 ? text.slice(0, eq) : text).toLowerCase().replace(/_/g, "-");
}
function isDangerousNodeOption(text) {
  if (/^-[^-]/.test(text)) return !text.startsWith("-C") && /[rep]/.test(text.slice(1));
  return text.startsWith("--") && DANGEROUS_NODE_LONG.includes(nodeLongName(text));
}
function checkNode(args, agentId, rawCommand) {
  for (const w of args) {
    if (isDangerousNodeOption(w.text)) {
      block(
        `${agentId}: node の危険なオプション ${w.text} を含むため止めました` +
          `（--require・--import・-r・-e・--eval・-p・--loader・--experimental-loader・--test-reporter-destination は許可していません）: ${rawCommand}`,
      );
    }
  }
}

// 1.3 pnpm・npx の exec・dlx・--yes・-y。--dir / --prefix / -C の値（次の語）は飛ばす。
function checkPnpmNpx(args, agentId, rawCommand) {
  for (let i = 0; i < args.length; i++) {
    const t = args[i].text;
    if (t === "--dir" || t === "--prefix" || t === "-C") {
      i += 1;
      continue;
    }
    if (t === "exec" || t === "dlx") {
      block(`${agentId}: pnpm・npx の ${t} は任意のコマンドを実行するため止めました: ${rawCommand}`);
    }
    if (t === "--yes" || t.startsWith("--yes=") || t === "-y") {
      block(`${agentId}: pnpm・npx の ${t}（未確認のまま自動で取得・実行する）は止めました: ${rawCommand}`);
    }
  }
}

// 1.5 tsc の書き出し先。--outDir などディレクトリの先はその下のファイルとして、--outFile などはファイルとして照合する。
// 相対パスは cwd から解く。tsc はオプションの大文字小文字を区別せず、- 1 つの長い形（-outDir）も受け付けるので、
// 名前は先頭の - か -- を外し、小文字にそろえて比べる。
// 照合できず止めるもの（TSC_UNCHECKABLE と --noEmit の打ち消し・@ファイル）:
//   --build / -b（tsconfig の出力先に書く）、--incremental / -i・--composite（--noEmit でも .tsbuildinfo を書き、
//   置き場所は tsconfig や outDir から決まる）、--init（cwd に tsconfig.json を書く）、
//   --noEmit に値を続けた形（--noEmit false・--noEmit=…。tsconfig の出力先に書く）、@<ファイル>（引数をファイルから読む）。
const TSC_DIR_OPTS = new Set(["outdir", "declarationdir", "generatetrace"]);
const TSC_FILE_OPTS = new Set(["outfile", "out", "tsbuildinfofile", "generatecpuprofile"]);
const TSC_UNCHECKABLE = new Set(["build", "b", "incremental", "i", "composite", "init"]);
function isTscWord(text) {
  return baseName(text).toLowerCase().replace(/\.(cmd|exe|ps1|bat|js)$/, "") === "tsc";
}
function tscOptionName(text) {
  if (!/^--?[A-Za-z]/.test(text)) return null;
  const eq = text.indexOf("=");
  return (eq >= 0 ? text.slice(0, eq) : text).replace(/^--?/, "").toLowerCase();
}
function checkTsc(args, allowlist, secrets, ctx, rawCommand) {
  const agentId = ctx.agentId;
  for (let i = 0; i < args.length; i++) {
    const w = args[i];
    if (w.text.startsWith("@")) {
      block(`${agentId}: tsc の ${w.text}（引数をファイルから読む）は中身を確かめられないため止めました: ${rawCommand}`);
    }
    const name = tscOptionName(w.text);
    if (name === null) continue;
    const eq = w.text.indexOf("=");
    if (TSC_UNCHECKABLE.has(name)) {
      block(`${agentId}: tsc の ${w.text} は tsconfig などで決まる場所に書くため照合できず止めました: ${rawCommand}`);
    }
    if (name === "noemit" && (eq >= 0 || (args[i + 1] && args[i + 1].text.toLowerCase() === "false"))) {
      block(`${agentId}: tsc の --noEmit に値を続けた形（--noEmit false など）は tsconfig の出力先に書くため止めました: ${rawCommand}`);
    }
    const isDir = TSC_DIR_OPTS.has(name);
    const isFile = TSC_FILE_OPTS.has(name);
    if (!isDir && !isFile) continue;
    let valueWord = null;
    let value = null;
    if (eq >= 0) {
      valueWord = w;
      value = w.text.slice(eq + 1);
    } else {
      valueWord = args[i + 1] || null;
      value = valueWord ? valueWord.text : null;
      i += 1;
    }
    if (value === null || !valueWord || valueWord.expands || BRACE_EXPANSION.test(valueWord.bare)) {
      block(`${agentId}: tsc の ${w.text} の書き出し先を確かめられないため止めました: ${rawCommand}`);
    }
    const r = normalizePath(value, true, ctx.cwdWin);
    if (r.error) block(`${agentId}: tsc の ${w.text} の書き出し先を止めました（${r.error}）: ${rawCommand}`);
    const target = isDir ? pw.join(r.win, "out.tsbuild") : r.win;
    checkWriteWin(target, allowlist, secrets, agentId, rawCommand, `tsc の ${w.text} の書き出し`);
  }
}

// Bash / PowerShell のコマンド全体に対する、permissions.json の bash とは別の固定の検査（node・NODE_OPTIONS・
// pnpm/npx・git の危険なオプション・git format-patch と tsc の書き出し先）。語に分けて判定する（git の書き出しと同じ作り）。
function checkCommandSafety(rawCommand, allowlist, secrets, ctx) {
  const agentId = ctx.agentId;
  // 1.2 NODE_OPTIONS はコマンドの文字列のどこに現れても止める（前置き・env・set・$env: すべて。大文字小文字を問わない）
  if (/node_options/i.test(rawCommand)) {
    block(`${agentId}: 環境変数 NODE_OPTIONS を含むコマンドは許可していません: ${rawCommand}`);
  }
  for (const mode of SHELL_MODES) {
    for (const words of shellSegments(rawCommand, mode)) {
      for (let i = 0; i < words.length; i++) {
        if (!words[i].command) continue;
        let j = i;
        while (j < words.length && (COMMAND_PREFIX_WORDS.has(words[j].text) || ENV_ASSIGNMENT.test(words[j].text))) j++;
        if (j >= words.length) continue;
        const base = baseName(words[j].text).toLowerCase();
        const rest = words.slice(j + 1);
        if (isGitWord(words[j].text)) {
          const { subIndex, workdir } = gitGlobals(rest, ctx.cwdWin);
          // clone の名前は大文字小文字を問わない（Windows では git-Clone を探しうる。止める側に倒す）
          const isClone = subIndex < rest.length && rest[subIndex].text.toLowerCase() === "clone";
          for (let k = 0; k < rest.length; k++) {
            const w = rest[k];
            // 設定を与える -c の位置: グローバルの位置（サブコマンドより前。サブコマンドが無ければ全部）と clone の後ろ
            const configPosition = k < subIndex || (isClone && k > subIndex);
            if (isDangerousGitOption(w.text, configPosition)) {
              block(
                `${agentId}: git の危険なオプション ${w.text} を含むため止めました` +
                  `（グローバルの位置と clone の後ろの -c、--config・--upload-pack・--receive-pack・--template・--exec・` +
                  `--unsafe-paths・--directory・--no-index と、その省略形・-c のまとめ書きは許可していません）: ${rawCommand}`,
              );
            }
            const writeReason = gitWriteLongReason(w.text);
            if (writeReason) {
              block(`${agentId}: git のファイルへ書き出す引数を含むため止めました: ${w.text}（${writeReason}）: ${rawCommand}`);
            }
          }
          if (subIndex < rest.length) {
            if (rest[subIndex].text === "format-patch") {
              checkFormatPatch(rest, rest.slice(subIndex + 1), workdir, allowlist, secrets, ctx, rawCommand);
            } else {
              const found = gitWriteReason(rest, subIndex);
              if (found) {
                block(`${agentId}: git のファイルへ書き出す引数を含むため止めました: ${found.word}（${found.reason}）: ${rawCommand}`);
              }
            }
          }
        } else if (base === "node" || base === "node.exe") {
          checkNode(rest, agentId, rawCommand);
        } else if (["pnpm", "pnpm.cmd", "pnpm.exe", "npx", "npx.cmd", "npx.exe"].includes(base)) {
          checkPnpmNpx(rest, agentId, rawCommand);
        }
      }
      // tsc は npx・pnpm の後ろなど、コマンドの位置でないところにも現れる。語をなめて tsc の後ろを照合する
      for (let i = 0; i < words.length; i++) {
        if (isTscWord(words[i].text)) checkTsc(words.slice(i + 1), allowlist, secrets, ctx, rawCommand);
      }
    }
  }
}

function joinLineContinuations(command) {
  return command.replace(/\\\r?\n/g, "");
}

// 区切りとして数えない改行・制御文字。CR 単独（LF が続かない CR）、U+0085（NEL）、U+2028・U+2029（行・段落の区切り）、
// \v・\f、U+001C〜U+001E（ファイル・グループ・レコードの区切り）、そのほかの C0・C1 の制御文字と DEL。
// PowerShell は CR 単独などを文の区切りとして扱いうるので、区切りとして数えるのでなく、含むコマンドを止める。
// 残すのはタブ（\t）、LF（\n）、LF の直前の CR（CR LF）だけ。bash の行継続（\ LF・\ CR LF）はこれまでどおり読める。
// U+2028・U+2029 は \u{…} の形（u フラグ）で書く。生の文字は JS のソースでは改行になり、正規表現を壊すため。
const BAD_LINE_CHARS = /\r(?!\n)|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u{2028}\u{2029}]/u;

function checkLineBreaks(rawCommand, agentId) {
  const m = BAD_LINE_CHARS.exec(rawCommand);
  if (m) {
    const code = `U+${m[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
    block(
      `${agentId}: 区切りとして扱えない改行・制御文字（${code}。CR 単独・NEL・U+2028・U+2029・\\v・\\f など）を` +
        `含むコマンドは許可していません: ${JSON.stringify(rawCommand)}`,
    );
  }
}

function checkBash(rawCommand, allowlist, secrets, ctx) {
  const { agentId } = ctx;
  if (typeof rawCommand !== "string") {
    block(`${agentId}: tool_input.command が文字列ではないため止めました: ${JSON.stringify(rawCommand)}`);
  }
  checkLineBreaks(rawCommand, agentId);
  checkSecretText(rawCommand, secrets, agentId, "コマンド");
  const command = stripSingleQuoted(rawCommand);
  // ( ) は PowerShell では引数の位置でも式として評価される（node --check (Remove-Item x) が Remove-Item を実行する）
  if (/\$\(|`|[<>()]/.test(joinLineContinuations(command))) {
    block(`${agentId}: コマンド置換・リダイレクト・括弧（$( \` < > ( )）を含むコマンドは許可していません: ${rawCommand}`);
  }
  // permissions.json の bash とは別に、全員に効く固定の検査（node・NODE_OPTIONS・pnpm/npx・git の危険なオプション・書き出し先）
  checkCommandSafety(rawCommand, allowlist, secrets, ctx);
  const matchers = allowlist.bash.map(buildMatcher);
  const segments = splitCommand(command);
  if (segments.length === 0) block(`${agentId}: 空のコマンドは許可していません: ${JSON.stringify(rawCommand)}`);
  for (const segment of segments) {
    if (!matchers.some((matcher) => matcher(segment))) {
      block(`${agentId}: ホワイトリストに無いコマンドです: ${segment}（リーダーに許可の追加を依頼してください）`);
    }
  }
}

// ---- パスのそろえ方 ----

// 比べる形: 小文字・/ 区切り・末尾の / なし（ドライブ直下は "c:"）。区切りの列 segs と一緒に返す。
function keyOf(winAbs) {
  const segs = winAbs.replace(/\\/g, "/").toLowerCase().split("/").filter(Boolean);
  return { segs, key: segs.join("/") };
}

const MSYS_DRIVE = /^\/([A-Za-z])(?:\/|$)/;

// 生のパスを、win32 の絶対パス（区切り \、. と .. を解いたもの）に直す。止める形なら { error } を返す。
// base は相対パスの起点（既定はプロジェクト直下）。relativeOk が false のときは相対パスを止める。
function normalizePath(raw, relativeOk, base) {
  if (typeof raw !== "string" || raw === "") return { error: "パスが指定されていないか文字列ではない" };
  if (/[\u0000-\u001f]/.test(raw)) return { error: "制御文字を含む" };
  let p = raw;
  if (/^[\\/]{2}/.test(p)) return { error: "\\\\?\\・\\\\.\\・UNC（先頭が区切り2つ）の形" };
  if (p.startsWith("~")) return { error: "~ で始まる（ホームへの展開）" };
  const msys = MSYS_DRIVE.exec(p);
  if (msys) p = `${msys[1]}:/${p.slice(3)}`;
  if (/^[\\/]/.test(p)) return { error: "ドライブの無い / 始まり（どのドライブか決まらない）" };
  if (/^[A-Za-z]:(?![\\/])/.test(p)) return { error: "ドライブ相対（C:foo）" };
  const hasDrive = /^[A-Za-z]:[\\/]/.test(p);
  if ((hasDrive ? p.slice(2) : p).includes(":")) return { error: "ドライブ以外のコロン（::$DATA などの代替データストリーム）" };
  if (/[<>"|?*]/.test(p)) return { error: "Windows のパスに使えない文字（< > \" | ? *）" };
  for (const seg of p.split(/[\\/]/)) {
    if (seg === "" || seg === "." || seg === "..") continue;
    if (/[. ]$/.test(seg)) return { error: `末尾が . か空白の区切り（Windows は落として別の名前になる）: ${seg}` };
    if (/~\d/.test(seg)) return { error: `8.3 短縮名らしい区切り（~ と数字）: ${seg}` };
  }
  if (!hasDrive && !relativeOk) return { error: "相対パス（作業ディレクトリがプロジェクト直下でないため起点が決まらない）" };
  return { win: pw.resolve(base || PROJECT_DIR, p) };
}

// 実在する一番深い親を realpath でたどり、残りをつないだ絶対パス。たどれないときは { error }。
function realize(winAbs) {
  let cur = winAbs;
  const rest = [];
  for (;;) {
    let exists = false;
    try {
      fs.lstatSync(cur);
      exists = true;
    } catch (err) {
      if (err.code !== "ENOENT" && err.code !== "ENOTDIR") return { error: `実体を確かめられない（${err.code}）: ${cur}` };
    }
    if (exists) break;
    const parent = pw.dirname(cur);
    if (parent === cur) return { error: `実在する親が無い: ${winAbs}` };
    rest.unshift(pw.basename(cur));
    cur = parent;
  }
  let real;
  try {
    real = fs.realpathSync.native(cur);
  } catch (err) {
    return { error: `実体をたどれない（壊れたリンクなど。${err.code || err.message}）: ${cur}` };
  }
  return { win: pw.join(real, ...rest) };
}

// 対象のパスを、そろえた形と realpath でたどった形の2つにする。止める形なら block。
function targetForms(raw, ctx, label) {
  const normalized = normalizePath(raw, ctx.relativeOk);
  if (normalized.error) block(`${ctx.agentId}: ${label}を止めました（${normalized.error}）: ${raw}`);
  const real = realize(normalized.win);
  if (real.error) block(`${ctx.agentId}: ${label}を止めました（${real.error}）`);
  return [keyOf(normalized.win), keyOf(real.win)];
}

// ---- パスの規則（write_paths・write_paths_deny・read_paths・自己防護） ----

// 規則1つ: { segs: [文字列 | 正規表現], dir }。* は区切り1つの一部（空でない）に一致する。
// 使えない要素（空・.. ・. の区切り・~・%・ドライブ相対・UNC など）は捨てる（permcheck.py が誤りにする）。
function compileRule(entry, allowRoot) {
  if (typeof entry !== "string" || entry === "" || entry.trim() !== entry) return null;
  let body = entry.replace(/\\/g, "/");
  const dir = body.endsWith("/");
  if (body === "./") return allowRoot ? { segs: keyOf(PROJECT_DIR).segs, dir: true } : null;
  const msys = MSYS_DRIVE.exec(body);
  if (msys) body = `${msys[1]}:/${body.slice(3)}`;
  if (/^[\/~]/.test(body) || body.includes("%") || /^[A-Za-z]:(?!\/)/.test(body)) return null;
  const parts = body.split("/");
  if (parts.some((s, i) => s === "." || s === ".." || (s === "" && i !== parts.length - 1))) return null;
  const abs = /^[A-Za-z]:\//.test(body) ? body : `${PROJECT_DIR}/${body}`;
  const segs = keyOf(abs).segs.map((seg) =>
    seg.includes("*") ? new RegExp(`^${seg.split("*").map(escapeRegExp).join("[^/]+")}$`) : seg,
  );
  if (segs.length === 0) return null;
  return { segs, dir };
}

// 規則の、* より前の部分を realpath でたどった形。たどれなければ null。
function realizeRule(rule) {
  const literal = [];
  for (const seg of rule.segs) {
    if (typeof seg !== "string") break;
    literal.push(seg);
  }
  if (literal.length === 0) return null;
  const real = realize(pw.resolve(`${literal.join("\\")}\\`));
  if (real.error) return null;
  return { segs: keyOf(real.win).segs.concat(rule.segs.slice(literal.length)), dir: rule.dir };
}

// entries を、書いたままの形と realpath でたどった形の両方の規則にする。
// mustRealize（止める側の規則）でたどれない要素があれば、止める側に倒すため null を返す。
function compileRules(entries, allowRoot, mustRealize) {
  const rules = [];
  for (const entry of entries) {
    const rule = compileRule(entry, allowRoot);
    if (!rule) continue;
    rules.push(rule);
    const real = realizeRule(rule);
    if (real) rules.push(real);
    else if (mustRealize) return null;
  }
  return rules;
}

function ruleMatches(rule, segs) {
  const n = rule.segs.length;
  if (rule.dir ? segs.length < n : segs.length !== n) return false;
  for (let i = 0; i < n; i++) {
    const want = rule.segs[i];
    if (typeof want === "string" ? want !== segs[i] : !want.test(segs[i])) return false;
  }
  return true;
}

function under(segs, baseSegs) {
  return baseSegs.length <= segs.length && baseSegs.every((seg, i) => seg === segs[i]);
}

// ---- secret_paths ----

// secret_paths を展開する。{ forms: [区切りの列…], needles: [コマンドの文字列で探す語…] } の列。
// 展開できない環境変数があれば { error }。
function compileSecrets(entries) {
  const secrets = [];
  for (const entry of entries) {
    if (entry === "") continue;
    const names = [];
    let missing = null;
    const expanded = entry.replace(/%([^%]*)%/g, (match, name) => {
      names.push(name);
      const value = name ? process.env[name] : undefined;
      if (!value) missing = missing || match;
      return value || "";
    });
    if (missing) return { error: `secret_paths の環境変数 ${missing} を展開できない` };
    const normalized = normalizePath(expanded, true);
    if (normalized.error) return { error: `secret_paths の ${entry} を解けない（${normalized.error}）` };
    const forms = [keyOf(normalized.win)];
    const real = realize(normalized.win);
    if (real.error) return { error: `secret_paths の ${entry} の実体をたどれない（${real.error}）` };
    forms.push(keyOf(real.win));
    const needles = new Set();
    for (const form of forms) {
      needles.add(form.key);
      if (/^[a-z]:$/.test(form.segs[0])) needles.add(`/${form.segs[0][0]}/${form.segs.slice(1).join("/")}`);
    }
    for (const name of names) {
      const n = name.toLowerCase();
      for (const needle of [`%${n}%`, `$env:${n}`, `\${env:${n}}`, `$${n}`, `\${${n}}`]) needles.add(needle);
    }
    // 環境変数の後ろの部分（%LOCALAPPDATA%/Shuko/secrets/ なら shuko/secrets）。変数の無い相対パスはその全体
    const tail = (names.length > 0 ? entry.slice(entry.lastIndexOf("%") + 1) : /^[A-Za-z]:|^[\\/]/.test(entry) ? "" : entry)
      .replace(/\\/g, "/")
      .toLowerCase()
      .replace(/^\/+|\/+$/g, "");
    if (tail) needles.add(tail);
    secrets.push({ entry, forms, needles: [...needles].map(collapse).filter(Boolean) });
  }
  return { secrets };
}

// 文字列のパスの見え方をそろえる: 連続の / を1つに、/./ を除き、x/../ を解く。
function collapse(text) {
  let s = text.replace(/\/{2,}/g, "/");
  let prev;
  do {
    prev = s;
    s = s.replace(/\/\.(?=\/|$)/g, "").replace(/(^|\/)(?!\.\.(?:\/|$))[^/]+\/\.\.(?=\/|$)/, "$1").replace(/\/{2,}/g, "/");
  } while (s !== prev);
  return s;
}

function checkSecretText(text, secrets, agentId, label) {
  if (secrets.error) block(`${agentId}: ${secrets.error}ため止めました`);
  const lower = String(text).toLowerCase();
  const views = [
    lower.replace(/\\/g, "/"),
    lower.replace(/\\/g, "/").replace(/["'`‘’“”]/g, ""),
    lower.replace(/[\\"'`‘’“”]/g, ""), // bash の Shu\ko・Shu""ko は Shuko になる
  ].map(collapse);
  for (const secret of secrets.secrets) {
    for (const needle of secret.needles) {
      if (views.some((view) => view.includes(needle))) {
        block(`${agentId}: secret_paths（${secret.entry}）に当たる文字列 ${needle} を${label}に含むため止めました`);
      }
    }
  }
}

// forms（対象の2つの形）が秘密の場所の下にあるか。search なら、秘密の場所が対象の下にあるとき（探す範囲に入る）も。
function checkSecretPath(forms, secrets, agentId, raw, search) {
  if (secrets.error) block(`${agentId}: ${secrets.error}ため止めました`);
  for (const secret of secrets.secrets) {
    for (const s of secret.forms) {
      for (const t of forms) {
        if (under(t.segs, s.segs) || (search && under(s.segs, t.segs))) {
          block(`${agentId}: secret_paths（${secret.entry}）に触れるため止めました: ${raw}`);
        }
      }
    }
  }
}

// ---- 書き込み ----

// forms（対象の2つの形）に、自己防護・write_paths_deny・write_paths の規則を当てる。どれかに外れれば block。
// Write ツールだけでなく、Bash の書き出し（git format-patch・tsc）の照合にも使う。
function applyWriteRules(forms, allowlist, secrets, agentId, raw, label) {
  checkSecretPath(forms, secrets, agentId, raw, false);
  const selfRules = compileRules(SELF_PROTECTED, false, true);
  const deny = compileRules(allowlist.write_paths_deny, false, true);
  if (!selfRules || !deny) block(`${agentId}: ${label}を禁じる場所の実体をたどれないため止めました: ${raw}`);
  for (const t of forms) {
    if (t.segs.includes(".git") || selfRules.some((rule) => ruleMatches(rule, t.segs))) {
      block(`${agentId}: .claude/・team/・.git はメンバーが書けない場所です: ${raw}`);
    }
    if (deny.some((rule) => ruleMatches(rule, t.segs))) {
      block(`${agentId}: write_paths_deny で書き込みを禁じた場所です: ${raw}`);
    }
  }
  const allow = compileRules(allowlist.write_paths, false, false);
  // ディレクトリの規則は、そのディレクトリそのものではなく下にだけ一致させる
  const allowed = (t) =>
    allow.some((rule) => ruleMatches(rule, t.segs) && (!rule.dir || t.segs.length > rule.segs.length));
  if (!forms.every(allowed)) block(`${agentId}: ${label}を許可していない場所です: ${raw}`);
}

function checkWrite(raw, allowlist, secrets, ctx) {
  const { agentId } = ctx;
  checkSecretText(raw, secrets, agentId, "書き込み先");
  const forms = targetForms(raw, ctx, "書き込み");
  applyWriteRules(forms, allowlist, secrets, agentId, raw, "書き込み");
}

// 既に絶対パスに解いた win 形の書き出し先を、書き込みの規則で照合する（Bash の git format-patch・tsc 用）。
function checkWriteWin(winAbs, allowlist, secrets, agentId, raw, label) {
  const real = realize(winAbs);
  if (real.error) block(`${agentId}: ${label}を止めました（${real.error}）: ${raw}`);
  applyWriteRules([keyOf(winAbs), keyOf(real.win)], allowlist, secrets, agentId, raw, label);
}

// ---- 読み込み ----

function checkReadTarget(raw, allowlist, secrets, ctx, search) {
  const { agentId } = ctx;
  checkSecretText(raw, secrets, agentId, "読む場所");
  const forms = targetForms(raw, ctx, "読み込み");
  checkSecretPath(forms, secrets, agentId, raw, search);
  const rules = compileRules(allowlist.read_paths, true, false);
  if (!forms.every((t) => rules.some((rule) => ruleMatches(rule, t.segs)))) {
    block(`${agentId}: 読むことを許可していない場所です: ${raw}（read_paths: ${allowlist.read_paths.join(", ") || "なし"}）`);
  }
}

function checkGlobPattern(pattern, label, secrets, agentId) {
  if (typeof pattern !== "string") block(`${agentId}: ${label} が文字列ではないため止めました`);
  checkSecretText(pattern, secrets, agentId, label);
  const p = pattern.replace(/\\/g, "/");
  if (p.includes("..")) block(`${agentId}: ${label} に .. を含むため止めました: ${pattern}`);
  if (/^[\/~]/.test(p) || p.includes(":") || /[{,]\s*[\/~]/.test(p)) {
    block(`${agentId}: ${label} が絶対パス（/ ~ ドライブ）を含むため止めました: ${pattern}`);
  }
}

// ---- Agent・Skill・SendMessage ----

function checkAgent(subagentType, allowlist, agentId) {
  const unspecified = subagentType === undefined || subagentType === null || subagentType === "";
  if (!unspecified && typeof subagentType !== "string") block(`${agentId}: subagent_type が文字列ではないため止めました`);
  const target = unspecified ? "general-purpose" : subagentType;
  if (!allowlist.agents.includes(target)) block(`${agentId}: 起動を許可していないエージェントです: ${target}`);
}

function checkSkill(skill, allowlist, agentId) {
  if (typeof skill !== "string" || !allowlist.skills.includes(skill)) {
    block(`${agentId}: 許可していないスキルです: ${skill}`);
  }
}

function checkSendMessage(to, allowlist, agentId) {
  if (typeof to !== "string" || !(to === "main" || allowlist.agents.includes(to))) {
    block(`${agentId}: SendMessage で送ることを許可していない宛先です: ${JSON.stringify(to)}`);
  }
}

// ---- main ----

function main() {
  const argId = process.argv.length > 2 ? process.argv[2] : undefined;
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", () => {
    let event;
    try {
      event = JSON.parse(raw);
    } catch (err) {
      block(`フックの入力を読めませんでした: ${err.message}`);
    }
    if (!isPlainObject(event)) block("フックの入力がオブジェクトではありません（配列・null・文字列・数を含む）");
    const agent = resolveAgent(argId, event);
    if (!agent) process.exit(0);
    const { agentId, agentDir } = agent;
    // ここから下はメンバーの呼び出し。形の違う入力は、空や既定の値と見なさずに止める
    const eventName = event.hook_event_name;
    if (eventName !== undefined && typeof eventName !== "string") {
      block(`${agentId}: フック入力の hook_event_name が文字列ではないため止めました`);
    }
    if (eventName !== undefined && eventName !== "PreToolUse") process.exit(0);
    if (typeof event.tool_name !== "string") block(`${agentId}: フック入力の tool_name が文字列ではないため止めました`);
    if (!isPlainObject(event.tool_input)) {
      block(`${agentId}: フック入力の tool_input がオブジェクトではないため止めました（無い・null・配列を含む）`);
    }
    if (event.cwd !== undefined && typeof event.cwd !== "string") {
      block(`${agentId}: フック入力の cwd が文字列ではないため止めました`);
    }

    const toolName = event.tool_name;
    let allowlist;
    if (agent.explore) {
      // Explore は定義を持たないので、tools の検査の代わりに、Read・Glob・Grep だけを固定で通す
      if (!EXPLORE_TOOLS.has(toolName)) {
        block(`${agentId}: 組み込みの Explore では Read・Glob・Grep だけを許可します（止めたツール: ${toolName || "(名前なし)"}）`);
      }
      allowlist = EXPLORE_ALLOWLIST;
    } else {
      allowlist = loadAllowlist(agentDir, agentId);
      checkTool(toolName, agentId);
    }

    const input = event.tool_input;
    // 相対パスは、作業ディレクトリがプロジェクト直下（または不明）のときだけ、プロジェクト直下から解く
    let cwd = null;
    if (typeof event.cwd === "string" && event.cwd !== "") {
      const normalized = normalizePath(event.cwd, false);
      if (normalized.error) block(`${agentId}: フック入力の cwd を解けないため止めました（${normalized.error}）: ${event.cwd}`);
      cwd = normalized.win;
    }
    const relativeOk = cwd === null || keyOf(cwd).key === keyOf(PROJECT_DIR).key;
    const ctx = { agentId, relativeOk, cwdWin: cwd || PROJECT_DIR };
    const lazySecrets = () => compileSecrets(allowlist.secret_paths);

    if (toolName === "Bash" || toolName === "PowerShell") {
      checkBash(input.command, allowlist, lazySecrets(), ctx);
    } else if (WRITE_TOOLS.has(toolName)) {
      const target = toolName === "NotebookEdit" ? input.notebook_path : input.file_path;
      checkWrite(target, allowlist, lazySecrets(), ctx);
    } else if (toolName === "Read") {
      checkReadTarget(input.file_path, allowlist, lazySecrets(), ctx, false);
    } else if (toolName === "Glob" || toolName === "Grep") {
      const secrets = lazySecrets();
      if (toolName === "Glob") checkGlobPattern(input.pattern, "Glob の pattern", secrets, agentId);
      if (toolName === "Grep" && input.glob !== undefined) checkGlobPattern(input.glob, "Grep の glob", secrets, agentId);
      // path を省いた（未定義・空文字）ときだけ既定の範囲にする。null・配列などは normalizePath が止める
      const where = input.path === undefined || input.path === "" ? cwd || PROJECT_DIR : input.path;
      checkReadTarget(where, allowlist, secrets, ctx, true);
    } else if (toolName === "Agent" || toolName === "Task") {
      checkAgent(input.subagent_type, allowlist, agentId);
    } else if (toolName === "Skill") {
      checkSkill(input.skill, allowlist, agentId);
    } else if (toolName === "SendMessage") {
      checkSendMessage(input.to, allowlist, agentId);
    }
    process.exit(0);
  });
}

main();
