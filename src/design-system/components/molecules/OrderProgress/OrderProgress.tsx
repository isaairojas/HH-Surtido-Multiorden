/**
 * Figma: Avance del pedido (maestro en "📲 Surtido - Un pedido x ronda" › NO TOCAR)
 * nodeId: 1324:7100
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=1324-7100
 * Última sincronización: 2026-09-29
 */
import type { ReactNode } from 'react';
import avance from '@assets/icons/avance-pedido.svg';
import completado from '@assets/icons/estado-completado.svg';
import elipse33 from '@assets/icons/elipse-33.svg';
import block from '@assets/icons/block.svg';
import parcial from '@assets/icons/estado-parcial.svg';
import pendiente from '@assets/icons/estado-pendiente.svg';
import styles from './OrderProgress.module.css';

type Props = {
  pedido: string;
  completado: number;
  negado: number;
  parcial: number;
  pendientes: number;
  /** "Avance del pedido" en Figma; el surtido multi-orden lo rotula "Avance de la ronda" (FR-012). */
  titulo?: string;
};

export function OrderProgress(p: Props) {
  return (
    <div className={styles.progress}>
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <img src={avance} alt="" width={11.161} height={13.708} />
            <span>{p.titulo ?? 'Avance del pedido'}</span>
          </div>
          <b>Pedido {p.pedido}</b>
        </div>
      </div>
      <div className={styles.body}>
        <Col label="Completado" value={p.completado} icon={<img src={completado} alt="" width={28.846} height={29.026} />} />
        <Col
          label="Negado"
          value={p.negado}
          icon={
            <span className={styles.negado}>
              <img src={elipse33} alt="" width={28.846} height={28.846} />
              <img src={block} alt="" width={20} height={20} className={styles.block} />
            </span>
          }
        />
        <Col label="Parcial" value={p.parcial} icon={<img src={parcial} alt="" width={28.846} height={28.846} />} />
        <Col label="Pendientes" value={p.pendientes} icon={<img src={pendiente} alt="" width={28.846} height={28.846} />} />
      </div>
    </div>
  );
}

function Col({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className={styles.col}>
      <span className={styles.colLabel}>{label}</span>
      <div className={styles.colValue}>
        {icon}
        <b>{value}</b>
      </div>
    </div>
  );
}
