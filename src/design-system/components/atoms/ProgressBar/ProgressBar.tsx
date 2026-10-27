/**
 * Figma: Barra progreso
 * nodeId: 3095:16641 (0 / n) · 3081:1940 (n / n)
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=3095-16641
 * Última sincronización: 2026-09-29
 */
import styles from './ProgressBar.module.css';

type Props = {
  /** 0 – 1 */
  value: number;
};

/** Barra de 12 px con relleno degradado; en Figma el ancho del relleno está ligado a la variable "Largo barra 1". */
export function ProgressBar({ value }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className={styles.fill} style={{ width: `${pct}%` }} />
    </div>
  );
}
