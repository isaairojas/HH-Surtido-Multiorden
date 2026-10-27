/**
 * Fila de producto para el surtido multi-orden.
 * Extiende el patrón de OrderItemRow con:
 * - Thumbnail del producto.
 * - Badge "En N pedidos" cuando el código aparece en más de un pedido.
 * - Chip "Mismo cliente" cuando los pedidos que lo necesitan comparten cliente.
 * - Marca de misceláneo y aviso cuando alguna de sus partidas quedó negada.
 * No se incorporó al design-system compartido hasta validar la variante.
 */
import { Chip } from '@ds/components/atoms/Chip/Chip';
import { statusProducto, ubicacionLegible, type ProductoVista } from '../../domain/ronda';
import styles from './ProductoRondaRow.module.css';

type Props = {
  producto: ProductoVista;
  onClick?: () => void;
};

export function ProductoRondaRow({ producto: v, onClick }: Props) {
  const status = statusProducto(v);
  const enVariosPedidos = v.presencias.length > 1;
  const clientesUnicos = new Set(v.presencias.map((p) => p.cliente.id));
  const mismoClienteEnPresencias = enVariosPedidos && clientesUnicos.size === 1;
  const negadas = v.presencias.filter((p) => p.motivoNegacion);

  return (
    <button type="button" className={styles.row} onClick={onClick} disabled={!onClick}>
      <div className={styles.thumb}>
        <img src={v.imagen} alt="" />
      </div>
      <div className={styles.content}>
        <div className={styles.top}>
          <div className={styles.codigoLinea}>
            <span className={styles.codigo}>{v.codigo}</span>
            {enVariosPedidos && (
              <span className={styles.badgeMulti} title={v.presencias.map((p) => p.pedidoId).join(', ')}>
                En {v.presencias.length} pedidos
              </span>
            )}
            {v.miscelaneo && <span className={styles.badgeMiscelaneo}>Misc.</span>}
          </div>
          <Chip status={status} value={v.surtidoTotal} total={v.solicitadoTotal} />
        </div>
        <p className={styles.descripcion}>{v.descripcion}</p>
        {negadas.length > 0 && (
          <p className={styles.negado}>
            Negado en {negadas.map((p) => p.pedidoId).join(', ')} · {negadas[0].motivoNegacion}
          </p>
        )}
        <div className={styles.foot}>
          <div className={styles.ubicacion}>
            {ubicacionLegible(v.ubicacion).map((u, i) => (
              <span key={i} className={styles.ubicacionItem}>
                {i > 0 && <b>|</b>}
                <span>{u}</span>
              </span>
            ))}
          </div>
          {mismoClienteEnPresencias && <span className={styles.chipMismoCliente}>Mismo cliente</span>}
        </div>
      </div>
    </button>
  );
}
