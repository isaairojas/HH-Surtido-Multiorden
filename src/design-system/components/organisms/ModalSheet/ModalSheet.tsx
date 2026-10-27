/**
 * Figma: hoja inferior de los modales ("Modal Revisión aleatoria", "Modal Menu", "Modal pendientes parciales", …)
 *        + fondo "BG BLUR MODALES"
 * nodeId: 3060:12583 · BG 3062:12639
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=3060-12583
 * Última sincronización: 2026-09-29
 */
import type { CSSProperties, ReactNode } from 'react';
import { Divider } from '../../atoms/Divider/Divider';
import styles from './ModalSheet.module.css';

type Props = {
  /** Ícono circular de 88 px que sobresale 43 px por arriba (SVG de Figma con anillo blanco y sombra). */
  icon: ReactNode;
  children: ReactNode;
  /** gap del contenedor externo de la hoja (10 o 30 px según el modal). */
  gap?: number;
  /** Los modales "pendientes parciales", "promoción" y "retirar promoción" llevan una segunda sombra 0 4 2. */
  doubleShadow?: boolean;
  /** Sin fondo difuminado (p. ej. cuando el modal se muestra sobre otro overlay). */
  noBackdrop?: boolean;
};

export function ModalSheet({ icon, children, gap = 10, doubleShadow, noBackdrop }: Props) {
  return (
    <>
      {!noBackdrop && <div className={styles.backdrop} />}
      <div className={`${styles.wrapper} ${doubleShadow ? styles.wrapperShadow : ''}`}>
        <div className={`${styles.sheet} ${doubleShadow ? styles.innerShadow : styles.singleShadow}`} style={{ gap }}>
          {children}
          {icon}
        </div>
      </div>
    </>
  );
}

type IconProps = {
  src: string;
  /** Márgenes negativos del SVG respecto a la caja de 88 px (varían por ícono en Figma). */
  inset: string;
  /** −1 px en los modales de revisión (left: calc(50% − 1px)). */
  offsetX?: number;
};

export function ModalIcon({ src, inset, offsetX = 0 }: IconProps) {
  const style: CSSProperties = { marginLeft: offsetX };
  return (
    <div className={styles.icon} style={style} aria-hidden>
      <div className={styles.iconBox} style={{ inset }}>
        <img src={src} alt="" />
      </div>
    </div>
  );
}

type HeaderProps = {
  title: ReactNode;
  gap?: number;
  children?: ReactNode;
  dividerWidth?: number;
};

/** Título 18 px Bold centrado + Trazado 2102. */
export function ModalHeader({ title, gap = 16, children, dividerWidth }: HeaderProps) {
  return (
    <div className={styles.header} style={{ gap }}>
      <p className={styles.title}>{title}</p>
      <Divider variant="modal" width={dividerWidth} />
      {children}
    </div>
  );
}
