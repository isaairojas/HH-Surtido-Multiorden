/**
 * Lectura del lector: etiqueta APYMSA de 18 dígitos (7 producto + 6 cantidad + 5 peso) o código de 7 dígitos.
 * Fuente: docs/tecnico/referencias.md §1 (Revision-HH, Exodus HandHeld).
 *
 * El QR de etiqueta única no está en la demo (2026-11-09): en la ronda funciona como en la canónica.
 */
export type Lectura =
  | { tipo: 'etiqueta'; codigo: string; cantidad: number; peso: number }
  | { tipo: 'codigo'; codigo: string }
  | { tipo: 'invalido'; valor: string };

/**
 * SDD 2026-10-26-multiorden-surtido-listado · Validación de producto escaneado: el lector conserva solo dígitos, "-",
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
  return { tipo: 'invalido', valor: v };
}

/** Genera una etiqueta de 18 dígitos (útil para pruebas y para el simulador de escaneo). */
export function etiqueta(codigo: string, cantidad: number, peso = 0): string {
  return `${codigo}${String(cantidad).padStart(6, '0')}${String(peso).padStart(5, '0')}`;
}
