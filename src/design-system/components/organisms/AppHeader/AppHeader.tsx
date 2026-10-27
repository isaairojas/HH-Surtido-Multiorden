/**
 * Figma: Header (frame en Revisión; componente 6640:1866 en Configuraciones y 2888:9705 en Facturación/Embarque)
 * nodeId: 3048:10139
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=3048-10139
 * Última sincronización: 2026-09-29
 */
import arrow from '@assets/icons/arrow-left-short.svg';
import tasks from '@assets/illustrations/tasks-solid.svg';
import moreVert from '@assets/icons/more-vert.svg';
import styles from './AppHeader.module.css';

type Props = {
  /** Texto junto a la flecha ("Menú"). Sin texto en Detalle de producto. */
  backLabel?: string;
  /** Oculta la flecha (Datos de la factura antes de embarcar). */
  showBack?: boolean;
  onBack?: () => void;
  /** Botón circular ⋮ (Menu hamburguesa 3048:10147). */
  onMenu?: () => void;
};

export function AppHeader({ backLabel, showBack = true, onBack, onMenu }: Props) {
  return (
    <header className={styles.header}>
      {showBack ? (
        <button type="button" className={styles.back} onClick={onBack} aria-label={backLabel ?? 'Regresar'}>
          <img src={arrow} alt="" width={20.482} height={17.923} />
          {backLabel && <span className={styles.backLabel}>{backLabel}</span>}
        </button>
      ) : (
        <span />
      )}
      <img className={styles.watermark} src={tasks} alt="" width={80.629} height={99.036} />
      {onMenu && (
        <button type="button" className={styles.menu} onClick={onMenu} aria-label="Menú">
          <img src={moreVert} alt="" width={5.474} height={22.024} />
        </button>
      )}
    </header>
  );
}
