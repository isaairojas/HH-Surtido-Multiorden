/**
 * Figma: Módulo de surtido de Configuraciones (5917:1681 / 5170:12985)
 * nodeId: 5917:1681
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=5917-1681
 * Última sincronización: 2026-09-29
 *
 * Se distingue del ContentPanel de Revisión porque:
 * - Está anclado a top: 67 px (bajo el Header de 100 px)
 * - Título puede llevar breadcrumb "Configuraciones > Sonido"
 * - Gap 6 px por defecto para tarjetas apiladas
 */
import type { ReactNode } from 'react';
import arrowForward from '@assets/icons/arrow-forward-ios.svg';
import { Divider } from '../../atoms/Divider/Divider';
import styles from './ConfigPanel.module.css';

type Props = {
  title: string;
  /** Subtítulo del breadcrumb (Sonido, Impresión). */
  subtitle?: string;
  children: ReactNode;
  /** Gap entre hijos: 6 px (Configuraciones), 22 px (Sonido, Impresión). */
  gap?: number;
  /** Alineación del contenido: center (Configuraciones), start (Sonido) o overflow (Impresión con scroll). */
  align?: 'center' | 'start';
  /** Padding interior en las pantallas de Impresoras (20 px vs 32 px). */
  paddingX?: number;
};

export function ConfigPanel({ title, subtitle, children, gap = 22, align = 'start', paddingX = 32 }: Props) {
  return (
    <section className={styles.panel} style={{ gap, alignItems: align === 'center' ? 'center' : 'flex-start', paddingLeft: paddingX, paddingRight: paddingX }}>
      <div className={styles.titleBlock}>
        <div className={styles.titleInner}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            {subtitle && (
              <>
                <img src={arrowForward} alt="" width={20} height={20} />
                <h1 className={styles.title}>{subtitle}</h1>
              </>
            )}
          </div>
          <Divider variant="title" />
        </div>
      </div>
      {children}
    </section>
  );
}
