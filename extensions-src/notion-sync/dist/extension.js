"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.mts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"), 1);
var os = __toESM(require("node:os"), 1);
var path2 = __toESM(require("node:path"), 1);

// src/notion-client.mts
var NOTION_API_BASE = "https://api.notion.com/v1";
var NOTION_VERSION = "2025-09-03";
var MAX_PAYLOAD_BYTES = 5e5;
var MAX_CHILDREN_PER_APPEND = 100;
var MAX_ELEMENTS_PER_REQUEST = 1e3;
var NotionApiError = class extends Error {
  status;
  code;
  method;
  path;
  constructor(status, code, message, method, path3) {
    super(`Notion API ${method} ${path3} \u304C ${status} ${code}: ${message}`);
    this.name = "NotionApiError";
    this.status = status;
    this.code = code;
    this.method = method;
    this.path = path3;
  }
};
var NetworkError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "NetworkError";
  }
};
var PayloadTooLargeError = class extends Error {
  bytes;
  constructor(bytes, what) {
    super(`${what} \u306E\u9001\u308B\u91CF\u304C ${bytes} \u30D0\u30A4\u30C8\u3067\u3001\u4E0A\u9650 ${MAX_PAYLOAD_BYTES} \u3092\u8D85\u3048\u308B`);
    this.name = "PayloadTooLargeError";
    this.bytes = bytes;
  }
};
var defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
function retryDelayMs(retryAfter, attempt) {
  if (retryAfter != null && /^\s*\d+(\.\d+)?\s*$/.test(retryAfter)) {
    return Math.min(Math.ceil(Number(retryAfter) * 1e3), 6e4);
  }
  return Math.min(1e3 * 2 ** attempt, 3e4);
}
function countElements(blocks) {
  let n = 0;
  for (const b of blocks) {
    n += 1;
    const body = b[b.type];
    if (body && Array.isArray(body.rich_text)) n += body.rich_text.length;
  }
  return n;
}
function byteLength(s) {
  return Buffer.byteLength(s, "utf8");
}
function chunkForAppend(groups) {
  const out = [];
  let cur = [];
  const fits = (blocks) => blocks.length <= MAX_CHILDREN_PER_APPEND && countElements(blocks) <= MAX_ELEMENTS_PER_REQUEST && byteLength(JSON.stringify({ children: blocks })) <= MAX_PAYLOAD_BYTES;
  for (const g of groups) {
    if (!fits(g)) throw new PayloadTooLargeError(byteLength(JSON.stringify({ children: g })), "1\u3064\u306E\u30D5\u30A1\u30A4\u30EB\u306E\u30D6\u30ED\u30C3\u30AF");
    const next = [...cur, ...g];
    if (fits(next)) cur = next;
    else {
      if (cur.length) out.push(cur);
      cur = [...g];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}
function createNotionClient(opts) {
  const token = opts.token;
  if (!token) throw new Error("\u30C8\u30FC\u30AF\u30F3\u304C\u7121\u3044");
  const doFetch = opts.fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.now ?? (() => Date.now());
  const maxRetries = opts.maxRetries ?? 5;
  const minInterval = opts.minIntervalMs ?? 350;
  const base = (opts.baseUrl ?? NOTION_API_BASE).replace(/\/+$/, "");
  const version = opts.notionVersion ?? NOTION_VERSION;
  let lastAt = -Infinity;
  async function request(method, path3, body) {
    const payload = body === void 0 ? void 0 : JSON.stringify(body);
    if (payload !== void 0 && byteLength(payload) > MAX_PAYLOAD_BYTES) {
      throw new PayloadTooLargeError(byteLength(payload), `${method} ${path3}`);
    }
    const headers = {
      Authorization: `Bearer ${token}`,
      "Notion-Version": version
    };
    if (payload !== void 0) headers["Content-Type"] = "application/json";
    for (let attempt = 0; ; attempt++) {
      const wait = lastAt + minInterval - now();
      if (wait > 0) await sleep(wait);
      lastAt = now();
      let res;
      try {
        res = await doFetch(base + path3, { method, headers, body: payload });
      } catch (e) {
        throw new NetworkError(`Notion \u306B\u63A5\u7D9A\u3067\u304D\u306A\u3044\uFF08${method} ${path3}\uFF09: ${e?.message ?? String(e)}`);
      }
      const text = await res.text();
      if (res.status >= 200 && res.status < 300) {
        if (!text) return {};
        try {
          return JSON.parse(text);
        } catch {
          throw new NotionApiError(res.status, "invalid_json", "\u5FDC\u7B54\u304C JSON \u3067\u306A\u3044", method, path3);
        }
      }
      if ((res.status === 429 || res.status === 529) && attempt < maxRetries) {
        await sleep(retryDelayMs(res.headers.get("retry-after"), attempt));
        continue;
      }
      let code = "unknown";
      let message = text.slice(0, 300);
      try {
        const j = JSON.parse(text);
        if (typeof j.code === "string") code = j.code;
        if (typeof j.message === "string") message = j.message;
      } catch {
      }
      throw new NotionApiError(res.status, code, message, method, path3);
    }
  }
  const enc = encodeURIComponent;
  return {
    async listChildren(blockId) {
      const out = [];
      let cursor = null;
      for (let guard = 0; guard < 1e3; guard++) {
        const q = cursor ? `?page_size=100&start_cursor=${enc(cursor)}` : "?page_size=100";
        const r = await request("GET", `/blocks/${enc(blockId)}/children${q}`);
        if (Array.isArray(r.results)) out.push(...r.results);
        if (!r.has_more || !r.next_cursor) return out;
        cursor = r.next_cursor;
      }
      throw new Error("\u5B50\u306E\u30D6\u30ED\u30C3\u30AF\u306E\u30DA\u30FC\u30B8\u9001\u308A\u304C\u7D42\u308F\u3089\u306A\u3044");
    },
    async getBlock(blockId) {
      return await request("GET", `/blocks/${enc(blockId)}`);
    },
    async updateCode(blockId, richText, language = "json") {
      return await request("PATCH", `/blocks/${enc(blockId)}`, {
        type: "code",
        code: { rich_text: richText, language }
      });
    },
    async appendChildren(parentId, children) {
      if (children.length > MAX_CHILDREN_PER_APPEND) throw new Error(`children \u306F ${MAX_CHILDREN_PER_APPEND} \u500B\u307E\u3067`);
      const r = await request("PATCH", `/blocks/${enc(parentId)}/children`, { children });
      return Array.isArray(r.results) ? r.results : [];
    },
    async deleteBlock(blockId) {
      await request("DELETE", `/blocks/${enc(blockId)}`);
    }
  };
}

// src/names.mts
var FIXED_FILES = Object.freeze(["settings.json", "keybindings.json", "tasks.json"]);
var MANIFEST_HEADING = "manifest";
var BAD_CHARS = /[\\/:*?"<>|\u0000-\u001f]/;
var RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
function isSyncableName(name) {
  if (typeof name !== "string" || name.length === 0 || name.length > 200) return false;
  if (FIXED_FILES.includes(name)) return true;
  const m = /^snippets\/(.+)$/.exec(name);
  if (!m) return false;
  const base = m[1];
  if (BAD_CHARS.test(base)) return false;
  if (base.startsWith(".") || base.endsWith(".") || base.endsWith(" ")) return false;
  if (RESERVED.test(base)) return false;
  return /\.json$/i.test(base) || /\.code-snippets$/i.test(base);
}
function compareNames(a, b) {
  const rank = (n) => n === "settings.json" ? 0 : n === "keybindings.json" ? 1 : n.startsWith("snippets/") ? 2 : n === "tasks.json" ? 3 : 4;
  const d = rank(a) - rank(b);
  if (d !== 0) return d;
  return a < b ? -1 : a > b ? 1 : 0;
}
function normalizePageId(input) {
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (!s) return null;
  s = s.replace(/[?#].*$/, "");
  const last = s.split("/").pop() ?? s;
  const dashed = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(last);
  let hex = null;
  if (dashed) hex = dashed[1].replace(/-/g, "");
  else {
    const plain = /([0-9a-f]{32})$/i.exec(last);
    if (plain) hex = plain[1];
  }
  if (!hex) return null;
  hex = hex.toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// node_modules/.pnpm/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/main.js
var main_exports = {};
__export(main_exports, {
  ParseErrorCode: () => ParseErrorCode,
  ScanError: () => ScanError,
  SyntaxKind: () => SyntaxKind,
  applyEdits: () => applyEdits,
  createScanner: () => createScanner2,
  findNodeAtLocation: () => findNodeAtLocation2,
  findNodeAtOffset: () => findNodeAtOffset2,
  format: () => format2,
  getLocation: () => getLocation2,
  getNodePath: () => getNodePath2,
  getNodeValue: () => getNodeValue2,
  modify: () => modify,
  parse: () => parse2,
  parseTree: () => parseTree2,
  printParseErrorCode: () => printParseErrorCode,
  stripComments: () => stripComments2,
  visit: () => visit2
});

// node_modules/.pnpm/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/impl/scanner.js
function createScanner(text, ignoreTrivia = false) {
  const len = text.length;
  let pos = 0, value = "", tokenOffset = 0, token = 16, lineNumber = 0, lineStartOffset = 0, tokenLineStartOffset = 0, prevTokenLineStartOffset = 0, scanError = 0;
  function scanHexDigits(count, exact) {
    let digits = 0;
    let value2 = 0;
    while (digits < count || !exact) {
      let ch = text.charCodeAt(pos);
      if (ch >= 48 && ch <= 57) {
        value2 = value2 * 16 + ch - 48;
      } else if (ch >= 65 && ch <= 70) {
        value2 = value2 * 16 + ch - 65 + 10;
      } else if (ch >= 97 && ch <= 102) {
        value2 = value2 * 16 + ch - 97 + 10;
      } else {
        break;
      }
      pos++;
      digits++;
    }
    if (digits < count) {
      value2 = -1;
    }
    return value2;
  }
  function setPosition(newPosition) {
    pos = newPosition;
    value = "";
    tokenOffset = 0;
    token = 16;
    scanError = 0;
  }
  function scanNumber() {
    let start = pos;
    if (text.charCodeAt(pos) === 48) {
      pos++;
    } else {
      pos++;
      while (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
      }
    }
    if (pos < text.length && text.charCodeAt(pos) === 46) {
      pos++;
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
      } else {
        scanError = 3;
        return text.substring(start, pos);
      }
    }
    let end = pos;
    if (pos < text.length && (text.charCodeAt(pos) === 69 || text.charCodeAt(pos) === 101)) {
      pos++;
      if (pos < text.length && text.charCodeAt(pos) === 43 || text.charCodeAt(pos) === 45) {
        pos++;
      }
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
        end = pos;
      } else {
        scanError = 3;
      }
    }
    return text.substring(start, end);
  }
  function scanString() {
    let result = "", start = pos;
    while (true) {
      if (pos >= len) {
        result += text.substring(start, pos);
        scanError = 2;
        break;
      }
      const ch = text.charCodeAt(pos);
      if (ch === 34) {
        result += text.substring(start, pos);
        pos++;
        break;
      }
      if (ch === 92) {
        result += text.substring(start, pos);
        pos++;
        if (pos >= len) {
          scanError = 2;
          break;
        }
        const ch2 = text.charCodeAt(pos++);
        switch (ch2) {
          case 34:
            result += '"';
            break;
          case 92:
            result += "\\";
            break;
          case 47:
            result += "/";
            break;
          case 98:
            result += "\b";
            break;
          case 102:
            result += "\f";
            break;
          case 110:
            result += "\n";
            break;
          case 114:
            result += "\r";
            break;
          case 116:
            result += "	";
            break;
          case 117:
            const ch3 = scanHexDigits(4, true);
            if (ch3 >= 0) {
              result += String.fromCharCode(ch3);
            } else {
              scanError = 4;
            }
            break;
          default:
            scanError = 5;
        }
        start = pos;
        continue;
      }
      if (ch >= 0 && ch <= 31) {
        if (isLineBreak(ch)) {
          result += text.substring(start, pos);
          scanError = 2;
          break;
        } else {
          scanError = 6;
        }
      }
      pos++;
    }
    return result;
  }
  function scanNext() {
    value = "";
    scanError = 0;
    tokenOffset = pos;
    lineStartOffset = lineNumber;
    prevTokenLineStartOffset = tokenLineStartOffset;
    if (pos >= len) {
      tokenOffset = len;
      return token = 17;
    }
    let code = text.charCodeAt(pos);
    if (isWhiteSpace(code)) {
      do {
        pos++;
        value += String.fromCharCode(code);
        code = text.charCodeAt(pos);
      } while (isWhiteSpace(code));
      return token = 15;
    }
    if (isLineBreak(code)) {
      pos++;
      value += String.fromCharCode(code);
      if (code === 13 && text.charCodeAt(pos) === 10) {
        pos++;
        value += "\n";
      }
      lineNumber++;
      tokenLineStartOffset = pos;
      return token = 14;
    }
    switch (code) {
      // tokens: []{}:,
      case 123:
        pos++;
        return token = 1;
      case 125:
        pos++;
        return token = 2;
      case 91:
        pos++;
        return token = 3;
      case 93:
        pos++;
        return token = 4;
      case 58:
        pos++;
        return token = 6;
      case 44:
        pos++;
        return token = 5;
      // strings
      case 34:
        pos++;
        value = scanString();
        return token = 10;
      // comments
      case 47:
        const start = pos - 1;
        if (text.charCodeAt(pos + 1) === 47) {
          pos += 2;
          while (pos < len) {
            if (isLineBreak(text.charCodeAt(pos))) {
              break;
            }
            pos++;
          }
          value = text.substring(start, pos);
          return token = 12;
        }
        if (text.charCodeAt(pos + 1) === 42) {
          pos += 2;
          const safeLength = len - 1;
          let commentClosed = false;
          while (pos < safeLength) {
            const ch = text.charCodeAt(pos);
            if (ch === 42 && text.charCodeAt(pos + 1) === 47) {
              pos += 2;
              commentClosed = true;
              break;
            }
            pos++;
            if (isLineBreak(ch)) {
              if (ch === 13 && text.charCodeAt(pos) === 10) {
                pos++;
              }
              lineNumber++;
              tokenLineStartOffset = pos;
            }
          }
          if (!commentClosed) {
            pos++;
            scanError = 1;
          }
          value = text.substring(start, pos);
          return token = 13;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16;
      // numbers
      case 45:
        value += String.fromCharCode(code);
        pos++;
        if (pos === len || !isDigit(text.charCodeAt(pos))) {
          return token = 16;
        }
      // found a minus, followed by a number so
      // we fall through to proceed with scanning
      // numbers
      case 48:
      case 49:
      case 50:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 56:
      case 57:
        value += scanNumber();
        return token = 11;
      // literals and unknown symbols
      default:
        while (pos < len && isUnknownContentCharacter(code)) {
          pos++;
          code = text.charCodeAt(pos);
        }
        if (tokenOffset !== pos) {
          value = text.substring(tokenOffset, pos);
          switch (value) {
            case "true":
              return token = 8;
            case "false":
              return token = 9;
            case "null":
              return token = 7;
          }
          return token = 16;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16;
    }
  }
  function isUnknownContentCharacter(code) {
    if (isWhiteSpace(code) || isLineBreak(code)) {
      return false;
    }
    switch (code) {
      case 125:
      case 93:
      case 123:
      case 91:
      case 34:
      case 58:
      case 44:
      case 47:
        return false;
    }
    return true;
  }
  function scanNextNonTrivia() {
    let result;
    do {
      result = scanNext();
    } while (result >= 12 && result <= 15);
    return result;
  }
  return {
    setPosition,
    getPosition: () => pos,
    scan: ignoreTrivia ? scanNextNonTrivia : scanNext,
    getToken: () => token,
    getTokenValue: () => value,
    getTokenOffset: () => tokenOffset,
    getTokenLength: () => pos - tokenOffset,
    getTokenStartLine: () => lineStartOffset,
    getTokenStartCharacter: () => tokenOffset - prevTokenLineStartOffset,
    getTokenError: () => scanError
  };
}
function isWhiteSpace(ch) {
  return ch === 32 || ch === 9;
}
function isLineBreak(ch) {
  return ch === 10 || ch === 13;
}
function isDigit(ch) {
  return ch >= 48 && ch <= 57;
}
var CharacterCodes;
(function(CharacterCodes2) {
  CharacterCodes2[CharacterCodes2["lineFeed"] = 10] = "lineFeed";
  CharacterCodes2[CharacterCodes2["carriageReturn"] = 13] = "carriageReturn";
  CharacterCodes2[CharacterCodes2["space"] = 32] = "space";
  CharacterCodes2[CharacterCodes2["_0"] = 48] = "_0";
  CharacterCodes2[CharacterCodes2["_1"] = 49] = "_1";
  CharacterCodes2[CharacterCodes2["_2"] = 50] = "_2";
  CharacterCodes2[CharacterCodes2["_3"] = 51] = "_3";
  CharacterCodes2[CharacterCodes2["_4"] = 52] = "_4";
  CharacterCodes2[CharacterCodes2["_5"] = 53] = "_5";
  CharacterCodes2[CharacterCodes2["_6"] = 54] = "_6";
  CharacterCodes2[CharacterCodes2["_7"] = 55] = "_7";
  CharacterCodes2[CharacterCodes2["_8"] = 56] = "_8";
  CharacterCodes2[CharacterCodes2["_9"] = 57] = "_9";
  CharacterCodes2[CharacterCodes2["a"] = 97] = "a";
  CharacterCodes2[CharacterCodes2["b"] = 98] = "b";
  CharacterCodes2[CharacterCodes2["c"] = 99] = "c";
  CharacterCodes2[CharacterCodes2["d"] = 100] = "d";
  CharacterCodes2[CharacterCodes2["e"] = 101] = "e";
  CharacterCodes2[CharacterCodes2["f"] = 102] = "f";
  CharacterCodes2[CharacterCodes2["g"] = 103] = "g";
  CharacterCodes2[CharacterCodes2["h"] = 104] = "h";
  CharacterCodes2[CharacterCodes2["i"] = 105] = "i";
  CharacterCodes2[CharacterCodes2["j"] = 106] = "j";
  CharacterCodes2[CharacterCodes2["k"] = 107] = "k";
  CharacterCodes2[CharacterCodes2["l"] = 108] = "l";
  CharacterCodes2[CharacterCodes2["m"] = 109] = "m";
  CharacterCodes2[CharacterCodes2["n"] = 110] = "n";
  CharacterCodes2[CharacterCodes2["o"] = 111] = "o";
  CharacterCodes2[CharacterCodes2["p"] = 112] = "p";
  CharacterCodes2[CharacterCodes2["q"] = 113] = "q";
  CharacterCodes2[CharacterCodes2["r"] = 114] = "r";
  CharacterCodes2[CharacterCodes2["s"] = 115] = "s";
  CharacterCodes2[CharacterCodes2["t"] = 116] = "t";
  CharacterCodes2[CharacterCodes2["u"] = 117] = "u";
  CharacterCodes2[CharacterCodes2["v"] = 118] = "v";
  CharacterCodes2[CharacterCodes2["w"] = 119] = "w";
  CharacterCodes2[CharacterCodes2["x"] = 120] = "x";
  CharacterCodes2[CharacterCodes2["y"] = 121] = "y";
  CharacterCodes2[CharacterCodes2["z"] = 122] = "z";
  CharacterCodes2[CharacterCodes2["A"] = 65] = "A";
  CharacterCodes2[CharacterCodes2["B"] = 66] = "B";
  CharacterCodes2[CharacterCodes2["C"] = 67] = "C";
  CharacterCodes2[CharacterCodes2["D"] = 68] = "D";
  CharacterCodes2[CharacterCodes2["E"] = 69] = "E";
  CharacterCodes2[CharacterCodes2["F"] = 70] = "F";
  CharacterCodes2[CharacterCodes2["G"] = 71] = "G";
  CharacterCodes2[CharacterCodes2["H"] = 72] = "H";
  CharacterCodes2[CharacterCodes2["I"] = 73] = "I";
  CharacterCodes2[CharacterCodes2["J"] = 74] = "J";
  CharacterCodes2[CharacterCodes2["K"] = 75] = "K";
  CharacterCodes2[CharacterCodes2["L"] = 76] = "L";
  CharacterCodes2[CharacterCodes2["M"] = 77] = "M";
  CharacterCodes2[CharacterCodes2["N"] = 78] = "N";
  CharacterCodes2[CharacterCodes2["O"] = 79] = "O";
  CharacterCodes2[CharacterCodes2["P"] = 80] = "P";
  CharacterCodes2[CharacterCodes2["Q"] = 81] = "Q";
  CharacterCodes2[CharacterCodes2["R"] = 82] = "R";
  CharacterCodes2[CharacterCodes2["S"] = 83] = "S";
  CharacterCodes2[CharacterCodes2["T"] = 84] = "T";
  CharacterCodes2[CharacterCodes2["U"] = 85] = "U";
  CharacterCodes2[CharacterCodes2["V"] = 86] = "V";
  CharacterCodes2[CharacterCodes2["W"] = 87] = "W";
  CharacterCodes2[CharacterCodes2["X"] = 88] = "X";
  CharacterCodes2[CharacterCodes2["Y"] = 89] = "Y";
  CharacterCodes2[CharacterCodes2["Z"] = 90] = "Z";
  CharacterCodes2[CharacterCodes2["asterisk"] = 42] = "asterisk";
  CharacterCodes2[CharacterCodes2["backslash"] = 92] = "backslash";
  CharacterCodes2[CharacterCodes2["closeBrace"] = 125] = "closeBrace";
  CharacterCodes2[CharacterCodes2["closeBracket"] = 93] = "closeBracket";
  CharacterCodes2[CharacterCodes2["colon"] = 58] = "colon";
  CharacterCodes2[CharacterCodes2["comma"] = 44] = "comma";
  CharacterCodes2[CharacterCodes2["dot"] = 46] = "dot";
  CharacterCodes2[CharacterCodes2["doubleQuote"] = 34] = "doubleQuote";
  CharacterCodes2[CharacterCodes2["minus"] = 45] = "minus";
  CharacterCodes2[CharacterCodes2["openBrace"] = 123] = "openBrace";
  CharacterCodes2[CharacterCodes2["openBracket"] = 91] = "openBracket";
  CharacterCodes2[CharacterCodes2["plus"] = 43] = "plus";
  CharacterCodes2[CharacterCodes2["slash"] = 47] = "slash";
  CharacterCodes2[CharacterCodes2["formFeed"] = 12] = "formFeed";
  CharacterCodes2[CharacterCodes2["tab"] = 9] = "tab";
})(CharacterCodes || (CharacterCodes = {}));

// node_modules/.pnpm/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/impl/string-intern.js
var cachedSpaces = new Array(20).fill(0).map((_, index) => {
  return " ".repeat(index);
});
var maxCachedValues = 200;
var cachedBreakLinesWithSpaces = {
  " ": {
    "\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\n" + " ".repeat(index);
    }),
    "\r": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r" + " ".repeat(index);
    }),
    "\r\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r\n" + " ".repeat(index);
    })
  },
  "	": {
    "\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\n" + "	".repeat(index);
    }),
    "\r": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r" + "	".repeat(index);
    }),
    "\r\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r\n" + "	".repeat(index);
    })
  }
};
var supportedEols = ["\n", "\r", "\r\n"];

// node_modules/.pnpm/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/impl/format.js
function format(documentText, range, options) {
  let initialIndentLevel;
  let formatText;
  let formatTextStart;
  let rangeStart;
  let rangeEnd;
  if (range) {
    rangeStart = range.offset;
    rangeEnd = rangeStart + range.length;
    formatTextStart = rangeStart;
    while (formatTextStart > 0 && !isEOL(documentText, formatTextStart - 1)) {
      formatTextStart--;
    }
    let endOffset = rangeEnd;
    while (endOffset < documentText.length && !isEOL(documentText, endOffset)) {
      endOffset++;
    }
    formatText = documentText.substring(formatTextStart, endOffset);
    initialIndentLevel = computeIndentLevel(formatText, options);
  } else {
    formatText = documentText;
    initialIndentLevel = 0;
    formatTextStart = 0;
    rangeStart = 0;
    rangeEnd = documentText.length;
  }
  const eol = getEOL(options, documentText);
  const eolFastPathSupported = supportedEols.includes(eol);
  let numberLineBreaks = 0;
  let indentLevel = 0;
  let indentValue;
  if (options.insertSpaces) {
    indentValue = cachedSpaces[options.tabSize || 4] ?? repeat(cachedSpaces[1], options.tabSize || 4);
  } else {
    indentValue = "	";
  }
  const indentType = indentValue === "	" ? "	" : " ";
  let scanner = createScanner(formatText, false);
  let hasError = false;
  function newLinesAndIndent() {
    if (numberLineBreaks > 1) {
      return repeat(eol, numberLineBreaks) + repeat(indentValue, initialIndentLevel + indentLevel);
    }
    const amountOfSpaces = indentValue.length * (initialIndentLevel + indentLevel);
    if (!eolFastPathSupported || amountOfSpaces > cachedBreakLinesWithSpaces[indentType][eol].length) {
      return eol + repeat(indentValue, initialIndentLevel + indentLevel);
    }
    if (amountOfSpaces <= 0) {
      return eol;
    }
    return cachedBreakLinesWithSpaces[indentType][eol][amountOfSpaces];
  }
  function scanNext() {
    let token = scanner.scan();
    numberLineBreaks = 0;
    while (token === 15 || token === 14) {
      if (token === 14 && options.keepLines) {
        numberLineBreaks += 1;
      } else if (token === 14) {
        numberLineBreaks = 1;
      }
      token = scanner.scan();
    }
    hasError = token === 16 || scanner.getTokenError() !== 0;
    return token;
  }
  const editOperations = [];
  function addEdit(text, startOffset, endOffset) {
    if (!hasError && (!range || startOffset < rangeEnd && endOffset > rangeStart) && documentText.substring(startOffset, endOffset) !== text) {
      editOperations.push({ offset: startOffset, length: endOffset - startOffset, content: text });
    }
  }
  let firstToken = scanNext();
  if (options.keepLines && numberLineBreaks > 0) {
    addEdit(repeat(eol, numberLineBreaks), 0, 0);
  }
  if (firstToken !== 17) {
    let firstTokenStart = scanner.getTokenOffset() + formatTextStart;
    let initialIndent = indentValue.length * initialIndentLevel < 20 && options.insertSpaces ? cachedSpaces[indentValue.length * initialIndentLevel] : repeat(indentValue, initialIndentLevel);
    addEdit(initialIndent, formatTextStart, firstTokenStart);
  }
  while (firstToken !== 17) {
    let firstTokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + formatTextStart;
    let secondToken = scanNext();
    let replaceContent = "";
    let needsLineBreak = false;
    while (numberLineBreaks === 0 && (secondToken === 12 || secondToken === 13)) {
      let commentTokenStart = scanner.getTokenOffset() + formatTextStart;
      addEdit(cachedSpaces[1], firstTokenEnd, commentTokenStart);
      firstTokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + formatTextStart;
      needsLineBreak = secondToken === 12;
      replaceContent = needsLineBreak ? newLinesAndIndent() : "";
      secondToken = scanNext();
    }
    if (secondToken === 2) {
      if (firstToken !== 1) {
        indentLevel--;
      }
      ;
      if (options.keepLines && numberLineBreaks > 0 || !options.keepLines && firstToken !== 1) {
        replaceContent = newLinesAndIndent();
      } else if (options.keepLines) {
        replaceContent = cachedSpaces[1];
      }
    } else if (secondToken === 4) {
      if (firstToken !== 3) {
        indentLevel--;
      }
      ;
      if (options.keepLines && numberLineBreaks > 0 || !options.keepLines && firstToken !== 3) {
        replaceContent = newLinesAndIndent();
      } else if (options.keepLines) {
        replaceContent = cachedSpaces[1];
      }
    } else {
      switch (firstToken) {
        case 3:
        case 1:
          indentLevel++;
          if (options.keepLines && numberLineBreaks > 0 || !options.keepLines) {
            replaceContent = newLinesAndIndent();
          } else {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 5:
          if (options.keepLines && numberLineBreaks > 0 || !options.keepLines) {
            replaceContent = newLinesAndIndent();
          } else {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 12:
          replaceContent = newLinesAndIndent();
          break;
        case 13:
          if (numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else if (!needsLineBreak) {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 6:
          if (options.keepLines && numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else if (!needsLineBreak) {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 10:
          if (options.keepLines && numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else if (secondToken === 6 && !needsLineBreak) {
            replaceContent = "";
          }
          break;
        case 7:
        case 8:
        case 9:
        case 11:
        case 2:
        case 4:
          if (options.keepLines && numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else {
            if ((secondToken === 12 || secondToken === 13) && !needsLineBreak) {
              replaceContent = cachedSpaces[1];
            } else if (secondToken !== 5 && secondToken !== 17) {
              hasError = true;
            }
          }
          break;
        case 16:
          hasError = true;
          break;
      }
      if (numberLineBreaks > 0 && (secondToken === 12 || secondToken === 13)) {
        replaceContent = newLinesAndIndent();
      }
    }
    if (secondToken === 17) {
      if (options.keepLines && numberLineBreaks > 0) {
        replaceContent = newLinesAndIndent();
      } else {
        replaceContent = options.insertFinalNewline ? eol : "";
      }
    }
    const secondTokenStart = scanner.getTokenOffset() + formatTextStart;
    addEdit(replaceContent, firstTokenEnd, secondTokenStart);
    firstToken = secondToken;
  }
  return editOperations;
}
function repeat(s, count) {
  let result = "";
  for (let i = 0; i < count; i++) {
    result += s;
  }
  return result;
}
function computeIndentLevel(content, options) {
  let i = 0;
  let nChars = 0;
  const tabSize = options.tabSize || 4;
  while (i < content.length) {
    let ch = content.charAt(i);
    if (ch === cachedSpaces[1]) {
      nChars++;
    } else if (ch === "	") {
      nChars += tabSize;
    } else {
      break;
    }
    i++;
  }
  return Math.floor(nChars / tabSize);
}
function getEOL(options, text) {
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === "\r") {
      if (i + 1 < text.length && text.charAt(i + 1) === "\n") {
        return "\r\n";
      }
      return "\r";
    } else if (ch === "\n") {
      return "\n";
    }
  }
  return options && options.eol || "\n";
}
function isEOL(text, offset) {
  return "\r\n".indexOf(text.charAt(offset)) !== -1;
}

// node_modules/.pnpm/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/impl/parser.js
var ParseOptions;
(function(ParseOptions2) {
  ParseOptions2.DEFAULT = {
    allowTrailingComma: false
  };
})(ParseOptions || (ParseOptions = {}));
function getLocation(text, position) {
  const segments = [];
  const earlyReturnException = new Object();
  let previousNode = void 0;
  const previousNodeInst = {
    value: {},
    offset: 0,
    length: 0,
    type: "object",
    parent: void 0
  };
  let isAtPropertyKey = false;
  function setPreviousNode(value, offset, length, type) {
    previousNodeInst.value = value;
    previousNodeInst.offset = offset;
    previousNodeInst.length = length;
    previousNodeInst.type = type;
    previousNodeInst.colonOffset = void 0;
    previousNode = previousNodeInst;
  }
  try {
    visit(text, {
      onObjectBegin: (offset, length) => {
        if (position <= offset) {
          throw earlyReturnException;
        }
        previousNode = void 0;
        isAtPropertyKey = position > offset;
        segments.push("");
      },
      onObjectProperty: (name, offset, length) => {
        if (position < offset) {
          throw earlyReturnException;
        }
        setPreviousNode(name, offset, length, "property");
        segments[segments.length - 1] = name;
        if (position <= offset + length) {
          throw earlyReturnException;
        }
      },
      onObjectEnd: (offset, length) => {
        if (position <= offset) {
          throw earlyReturnException;
        }
        previousNode = void 0;
        segments.pop();
      },
      onArrayBegin: (offset, length) => {
        if (position <= offset) {
          throw earlyReturnException;
        }
        previousNode = void 0;
        segments.push(0);
      },
      onArrayEnd: (offset, length) => {
        if (position <= offset) {
          throw earlyReturnException;
        }
        previousNode = void 0;
        segments.pop();
      },
      onLiteralValue: (value, offset, length) => {
        if (position < offset) {
          throw earlyReturnException;
        }
        setPreviousNode(value, offset, length, getNodeType(value));
        if (position <= offset + length) {
          throw earlyReturnException;
        }
      },
      onSeparator: (sep2, offset, length) => {
        if (position <= offset) {
          throw earlyReturnException;
        }
        if (sep2 === ":" && previousNode && previousNode.type === "property") {
          previousNode.colonOffset = offset;
          isAtPropertyKey = false;
          previousNode = void 0;
        } else if (sep2 === ",") {
          const last = segments[segments.length - 1];
          if (typeof last === "number") {
            segments[segments.length - 1] = last + 1;
          } else {
            isAtPropertyKey = true;
            segments[segments.length - 1] = "";
          }
          previousNode = void 0;
        }
      }
    });
  } catch (e) {
    if (e !== earlyReturnException) {
      throw e;
    }
  }
  return {
    path: segments,
    previousNode,
    isAtPropertyKey,
    matches: (pattern) => {
      let k = 0;
      for (let i = 0; k < pattern.length && i < segments.length; i++) {
        if (pattern[k] === segments[i] || pattern[k] === "*") {
          k++;
        } else if (pattern[k] !== "**") {
          return false;
        }
      }
      return k === pattern.length;
    }
  };
}
function parse(text, errors = [], options = ParseOptions.DEFAULT) {
  let currentProperty = null;
  let currentParent = [];
  const previousParents = [];
  function onValue(value) {
    if (Array.isArray(currentParent)) {
      currentParent.push(value);
    } else if (currentProperty !== null) {
      currentParent[currentProperty] = value;
    }
  }
  const visitor = {
    onObjectBegin: () => {
      const object = {};
      onValue(object);
      previousParents.push(currentParent);
      currentParent = object;
      currentProperty = null;
    },
    onObjectProperty: (name) => {
      currentProperty = name;
    },
    onObjectEnd: () => {
      currentParent = previousParents.pop();
    },
    onArrayBegin: () => {
      const array = [];
      onValue(array);
      previousParents.push(currentParent);
      currentParent = array;
      currentProperty = null;
    },
    onArrayEnd: () => {
      currentParent = previousParents.pop();
    },
    onLiteralValue: onValue,
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    }
  };
  visit(text, visitor, options);
  return currentParent[0];
}
function parseTree(text, errors = [], options = ParseOptions.DEFAULT) {
  let currentParent = { type: "array", offset: -1, length: -1, children: [], parent: void 0 };
  function ensurePropertyComplete(endOffset) {
    if (currentParent.type === "property") {
      currentParent.length = endOffset - currentParent.offset;
      currentParent = currentParent.parent;
    }
  }
  function onValue(valueNode) {
    currentParent.children.push(valueNode);
    return valueNode;
  }
  const visitor = {
    onObjectBegin: (offset) => {
      currentParent = onValue({ type: "object", offset, length: -1, parent: currentParent, children: [] });
    },
    onObjectProperty: (name, offset, length) => {
      currentParent = onValue({ type: "property", offset, length: -1, parent: currentParent, children: [] });
      currentParent.children.push({ type: "string", value: name, offset, length, parent: currentParent });
    },
    onObjectEnd: (offset, length) => {
      ensurePropertyComplete(offset + length);
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onArrayBegin: (offset, length) => {
      currentParent = onValue({ type: "array", offset, length: -1, parent: currentParent, children: [] });
    },
    onArrayEnd: (offset, length) => {
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onLiteralValue: (value, offset, length) => {
      onValue({ type: getNodeType(value), offset, length, parent: currentParent, value });
      ensurePropertyComplete(offset + length);
    },
    onSeparator: (sep2, offset, length) => {
      if (currentParent.type === "property") {
        if (sep2 === ":") {
          currentParent.colonOffset = offset;
        } else if (sep2 === ",") {
          ensurePropertyComplete(offset);
        }
      }
    },
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    }
  };
  visit(text, visitor, options);
  const result = currentParent.children[0];
  if (result) {
    delete result.parent;
  }
  return result;
}
function findNodeAtLocation(root, path3) {
  if (!root) {
    return void 0;
  }
  let node = root;
  for (let segment of path3) {
    if (typeof segment === "string") {
      if (node.type !== "object" || !Array.isArray(node.children)) {
        return void 0;
      }
      let found = false;
      for (const propertyNode of node.children) {
        if (Array.isArray(propertyNode.children) && propertyNode.children[0].value === segment && propertyNode.children.length === 2) {
          node = propertyNode.children[1];
          found = true;
          break;
        }
      }
      if (!found) {
        return void 0;
      }
    } else {
      const index = segment;
      if (node.type !== "array" || index < 0 || !Array.isArray(node.children) || index >= node.children.length) {
        return void 0;
      }
      node = node.children[index];
    }
  }
  return node;
}
function getNodePath(node) {
  if (!node.parent || !node.parent.children) {
    return [];
  }
  const path3 = getNodePath(node.parent);
  if (node.parent.type === "property") {
    const key = node.parent.children[0].value;
    path3.push(key);
  } else if (node.parent.type === "array") {
    const index = node.parent.children.indexOf(node);
    if (index !== -1) {
      path3.push(index);
    }
  }
  return path3;
}
function getNodeValue(node) {
  switch (node.type) {
    case "array":
      return node.children.map(getNodeValue);
    case "object":
      const obj = /* @__PURE__ */ Object.create(null);
      for (let prop of node.children) {
        const valueNode = prop.children[1];
        if (valueNode) {
          obj[prop.children[0].value] = getNodeValue(valueNode);
        }
      }
      return obj;
    case "null":
    case "string":
    case "number":
    case "boolean":
      return node.value;
    default:
      return void 0;
  }
}
function contains(node, offset, includeRightBound = false) {
  return offset >= node.offset && offset < node.offset + node.length || includeRightBound && offset === node.offset + node.length;
}
function findNodeAtOffset(node, offset, includeRightBound = false) {
  if (contains(node, offset, includeRightBound)) {
    const children = node.children;
    if (Array.isArray(children)) {
      for (let i = 0; i < children.length && children[i].offset <= offset; i++) {
        const item = findNodeAtOffset(children[i], offset, includeRightBound);
        if (item) {
          return item;
        }
      }
    }
    return node;
  }
  return void 0;
}
function visit(text, visitor, options = ParseOptions.DEFAULT) {
  const _scanner = createScanner(text, false);
  const _jsonPath = [];
  let suppressedCallbacks = 0;
  function toNoArgVisit(visitFunction) {
    return visitFunction ? () => suppressedCallbacks === 0 && visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter()) : () => true;
  }
  function toOneArgVisit(visitFunction) {
    return visitFunction ? (arg) => suppressedCallbacks === 0 && visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter()) : () => true;
  }
  function toOneArgVisitWithPath(visitFunction) {
    return visitFunction ? (arg) => suppressedCallbacks === 0 && visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter(), () => _jsonPath.slice()) : () => true;
  }
  function toBeginVisit(visitFunction) {
    return visitFunction ? () => {
      if (suppressedCallbacks > 0) {
        suppressedCallbacks++;
      } else {
        let cbReturn = visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter(), () => _jsonPath.slice());
        if (cbReturn === false) {
          suppressedCallbacks = 1;
        }
      }
    } : () => true;
  }
  function toEndVisit(visitFunction) {
    return visitFunction ? () => {
      if (suppressedCallbacks > 0) {
        suppressedCallbacks--;
      }
      if (suppressedCallbacks === 0) {
        visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter());
      }
    } : () => true;
  }
  const onObjectBegin = toBeginVisit(visitor.onObjectBegin), onObjectProperty = toOneArgVisitWithPath(visitor.onObjectProperty), onObjectEnd = toEndVisit(visitor.onObjectEnd), onArrayBegin = toBeginVisit(visitor.onArrayBegin), onArrayEnd = toEndVisit(visitor.onArrayEnd), onLiteralValue = toOneArgVisitWithPath(visitor.onLiteralValue), onSeparator = toOneArgVisit(visitor.onSeparator), onComment = toNoArgVisit(visitor.onComment), onError = toOneArgVisit(visitor.onError);
  const disallowComments = options && options.disallowComments;
  const allowTrailingComma = options && options.allowTrailingComma;
  function scanNext() {
    while (true) {
      const token = _scanner.scan();
      switch (_scanner.getTokenError()) {
        case 4:
          handleError(
            14
            /* ParseErrorCode.InvalidUnicode */
          );
          break;
        case 5:
          handleError(
            15
            /* ParseErrorCode.InvalidEscapeCharacter */
          );
          break;
        case 3:
          handleError(
            13
            /* ParseErrorCode.UnexpectedEndOfNumber */
          );
          break;
        case 1:
          if (!disallowComments) {
            handleError(
              11
              /* ParseErrorCode.UnexpectedEndOfComment */
            );
          }
          break;
        case 2:
          handleError(
            12
            /* ParseErrorCode.UnexpectedEndOfString */
          );
          break;
        case 6:
          handleError(
            16
            /* ParseErrorCode.InvalidCharacter */
          );
          break;
      }
      switch (token) {
        case 12:
        case 13:
          if (disallowComments) {
            handleError(
              10
              /* ParseErrorCode.InvalidCommentToken */
            );
          } else {
            onComment();
          }
          break;
        case 16:
          handleError(
            1
            /* ParseErrorCode.InvalidSymbol */
          );
          break;
        case 15:
        case 14:
          break;
        default:
          return token;
      }
    }
  }
  function handleError(error, skipUntilAfter = [], skipUntil = []) {
    onError(error);
    if (skipUntilAfter.length + skipUntil.length > 0) {
      let token = _scanner.getToken();
      while (token !== 17) {
        if (skipUntilAfter.indexOf(token) !== -1) {
          scanNext();
          break;
        } else if (skipUntil.indexOf(token) !== -1) {
          break;
        }
        token = scanNext();
      }
    }
  }
  function parseString(isValue) {
    const value = _scanner.getTokenValue();
    if (isValue) {
      onLiteralValue(value);
    } else {
      onObjectProperty(value);
      _jsonPath.push(value);
    }
    scanNext();
    return true;
  }
  function parseLiteral() {
    switch (_scanner.getToken()) {
      case 11:
        const tokenValue = _scanner.getTokenValue();
        let value = Number(tokenValue);
        if (isNaN(value)) {
          handleError(
            2
            /* ParseErrorCode.InvalidNumberFormat */
          );
          value = 0;
        }
        onLiteralValue(value);
        break;
      case 7:
        onLiteralValue(null);
        break;
      case 8:
        onLiteralValue(true);
        break;
      case 9:
        onLiteralValue(false);
        break;
      default:
        return false;
    }
    scanNext();
    return true;
  }
  function parseProperty() {
    if (_scanner.getToken() !== 10) {
      handleError(3, [], [
        2,
        5
        /* SyntaxKind.CommaToken */
      ]);
      return false;
    }
    parseString(false);
    if (_scanner.getToken() === 6) {
      onSeparator(":");
      scanNext();
      if (!parseValue()) {
        handleError(4, [], [
          2,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
    } else {
      handleError(5, [], [
        2,
        5
        /* SyntaxKind.CommaToken */
      ]);
    }
    _jsonPath.pop();
    return true;
  }
  function parseObject() {
    onObjectBegin();
    scanNext();
    let needsComma = false;
    while (_scanner.getToken() !== 2 && _scanner.getToken() !== 17) {
      if (_scanner.getToken() === 5) {
        if (!needsComma) {
          handleError(4, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 2 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6, [], []);
      }
      if (!parseProperty()) {
        handleError(4, [], [
          2,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
      needsComma = true;
    }
    onObjectEnd();
    if (_scanner.getToken() !== 2) {
      handleError(7, [
        2
        /* SyntaxKind.CloseBraceToken */
      ], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseArray() {
    onArrayBegin();
    scanNext();
    let isFirstElement = true;
    let needsComma = false;
    while (_scanner.getToken() !== 4 && _scanner.getToken() !== 17) {
      if (_scanner.getToken() === 5) {
        if (!needsComma) {
          handleError(4, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 4 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6, [], []);
      }
      if (isFirstElement) {
        _jsonPath.push(0);
        isFirstElement = false;
      } else {
        _jsonPath[_jsonPath.length - 1]++;
      }
      if (!parseValue()) {
        handleError(4, [], [
          4,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
      needsComma = true;
    }
    onArrayEnd();
    if (!isFirstElement) {
      _jsonPath.pop();
    }
    if (_scanner.getToken() !== 4) {
      handleError(8, [
        4
        /* SyntaxKind.CloseBracketToken */
      ], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseValue() {
    switch (_scanner.getToken()) {
      case 3:
        return parseArray();
      case 1:
        return parseObject();
      case 10:
        return parseString(true);
      default:
        return parseLiteral();
    }
  }
  scanNext();
  if (_scanner.getToken() === 17) {
    if (options.allowEmptyContent) {
      return true;
    }
    handleError(4, [], []);
    return false;
  }
  if (!parseValue()) {
    handleError(4, [], []);
    return false;
  }
  if (_scanner.getToken() !== 17) {
    handleError(9, [], []);
  }
  return true;
}
function stripComments(text, replaceCh) {
  let _scanner = createScanner(text), parts = [], kind, offset = 0, pos;
  do {
    pos = _scanner.getPosition();
    kind = _scanner.scan();
    switch (kind) {
      case 12:
      case 13:
      case 17:
        if (offset !== pos) {
          parts.push(text.substring(offset, pos));
        }
        if (replaceCh !== void 0) {
          parts.push(_scanner.getTokenValue().replace(/[^\r\n]/g, replaceCh));
        }
        offset = _scanner.getPosition();
        break;
    }
  } while (kind !== 17);
  return parts.join("");
}
function getNodeType(value) {
  switch (typeof value) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "string";
    case "object": {
      if (!value) {
        return "null";
      } else if (Array.isArray(value)) {
        return "array";
      }
      return "object";
    }
    default:
      return "null";
  }
}

// node_modules/.pnpm/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/impl/edit.js
function setProperty(text, originalPath, value, options) {
  const path3 = originalPath.slice();
  const errors = [];
  const root = parseTree(text, errors);
  let parent = void 0;
  let lastSegment = void 0;
  while (path3.length > 0) {
    lastSegment = path3.pop();
    parent = findNodeAtLocation(root, path3);
    if (parent === void 0 && value !== void 0) {
      if (typeof lastSegment === "string") {
        value = { [lastSegment]: value };
      } else {
        value = [value];
      }
    } else {
      break;
    }
  }
  if (!parent) {
    if (value === void 0) {
      throw new Error("Can not delete in empty document");
    }
    return withFormatting(text, { offset: root ? root.offset : 0, length: root ? root.length : 0, content: JSON.stringify(value) }, options);
  } else if (parent.type === "object" && typeof lastSegment === "string" && Array.isArray(parent.children)) {
    const existing = findNodeAtLocation(parent, [lastSegment]);
    if (existing !== void 0) {
      if (value === void 0) {
        if (!existing.parent) {
          throw new Error("Malformed AST");
        }
        const propertyIndex = parent.children.indexOf(existing.parent);
        let removeBegin;
        let removeEnd = existing.parent.offset + existing.parent.length;
        if (propertyIndex > 0) {
          let previous = parent.children[propertyIndex - 1];
          removeBegin = previous.offset + previous.length;
        } else {
          removeBegin = parent.offset + 1;
          if (parent.children.length > 1) {
            let next = parent.children[1];
            removeEnd = next.offset;
          }
        }
        return withFormatting(text, { offset: removeBegin, length: removeEnd - removeBegin, content: "" }, options);
      } else {
        return withFormatting(text, { offset: existing.offset, length: existing.length, content: JSON.stringify(value) }, options);
      }
    } else {
      if (value === void 0) {
        return [];
      }
      const newProperty = `${JSON.stringify(lastSegment)}: ${JSON.stringify(value)}`;
      const index = options.getInsertionIndex ? options.getInsertionIndex(parent.children.map((p) => p.children[0].value)) : parent.children.length;
      let edit;
      if (index > 0) {
        let previous = parent.children[index - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: "," + newProperty };
      } else if (parent.children.length === 0) {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty };
      } else {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty + "," };
      }
      return withFormatting(text, edit, options);
    }
  } else if (parent.type === "array" && typeof lastSegment === "number" && Array.isArray(parent.children)) {
    const insertIndex = lastSegment;
    if (insertIndex === -1) {
      const newProperty = `${JSON.stringify(value)}`;
      let edit;
      if (parent.children.length === 0) {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty };
      } else {
        const previous = parent.children[parent.children.length - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: "," + newProperty };
      }
      return withFormatting(text, edit, options);
    } else if (value === void 0 && parent.children.length >= 0) {
      const removalIndex = lastSegment;
      const toRemove = parent.children[removalIndex];
      let edit;
      if (parent.children.length === 1) {
        edit = { offset: parent.offset + 1, length: parent.length - 2, content: "" };
      } else if (parent.children.length - 1 === removalIndex) {
        let previous = parent.children[removalIndex - 1];
        let offset = previous.offset + previous.length;
        let parentEndOffset = parent.offset + parent.length;
        edit = { offset, length: parentEndOffset - 2 - offset, content: "" };
      } else {
        edit = { offset: toRemove.offset, length: parent.children[removalIndex + 1].offset - toRemove.offset, content: "" };
      }
      return withFormatting(text, edit, options);
    } else if (value !== void 0) {
      let edit;
      const newProperty = `${JSON.stringify(value)}`;
      if (!options.isArrayInsertion && parent.children.length > lastSegment) {
        const toModify = parent.children[lastSegment];
        edit = { offset: toModify.offset, length: toModify.length, content: newProperty };
      } else if (parent.children.length === 0 || lastSegment === 0) {
        edit = { offset: parent.offset + 1, length: 0, content: parent.children.length === 0 ? newProperty : newProperty + "," };
      } else {
        const index = lastSegment > parent.children.length ? parent.children.length : lastSegment;
        const previous = parent.children[index - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: "," + newProperty };
      }
      return withFormatting(text, edit, options);
    } else {
      throw new Error(`Can not ${value === void 0 ? "remove" : options.isArrayInsertion ? "insert" : "modify"} Array index ${insertIndex} as length is not sufficient`);
    }
  } else {
    throw new Error(`Can not add ${typeof lastSegment !== "number" ? "index" : "property"} to parent of type ${parent.type}`);
  }
}
function withFormatting(text, edit, options) {
  if (!options.formattingOptions) {
    return [edit];
  }
  let newText = applyEdit(text, edit);
  let begin = edit.offset;
  let end = edit.offset + edit.content.length;
  if (edit.length === 0 || edit.content.length === 0) {
    while (begin > 0 && !isEOL(newText, begin - 1)) {
      begin--;
    }
    while (end < newText.length && !isEOL(newText, end)) {
      end++;
    }
  }
  const edits = format(newText, { offset: begin, length: end - begin }, { ...options.formattingOptions, keepLines: false });
  for (let i = edits.length - 1; i >= 0; i--) {
    const edit2 = edits[i];
    newText = applyEdit(newText, edit2);
    begin = Math.min(begin, edit2.offset);
    end = Math.max(end, edit2.offset + edit2.length);
    end += edit2.content.length - edit2.length;
  }
  const editLength = text.length - (newText.length - end) - begin;
  return [{ offset: begin, length: editLength, content: newText.substring(begin, end) }];
}
function applyEdit(text, edit) {
  return text.substring(0, edit.offset) + edit.content + text.substring(edit.offset + edit.length);
}

// node_modules/.pnpm/jsonc-parser@3.3.1/node_modules/jsonc-parser/lib/esm/main.js
var createScanner2 = createScanner;
var ScanError;
(function(ScanError2) {
  ScanError2[ScanError2["None"] = 0] = "None";
  ScanError2[ScanError2["UnexpectedEndOfComment"] = 1] = "UnexpectedEndOfComment";
  ScanError2[ScanError2["UnexpectedEndOfString"] = 2] = "UnexpectedEndOfString";
  ScanError2[ScanError2["UnexpectedEndOfNumber"] = 3] = "UnexpectedEndOfNumber";
  ScanError2[ScanError2["InvalidUnicode"] = 4] = "InvalidUnicode";
  ScanError2[ScanError2["InvalidEscapeCharacter"] = 5] = "InvalidEscapeCharacter";
  ScanError2[ScanError2["InvalidCharacter"] = 6] = "InvalidCharacter";
})(ScanError || (ScanError = {}));
var SyntaxKind;
(function(SyntaxKind2) {
  SyntaxKind2[SyntaxKind2["OpenBraceToken"] = 1] = "OpenBraceToken";
  SyntaxKind2[SyntaxKind2["CloseBraceToken"] = 2] = "CloseBraceToken";
  SyntaxKind2[SyntaxKind2["OpenBracketToken"] = 3] = "OpenBracketToken";
  SyntaxKind2[SyntaxKind2["CloseBracketToken"] = 4] = "CloseBracketToken";
  SyntaxKind2[SyntaxKind2["CommaToken"] = 5] = "CommaToken";
  SyntaxKind2[SyntaxKind2["ColonToken"] = 6] = "ColonToken";
  SyntaxKind2[SyntaxKind2["NullKeyword"] = 7] = "NullKeyword";
  SyntaxKind2[SyntaxKind2["TrueKeyword"] = 8] = "TrueKeyword";
  SyntaxKind2[SyntaxKind2["FalseKeyword"] = 9] = "FalseKeyword";
  SyntaxKind2[SyntaxKind2["StringLiteral"] = 10] = "StringLiteral";
  SyntaxKind2[SyntaxKind2["NumericLiteral"] = 11] = "NumericLiteral";
  SyntaxKind2[SyntaxKind2["LineCommentTrivia"] = 12] = "LineCommentTrivia";
  SyntaxKind2[SyntaxKind2["BlockCommentTrivia"] = 13] = "BlockCommentTrivia";
  SyntaxKind2[SyntaxKind2["LineBreakTrivia"] = 14] = "LineBreakTrivia";
  SyntaxKind2[SyntaxKind2["Trivia"] = 15] = "Trivia";
  SyntaxKind2[SyntaxKind2["Unknown"] = 16] = "Unknown";
  SyntaxKind2[SyntaxKind2["EOF"] = 17] = "EOF";
})(SyntaxKind || (SyntaxKind = {}));
var getLocation2 = getLocation;
var parse2 = parse;
var parseTree2 = parseTree;
var findNodeAtLocation2 = findNodeAtLocation;
var findNodeAtOffset2 = findNodeAtOffset;
var getNodePath2 = getNodePath;
var getNodeValue2 = getNodeValue;
var visit2 = visit;
var stripComments2 = stripComments;
var ParseErrorCode;
(function(ParseErrorCode2) {
  ParseErrorCode2[ParseErrorCode2["InvalidSymbol"] = 1] = "InvalidSymbol";
  ParseErrorCode2[ParseErrorCode2["InvalidNumberFormat"] = 2] = "InvalidNumberFormat";
  ParseErrorCode2[ParseErrorCode2["PropertyNameExpected"] = 3] = "PropertyNameExpected";
  ParseErrorCode2[ParseErrorCode2["ValueExpected"] = 4] = "ValueExpected";
  ParseErrorCode2[ParseErrorCode2["ColonExpected"] = 5] = "ColonExpected";
  ParseErrorCode2[ParseErrorCode2["CommaExpected"] = 6] = "CommaExpected";
  ParseErrorCode2[ParseErrorCode2["CloseBraceExpected"] = 7] = "CloseBraceExpected";
  ParseErrorCode2[ParseErrorCode2["CloseBracketExpected"] = 8] = "CloseBracketExpected";
  ParseErrorCode2[ParseErrorCode2["EndOfFileExpected"] = 9] = "EndOfFileExpected";
  ParseErrorCode2[ParseErrorCode2["InvalidCommentToken"] = 10] = "InvalidCommentToken";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfComment"] = 11] = "UnexpectedEndOfComment";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfString"] = 12] = "UnexpectedEndOfString";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfNumber"] = 13] = "UnexpectedEndOfNumber";
  ParseErrorCode2[ParseErrorCode2["InvalidUnicode"] = 14] = "InvalidUnicode";
  ParseErrorCode2[ParseErrorCode2["InvalidEscapeCharacter"] = 15] = "InvalidEscapeCharacter";
  ParseErrorCode2[ParseErrorCode2["InvalidCharacter"] = 16] = "InvalidCharacter";
})(ParseErrorCode || (ParseErrorCode = {}));
function printParseErrorCode(code) {
  switch (code) {
    case 1:
      return "InvalidSymbol";
    case 2:
      return "InvalidNumberFormat";
    case 3:
      return "PropertyNameExpected";
    case 4:
      return "ValueExpected";
    case 5:
      return "ColonExpected";
    case 6:
      return "CommaExpected";
    case 7:
      return "CloseBraceExpected";
    case 8:
      return "CloseBracketExpected";
    case 9:
      return "EndOfFileExpected";
    case 10:
      return "InvalidCommentToken";
    case 11:
      return "UnexpectedEndOfComment";
    case 12:
      return "UnexpectedEndOfString";
    case 13:
      return "UnexpectedEndOfNumber";
    case 14:
      return "InvalidUnicode";
    case 15:
      return "InvalidEscapeCharacter";
    case 16:
      return "InvalidCharacter";
  }
  return "<unknown ParseErrorCode>";
}
function format2(documentText, range, options) {
  return format(documentText, range, options);
}
function modify(text, path3, value, options) {
  return setProperty(text, path3, value, options);
}
function applyEdits(text, edits) {
  let sortedEdits = edits.slice(0).sort((a, b) => {
    const diff = a.offset - b.offset;
    if (diff === 0) {
      return a.length - b.length;
    }
    return diff;
  });
  let lastModifiedOffset = text.length;
  for (let i = sortedEdits.length - 1; i >= 0; i--) {
    let e = sortedEdits[i];
    if (e.offset + e.length <= lastModifiedOffset) {
      text = applyEdit(text, e);
    } else {
      throw new Error("Overlapping edit");
    }
    lastModifiedOffset = e.offset;
  }
  return text;
}

// src/text.mts
var import_node_crypto = require("node:crypto");
var RICH_TEXT_MAX_CHARS = 2e3;
var RICH_TEXT_MAX_ITEMS = 100;
var FILE_MAX_CHARS = RICH_TEXT_MAX_CHARS * RICH_TEXT_MAX_ITEMS;
var TooLargeError = class extends Error {
  chars;
  items;
  constructor(message, chars, items) {
    super(message);
    this.name = "TooLargeError";
    this.chars = chars;
    this.items = items;
  }
};
function canonicalize(text) {
  let t = text;
  if (t.charCodeAt(0) === 65279) t = t.slice(1);
  t = t.replace(/\r\n?/g, "\n");
  return t.trimEnd();
}
function hashText(text) {
  return (0, import_node_crypto.createHash)("sha256").update(canonicalize(text), "utf8").digest("hex");
}
function detectEol(text) {
  if (text == null) return null;
  return /\r\n/.test(text) ? "\r\n" : text.includes("\n") ? "\n" : null;
}
function toLocalText(canonical, eol) {
  const body = canonicalize(canonical);
  const withEol = eol === "\r\n" ? body.replace(/\n/g, "\r\n") : body;
  return body.length === 0 ? "" : withEol + eol;
}
function splitText(text, max = RICH_TEXT_MAX_CHARS) {
  if (!Number.isInteger(max) || max < 2) throw new RangeError(`max \u306F2\u4EE5\u4E0A\u306E\u6574\u6570: ${max}`);
  const out = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + max, text.length);
    if (end < text.length) {
      const prev = text.charCodeAt(end - 1);
      if (prev >= 55296 && prev <= 56319) end -= 1;
    }
    out.push(text.slice(i, end));
    i = end;
  }
  return out;
}
function toRichText(text) {
  const canonical = canonicalize(text);
  const parts = splitText(canonical, RICH_TEXT_MAX_CHARS);
  if (parts.length > RICH_TEXT_MAX_ITEMS) {
    throw new TooLargeError(
      `\u672C\u6587\u304C\u9577\u3059\u304E\u308B\uFF08${canonical.length} \u6587\u5B57\u30021\u30D5\u30A1\u30A4\u30EB ${FILE_MAX_CHARS} \u6587\u5B57\u307E\u3067\uFF09`,
      canonical.length,
      parts.length
    );
  }
  return parts.map((content) => ({ type: "text", text: { content } }));
}
function fromRichText(items) {
  if (!Array.isArray(items)) return "";
  let s = "";
  for (const it of items) {
    if (it && typeof it === "object") {
      const o = it;
      if (typeof o.plain_text === "string") s += o.plain_text;
      else if (o.text && typeof o.text.content === "string") s += o.text.content;
    }
  }
  return s;
}

// src/settings-filter.mts
var jsonc = typeof modify === "function" ? main_exports : Reflect.get(main_exports, "default");
function detectFormatting(text) {
  const m = /\n([ \t]+)\S/.exec(text);
  if (m && m[1].startsWith("	")) return { insertSpaces: false, tabSize: 4, eol: "\n" };
  if (m) return { insertSpaces: true, tabSize: m[1].length, eol: "\n" };
  return { insertSpaces: true, tabSize: 4, eol: "\n" };
}
function normalizeIgnoredKeys(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const v of value) {
    if (typeof v === "string" && v.length > 0 && !out.includes(v)) out.push(v);
  }
  return out;
}
function jsoncErrors(text) {
  const errors = [];
  jsonc.parse(canonicalize(text), errors, { allowTrailingComma: true, disallowComments: false });
  return errors;
}
function topLevelProperty(root, key) {
  if (!root || root.type !== "object" || !root.children) return void 0;
  for (const prop of root.children) {
    const k = prop.children?.[0];
    if (k && k.value === key) return prop;
  }
  return void 0;
}
function stripIgnored(text, keys) {
  let t = canonicalize(text);
  if (keys.length === 0) return t;
  const fo = detectFormatting(t);
  for (const key of keys) {
    for (let guard = 0; guard < 1e3; guard++) {
      const root = jsonc.parseTree(t, [], { allowTrailingComma: true, disallowComments: false });
      if (!topLevelProperty(root, key)) break;
      const edits = jsonc.modify(t, [key], void 0, { formattingOptions: fo });
      if (edits.length === 0) break;
      t = jsonc.applyEdits(t, edits);
    }
  }
  return canonicalize(t);
}
function pickIgnored(text, keys) {
  const root = jsonc.parseTree(canonicalize(text), [], { allowTrailingComma: true, disallowComments: false });
  const out = [];
  for (const key of keys) {
    const prop = topLevelProperty(root, key);
    const valueNode = prop?.children?.[1];
    if (valueNode) out.push({ key, value: jsonc.getNodeValue(valueNode) });
  }
  return out;
}
function mergeIgnored(remoteText, localText, keys) {
  let t = stripIgnored(remoteText, keys);
  if (keys.length === 0 || localText == null) return t;
  const picked = pickIgnored(localText, keys);
  if (picked.length === 0) return t;
  if (t.trim().length === 0) t = "{}";
  const fo = detectFormatting(t.includes("\n") ? t : canonicalize(localText));
  for (const { key, value } of picked) {
    const edits = jsonc.modify(t, [key], value, { formattingOptions: fo });
    t = jsonc.applyEdits(t, edits);
  }
  return canonicalize(t);
}

// src/stores.mts
var import_node_fs = require("node:fs");
var path = __toESM(require("node:path"), 1);
function userDirFromGlobalStorage(globalStoragePath) {
  return path.dirname(path.dirname(globalStoragePath));
}
function userDirFileStore(userDir) {
  const resolve = (name) => {
    if (!isSyncableName(name)) throw new Error(`\u540C\u671F\u306E\u5BFE\u8C61\u3067\u306A\u3044\u540D\u524D: ${name}`);
    const p = path.join(userDir, ...name.split("/"));
    const rel = path.relative(userDir, p);
    if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`User \u30D5\u30A9\u30EB\u30C0\u306E\u5916: ${name}`);
    return p;
  };
  return {
    async list() {
      const out = [];
      for (const f of FIXED_FILES) {
        try {
          if ((await import_node_fs.promises.stat(path.join(userDir, f))).isFile()) out.push(f);
        } catch {
        }
      }
      try {
        for (const e of await import_node_fs.promises.readdir(path.join(userDir, "snippets"), { withFileTypes: true })) {
          const n = `snippets/${e.name}`;
          if (e.isFile() && isSyncableName(n)) out.push(n);
        }
      } catch {
      }
      return out;
    },
    async read(name) {
      try {
        return await import_node_fs.promises.readFile(resolve(name), "utf8");
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    },
    async write(name, text) {
      const p = resolve(name);
      await import_node_fs.promises.mkdir(path.dirname(p), { recursive: true });
      const tmp = `${p}.notion-sync.tmp`;
      await import_node_fs.promises.writeFile(tmp, text, "utf8");
      await import_node_fs.promises.rename(tmp, p);
    },
    async remove(name) {
      try {
        await import_node_fs.promises.unlink(resolve(name));
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
  };
}
function fileBaseStore(file) {
  return {
    async load() {
      let text;
      try {
        text = await import_node_fs.promises.readFile(file, "utf8");
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
      try {
        const v = JSON.parse(text);
        if (v && v.schema === 1 && typeof v.pageId === "string" && v.files && typeof v.files === "object") return v;
      } catch {
      }
      return null;
    },
    async save(state) {
      await import_node_fs.promises.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      await import_node_fs.promises.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
      await import_node_fs.promises.rename(tmp, file);
    }
  };
}

// src/decide.mts
function decide(local, remote, base) {
  const b = base ?? { local: null, remote: null };
  const localChanged = local !== b.local;
  const remoteChanged = remote !== b.remote;
  if (!localChanged && !remoteChanged) return "none";
  if (localChanged && !remoteChanged) return "export";
  if (!localChanged && remoteChanged) return "import";
  return local === remote ? "converged" : "conflict";
}
function decideAll(local, remote, base) {
  const names = /* @__PURE__ */ new Set([...local.keys(), ...remote.keys(), ...Object.keys(base)]);
  const out = [];
  for (const name of names) {
    const l = local.get(name) ?? null;
    const r = remote.get(name) ?? null;
    if (l === null && r === null) continue;
    out.push({ name, decision: decide(l, r, base[name]), local: l, remote: r });
  }
  return out;
}

// src/manifest.mts
var MANIFEST_SCHEMA = 1;
var ManifestError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ManifestError";
  }
};
function emptyManifest() {
  return { schema: MANIFEST_SCHEMA, rev: 0, files: {} };
}
function parseManifest(text) {
  let v;
  try {
    v = JSON.parse(text);
  } catch (e) {
    throw new ManifestError(`manifest \u304C JSON \u3068\u3057\u3066\u8AAD\u3081\u306A\u3044: ${e.message}`);
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ManifestError("manifest \u304C\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3067\u306A\u3044");
  const o = v;
  if (o.schema !== MANIFEST_SCHEMA) throw new ManifestError(`manifest \u306E schema \u304C ${MANIFEST_SCHEMA} \u3067\u306A\u3044: ${String(o.schema)}`);
  if (!Number.isInteger(o.rev) || o.rev < 0) throw new ManifestError(`manifest \u306E rev \u304C0\u4EE5\u4E0A\u306E\u6574\u6570\u3067\u306A\u3044: ${String(o.rev)}`);
  const files = {};
  if (o.files !== void 0) {
    if (!o.files || typeof o.files !== "object" || Array.isArray(o.files)) throw new ManifestError("manifest \u306E files \u304C\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3067\u306A\u3044");
    for (const [name, e] of Object.entries(o.files)) {
      if (!isSyncableName(name) || !e || typeof e !== "object") continue;
      const ee = e;
      files[name] = {
        sha256: typeof ee.sha256 === "string" ? ee.sha256 : "",
        updatedAt: typeof ee.updatedAt === "string" ? ee.updatedAt : "",
        machine: typeof ee.machine === "string" ? ee.machine : ""
      };
    }
  }
  return { schema: MANIFEST_SCHEMA, rev: o.rev, files };
}
function serializeManifest(m) {
  const files = {};
  for (const name of Object.keys(m.files).sort(compareNames)) files[name] = m.files[name];
  return JSON.stringify({ schema: m.schema, rev: m.rev, files }, null, 2);
}
function nextManifest(prev, changes, machine, now) {
  const files = { ...prev.files };
  const updatedAt = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  for (const h of changes.healed ?? []) {
    files[h.name] = files[h.name] ? { ...files[h.name], sha256: h.sha256 } : { sha256: h.sha256, updatedAt: "", machine: "" };
  }
  for (const w of changes.written) files[w.name] = { sha256: w.sha256, updatedAt, machine };
  for (const d of changes.deleted) delete files[d];
  return { schema: MANIFEST_SCHEMA, rev: prev.rev + 1, files };
}

// src/page.mts
var HEADINGS = ["heading_1", "heading_2", "heading_3"];
function headingText(b) {
  if (!HEADINGS.includes(b.type)) return null;
  const body = b[b.type];
  return fromRichText(body?.rich_text).trim();
}
function codeText(b) {
  if (!b || b.type !== "code") return null;
  const body = b.code;
  return fromRichText(body?.rich_text);
}
function parsePage(blocks) {
  const st = { manifest: null, manifestHeadingId: null, manifestCodeId: null, files: /* @__PURE__ */ new Map(), warnings: [] };
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const title = headingText(b);
    if (title === null || !b.id) continue;
    if (title !== MANIFEST_HEADING && !isSyncableName(title)) continue;
    const next = blocks[i + 1];
    const body = codeText(next);
    if (body === null || !next?.id) {
      st.warnings.push(`\u898B\u51FA\u3057\u300C${title}\u300D\u306E\u76F4\u5F8C\u306B\u30B3\u30FC\u30C9\u30D6\u30ED\u30C3\u30AF\u304C\u7121\u3044\u306E\u3067\u8AAD\u307F\u98DB\u3070\u3057\u305F`);
      continue;
    }
    if (title === MANIFEST_HEADING) {
      if (st.manifestCodeId) {
        st.warnings.push("manifest \u306E\u898B\u51FA\u3057\u304C2\u3064\u3042\u308B\u3002\u5148\u306E\u3082\u306E\u3092\u4F7F\u3046");
        continue;
      }
      try {
        st.manifest = parseManifest(body);
      } catch (e) {
        if (e instanceof ManifestError) throw e;
        throw new ManifestError(String(e));
      }
      st.manifestHeadingId = b.id;
      st.manifestCodeId = next.id;
    } else {
      if (st.files.has(title)) {
        st.warnings.push(`\u898B\u51FA\u3057\u300C${title}\u300D\u304C2\u3064\u3042\u308B\u3002\u5148\u306E\u3082\u306E\u3092\u4F7F\u3046`);
        continue;
      }
      st.files.set(title, { name: title, headingId: b.id, codeId: next.id, text: body });
    }
    i++;
  }
  return st;
}
function headingBlock(name) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: [{ type: "text", text: { content: name } }] }
  };
}
function codeBlock(text) {
  return {
    object: "block",
    type: "code",
    code: { language: "json", rich_text: toRichText(text) }
  };
}

// src/sync.mts
var RevChangedError = class extends Error {
  expected;
  actual;
  constructor(expected, actual) {
    super(`manifest \u306E rev \u304C\u8AAD\u3093\u3060\u3068\u304D\u306E ${expected} \u304B\u3089 ${actual} \u306B\u5909\u308F\u3063\u305F\uFF08\u307B\u304B\u306E PC \u304C\u66F8\u3044\u305F\uFF09`);
    this.name = "RevChangedError";
    this.expected = expected;
    this.actual = actual;
  }
};
var SETTINGS = "settings.json";
function emptyResult() {
  return {
    status: "synced",
    rev: null,
    imported: [],
    exported: [],
    deletedLocal: [],
    deletedRemote: [],
    conflicts: [],
    pending: [],
    skipped: [],
    warnings: [],
    contacted: false
  };
}
function sharedForm(name, raw, ignored) {
  return name === SETTINGS ? stripIgnored(raw, ignored) : canonicalize(raw);
}
function remoteAsLocal(name, remote, localRaw, ignored) {
  return name === SETTINGS ? mergeIgnored(remote, localRaw, ignored) : canonicalize(remote);
}
async function readLocal(deps) {
  const snap = { raw: /* @__PURE__ */ new Map(), shared: /* @__PURE__ */ new Map(), hash: /* @__PURE__ */ new Map(), invalid: /* @__PURE__ */ new Map() };
  for (const name of await deps.store.list()) {
    const raw = await deps.store.read(name);
    if (raw == null) continue;
    snap.raw.set(name, raw);
    const errs = jsoncErrors(raw);
    if (errs.length > 0) {
      snap.invalid.set(name, `JSONC \u306E\u69CB\u6587\u306E\u8AA4\u308A\u304C ${errs.length} \u500B\u3042\u308B\uFF08\u76F4\u3059\u307E\u3067\u540C\u671F\u3057\u306A\u3044\uFF09`);
      continue;
    }
    const shared = sharedForm(name, raw, deps.ignoredSettings);
    snap.shared.set(name, shared);
    snap.hash.set(name, hashText(shared));
  }
  return snap;
}
function freshBase(pageId) {
  return { schema: 1, pageId, rev: 0, files: {} };
}
function hasLocalChanges(localHash, base) {
  for (const [name, h] of localHash) if ((base.files[name]?.local ?? null) !== h) return true;
  for (const [name, e] of Object.entries(base.files)) if (e.local !== null && !localHash.has(name)) return true;
  return false;
}
async function runSync(deps, opts = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await syncOnce(deps, opts);
    } catch (e) {
      const r = emptyResult();
      r.contacted = true;
      if (e instanceof RevChangedError && attempt === 0) {
        deps.log?.(`${e.message}\u3002\u8AAD\u307F\u76F4\u3057\u3066\u3084\u308A\u76F4\u3059`);
        continue;
      }
      if (e instanceof NetworkError) {
        r.status = "offline";
      } else {
        r.status = "error";
      }
      r.error = e?.message ?? String(e);
      deps.log?.(`\u540C\u671F\u306B\u5931\u6557: ${r.error}`);
      return r;
    }
  }
  throw new Error("unreachable");
}
async function syncOnce(deps, opts = {}) {
  const mode = opts.mode ?? "both";
  const force = opts.force ?? {};
  const log = deps.log ?? (() => {
  });
  const result = emptyResult();
  let base = await deps.baseStore.load();
  if (!base || base.pageId !== deps.pageId) base = freshBase(deps.pageId);
  const local = await readLocal(deps);
  for (const [name, reason] of local.invalid) result.skipped.push({ name, reason });
  if (mode === "export" && Object.keys(force).length === 0) {
    const comparable = new Map(local.hash);
    for (const name of local.invalid.keys()) comparable.set(name, base.files[name]?.local ?? null);
    if (!hasLocalChanges(comparable, base)) {
      result.rev = base.rev;
      return result;
    }
  }
  result.contacted = true;
  const page = parsePage(await deps.api.listChildren(deps.pageId));
  result.warnings.push(...page.warnings);
  if (!page.manifest && page.files.size > 0) {
    throw new ManifestError("\u30DA\u30FC\u30B8\u306B\u30D5\u30A1\u30A4\u30EB\u306E\u898B\u51FA\u3057\u306F\u3042\u308B\u304C manifest \u304C\u7121\u3044\u3002manifest \u306E\u898B\u51FA\u3057\u3068\u30B3\u30FC\u30C9\u30D6\u30ED\u30C3\u30AF\u3092\u623B\u3057\u3066\u304B\u3089\u540C\u671F\u3059\u308B");
  }
  const manifest = page.manifest ?? emptyManifest();
  const readRev = manifest.rev;
  const remoteText = /* @__PURE__ */ new Map();
  const remoteHash = /* @__PURE__ */ new Map();
  for (const [name, f] of page.files) {
    const t = canonicalize(f.text);
    remoteText.set(name, t);
    const h = hashText(t);
    remoteHash.set(name, h);
    const m = manifest.files[name];
    if (!m || m.sha256 !== h) result.warnings.push(`Notion \u306E ${name} \u306F manifest \u3068\u5408\u308F\u306A\u3044\uFF08Notion \u3067\u76F4\u3055\u308C\u305F\u3082\u306E\u3068\u3057\u3066\u6271\u3046\uFF09`);
  }
  const localForDecision = new Map(local.hash);
  for (const name of local.invalid.keys()) localForDecision.delete(name);
  const decisions = decideAll(localForDecision, remoteHash, base.files).filter((d) => !local.invalid.has(d.name)).sort((a, b) => compareNames(a.name, b.name));
  for (const d of decisions) {
    const f = force[d.name];
    if (!f) continue;
    if (d.local === d.remote) d.decision = "converged";
    else d.decision = f === "local" ? "export" : "import";
  }
  const imports = [];
  const exports2 = [];
  for (const d of decisions) {
    switch (d.decision) {
      case "none":
      case "converged":
        base.files[d.name] = { local: d.local, remote: d.remote };
        break;
      case "conflict": {
        const r = remoteText.get(d.name) ?? null;
        result.conflicts.push({
          name: d.name,
          local: local.shared.get(d.name) ?? null,
          remote: r,
          remoteAsLocal: r === null ? null : remoteAsLocal(d.name, r, local.raw.get(d.name) ?? null, deps.ignoredSettings)
        });
        break;
      }
      case "import":
        if (mode === "export") result.pending.push({ name: d.name, decision: "import" });
        else imports.push(d);
        break;
      case "export":
        if (mode === "import") result.pending.push({ name: d.name, decision: "export" });
        else exports2.push(d);
        break;
    }
  }
  const exportBlocks = /* @__PURE__ */ new Map();
  for (const d of exports2) {
    if (d.local === null) continue;
    try {
      exportBlocks.set(d.name, codeBlock(local.shared.get(d.name)));
    } catch (e) {
      if (e instanceof TooLargeError) throw new TooLargeError(`${d.name}: ${e.message}`, e.chars, e.items);
      throw e;
    }
  }
  for (const d of imports) {
    const raw = local.raw.get(d.name) ?? null;
    if (d.remote === null) {
      await deps.store.remove(d.name);
      result.deletedLocal.push(d.name);
      base.files[d.name] = { local: null, remote: null };
      log(`\u53D6\u308A\u8FBC\u307F: ${d.name} \u3092\u624B\u5143\u304B\u3089\u6D88\u3057\u305F\uFF08Notion \u306B\u7121\u3044\uFF09`);
      continue;
    }
    const remote = remoteText.get(d.name);
    const remoteErrs = jsoncErrors(remote);
    if (remoteErrs.length > 0) {
      result.skipped.push({ name: d.name, reason: `Notion \u306E\u672C\u6587\u306B JSONC \u306E\u69CB\u6587\u306E\u8AA4\u308A\u304C ${remoteErrs.length} \u500B\u3042\u308B\uFF08\u53D6\u308A\u8FBC\u307E\u306A\u3044\uFF09` });
      continue;
    }
    const content = remoteAsLocal(d.name, remote, raw, deps.ignoredSettings);
    const written = toLocalText(content, detectEol(raw) ?? deps.defaultEol);
    await deps.store.write(d.name, written);
    result.imported.push(d.name);
    base.files[d.name] = { local: hashText(sharedForm(d.name, written, deps.ignoredSettings)), remote: d.remote };
    log(`\u53D6\u308A\u8FBC\u307F: ${d.name}`);
  }
  if (imports.length > 0) {
    base.syncedAt = deps.now().toISOString();
    await deps.baseStore.save(dropEmpty(base));
  }
  let finalRev = readRev;
  if (exports2.length > 0) {
    let manifestCodeId = page.manifestCodeId;
    if (manifestCodeId) {
      const blk = await deps.api.getBlock(manifestCodeId);
      const cur = parseManifest(fromRichText(blk.code?.rich_text));
      if (cur.rev !== readRev) throw new RevChangedError(readRev, cur.rev);
    } else {
      const created = await deps.api.appendChildren(deps.pageId, [headingBlock(MANIFEST_HEADING), codeBlock(serializeManifest(emptyManifest()))]);
      manifestCodeId = created.find((b) => b.type === "code")?.id ?? null;
      if (!manifestCodeId) throw new Error("manifest \u306E\u30B3\u30FC\u30C9\u30D6\u30ED\u30C3\u30AF\u3092\u4F5C\u308C\u306A\u304B\u3063\u305F\uFF08\u5FDC\u7B54\u306B ID \u304C\u7121\u3044\uFF09");
      log("\u30DA\u30FC\u30B8\u306B manifest \u3092\u4F5C\u3063\u305F");
    }
    const written = [];
    const deleted = [];
    const appendGroups = [];
    const appendNames = [];
    for (const d of exports2) {
      const existing = page.files.get(d.name);
      if (d.local === null) {
        if (existing) {
          await deps.api.deleteBlock(existing.codeId);
          await deps.api.deleteBlock(existing.headingId);
        }
        deleted.push(d.name);
        result.deletedRemote.push(d.name);
        log(`\u66F8\u304D\u51FA\u3057: ${d.name} \u3092 Notion \u304B\u3089\u6D88\u3057\u305F\uFF08\u624B\u5143\u306B\u7121\u3044\uFF09`);
        continue;
      }
      const block = exportBlocks.get(d.name);
      if (existing) {
        await deps.api.updateCode(existing.codeId, block.code.rich_text, "json");
      } else {
        appendGroups.push([headingBlock(d.name), block]);
        appendNames.push(d.name);
      }
      written.push({ name: d.name, sha256: d.local });
      result.exported.push(d.name);
      log(`\u66F8\u304D\u51FA\u3057: ${d.name}`);
    }
    for (const chunk of chunkForAppend(appendGroups)) await deps.api.appendChildren(deps.pageId, chunk);
    const touched = new Set(exports2.map((d) => d.name));
    const healed = [];
    for (const [name, h] of remoteHash) {
      if (!touched.has(name) && h !== null && manifest.files[name]?.sha256 !== h) healed.push({ name, sha256: h });
    }
    const stale = Object.keys(manifest.files).filter((n) => !touched.has(n) && !page.files.has(n));
    const next = nextManifest(manifest, { written, deleted: [...deleted, ...stale], healed }, deps.machine, deps.now());
    await deps.api.updateCode(manifestCodeId, toRichText(serializeManifest(next)), "json");
    finalRev = next.rev;
    log(`manifest \u3092 rev ${next.rev} \u306B\u3057\u305F`);
    for (const w of written) base.files[w.name] = { local: w.sha256, remote: w.sha256 };
    for (const n of deleted) base.files[n] = { local: null, remote: null };
  }
  base.rev = finalRev;
  base.syncedAt = deps.now().toISOString();
  await deps.baseStore.save(dropEmpty(base));
  result.rev = finalRev;
  result.status = result.conflicts.length > 0 ? "conflict" : "synced";
  return result;
}
function dropEmpty(base) {
  const files = {};
  for (const [n, e] of Object.entries(base.files)) if (e.local !== null || e.remote !== null) files[n] = e;
  return { ...base, files };
}
async function readDiffs(deps) {
  const local = await readLocal(deps);
  const page = parsePage(await deps.api.listChildren(deps.pageId));
  const names = /* @__PURE__ */ new Set([...local.raw.keys(), ...page.files.keys()]);
  const out = [];
  for (const name of [...names].sort(compareNames)) {
    const raw = local.raw.get(name) ?? null;
    const remote = page.files.has(name) ? canonicalize(page.files.get(name).text) : null;
    const l = local.shared.get(name) ?? (raw !== null ? canonicalize(raw) : null);
    if (l === remote) continue;
    out.push({
      name,
      local: l,
      remote,
      remoteAsLocal: remote === null ? null : remoteAsLocal(name, remote, raw, deps.ignoredSettings)
    });
  }
  return out;
}

// src/extension.mts
var SECRET_KEY = "notionSync.token";
var SCHEME = "notion-sync";
var SAVE_DEBOUNCE_MS = 5e3;
var RemoteContent = class {
  docs = /* @__PURE__ */ new Map();
  emitter = new vscode.EventEmitter();
  onDidChange = this.emitter.event;
  set(uri, text) {
    this.docs.set(uri.toString(), text);
    this.emitter.fire(uri);
  }
  provideTextDocumentContent(uri) {
    return this.docs.get(uri.toString()) ?? "";
  }
  dispose() {
    this.emitter.dispose();
  }
};
function activate(context) {
  const out = vscode.window.createOutputChannel("Notion \u540C\u671F", { log: true });
  const status = vscode.window.createStatusBarItem("notionSync.status", vscode.StatusBarAlignment.Left, 0);
  status.name = "Notion \u540C\u671F";
  const remote = new RemoteContent();
  context.subscriptions.push(out, status, remote, vscode.workspace.registerTextDocumentContentProvider(SCHEME, remote));
  const userDir = userDirFromGlobalStorage(context.globalStorageUri.fsPath);
  const baseFile = path2.join(context.globalStorageUri.fsPath, "sync-base.json");
  const store = userDirFileStore(userDir);
  const baseStore = fileBaseStore(baseFile);
  out.info(`User \u30D5\u30A9\u30EB\u30C0: ${userDir}`);
  let lastResult = null;
  let lastConflicts = [];
  let state = "unsynced";
  let reason = "";
  let tokenWarned = false;
  const config = () => vscode.workspace.getConfiguration("notionSync");
  const enabled = () => config().get("enabled", false) === true;
  function render() {
    if (!enabled()) {
      status.hide();
      return;
    }
    const map = {
      synced: "$(check) \u540C\u671F\u6E08\u307F",
      unsynced: "$(sync-ignored) \u672A\u540C\u671F",
      conflict: "$(warning) \u7AF6\u5408\u3042\u308A",
      syncing: "$(sync~spin) \u540C\u671F\u4E2D"
    };
    status.text = map[state];
    const lines = ["Notion \u540C\u671F"];
    if (reason) lines.push(reason);
    if (lastResult?.rev != null) lines.push(`rev ${lastResult.rev}`);
    status.tooltip = lines.join("\n");
    status.command = state === "conflict" ? "notionSync.showDiff" : "notionSync.import";
    status.show();
  }
  async function makeDeps() {
    const pageId = normalizePageId(config().get("pageId", ""));
    if (!pageId) return "notionSync.pageId \u304C\u7121\u3044\u304B\u8AAD\u3081\u306A\u3044";
    const token = await context.secrets.get(SECRET_KEY);
    if (!token) return "\u30C8\u30FC\u30AF\u30F3\u304C\u7121\u3044\uFF08\u30B3\u30DE\u30F3\u30C9\u300CNotion \u540C\u671F: \u30C8\u30FC\u30AF\u30F3\u3092\u8A2D\u5B9A\u300D\uFF09";
    const api = createNotionClient({ token, fetch: globalThis.fetch });
    return {
      api,
      store,
      baseStore,
      pageId,
      ignoredSettings: normalizeIgnoredKeys(config().get("ignoredSettings", [])),
      machine: os.hostname(),
      now: () => /* @__PURE__ */ new Date(),
      defaultEol: process.platform === "win32" ? "\r\n" : "\n",
      log: (m) => out.info(m)
    };
  }
  let chain = Promise.resolve();
  function enqueue(job) {
    const p = chain.then(job, job);
    chain = p.catch(() => void 0);
    return p;
  }
  function sync(mode, opts = {}) {
    return enqueue(async () => {
      if (!enabled() && !opts.manual) return null;
      const deps = await makeDeps();
      if (typeof deps === "string") {
        state = "unsynced";
        reason = deps;
        render();
        if (opts.manual) void vscode.window.showWarningMessage(`Notion \u540C\u671F: ${deps}`);
        else if (!tokenWarned && enabled()) {
          tokenWarned = true;
          void vscode.window.showWarningMessage(`Notion \u540C\u671F: ${deps}`, "\u30C8\u30FC\u30AF\u30F3\u3092\u8A2D\u5B9A").then((c) => {
            if (c) void vscode.commands.executeCommand("notionSync.setToken");
          });
        }
        return null;
      }
      const prevState = state;
      state = "syncing";
      render();
      const r = await runSync(deps, { mode, force: opts.force });
      lastResult = r;
      for (const w of r.warnings) out.warn(w);
      for (const s of r.skipped) out.warn(`${s.name}: ${s.reason}`);
      if (r.status === "offline" || r.status === "error") {
        state = "unsynced";
        reason = r.error ?? "";
        out.error(reason);
        if (opts.manual) void vscode.window.showErrorMessage(`Notion \u540C\u671F: ${reason}`);
      } else if (r.status === "conflict") {
        state = "conflict";
        lastConflicts = r.conflicts;
        reason = `\u7AF6\u5408: ${r.conflicts.map((c) => c.name).join(", ")}`;
        void vscode.window.showWarningMessage(`Notion \u540C\u671F: \u624B\u5143\u3068 Notion \u306E\u4E21\u65B9\u304C\u5909\u308F\u3063\u305F\uFF08${r.conflicts.map((c) => c.name).join(", ")}\uFF09`, "\u5DEE\u5206\u3092\u898B\u308B").then((c) => {
          if (c) void vscode.commands.executeCommand("notionSync.showDiff");
        });
      } else {
        lastConflicts = [];
        if (r.pending.length > 0) {
          state = prevState === "conflict" ? "conflict" : "unsynced";
          reason = `\u6B8B\u308A: ${r.pending.map((p) => `${p.name}\uFF08${p.decision === "import" ? "\u53D6\u308A\u8FBC\u307F" : "\u66F8\u304D\u51FA\u3057"}\uFF09`).join(", ")}`;
        } else {
          state = "synced";
          reason = r.skipped.length ? `\u6271\u308F\u306A\u304B\u3063\u305F: ${r.skipped.map((s) => s.name).join(", ")}` : "";
        }
        const done = [...r.imported, ...r.deletedLocal].length + [...r.exported, ...r.deletedRemote].length;
        if (opts.manual) {
          void vscode.window.showInformationMessage(
            done ? `Notion \u540C\u671F: \u53D6\u308A\u8FBC\u307F ${r.imported.length + r.deletedLocal.length}\u3001\u66F8\u304D\u51FA\u3057 ${r.exported.length + r.deletedRemote.length}` : "Notion \u540C\u671F: \u5909\u308F\u3063\u305F\u3082\u306E\u306F\u7121\u3044"
          );
        }
      }
      render();
      return r;
    });
  }
  let timer;
  function scheduleExport() {
    if (!enabled()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = void 0;
      void sync("export");
    }, SAVE_DEBOUNCE_MS);
  }
  context.subscriptions.push({ dispose: () => timer && clearTimeout(timer) });
  const userUri = vscode.Uri.file(userDir);
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(userUri, "{settings.json,keybindings.json,tasks.json,snippets/*.json,snippets/*.code-snippets}")
  );
  context.subscriptions.push(
    watcher,
    watcher.onDidChange(scheduleExport),
    watcher.onDidCreate(scheduleExport),
    watcher.onDidDelete(scheduleExport),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.uri.scheme !== "file") return;
      const rel = path2.relative(userDir, doc.uri.fsPath).split(path2.sep).join("/");
      if (isSyncableName(rel)) scheduleExport();
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("notionSync.enabled")) {
        render();
        if (enabled()) void sync("both");
      } else if (e.affectsConfiguration("notionSync.ignoredSettings") || e.affectsConfiguration("notionSync.pageId")) {
        scheduleExport();
      }
    }),
    context.secrets.onDidChange((e) => {
      if (e.key === SECRET_KEY) tokenWarned = false;
    })
  );
  async function openDiff(c) {
    const left = vscode.Uri.from({ scheme: SCHEME, path: `/${c.name}`, query: `t=${Date.now()}` });
    const eol = process.platform === "win32" ? "\r\n" : "\n";
    remote.set(left, c.remoteAsLocal === null ? "" : toLocalText(c.remoteAsLocal, eol));
    let right;
    if (c.local === null) {
      right = vscode.Uri.from({ scheme: SCHEME, path: `/local/${c.name}`, query: `t=${Date.now()}` });
      remote.set(right, "");
    } else {
      right = vscode.Uri.file(path2.join(userDir, ...c.name.split("/")));
    }
    await vscode.commands.executeCommand("vscode.diff", left, right, `${c.name}\uFF08Notion \u2194 \u624B\u5143\uFF09`, { preview: false });
  }
  async function resolve(c) {
    const items = [
      { id: "local", label: "\u624B\u5143\u3092\u63A1\u308B", description: "\u624B\u5143\u306E\u4E2D\u8EAB\u3092 Notion \u306B\u66F8\u304D\u51FA\u3059" },
      { id: "remote", label: "Notion \u3092\u63A1\u308B", description: "Notion \u306E\u4E2D\u8EAB\u3067\u624B\u5143\u3092\u7F6E\u304D\u63DB\u3048\u308B" },
      { id: "manual", label: "\u624B\u3067\u76F4\u3057\u3066\u66F8\u304D\u51FA\u3059", description: "\u53F3\uFF08\u624B\u5143\uFF09\u3092\u76F4\u3057\u3066\u4FDD\u5B58\u3057\u3001\u7D42\u308F\u3063\u305F\u3089\u66F8\u304D\u51FA\u3059" },
      { id: "none", label: "\u4ECA\u306F\u3057\u306A\u3044" }
    ];
    const pick = await vscode.window.showQuickPick(items, { title: `${c.name} \u306E\u7AF6\u5408`, ignoreFocusOut: true });
    if (!pick || pick.id === "none") return;
    if (pick.id === "manual") {
      const go = await vscode.window.showInformationMessage(
        `${c.name}: \u53F3\u5074\uFF08\u624B\u5143\uFF09\u3092\u76F4\u3057\u3066\u4FDD\u5B58\u3057\u3066\u304B\u3089\u300C\u66F8\u304D\u51FA\u3059\u300D\u3092\u62BC\u3059`,
        "\u66F8\u304D\u51FA\u3059"
      );
      if (go !== "\u66F8\u304D\u51FA\u3059") return;
      const fileUri = vscode.Uri.file(path2.join(userDir, ...c.name.split("/")));
      const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === fileUri.toString());
      if (open?.isDirty) await open.save();
      await sync("both", { force: { [c.name]: "local" }, manual: true });
      return;
    }
    await sync("both", { force: { [c.name]: pick.id }, manual: true });
  }
  context.subscriptions.push(
    vscode.commands.registerCommand("notionSync.import", () => sync("import", { manual: true })),
    vscode.commands.registerCommand("notionSync.export", () => sync("export", { manual: true })),
    vscode.commands.registerCommand("notionSync.showDiff", async () => {
      let list = lastConflicts;
      const conflictNames = new Set(list.map((c) => c.name));
      if (list.length === 0) {
        const deps = await makeDeps();
        if (typeof deps === "string") {
          void vscode.window.showWarningMessage(`Notion \u540C\u671F: ${deps}`);
          return;
        }
        try {
          list = await readDiffs(deps);
        } catch (e) {
          void vscode.window.showErrorMessage(`Notion \u540C\u671F: ${e.message}`);
          return;
        }
      }
      if (list.length === 0) {
        void vscode.window.showInformationMessage("Notion \u540C\u671F: \u624B\u5143\u3068 Notion \u306B\u9055\u3044\u306F\u7121\u3044");
        return;
      }
      const sorted = [...list].sort((a, b) => compareNames(a.name, b.name));
      const chosen = sorted.length === 1 ? sorted[0] : (await vscode.window.showQuickPick(
        sorted.map((c) => ({ label: c.name, description: conflictNames.has(c.name) ? "\u7AF6\u5408" : "\u9055\u3044\u3042\u308A", c })),
        { title: "\u5DEE\u5206\u3092\u898B\u308B\u30D5\u30A1\u30A4\u30EB" }
      ))?.c;
      if (!chosen) return;
      await openDiff(chosen);
      await resolve(chosen);
    }),
    vscode.commands.registerCommand("notionSync.setToken", async () => {
      const token = await vscode.window.showInputBox({
        title: "Notion \u540C\u671F: \u30C8\u30FC\u30AF\u30F3\u3092\u8A2D\u5B9A",
        prompt: "\u8A2D\u5B9A\u30DA\u30FC\u30B8\u3060\u3051\u306B\u63A5\u7D9A\u3057\u305F\u5185\u90E8\u30A4\u30F3\u30C6\u30B0\u30EC\u30FC\u30B7\u30E7\u30F3\u306E\u30C8\u30FC\u30AF\u30F3\uFF08OS \u306E\u4FDD\u8B77\u306E\u4ED5\u7D44\u307F\u3067\u4FDD\u5B58\u3059\u308B\u3002settings.json \u306B\u306F\u66F8\u304B\u306A\u3044\uFF09",
        password: true,
        ignoreFocusOut: true,
        validateInput: (v) => v.trim().length < 20 ? "\u30C8\u30FC\u30AF\u30F3\u304C\u77ED\u3059\u304E\u308B" : void 0
      });
      if (!token) return;
      await context.secrets.store(SECRET_KEY, token.trim());
      out.info("\u30C8\u30FC\u30AF\u30F3\u3092\u4FDD\u5B58\u3057\u305F");
      if (!enabled() && normalizePageId(config().get("pageId", ""))) {
        const c = await vscode.window.showInformationMessage("Notion \u540C\u671F: \u30C8\u30FC\u30AF\u30F3\u3092\u4FDD\u5B58\u3057\u305F\u3002\u540C\u671F\u3092\u6709\u52B9\u306B\u3059\u308B\u304B", "\u6709\u52B9\u306B\u3059\u308B");
        if (c) await config().update("enabled", true, vscode.ConfigurationTarget.Global);
      } else if (enabled()) {
        void sync("both");
      } else {
        void vscode.window.showInformationMessage("Notion \u540C\u671F: \u30C8\u30FC\u30AF\u30F3\u3092\u4FDD\u5B58\u3057\u305F\u3002notionSync.pageId \u3092\u8A2D\u5B9A\u3057\u3066\u304B\u3089 notionSync.enabled \u3092 true \u306B\u3059\u308B");
      }
    }),
    vscode.commands.registerCommand("notionSync.clearToken", async () => {
      await context.secrets.delete(SECRET_KEY);
      out.info("\u30C8\u30FC\u30AF\u30F3\u3092\u6D88\u3057\u305F");
      state = "unsynced";
      reason = "\u30C8\u30FC\u30AF\u30F3\u304C\u7121\u3044";
      render();
      void vscode.window.showInformationMessage("Notion \u540C\u671F: \u30C8\u30FC\u30AF\u30F3\u3092\u6D88\u3057\u305F");
    })
  );
  render();
  if (enabled()) void sync("both");
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
