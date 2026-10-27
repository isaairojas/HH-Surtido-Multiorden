/**
 * Figma: chip de cantidad dentro de "Card revisión aleatoria" (3086:11545) y chips de promoción (4582:23627)
 * nodeId: 3086:11545
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=3086-11545
 * Última sincronización: 2026-09-29
 */
import styles from './Chip.module.css';

export type ChipStatus = 'no-iniciado' | 'parcial' | 'completado' | 'negado' | 'negado-promocion';

type Props = {
  status: ChipStatus;
  /** Cantidad surtida / revisada. */
  value?: number;
  /** Cantidad solicitada. */
  total?: number;
};

/** "0 de 10" (números en negritas) o "Negado". */
export function Chip({ status, value = 0, total = 0 }: Props) {
  const negado = status === 'negado' || status === 'negado-promocion';
  return (
    <div className={[styles.chip, styles[status], negado ? styles.centered : ''].join(' ')}>
      {negado ? (
        <b>Negado</b>
      ) : (
        <>
          <b>{value}</b>
          <span>de</span>
          <b>{total}</b>
        </>
      )}
    </div>
  );
}
