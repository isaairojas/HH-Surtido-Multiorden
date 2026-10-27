/**
 * Figma: R revisado
 * nodeId: 3137:15180
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=3137-15180
 * Última sincronización: 2026-09-29
 */
import circle from '@assets/icons/r-revisado-circulo.svg';
import styles from './RBadge.module.css';

/** Insignia "R" (revisado) que acompaña al chip de cantidad. */
export function RBadge() {
  return (
    <div className={styles.badge} aria-label="Revisado">
      <img src={circle} alt="" width={20} height={20} className={styles.circle} />
      <span className={styles.letter}>R</span>
    </div>
  );
}
