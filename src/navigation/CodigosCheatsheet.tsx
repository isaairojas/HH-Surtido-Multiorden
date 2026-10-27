/**
 * Panel lateral izquierdo con los códigos de la ronda — ayuda de demo para copiar y pegar
 * en el input del lector durante la simulación. Vive fuera del `.app-frame` (mismo tratamiento
 * que EscenariosPanel a la derecha) y no altera la lógica de negocio.
 *
 * Adaptado del `ProductosCheatsheet` de `Solicitud anticipada Uber`. La diferencia del
 * multi-orden: un código puede vivir en varios pedidos, así que cada ficha muestra el
 * desglose y marca a qué pedido entraría el próximo escaneo (regla FR-010). Los datos salen
 * del store, no de los mocks, para que la tabla siga el avance real de la ronda.
 */
import { useState } from 'react';
import { etiqueta } from '../domain/codigos';
import { partidaEn, productosVista, proximaPartidaPara, statusDeEstado } from '../domain/ronda';
import { useStore } from '../store/AppStore';
import styles from './CodigosCheatsheet.module.css';

/** Código de 7 dígitos que no vive en la ronda, para probar el rechazo de FR-011. */
const CODIGO_AJENO = '9999999';

/**
 * Copia al portapapeles. `navigator.clipboard` solo existe en contextos seguros y lo
 * bloquean los iframes sin permiso (p. ej. el panel de vista previa del editor), así que
 * cae a `execCommand('copy')` sobre un textarea temporal.
 */
async function alPortapapeles(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    /* sin permiso: se intenta la vía antigua */
  }
  const ta = document.createElement('textarea');
  ta.value = texto;
  ta.setAttribute('readonly', '');
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

export function CodigosCheatsheet() {
  const { ronda } = useStore();
  const [copiado, setCopiado] = useState<string | null>(null);

  const productos = productosVista(ronda.ronda);

  const copiar = async (texto: string, marca: string) => {
    if (!(await alPortapapeles(texto))) return;
    setCopiado(marca);
    window.setTimeout(() => setCopiado((c) => (c === marca ? null : c)), 1400);
  };

  return (
    <aside className={styles.panel} aria-label="Códigos de la ronda">
      <header className={styles.header}>
        <span className={styles.badge}>Simulación</span>
        <h2 className={styles.title}>Códigos de la ronda</h2>
        <p className={styles.subtitle}>
          Click en cualquier botón para copiarlo y pegarlo en el input del lector.
          La etiqueta APYMSA es <b>7 código + 6 cantidad + 5 peso</b> = 18 dígitos.
        </p>
        <ul className={styles.leyenda}>
          <li>
            <b>Código</b> (7 díg.) → abre el modal de captura de cantidad.
          </li>
          <li>
            <b>×1</b> / <b>×N</b> (18 díg.) → surte directo esa cantidad.
          </li>
          <li>
            <b>×N</b> es justo lo que le falta al pedido destino: lo cierra de un escaneo.
          </li>
        </ul>
      </header>

      <div className={styles.lista}>
        {productos.map((v) => {
          const destino = proximaPartidaPara(ronda.ronda, v.codigo);
          const partida = destino ? partidaEn(ronda.ronda, destino) : null;
          const pedidoDestino = destino ? ronda.ronda.pedidos[destino.pedidoIdx] : null;
          const faltan = partida ? partida.solicitado - partida.surtido : 0;
          const etiquetaN = etiqueta(v.codigo, Math.max(1, faltan));

          return (
            <article key={v.codigo} className={styles.ficha}>
              <div className={styles.fichaTop}>
                <span className={styles.codigoTitulo}>{v.codigo}</span>
                <div className={styles.marcas}>
                  {v.miscelaneo && <span className={styles.tipoMisc}>Misc.</span>}
                  {v.presencias.length > 1 && <span className={styles.tipoMulti}>En {v.presencias.length}</span>}
                  <span className={styles.total}>
                    {v.surtidoTotal} de {v.solicitadoTotal}
                  </span>
                </div>
              </div>
              <p className={styles.descripcion}>{v.descripcion}</p>

              <div className={styles.botones}>
                <button
                  type="button"
                  className={`${styles.copiar} ${copiado === `c-${v.codigo}` ? styles.copiado : ''}`}
                  onClick={() => copiar(v.codigo, `c-${v.codigo}`)}
                  title={`Copiar el código corto ${v.codigo} (abre la captura de cantidad)`}
                >
                  {copiado === `c-${v.codigo}` ? '¡Copiado!' : v.codigo}
                </button>
                <button
                  type="button"
                  className={`${styles.copiar} ${styles.copiarEtiqueta} ${copiado === `e1-${v.codigo}` ? styles.copiado : ''}`}
                  onClick={() => copiar(etiqueta(v.codigo, 1), `e1-${v.codigo}`)}
                  title={`Etiqueta de 18 dígitos para 1 pieza de ${v.codigo}`}
                >
                  {copiado === `e1-${v.codigo}` ? '¡Copiado!' : `×1 · ${etiqueta(v.codigo, 1)}`}
                </button>
                {faltan > 1 && (
                  <button
                    type="button"
                    className={`${styles.copiar} ${styles.copiarEtiqueta} ${copiado === `en-${v.codigo}` ? styles.copiado : ''}`}
                    onClick={() => copiar(etiquetaN, `en-${v.codigo}`)}
                    title={`Etiqueta para las ${faltan} piezas que le faltan al pedido ${pedidoDestino?.id}`}
                  >
                    {copiado === `en-${v.codigo}` ? '¡Copiado!' : `×${faltan} · ${etiquetaN}`}
                  </button>
                )}
              </div>

              <ul className={styles.presencias}>
                {v.presencias.map((p) => (
                  <li key={p.pedidoId} className={styles.presencia}>
                    <span className={styles.presenciaPedido}>
                      {pedidoDestino?.id === p.pedidoId && <span className={styles.flecha}>▸</span>}
                      Pedido {p.pedidoId}
                    </span>
                    <span className={`${styles.presenciaChip} ${styles[statusDeEstado(p.estado)]}`}>
                      {p.motivoNegacion ? `Negado · ${p.motivoNegacion}` : `${p.surtido}/${p.solicitado}`}
                    </span>
                  </li>
                ))}
              </ul>

              <p className={styles.destino}>
                {pedidoDestino ? (
                  <>
                    Próximo escaneo → <b>pedido {pedidoDestino.id}</b> (le faltan {faltan})
                  </>
                ) : (
                  <>Sin partidas pendientes: el escaneo se rechaza.</>
                )}
              </p>
            </article>
          );
        })}
      </div>

      <div className={styles.pie}>
        <p className={styles.pieTitulo}>Probar los rechazos</p>
        <div className={styles.botones}>
          <button
            type="button"
            className={`${styles.copiar} ${copiado === 'ajeno' ? styles.copiado : ''}`}
            onClick={() => copiar(CODIGO_AJENO, 'ajeno')}
            title="Código que no pertenece a la ronda"
          >
            {copiado === 'ajeno' ? '¡Copiado!' : `Fuera de ronda · ${CODIGO_AJENO}`}
          </button>
          <button
            type="button"
            className={`${styles.copiar} ${styles.copiarEtiqueta} ${copiado === 'exceso' ? styles.copiado : ''}`}
            onClick={() => copiar(etiqueta(productos[0]?.codigo ?? '0486600', 999), 'exceso')}
            title="Etiqueta con una cantidad mayor a la solicitada: se rechaza entera"
          >
            {copiado === 'exceso' ? '¡Copiado!' : 'Cantidad excesiva · ×999'}
          </button>
        </div>
      </div>
    </aside>
  );
}
