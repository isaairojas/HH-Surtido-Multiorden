/**
 * Figma: Botones (set remoto 9:92: Bttn Type=Default | Cancel / Error | Accept / Success | Disabled)
 *        + "Bttn" (3199:6477), "Botón" contorno (4582:23666), "Boton cancelar" (3158:15440), "Boton aceptar" (3048:10096)
 * nodeId: 9:92
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=9-92
 * Última sincronización: 2026-09-29
 */
import type { ButtonHTMLAttributes } from 'react';
import crossSmall from '@assets/icons/cross-small.svg';
import checkmarkRound from '@assets/icons/checkmark-round.svg';
import styles from './Button.module.css';

export type ButtonVariant = 'default' | 'error' | 'success' | 'disabled' | 'outline';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: ButtonVariant;
  /** Texto del botón (18 px Regular). */
  label?: string;
  /** Ícono centrado: ✕ (cross-small) o ✓ (checkmark-round). */
  icon?: 'cross' | 'check';
  /**
   * SVG aplanado exportado de Figma (fondo + ícono) para los botones que en Figma son una sola imagen,
   * p. ej. "Boton cancelar" 3048:10094 o "Grupo 45" 3308:17322.
   */
  asset?: string;
  /** Ajuste fino del ícono ✓: en algunos frames el vector mide 31.012 × 32.72 (4582:24162). */
  checkWidth?: number;
};

export function Button({ variant = 'default', label, icon, asset, checkWidth, className, disabled, type = 'button', ...rest }: Props) {
  const v = disabled && variant !== 'outline' ? 'disabled' : variant;
  return (
    <button
      type={type}
      disabled={disabled}
      className={[styles.button, asset ? styles.asset : styles[v], className].filter(Boolean).join(' ')}
      {...rest}
    >
      {asset ? (
        <img src={asset} alt="" className={styles.assetImg} />
      ) : icon === 'cross' ? (
        <img src={crossSmall} alt="" width={23.822} height={27.486} />
      ) : icon === 'check' ? (
        <img src={checkmarkRound} alt="" width={checkWidth ?? 30.746} height={32.72} />
      ) : (
        <span className={styles.label}>{label}</span>
      )}
      {(icon || asset) && label ? <span className="sr-only">{label}</span> : null}
    </button>
  );
}
