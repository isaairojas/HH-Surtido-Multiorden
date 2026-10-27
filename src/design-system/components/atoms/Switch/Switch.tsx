/**
 * Figma: Switch (Property 1 = Default | Variant2)
 * nodeId: 5170:21980
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=5170-21980
 * Última sincronización: 2026-09-29
 *
 * Property 1 se mapea a `checked` (boolean): Default = OFF, Variant2 = ON. Ver discrepancia D4.
 */
import styles from './Switch.module.css';

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
};

export function Switch({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      className={`${styles.switch} ${checked ? styles.on : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} />
    </button>
  );
}
