/**
 * Pantalla principal del surtido multipedido V2.
 * Lista agregada por código: una fila por producto único de la ronda, con
 * imagen y avance por contenedor ("A 0/2 · B 0/2"). "Mismo cliente" solo va en el Detalle de la ronda.
 * El escaneo se dirige al pedido pendiente con menor orden que todavía lo necesite.
 *
 * Esta pantalla es el único punto que detecta el cierre de un pedido (FR-019) y el
 * de la ronda (FR-020): mira el estado del store, así que también reacciona a los
 * cambios hechos en el detalle del producto al volver a la lista.
 *
 * SDD 2026-10-26-multipedido-surtido-listado:
 * - Vinculación del pedido al abrir: cada pedido con su contenedor virtual; si falla la carga o falta un
 *   contenedor, no se abre ni se vincula ninguno (lo simula `simulacion`).
 * - Avisos de cambio de pedido: si un escaneo deja completo el código en un pedido que sigue abierto, se
 *   avisa con `CambioPedidoModal` ("Pedido surtido"). Si el pedido se cerró, sale "Pedido completado".
 * - Promoción incompleta al finalizar la ronda: con todo resuelto pero una promoción AxB incompleta, la
 *   ronda no se cierra. ✕ deja la ronda como estaba y "Finalizar surtido" lo vuelve a abrir. Al negarla,
 *   ✓ sigue con el cierre (parciales o confirmación) sin regresar al listado.
 * - Finalizar el surtido del pedido / Sacar el pedido de la ronda: confirmación, un registro por pedido,
 *   un solo guardado de la ronda y, si un corporativo con orden de compra está incompleto, sacarlo: regresa
 *   al listado sin ese pedido (ni tarjeta, ni filas, ni desglose), sin integrar otros y con las letras fijas.
 * SDD 2026-11-05-multipedido-surtido-listado-cierre:
 * - Salir del listado deshace el vínculo: todo o nada; si falla un pedido, se queda en la pantalla.
 * - Bloqueos y fallas al finalizar: códigos sin surtir, una sola confirmación de parciales con los códigos
 *   agrupados como en el listado y guardado por pedido con "Tarea incompleta" (reintentar / cancelar).
 * - Orden de los avisos al finalizar: corporativo incompleto → códigos en 0 → promociones → parciales →
 *   confirmación (revisión del usuario del 2026-11-09; es el orden del V2 real, `onPressFinishAssortmentManually`).
 *
 * - Guía por voz en el listado: resumen al abrir, al completar un producto y con "Repetir audio" (desde 2026-11-11).
 * SDD 2026-10-26-multipedido-surtido-listado · Validación de etiqueta única (EU): QR repetido en la ronda y caducidad
 * más próxima (desde 2026-11-11). Lo que se manda al servidor no se ve en la demo.
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
import cargandoIcono from '@assets/icons/loading-indicator.svg';
import {
  AVISOS,
  cambioDePedido,
  codigosParciales,
  conteosRonda,
  corporativoIncompleto,
  esMultipedidoV2,
  evaluarSurtido,
  hayCodigosSinSurtir,
  letraDe,
  partidaEn,
  pedidoActualIdx,
  pedidoCompleto,
  piezasEn,
  ordenarListado,
  productosVista,
  promocionesPendientes,
  proximaPartidaPara,
  rondaCompleta,
  rondaReducer,
  statusProducto,
  productoVista,
  type Ronda,
  type Pedido,
  type ProductoVista,
  type PromocionPendiente,
  type RechazoSurtido,
} from '../../domain/ronda';
import { useStore } from '../../store/AppStore';
import { ProductoRondaRow } from './ProductoRondaRow';
import { ContenedoresResumen, letraPedido } from './Contenedores';
import { CambioPedidoModal, CantidadModal, PedidoCompletadoModal } from './overlays/SurtidoModals';
import { EscanearPromocionModal, PromocionNegadaModal, PromocionPendienteModal } from './overlays/PromocionModals';
import { AvisoModal, botonesConfirmar, ConNegritas, DatosAviso, MenuListado, TextoAviso } from './overlays/Avisos';
import overlays from './overlays/overlays.module.css';
import styles from './SurtidoRonda.module.css';

/** Avisos de cierre y salida del listado (uno a la vez). */
type Aviso =
  | { tipo: 'error-carga' }
  | { tipo: 'finalizar' }
  | { tipo: 'parciales'; codigos: ProductoVista[] }
  | { tipo: 'sin-surtir' }
  | { tipo: 'corporativo'; idx: number }
  | { tipo: 'cancelado'; idx: number }
  | { tipo: 'sin-pedidos' }
  | { tipo: 'guardado-fallido'; idx: number }
  | { tipo: 'concluida' }
  | { tipo: 'salir' };

const TEXTO_ERROR_CARGA = 'Lo sentimos, no ha sido posible cargar la información necesaria. Por favor, regresa al menú principal.';
/** `taskAssortmentUnfinished` de `es.ts`: la falla de red al finalizar (único lugar con la alerta de conexión). */
const TEXTO_ERROR_RED = 'Hubo un error de red al finalizar el surtido. Por favor, acércate a un access point y vuelve a intentarlo.';
/**
 * Falla del servidor al finalizar: mismas opciones que la de red (escenario "Falla el guardado por un error del
 * servidor"). PROVISIONAL: la spec no cita el texto; falta que Producto lo confirme.
 */
const TEXTO_ERROR_SERVIDOR = 'Ocurrió un error en el servidor al finalizar el surtido. Por favor, vuelve a intentarlo.';
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
    cargarSiguienteTarea,
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
  /** Flujo de promoción incompleta. `retirada` es la foto previa a negar, para el paso 3. */
  const [promo, setPromo] = useState<
    | { paso: 'pendiente' | 'escanear'; pendiente: PromocionPendiente }
    | { paso: 'negada'; retirada: PromocionPendiente }
    | null
  >(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [menu, setMenu] = useState(false);
  /**
   * Etiqueta única de un perecedero con etiquetas de caducidad más próxima: "Etiqueta inválida" hasta que el usuario
   * confirme "No existen etiquetas más antiguas" (SDD 2026-10-26-multipedido-surtido-listado · Validación de etiqueta
   * única (EU) · "Caducidad más próxima en una ronda").
   */
  const [antigua, setAntigua] = useState<{ codigo: string; cantidad: number; etiqueta: string } | null>(null);
  /** El aviso de finalizar se ofrece solo una vez; después, con "Finalizar surtido". */
  const finalizarOfrecido = useRef(false);
  /** Veces que ya falló el guardado de cada pedido (`simulacion.vecesFallaGuardado` las limita). */
  const fallosGuardado = useRef<Map<string, number>>(new Map());
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

  /**
   * "Finalizar surtido". Orden de los avisos (revisión del 2026-11-09, el mismo del V2 real), cada uno se
   * detiene ahí: un corporativo incompleto se ofrece sacar (no puede negar) y, al sacarlo, se regresa al
   * listado; al finalizar de forma manual, los códigos en 0 bloquean; luego las promociones incompletas (al
   * negarlas se sigue aquí, sin regresar al listado); después los parciales y, al final, la confirmación.
   */
  const intentarFinalizar = (manual: boolean) => {
    setMenu(false);
    // Antes que nada, un pedido cancelado (SDD 2026-11-05-multipedido-surtido-listado-cierre · Pedido cancelado
    // durante el surtido): mientras se surte, el listado no se entera.
    const cancelado = r.pedidos.findIndex((p) => simulacion.cancelados.includes(p.id));
    if (cancelado >= 0) return setAviso({ tipo: 'cancelado', idx: cancelado });
    const corp = corporativoIncompleto(r);
    if (corp >= 0) return setAviso({ tipo: 'corporativo', idx: corp });
    if (manual && hayCodigosSinSurtir(r)) return setAviso({ tipo: 'sin-surtir' });
    const pendientes = promocionesPendientes(r);
    if (pendientes.length > 0) return setPromo({ paso: 'pendiente', pendiente: pendientes[0] });
    const parciales = codigosParciales(r);
    if (parciales.length > 0) return setAviso({ tipo: 'parciales', codigos: comoListado(parciales) });
    setAviso({ tipo: 'finalizar' });
  };

  /** Termina en el equipo: el listado se cierra y la tarea vuelve a como llegó (o queda finalizada). */
  const cerrarListado = (destino: string, descartar: boolean) => {
    setListadoAbierto(false);
    setAviso(null);
    if (descartar) {
      dispatch({ type: 'cargar', estado: tareaOriginal });
      setUltimoEscaneo(null);
    }
    navigate(destino);
  };

  /**
   * Registra un `FillOrderFull` por pedido, con su contenedor, y guarda la ronda una sola vez. Si el registro
   * de un pedido falla, se detiene ahí. (Cada etiqueta única ya va relacionada con su pedido en `ronda.etiquetas`.)
   *
   * Sin errores, no hay pantalla de resumen: se vuelve a la asignación de tareas con la siguiente tarea ya
   * cargada y el toast "Surtido finalizado" (SDD 2026-10-26-multipedido-surtido-listado · Finalizar el surtido
   * del pedido · "El cierre no muestra resumen de la ronda", clarificación 39).
   */
  const guardar = (desde = 0) => {
    setAviso(null);
    if (simulacion.concluidaPorOtro) {
      return setAviso({ tipo: 'concluida' });
    }
    for (let i = desde; i < r.pedidos.length; i++) {
      const p = r.pedidos[i];
      // Otro usuario concluyó la ronda a mitad del guardado: lo ya registrado no se deshace.
      if (simulacion.concluidaAntesDe === p.id) {
        return setAviso({ tipo: 'concluida' });
      }
      const fallos = fallosGuardado.current.get(p.id) ?? 0;
      if (simulacion.fallaGuardado === p.id && fallos < simulacion.vecesFallaGuardado) {
        fallosGuardado.current.set(p.id, fallos + 1);
        // "Reintentar" sigue desde este pedido: los ya registrados no se vuelven a registrar.
        return setAviso({ tipo: 'guardado-fallido', idx: i });
      }
    }
    cargarSiguienteTarea();
    sonar('ok');
    mostrarToast({ kind: 'success', title: 'Surtido finalizado', message: '¡Se completó la ronda de surtido exitosamente!' });
    navigate('/tareas');
  };

  /**
   * Cancelar tras la falla: se desvincula la tarea completa, ningún pedido conserva lo registrado y la tarea
   * queda pendiente, como hoy (SDD 2026-11-05-multipedido-surtido-listado-cierre · Bloqueos y fallas al
   * finalizar, clarificación 12).
   */
  const cancelarGuardado = () => cerrarListado('/tareas', true);

  /**
   * Sacar el corporativo: solo sale ese documento; los demás conservan lo surtido y su letra, y no entra
   * ningún otro pedido. Como en el V2, se avisa con la alerta "Pedido retirado de la ronda" y se regresa a la
   * ventana principal, ya sin ese pedido; si no queda ninguno, a la toma de tarea.
   */
  const sacarCorporativo = (idx: number) => {
    const p = r.pedidos[idx];
    // Falla el retiro: alerta global de error y el pedido sigue en la ronda y en el listado.
    if (simulacion.fallaRetiro) {
      setAviso(null);
      sonar('error');
      return mostrarToast(ALERTA_ERROR);
    }
    quitarDeLaRonda(p);
    sonar('ok');
    mostrarToast({ kind: 'success', title: 'Pedido retirado de la ronda', message: 'Aparta la mercancía ya surtida y repórtalo para su validación.' });
  };

  /** Pedido cancelado aceptado: sale de la ronda y se regresa a la ventana principal para volver a confirmar. */
  const aceptarCancelado = (idx: number) => {
    quitarDeLaRonda(r.pedidos[idx]);
    sonar('ok');
  };

  /**
   * Quita el pedido de tarjetas, filas y desglose (los demás conservan su letra). Si la ronda se queda sin pedidos,
   * la tarea se cancela (SDD 2026-11-05-multipedido-surtido-listado-cierre · La ronda se queda sin pedidos).
   */
  const quitarDeLaRonda = (p: Pedido) => {
    dispatch({ type: 'retirarPedido', pedidoId: p.id });
    pedidosAvisados.delete(p.id);
    if (ultimoEscaneo?.pedidoId === p.id) setUltimoEscaneo(null);
    setAviso(r.pedidos.length - 1 === 0 ? { tipo: 'sin-pedidos' } : null);
  };

  /** La ronda se quedó sin pedidos: no se registra surtido; la tarea se cancela y se pasa a la siguiente. */
  const rondaSinPedidos = () => {
    cargarSiguienteTarea();
    navigate('/tareas');
  };

  /** Salir: desvincula todos los contenedores o ninguno, y descarta lo registrado, negaciones incluidas. */
  const salir = () => {
    const falla = simulacion.fallaDesvincular;
    if (falla) {
      setAviso(null);
      sonar('error');
      return mostrarToast({ kind: 'error', title: 'No fue posible salir', message: 'No se pudo desvincular el contenedor. Intenta de nuevo.' });
    }
    cerrarListado('/tareas', true);
  };

  // Cierre de pedido (FR-019) y de ronda (FR-020).
  useEffect(() => {
    // Mientras corre el flujo de promoción o hay otro aviso, el cierre espera.
    if (promo || aviso) return;
    if (rondaCompleta(r) && r.pedidos.length > 0) {
      if (!finalizarOfrecido.current) {
        finalizarOfrecido.current = true;
        intentarFinalizar(false);
      }
      return;
    }
    const cerrado = r.pedidos.find((p) => pedidoCompleto(p) && !pedidosAvisados.has(p.id));
    if (cerrado) {
      pedidosAvisados.add(cerrado.id);
      setTransicion(cerrado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ronda, promo, aviso]);

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
    if (!ev.ok) return rechazar(ev.rechazo);
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

  /* ---- Promoción incompleta: paso 2, escanear un código de la promoción ---- */
  const onScanPromocion = (valor: string) => {
    if (promo?.paso !== 'escanear') return;
    const res = interpretarLectura(ronda, valor);
    const codigos = promo.pendiente.pedidos.flatMap((p) => p.partidas.map((x) => x.codigo));
    const codigo = res.tipo === 'surtir' || res.tipo === 'capturar' || res.tipo === 'rechazo' ? res.codigo : null;
    if (!codigo || !codigos.includes(codigo)) {
      sonar('error');
      mostrarToast({ kind: 'error', title: 'Código inválido', message: 'El código escaneado no pertenece a los códigos con promoción.' });
      return setPromo({ paso: 'pendiente', pendiente: promo.pendiente });
    }
    sonar('ok');
    dispatch({ type: 'negarPromocion', promocionId: promo.pendiente.promocion.id });
    setPromo({ paso: 'negada', retirada: promo.pendiente });
  };

  /**
   * Paso 3 aceptado (✓): no se regresa al listado. Sigue el cierre con lo negado fuera de la cuenta: otra
   * promoción pendiente, los parciales o la confirmación de finalizar.
   */
  const aceptarPromocionNegada = () => {
    setPromo(null);
    intentarFinalizar(false);
  };

  const onScan = (valor: string) => {
    const res = interpretarLectura(ronda, valor, {
      etiquetaUnica: simulacion.etiquetaUnica,
      etiquetasMasAntiguas: simulacion.etiquetasMasAntiguas,
    });
    if (res.tipo === 'invalida') return sonar('error');
    if (res.tipo === 'rechazo') return rechazar(res.rechazo);
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
    ? (r.pedidos.slice(r.pedidos.indexOf(transicion) + 1).find((p) => !pedidoCompleto(p)) ?? null)
    : null;

  const hayOverlay =
    capturando !== null || transicion !== null || cambio !== null || promo !== null || aviso !== null || antigua !== null || menu;
  const totalPedidos = r.pedidos.length;

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
              titulo="Avance de la ronda"
              etiquetas={false}
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
          // Ya no hay nada que escanear: solo queda confirmar el cierre (o resolver una promoción).
          <Button variant="default" label="Finalizar surtido" className={styles.full} onClick={() => intentarFinalizar(false)} />
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
          onFinalizar={() => intentarFinalizar(true)}
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

      {promo?.paso === 'pendiente' && (
        <PromocionPendienteModal
          pendiente={promo.pendiente}
          totalPedidos={totalPedidos}
          onCerrar={() => setPromo(null)}
          onEliminar={() => setPromo({ paso: 'escanear', pendiente: promo.pendiente })}
        />
      )}

      {promo?.paso === 'escanear' && (
        <EscanearPromocionModal
          pendiente={promo.pendiente}
          totalPedidos={totalPedidos}
          onCancelar={() => setPromo({ paso: 'pendiente', pendiente: promo.pendiente })}
          onScan={onScanPromocion}
        />
      )}

      {promo?.paso === 'negada' && (
        <PromocionNegadaModal retirada={promo.retirada} totalPedidos={totalPedidos} onAceptar={aceptarPromocionNegada} />
      )}

      {transicion && (
        <PedidoCompletadoModal
          pedidoCompletado={transicion.id}
          siguientePedido={siguientePedido?.id ?? null}
          siguienteCliente={siguientePedido?.cliente.nombre ?? null}
          letraCompletado={letraDe(r, r.pedidos.indexOf(transicion))}
          letraSiguiente={siguientePedido ? letraDe(r, r.pedidos.indexOf(siguientePedido)) : null}
          onContinuar={cerrarOverlay}
        />
      )}

      {aviso && (
        <AvisoListado
          aviso={aviso}
          pedidos={r.pedidos}
          multipedido={multipedido}
          onCerrar={() => setAviso(null)}
          onGuardar={() => guardar()}
          errorServidor={simulacion.tipoFallaGuardado === 'servidor'}
          onReintentar={(idx) => guardar(idx)}
          onCancelarGuardado={cancelarGuardado}
          onSacar={sacarCorporativo}
          onAceptarCancelado={aceptarCancelado}
          onSinPedidos={rondaSinPedidos}
          onConcluida={rondaSinPedidos}
          onErrorCarga={() => cerrarListado('/tareas', false)}
          onSalir={salir}
        />
      )}
    </div>
  );
}

/**
 * Los avisos de cierre y salida, con los textos de hoy (`es.ts`) y lo que el multipedido V2 les añade. Los botones
 * siguen al V2: ✕ / ✓ en las confirmaciones (`textActions={false}`), texto en "Tarea incompleta" y en salir.
 */
function AvisoListado({
  aviso,
  pedidos,
  multipedido,
  errorServidor,
  onCerrar,
  onGuardar,
  onReintentar,
  onCancelarGuardado,
  onSacar,
  onAceptarCancelado,
  onSinPedidos,
  onConcluida,
  onErrorCarga,
  onSalir,
}: {
  aviso: Aviso;
  pedidos: Pedido[];
  multipedido: boolean;
  errorServidor: boolean;
  onCerrar: () => void;
  onGuardar: () => void;
  onReintentar: (idx: number) => void;
  onCancelarGuardado: () => void;
  onSacar: (idx: number) => void;
  onAceptarCancelado: (idx: number) => void;
  onSinPedidos: () => void;
  onConcluida: () => void;
  onErrorCarga: () => void;
  onSalir: () => void;
}) {
  const cancelar = { label: 'Cancelar', variante: 'error' as const, onClick: onCerrar };
  const letra = (idx: number) => pedidos[idx]?.contenedor ?? letraPedido(idx);
  switch (aviso.tipo) {
    case 'error-carga':
      return (
        <AvisoModal titulo="Error" tipo="error" botones={[{ label: 'Regresar', onClick: onErrorCarga }]}>
          <TextoAviso>{TEXTO_ERROR_CARGA}</TextoAviso>
        </AvisoModal>
      );
    case 'finalizar':
      return (
        <AvisoModal titulo="Finalizar surtido" botones={botonesConfirmar(onCerrar, onGuardar)}>
          <TextoAviso>Haz surtido el total de productos solicitados ¿Deseas finalizar la ronda?</TextoAviso>
        </AvisoModal>
      );
    case 'parciales':
      // `PartialProductList` del V2, pero con cada código una vez y su desglose por contenedor, en el mismo
      // orden que el listado (revisión del 2026-11-09: "agrúpalos como en la ventana principal").
      return (
        <AvisoModal titulo="Finalizar surtido" botones={botonesConfirmar(onCerrar, onGuardar)}>
          <TextoAviso>
            <ConNegritas texto="Tienes códigos **surtidos parcialmente.** ¿Deseas continuar? Revisa con cuidado la información, las piezas solicitadas podrían estar en otro lado." />
          </TextoAviso>
          <div className={overlays.listaParciales} aria-label="Códigos surtidos parcialmente">
            {aviso.codigos.map((v, i) => (
              <div key={v.codigo}>
                {i > 0 && <Divider variant="list" />}
                <ProductoRondaRow producto={v} multipedido={multipedido} />
              </div>
            ))}
          </div>
        </AvisoModal>
      );
    case 'sin-surtir':
      return (
        <AvisoModal
          titulo="No es posible finalizar surtido"
          tipo="error"
          botones={[{ label: 'Cerrar', variante: 'error', icono: 'cross', onClick: onCerrar }]}
        >
          <TextoAviso>
            <ConNegritas texto="Tienes **códigos sin surtir**, para finalizar el surtido primero deberás negarlos entrando al detalle del producto." />
          </TextoAviso>
        </AvisoModal>
      );
    case 'corporativo': {
      const p = pedidos[aviso.idx];
      return (
        <AvisoModal titulo="No es posible finalizar este pedido" tipo="error" botones={botonesConfirmar(onCerrar, () => onSacar(aviso.idx))}>
          <TextoAviso>
            <ConNegritas texto="Este es un **pedido corporativo** que requiere surtido completo. Actualmente hay **productos sin surtir,** por lo que no puede finalizarse." />
          </TextoAviso>
          {multipedido && (
            <DatosAviso
              filas={[
                { etiqueta: 'Pedido', valor: p?.id },
                { etiqueta: 'Contenedor', valor: letra(aviso.idx) },
              ]}
            />
          )}
          <TextoAviso>
            <b>Aparta la mercancía ya surtida y repórtalo para su validación.</b>
          </TextoAviso>
          <TextoAviso>¿Deseas sacar el pedido de la ronda?</TextoAviso>
        </AvisoModal>
      );
    }
    case 'guardado-fallido': {
      const p = pedidos[aviso.idx];
      return (
        <AvisoModal
          titulo="Tarea incompleta"
          tipo="reloj"
          botones={[
            { label: 'Cancelar', variante: 'error', onClick: onCancelarGuardado },
            { label: 'Reintentar', onClick: () => onReintentar(aviso.idx) },
          ]}
        >
          <TextoAviso>{errorServidor ? TEXTO_ERROR_SERVIDOR : TEXTO_ERROR_RED}</TextoAviso>
          {/* Nombra el pedido que falló. No lista los ya registrados: al cancelar no se conserva ninguno. */}
          {multipedido && (
            <DatosAviso
              filas={[
                { etiqueta: 'Pedido sin registrar', valor: p?.id },
                { etiqueta: 'Contenedor', valor: letra(aviso.idx) },
              ]}
            />
          )}
        </AvisoModal>
      );
    }
    case 'cancelado': {
      const p = pedidos[aviso.idx];
      return (
        <AvisoModal titulo="Pedido cancelado" tipo="error" botones={[{ label: 'Aceptar', onClick: () => onAceptarCancelado(aviso.idx) }]}>
          <TextoAviso>
            El pedido <b>{p?.id}</b> fue cancelado. Aparta la mercancía ya surtida y repórtalo para su validación.
          </TextoAviso>
          {multipedido && <DatosAviso filas={[{ etiqueta: 'Contenedor', valor: letra(aviso.idx) }]} />}
        </AvisoModal>
      );
    }
    case 'sin-pedidos':
      // PROVISIONAL: la spec pide avisar "que la ronda ya no tiene pedidos" sin citar el texto.
      return (
        <AvisoModal titulo="Ronda sin pedidos" tipo="error" botones={[{ label: 'Aceptar', onClick: onSinPedidos }]}>
          <TextoAviso>La ronda ya no tiene pedidos, así que la tarea se canceló. Regresa a la asignación de tareas.</TextoAviso>
        </AvisoModal>
      );
    case 'concluida':
      return (
        <AvisoModal titulo="Error" tipo="error" botones={[{ label: 'Aceptar', onClick: onConcluida }]}>
          <TextoAviso>Esta tarea ya fue concluida por otro usuario.</TextoAviso>
        </AvisoModal>
      );
    case 'salir':
      return (
        <AvisoModal titulo="Salir del surtido" botones={[cancelar, { label: 'Aceptar', onClick: onSalir }]}>
          <TextoAviso>Si sales ahora perderás los cambios hechos. ¿Deseas continuar?</TextoAviso>
          {multipedido && (
            <TextoAviso>
              Se verán afectados los <b>{pedidos.length} pedidos</b> de la ronda.
            </TextoAviso>
          )}
        </AvisoModal>
      );
  }
}
