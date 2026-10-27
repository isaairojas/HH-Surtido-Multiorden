/**
 * Figma: barras inferiores "Botones" (3048:10092), "Escaner codigo" (3048:10191), "Bttn salir" (3048:10126), "Negar producto" (3199:6476)
 * nodeId: 3048:10092
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=3048-10092
 * Última sincronización: 2026-09-29
 */
import type { ReactNode } from 'react';
import styles from './BottomBar.module.css';

type Props = {
  children: ReactNode;
  /**
   * actions = 30/32/37 px y botones con gap 16 (Botones, Escaner codigo)
   * footer  = 32 px parejo y gap 10 (Negar producto)
   * exit    = 32 px parejo, sombra 0.05 (Bttn salir)
   */
  variant?: 'actions' | 'footer' | 'exit';
};

export function BottomBar({ children, variant = 'actions' }: Props) {
  return <footer className={`${styles.bar} ${styles[variant]}`}>{children}</footer>;
}
