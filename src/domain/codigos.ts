/**
 * Lectura del lector: etiqueta APYMSA de 18 dígitos (7 producto + 6 cantidad + 5 peso) o código de 7 dígitos.
 * Fuente: docs/tecnico/referencias.md §1 (Revision-HH, Exodus HandHeld).
 *
 * SDD multiorden-surtido-listado · Validación de etiqueta única (EU): el multi-orden conserva la
 * etiqueta única individual por etapa; cada etiqueta se relaciona con el pedido que recibió la pieza.
 */
export type Lectura =
  | { tipo: 'etiqueta'; codigo: string; cantidad: number; peso: number }
  | { tipo: 'codigo'; codigo: string }
  | { tipo: 'invalido'; valor: string };

export function leerCodigo(valor: string): Lectura {
  const v = valor.trim();
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
