/**
 * Figma: bloques "Actividad" / "Fecha" / "DocumentoID" de Asignación de tareas
 * nodeId: 3048:10057
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=3048-10057
 * Última sincronización: 2026-09-29
 */
import type { ReactNode } from 'react';
import styles from './InfoBlock.module.css';

type Row = { label?: ReactNode; value: ReactNode };

type Props = {
  title: string;
  icon: string;
  iconSize: { w: number; h: number };
  rows: Row[];
};

export function InfoBlock({ title, icon, iconSize, rows }: Props) {
  return (
    <div className={styles.block}>
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <span>{title}</span>
          <img src={icon} alt="" width={iconSize.w} height={iconSize.h} />
        </div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className={`${styles.row} ${i === rows.length - 1 ? styles.last : ''}`}>
          {r.label ? (
            <div className={styles.pair}>
              <b>{r.label}</b>
              <span>{r.value}</span>
            </div>
          ) : (
            <span>{r.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}
