/**
 * Qué hace la HH con una lectura del lector del listado (el detalle no tiene lector, como el V2: clarify 28).
 * SDD 2026-10-26-multiorden-surtido-listado · Validación de producto escaneado.
 *
 * La etiqueta única (QR) y la caducidad más próxima no están en la demo (decisión del 2026-11-09): en la ronda
 * funcionan como en la canónica. Ver SDD 2026-10-26-multiorden-surtido-listado · Validación de etiqueta única (EU).
 *
 * Pura: decide, no despacha. La pantalla aplica el resultado (avisa, abre la captura o surte).
 */
import { leerCodigo } from './codigos';
import { codigoEnRonda, codigoNegado, partidaEn, proximaPartidaPara, type RechazoSurtido, type RondaState } from './ronda';

export type ResultadoLectura =
  /** Lectura que no es ni código ni etiqueta: solo suena el error. */
  | { tipo: 'invalida' }
  | { tipo: 'rechazo'; rechazo: RechazoSurtido; codigo: string }
  /** Código sin cantidad o misceláneo: se abre la captura de cantidad. */
  | { tipo: 'capturar'; codigo: string }
  /** Etiqueta con cantidad: se surte directo. */
  | { tipo: 'surtir'; codigo: string; cantidad: number };

export function interpretarLectura(s: RondaState, valor: string): ResultadoLectura {
  const l = leerCodigo(valor);
  if (l.tipo === 'invalido') return { tipo: 'invalida' };

  const r = s.ronda;
  const destino = proximaPartidaPara(r, l.codigo);
  if (!destino) {
    if (codigoNegado(r, l.codigo)) return { tipo: 'rechazo', codigo: l.codigo, rechazo: 'producto-negado' };
    if (!codigoEnRonda(r, l.codigo)) return { tipo: 'rechazo', codigo: l.codigo, rechazo: 'fuera-de-ronda' };
    // Sobrante (revisión del 2026-11-09): el código ya se surtió en todos sus pedidos. Como hoy, sin cantidad
    // (o misceláneo) se pide la cantidad y, al capturarla, se rechaza por mayor a la solicitada.
    const miscelaneo = r.pedidos.some((p) => p.partidas.some((x) => x.codigo === l.codigo && x.miscelaneo));
    if (l.tipo === 'codigo' || miscelaneo) return { tipo: 'capturar', codigo: l.codigo };
    return { tipo: 'rechazo', codigo: l.codigo, rechazo: 'excede-solicitado' };
  }
  if (l.tipo === 'codigo' || partidaEn(r, destino).miscelaneo) return { tipo: 'capturar', codigo: l.codigo };
  return { tipo: 'surtir', codigo: l.codigo, cantidad: l.cantidad };
}
