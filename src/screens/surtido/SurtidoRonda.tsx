/**
 * Pantalla principal del surtido multipedido V2.
 * Lista agregada por código: una fila por producto único de la ronda, con
 * imagen y avance por contenedor ("A 0/2 · B 0/2"). "Mismo cliente" solo va en el Detalle de la ronda.
 * El escaneo se dirige al pedido pendiente con menor orden que todavía lo necesite.
 *
 * Esta pantalla es el único punto que detecta el cierre de un pedido (FR-019): mira el estado del store, así que
 * también reacciona a los cambios hechos en el detalle del producto al volver a la lista.
 *
 * SDD 2026-10-26-multipedido-surtido-listado:
 * - Vinculación del pedido al abrir: cada pedido con su contenedor virtual; si falla la carga o falta un
 *   contenedor, no se abre ni se vincula ninguno (lo simula `simulacion`).
 * - Avisos de cambio de pedido: si un escaneo deja completo el código en un pedido que sigue abierto, se
 *   avisa con `CambioPedidoModal` ("Pedido surtido"). Si el pedido se cerró, sale "Pedido completado".
 * SDD 2026-11-05-multipedido-surtido-listado-cierre:
 * - Salir del listado deshace el vínculo: todo o nada; si falla un pedido, se queda en la pantalla.
 * - Guía por voz en el listado: resumen al abrir, al completar un producto y con "Repetir audio" (desde 2026-11-11).
 * SDD 2026-10-26-multipedido-surtido-listado · Validación de etiqueta única (EU): QR repetido en la ronda y caducidad
 * más próxima (desde 2026-11-11). Lo que se manda al servidor no se ve en la demo.
 *
 * Finalizar el surtido (avisos, sacar un corporativo, promociones incompletas, cancelados, fallas al guardar) y lo que
 * sigue (revisión, facturación y embarque) están en la demo de revisión multipedido (separación del 2026-11-25): al
 * completar la ronda, o con "Finalizar surtido", esta demo lo avisa y ofrece abrirla.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@ds/components/organisms/AppHeader/AppHeader';
import { ContentPanel } from '@ds/components/organisms/ContentPanel/ContentPanel';
import { BottomBar } from '@ds/components/organisms/BottomBar/BottomBar';
import { OrderProgress } from '@ds/components/molecules/OrderProgress/OrderProgress';
import { ScanInput, type ScanInputHandle } from '@ds/components/molecules/ScanInput/ScanInput';
import { Divider } from '@ds/components/atoms/Divider/Divider';
import { Button } from '@ds/components/atoms/Button/Button';
import { sonar } from '../../domain/sonidos';
import { interpretarLectura } from '../../domain/lector';
import { ordenDelListado } from '../../domain/simulacion';
import { callar, debeLeer, resumenVoz } from '../../domain/voz';
import { DEMO_REVISION_URL } from '../../navigation/demos';
import cargandoIcono from '@assets/icons/loading-indicator.svg';
import {
  AVISOS,
  cambioDePedido,
  conteosRonda,
  esMultipedidoV2,
  evaluarSurtido,
  letraDe,
  partidaEn,
  pedidoActualIdx,
  pedidoCompleto,
  piezasEn,
  ordenarListado,
  productosVista,
  proximaPartidaPara,
  rondaCompleta,
  rondaReducer,
  statusProducto,
  productoVista,
  type Ronda,
  type Pedido,
  type ProductoVista,
  type RechazoSurtido,
} from '../../domain/ronda';
import { useStore } from '../../store/AppStore';
import { ProductoRondaRow } from './ProductoRondaRow';
import { ContenedoresResumen } from './Contenedores';
import { CambioPedidoModal, CantidadModal, PedidoCompletadoModal } from './overlays/SurtidoModals';
import { AvisoModal, MenuListado, TextoAviso } from './overlays/Avisos';
import styles from './SurtidoRonda.module.css';

/** Avisos del listado (uno a la vez). */
type Aviso = { tipo: 'error-carga' } | { tipo: 'fin-demo' } | { tipo: 'salir' };

const TEXTO_ERROR_CARGA = 'Lo sentimos, no ha sido posible cargar la información necesaria. Por favor, regresa al menú principal.';
/** Alerta global de error de la HH (la misma de la falla de conexión al consultar banderas). */
const ALERTA_ERROR = { kind: 'error' as const, title: 'Error de conexión', message: 'Ocurrió un error de conexión con el servidor.' };

export function SurtidoRonda() {
  const navigate = useNavigate();
  const {
    ronda,
    dispatch,
    mostrarToast,
    ultimoEscaneo,
    setUltimoEscaneo,
    pedidosAvisados,
    simulacion,
    tareaOriginal,
    listadoAbierto,
    setListadoAbierto,
    leer,
  } = useStore();
  const scanRef = useRef<ScanInputHandle>(null);
  const [capturando, setCapturando] = useState<string | null>(null);
  const [transicion, setTransicion] = useState<Pedido | null>(null);
  const [cambio, setCambio] = useState<{
    codigo: string;
    descripcion: string;
    cantidad: number;
    desde: string;
    contenedor: string;
  } | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [menu, setMenu] = useState(false);
  /**
   * Etiqueta única de un perecedero con etiquetas de caducidad más próxima: "Etiqueta inválida" hasta que el usuario
   * confirme "No existen etiquetas más antiguas" (SDD 2026-10-26-multipedido-surtido-listado · Validación de etiqueta
   * única (EU) · "Caducidad más próxima en una ronda").
   */
  const [antigua, setAntigua] = useState<{ codigo: string; cantidad: number; etiqueta: string } | null>(null);
  /** El aviso de la demo de revisión se ofrece solo una vez al completar la ronda; después, con "Finalizar surtido". */
  const finOfrecido = useRef(false);
  /** Evita abrir dos veces el listado (StrictMode monta los efectos dos veces). */
  const abriendo = useRef(false);
  /**
   * Mientras carga la ronda: el mismo indicador que al abrir una tarea de un solo pedido, sin nada propio de la
   * ronda (SDD 2026-10-26-multipedido-surtido-listado · Vinculación del pedido al abrir · "Mientras carga la ronda").
   */
  const [cargando, setCargando] = useState(!listadoAbierto && simulacion.demoraCarga > 0);

  const r = ronda.ronda;
  const multipedido = esMultipedidoV2(r);

  /**
   * Guía por voz (SDD 2026-11-05-multipedido-surtido-listado-cierre · Guía por voz en el listado): en la tarea 58, o
   * en la 31 con "Lectura de elementos" encendida, lee "Ronda de {n} pedidos, …" (o "Pedido {n}, …" con uno solo).
   */
  const leerResumen = (ronda: Ronda) => {
    if (debeLeer(simulacion)) leer(resumenVoz(ronda));
  };

  // Orden del V2: secciones Pendientes, Parciales, Negados y Completados sin encabezados; dentro, por familia
  // (Bandera_AgrupacionFamiliaEnHH; si su consulta falla, inactiva), ubicación (Bandera_UbicacionesUDN) o código.
  const comoListado = (v: ProductoVista[]) => ordenarListado(v, ordenDelListado(simulacion));
  const productos = comoListado(productosVista(r));
  const c = conteosRonda(r);
  const idxActual = pedidoActualIdx(r);
  /**
   * Pedido que se marca como "en surtido": ninguno hasta el primer escaneo (sesión del 2026-11-02);
   * después, el que recibió el último escaneo mientras siga abierto, o el siguiente pendiente si ya
   * se completó.
   */
  const idxUltimo = ultimoEscaneo ? r.pedidos.findIndex((p) => p.id === ultimoEscaneo.pedidoId) : -1;
  const idxMarcado = idxUltimo < 0 ? -1 : pedidoCompleto(r.pedidos[idxUltimo]) ? idxActual : idxUltimo;

  /* ---- Apertura: vinculación de contenedores ---- */
  useEffect(() => {
    if (listadoAbierto || abriendo.current) return;
    abriendo.current = true;
    const abrir = () => {
      setCargando(false);
      if (simulacion.fallaCargaRonda) {
        return setAviso({ tipo: 'error-carga' });
      }
      if (simulacion.sinContenedor && r.pedidos.some((p) => p.id === simulacion.sinContenedor)) {
        return setAviso({ tipo: 'error-carga' });
      }
      setListadoAbierto(true);
      // Guía por voz: el resumen al abrir el listado.
      leerResumen(r);
    };
    if (simulacion.demoraCarga > 0) {
      const t = window.setTimeout(abrir, simulacion.demoraCarga);
      return () => {
        window.clearTimeout(t);
        abriendo.current = false;
      };
    }
    abrir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La voz se detiene al salir del listado.
  useEffect(() => callar, []);

  // El último producto escaneado se lleva a la vista para que el surtidor lo vea marcado.
  useEffect(() => {
    if (!ultimoEscaneo) return;
    document.querySelector(`[data-codigo="${ultimoEscaneo.codigo}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [ultimoEscaneo]);

  const completa = rondaCompleta(r);

  /** "Finalizar surtido": la finalización está en la demo de revisión multipedido. */
  const finalizar = () => {
    setMenu(false);
    setAviso({ tipo: 'fin-demo' });
  };

  /** Termina en el equipo: el listado se cierra y la tarea vuelve a como llegó. */
  const cerrarListado = (destino: string, descartar: boolean) => {
    setListadoAbierto(false);
    setAviso(null);
    if (descartar) {
      dispatch({ type: 'cargar', estado: tareaOriginal });
      setUltimoEscaneo(null);
    }
    navigate(destino);
  };

  /** Salir: desvincula todos los contenedores o ninguno, y descarta lo registrado, negaciones incluidas. */
  const salir = () => {
    // Todo o nada: si falla la desvinculación de cualquier pedido (o vence el tiempo de espera), permanece en el
    // listado y ninguno queda desvinculado.
    const falla = simulacion.fallaDesvincular;
    if (falla) {
      setAviso(null);
      sonar('error');
      return mostrarToast(ALERTA_ERROR);
    }
    cerrarListado('/tareas', true);
  };

  // Cierre de pedido (FR-019). Al completar la ronda, el aviso de la demo de revisión (una sola vez).
  useEffect(() => {
    if (aviso) return;
    if (rondaCompleta(r) && r.pedidos.length > 0) {
      if (!finOfrecido.current) {
        finOfrecido.current = true;
        finalizar();
      }
      return;
    }
    // Si la ronda deja de estar completa (una corrección), se volverá a ofrecer al completarla.
    finOfrecido.current = false;
    // Con un solo pedido no hay aviso de pedido completado (Alcance de la ronda de un solo pedido).
    const cerrado = r.pedidos.length >= 2 ? r.pedidos.find((p) => pedidoCompleto(p) && !pedidosAvisados.has(p.id)) : undefined;
    if (cerrado) {
      pedidosAvisados.add(cerrado.id);
      setTransicion(cerrado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ronda, aviso]);

  const cerrarOverlay = () => {
    setCapturando(null);
    setTransicion(null);
    setCambio(null);
    window.setTimeout(() => scanRef.current?.focus(), 0);
  };

  const rechazar = (rechazo: RechazoSurtido) => {
    sonar('error');
    mostrarToast({ kind: 'error', ...AVISOS[rechazo] });
  };

  /** Aplica la cantidad al pedido con menor orden que todavía necesita el código (FR-010). */
  const surtir = (codigo: string, cantidad: number, etiqueta?: string) => {
    const ev = evaluarSurtido(r, codigo, cantidad);
    if (!ev.ok) return rechazar(ev.rechazo === 'fuera-de-ronda' && !multipedido ? 'fuera-del-pedido' : ev.rechazo);
    sonar('ok');
    // El pedido que recibe las piezas es el destino antes de aplicar el surtido (FR-010).
    const destino = proximaPartidaPara(r, codigo);
    if (destino) setUltimoEscaneo({ codigo, pedidoId: r.pedidos[destino.pedidoIdx].id });
    const accion = { type: 'surtirPorCodigo', codigo, cantidad, etiqueta } as const;
    const despues = rondaReducer(ronda, accion).ronda;
    const cp = cambioDePedido(r, despues, codigo);
    dispatch(accion);
    // Guía por voz: el resumen actualizado al completar un producto.
    const antes = productoVista(r, codigo);
    const ahora = productoVista(despues, codigo);
    if (ahora && statusProducto(ahora) === 'completado' && (!antes || statusProducto(antes) !== 'completado')) leerResumen(despues);
    // Pedido cerrado: lo avisa PedidoCompletadoModal, que ya nombra el siguiente pedido.
    if (cp && !pedidoCompleto(cp.desde)) {
      const descripcion = destino ? partidaEn(r, destino).descripcion : '';
      setCambio({ codigo, descripcion, cantidad: piezasEn(cp.desde, codigo), desde: cp.desde.id, contenedor: cp.letraDesde });
    }
  };

  const onScan = (valor: string) => {
    const res = interpretarLectura(ronda, valor, {
      etiquetaUnica: simulacion.etiquetaUnica,
      etiquetasMasAntiguas: simulacion.etiquetasMasAntiguas,
    });
    // Lectura ilegible: "Código inválido" con el texto de hoy. Con un solo pedido, el código ajeno lleva el texto de hoy.
    if (res.tipo === 'invalida') return rechazar('lectura-invalida');
    if (res.tipo === 'rechazo') return rechazar(res.rechazo === 'fuera-de-ronda' && !multipedido ? 'fuera-del-pedido' : res.rechazo);
    // Etiqueta única ya surtida: alerta "Advertencia", sin voz y sin sumar a ningún pedido. En la ronda no se repite
    // en ningún pedido; con un solo pedido, el texto de hoy (`tagAlreadyScannedInOrder`).
    if (res.tipo === 'etiqueta-repetida') {
      sonar('error');
      return mostrarToast({
        kind: 'warning',
        title: 'Advertencia',
        message: res.pedidoUnico
          ? 'La etiqueta ya fue escaneada en este pedido, por favor escanea otra etiqueta.'
          : 'La etiqueta ya fue escaneada en esta ronda, por favor escanea otra etiqueta.',
      });
    }
    if (res.tipo === 'etiqueta-antigua') {
      sonar('error');
      return setAntigua({ codigo: res.codigo, cantidad: res.cantidad, etiqueta: res.etiqueta });
    }
    if (res.tipo === 'surtir') return surtir(res.codigo, res.cantidad, res.etiqueta);
    // Código corto o partida misceláneo: la cantidad se captura a mano
    // (Revision-HH-v2 abre el bottom sheet de cantidad en ambos casos).
    setCapturando(res.codigo);
  };

  const partidaCapturando = capturando ? proximaPartidaPara(r, capturando) : null;
  const faltantes = partidaCapturando
    ? partidaEn(r, partidaCapturando).solicitado - partidaEn(r, partidaCapturando).surtido
    : 0;

  const siguientePedido = transicion
    ? (r.pedidos.slice(r.pedidos.indexOf(transicion) + 1).find((p) => !pedidoCompleto(p)) ??
      r.pedidos.find((p) => p !== transicion && !pedidoCompleto(p)) ??
      null)
    : null;

  const hayOverlay = capturando !== null || transicion !== null || cambio !== null || aviso !== null || antigua !== null || menu;

  return (
    <div className={styles.screen}>
      <AppHeader backLabel="Menú" onBack={() => setAviso({ tipo: 'salir' })} onMenu={() => setMenu(true)} />

      <ContentPanel title="Surtido de órdenes" bottom={124} scroll>
        {cargando && (
          <div className={styles.cargando} role="status" aria-label="Cargando">
            <img src={cargandoIcono} alt="" width={48} height={48} />
          </div>
        )}
        {!cargando && aviso?.tipo !== 'error-carga' && (
          <>
            <OrderProgress
              {...(multipedido ? { titulo: 'Avance de la ronda', etiquetas: false } : { pedido: r.pedidos[0]?.id })}
              completado={c.completado}
              negado={c.negado}
              parcial={c.parcial}
              pendientes={c.pendientes}
            />

            {/* Avance individual por pedido; el resaltado es el pedido que se está surtiendo
                (ninguno hasta el primer escaneo). Con un solo pedido, el listado es el de hoy. */}
            {multipedido && <ContenedoresResumen pedidos={r.pedidos} actualIdx={idxMarcado} />}

            <div className={styles.list}>
              {productos.map((v, idx) => (
                <div key={v.codigo} className={styles.itemContainer}>
                  {idx > 0 && <Divider variant="list" />}
                  <ProductoRondaRow
                    producto={v}
                    multipedido={multipedido}
                    demoraImagen={simulacion.demoraImagen}
                    marcado={ultimoEscaneo?.codigo === v.codigo}
                    onClick={() => navigate(`/detalle/${v.codigo}`)}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </ContentPanel>

      <BottomBar>
        {cargando ? null : completa ? (
          // Ya no hay nada que escanear: solo queda finalizar (en la demo de revisión multipedido).
          <Button variant="default" label="Finalizar surtido" className={styles.full} onClick={finalizar} />
        ) : (
          <ScanInput ref={scanRef} onScan={onScan} autoFocus={!hayOverlay} />
        )}
      </BottomBar>

      {menu && (
        <MenuListado
          onCerrar={() => setMenu(false)}
          onRepetirAudio={() => {
            setMenu(false);
            leerResumen(r);
          }}
          onFinalizar={finalizar}
        />
      )}

      {antigua && (
        <AvisoModal titulo="Etiqueta inválida" tipo="error" botones={[{ label: 'Aceptar', onClick: () => setAntigua(null) }]}>
          <TextoAviso>
            La etiqueta escaneada no corresponde a la mayor prioridad de salida.{' '}
            <b>Escanea una etiqueta con la fecha de caducidad más próxima</b> ó selecciona no existen etiquetas más antiguas.
          </TextoAviso>
          <Button
            variant="outline"
            label="No existen etiquetas más antiguas"
            className={styles.full}
            onClick={() => {
              const a = antigua;
              setAntigua(null);
              surtir(a.codigo, a.cantidad, a.etiqueta);
            }}
          />
        </AvisoModal>
      )}

      {capturando && (
        <CantidadModal
          codigo={capturando}
          sugerida={faltantes}
          onCancel={cerrarOverlay}
          onConfirm={(n) => {
            const codigo = capturando;
            cerrarOverlay();
            surtir(codigo, n);
          }}
        />
      )}

      {cambio && <CambioPedidoModal {...cambio} onEntendido={cerrarOverlay} />}

      {transicion && (
        <PedidoCompletadoModal
          pedidoCompletado={transicion.id}
          siguientePedido={siguientePedido?.id ?? null}
          siguienteCliente={siguientePedido ? `${siguientePedido.cliente.id} · ${siguientePedido.cliente.nombre}` : null}
          letraCompletado={letraDe(r, r.pedidos.indexOf(transicion))}
          letraSiguiente={siguientePedido ? letraDe(r, r.pedidos.indexOf(siguientePedido)) : null}
          onContinuar={cerrarOverlay}
        />
      )}

      {aviso?.tipo === 'error-carga' && (
        <AvisoModal titulo="Error" tipo="error" botones={[{ label: 'Regresar', onClick: () => cerrarListado('/tareas', false) }]}>
          <TextoAviso>{TEXTO_ERROR_CARGA}</TextoAviso>
        </AvisoModal>
      )}

      {aviso?.tipo === 'fin-demo' && (
        // Aviso de la demo, no de la HH: la finalización del surtido vive en la demo de revisión multipedido.
        <AvisoModal
          titulo="Finalizar surtido"
          botones={[
            { label: 'Cerrar', variante: 'error', onClick: () => setAviso(null) },
            { label: 'Abrir demo', onClick: () => window.open(DEMO_REVISION_URL, '_blank', 'noopener') },
          ]}
        >
          <TextoAviso>
            La finalización del surtido de la ronda, la revisión, la facturación y el embarque se prueban en la{' '}
            <b>demo de revisión multipedido</b>.
          </TextoAviso>
          <TextoAviso>Ahí la ronda G-500 arranca con el último producto por surtir.</TextoAviso>
        </AvisoModal>
      )}

      {aviso?.tipo === 'salir' && (
        <AvisoModal
          titulo="Salir del surtido"
          botones={[
            { label: 'Cancelar', variante: 'error', onClick: () => setAviso(null) },
            { label: 'Aceptar', onClick: salir },
          ]}
        >
          <TextoAviso>Si sales ahora perderás los cambios hechos. ¿Deseas continuar?</TextoAviso>
          {multipedido && (
            <TextoAviso>
              Se verán afectados los <b>{r.pedidos.length} pedidos</b> de la ronda.
            </TextoAviso>
          )}
        </AvisoModal>
      )}
    </div>
  );
}
