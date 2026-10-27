/**
 * Sonidos de acierto/error y dictado por voz.
 * Web Audio con respaldo en <audio>; el contexto se reanuda en cada gesto (necesario en Android/Zebra).
 * Fuente: Revision-HH app.js (docs/tecnico/referencias.md §2).
 */
type Clave = 'ok' | 'error';

// BASE_URL: en GitHub Pages la app vive bajo /HH-Surtido-Multiorden/.
const urls: Record<Clave, string> = {
  ok: `${import.meta.env.BASE_URL}sounds/beep-ok.mp3`,
  error: `${import.meta.env.BASE_URL}sounds/beep-error.mp3`,
};
const buffers: Partial<Record<Clave, AudioBuffer>> = {};
let ctx: AudioContext | null = null;

export const preferencias = {
  /** Configuraciones › Sonido: "Alertas sonoras" */
  alertas: true,
  /** Configuraciones › Sonido: "Lectura de elementos" */
  lectura: true,
};

function contexto(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  for (const k of Object.keys(urls) as Clave[]) {
    fetch(urls[k])
      .then((r) => r.arrayBuffer())
      .then((b) => ctx!.decodeAudioData(b))
      .then((buf) => (buffers[k] = buf))
      .catch(() => undefined);
  }
  return ctx;
}

const desbloquear = () => {
  const c = contexto();
  if (c && c.state === 'suspended') c.resume().catch(() => undefined);
};
for (const ev of ['touchstart', 'touchend', 'keydown', 'click']) document.addEventListener(ev, desbloquear, { passive: true });

export function sonar(clave: Clave) {
  if (!preferencias.alertas) return;
  const c = contexto();
  const buf = buffers[clave];
  if (c && buf) {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
    return;
  }
  new Audio(urls[clave]).play().catch(() => undefined);
}

/** Dictado (equivalente web de SAPI en el legado). Los textos exactos siguen PENDIENTES (docs/tecnico/referencias.md §2). */
export function decir(texto: string) {
  if (!preferencias.lectura || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'es-MX';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
