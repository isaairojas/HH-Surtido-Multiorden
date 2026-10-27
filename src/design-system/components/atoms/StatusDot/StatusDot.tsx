/**
 * Figma: Estado (conjunto 5234:23533 con 4 variantes)
 * nodeId: 5234:23533
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=5234-23533
 * Última sincronización: 2026-09-29
 */
import styles from './StatusDot.module.css';

export type EstadoImpresora = 'conectada' | 'sin-conexion' | 'conectando' | 'no-disponible';

type Props = { estado: EstadoImpresora };

/** Punto de 8 px de color según el estado (Botones/Success/Error/Amarillo/Disabled). */
export function StatusDot({ estado }: Props) {
  return <span className={`${styles.dot} ${styles[estado]}`} aria-label={estado} />;
}
