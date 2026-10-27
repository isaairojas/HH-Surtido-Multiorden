/**
 * Figma: Card revisión aleatoria (Surtido = No iniciado | Parcial | Completado | Negado | Revisado)
 * nodeId: 3086:11540
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=3086-11540
 * Última sincronización: 2026-09-29
 */
import { Chip, type ChipStatus } from '../../atoms/Chip/Chip';
import { RBadge } from '../../atoms/RBadge/RBadge';
import styles from './OrderItemRow.module.css';

export type OrderItemStatus = Exclude<ChipStatus, 'negado-promocion'>;

type Props = {
  codigo: string;
  status: OrderItemStatus;
  surtido: number;
  solicitado: number;
  /** Insignia "R". En Figma la variante "Revisado" es Completado + R; Parcial + R aparece como sobrescritura (discrepancias D26). */
  revisado?: boolean;
  ubicacion: [string, string, string, string];
  onClick?: () => void;
};

export function OrderItemRow({ codigo, status, surtido, solicitado, revisado, ubicacion, onClick }: Props) {
  return (
    <button type="button" className={styles.row} onClick={onClick} disabled={!onClick}>
      <div className={styles.content}>
        <div className={styles.top}>
          <span className={styles.codigo}>{codigo}</span>
          <div className={styles.right}>
            {revisado && <RBadge />}
            <Chip status={status} value={surtido} total={solicitado} />
          </div>
        </div>
        <div className={styles.ubicacion}>
          {ubicacion.map((u, i) => (
            <span key={i} className={styles.ubicacionItem}>
              {i > 0 && <b>|</b>}
              <span>{u}</span>
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
