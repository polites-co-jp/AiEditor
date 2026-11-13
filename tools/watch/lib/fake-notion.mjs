// 試し用の、Notion の API の差し替え（scripts/lib/notion-client.mjs の createNotionClient と同じメソッドを持つ）。
// 本物の Notion に書かずに、ToDo の中身・重複の防止・取り込みの書き戻しを確かめるために使う（watch.mjs --notion-fake）。
// 中身は1つの JSON ファイルに保つので、続けて何回か走らせて重複しないことを確かめられる。ページの状態を Done にするなど、
// ユーザーの操作の代わりはそのファイルを書き換えて行う。
//
// 本物の API の決まりのうち、誤りに気づくためのものだけを真似る:
//   - 作成の parent は { type: "data_source_id", data_source_id } で、ID がデータソースと同じ
//   - properties の名前がデータソースにあり、型が合う。select・status の名前が選択肢にある（本物は select の選択肢を
//     作りうるが、ここでは誤りにして気づけるようにする）
//   - text.content は 2000 文字まで、rich_text と children は 100 個まで
//   - query の filter は、notion-todo.mjs の findOpenTodo が使う形（and の下の rich_text equals・title starts_with・
//     status equals / does_not_equal）だけを解く
//   - "fail": { "status": 401, "code": "unauthorized" } を書くと、どの呼び出しも NotionError を投げる（トークンの失効の代わり）
//
// 書き出している関数: createFakeNotion({ file, dataSourceId }), defaultFakeDataSource(dataSourceId)

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NotionError } from "../../../scripts/lib/notion-client.mjs";
import { TODO_DATA_SOURCE_ID, TODO_SCHEMA } from "../../../scripts/lib/notion-todo.mjs";

export function defaultFakeDataSource(dataSourceId = TODO_DATA_SOURCE_ID) {
  const properties = {};
  for (const p of TODO_SCHEMA) {
    const conf = { id: randomUUID().slice(0, 4), name: p.name, type: p.type };
    if (p.type === "select" || p.type === "status") {
      const names = p.type === "select" && p.name === "種別" ? ["ToDo", "予定", "期間タスク"] : p.options;
      conf[p.type] = { options: names.map((n) => ({ id: randomUUID().slice(0, 4), name: n, color: "default" })) };
    } else {
      conf[p.type] = {};
    }
    properties[p.name] = conf;
  }
  properties["開始日時"] = { id: "st", name: "開始日時", type: "date", date: {} };
  properties["終了日時"] = { id: "en", name: "終了日時", type: "date", date: {} };
  return { object: "data_source", id: dataSourceId, properties };
}

function plain(richTextArray) {
  return (Array.isArray(richTextArray) ? richTextArray : []).map((t) => (t && t.text ? t.text.content : "")).join("");
}

function bad(message) {
  return new NotionError(`HTTP 400 validation_error: ${message}`, { status: 400, code: "validation_error" });
}

function checkRichText(arr, where) {
  if (!Array.isArray(arr)) throw bad(`${where} が配列でない`);
  if (arr.length > 100) throw bad(`${where} が100個を超える`);
  for (const t of arr) {
    if (!t || !t.text || typeof t.text.content !== "string") throw bad(`${where} に text.content が無い`);
    if (t.text.content.length > 2000) throw bad(`${where} の text.content が2000文字を超える（${t.text.content.length}）`);
  }
}

function checkBlocks(children) {
  if (!Array.isArray(children)) throw bad("children が配列でない");
  if (children.length > 100) throw bad("children が100個を超える");
  for (const b of children) {
    if (!b || typeof b.type !== "string" || !b[b.type]) throw bad("ブロックの形が違う");
    checkRichText(b[b.type].rich_text, `ブロック ${b.type} の rich_text`);
  }
}

export function createFakeNotion({ file, dataSourceId = TODO_DATA_SOURCE_ID } = {}) {
  const load = () => {
    if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
    return { dataSource: defaultFakeDataSource(dataSourceId), pages: {}, calls: [] };
  };
  const save = (db) => {
    if (!file) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  };
  let memory = null;
  const open = () => (file ? load() : (memory = memory || load()));

  const withDb = async (name, args, fn) => {
    const db = open();
    db.calls = db.calls || [];
    db.calls.push({ at: new Date().toISOString(), call: name, args });
    if (db.fail) {
      save(db);
      throw new NotionError(`Notion の API が誤りを返した: HTTP ${db.fail.status} ${db.fail.code}（${name}）`, db.fail);
    }
    const out = fn(db);
    save(db);
    return out;
  };

  const schemaByName = (db) => {
    const m = new Map();
    for (const [k, v] of Object.entries(db.dataSource.properties || {})) m.set(v.name || k, v);
    return m;
  };

  const checkProperties = (db, properties) => {
    const schema = schemaByName(db);
    for (const [name, value] of Object.entries(properties || {})) {
      const conf = schema.get(name);
      if (!conf) throw bad(`項目「${name}」がデータソースに無い`);
      if (!(conf.type in value)) throw bad(`項目「${name}」の型 ${conf.type} の値が無い`);
      const v = value[conf.type];
      if (conf.type === "title" || conf.type === "rich_text") checkRichText(v, `項目「${name}」`);
      if ((conf.type === "select" || conf.type === "status") && v !== null) {
        const names = (conf[conf.type].options || []).map((o) => o.name);
        if (!names.includes(v.name)) throw bad(`項目「${name}」に選択肢「${v.name}」が無い`);
      }
      if (conf.type === "date" && v !== null && !/^\d{4}-\d{2}-\d{2}/.test(v.start || "")) throw bad(`項目「${name}」の日付の形が違う`);
    }
  };

  const matches = (page, f) => {
    if (f.and) return f.and.every((g) => matches(page, g));
    if (f.or) return f.or.some((g) => matches(page, g));
    const p = page.properties[f.property];
    if (!p) return false;
    if (f.rich_text) {
      const s = plain(p.rich_text);
      if ("equals" in f.rich_text) return s === f.rich_text.equals;
      if ("starts_with" in f.rich_text) return s.startsWith(f.rich_text.starts_with);
    }
    if (f.title) {
      const s = plain(p.title);
      if ("equals" in f.title) return s === f.title.equals;
      if ("starts_with" in f.title) return s.startsWith(f.title.starts_with);
    }
    if (f.status) {
      const s = p.status ? p.status.name : null;
      if ("equals" in f.status) return s === f.status.equals;
      if ("does_not_equal" in f.status) return s !== f.status.does_not_equal;
    }
    throw bad(`差し替えが解けない filter: ${JSON.stringify(f)}`);
  };

  const view = (page) => JSON.parse(JSON.stringify({ object: "page", ...page, children: undefined }));

  return {
    retrieveDataSource: (id) =>
      withDb("retrieveDataSource", { id }, (db) => {
        if (id !== db.dataSource.id) throw new NotionError("HTTP 404 object_not_found", { status: 404, code: "object_not_found" });
        return JSON.parse(JSON.stringify(db.dataSource));
      }),
    queryDataSource: (id, body = {}) =>
      withDb("queryDataSource", { id, body }, (db) => {
        if (id !== db.dataSource.id) throw new NotionError("HTTP 404 object_not_found", { status: 404, code: "object_not_found" });
        let list = Object.values(db.pages).filter((p) => !p.in_trash && !p.archived);
        if (body.filter) list = list.filter((p) => matches(p, body.filter));
        list.sort((a, b) => (a.created_time < b.created_time ? 1 : -1));
        return { object: "list", results: list.slice(0, body.page_size || 100).map(view), has_more: false, next_cursor: null };
      }),
    retrievePage: (id) => withDb("retrievePage", { id }, (db) => (db.pages[id] ? view(db.pages[id]) : null)),
    createPage: (body) =>
      withDb("createPage", { body }, (db) => {
        if (!body.parent || body.parent.type !== "data_source_id" || body.parent.data_source_id !== db.dataSource.id) {
          throw bad("parent が data_source_id の形でないか、ID が違う");
        }
        checkProperties(db, body.properties);
        if (body.children) checkBlocks(body.children);
        const id = randomUUID();
        const now = new Date().toISOString();
        // 作成の時刻は呼び出しの順に並ぶよう、ミリ秒を足してずらす
        const n = Object.keys(db.pages).length;
        const created = new Date(Date.parse(now) + n).toISOString();
        db.pages[id] = {
          id,
          created_time: created,
          last_edited_time: created,
          archived: false,
          in_trash: false,
          parent: body.parent,
          properties: JSON.parse(JSON.stringify(body.properties)),
          children: body.children || [],
        };
        return view(db.pages[id]);
      }),
    updatePage: (id, body) =>
      withDb("updatePage", { id, body }, (db) => {
        const page = db.pages[id];
        if (!page) throw new NotionError("HTTP 404 object_not_found", { status: 404, code: "object_not_found" });
        checkProperties(db, body.properties);
        Object.assign(page.properties, JSON.parse(JSON.stringify(body.properties || {})));
        page.last_edited_time = new Date().toISOString();
        return view(page);
      }),
    appendBlockChildren: (blockId, children) =>
      withDb("appendBlockChildren", { blockId, count: children.length }, (db) => {
        const page = db.pages[blockId];
        if (!page) throw new NotionError("HTTP 404 object_not_found", { status: 404, code: "object_not_found" });
        checkBlocks(children);
        page.children.push(...children);
        return { object: "list", results: children };
      }),
  };
}
