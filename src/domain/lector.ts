/**
 * Qué hace la HH con una lectura del lector del listado (el detalle no tiene lector, como el V2: clarify 28).
 * SDD 2026-10-26-multipedido-surtido-listado · Validación de producto escaneado / Validación de etiqueta única (EU).
 *
 * Etiqueta única, como el V2 (`AssortmentTaskController.onScanningCode`): con la EU activa en la tarea y un producto
 * que la requiere, el QR se valida antes de sumar cantidad. En la ronda la etiqueta no se puede repetir (en ningún
 * pedido) y se relaciona con el pedido que recibe la pieza. Si el producto es perecedero y hay etiquetas con
 * caducidad más próxima, se pide confirmar ("No existen etiquetas más antiguas"). Sin EU activa, el QR sigue la
 * validación de cantidad sin aviso de QR deshabilitado. La validación contra el servicio de etiqueta única (que
 * puede rechazarla) no está en la demo: la demo da por buena toda etiqueta que no se haya escaneado ya.
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
  /** Etiqueta con cantidad: se surte directo (con `etiqueta` si es una etiqueta única validada). */
  | { tipo: 'surtir'; codigo: string; cantidad: number; etiqueta?: string }
  /** La etiqueta única ya se surtió en la ronda (o en el pedido, si la tarea tiene uno solo): no se suma nada. */
  | { tipo: 'etiqueta-repetida'; codigo: string; pedidoUnico: boolean }
  /** Perecedero con etiquetas de caducidad más próxima: "Etiqueta inválida" hasta que el usuario lo confirme. */
  | { tipo: 'etiqueta-antigua'; codigo: string; cantidad: number; etiqueta: string };

/** Lo que la lectura necesita saber de la tarea y del servicio de etiqueta única (simulado en la demo). */
export type OpcionesLectura = {
  /** `surtidoEtiquetaUnicaEnabled` de la tarea. */
  etiquetaUnica?: boolean;
  /** El servicio encuentra etiquetas del producto con caducidad más próxima que la escaneada. */
  etiquetasMasAntiguas?: boolean;
};

export function interpretarLectura(s: RondaState, valor: string, o: OpcionesLectura = {}): ResultadoLectura {
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
  const partida = partidaEn(r, destino);
  if (l.tipo === 'qr') {
    // El QR trae la cantidad: no se abre la captura, igual que en el V2.
    if (!o.etiquetaUnica || !partida.requiereEU) return { tipo: 'surtir', codigo: l.codigo, cantidad: l.cantidad };
    if ((s.etiquetas ?? []).some((e) => e.qr === l.qr)) {
      return { tipo: 'etiqueta-repetida', codigo: l.codigo, pedidoUnico: r.pedidos.length === 1 };
    }
    if (partida.perecedero && o.etiquetasMasAntiguas) {
      return { tipo: 'etiqueta-antigua', codigo: l.codigo, cantidad: l.cantidad, etiqueta: l.qr };
    }
    return { tipo: 'surtir', codigo: l.codigo, cantidad: l.cantidad, etiqueta: l.qr };
  }
  if (l.tipo === 'codigo' || partida.miscelaneo) return { tipo: 'capturar', codigo: l.codigo };
  return { tipo: 'surtir', codigo: l.codigo, cantidad: l.cantidad };
}
