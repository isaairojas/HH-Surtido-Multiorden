/**
 * Figma: Datos del producto (foto + Código + descripción)
 * nodeId: 3062:12611 (modales de revisión) · 3199:6382 (Detalle de producto)
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=3062-12611
 * Última sincronización: 2026-09-29
 */
import { LabeledField } from '../LabeledField/LabeledField';
import styles from './ProductSummary.module.css';

type Props = {
  foto: string;
  codigo: string;
  descripcion: string;
  /** bordered = trazo azul 1 px y radio 5 (modales) · framed = fondo azul con 3 px de margen (Detalle) */
  photoStyle?: 'bordered' | 'framed';
  /** Alto fijo de la caja de descripción (86 px en 3308:17312). */
  descriptionHeight?: number;
};

export function ProductSummary({ foto, codigo, descripcion, photoStyle = 'bordered', descriptionHeight }: Props) {
  return (
    <div className={styles.summary}>
      <div className={`${styles.photo} ${styles[photoStyle]}`}>
        <div className={styles.photoInner}>
          <img src={foto} alt="" />
        </div>
      </div>
      <div className={styles.info}>
        <LabeledField label="Código" value={codigo} valueBold valueAlign="center" />
        <div className={styles.description} style={descriptionHeight ? { height: descriptionHeight } : undefined}>
          <p>{descripcion}</p>
        </div>
      </div>
    </div>
  );
}
