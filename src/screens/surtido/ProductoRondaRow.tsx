/**
 * Card de producto para el surtido multi-orden.
 * Interfaz: card 15:1528 de la propuesta A (`Solicitud anticipada Uber`, rama feature-surtido-multipedido;
 * archivo "Handheld for Claude"): foto, código, chip de avance de la ronda, ubicación y desglose por
 * contenedor ("A 0/2 · B 0/2"), coloreado según el estado de cada pedido.
 *
 * Además de la referencia (sesión del 2026-11-02) se conservan:
 * - Marca de misceláneo y aviso de las partidas negadas del código.
 * - Chip "Mismo cliente" cuando los pedidos que lo necesitan comparten cliente.
 * El desglose sustituye al badge "En N pedidos". No se incorporó al design-system compartido.
 */
import { Chip } from '@ds/components/atoms/Chip/Chip';
import { statusProducto, ubicacionLegible, type Presencia, type ProductoVista } from '../../domain/ronda';
import { letraPedido } from './Contenedores';
import styles from './ProductoRondaRow.module.css';

type Props = {
  producto: ProductoVista;
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

export function ProductoRondaRow({ producto: v, onClick }: Props) {
  const status = statusProducto(v);
  const enVariosPedidos = v.presencias.length > 1;
  const clientesUnicos = new Set(v.presencias.map((p) => p.cliente.id));
  const mismoClienteEnPresencias = enVariosPedidos && clientesUnicos.size === 1;
  const negadas = v.presencias.filter((p) => p.motivoNegacion);

  return (
    <button type="button" className={styles.row} onClick={onClick} disabled={!onClick}>
      <div className={styles.foto}>
        <img src={v.imagen} alt="" />
      </div>
      <div className={styles.content}>
        <div className={styles.top}>
          <div className={styles.codigoLinea}>
            <span className={styles.codigo}>{v.codigo}</span>
            {v.miscelaneo && <span className={styles.badgeMiscelaneo}>Misc.</span>}
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
        <div className={styles.desglose}>
          {v.presencias.map((p) => (
            <span key={p.pedidoId} className={`${styles.tag} ${claseTag(p)}`} title={`Pedido ${p.pedidoId}`}>
              <b>{letraPedido(p.ordenPedido)}</b> {p.estado === 'negado' ? 'Negado' : `${p.surtido}/${p.solicitado}`}
            </span>
          ))}
          {mismoClienteEnPresencias && <span className={styles.chipMismoCliente}>Mismo cliente</span>}
        </div>
        {negadas.length > 0 && (
          <p className={styles.negado}>
            Negado en {negadas.map((p) => letraPedido(p.ordenPedido)).join(', ')} · {negadas[0].motivoNegacion}
          </p>
        )}
      </div>
    </button>
  );
}
