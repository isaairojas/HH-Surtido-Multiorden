/**
 * Panel lateral derecho con los escenarios de demo. Oculto bajo 900 px (CSS).
 */
import { useEffect, useRef } from 'react';
import styles from './EscenariosPanel.module.css';

const SCROLL_KEY = 'escenarios-panel-scroll';

type Escenario = {
  id: string;
  titulo: string;
  descripcion: string;
  ruta: '/tareas' | '/surtido';
  reglas: string[];
};

const ESCENARIOS: Escenario[] = [
  {
    id: 'tareas',
    titulo: 'Toma de tarea',
    descripcion: 'Ronda recién asignada: 3 pedidos pendientes, dos del mismo cliente.',
    ruta: '/tareas',
    reglas: [
      'Pedidos 100001 y 100002 son del mismo cliente (badge "Mismo cliente").',
      'El orden de la lista es el que fijó el algoritmo de picking.',
    ],
  },
  {
    id: 'inicial',
    titulo: 'Surtido — ronda vacía',
    descripcion: 'Nadie ha escaneado nada; todos los productos pendientes.',
    ruta: '/surtido',
    reglas: [
      'Códigos compartidos entre pedidos muestran el badge "En N pedidos".',
      'Al escanear se surte el pedido pendiente con menor orden que todavía lo necesite.',
      'Etiqueta de 18 dígitos surte directo; código de 7 abre la captura de cantidad.',
    ],
  },
  {
    id: 'con-avance',
    titulo: 'Surtido — con avance',
    descripcion: '0486600 completo y 1365800 parcial en el primer pedido.',
    ruta: '/surtido',
    reglas: ['Las filas cambian de color según su estado (completado / parcial / pendiente).'],
  },
  {
    id: 'cierra-pedido',
    titulo: 'A una pieza de cerrar el pedido',
    descripcion: 'Al 100001 solo le falta 1 pieza de 2389475.',
    ruta: '/surtido',
    reglas: [
      'Escanea 2389475 (1 pieza) y aparece el aviso "Pedido completado".',
      'El aviso dice con qué pedido sigue la ronda.',
    ],
  },
  {
    id: 'primer-pedido-ok',
    titulo: 'Primer pedido terminado',
    descripcion: 'El pedido 100001 está al 100 %; el siguiente escaneo entra al 100002.',
    ruta: '/surtido',
    reglas: ['El badge "Surtiendo" del detalle se mueve al 100002.'],
  },
  {
    id: 'negado',
    titulo: 'Partida negada',
    descripcion: '0512300 negado por "Sin existencia" en el pedido 100002.',
    ruta: '/surtido',
    reglas: [
      'La fila muestra el motivo; el conteo "Negado" de la tarjeta sube.',
      'Un producto negado ya no recibe escaneos ni bloquea el cierre de la ronda.',
    ],
  },
  {
    id: 'cierra-ronda',
    titulo: 'A una pieza de cerrar la ronda',
    descripcion: 'Solo falta 1 pieza de 3310500 en el último pedido.',
    ruta: '/surtido',
    reglas: ['Al completarla, la app salta a la pantalla final "Ronda terminada".'],
  },
];

function urlFor(e: Escenario) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${e.ruta}?escenario=${e.id}`;
}

export function EscenariosPanel() {
  const actual = new URLSearchParams(window.location.search).get('escenario') ?? '';
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    try {
      const saved = sessionStorage.getItem(SCROLL_KEY);
      if (saved) el.scrollTop = parseInt(saved, 10);
    } catch {
      /* sessionStorage no disponible */
    }
  }, []);

  const guardarScroll = () => {
    const el = panelRef.current;
    if (!el) return;
    try {
      sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop));
    } catch {
      /* sessionStorage no disponible */
    }
  };

  return (
    <aside ref={panelRef} className={styles.panel} aria-label="Escenarios del surtido multi-orden">
      <header className={styles.header}>
        <span className={styles.badge}>Flujo</span>
        <h2 className={styles.title}>Surtido multi-orden</h2>
        <p className={styles.subtitle}>
          Una ronda con 3 pedidos. Elige un escenario para saltar a esa pantalla con el estado sembrado.
        </p>
      </header>
      <div className={styles.grupos}>
        <section className={styles.grupo}>
          <ol className={styles.list}>
            {ESCENARIOS.map((e, i) => (
              <li key={e.id}>
                <a
                  href={urlFor(e)}
                  onClick={guardarScroll}
                  className={`${styles.item} ${actual === e.id ? styles.itemActivo : ''}`}
                >
                  <span className={styles.itemStep}>{i + 1}</span>
                  <span className={styles.itemBody}>
                    <span className={styles.itemTitulo}>{e.titulo}</span>
                    <span className={styles.itemDescripcion}>{e.descripcion}</span>
                    {e.reglas.length > 0 && (
                      <ul className={styles.reglas}>
                        {e.reglas.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </aside>
  );
}
