/**
 * Figma: pares etiqueta | valor — "Grupo 4616" (3048:10042), "Product Code Container" (3062:12615), "Label" (3199:6395)
 * nodeId: 3062:12615
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=3062-12615
 * Última sincronización: 2026-09-29
 */
import type { ReactNode } from 'react';
import styles from './LabeledField.module.css';

type Props = {
  label: ReactNode;
  value: ReactNode;
  /** Ancho fijo de 80 px (Código / Ubicación…) o ancho por contenido con relleno de 18 px (Empleado "9029"). */
  labelWidth?: 'fixed' | 'hug';
  valueBold?: boolean;
  valueAlign?: 'start' | 'center';
};

export function LabeledField({ label, value, labelWidth = 'fixed', valueBold, valueAlign = 'start' }: Props) {
  return (
    <div className={styles.field}>
      <div className={`${styles.label} ${labelWidth === 'hug' ? styles.hug : styles.fixed}`}>{label}</div>
      <div className={`${styles.value} ${valueAlign === 'center' ? styles.center : ''}`}>
        <span className={valueBold ? styles.bold : undefined}>{value}</span>
      </div>
    </div>
  );
}
