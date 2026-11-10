/**
 * Avisos de la demo que ya existen hoy en el listado V2 (textos de `es.ts`) o que el multi-orden les añade:
 * finalizar, parciales, códigos sin surtir, pedido corporativo, salir, fallas del servidor. Mismo patrón de
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

/** ✕ (cerrar sin hacer nada) y ✓ (confirmar), el par de botones de los avisos de confirmación del V2. */
export const botonesConfirmar = (onCancelar: () => void, onConfirmar: () => void): BotonAviso[] => [
  { label: 'Cancelar', variante: 'error', icono: 'cross', onClick: onCancelar },
  { label: 'Aceptar', variante: 'success', icono: 'check', onClick: onConfirmar },
];

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

/** Bloque gris con filas etiqueta / valor (patrón de "Selección de motivo negado"). */
export function DatosAviso({ filas }: { filas: { etiqueta: string; valor: ReactNode }[] }) {
  return (
    <div className={styles.datos}>
      {filas.map((f) => (
        <div key={f.etiqueta} className={styles.datoFila}>
          <b>{f.etiqueta}</b>
          <span className={styles.datoValor}>{f.valor}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Menú ⋮ del listado: "Finalizar surtido" (finalizar de forma manual), como en el V2. "Repetir audio" no está:
 * la guía por voz quedó fuera de la demo (2026-11-09).
 * SDD 2026-11-05-multiorden-surtido-listado-cierre · Bloqueos y fallas al finalizar.
 */
export function MenuListado({ onFinalizar, onCerrar }: { onFinalizar: () => void; onCerrar: () => void }) {
  return (
    <div className={styles.menuFondo} onClick={onCerrar} role="presentation">
      <div className={styles.menu} role="menu" aria-label="Opciones del surtido" onClick={(e) => e.stopPropagation()}>
        <button type="button" role="menuitem" className={styles.menuOpcion} onClick={onFinalizar}>
          Finalizar surtido
        </button>
      </div>
    </div>
  );
}
