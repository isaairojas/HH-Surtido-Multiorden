/**
 * Figma: panel blanco "Módulo de surtido" / "Detalle de producto" con título y Trazado 38
 * nodeId: 3048:10150
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=3048-10150
 * Última sincronización: 2026-09-29
 */
import type { CSSProperties, ReactNode } from 'react';
import { Divider } from '../../atoms/Divider/Divider';
import styles from './ContentPanel.module.css';

type Props = {
  title: string;
  children: ReactNode;
  /** Relleno inferior: 45 px (Surtido, Detalle) o 22 px (Asignación de tareas). */
  paddingBottom?: number;
  /** Alinear hijos: center (Surtido) o start (Asignación). */
  align?: 'center' | 'start';
  /** Distancia desde el borde inferior del marco (932 − 60 − 794 = 78 px; Detalle: 0). */
  bottom?: number;
  /**
   * Deja el título fijo y hace scrollable el contenido. El surtido multi-orden lo
   * necesita porque la lista agregada y el desglose por pedido crecen con la ronda,
   * mientras que los frames de Figma caben siempre en una pantalla.
   */
  scroll?: boolean;
};

export function ContentPanel({ title, children, paddingBottom = 45, align = 'center', bottom = 78, scroll }: Props) {
  const alignItems = align === 'center' ? 'center' : 'flex-start';
  const style: CSSProperties = { paddingBottom: scroll ? 0 : paddingBottom, bottom, alignItems };
  return (
    <section className={styles.panel} style={style}>
      <div className={styles.titleBlock}>
        <div className={styles.titleInner}>
          <h1 className={styles.title}>{title}</h1>
          <Divider variant="title" />
        </div>
      </div>
      {scroll ? (
        <div className={styles.scroll} style={{ alignItems, paddingBottom }}>
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
