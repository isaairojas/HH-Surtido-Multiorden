/**
 * Lectura del lector: etiqueta APYMSA de 18 dígitos (7 producto + 6 cantidad + 5 peso), código de 7 dígitos o QR
 * de etiqueta única (51 a 99 caracteres: 7 producto + 6 cantidad + el resto identifica la etiqueta), como
 * `parseScannedCode` del V2 (`src/utils/formats.ts`).
 * Fuente: docs/tecnico/referencias.md §1 (Revision-HH, Exodus HandHeld).
 */
export type Lectura =
  | { tipo: 'etiqueta'; codigo: string; cantidad: number; peso: number }
  | { tipo: 'qr'; codigo: string; cantidad: number; qr: string }
  | { tipo: 'codigo'; codigo: string }
  | { tipo: 'invalido'; valor: string };

/**
 * SDD 2026-10-26-multipedido-surtido-listado · Validación de producto escaneado: el lector conserva solo dígitos, "-",
 * "F" y "C", con un máximo de 100 caracteres (igual que hoy).
 */
export function limpiarLectura(valor: string): string {
  return valor.replace(/[^0-9\-FC]/g, '').slice(0, 100);
}

export function leerCodigo(valor: string): Lectura {
  const v = limpiarLectura(valor.trim());
  if (/^\d{18}$/.test(v)) {
    return {
      tipo: 'etiqueta',
      codigo: v.substring(0, 7),
      cantidad: parseInt(v.substring(7, 13), 10) || 1,
      peso: parseInt(v.substring(13, 18), 10) || 0,
    };
  }
  if (/^\d{7}$/.test(v)) return { tipo: 'codigo', codigo: v };
  if (v.length >= 51 && v.length < 100 && /^\d{13}/.test(v)) {
    return { tipo: 'qr', codigo: v.substring(0, 7), cantidad: parseInt(v.substring(7, 13), 10) || 1, qr: v };
  }
  return { tipo: 'invalido', valor: v };
}

/** Genera una etiqueta de 18 dígitos (útil para pruebas y para el simulador de escaneo). */
export function etiqueta(codigo: string, cantidad: number, peso = 0): string {
  return `${codigo}${String(cantidad).padStart(6, '0')}${String(peso).padStart(5, '0')}`;
}

/**
 * QR de etiqueta única de la demo: producto + cantidad + "F" + número de serie, rellenado hasta 60 caracteres.
 * Cada serie es una etiqueta distinta (E1, E2…).
 */
export function qrEtiquetaUnica(codigo: string, cantidad: number, serie: number): string {
  const base = `${codigo}${String(cantidad).padStart(6, '0')}F`;
  return base + String(serie).padStart(60 - base.length, '0');
}
