/**
 * Simulador del armado de la ronda (servidor `recuperar-ordenes-surtir`) con el multipedido V2. Sigue los cambios
 * `2026-10-26-multipedido-armado-ronda` (elegibilidad-ronda-multipedido, catalogo-bandera-sucursal y los deltas del
 * servicio en specs-servicio/: precedencia del tipo de ronda, elegibilidad por vía, presupuesto de tiempo y traspasos)
 * y `2026-11-20-multipedido-configuracion-armado` (configuracion-ronda-multipedido).
 *
 * En la operación real esto lo resuelve el back-end (el servicio que asigna `GrupoID`): la HH recibe la ronda
 * ya armada. Aquí se reproduce para que QA valide en pantalla, escenario por escenario. Es lógica pura: no toca el
 * store ni la ronda del surtido.
 *
 * Multipedido V2 activo (clarificación 2 de configuración y 45 de armado): `Bandera_MultipedidoEnHH` y
 * `BanderaListadoDeProductosEnHH` activas, en una sucursal que arma por servicio (`RondaOrdenesSurtidoAPI`). Sin eso, la
 * ronda se arma como hoy: en la ruta por servicio el simulador reproduce el llenado por presupuesto y la ronda por
 * pedido de las canónicas observadas; la ruta SP (`OrdenesporSurtir`) no se reproduce.
 *
 * Precedencia del tipo de ronda (MODIFIED del servicio): falta de configuración de ordenamiento (sin rondas, como hoy)
 * → almacenista (rol 2, solo balanceos, uno por ronda) → paquetería → sugerencia a embarques → multipedido V2 → ronda
 * normal por presupuesto.
 *
 * Reglas del multipedido V2 (elegibilidad-ronda-multipedido):
 * - Orden de la cola: el que entrega el procesador de ordenamiento (holgura, o ponderación con
 *   `Bandera_OrdenamientoPrioridadV2`). Solo en un empate de ese orden: creación más antigua, luego menos partidas,
 *   luego folio menor. La zona no cuenta.
 * - Criterios acumulativos: el candidato cumple todos los activos (misma dirección, código compartido, tope).
 * - Un código cuenta una partida en cada pedido donde está (en dos pedidos suma dos).
 * - El tope solo filtra candidatos y solo con su bandera activa: el ancla no se descarta, pero entonces ningún
 *   candidato cabe.
 * - Máximo de pedidos en 0 o sin configurar, o tope en 0 o sin configurar con su bandera activa: no se evalúan
 *   candidatos (cada pedido sale en su propia ronda); las partes de una división de factura siguen yendo juntas.
 * - `Bandera_RevisionPedidoEnHH` no participa en el armado (clarificación 48): en este entregable está desactivada.
 */

export type Servicio = 'local' | 'foraneo';
/** `otro`: un tipo de documento que no es pedido de venta ni traspaso (la ronda por pedido no lo reconoce). */
export type TipoPedido = 'cliente' | 'traspaso' | 'balanceo' | 'otro';
/** Vía por la que el pedido llega a ser elegible (recuperacion-ordenes-por-surtir-por-rol). */
export type Via = 'local' | 'liberado' | 'automatico';
export type Rol = 1 | 2;

/** Pedido de la cola por surtir. Cada código del arreglo es una partida. */
export type PedidoCola = {
  folio: number;
  /**
   * Posición que le da el procesador de ordenamiento (1 = primero), por holgura o, con
   * `Bandera_OrdenamientoPrioridadV2`, por ponderación. Dos pedidos con la misma posición están empatados.
   */
  orden: number;
  /** Fecha y hora de creación (registro o petición), "AAAA-MM-DD HH:MM". */
  creado: string;
  codigos: string[];
  /** `null`: el pedido no tiene definido si es local o foráneo. */
  servicio: Servicio | null;
  tipo: TipoPedido;
  /** Dirección de entrega. */
  direccion: string;
  /** Retenido, por cualquier causa (clarificación 36). */
  retenido?: boolean;
  /** Causa de la retención, solo para mostrarla: el sistema no las distingue. */
  retencion?: 'manual' | 'automatica';
  /** Cancelado: no llega a la cola de pedidos por surtir. */
  cancelado?: boolean;
  /** Parte de una factura dividida por montos. */
  division?: { id: string; parte: number };
  /** Tiempo estimado de surtido, en minutos. */
  minutos: number;
  /** Solo se muestra: la zona no influye en el orden. */
  zona?: string;
  /** Sin zona asignada: no es elegible por las vías que exigen zona. */
  sinZona?: boolean;
  /** Pedido corporativo (se evalúa con las mismas reglas que los demás). */
  corporativo?: boolean;
  /** Dato que le falta al pedido: no es candidato y, si es el ancla, se surte solo. */
  faltaDato?: 'número de pedido' | 'número de cliente' | 'nombre de cliente';
  /** Vencido (bloque de vencidos de la cola). */
  vencido?: boolean;
  /** Vía de elegibilidad. Sin valor: orden local activa. */
  via?: Via;
  /** Congelado por existencia (vía local). */
  congelado?: boolean;
  /** Liberado ya marcado como surtido. */
  surtido?: boolean;
  /** Candidato automático ya enviado al handheld. */
  enviadoHH?: boolean;
  /** Fecha de reparto más su hora máxima de reparto, "AAAA-MM-DD HH:MM". Sin valor: no la tiene. */
  reparto?: string;
  /** La orden puede sumarse a un embarque existente. */
  sugeridoEmbarque?: boolean;
};

/** Banderas de la sucursal que intervienen en el armado. */
export type BanderasArmado = {
  /** Ruta de armado: activa = por servicio (`RecuperarOrdenSurtidoAPI`); inactiva = por SP (`OrdenesporSurtir`). */
  RondaOrdenesSurtidoAPI: boolean;
  /** Criterio del procesador de ordenamiento: activa = ponderación V2; inactiva = holgura. Solo se muestra. */
  Bandera_OrdenamientoPrioridadV2: boolean;
  Bandera_MultipedidoEnHH: boolean;
  /** Listado en HH: precondición del multipedido V2. */
  BanderaListadoDeProductosEnHH: boolean;
  BndRondaXPedido: boolean;
  Bandera_MultipedidoMismaDireccion: boolean;
  Bandera_MultipedidoValidarCodigos: boolean;
  Bandera_MultipedidoTopePartidas: boolean;
  Bandera_MultipedidoTraspasos: boolean;
  /** La lee la HH (Detalle de la ronda); el armado no. */
  Bandera_MultipedidoMismoCliente: boolean;
  BndUnificarRondasMontos: boolean;
  /** Atención de pedidos foráneos en handheld (candidatos foráneos automáticos). */
  Bnd_AtencionHH_PedidosForaneos: boolean;
};

export type ConfigSucursal = BanderasArmado & {
  /** Número de sucursal, solo para mostrarlo (los parámetros son por sucursal). */
  sucursal?: number;
  /** Banderas que la sucursal no tiene asignadas: cuentan como inactivas (van en `false`). */
  sinAsignar?: (keyof BanderasArmado)[];
  /**
   * Momento en que se entra a la ventana de tareas ("AAAA-MM-DD HH:MM"): la ronda se arma entonces, con los
   * pedidos que ya están en la cola. Los creados después no son candidatos. Sin valor: toda la cola cuenta.
   */
  momentoVentana?: string;
  /** `Parametro_MultipedidoMaxPedidos`. 0 o sin valor: sin configurar (no se evalúan candidatos). Alta: 3. */
  maxPedidos?: number | null;
  /** `Parametro_MultipedidoMaxPartidas` (cuenta solo con su bandera). 0 o sin valor: sin configurar. Alta: 15. */
  maxPartidas?: number | null;
  /**
   * Tiempo máximo de la franja horaria, en minutos (`TiempoEstablecidoSurtido`). Con el multipedido V2 ya no deja
   * fuera a nadie: si un candidato cumple todo lo demás, la franja de la ronda se amplía. Sin el multipedido V2 es
   * el presupuesto total de la ronda normal.
   */
  minutosFranja: number;
  /** La sucursal no tiene registrada ninguna configuración de ordenamiento (AdminOPS): no recibe rondas, como hoy. */
  sinConfiguracionOrdenamiento?: boolean;
  /** Rol de quien pide la ronda. 2 = almacenista. Sin valor: 1. */
  rol?: Rol;
  /** Hora actual, para el tiempo disponible al reparto ("AAAA-MM-DD HH:MM"). */
  ahora?: string;
  /** Se alcanzó la hora límite de paquetería. */
  paqueteria?: boolean;
  /** Porcentaje de documentos foráneos de la sucursal (0 a 1), para repartir el presupuesto. Sin valor: 0. */
  porcentajeForaneo?: number;
  /** Modo de atención masiva de vencidos. */
  modoMasivoVencidos?: boolean;
};

export const NOMBRES_BANDERAS: (keyof BanderasArmado)[] = [
  'RondaOrdenesSurtidoAPI',
  'Bandera_OrdenamientoPrioridadV2',
  'Bandera_MultipedidoEnHH',
  'BanderaListadoDeProductosEnHH',
  'BndRondaXPedido',
  'Bandera_MultipedidoMismaDireccion',
  'Bandera_MultipedidoValidarCodigos',
  'Bandera_MultipedidoTopePartidas',
  'Bandera_MultipedidoTraspasos',
  'Bandera_MultipedidoMismoCliente',
  'BndUnificarRondasMontos',
  'Bnd_AtencionHH_PedidosForaneos',
];

/** Las seis banderas del multipedido V2 que se registran en el catálogo (catalogo-bandera-sucursal). */
export const BANDERAS_MULTIPEDIDO: (keyof BanderasArmado)[] = [
  'Bandera_MultipedidoEnHH',
  'Bandera_MultipedidoValidarCodigos',
  'Bandera_MultipedidoTopePartidas',
  'Bandera_MultipedidoMismoCliente',
  'Bandera_MultipedidoMismaDireccion',
  'Bandera_MultipedidoTraspasos',
];

/** Valores que fija el alta de una sucursal para el multipedido V2 (configuracion-ronda-multipedido). */
export const MAX_PEDIDOS_ALTA = 3;
export const MAX_PARTIDAS_ALTA = 15;

/**
 * Configuración de ejemplo de la demo: una sucursal con armado por servicio, listado en HH y el **alta** del
 * multipedido V2 (EnHH, ValidarCodigos, TopePartidas y MismoCliente asignadas; MismaDireccion y Traspasos sin
 * asignar; 3 pedidos y 15 partidas). Las banderas que ya existen hoy (`BndRondaXPedido`, `BndUnificarRondasMontos`,
 * atención foránea) van inactivas y cada escenario las enciende cuando las necesita. La franja de 30 min es un ejemplo.
 */
export const CONFIG_INICIAL: ConfigSucursal = {
  RondaOrdenesSurtidoAPI: true,
  Bandera_OrdenamientoPrioridadV2: false,
  Bandera_MultipedidoEnHH: true,
  BanderaListadoDeProductosEnHH: true,
  BndRondaXPedido: false,
  Bandera_MultipedidoMismaDireccion: false,
  Bandera_MultipedidoValidarCodigos: true,
  Bandera_MultipedidoTopePartidas: true,
  Bandera_MultipedidoTraspasos: false,
  Bandera_MultipedidoMismoCliente: true,
  BndUnificarRondasMontos: false,
  Bnd_AtencionHH_PedidosForaneos: false,
  sinAsignar: ['Bandera_MultipedidoMismaDireccion', 'Bandera_MultipedidoTraspasos'],
  maxPedidos: MAX_PEDIDOS_ALTA,
  maxPartidas: MAX_PARTIDAS_ALTA,
  minutosFranja: 30,
};

/** Cómo se arma la ronda. */
export type ModoArmado = 'actual' | 'multipedido' | 'paqueteria' | 'embarque' | 'almacenista' | 'sin-rondas';

export type ResultadoRegla = 'cumple' | 'no-cumple' | 'no-aplica';
export type ReglaEvaluada = { regla: string; resultado: ResultadoRegla; detalle: string };

export type EstadoCandidato = 'integrado' | 'rechazado' | 'sin-evaluar';

export type EvaluacionCandidato = {
  pedido: PedidoCola;
  estado: EstadoCandidato;
  /** La regla que decidió, en español. */
  motivo: string;
  /** Todas las reglas revisadas, para mostrarlas en pantalla. Vacío si no se evaluó. */
  reglas: ReglaEvaluada[];
};

/** Ruta de armado de la sucursal. */
export type RutaArmado = 'servicio' | 'sp';

export type ResultadoArmado = {
  modo: ModoArmado;
  ruta: RutaArmado;
  /** El multipedido V2 está activo en la sucursal (EnHH + listado, ruta por servicio). */
  v2: boolean;
  explicacionModo: string;
  /** Mensaje con que responde el servicio. */
  mensaje: string;
  /** La cola en el orden en que se atiende. */
  cola: PedidoCola[];
  /** Pedidos que no llegan a la cola, con el motivo. */
  fueraDeCola: { pedido: PedidoCola; motivo: string }[];
  ancla: PedidoCola | null;
  /** Candidatos dentro de la ventana, en el orden en que se evaluaron. */
  evaluados: EvaluacionCandidato[];
  /** Pedidos que quedaron fuera de la ventana: no se evaluaron para esta ronda. */
  fueraDeVentana: PedidoCola[];
  /** La ronda final, en orden (A, B, C… / números de orden 1, 2, 3…). */
  ronda: PedidoCola[];
  totalPartidas: number;
  totalMinutos: number;
  /** Tiempo máximo de la franja configurado en la sucursal. */
  minutosFranja: number;
  /** Franja de la ronda: la configurada o, si los pedidos integrados la superan, la ampliada para que quepan. */
  minutosFranjaRonda: number;
  /** `null`: sin configurar (0 o sin valor). */
  maxPedidos: number | null;
  maxPartidas: number | null;
  /** Sin el multipedido V2, en la ruta por servicio: cómo se repartió el presupuesto. */
  presupuesto?: { foraneo: number; local: number; localRestante: number; foraneoRestante: number };
  notas: string[];
};

const etiquetaServicio = (s: Servicio | null) => (s === 'local' ? 'local' : s === 'foraneo' ? 'foráneo' : 'sin servicio definido');
const etiquetaTipo = (t: TipoPedido) =>
  t === 'cliente' ? 'pedido de cliente' : t === 'traspaso' ? 'traspaso' : t === 'balanceo' ? 'balanceo' : 'documento de otro tipo';

/** 0, `null` o sin valor: el parámetro está sin configurar. */
export const sinConfigurar = (v: number | null | undefined) => v === undefined || v === null || v === 0;

/** El multipedido V2 está activo: EnHH y listado en HH, en una sucursal que arma por servicio. */
export const v2Activo = (c: ConfigSucursal) =>
  c.Bandera_MultipedidoEnHH && c.BanderaListadoDeProductosEnHH && c.RondaOrdenesSurtidoAPI;

/** Banderas del multipedido V2 que la sucursal reporta habilitadas al consultar el catálogo. */
export function banderasReportadas(c: ConfigSucursal): (keyof BanderasArmado)[] {
  return BANDERAS_MULTIPEDIDO.filter((b) => c[b] && !c.sinAsignar?.includes(b));
}

/**
 * Revisión del alta de la sucursal para el multipedido V2 (configuracion-ronda-multipedido · "Alta de una sucursal"):
 * el alta se da por buena con el listado en HH, las cuatro banderas asignadas y los dos parámetros configurados.
 */
export function revisarAlta(c: ConfigSucursal): { completa: boolean; faltan: string[] } {
  const faltan: string[] = [];
  const asignada = (b: keyof BanderasArmado) => c[b] && !c.sinAsignar?.includes(b);
  if (!asignada('BanderaListadoDeProductosEnHH')) faltan.push('BanderaListadoDeProductosEnHH (precondición)');
  for (const b of [
    'Bandera_MultipedidoEnHH',
    'Bandera_MultipedidoValidarCodigos',
    'Bandera_MultipedidoTopePartidas',
    'Bandera_MultipedidoMismoCliente',
  ] as const) {
    if (!asignada(b)) faltan.push(b);
  }
  if (sinConfigurar(c.maxPedidos)) faltan.push('Parametro_MultipedidoMaxPedidos');
  if (sinConfigurar(c.maxPartidas)) faltan.push('Parametro_MultipedidoMaxPartidas');
  return { completa: faltan.length === 0, faltan };
}

/**
 * Orden de la cola: el del procesador de ordenamiento; solo en un empate de ese orden, creación más antigua, menos
 * partidas y folio menor. La zona no cuenta.
 */
export function ordenarCola(cola: PedidoCola[]): PedidoCola[] {
  return [...cola].sort(
    (a, b) =>
      a.orden - b.orden ||
      a.creado.localeCompare(b.creado) ||
      a.codigos.length - b.codigos.length ||
      a.folio - b.folio,
  );
}

const sumaPartidas = (pedidos: PedidoCola[]) => pedidos.reduce((n, p) => n + p.codigos.length, 0);
const sumaMinutos = (pedidos: PedidoCola[]) => pedidos.reduce((n, p) => n + p.minutos, 0);
const minutosEntre = (desde: string, hasta: string) =>
  (Date.parse(hasta.replace(' ', 'T')) - Date.parse(desde.replace(' ', 'T'))) / 60000;

const MSG_LISTA = 'Se obtuvo la lista correctamente';
const MSG_PAQUETERIA = 'Se genero ronda unicamente de pedidos foraneos para paqueteria';
const MSG_EMBARQUE = 'Se sugirieron documentos a embarques existentes correctamente';
const MSG_SIN_DOCUMENTOS = 'No se encontraron documentos para ordenar';
const MSG_SIN_ORDENAMIENTO = 'No se han encontrado parametros de ordenamiento dentro del AdminOPS';

/**
 * Elegibilidad por vía (recuperacion-ordenes-por-surtir-por-rol). Devuelve el motivo si el pedido no llega a la cola.
 * Con el multipedido V2 activo, además: ningún cancelado ni pedido de 0 partidas ni sin servicio definido llega a la
 * cola (elegibilidad-ronda-multipedido); los retenidos solo se excluyen como candidatos, salvo en la vía automática.
 */
function motivoNoElegible(p: PedidoCola, v2: boolean): string | null {
  const via = p.via ?? 'local';
  if (via === 'local') {
    if (p.cancelado) return 'cancelado: no llega a la cola de pedidos por surtir.';
    if (p.congelado) return 'orden local congelada por existencia: no es elegible por esta vía.';
    if (p.sinZona) return 'orden local sin zona asignada: no es elegible.';
    if (v2 && p.codigos.length === 0) return 'no tiene partidas: con el multipedido V2 no llega a la cola.';
    if (v2 && p.servicio === null) return 'no tiene definido si es local o foráneo: con el multipedido V2 no llega a la cola.';
    return null;
  }
  if (via === 'liberado') {
    if (p.surtido) return 'liberado ya marcado como surtido: no es elegible.';
    if (p.sinZona) return 'liberado sin zona asignada: no es elegible.';
    if (v2 && p.cancelado) return 'liberado cancelado: con el multipedido V2 no es elegible.';
    if (v2 && p.codigos.length === 0) return 'liberado sin partidas: con el multipedido V2 no es elegible.';
    if (v2 && p.servicio === null) return 'liberado sin servicio definido (local o foráneo): con el multipedido V2 no es elegible.';
    return null;
  }
  // Vía automática: si entra o no se decide aparte (solo cuando no hay ninguna otra elegible).
  if (p.enviadoHH) return 'candidato automático ya enviado al handheld.';
  if (v2 && p.cancelado) return 'candidato automático cancelado: con el multipedido V2 no es elegible.';
  if (v2 && p.codigos.length === 0) return 'candidato automático sin partidas: con el multipedido V2 no es elegible.';
  if (v2 && p.sinZona) return 'candidato automático sin zona asignada: con el multipedido V2 no es elegible.';
  if (v2 && p.servicio === null) return 'candidato automático sin servicio definido: con el multipedido V2 no es elegible.';
  if (v2 && p.retenido)
    return 'candidato automático retenido: con el multipedido V2 la vía automática no lo propone; se surte cuando alguien lo envía a surtir manualmente.';
  return null;
}

type Armador = (modo: ModoArmado, explicacion: string, mensaje: string, ronda: PedidoCola[], extra?: Partial<ResultadoArmado>) => ResultadoArmado;

/** Arma la ronda del primero de la cola con las reglas de la sucursal. */
export function armarRonda(cola: PedidoCola[], config: ConfigSucursal): ResultadoArmado {
  const ruta: RutaArmado = config.RondaOrdenesSurtidoAPI ? 'servicio' : 'sp';
  const v2 = v2Activo(config);
  const rol: Rol = config.rol ?? 1;
  const notas: string[] = [];
  const fueraDeCola: ResultadoArmado['fueraDeCola'] = [];

  // Elegibilidad por vía y momento de la ventana de tareas.
  const elegible = (p: PedidoCola) => {
    const motivo = motivoNoElegible(p, v2);
    if (motivo) {
      fueraDeCola.push({ pedido: p, motivo });
      return false;
    }
    if (config.momentoVentana && p.creado > config.momentoVentana) {
      fueraDeCola.push({
        pedido: p,
        motivo: `se creó a las ${p.creado.slice(11)}, después de entrar a la ventana de tareas (${config.momentoVentana.slice(11)}): no es candidato de esta ronda.`,
      });
      return false;
    }
    return true;
  };
  const automaticos = cola.filter((p) => p.via === 'automatico');
  let enCola = cola.filter((p) => p.via !== 'automatico').filter(elegible);
  // Candidatos foráneos automáticos: solo si no hay ninguna orden elegible, con la atención foránea activa y fuera
  // del rol 2. Sin el multipedido V2 esta vía no filtra por estado.
  if (automaticos.length) {
    const fuera = (motivo: string) => automaticos.forEach((p) => fueraDeCola.push({ pedido: p, motivo }));
    if (enCola.length > 0) fuera('candidato automático: ya hay órdenes elegibles, no se agregan candidatos automáticos.');
    else if (!config.Bnd_AtencionHH_PedidosForaneos) fuera('candidato automático: la atención de pedidos foráneos en handheld está inactiva.');
    else if (rol === 2) fuera('candidato automático: el almacenista no recibe candidatos automáticos.');
    else enCola = automaticos.filter(elegible);
  }
  const ordenada = ordenarCola(enCola);
  const ancla = ordenada[0] ?? null;
  const maxPedidos = sinConfigurar(config.maxPedidos) ? null : (config.maxPedidos as number);
  const maxPartidas = sinConfigurar(config.maxPartidas) ? null : (config.maxPartidas as number);

  const resultado: Armador = (modo, explicacionModo, mensaje, ronda, extra = {}) => ({
    modo,
    ruta,
    v2,
    explicacionModo,
    mensaje,
    cola: ordenada,
    fueraDeCola,
    ancla: ronda[0] ?? ancla,
    evaluados: [],
    fueraDeVentana: [],
    ronda,
    totalPartidas: sumaPartidas(ronda),
    totalMinutos: sumaMinutos(ronda),
    minutosFranja: config.minutosFranja,
    minutosFranjaRonda: config.minutosFranja,
    maxPedidos,
    maxPartidas,
    notas,
    ...extra,
  });

  // 0. Configuración previa obligatoria: sin configuración de ordenamiento no hay rondas, como hoy.
  if (config.sinConfiguracionOrdenamiento) {
    notas.push('Es una configuración previa obligatoria: el multipedido V2 no la cambia (clarificación 8 de configuración).');
    return resultado(
      'sin-rondas',
      'La sucursal no tiene registrada ninguna configuración de ordenamiento: el surtidor no recibe ronda, como hoy, con el aviso de que no hay parámetros de ordenamiento.',
      MSG_SIN_ORDENAMIENTO,
      [],
      { ancla: null },
    );
  }

  // 1. Almacenista (rol 2): solo balanceos, uno por ronda y elegido como hoy; nunca ronda multipedido V2.
  if (rol === 2) {
    const balanceos = ordenada.filter((p) => p.tipo === 'balanceo');
    for (const p of ordenada.filter((x) => x.tipo !== 'balanceo')) {
      fueraDeCola.push({ pedido: p, motivo: `es ${etiquetaTipo(p.tipo)}: el almacenista (rol 2) solo recibe balanceos.` });
    }
    const unoPorRonda = config.BndRondaXPedido || v2;
    const elegido = unoPorRonda ? elegirTraspaso(balanceos) : null;
    const ronda = unoPorRonda ? (elegido ? [elegido] : []) : balanceos;
    if (elegido) {
      notas.push(
        `Se elige el balanceo con menos tiempo disponible al reparto (${elegido.reparto ? `reparto ${elegido.reparto.slice(11)}` : `sin fecha límite: se usa la de la petición, ${elegido.creado.slice(11)}`}), como hoy.`,
      );
    }
    return resultado(
      'almacenista',
      `Almacenista (rol 2): recibe solo balanceos${unoPorRonda ? ', uno por ronda y elegido como hoy' : ''}. No se forma ronda multipedido V2${v2 ? ' aunque esté activo en la sucursal' : ''}.`,
      ronda.length ? MSG_LISTA : MSG_SIN_DOCUMENTOS,
      ronda,
      { cola: balanceos },
    );
  }

  // 2. Paquetería: con la hora límite alcanzada y foráneos elegibles, la ronda es solo de foráneos, con o sin V2.
  const foraneos = ordenada.filter((p) => p.servicio === 'foraneo');
  if (config.paqueteria && foraneos.length) {
    return resultado(
      'paqueteria',
      `Se alcanzó la hora límite de paquetería: la ronda contiene solo pedidos foráneos, como hoy${v2 ? ', igual que sin el multipedido V2' : ''}.`,
      MSG_PAQUETERIA,
      foraneos,
    );
  }

  // 3. Sugerencia a embarques existentes.
  const sugeridos = ordenada.filter((p) => p.sugeridoEmbarque);
  if (sugeridos.length) {
    return resultado(
      'embarque',
      'Hay órdenes que pueden sumarse a un embarque existente: la respuesta lleva las órdenes sugeridas a embarque, como hoy, y no una ronda multipedido V2.',
      MSG_EMBARQUE,
      sugeridos,
    );
  }

  // 4. Sin el multipedido V2: el armado actual de la ruta.
  if (!v2) {
    const causa = !config.Bandera_MultipedidoEnHH
      ? 'Bandera_MultipedidoEnHH inactiva'
      : !config.BanderaListadoDeProductosEnHH
        ? 'BanderaListadoDeProductosEnHH inactiva (sin listado en HH no hay multipedido V2)'
        : 'Sucursal sin RondaOrdenesSurtidoAPI (Bandera_MultipedidoEnHH solo se activa en la ruta por servicio)';
    if (ruta === 'sp') {
      notas.push('El simulador no reproduce el armado por SP: solo muestra que el multipedido V2 no interviene.');
      return resultado(
        'actual',
        `${causa}: la ronda se arma con el armado actual por SP (OrdenesporSurtir: preferencia por la zona, hasta 6 documentos y tiempo de la franja), y se surte como hoy. No se evalúan candidatos multipedido V2.`,
        MSG_LISTA,
        ancla ? [ancla] : [],
      );
    }
    return armarActual(ordenada, config, causa, resultado, notas);
  }

  // 5. Multipedido V2.
  if (!ancla) {
    return resultado(
      'multipedido',
      'Al entrar a la ventana de tareas no hay pedidos por surtir: no se arma ninguna ronda y la ventana se comporta como hoy cuando no hay tareas.',
      MSG_LISTA,
      [],
    );
  }

  const multipedido =
    'Multipedido V2 activo (Bandera_MultipedidoEnHH y BanderaListadoDeProductosEnHH): la ronda se arma al entrar a la ventana de tareas, con las reglas del multipedido V2, en lugar del armado actual por servicio.' +
    (config.BndRondaXPedido ? ' BndRondaXPedido activa no impide evaluar candidatos: solo si ninguno cumple, el ancla se surte en su propia ronda.' : '');
  const solo = (nota: string) => {
    notas.push(nota);
    return resultado('multipedido', multipedido, MSG_LISTA, [ancla], {
      fueraDeVentana: ordenada.slice(1),
      minutosFranjaRonda: Math.max(config.minutosFranja, ancla.minutos),
    });
  };

  // El ancla que no puede formar ronda multipedido se surte sola, como hoy.
  if (ancla.retenido) {
    return solo(
      `${ancla.folio} está retenido: solo llega a surtirse cuando alguien lo envía a surtir manualmente desde Exodus Sucursales. Entonces no se evalúan candidatos y se surte en su propia ronda, como hoy, con la configuración y las banderas que tenga la sucursal en ese momento.`,
    );
  }
  if (ancla.tipo === 'balanceo') {
    return solo(
      `${ancla.folio} es un balanceo: se surte por el flujo de hoy, sin candidatos. Los balanceos nunca entran a una ronda multipedido V2 y ningún pedido de cliente recibe tareas de balanceo.`,
    );
  }
  if (ancla.faltaDato) {
    return solo(`${ancla.folio} no tiene ${ancla.faltaDato}: se surte solo, como pedido único, y no se le integran candidatos.`);
  }

  const ronda: PedidoCola[] = [ancla];
  const evaluados: EvaluacionCandidato[] = [];

  // División de factura por montos (se evalúa primero): con la bandera, todas las partes del ancla entran juntas,
  // aunque superen topes o el máximo esté sin configurar, y no se evalúan más candidatos.
  const divisionAncla = config.BndUnificarRondasMontos ? ancla.division : undefined;
  if (divisionAncla) {
    for (const p of ordenada.slice(1)) {
      if (p.division?.id !== divisionAncla.id) continue;
      ronda.push(p);
      evaluados.push({
        pedido: p,
        estado: 'integrado',
        motivo: `Parte ${p.division.parte} de la factura ${divisionAncla.id}: entra junto con el ancla (BndUnificarRondasMontos), aunque se superen el máximo de pedidos y el tope de partidas.`,
        reglas: [],
      });
    }
    notas.push(`El ancla viene de la división ${divisionAncla.id}: esa regla prevalece y no se evalúan más candidatos.`);
  }

  // Parámetros sin configurar: no se evalúan candidatos y cada pedido sale en su propia ronda.
  const topeActivo = config.Bandera_MultipedidoTopePartidas;
  const candidatosApagados = maxPedidos === null || (topeActivo && maxPartidas === null);
  if (candidatosApagados && !divisionAncla) {
    const cual =
      maxPedidos === null
        ? 'Parametro_MultipedidoMaxPedidos está en 0 o sin configurar'
        : 'Parametro_MultipedidoMaxPartidas está en 0 o sin configurar con Bandera_MultipedidoTopePartidas activa';
    notas.push(`${cual}: no se evalúan candidatos; cada pedido sale en su propia ronda y el armado sigue con el siguiente pedido, sin detenerse.`);
  }
  if (!topeActivo && sinConfigurar(config.maxPartidas)) {
    notas.push('Con Bandera_MultipedidoTopePartidas inactiva, el valor del tope no cuenta: no hay límite de partidas.');
  }

  const restantes = ordenada.slice(1).filter((p) => !ronda.includes(p));
  const lugares = divisionAncla || candidatosApagados ? 0 : Math.max(0, (maxPedidos as number) - ronda.length);
  const ventana = restantes.slice(0, lugares);
  const fueraDeVentana = restantes.slice(lugares);

  if (topeActivo && maxPartidas !== null && sumaPartidas([ancla]) > maxPartidas) {
    notas.push(`El ancla tiene ${ancla.codigos.length} partidas, más que el tope de ${maxPartidas}: se surte, pero ningún candidato cabe.`);
  }

  // La ventana es fija: un candidato que no cumple conserva su lugar y no se sustituye con el siguiente de la
  // cola. La ronda que se arma es la que la HH recibe al tomar la tarea.
  for (const c of ventana) {
    const reglas = evaluarCandidato(c, ancla, ronda, config, maxPartidas);
    const falla = reglas.find((r) => r.resultado === 'no-cumple');
    if (falla) {
      evaluados.push({ pedido: c, estado: 'rechazado', motivo: `${falla.regla}: ${falla.detalle}`, reglas });
      continue;
    }
    ronda.push(c);
    evaluados.push({ pedido: c, estado: 'integrado', motivo: 'Cumple las restricciones y todos los criterios activos.', reglas });
  }

  // Tiempo de la franja: no deja fuera a ningún candidato que cumpla lo demás; la franja de la ronda se amplía.
  const totalMinutos = sumaMinutos(ronda);
  const minutosFranjaRonda = Math.max(config.minutosFranja, totalMinutos);
  if (minutosFranjaRonda > config.minutosFranja) {
    notas.push(`La franja de la ronda se amplió de ${config.minutosFranja} a ${minutosFranjaRonda} min para que entraran los pedidos que cumplen las demás reglas.`);
  }

  if (ronda.length === 1 && evaluados.length > 0) {
    notas.push(
      `Ningún candidato cumple: ${ancla.folio} se surte solo, igual que hoy${config.BndRondaXPedido ? ', en su propia ronda (lo que exige BndRondaXPedido)' : ''}.`,
    );
  }
  const divisiones = new Set(
    evaluados.filter((e) => e.estado === 'rechazado' && e.pedido.division && config.BndUnificarRondasMontos).map((e) => e.pedido.division!.id),
  );
  for (const id of divisiones) notas.push(`Las partes de la factura ${id} se surten juntas en su propia ronda.`);
  if (ventana.length === 0 && !divisionAncla && !candidatosApagados) notas.push(`No hay candidatos en la ventana: ${ancla.folio} se surte solo.`);
  const rechazados = evaluados.filter((e) => e.estado !== 'integrado').map((e) => e.pedido.folio);
  if (rechazados.length && ronda.length > 1) {
    notas.push(`${rechazados.join(', ')} se surte${rechazados.length > 1 ? 'n' : ''} solo${rechazados.length > 1 ? 's' : ''} en su turno.`);
  }

  return resultado('multipedido', multipedido, MSG_LISTA, ronda, {
    ancla,
    evaluados,
    fueraDeVentana,
    totalMinutos,
    minutosFranjaRonda,
  });
}

/**
 * Elige la petición de traspaso o balanceo con menos tiempo disponible al reparto; sin fecha u hora máxima de
 * reparto se usa la fecha y hora de la petición. Desempate: la petición más antigua (traspasos-y-prioridad).
 */
function elegirTraspaso(pedidos: PedidoCola[]): PedidoCola | null {
  const limite = (p: PedidoCola) => p.reparto ?? p.creado;
  return [...pedidos].sort((a, b) => limite(a).localeCompare(limite(b)) || a.creado.localeCompare(b.creado))[0] ?? null;
}

/**
 * Armado actual por servicio, sin el multipedido V2 (presupuesto-de-tiempo-de-surtido y ronda por pedido, canónicas
 * observadas del servicio). El presupuesto total es el tiempo de la franja; se reserva para foráneos el porcentaje de
 * la sucursal y el resto queda para locales.
 */
function armarActual(ordenada: PedidoCola[], config: ConfigSucursal, causa: string, resultado: Armador, notas: string[]): ResultadoArmado {
  const total = config.minutosFranja;
  const foraneo = total * (config.porcentajeForaneo ?? 0);
  const local = total - foraneo;
  let foraneoRestante = foraneo;
  let localRestante = local;
  const seleccion: PedidoCola[] = [];
  const vencidos = ordenada.filter((p) => p.vencido);
  const foraneos = ordenada.filter((p) => !p.vencido && p.servicio === 'foraneo');
  const locales = ordenada.filter((p) => !p.vencido && p.servicio !== 'foraneo');

  if (config.modoMasivoVencidos && vencidos.length) {
    // Modo masivo: solo vencidos que quepan en el presupuesto local; no entran foráneos ni no vencidos.
    for (const p of vencidos) {
      if (p.minutos <= localRestante) {
        seleccion.push(p);
        localRestante -= p.minutos;
      } else notas.push(`${p.folio} (vencido, ${p.minutos} min) no cabe en los ${localRestante} min locales restantes.`);
    }
    notas.push('Modo masivo de vencidos: la ronda lleva solo vencidos, aunque haya no vencidos pendientes y sobre presupuesto.');
  } else {
    // Foráneos primero, en su parte del presupuesto.
    for (const p of foraneos) {
      if (p.minutos <= foraneoRestante) {
        seleccion.push(p);
        foraneoRestante -= p.minutos;
      } else notas.push(`${p.folio} (foráneo, ${p.minutos} min) no cabe en los ${foraneoRestante} min foráneos restantes: no entra.`);
    }
    // Sobrante foráneo a locales, si hay locales por evaluar.
    if ((locales.length || vencidos.length) && foraneoRestante > 0) {
      notas.push(`Sobran ${foraneoRestante} min foráneos: pasan al presupuesto local (${localRestante} + ${foraneoRestante} = ${localRestante + foraneoRestante} min).`);
      localRestante += foraneoRestante;
      foraneoRestante = 0;
    }
    // Primer vencido sin verificar que quepa.
    if (vencidos.length) {
      const v = vencidos[0];
      seleccion.push(v);
      localRestante -= v.minutos;
      notas.push(`El vencido de mayor prioridad, ${v.folio}, entra sin verificar que quepa; el presupuesto local queda en ${localRestante} min.`);
    }
    for (const p of locales) {
      if (p.minutos <= localRestante) {
        seleccion.push(p);
        localRestante -= p.minutos;
      } else notas.push(`${p.folio} (local, ${p.minutos} min) no cabe en los ${localRestante} min locales restantes: se omite y se sigue con los siguientes.`);
    }
  }

  const presupuesto = { foraneo, local, localRestante, foraneoRestante };
  const explicacion = `${causa}: la ronda se arma con el armado actual por servicio (RecuperarOrdenSurtidoAPI): orden del procesador de ordenamiento y llenado por el presupuesto de tiempo (${total} min: ${foraneo} foráneos y ${local} locales), sin tope de documentos ni preferencia por zona. No se evalúan candidatos multipedido V2.`;

  if (!config.BndRondaXPedido) return resultado('actual', explicacion, MSG_LISTA, seleccion, { presupuesto });

  // Ronda por pedido: una sola orden, elegida entre las seleccionadas.
  const ventas = seleccion.filter((p) => p.tipo === 'cliente');
  const traspasos = seleccion.filter((p) => p.tipo === 'traspaso' || p.tipo === 'balanceo');
  let elegido: PedidoCola | null = null;
  if (ventas.length) {
    const ahora = config.ahora ?? '2026-11-09 10:00';
    const disponible = (p: PedidoCola) => (p.reparto ? minutosEntre(ahora, p.reparto) : Number.POSITIVE_INFINITY);
    elegido = [...ventas].sort((a, b) => disponible(a) - disponible(b) || a.creado.localeCompare(b.creado))[0];
    notas.push(
      `BndRondaXPedido: entre las ${seleccion.length} órdenes seleccionadas se elige un pedido de venta (antes que cualquier traspaso), el de menos tiempo disponible al reparto: ${elegido.folio}${elegido.reparto ? ` (${disponible(elegido)} min)` : ''}.`,
    );
  } else if (traspasos.length) {
    elegido = elegirTraspaso(traspasos);
    notas.push(
      `BndRondaXPedido: solo hay traspasos; se elige la petición con menos tiempo disponible al reparto: ${elegido!.folio} (${elegido!.reparto ? `límite ${elegido!.reparto.slice(11)}` : `sin fecha límite: se usa la de la petición, ${elegido!.creado.slice(11)}`}).`,
    );
  }
  if (!elegido) {
    notas.push('BndRondaXPedido: ninguna orden seleccionada es pedido de venta ni traspaso.');
    return resultado('actual', explicacion, MSG_SIN_DOCUMENTOS, [], { presupuesto });
  }
  return resultado('actual', explicacion, MSG_LISTA, [elegido], { presupuesto });
}

const REGLA_TIEMPO = 'Tiempo de la franja';

/** Revisa todas las reglas de un candidato contra la ronda que lleva acumulada. */
function evaluarCandidato(
  c: PedidoCola,
  ancla: PedidoCola,
  ronda: PedidoCola[],
  config: ConfigSucursal,
  maxPartidas: number | null,
): ReglaEvaluada[] {
  const reglas: ReglaEvaluada[] = [];

  reglas.push(
    c.retenido
      ? {
          regla: 'Retención',
          resultado: 'no-cumple',
          detalle: `retenido${c.retencion === 'automatica' ? ' por crédito (retención automática)' : c.retencion === 'manual' ? ' manualmente' : ''}; un retenido, por cualquier causa, no se evalúa para multipedido V2.`,
        }
      : { regla: 'Retención', resultado: 'cumple', detalle: 'no está retenido.' },
  );

  reglas.push(
    c.faltaDato
      ? { regla: 'Datos del pedido', resultado: 'no-cumple', detalle: `no tiene ${c.faltaDato}: no entra a rondas multipedido.` }
      : { regla: 'Datos del pedido', resultado: 'cumple', detalle: 'tiene número de pedido, número y nombre de cliente.' },
  );

  reglas.push(
    c.servicio === ancla.servicio
      ? { regla: 'Mismo servicio', resultado: 'cumple', detalle: `${etiquetaServicio(c.servicio)}, igual que el ancla.` }
      : {
          regla: 'Mismo servicio',
          resultado: 'no-cumple',
          detalle: `es ${etiquetaServicio(c.servicio)} y el ancla es ${etiquetaServicio(ancla.servicio)}.`,
        },
  );

  const inactiva = (b: keyof BanderasArmado) =>
    config.sinAsignar?.includes(b) ? `${b} sin asignar: cuenta como inactiva` : `${b} inactiva`;

  if (c.tipo === 'cliente') {
    reglas.push({ regla: 'Tipo de pedido', resultado: 'cumple', detalle: c.corporativo ? 'pedido corporativo: se evalúa con las mismas reglas que los demás.' : 'pedido de cliente.' });
  } else if (c.tipo === 'balanceo') {
    reglas.push({
      regla: 'Tipo de pedido',
      resultado: 'no-cumple',
      detalle: `es balanceo: los balanceos nunca entran a una ronda multipedido V2${config.Bandera_MultipedidoTraspasos ? ', aunque Bandera_MultipedidoTraspasos esté activa' : ''}.`,
    });
  } else if (c.tipo === 'traspaso' && config.Bandera_MultipedidoTraspasos) {
    reglas.push({ regla: 'Tipo de pedido', resultado: 'cumple', detalle: 'traspaso permitido por Bandera_MultipedidoTraspasos.' });
  } else if (c.tipo === 'traspaso') {
    reglas.push({ regla: 'Tipo de pedido', resultado: 'no-cumple', detalle: `es traspaso (${inactiva('Bandera_MultipedidoTraspasos')}).` });
  } else {
    reglas.push({ regla: 'Tipo de pedido', resultado: 'no-cumple', detalle: `es ${etiquetaTipo(c.tipo)}.` });
  }

  if (config.BndUnificarRondasMontos && c.division && c.division.id !== ancla.division?.id) {
    reglas.push({
      regla: 'División de factura',
      resultado: 'no-cumple',
      detalle: `es la parte ${c.division.parte} de la factura ${c.division.id}; con BndUnificarRondasMontos sus partes van juntas en su propia ronda.`,
    });
  }

  if (config.Bandera_MultipedidoMismaDireccion) {
    reglas.push(
      c.direccion === ancla.direccion
        ? { regla: 'Misma dirección', resultado: 'cumple', detalle: 'va a la misma dirección que el ancla.' }
        : { regla: 'Misma dirección', resultado: 'no-cumple', detalle: `va a "${c.direccion}" y el ancla a "${ancla.direccion}".` },
    );
  } else {
    reglas.push({ regla: 'Misma dirección', resultado: 'no-aplica', detalle: `no se exige (${inactiva('Bandera_MultipedidoMismaDireccion')}).` });
  }

  if (config.Bandera_MultipedidoValidarCodigos) {
    const compartidos = ronda
      .map((p) => ({ folio: p.folio, codigos: c.codigos.filter((x) => p.codigos.includes(x)) }))
      .filter((x) => x.codigos.length > 0);
    reglas.push(
      compartidos.length
        ? {
            regla: 'Código compartido',
            resultado: 'cumple',
            detalle: compartidos.map((x) => `comparte ${x.codigos.join(', ')} con ${x.folio}`).join('; ') + '.',
          }
        : { regla: 'Código compartido', resultado: 'no-cumple', detalle: 'no comparte ningún código con los pedidos ya integrados.' },
    );
  } else {
    reglas.push({ regla: 'Código compartido', resultado: 'no-aplica', detalle: `no se exige (${inactiva('Bandera_MultipedidoValidarCodigos')}).` });
  }

  const partidas = sumaPartidas(ronda);
  const conCandidato = partidas + c.codigos.length;
  if (config.Bandera_MultipedidoTopePartidas && maxPartidas !== null) {
    reglas.push(
      conCandidato <= maxPartidas
        ? { regla: 'Tope de partidas', resultado: 'cumple', detalle: `${partidas} + ${c.codigos.length} = ${conCandidato} de ${maxPartidas}.` }
        : {
            regla: 'Tope de partidas',
            resultado: 'no-cumple',
            detalle: `con sus ${c.codigos.length} partidas la ronda sumaría ${conCandidato}, más que el tope de ${maxPartidas}.`,
          },
    );
  } else {
    reglas.push({
      regla: 'Tope de partidas',
      resultado: 'no-aplica',
      detalle: `sin límite (${inactiva('Bandera_MultipedidoTopePartidas')}; el valor del tope no cuenta); la ronda sumaría ${conCandidato}.`,
    });
  }

  // Tiempo de la franja: no es motivo de rechazo. Si el candidato cumple lo demás y se pasa, la franja se amplía.
  const minutos = sumaMinutos(ronda);
  const conMinutos = minutos + c.minutos;
  const franja = Math.max(config.minutosFranja, minutos);
  reglas.push({
    regla: REGLA_TIEMPO,
    resultado: 'cumple',
    detalle:
      conMinutos <= franja
        ? `${minutos} + ${c.minutos} = ${conMinutos} de ${franja} min.`
        : `${minutos} + ${c.minutos} = ${conMinutos}, más que los ${franja} min de la franja: si cumple lo demás, la franja se amplía a ${conMinutos} min.`,
  });

  return reglas;
}

/**
 * Rondas que salen de la cola, una tras otra: se arma la ronda del primero, se quitan sus pedidos y se sigue con el
 * resto, hasta vaciar la cola. Muestra que "cada pedido sale en su propia ronda y el armado no se detiene".
 */
export function armarCola(cola: PedidoCola[], config: ConfigSucursal, limite = 20): ResultadoArmado[] {
  const rondas: ResultadoArmado[] = [];
  let resto = cola;
  for (let i = 0; i < limite; i++) {
    const r = armarRonda(resto, config);
    if (r.ronda.length === 0) break;
    rondas.push(r);
    const usados = new Set(r.ronda.map((p) => p.folio));
    resto = resto.filter((p) => !usados.has(p.folio));
  }
  return rondas;
}
