/**
 * Figma: Notificaciones Toast Verde (192:16685, Toast=Inicio) · Notificaciones Toast Rojo (131:6148, Property 1=Default)
 *        Maestros en "📲 Surtido - Un pedido x ronda" › NO TOCAR
 * nodeId: 192:16685
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=192-16685
 * Última sincronización: 2026-09-29
 */
import closeIcon from '@assets/icons/toast-close.svg';
import divider from '@assets/icons/toast-trazado-54.svg';
import successIcon from '@assets/icons/toast-success.svg';
import errorIcon from '@assets/icons/toast-error.svg';
import styles from './Toast.module.css';

export type ToastKind = 'success' | 'error';

type Props = {
  kind: ToastKind;
  title: string;
  message: string;
  onClose?: () => void;
  /** Variante "Toast=Fin" (192:16686): la barra inferior se contrae hacia la izquierda. */
  fin?: boolean;
};

export function Toast({ kind, title, message, onClose, fin }: Props) {
  return (
    <div className={`${styles.toast} ${styles[kind]} ${fin ? styles.fin : ''}`} role="status">
      <div className={styles.bg} />
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        <p className={styles.message}>{message}</p>
      </div>
      <div className={styles.bar} />
      <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
        <img src={closeIcon} alt="" />
      </button>
      <div className={styles.divider}>
        <img src={divider} alt="" />
      </div>
      <img className={styles.icon} src={kind === 'success' ? successIcon : errorIcon} alt="" />
    </div>
  );
}
