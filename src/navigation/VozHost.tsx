/**
 * Subtítulo de la guía por voz (ayuda de la demo, no es parte de la HH): muestra lo último que se leyó en voz alta,
 * para que QA lo compruebe aunque el navegador no tenga voz o el equipo esté en silencio. Se oculta a los 6 s.
 * SDD 2026-11-05-multipedido-surtido-listado-cierre · Guía por voz en el listado.
 */
import { useEffect, useState } from 'react';
import { useStore } from '../store/AppStore';
import styles from './VozHost.module.css';

export function VozHost() {
  const { lectura } = useStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!lectura) return;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(t);
  }, [lectura]);

  if (!lectura || !visible) return null;
  return (
    <div className={styles.voz} role="status" aria-live="polite" key={lectura.id}>
      <span className={styles.etiqueta}>Voz</span>
      <span>{lectura.texto}</span>
    </div>
  );
}
