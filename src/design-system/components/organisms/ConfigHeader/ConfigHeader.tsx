/**
 * Figma: Header de Configuraciones HH (6640:1866) — 100 px de alto, con datos del usuario.
 * nodeId: 6640:1866
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=6640-1866
 * Última sincronización: 2026-09-29
 *
 * Diferente del `AppHeader` de Revisión (90 px, sin datos del usuario). Ver discrepancia D21.
 */
import arrow from '@assets/icons/arrow-left-short.svg';
import tasks from '@assets/illustrations/tasks-solid.svg';
import person from '@assets/icons/person-header.svg';
import styles from './ConfigHeader.module.css';

type Props = {
  onBack?: () => void;
  /** Datos por defecto tomados de Figma (I6640:1867;6640:1860). */
  nombre?: string;
  empleadoId?: string;
};

export function ConfigHeader({ onBack, nombre = 'Ángel Vargas Cruz', empleadoId = '604512' }: Props) {
  return (
    <header className={styles.header}>
      <img className={styles.watermark} src={tasks} alt="" width={80.629} height={99.036} />
      <div className={styles.nav}>
        <button type="button" className={styles.back} aria-label="Regresar" onClick={onBack}>
          <img src={arrow} alt="" width={20.482} height={17.923} />
        </button>
        <div className={styles.user}>
          <img src={person} alt="" width={40} height={40} />
          <div className={styles.userText}>
            <p className={styles.name}>{nombre}</p>
            <p className={styles.id}>{empleadoId}</p>
          </div>
        </div>
        <div className={styles.menuSlot} />
      </div>
    </header>
  );
}
