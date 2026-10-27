// Genera src/design-system/tokens/tokens.json y tokens.css a partir de la exportación de Figma
// (docs/figma/cache/styles-export.json). Volver a correrlo tras resincronizar estilos:
//   node tools/build-tokens.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync('docs/figma/cache/styles-export.json', 'utf8'));
const motionSrc = JSON.parse(readFileSync('docs/figma/cache/motion-export.json', 'utf8'));

const kebab = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(Text font|Button font)\//, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const rgba = (hex, a) => {
  if (a === undefined || a >= 1) return hex.toUpperCase();
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(a * 1000) / 1000})`;
};

// Roboto: line-height "Auto" de Figma = métricas hhea (ascender 1900 + descender 500) / 2048 upm.
const ROBOTO_AUTO_LH = 1.171875;

const tokens = {
  color: { primitive: {}, semantic: {} },
  typography: { family: {}, size: {}, weight: {}, lineHeight: {}, letterSpacing: {}, textCase: {}, styles: {} },
  spacing: {},
  radius: {},
  shadow: {},
  border: {},
  opacity: {},
  breakpoint: { 'frame-movil': { value: '430px', figmaName: 'Frame base 430×932' } },
  zIndex: {},
  motion: { duration: {}, easing: {} },
};

const css = [];
const line = (name, value, comment) => css.push(`  --${name}: ${value};${comment ? ` /* ${comment} */` : ''}`);

// ---- Color: los estilos de Figma no usan alias entre sí; cada estilo es un token con su valor literal.
css.push('  /* Color — estilos de color locales de Figma */');
for (const p of src.paint) {
  const key = kebab(p.name);
  const value = rgba(p.color, p.opacity);
  tokens.color.primitive[key] = { value, figmaName: p.name, ...(p.desc ? { description: p.desc } : {}) };
  line(`color-${key}`, value, `figma: ${p.name}`);
}
css.push('');
css.push('  /* Color — variables de prototipo (colecciones "Un pedido x ronda", "Revisión en surtido", "Facturación") */');
for (const v of src.variables.filter((x) => x.type === 'COLOR')) {
  const key = `${kebab(v.col)}-${kebab(v.name)}`;
  const value = rgba(v.value, v.alpha);
  tokens.color.semantic[key] = { value, figmaName: `${v.col}/${v.name}`, figmaType: 'variable' };
  line(`color-var-${key}`, value, `figma var: ${v.col}/${v.name}`);
}

// ---- Tipografía
css.push('');
css.push('  /* Tipografía — estilos de texto de Figma */');
tokens.typography.family.roboto = { value: "'Roboto', sans-serif", figmaName: 'Roboto' };
line('font-family-roboto', "'Roboto', sans-serif");
tokens.typography.lineHeight.auto = { value: ROBOTO_AUTO_LH, figmaName: 'Auto (Roboto)' };
line('line-height-auto', ROBOTO_AUTO_LH, 'Figma "Auto" con Roboto');
for (const t of src.text) {
  const key = kebab(t.name);
  const lh = t.lh === 'AUTO' ? 'var(--line-height-auto)' : `${t.lh}px`;
  const transform = t.case === 'TITLE' ? 'capitalize' : 'none';
  tokens.typography.size[key] = { value: `${t.size}px`, figmaName: t.name };
  tokens.typography.weight[key] = { value: t.weight, figmaName: `${t.family} ${t.style}` };
  tokens.typography.lineHeight[key] = { value: t.lh === 'AUTO' ? ROBOTO_AUTO_LH : `${t.lh}px`, figmaName: t.name };
  tokens.typography.letterSpacing[key] = { value: '0em', figmaName: t.name };
  tokens.typography.textCase[key] = { value: transform, figmaName: t.case };
  tokens.typography.styles[key] = {
    figmaName: t.name,
    ...(t.remote ? { remote: true } : {}),
    fontFamily: t.family,
    fontWeight: t.weight,
    fontSize: `${t.size}px`,
    lineHeight: tokens.typography.lineHeight[key].value,
    letterSpacing: '0em',
    textTransform: transform,
  };
  line(`font-${key}`, `${t.weight} ${t.size}px/${lh} var(--font-family-roboto)`, `figma: ${t.name}${t.remote ? ' (remoto)' : ''}`);
  if (transform !== 'none') line(`text-transform-${key}`, transform, `figma textCase ${t.case}`);
}

// ---- Sombras
css.push('');
css.push('  /* Efectos — estilos de efecto de Figma */');
for (const e of src.effect) {
  const key = kebab(e.name);
  const value = e.effects
    .map((f) => `${f.type === 'INNER_SHADOW' ? 'inset ' : ''}${f.x}px ${f.y}px ${Math.round(f.blur * 100) / 100}px ${f.spread}px ${rgba(f.color, f.alpha)}`)
    .join(', ');
  tokens.shadow[key] = { value, figmaName: e.name };
  line(`shadow-${key}`, value, `figma: ${e.name}`);
}

// ---- Movimiento (transiciones del prototipo)
css.push('');
css.push('  /* Movimiento — transiciones del prototipo de Figma */');
for (const m of motionSrc.easing) {
  tokens.motion.easing[m.key] = { value: m.css, figmaName: m.figmaName, ...(m.spring ? { spring: m.spring } : {}) };
  line(`easing-${m.key}`, m.css, `figma: ${m.figmaName}`);
}
for (const d of motionSrc.duration) {
  tokens.motion.duration[d.key] = { value: `${d.ms}ms`, figmaName: d.figmaName };
  line(`duration-${d.key}`, `${d.ms}ms`, `figma: ${d.figmaName}`);
}

writeFileSync('src/design-system/tokens/tokens.json', JSON.stringify(tokens, null, 2) + '\n');
writeFileSync(
  'src/design-system/tokens/tokens.css',
  `/* Generado por tools/build-tokens.mjs desde Figma (${new Date().toISOString().slice(0, 10)}). No editar a mano.\n` +
    ` * Tema único (claro): las colecciones de variables de Figma tienen un solo modo ("Mode 1"). */\n` +
    `:root {\n${css.join('\n')}\n}\n`,
);
console.log('tokens:', Object.keys(tokens.color.primitive).length, 'colores,', src.text.length, 'textos,', src.effect.length, 'sombras,', motionSrc.easing.length, 'easings');
