/**
 * Avisos de la demo que ya existen hoy en el listado V2 (textos de `es.ts`) o que el multipedido V2 les añade: salir,
 * error de carga y etiqueta inválida. Los avisos al finalizar están en la demo de revisión multipedido. Mismo patrón de
 * los demás modales del sistema (ModalSheet con ícono, título, divisor y botones con texto).
 *
 * Los textos de hoy traen negritas con `**…**`, como en `es.ts`; `ConNegritas` las respeta.
 */
import type { ReactNode } from 'react';
import iconoPregunta from '@assets/icons/modal-icono-pregunta.svg';
import iconoNegado from '@assets/icons/modal-icono-negado.svg';
import iconoReloj from '@assets/icons/modal-icono-reloj.svg';
import { ModalHeader, ModalIcon, ModalSheet } from '@ds/components/organisms/ModalSheet/ModalSheet';
import { Button, type ButtonVariant } from '@ds/components/atoms/Button/Button';
import styles from './overlays.module.css';

/** Pinta en negritas lo que va entre `**`, como los textos de `es.ts`. */
export function ConNegritas({ texto }: { texto: string }) {
  const partes = texto.split('**');
  return <>{partes.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>))}</>;
}

/**
 * Botón de un aviso. Con `icono`, solo se ve ✕ o ✓ (como los `ConfirmCard` del V2 con `textActions={false}`);
 * `label` queda para lectores de pantalla.
 */
export type BotonAviso = { label: string; variante?: ButtonVariant; icono?: 'cross' | 'check'; onClick: () => void };

const ICONOS = {
  pregunta: iconoPregunta,
  error: iconoNegado,
  reloj: iconoReloj,
};

export function AvisoModal({
  titulo,
  tipo = 'pregunta',
  children,
  botones,
}: {
  titulo: string;
  /** `error` usa el ícono de bloqueo; `pregunta`, el de confirmación; `reloj`, el de "Tarea incompleta". */
  tipo?: keyof typeof ICONOS;
  children: ReactNode;
  botones: BotonAviso[];
}) {
  return (
    <ModalSheet icon={<ModalIcon src={ICONOS[tipo]} inset="-2.84% -2.27% -0.56% -1.14%" />} gap={10} doubleShadow>
      <div className={styles.col} style={{ gap: 18 }}>
        <ModalHeader title={titulo} gap={18} />
        {children}
        <div className={styles.buttons}>
          {botones.map((b) => (
            <Button
              key={b.label}
              variant={b.variante ?? 'success'}
              label={b.label}
              icon={b.icono}
              className={botones.length > 1 ? styles.flex1 : styles.full}
              onClick={b.onClick}
            />
          ))}
        </div>
      </div>
    </ModalSheet>
  );
}

/** Párrafo centrado de los avisos. */
export function TextoAviso({ children }: { children: ReactNode }) {
  return <p className={styles.text}>{children}</p>;
}

/**
 * Menú ⋮ del listado, como en el V2: "Repetir audio" (vuelve a leer el resumen, SDD
 * 2026-11-05-multipedido-surtido-listado-cierre · Guía por voz en el listado) y "Finalizar surtido" (en esta demo
 * avisa que la finalización está en la demo de revisión multipedido).
 */
export function MenuListado({
  onFinalizar,
  onRepetirAudio,
  onCerrar,
}: {
  onFinalizar: () => void;
  onRepetirAudio: () => void;
  onCerrar: () => void;
}) {
  return (
    <div className={styles.menuFondo} onClick={onCerrar} role="presentation">
      <div className={styles.menu} role="menu" aria-label="Opciones del surtido" onClick={(e) => e.stopPropagation()}>
        <button type="button" role="menuitem" className={styles.menuOpcion} onClick={onRepetirAudio}>
          Repetir audio
        </button>
        <button type="button" role="menuitem" className={styles.menuOpcion} onClick={onFinalizar}>
          Finalizar surtido
        </button>
      </div>
    </div>
  );
}
