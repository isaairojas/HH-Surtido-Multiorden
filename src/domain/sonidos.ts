/**
 * Sonidos de acierto/error y dictado por voz.
 * Web Audio con respaldo en <audio>; el contexto se reanuda en cada gesto (necesario en Android/Zebra).
 * Fuente: Revision-HH app.js (docs/tecnico/referencias.md §2).
 */
type Clave = 'ok' | 'error';

// BASE_URL: "./" en el build (relativo a la página, sirve en GitHub Pages y en githack); "/" en dev.
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

function respaldo(clave: Clave) {
  new Audio(urls[clave]).play().catch(() => undefined);
}

function reproducir(c: AudioContext, clave: Clave) {
  const buf = buffers[clave];
  if (!buf) return respaldo(clave);
  try {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
  } catch {
    respaldo(clave);
  }
}

export function sonar(clave: Clave) {
  if (!preferencias.alertas) return;
  const c = contexto();
  if (!c) return respaldo(clave);
  // En Zebra el contexto puede seguir suspendido tras el gesto: hay que esperar resume() antes de sonar.
  if (c.state === 'suspended') {
    c.resume().then(() => reproducir(c, clave)).catch(() => respaldo(clave));
    return;
  }
  reproducir(c, clave);
}

/** Dictado (equivalente web de SAPI en el legado). Los textos exactos siguen PENDIENTES (docs/tecnico/referencias.md §2). */
export function decir(texto: string) {
  if (!preferencias.lectura || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'es-MX';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
