/**
 * Paneles de la demo para QA, a la derecha del handheld. Ocultos bajo 900 px (CSS).
 *
 * - Lista de escenarios: catálogo de todos los escenarios de los specs de surtido (`catalogo.ts`), agrupados
 *   por cambio y requisito, con búsqueda.
 * - Explicación del escenario: al elegir uno (`?caso=`), se abre una ventana lateral propia, a la derecha de
 *   la lista, con qué valida, los pedidos con que arranca, los pasos, el resultado esperado y las lecturas
 *   para copiar al lector. Se cierra con ✕ y vuelve a abrirse al elegir otro escenario.
 *
 * Revisión del 2026-11-09: sin la pestaña "Servidor y voz". La demo solo muestra los escenarios; lo que se
 * manda al servidor y la guía por voz quedan en la spec.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/AppStore';
import { letraDe } from '../domain/ronda';
import { CAMBIOS, CASOS, carpetaDe, casoPorId, urlCaso, type Caso, type CambioId } from './catalogo';
import styles from './EscenariosPanel.module.css';

const SCROLL_KEY = 'escenarios-panel-scroll';
const ABIERTOS_KEY = 'escenarios-panel-abiertos';
/** Clase en #root mientras la explicación está abierta: reserva su espacio (styles/global.css). */
const CLASE_ROOT = 'con-explicacion';

function leer<T>(clave: string, defecto: T): T {
  try {
    const v = sessionStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : defecto;
  } catch {
    return defecto;
  }
}

function guardar(clave: string, valor: unknown) {
  try {
    sessionStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sessionStorage no disponible */
  }
}

/** Copia al portapapeles con respaldo para iframes sin permiso (igual que la hoja de códigos). */
async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    /* sin permiso */
  }
  const ta = document.createElement('textarea');
  ta.value = texto;
  ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.appendChild(ta);
  try {
    ta.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    ta.remove();
  }
}

/**
 * Abre un caso recargando la demo: la semilla solo se lee al arrancar. Si la query es la misma (reiniciar el
 * escenario, o volver a él desde otra pantalla), cambiar solo el hash no recargaría la app.
 */
function abrirCaso(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  const destino = new URL(e.currentTarget.href);
  if (destino.search === window.location.search) {
    window.history.replaceState(null, '', destino.href);
    window.location.reload();
  } else {
    window.location.href = destino.href;
  }
}

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function EscenariosPanel() {
  const params = new URLSearchParams(window.location.search);
  const activo = casoPorId(params.get('caso'));
  const panelRef = useRef<HTMLElement>(null);
  const [busqueda, setBusqueda] = useState('');
  const [abiertos, setAbiertos] = useState<CambioId[]>(() => leer<CambioId[]>(ABIERTOS_KEY, activo ? [activo.cambio] : ['listado']));
  // Cada vez que se elige un escenario la demo recarga, así que la explicación arranca abierta.
  const [explicando, setExplicando] = useState(Boolean(activo));

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const saved = leer<number>(SCROLL_KEY, 0);
    if (saved) el.scrollTop = saved;
  }, []);

  // Reserva el espacio de la ventana lateral para que no tape el handheld.
  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.toggle(CLASE_ROOT, explicando);
    return () => root?.classList.remove(CLASE_ROOT);
  }, [explicando]);

  const alternar = (id: CambioId) => {
    const sig = abiertos.includes(id) ? abiertos.filter((x) => x !== id) : [...abiertos, id];
    setAbiertos(sig);
    guardar(ABIERTOS_KEY, sig);
  };

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return CASOS;
    return CASOS.filter((x) => normalizar(`${x.escenario} ${x.requisito} ${x.esperado} ${x.pasos.join(' ')}`).includes(q));
  }, [busqueda]);

  return (
    <>
      <aside
        ref={panelRef}
        className={`${styles.panel} ${explicando ? styles.panelConExplicacion : ''}`}
        aria-label="Escenarios del surtido multi-orden"
        onScroll={(e) => guardar(SCROLL_KEY, e.currentTarget.scrollTop)}
      >
        <header className={styles.header}>
          <span className={styles.badge}>Demo para QA</span>
          <h2 className={styles.title}>Surtido multi-orden</h2>
          <p className={styles.subtitle}>
            {CASOS.length} escenarios de los specs de surtido. Elige uno: la HH se abre con su estado y la explicación
            del escenario aparece a un lado.
          </p>
          {activo && !explicando && (
            <button type="button" className={styles.verExplicacion} onClick={() => setExplicando(true)}>
              Ver la explicación de «{activo.escenario}»
            </button>
          )}
        </header>

        <div className={styles.grupos}>
          <input
            className={styles.buscar}
            type="search"
            placeholder="Buscar escenario, requisito o texto…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar escenario"
          />
          {CAMBIOS.map((cambio) => {
            const casos = filtrados.filter((x) => x.cambio === cambio.id);
            if (casos.length === 0) return null;
            const abierto = busqueda.trim() !== '' || abiertos.includes(cambio.id);
            return (
              <section key={cambio.id} className={styles.grupo}>
                <button type="button" className={styles.grupoTitulo} aria-expanded={abierto} onClick={() => alternar(cambio.id)}>
                  <span>
                    {abierto ? '▾' : '▸'} {cambio.titulo}
                  </span>
                  <span className={styles.grupoCuenta}>{casos.length}</span>
                </button>
                {abierto && <ListaCasos casos={casos} activo={activo?.id} />}
              </section>
            );
          })}
          {filtrados.length === 0 && <p className={styles.vacio}>Sin escenarios que coincidan con la búsqueda.</p>}
        </div>
      </aside>

      {activo && explicando && <ExplicacionEscenario caso={activo} onCerrar={() => setExplicando(false)} />}
    </>
  );
}

/** Casos de un cambio agrupados por requisito, en el orden del catálogo. */
function ListaCasos({ casos, activo }: { casos: Caso[]; activo?: string }) {
  const porRequisito = new Map<string, Caso[]>();
  for (const x of casos) porRequisito.set(x.requisito, [...(porRequisito.get(x.requisito) ?? []), x]);
  return (
    <div className={styles.requisitos}>
      {[...porRequisito].map(([requisito, lista]) => (
        <div key={requisito} className={styles.requisito}>
          <p className={styles.requisitoTitulo}>{requisito}</p>
          <ol className={styles.list}>
            {lista.map((x) => (
              <li key={x.id}>
                <a href={urlCaso(x)} onClick={abrirCaso} className={`${styles.item} ${activo === x.id ? styles.itemActivo : ''}`}>
                  <span className={styles.itemBody}>
                    <span className={styles.itemTitulo}>
                      {x.escenario}
                      {x.extra && <span className={styles.marcaExtra}>regla</span>}
                      {x.armado && <span className={styles.marcaServidor}>simulador</span>}
                    </span>
                    <span className={styles.itemDescripcion}>{x.esperado}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

/**
 * Ventana lateral con todo el escenario elegido. Se abre a la derecha de la lista de escenarios; en
 * pantallas más angostas (< 1280 px) la cubre, para no encimarse con el handheld.
 */
function ExplicacionEscenario({ caso, onCerrar }: { caso: Caso; onCerrar: () => void }) {
  const { tareaOriginal } = useStore();
  const [copiado, setCopiado] = useState<string | null>(null);
  const cambio = CAMBIOS.find((x) => x.id === caso.cambio);
  const idx = CASOS.findIndex((x) => x.id === caso.id);
  const anterior = idx > 0 ? CASOS[idx - 1] : null;
  const siguiente = idx >= 0 && idx < CASOS.length - 1 ? CASOS[idx + 1] : null;
  const pedidos = tareaOriginal.ronda.pedidos;

  const copiar = async (valor: string) => {
    if (!(await copiarTexto(valor))) return;
    setCopiado(valor);
    window.setTimeout(() => setCopiado((c) => (c === valor ? null : c)), 1400);
  };

  return (
    <aside className={styles.explicacion} aria-label="Escenario activo">
      <header className={styles.explicacionHead}>
        <span className={styles.explicacionNumero}>
          Escenario {idx + 1} de {CASOS.length}
        </span>
        <button type="button" className={styles.cerrar} onClick={onCerrar} aria-label="Cerrar la explicación">
          ✕
        </button>
      </header>

      <div className={styles.explicacionCuerpo}>
        <p className={styles.activoRuta}>
          {cambio?.titulo} · <code>{carpetaDe(caso.cambio)}</code>
        </p>
        <h3 className={styles.explicacionTitulo}>
          {caso.escenario}
          {caso.extra && <span className={styles.marcaExtra}>regla</span>}
        </h3>
        <p className={styles.requisitoEnExplicacion}>
          <span className={styles.activoEtiqueta}>Requisito</span>
          {caso.requisito}
        </p>
        {caso.extra && (
          <p className={styles.nota}>Regla escrita en el requisito que no tiene escenario propio en la spec.</p>
        )}

        <section className={styles.bloque}>
          <p className={styles.activoEtiqueta}>Pedidos de la ronda al abrir el escenario</p>
          <ul className={styles.pedidos}>
            {pedidos.map((p, i) => (
              <li key={p.id}>
                {pedidos.length > 1 && <span className={styles.letra}>{letraDe(tareaOriginal.ronda, i)}</span>}
                <b>{p.id}</b>
                <span className={styles.cliente}>{p.cliente.nombre}</span>
                {p.corporativoOC && <span className={styles.marcaExtra}>corporativo</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.bloque}>
          <p className={styles.activoEtiqueta}>Cómo probarlo</p>
          <ol className={styles.pasos}>
            {caso.pasos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </section>

        <section className={`${styles.bloque} ${styles.bloqueEsperado}`}>
          <p className={styles.activoEtiqueta}>Resultado esperado</p>
          <p className={styles.esperado}>{caso.esperado}</p>
        </section>

        {caso.codigos && caso.codigos.length > 0 && (
          <section className={styles.bloque}>
            <p className={styles.activoEtiqueta}>Lecturas para copiar al lector</p>
            <div className={styles.codigos}>
              {caso.codigos.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  className={`${styles.copiar} ${copiado === c.valor ? styles.copiado : ''}`}
                  onClick={() => copiar(c.valor)}
                  title={`Copiar ${c.valor}`}
                >
                  {copiado === c.valor ? '¡Copiado!' : c.etiqueta}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <footer className={styles.explicacionPie}>
        <a className={styles.reiniciar} href={urlCaso(caso)} onClick={abrirCaso}>
          ↺ Reiniciar este escenario
        </a>
        <div className={styles.navegar}>
          {anterior && (
            <a href={urlCaso(anterior)} onClick={abrirCaso} className={styles.navegarLiga} title={anterior.escenario}>
              ← Anterior
            </a>
          )}
          {siguiente && (
            <a href={urlCaso(siguiente)} onClick={abrirCaso} className={styles.navegarLiga} title={siguiente.escenario}>
              Siguiente →
            </a>
          )}
        </div>
      </footer>
    </aside>
  );
}
