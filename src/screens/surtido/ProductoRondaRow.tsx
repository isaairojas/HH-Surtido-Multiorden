/**
 * Card de producto para el surtido multipedido V2.
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
import { useEffect, useState } from 'react';
import sinImagen from '@assets/productos/producto-sin-imagen.svg';
import { Chip } from '@ds/components/atoms/Chip/Chip';
import { statusProducto, ubicacionLegible, type Presencia, type ProductoVista } from '../../domain/ronda';
import styles from './ProductoRondaRow.module.css';

type Props = {
  producto: ProductoVista;
  /** Con un solo pedido la fila es la de hoy: sin desglose por contenedor. Por defecto, multipedido V2. */
  multipedido?: boolean;
  /** Último producto escaneado: fondo azul claro, como el resaltado de Revision-HH-v2. */
  marcado?: boolean;
  onClick?: () => void;
  /** Milisegundos que tarda la imagen en llegar (simulación de la demo). */
  demoraImagen?: number;
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

export function ProductoRondaRow({ producto: v, multipedido = true, marcado, onClick, demoraImagen = 0 }: Props) {
  const status = statusProducto(v);
  // SDD 2026-10-26-surtido-listado-imagen-familia · Imagen del producto en el listado: si la imagen no responde, la
  // imagen por defecto, con el mismo criterio que el surtido anterior.
  const [imagenRota, setImagenRota] = useState(false);
  // "Mientras carga la imagen": la fila se pinta completa y el hueco de la foto ya tiene su tamaño (60 × 60), así
  // que la imagen aparece sin mover las demás filas.
  const [imagenLista, setImagenLista] = useState(demoraImagen <= 0);
  useEffect(() => {
    if (demoraImagen <= 0) return;
    const t = window.setTimeout(() => setImagenLista(true), demoraImagen);
    return () => window.clearTimeout(t);
  }, [demoraImagen]);

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
        {imagenLista && <img src={imagenRota ? sinImagen : v.imagen} alt="" onError={() => setImagenRota(true)} />}
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
        {multipedido && (
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
