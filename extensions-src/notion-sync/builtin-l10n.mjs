// 組み込み拡張の翻訳の束（build.mjs が使う。dist には入らない）。
//
// 組み込み拡張（resources/app/extensions の下）は、表示の言語が英語でないと、拡張ホストがコードを読み込む前に
// 言語パックの translations からその拡張の ID の翻訳を探す。無いと exthost.log に
//   [error] No bundle location found for extension <publisher>.<name>
// を出す（本家 1.146.0 の src/vs/workbench/api/common/extHostLocalizationService.ts の initializeLocalizedMessages。
// 組み込みでは manifest の l10n も package.nls.*.json も見ない）。
// 言語パックの一覧（languagepacks.json）は、共有プロセスが起動のたびに、入っている全部の拡張（組み込みを含む）の
// contributes.localizations から作り直す（src/vs/platform/languagePacks/node/languagePacks.ts の update と
// src/vs/code/electron-utility/sharedProcess/contrib/localizationsUpdater.ts）。同じ languageId の項目は1つの言語パックに
// まとめられるので、自分の manifest に自分の ID の翻訳の項目を書けば、本物の言語パックに足される。
//
// ここでは、manifest の contributes.localizations のうち自分の ID を指す項目について、空の翻訳の束を作る。
// 形は言語パックの translations/extensions/*.i18n.json と同じ（組み込みは contents.bundle をコードの翻訳、
// contents.package を manifest の翻訳として読む）。この拡張は vscode.l10n も %キー% も使わないので、中身は空でよい。

import fs from "node:fs";
import path from "node:path";

/** manifest の ID（publisher.name）。 */
export function extensionId(manifest) {
  return `${manifest?.publisher}.${manifest?.name}`;
}

/**
 * 自分の ID を指す翻訳の項目を並べる。
 * 返す: { languageId, id, path }[]（path は manifest に書いたままの相対パス）
 */
export function ownTranslations(manifest) {
  const id = extensionId(manifest);
  const out = [];
  const locs = manifest?.contributes?.localizations;
  for (const loc of Array.isArray(locs) ? locs : []) {
    for (const t of Array.isArray(loc?.translations) ? loc.translations : []) {
      if (t?.id === id) out.push({ languageId: loc.languageId, id: t.id, path: t.path });
    }
  }
  return out;
}

/** 空の翻訳の束の中身（JSON の文字列）。 */
export function emptyBundleText() {
  return JSON.stringify({ version: "1.0.0", contents: { package: {}, bundle: {} } }, null, 2) + "\n";
}

/**
 * manifest の contributes.localizations を確かめる。本体の isValidLocalization（languagePacks.ts）と同じ条件に、
 * 「自分の ID の項目がある」「path が dist/ の下」を足す（apply.mjs が写すフォルダは dist/ と media/ だけ）。
 * root を渡すと、ファイルがあって contents.bundle がオブジェクトかも見る。
 * 返す: 誤りの文の配列（空なら良い）
 */
export function checkBuiltinLocalizations(manifest, root) {
  const errors = [];
  const locs = manifest?.contributes?.localizations;
  if (!Array.isArray(locs) || locs.length === 0) {
    errors.push("contributes.localizations が無い（組み込みでは、日本語の表示で No bundle location found が出る）");
    return errors;
  }
  for (const loc of locs) {
    if (typeof loc?.languageId !== "string") errors.push("languageId が文字列でない");
    if (!Array.isArray(loc?.translations) || loc.translations.length === 0) errors.push(`${loc?.languageId}: translations が空`);
    for (const t of Array.isArray(loc?.translations) ? loc.translations : []) {
      if (typeof t?.id !== "string" || typeof t?.path !== "string") errors.push(`${loc?.languageId}: translations の id・path が文字列でない`);
    }
    if (loc?.languageName !== undefined && typeof loc.languageName !== "string") errors.push(`${loc?.languageId}: languageName が文字列でない`);
    if (loc?.localizedLanguageName !== undefined && typeof loc.localizedLanguageName !== "string") errors.push(`${loc?.languageId}: localizedLanguageName が文字列でない`);
  }
  const own = ownTranslations(manifest);
  if (own.length === 0) errors.push(`自分の ID（${extensionId(manifest)}）を指す翻訳の項目が無い`);
  for (const t of own) {
    const rel = String(t.path).replace(/\\/g, "/").replace(/^\.\//, "");
    if (!rel.startsWith("dist/") || rel.split("/").includes("..")) errors.push(`${t.languageId}: path が dist/ の下でない（${t.path}）`);
    if (root) {
      const f = path.join(root, rel);
      if (!fs.existsSync(f)) {
        errors.push(`${t.languageId}: ${t.path} が無い`);
        continue;
      }
      try {
        const j = JSON.parse(fs.readFileSync(f, "utf8"));
        if (typeof j?.contents?.bundle !== "object" || j.contents.bundle === null) errors.push(`${t.languageId}: ${t.path} に contents.bundle のオブジェクトが無い`);
      } catch (e) {
        errors.push(`${t.languageId}: ${t.path} を JSON として読めない（${e.message}）`);
      }
    }
  }
  return errors;
}

/** 自分の ID の翻訳の束を root の下に書く。返す: 書いた相対パスの配列。 */
export function writeBuiltinTranslations(manifest, root) {
  const written = [];
  for (const t of ownTranslations(manifest)) {
    const rel = String(t.path).replace(/\\/g, "/").replace(/^\.\//, "");
    const f = path.join(root, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, emptyBundleText(), "utf8");
    written.push(rel);
  }
  return written;
}
