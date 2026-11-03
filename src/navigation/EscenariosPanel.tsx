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
  ruta: '/tareas' | '/ronda' | '/surtido';
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
    id: 'detalle-ronda',
    titulo: 'Detalle de la ronda',
    descripcion: 'Pantalla previa al surtido: qué pedido va en cada contenedor.',
    ruta: '/ronda',
    reglas: [
      'Un panel por contenedor (A, B, C) con folio, cliente, piezas y códigos.',
      'Los pedidos del mismo cliente llevan "Mismo cliente".',
    ],
  },
  {
    id: 'inicial',
    titulo: 'Surtido — ronda vacía',
    descripcion: 'Nadie ha escaneado nada; todos los productos pendientes.',
    ruta: '/surtido',
    reglas: [
      'Los productos van agrupados por familia, en orden alfabético (Bomba gasolina, Cinta, Foco…).',
      'Cada card desglosa el avance por contenedor (A 0/2 · B 0/2).',
      'Las tarjetas superiores muestran el avance de cada pedido; ninguna va marcada hasta el primer escaneo.',
      'Al escanear se surte el pedido pendiente con menor orden que todavía lo necesite.',
      'Todos son misceláneos (la cantidad se captura a mano) salvo la bomba 0607006, que se escanea.',
      'En la bomba, la etiqueta de 18 dígitos surte directo; el código de 7 abre la captura de cantidad.',
    ],
  },
  {
    id: 'con-avance',
    titulo: 'Surtido — con avance',
    descripcion: '1394010 completo y 0607006 parcial en el primer pedido.',
    ruta: '/surtido',
    reglas: [
      'Las filas cambian de color según su estado (completado / parcial / pendiente).',
      'El último producto escaneado (0607006) y su pedido (A) quedan marcados en azul.',
    ],
  },
  {
    id: 'cierra-pedido',
    titulo: 'A una pieza de cerrar el pedido',
    descripcion: 'Al 100001 solo le falta 1 pieza de 6200401.',
    ruta: '/surtido',
    reglas: [
      'Escanea 6200401 (1 pieza) y aparece el aviso "Pedido completado".',
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
    descripcion: '6200404 negado por "Sin existencia" en el pedido 100002.',
    ruta: '/surtido',
    reglas: [
      'La fila muestra el motivo; el conteo "Negado" de la tarjeta sube.',
      'Un producto negado ya no recibe escaneos ni bloquea el cierre de la ronda.',
    ],
  },
  {
    id: 'cierra-ronda',
    titulo: 'A una pieza de cerrar la ronda',
    descripcion: 'Solo falta 1 pieza de 2010000 en el último pedido.',
    ruta: '/surtido',
    reglas: ['Al completarla, la app salta a la pantalla final "Ronda terminada".'],
  },
  {
    id: 'cambio-pedido',
    titulo: 'Cambio de pedido de un código',
    descripcion: 'Al 100001 le falta 1 cinta 1394010, que también piden el 100002 y el 100003.',
    ruta: '/surtido',
    reglas: [
      'Escanea 1394010 (1 pieza): aparece "Cambio de pedido" con el contenedor destino en rojo.',
      'En el detalle, el pedido que se surte va en rojo y los otros dos en gris.',
    ],
  },
  {
    id: 'promocion',
    titulo: 'Promoción incompleta',
    descripcion: '"Kit mantenimiento" (1394010 + 6200401): el limpiador se negó en el 100002.',
    ruta: '/surtido',
    reglas: [
      'Escanea 2010000 (1 pieza) y, en vez de cerrar la ronda, sale "Finalizar surtido".',
      '✕ no retira nada; "Finalizar surtido" lo vuelve a abrir.',
      '"Eliminar productos" + escanear un código de la promoción la niega solo en el 100002.',
    ],
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
