/**
 * Figma: Trazado 38 (3048:10036) · Trazado 2102 (3060:12587) · Line 2 (3048:10165)
 * nodeId: 3048:10036
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=3048-10036
 * Última sincronización: 2026-09-29
 */
import type { CSSProperties } from 'react';
import styles from './Divider.module.css';

type Props = {
  /** title = 1.5 px #E1E1E1 · modal = 1 px #E4E4E4 · list = 2 px #E1E1E1 (dibujado hacia arriba) */
  variant?: 'title' | 'modal' | 'list';
  /** Ancho fijo cuando en Figma difiere del contenedor (p. ej. 415.902 px en 3126:14190). */
  width?: number;
};

/** Línea de alto 0 en el flujo; el trazo se pinta fuera de la caja, igual que en Figma. */
export function Divider({ variant = 'title', width }: Props) {
  const style: CSSProperties | undefined = width ? { width, alignSelf: 'center' } : undefined;
  return <div className={`${styles.divider} ${styles[variant]}`} style={style} role="separator" />;
}
