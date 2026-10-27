// Genera docs/figma/cache/motion-export.json con las curvas y duraciones del prototipo de Figma.
// Las transiciones se leyeron con use_figma (node.reactions) el 2026-09-29.
// Figma no expone los parámetros de los resortes predefinidos (QUICK/GENTLE/SLOW); ver discrepancias D25.
import { writeFileSync } from 'node:fs';

// Resorte de masa 1, velocidad inicial 0, de 0 → 1.
function spring({ stiffness, damping, mass = 1 }, durationMs) {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const x = (t) => {
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    }
    if (zeta === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    const r1 = -w0 * (zeta - Math.sqrt(zeta * zeta - 1));
    const r2 = -w0 * (zeta + Math.sqrt(zeta * zeta - 1));
    return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
  };
  const n = 40;
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(Math.round(x(((durationMs / 1000) * i) / n) * 10000) / 10000);
  pts[n] = 1;
  return `linear(${pts.join(', ')})`;
}

const easing = [
  { key: 'ease-in', css: 'cubic-bezier(0.42, 0, 1, 1)', figmaName: 'EASE_IN' },
  { key: 'ease-out', css: 'cubic-bezier(0, 0, 0.58, 1)', figmaName: 'EASE_OUT' },
  { key: 'ease-in-and-out', css: 'cubic-bezier(0.42, 0, 0.58, 1)', figmaName: 'EASE_IN_AND_OUT' },
  { key: 'custom-bezier-facturacion', css: 'cubic-bezier(0.2, 0, 0, 1)', figmaName: 'CUSTOM_CUBIC_BEZIER (0.2, 0, 0, 1)' },
  // Resortes: parámetros que reproducen las duraciones que reporta Figma (umbral de reposo ≈ 5e-4).
  { key: 'spring-quick', spring: { stiffness: 300, damping: 20, mass: 1 }, ms: 744, figmaName: 'QUICK (spring, 744 ms)' },
  { key: 'spring-gentle', spring: { stiffness: 100, damping: 15, mass: 1 }, ms: 1022, figmaName: 'GENTLE (spring, 1022 ms)' },
  { key: 'spring-slow', spring: { stiffness: 216, damping: 29.4, mass: 1 }, ms: 625, figmaName: 'SLOW (spring, 625 ms) — aproximación críticamente amortiguada' },
].map((e) => (e.spring ? { ...e, css: spring(e.spring, e.ms) } : e));

const duration = [200, 300, 600, 625, 744, 802, 992, 1022, 3000, 3500, 4000, 10000].map((ms) => ({
  key: String(ms),
  ms,
  figmaName: `${ms} ms`,
}));

writeFileSync('docs/figma/cache/motion-export.json', JSON.stringify({ easing, duration }, null, 1) + '\n');
console.log('motion:', easing.length, 'easings,', duration.length, 'duraciones');
