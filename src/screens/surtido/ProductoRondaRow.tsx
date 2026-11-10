/**
 * Card de producto para el surtido multi-orden.
 * Interfaz: card 15:1528 de la propuesta A (`Solicitud anticipada Uber`, rama feature-surtido-multipedido;
 * archivo "Handheld for Claude"): foto, código, chip de avance de la ronda, ubicación y desglose por
 * contenedor ("A 0/2 · B 0/2"), coloreado según el estado de cada pedido.
 *
 * Un código negado solo se marca con el chip "Negado" y el desglose ("B Negado"), sin leyenda aparte con el
 * motivo (revisión del usuario, 2026-11-09).
 * Sin marca de misceláneo ni chip "Mismo cliente" (clarify del 2026-11-09, filas 7 y 17): "Mismo cliente"
 * solo va en el Detalle de la ronda.
 * El desglose sustituye al badge "En N pedidos". No se incorporó al design-system compartido.
 */
import { useState } from 'react';
import sinImagen from '@assets/productos/producto-sin-imagen.svg';
import { Chip } from '@ds/components/atoms/Chip/Chip';
import { statusProducto, ubicacionLegible, type Presencia, type ProductoVista } from '../../domain/ronda';
import styles from './ProductoRondaRow.module.css';

type Props = {
  producto: ProductoVista;
  /** Con un solo pedido la fila es la de hoy: sin desglose por contenedor. Por defecto, multi-orden. */
  multiorden?: boolean;
  /** Último producto escaneado: fondo azul claro, como el resaltado de Revision-HH-v2. */
  marcado?: boolean;
  onClick?: () => void;
};

/** En 0 la etiqueta se queda blanca; parcial y completo toman los colores del chip de avance. */
const claseTag = (p: Presencia) =>
  p.estado === 'negado'
    ? styles.tagNegado
    : p.estado === 'completo'
      ? styles.tagListo
      : p.estado === 'parcial'
        ? styles.tagParcial
        : '';

export function ProductoRondaRow({ producto: v, multiorden = true, marcado, onClick }: Props) {
  const status = statusProducto(v);
  // SDD 2026-10-26-surtido-listado-imagen-familia · Imagen del producto en el listado: si la imagen no responde, la
  // imagen por defecto, con el mismo criterio que el surtido anterior.
  const [imagenRota, setImagenRota] = useState(false);

  return (
    <button
      type="button"
      className={`${styles.row} ${marcado ? styles.marcado : ''}`}
      data-codigo={v.codigo}
      aria-current={marcado ? 'true' : undefined}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className={styles.foto}>
        <img src={imagenRota ? sinImagen : v.imagen} alt="" onError={() => setImagenRota(true)} />
      </div>
      <div className={styles.content}>
        <div className={styles.top}>
          <div className={styles.codigoLinea}>
            <span className={styles.codigo}>{v.codigo}</span>
          </div>
          <Chip status={status} value={v.surtidoTotal} total={v.solicitadoTotal} />
        </div>
        <div className={styles.ubicacion}>
          {ubicacionLegible(v.ubicacion).map((u, i) => (
            <span key={i} className={styles.ubicacionItem}>
              {i > 0 && <b>|</b>}
              <span>{u}</span>
            </span>
          ))}
        </div>
        {multiorden && (
          <div className={styles.desglose}>
            {v.presencias.map((p) => (
              <span key={p.pedidoId} className={`${styles.tag} ${claseTag(p)}`} title={`Pedido ${p.pedidoId}`}>
                <b>{p.contenedor}</b> {p.estado === 'negado' ? 'Negado' : `${p.surtido}/${p.solicitado}`}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
