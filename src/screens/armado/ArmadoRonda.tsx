/**
 * Simulador del armado de la ronda multipedido V2 (SDD 2026-10-26-multipedido-armado-ronda) para validar en pantalla cada
 * escenario de `elegibilidad-ronda-multipedido` y `catalogo-bandera-sucursal`.
 *
 * Es una página de back-office, no una pantalla de la HH: el armado lo resuelve el servidor y la HH recibe
 * la ronda ya armada. Por eso ocupa todo el ancho y se pinta por encima del marco de 430 px.
 *
 * Izquierda: los escenarios agrupados por requisito, con una marca de si el simulador coincide con el spec.
 * Derecha: la configuración de la sucursal, la cola en el orden en que se atiende, la evaluación de cada
 * candidato con la regla que decidió, la ronda final y el resultado esperado del spec para comparar.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  armarRonda,
  NOMBRES_BANDERAS,
  type ConfigSucursal,
  type EvaluacionCandidato,
  type ModoArmado,
  type PedidoCola,
  type ReglaEvaluada,
  type ResultadoArmado,
} from '../../domain/armado';
import { PRESETS_ARMADO, presetArmado, verificarPreset, type PresetArmado } from '../../domain/armadoEscenarios';
import styles from './ArmadoRonda.module.css';

const CAPACIDADES: { id: PresetArmado['capacidad']; titulo: string }[] = [
  { id: 'elegibilidad-ronda-multipedido', titulo: 'Elegibilidad de la ronda' },
  { id: 'catalogo-bandera-sucursal', titulo: 'Catálogo de banderas y parámetros' },
];

const MODOS: Record<ModoArmado, string> = {
  actual: 'Algoritmo actual',
  unificado: 'Surtido unificado',
  multipedido: 'Multipedido V2',
};

const letra = (i: number) => String.fromCharCode(65 + i);
const servicio = (p: PedidoCola) => (p.servicio === 'local' ? 'Local' : 'Foráneo');
const tipo = (p: PedidoCola) => (p.tipo === 'cliente' ? 'Cliente' : p.tipo === 'traspaso' ? 'Traspaso' : 'Balanceo');

/** Papel de cada pedido de la cola en el resultado. */
function papel(p: PedidoCola, r: ResultadoArmado): { texto: string; clase: string } {
  if (r.ancla === p) return { texto: 'Ancla', clase: styles.papelAncla };
  const e = r.evaluados.find((x) => x.pedido === p);
  if (e?.estado === 'integrado') return { texto: 'Integrado', clase: styles.papelIntegrado };
  if (e?.estado === 'rechazado') return { texto: 'No integrado', clase: styles.papelRechazado };
  if (e?.estado === 'sin-evaluar') return { texto: 'Sin evaluar', clase: styles.papelNeutro };
  if (r.fueraDeVentana.includes(p)) return { texto: 'Fuera de la ventana', clase: styles.papelNeutro };
  return { texto: 'No se evalúa', clase: styles.papelNeutro };
}

export function ArmadoRonda({ presetId }: { presetId?: string }) {
  const navigate = useNavigate();
  const preset = presetArmado(presetId) ?? PRESETS_ARMADO[0];
  const resultado = useMemo(() => (preset.enListado ? null : armarRonda(preset.cola, preset.config)), [preset]);
  const fallas = useMemo(() => (resultado ? verificarPreset(preset, resultado) : []), [preset, resultado]);
  // Marca de cada escenario en la lista lateral: ✓ coincide, ✕ no coincide, ↗ se valida en el listado.
  const marcas = useMemo(
    () => new Map(PRESETS_ARMADO.map((p) => [p.id, p.enListado ? 'listado' : verificarPreset(p).length === 0 ? 'ok' : 'falla'])),
    [],
  );
  const coinciden = [...marcas.values()].filter((m) => m === 'ok').length;
  const verificables = [...marcas.values()].filter((m) => m !== 'listado').length;

  return (
    <div className={styles.pagina}>
      <aside className={styles.lateral} aria-label="Escenarios del armado">
        <header className={styles.lateralHead}>
          <span className={styles.etiqueta}>Back-end · simulador</span>
          <h1 className={styles.titulo}>Armado de ronda multipedido V2</h1>
          <p className={styles.subtitulo}>
            SDD <code>2026-10-26-multipedido-armado-ronda</code>. {coinciden} de {verificables} escenarios coinciden con el spec.
          </p>
          <button type="button" className={styles.volver} onClick={() => navigate('/tareas')}>
            ← Volver a la HH
          </button>
        </header>

        {CAPACIDADES.map((cap) => {
          const presets = PRESETS_ARMADO.filter((p) => p.capacidad === cap.id);
          const requisitos = [...new Set(presets.map((p) => p.requisito))];
          return (
            <section key={cap.id} className={styles.capacidad}>
              <h2 className={styles.capacidadTitulo}>
                {cap.titulo} <span>({presets.length})</span>
              </h2>
              {requisitos.map((req) => (
                <div key={req} className={styles.requisito}>
                  <h3 className={styles.requisitoTitulo}>{req}</h3>
                  <ul className={styles.escenarios}>
                    {presets
                      .filter((p) => p.requisito === req)
                      .map((p) => {
                        const m = marcas.get(p.id);
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              className={`${styles.escenarioBtn} ${p.id === preset.id ? styles.escenarioActivo : ''}`}
                              aria-current={p.id === preset.id ? 'true' : undefined}
                              onClick={() => navigate(`/armado/${p.id}`)}
                            >
                              <span
                                className={`${styles.marca} ${m === 'ok' ? styles.marcaOk : m === 'falla' ? styles.marcaFalla : styles.marcaListado}`}
                                aria-label={m === 'ok' ? 'Coincide con el spec' : m === 'falla' ? 'No coincide con el spec' : 'Se valida en el listado'}
                              >
                                {m === 'ok' ? '✓' : m === 'falla' ? '✕' : '↗'}
                              </span>
                              <span>{p.escenario}</span>
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </section>
          );
        })}
      </aside>

      <main className={styles.principal}>
        <header className={styles.encabezado}>
          <span className={styles.requisitoChip}>
            {preset.capacidad} · {preset.requisito}
          </span>
          <h2 className={styles.escenarioTitulo}>Escenario: {preset.escenario}</h2>
          <p className={styles.descripcion}>{preset.descripcion}</p>
        </header>

        <section className={`${styles.tarjeta} ${styles.esperado}`}>
          <div className={styles.esperadoTexto}>
            <h3 className={styles.seccionTitulo}>Resultado esperado (spec)</h3>
            <p>{preset.esperado}</p>
          </div>
          {preset.enListado ? (
            <span className={`${styles.veredicto} ${styles.veredictoListado}`}>↗ Se valida en el listado</span>
          ) : fallas.length === 0 ? (
            <span className={`${styles.veredicto} ${styles.veredictoOk}`}>✓ El simulador coincide con el spec</span>
          ) : (
            <div className={`${styles.veredicto} ${styles.veredictoFalla}`}>
              ✕ No coincide
              <ul>
                {fallas.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {preset.enListado ? (
          <section className={styles.tarjeta}>
            <h3 className={styles.seccionTitulo}>Este escenario ocurre durante el surtido</h3>
            <p className={styles.texto}>{preset.textoListado}</p>
          </section>
        ) : (
          resultado && (
            <>
              <Resultado cfg={preset.config} r={resultado} />
              {preset.otraSucursal && (
                <>
                  <h2 className={styles.escenarioTitulo}>
                    {preset.otraSucursal.config.sucursal ? `Sucursal ${preset.otraSucursal.config.sucursal}` : 'Otra sucursal'}, misma cola
                  </h2>
                  <Resultado
                    cfg={preset.otraSucursal.config}
                    r={armarRonda(preset.cola, preset.otraSucursal.config)}
                  />
                </>
              )}
            </>
          )
        )}
      </main>
    </div>
  );
}

function Resultado({ cfg, r }: { cfg: ConfigSucursal; r: ResultadoArmado }) {
  return (
    <>
      <section className={styles.tarjeta}>
        <h3 className={styles.seccionTitulo}>Configuración de la sucursal{cfg.sucursal ? ` ${cfg.sucursal}` : ''}</h3>
        <p className={styles.ayuda}>
          Configuración de ejemplo para reproducir el escenario. En la sucursal, las banderas, los parámetros y la franja
          viven donde ya se configuran; la demo no fija sus valores.
        </p>
        <div className={styles.chips}>
          {NOMBRES_BANDERAS.map((b) => (
            <span key={b} className={`${styles.chip} ${cfg[b] ? styles.chipActiva : styles.chipInactiva}`}>
              <b>{cfg[b] ? 'Activa' : 'Inactiva'}</b> {b}
            </span>
          ))}
        </div>
        <div className={styles.parametros}>
          <Parametro nombre="Máximo de pedidos por ronda" valor={r.maxPedidos} inicial={cfg.maxPedidos === undefined} />
          <Parametro
            nombre="Tope de partidas por ronda"
            valor={r.maxPartidas}
            inicial={cfg.maxPartidas === undefined}
            nota={cfg.Bandera_MultipedidoTopePartidas ? undefined : 'no aplica: bandera inactiva'}
          />
          <Parametro
            nombre="Tiempo máximo de la franja"
            valor={`${cfg.minutosFranja} min`}
            nota="si un candidato cumple todo y se pasa, la franja de la ronda se amplía"
          />
          {cfg.momentoVentana && (
            <Parametro
              nombre="Entrada a la ventana de tareas"
              valor={cfg.momentoVentana.slice(11)}
              nota="la ronda se arma en ese momento"
            />
          )}
        </div>
      </section>

      <section className={styles.tarjeta}>
        <h3 className={styles.seccionTitulo}>Cola de pedidos por surtir, en el orden en que se atiende</h3>
        <p className={styles.ayuda}>
          Orden: vencimiento, luego creación más antigua, luego menos partidas, luego folio menor. La zona se muestra,
          pero no cuenta.
        </p>
        <div className={styles.tablaScroll}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th>#</th>
                <th>Folio</th>
                <th>Papel</th>
                <th>Vence</th>
                <th>Creado</th>
                <th>Partidas</th>
                <th>Códigos</th>
                <th>Servicio</th>
                <th>Tipo</th>
                <th>Dirección</th>
                <th>Zona</th>
                <th>Retenido</th>
                <th>División</th>
                <th>Min</th>
              </tr>
            </thead>
            <tbody>
              {r.cola.map((p, i) => {
                const pp = papel(p, r);
                return (
                  <tr key={p.folio} className={r.ancla === p ? styles.filaAncla : undefined}>
                    <td>{i + 1}</td>
                    <td className={styles.folio}>{p.folio}</td>
                    <td>
                      <span className={`${styles.papel} ${pp.clase}`}>{pp.texto}</span>
                    </td>
                    <td>{p.vence}</td>
                    <td>{p.creado.slice(11)}</td>
                    <td className={styles.num}>{p.codigos.length}</td>
                    <td className={styles.codigos} title={p.codigos.join(', ')}>
                      {p.codigos.slice(0, 4).join(', ')}
                      {p.codigos.length > 4 && ` +${p.codigos.length - 4}`}
                    </td>
                    <td>{servicio(p)}</td>
                    <td>{tipo(p)}</td>
                    <td className={styles.direccion}>{p.direccion}</td>
                    <td>{p.zona ?? '—'}</td>
                    <td>{p.retenido ? 'Sí' : 'No'}</td>
                    <td>{p.division ? `${p.division.id} · parte ${p.division.parte}` : '—'}</td>
                    <td className={styles.num}>{p.minutos}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {r.fueraDeCola.length > 0 && (
          <ul className={styles.notas}>
            {r.fueraDeCola.map((x) => (
              <li key={x.pedido.folio}>
                <b>{x.pedido.folio}</b> no llega a la cola: {x.motivo}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.tarjeta}>
        <h3 className={styles.seccionTitulo}>
          Evaluación <span className={styles.modo}>{MODOS[r.modo]}</span>
        </h3>
        <p className={styles.texto}>{r.explicacionModo}</p>
        {r.ancla && (
          <p className={styles.texto}>
            Ancla: <b>{r.ancla.folio}</b>, el primero de la cola.
          </p>
        )}
        {r.evaluados.length > 0 && (
          <div className={styles.candidatos}>
            {r.evaluados.map((e) => (
              <Candidato key={e.pedido.folio} e={e} />
            ))}
          </div>
        )}
        {r.fueraDeVentana.length > 0 && (
          <p className={styles.texto}>
            Fuera de la ventana (no se evalúan para esta ronda): <b>{r.fueraDeVentana.map((p) => p.folio).join(', ')}</b>.
          </p>
        )}
      </section>

      <section className={styles.tarjeta}>
        <h3 className={styles.seccionTitulo}>Ronda final</h3>
        <div className={styles.ronda}>
          {r.ronda.map((p, i) => (
            <span key={p.folio} className={styles.contenedor}>
              <span className={styles.contenedorLetra}>{letra(i)}</span>
              {p.folio}
            </span>
          ))}
        </div>
        <div className={styles.totales}>
          <Total nombre="Pedidos" valor={r.ronda.length} limite={r.maxPedidos} />
          <Total
            nombre="Partidas"
            valor={r.totalPartidas}
            limite={cfg.Bandera_MultipedidoTopePartidas ? r.maxPartidas : undefined}
          />
          <Total
            nombre="Minutos"
            valor={r.totalMinutos}
            limite={r.minutosFranjaRonda}
            nota={r.minutosFranjaRonda > r.minutosFranja ? `franja ampliada de ${r.minutosFranja}` : undefined}
          />
        </div>
        {r.notas.length > 0 && (
          <ul className={styles.notas}>
            {r.notas.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Candidato({ e }: { e: EvaluacionCandidato }) {
  const clase = e.estado === 'integrado' ? styles.candidatoOk : e.estado === 'rechazado' ? styles.candidatoNo : styles.candidatoNeutro;
  const icono = e.estado === 'integrado' ? '✓' : e.estado === 'rechazado' ? '✕' : '–';
  return (
    <article className={`${styles.candidato} ${clase}`}>
      <header className={styles.candidatoHead}>
        <span className={styles.candidatoIcono}>{icono}</span>
        <b>{e.pedido.folio}</b>
        <span>{e.estado === 'integrado' ? 'Se integra' : e.estado === 'rechazado' ? 'No se integra' : 'No se evaluó'}</span>
      </header>
      <p className={styles.motivo}>{e.motivo}</p>
      {e.reglas.length > 0 && (
        <ul className={styles.reglas}>
          {e.reglas.map((r) => (
            <Regla key={r.regla} r={r} />
          ))}
        </ul>
      )}
    </article>
  );
}

function Regla({ r }: { r: ReglaEvaluada }) {
  const clase = r.resultado === 'cumple' ? styles.reglaOk : r.resultado === 'no-cumple' ? styles.reglaNo : styles.reglaNa;
  const icono = r.resultado === 'cumple' ? '✓' : r.resultado === 'no-cumple' ? '✕' : '·';
  return (
    <li className={`${styles.regla} ${clase}`}>
      <span className={styles.reglaIcono}>{icono}</span>
      <span className={styles.reglaNombre}>{r.regla}</span>
      <span className={styles.reglaDetalle}>{r.detalle}</span>
    </li>
  );
}

function Parametro({ nombre, valor, inicial, nota }: { nombre: string; valor: number | string; inicial?: boolean; nota?: string }) {
  return (
    <div className={styles.parametro}>
      <span className={styles.parametroNombre}>{nombre}</span>
      <span className={styles.parametroValor}>{valor}</span>
      {inicial && <span className={styles.parametroNota}>sin configurar: valor inicial</span>}
      {nota && <span className={styles.parametroNota}>{nota}</span>}
    </div>
  );
}

function Total({ nombre, valor, limite, nota }: { nombre: string; valor: number; limite?: number; nota?: string }) {
  const excede = limite !== undefined && valor > limite;
  return (
    <div className={`${styles.total} ${excede ? styles.totalExcede : ''}`}>
      <span className={styles.parametroNombre}>{nombre}</span>
      <span className={styles.parametroValor}>
        {valor}
        {limite !== undefined && <small> de {limite}</small>}
      </span>
      {nota && <span className={styles.parametroNota}>{nota}</span>}
    </div>
  );
}
