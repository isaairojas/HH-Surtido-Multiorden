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
  /** Sin pedido (ronda multi-orden), el encabezado solo lleva el título, centrado (mockup 15:1437). */
  pedido?: string;
  completado: number;
  negado: number;
  parcial: number;
  pendientes: number;
  /** "Avance del pedido" en Figma; el surtido multi-orden lo rotula "Avance de la ronda" (FR-012). */
  titulo?: string;
  /** false: solo íconos y números, sin "Completado", "Negado"… (mockup 15:1437 de la ronda). */
  etiquetas?: boolean;
};

export function OrderProgress(p: Props) {
  return (
    <div className={styles.progress}>
      <div className={styles.header}>
        <div className={`${styles.headerInner} ${p.pedido ? '' : styles.headerCentrado}`}>
          <div className={styles.headerLeft}>
            <img src={avance} alt="" width={11.161} height={13.708} />
            <span>{p.titulo ?? 'Avance del pedido'}</span>
          </div>
          {p.pedido && <b>Pedido {p.pedido}</b>}
        </div>
      </div>
      <div className={styles.body}>
        <Col etiqueta={p.etiquetas} label="Completado" value={p.completado} icon={<img src={completado} alt="" width={28.846} height={29.026} />} />
        <Col
          etiqueta={p.etiquetas}
          label="Negado"
          value={p.negado}
          icon={
            <span className={styles.negado}>
              <img src={elipse33} alt="" width={28.846} height={28.846} />
              <img src={block} alt="" width={20} height={20} className={styles.block} />
            </span>
          }
        />
        <Col etiqueta={p.etiquetas} label="Parcial" value={p.parcial} icon={<img src={parcial} alt="" width={28.846} height={28.846} />} />
        <Col etiqueta={p.etiquetas} label="Pendientes" value={p.pendientes} icon={<img src={pendiente} alt="" width={28.846} height={28.846} />} />
      </div>
    </div>
  );
}

function Col({ label, value, icon, etiqueta = true }: { label: string; value: number; icon: ReactNode; etiqueta?: boolean }) {
  return (
    <div className={`${styles.col} ${etiqueta ? '' : styles.colCompacta}`} aria-label={etiqueta ? undefined : `${label}: ${value}`}>
      {etiqueta && <span className={styles.colLabel}>{label}</span>}
      <div className={styles.colValue}>
        {icon}
        <b>{value}</b>
      </div>
    </div>
  );
}
