#!/usr/bin/env node
// Open VSX のメタデータと manifest（package.json）だけを取って保存する（VSIX は取らない）。調べ物用。
//
// 使い方: node scripts/p0-openvsx-meta.mjs [--out C:/b/p0/probe/openvsx] <namespace/name[/target][@version]> ...
// 出力: <out>/<namespace>.<name>/api.json、package.json、summary.json（版・公開日・verified・license・
//       engines・publishedBy・VSIX のサイズ（HEAD の Content-Length）・extensionDependencies・extensionPack・
//       enabledApiProposals・activationEvents・contributes のキー）。
// 標準出力: summary の配列（JSON）。

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'p0-openvsx-meta';

async function get(url, method = 'GET') {
  const res = await fetch(url, { method, headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}`);
  return res;
}

async function one(spec, outRoot) {
  const [nsName, version] = spec.split('@');
  const [ns, name, target] = nsName.split('/');
  if (!ns || !name) throw new Error(`形が違う: ${spec}（namespace/name[/target][@version]）`);
  const api = await (await get(`https://open-vsx.org/api/${ns}/${name}${target ? `/${target}` : ''}${version ? `/${version}` : ''}`)).json();
  const dir = join(outRoot, `${ns}.${name}${target ? `@${target}` : ''}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'api.json'), JSON.stringify(api, null, 2));
  let manifest = null;
  if (api.files?.manifest) {
    manifest = await (await get(api.files.manifest)).json();
    writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest, null, 2));
  }
  let size = null;
  if (api.files?.download) {
    try {
      const h = await get(api.files.download, 'HEAD');
      size = Number(h.headers.get('content-length')) || null;
    } catch {
      size = null;
    }
  }
  const c = manifest?.contributes ?? {};
  const summary = {
    id: `${api.namespace}.${api.name}`,
    version: api.version,
    timestamp: api.timestamp,
    verified: api.verified,
    license: api.license,
    engines: api.engines,
    publishedBy: api.publishedBy?.loginName,
    targetPlatform: api.targetPlatform,
    vsixBytes: size,
    download: api.files?.download,
    bundledExtensions: (api.bundledExtensions ?? []).map((x) => `${x.namespace}.${x.extension ?? x.name}`),
    dependencies: (api.dependencies ?? []).map((x) => `${x.namespace}.${x.extension ?? x.name}`),
    extensionDependencies: manifest?.extensionDependencies ?? [],
    extensionPack: manifest?.extensionPack ?? [],
    enabledApiProposals: manifest?.enabledApiProposals ?? [],
    activationEvents: manifest?.activationEvents ?? [],
    main: manifest?.main ?? null,
    contributesKeys: Object.keys(c),
    debuggers: (c.debuggers ?? []).map((d) => d.type),
    notebooks: (c.notebooks ?? []).map((n) => n.type),
    notebookRenderer: (c.notebookRenderer ?? []).map((n) => n.id),
    chatParticipants: (c.chatParticipants ?? []).map((n) => n.id),
    languageModelTools: (c.languageModelTools ?? []).map((n) => n.name),
    walkthroughs: (c.walkthroughs ?? []).map((n) => n.id),
    configurationKeysCount: Array.isArray(c.configuration)
      ? c.configuration.reduce((n, x) => n + Object.keys(x.properties ?? {}).length, 0)
      : Object.keys(c.configuration?.properties ?? {}).length,
  };
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  let out = 'C:/b/p0/probe/openvsx';
  const specs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') out = args[++i];
    else specs.push(args[i]);
  }
  if (specs.length === 0) throw new Error('namespace/name を1つ以上渡す');
  const res = [];
  for (const s of specs) {
    try {
      res.push(await one(s, out));
    } catch (e) {
      res.push({ spec: s, error: e.message });
    }
  }
  console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => {
  console.error(`p0-openvsx-meta: ${e.message}`);
  process.exit(1);
});
