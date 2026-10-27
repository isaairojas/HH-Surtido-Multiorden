/**
 * Figma: selector de cantidad — Grupo 103 (−) · Grupo 104 (valor) · Grupo 105 (+)
 * nodeId: 3199:6429
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=3199-6429
 * Última sincronización: 2026-09-29
 */
import menos from '@assets/icons/stepper-menos.svg';
import mas from '@assets/icons/stepper-mas.svg';
import styles from './Stepper.module.css';

type Props = {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  /** Íconos alternos (p. ej. versión gris cuando el botón está inhabilitado en Facturación). */
  minusAsset?: string;
  plusAsset?: string;
};

export function Stepper({ value, min = 0, max = Number.POSITIVE_INFINITY, onChange, minusAsset, plusAsset }: Props) {
  return (
    <div className={styles.stepper}>
      <button type="button" className={styles.side} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label="Menos">
        <img src={minusAsset ?? menos} alt="" width={52.816} height={43} />
      </button>
      <div className={styles.value}>{value}</div>
      <button type="button" className={styles.side} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label="Más">
        <img src={plusAsset ?? mas} alt="" width={52.815} height={43} />
      </button>
    </div>
  );
}
