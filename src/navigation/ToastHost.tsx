/**
 * Overlay de avisos. Figma: frames "Toast revisión completada" (3085:11302) y "Surtido completado TOAST" (3236:17501)
 * con overlayPositionType TOP_CENTER, sin fondo; el toast va 30 px por debajo del borde del overlay (416 × 166).
 * Entrada: MOVE_IN 300 ms EASE_OUT. A 1 ms cambia a la variante "Toast=Fin" (la barra inferior se vacía, SMART_ANIMATE 3000 ms EASE_OUT).
 */
import { useEffect, useState } from 'react';
import { Toast } from '../design-system/components/organisms/Toast/Toast';
import { useStore } from '../store/AppStore';
import styles from './ToastHost.module.css';

export function ToastHost() {
  const { toast, cerrarToast } = useStore();
  const [fin, setFin] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setFin(false);
    const t1 = window.setTimeout(() => setFin(true), 1);
    // Figma no define el cierre automático; se cierra al terminar la barra (docs/figma/discrepancias.md D29).
    const t2 = window.setTimeout(cerrarToast, 300 + 3000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [toast, cerrarToast]);

  if (!toast) return null;
  return (
    <div className={styles.overlay} key={toast.id}>
      <div className={styles.slot}>
        <Toast kind={toast.kind} title={toast.title} message={toast.message} onClose={cerrarToast} fin={fin} />
      </div>
    </div>
  );
}
