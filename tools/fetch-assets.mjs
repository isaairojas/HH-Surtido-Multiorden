// Descarga assets de Figma (URLs temporales del MCP) al repo y registra su nodeId en docs/figma/assets.md.
// Uso: node tools/fetch-assets.mjs <lista.json>
// lista.json = [{ "url": "...", "file": "src/assets/icons/check.svg", "nodeId": "3048:10135", "figmaName": "checkmark-round" }]
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

const list = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const registry = 'docs/figma/assets.md';
if (!existsSync(registry)) {
  writeFileSync(
    registry,
    '# Assets exportados de Figma\n\nNombre de archivo = nombre de la capa en Figma (kebab-case). Descargados desde las URLs de `get_design_context` / `download_assets`.\n\n| Archivo | nodeId | Capa en Figma | Bytes |\n|---|---|---|---|\n',
  );
}
const known = readFileSync(registry, 'utf8');

for (const a of list) {
  if (existsSync(a.file) && statSync(a.file).size > 0 && !a.force) {
    console.log('ya existe', a.file);
    continue;
  }
  const res = await fetch(a.url);
  if (!res.ok) throw new Error(`${res.status} ${a.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(a.file), { recursive: true });
  writeFileSync(a.file, buf);
  if (!known.includes(`| \`${a.file}\` |`)) appendFileSync(registry, `| \`${a.file}\` | ${a.nodeId} | ${a.figmaName} | ${buf.length} |\n`);
  console.log('ok', a.file, buf.length);
}
