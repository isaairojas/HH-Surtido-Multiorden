/**
 * Un preset por cada escenario del armado: `sdd/changes/2026-10-26-multipedido-armado-ronda` (elegibilidad-ronda-multipedido,
 * catalogo-bandera-sucursal y los deltas del servicio en specs-servicio/) y
 * `sdd/changes/2026-11-20-multipedido-configuracion-armado` (configuracion-ronda-multipedido), con los datos que lo
 * reproducen en el simulador y lo que el spec espera. `comprobar` es la parte verificable de ese resultado: la usan las
 * pruebas y la pantalla, que marca si el simulador coincide con el spec.
 *
 * "Cancelación durante el surtido" y "Retención durante el surtido" (Requirement: Pedidos retenidos o cancelados)
 * ocurren durante el surtido de una ronda ya armada y se ven al finalizarla, así que se validan en la demo de revisión
 * multipedido, que tiene la finalización del surtido (`enListado`).
 */
import {
  armarCola,
  armarRonda,
  banderasReportadas,
  CONFIG_INICIAL,
  revisarAlta,
  type ConfigSucursal,
  type ModoArmado,
  type PedidoCola,
  type BanderasArmado,
  type ResultadoArmado,
  type RutaArmado,
} from './armado';

export type CapacidadArmado =
  | 'elegibilidad-ronda-multipedido'
  | 'catalogo-bandera-sucursal'
  | 'servicio/recuperacion-ordenes-por-surtir-por-rol'
  | 'servicio/traspasos-y-prioridad-de-peticiones'
  | 'servicio/presupuesto-de-tiempo-de-surtido'
  | 'configuracion-ronda-multipedido';

/** Cambio SDD del escenario (id corto del catálogo de la demo). */
export type CambioArmado = 'armado' | 'configuracion';

/** Lo que se puede comprobar automáticamente del resultado. Los folios van en orden. */
export type Comprobacion = {
  modo?: ModoArmado;
  ancla?: number;
  ronda?: number[];
  /** Candidatos evaluados, en el orden en que se evaluaron. */
  ordenEvaluacion?: number[];
  /** Candidatos de la ventana que no se integraron. */
  rechazados?: number[];
  fueraDeVentana?: number[];
  /** Pedidos que no llegan a la cola (cancelados o creados después de entrar a la ventana de tareas). */
  fueraDeCola?: number[];
  /** Ruta de armado de la sucursal (por servicio o por SP). */
  ruta?: RutaArmado;
  totalPartidas?: number;
  totalMinutos?: number;
  /** Franja de la ronda tras ampliarla (si hizo falta). */
  minutosFranjaRonda?: number;
  /** `null`: sin configurar. */
  maxPedidos?: number | null;
  maxPartidas?: number | null;
  /** Mensaje con que responde el servicio. */
  mensaje?: string;
  /** Banderas del multipedido V2 que la sucursal reporta habilitadas en el catálogo. */
  reportadas?: (keyof BanderasArmado)[];
  /** Resultado de la revisión del alta. */
  altaCompleta?: boolean;
  /** Rondas que salen de la cola, una tras otra (folios de cada una). */
  rondas?: number[][];
  /** Reparto del presupuesto sin el multipedido V2; `null`: no se reparte presupuesto. */
  presupuesto?: { foraneo?: number; local?: number; localRestante?: number } | null;
};

export type PresetArmado = {
  id: string;
  /** Sin valor: 'armado'. */
  cambio?: CambioArmado;
  capacidad: CapacidadArmado;
  requisito: string;
  /** Nombre exacto del escenario en el spec. */
  escenario: string;
  descripcion: string;
  /** El THEN del spec, adaptado a los datos del preset. */
  esperado: string;
  cola: PedidoCola[];
  config: ConfigSucursal;
  comprobar: Comprobacion;
  /** El escenario se valida al finalizar el surtido en la HH (demo de revisión multipedido), no en el armado. */
  enListado?: boolean;
  /** Con `enListado`: qué pasa en el listado y dónde verlo. */
  textoListado?: string;
  /**
   * Segunda sucursal del mismo escenario, cuando el spec compara dos (p. ej. "Cada sucursal con su valor"). Se
   * arma con la misma cola y su propia configuración, y se comprueba igual que la principal.
   */
  otraSucursal?: { config: ConfigSucursal; comprobar: Comprobacion };
};

/* ------------------------------------------------------------------ *
 * Datos de apoyo
 * ------------------------------------------------------------------ */

/** Código que comparten los pedidos de los escenarios, salvo cuando el escenario pide lo contrario. */
const COMUN = '0486600';
const DIR_1 = 'Av. Juárez 120, Centro';
const DIR_2 = 'Calz. del Hueso 45, Coyoacán';

/** `n` partidas: primero los códigos compartidos y luego códigos propios del pedido (7 dígitos). */
function cods(folio: number, n: number, compartidos: string[] = []): string[] {
  const propios = Array.from({ length: n - compartidos.length }, (_, i) => String(folio * 100 + i + 1).padStart(7, '0'));
  return [...compartidos, ...propios];
}

/** Pedido de cliente, local, a DIR_1, con 2 partidas (una es 0486600) y 5 minutos estimados. */
function ped(folio: number, orden: number, extra: Partial<PedidoCola> = {}): PedidoCola {
  return {
    folio,
    orden,
    creado: '2026-11-09 08:00',
    codigos: cods(folio, 2, [COMUN]),
    servicio: 'local',
    tipo: 'cliente',
    direccion: DIR_1,
    minutos: 5,
    ...extra,
  };
}

/**
 * Configuración de la sucursal a partir del alta del multipedido V2 (`CONFIG_INICIAL`). Una bandera que el escenario
 * activa deja de estar "sin asignar".
 */
const cfg = (cambios: Partial<ConfigSucursal> = {}): ConfigSucursal => {
  const c = { ...CONFIG_INICIAL, ...cambios };
  return { ...c, sinAsignar: (c.sinAsignar ?? []).filter((b) => !c[b]) };
};

/** Banderas que la sucursal no tiene asignadas (cuentan como inactivas), además de las que el alta deja sin asignar. */
const sinAsignar = (...banderas: (keyof BanderasArmado)[]): Partial<ConfigSucursal> => ({
  ...Object.fromEntries(banderas.map((b) => [b, false])),
  sinAsignar: [...new Set([...(CONFIG_INICIAL.sinAsignar ?? []), ...banderas])],
});

/** Sucursal sin el multipedido V2 (armado actual). */
const SIN_V2: Partial<ConfigSucursal> = { Bandera_MultipedidoEnHH: false };
const AHORA = '2026-11-09 10:00';
/** Hora del día 2026-11-09, "HH:MM" → "2026-11-09 HH:MM". */
const hoy = (hora: string) => `2026-11-09 ${hora}`;
/** Traspaso o balanceo (petición), local. */
const pet = (folio: number, orden: number, tipo: 'traspaso' | 'balanceo', extra: Partial<PedidoCola> = {}) =>
  ped(folio, orden, { tipo, ...extra });

const E = 'elegibilidad-ronda-multipedido' as const;
const C = 'catalogo-bandera-sucursal' as const;
const R = 'servicio/recuperacion-ordenes-por-surtir-por-rol' as const;
const T = 'servicio/traspasos-y-prioridad-de-peticiones' as const;
const P = 'servicio/presupuesto-de-tiempo-de-surtido' as const;
const K = 'configuracion-ronda-multipedido' as const;

/* ------------------------------------------------------------------ *
 * Presets
 * ------------------------------------------------------------------ */

export const PRESETS_ARMADO: PresetArmado[] = [
  /* ---- Convivencia con las rondas actuales ---- */
  {
    id: 'sin-bandera',
    capacidad: E,
    requisito: 'Convivencia con las rondas actuales',
    escenario: 'Sucursal sin la bandera',
    descripcion: 'Bandera_MultipedidoEnHH inactiva. Cola 1001, 1002 y 1003, que cumplirían todos los criterios.',
    esperado: 'La ronda se arma con el armado actual de la sucursal (por servicio) y 1001 se surte como hoy: no se evalúan candidatos multipedido V2.',
    cola: [ped(1001, 1), ped(1002, 2), ped(1003, 3)],
    config: cfg({ Bandera_MultipedidoEnHH: false }),
    comprobar: { modo: 'actual', ancla: 1001, ordenEvaluacion: [] },
  },
  {
    id: 'con-bandera',
    capacidad: E,
    requisito: 'Convivencia con las rondas actuales',
    escenario: 'Sucursal con la bandera',
    descripcion: 'Bandera_MultipedidoEnHH y BanderaListadoDeProductosEnHH activas (alta del multipedido V2). Cola 1001, 1002 y 1003, todos con 0486600.',
    esperado: 'Se aplican las reglas del multipedido V2 y no el armado actual por servicio: la ronda queda con 1001, 1002 y 1003.',
    cola: [ped(1001, 1), ped(1002, 2), ped(1003, 3)],
    config: cfg(),
    comprobar: { modo: 'multipedido', ronda: [1001, 1002, 1003], totalPartidas: 6 },
  },
  {
    id: 'sin-bandera-ruta',
    capacidad: E,
    requisito: 'Convivencia con las rondas actuales',
    escenario: 'Sin la bandera, cada sucursal sigue con su ruta',
    descripcion:
      'Bandera_MultipedidoEnHH inactiva en dos sucursales con la misma cola: 1001 (zona Z1), 1002 (Z3) y 1003 (Z1). La 8 arma por servicio (RondaOrdenesSurtidoAPI activa) y la 12 por SP. El simulador no reproduce el armado actual: solo muestra que el multipedido V2 no interviene y qué ruta sigue cada una.',
    esperado:
      'Cada sucursal se arma con el armado actual de su ruta: la 8 por servicio (sin zona) y la 12 por SP (con preferencia por zona y su configuración). En ninguna se aplican las reglas del multipedido V2.',
    cola: [ped(1001, 1, { zona: 'Z1' }), ped(1002, 2, { zona: 'Z3' }), ped(1003, 3, { zona: 'Z1' })],
    config: cfg({ sucursal: 8, Bandera_MultipedidoEnHH: false }),
    comprobar: { modo: 'actual', ruta: 'servicio', ancla: 1001, ordenEvaluacion: [] },
    otraSucursal: {
      config: cfg({ sucursal: 12, Bandera_MultipedidoEnHH: false, RondaOrdenesSurtidoAPI: false }),
      comprobar: { modo: 'actual', ruta: 'sp', ancla: 1001, ordenEvaluacion: [] },
    },
  },
  {
    id: 'al-entrar-ventana',
    capacidad: E,
    requisito: 'Convivencia con las rondas actuales',
    escenario: 'La ronda se arma al entrar a la ventana de tareas',
    descripcion:
      'Bandera_MultipedidoEnHH activa. Se entra a la ventana de tareas a las 10:00; 1001 y 1002 ya están en la cola y 1003, que cumpliría todo, se crea a las 10:05.',
    esperado: 'La ronda se arma en ese momento, con los pedidos que entonces son candidatos: queda con 1001 y 1002; 1003 todavía no es candidato.',
    cola: [
      ped(1001, 1, { creado: '2026-11-09 08:00' }),
      ped(1002, 2, { creado: '2026-11-09 09:00' }),
      ped(1003, 3, { creado: '2026-11-09 10:05' }),
    ],
    config: cfg({ momentoVentana: '2026-11-09 10:00' }),
    comprobar: { modo: 'multipedido', ronda: [1001, 1002], ordenEvaluacion: [1002], fueraDeCola: [1003] },
  },
  {
    id: 'cola-vacia',
    capacidad: E,
    requisito: 'Convivencia con las rondas actuales',
    escenario: 'Cola vacía',
    descripcion: 'Bandera_MultipedidoEnHH activa y no hay pedidos por surtir al entrar a la ventana de tareas.',
    esperado: 'No se arma ninguna ronda y la ventana se comporta como hoy cuando no hay tareas.',
    cola: [],
    config: cfg(),
    comprobar: { modo: 'multipedido', ronda: [], ordenEvaluacion: [] },
  },

  /* ---- Pedido ancla y ventana de evaluación ---- */
  {
    id: 'ventana-max-3',
    capacidad: E,
    requisito: 'Pedido ancla y ventana de evaluación',
    escenario: 'Ventana con máximo 3',
    descripcion: 'Máximo 3 pedidos. Cola en el orden del procesador de ordenamiento: 1001, 1002, 1003 y 1004.',
    esperado: 'Se evalúan 1002 y 1003 como candidatos; 1004 queda fuera de la ventana.',
    cola: [ped(1001, 1), ped(1002, 2), ped(1003, 3), ped(1004, 4)],
    config: cfg(),
    comprobar: { ordenEvaluacion: [1002, 1003], fueraDeVentana: [1004], ronda: [1001, 1002, 1003] },
  },
  {
    id: 'rechazado-no-se-sustituye',
    capacidad: E,
    requisito: 'Integrar o surtir solo',
    escenario: 'Un candidato rechazado no se sustituye',
    descripcion: 'Máximo 3 pedidos. Cola 1001, 1002, 1003 y 1004; 1002 es un traspaso (no permitido) y 1004 cumpliría todo.',
    esperado: 'La ronda queda con 1001 y 1003; 1004 no entra en lugar de 1002: queda fuera de la ventana.',
    cola: [ped(1001, 1), ped(1002, 2, { tipo: 'traspaso' }), ped(1003, 3), ped(1004, 4)],
    config: cfg(),
    comprobar: { ronda: [1001, 1003], rechazados: [1002], fueraDeVentana: [1004] },
  },
  {
    id: 'cola-corta',
    capacidad: E,
    requisito: 'Pedido ancla y ventana de evaluación',
    escenario: 'Cola más corta que el máximo',
    descripcion: 'Máximo 3 pedidos y 1001 es el último pedido de la cola.',
    esperado: 'No hay candidatos y 1001 se surte solo.',
    cola: [ped(1001, 1)],
    config: cfg(),
    comprobar: { ronda: [1001], ordenEvaluacion: [] },
  },
  {
    id: 'orden-procesador',
    capacidad: E,
    requisito: 'Pedido ancla y ventana de evaluación',
    escenario: 'Manda el orden del procesador',
    descripcion:
      'El procesador de ordenamiento (holgura) entrega 1001, 1002 y 1003, en ese orden, aunque 1003 se creó antes que 1002 (07:00 contra 09:00). La cola llega desordenada al simulador.',
    esperado: 'Se evalúa 1002 antes que 1003.',
    cola: [
      ped(1003, 3, { creado: '2026-11-09 07:00' }),
      ped(1001, 1),
      ped(1002, 2, { creado: '2026-11-09 09:00' }),
    ],
    config: cfg(),
    comprobar: { ancla: 1001, ordenEvaluacion: [1002, 1003] },
  },
  {
    id: 'empate-ancla',
    capacidad: E,
    requisito: 'Desempates del orden de la cola',
    escenario: 'Empate en el orden para el ancla',
    descripcion: '1001 y 1002 quedan empatados en el primer lugar del procesador; 1002 se creó antes (08:00 contra 09:00). 1003 va después.',
    esperado: '1002 es el ancla y 1001 se evalúa como candidato.',
    cola: [
      ped(1001, 1, { creado: '2026-11-09 09:00' }),
      ped(1002, 1, { creado: '2026-11-09 08:00' }),
      ped(1003, 2),
    ],
    config: cfg(),
    comprobar: { ancla: 1002, ordenEvaluacion: [1001, 1003] },
  },
  {
    id: 'empate-candidatos',
    capacidad: E,
    requisito: 'Desempates del orden de la cola',
    escenario: 'Empate en el orden entre candidatos',
    descripcion: '1003 y 1004 quedan empatados en el orden del procesador; 1004 se creó antes (07:30 contra 08:00).',
    esperado: 'Se evalúa 1004 antes que 1003.',
    cola: [ped(1001, 1), ped(1003, 2, { creado: '2026-11-09 08:00' }), ped(1004, 2, { creado: '2026-11-09 07:30' })],
    config: cfg(),
    comprobar: { ordenEvaluacion: [1004, 1003] },
  },
  {
    id: 'empate-partidas',
    capacidad: E,
    requisito: 'Desempates del orden de la cola',
    escenario: 'Empate en el orden y en la creación',
    descripcion: '1003 y 1004 quedan empatados en el orden del procesador y se crearon al mismo tiempo; 1003 tiene 8 partidas y 1004 tiene 3.',
    esperado: 'Se evalúa 1004 antes que 1003.',
    cola: [
      ped(1001, 1),
      ped(1003, 2, { codigos: cods(1003, 8, [COMUN]) }),
      ped(1004, 2, { codigos: cods(1004, 3, [COMUN]) }),
    ],
    config: cfg(),
    comprobar: { ordenEvaluacion: [1004, 1003] },
  },
  {
    id: 'empate-folio',
    capacidad: E,
    requisito: 'Desempates del orden de la cola',
    escenario: 'Empate en el orden, la creación y las partidas',
    descripcion: '1050 y 1032 quedan empatados en el orden del procesador, se crearon al mismo tiempo y tienen 5 partidas cada uno.',
    esperado: 'Se evalúa 1032 antes que 1050.',
    cola: [
      ped(1001, 1),
      ped(1050, 2, { codigos: cods(1050, 5, [COMUN]) }),
      ped(1032, 2, { codigos: cods(1032, 5, [COMUN]) }),
    ],
    config: cfg(),
    comprobar: { ordenEvaluacion: [1032, 1050] },
  },
  {
    id: 'zona-no-cuenta',
    capacidad: E,
    requisito: 'Desempates del orden de la cola',
    escenario: 'La zona no cuenta',
    descripcion: '1002 y 1003 quedan empatados en el orden del procesador; 1003 está en la zona del ancla (Z1) y 1002 se creó antes.',
    esperado: 'Se evalúa 1002 antes que 1003.',
    cola: [
      ped(1001, 1, { zona: 'Z1' }),
      ped(1003, 2, { zona: 'Z1', creado: '2026-11-09 08:00' }),
      ped(1002, 2, { zona: 'Z3', creado: '2026-11-09 07:00' }),
    ],
    config: cfg(),
    comprobar: { ordenEvaluacion: [1002, 1003] },
  },

  /* ---- Integrar o surtir solo ---- */
  {
    id: 'un-candidato-no-cumple',
    capacidad: E,
    requisito: 'Integrar o surtir solo',
    escenario: 'Un candidato no cumple',
    descripcion: '1001 es el ancla; 1002 no comparte ningún código (criterio activo) y 1003 cumple todo.',
    esperado: 'La ronda queda con 1001 y 1003, y 1002 se surte solo en su turno.',
    cola: [ped(1001, 1), ped(1002, 2, { codigos: cods(1002, 2) }), ped(1003, 3)],
    config: cfg(),
    comprobar: { ronda: [1001, 1003], rechazados: [1002] },
  },
  {
    id: 'ningun-candidato',
    capacidad: E,
    requisito: 'Integrar o surtir solo',
    escenario: 'Ningún candidato cumple',
    descripcion: 'Ni 1002 ni 1003 comparten códigos con 1001.',
    esperado: '1001 se surte solo, igual que hoy.',
    cola: [ped(1001, 1), ped(1002, 2, { codigos: cods(1002, 2) }), ped(1003, 3, { codigos: cods(1003, 2) })],
    config: cfg(),
    comprobar: { ronda: [1001], rechazados: [1002, 1003] },
  },

  /* ---- Mismo servicio ---- */
  {
    id: 'servicios-distintos',
    capacidad: E,
    requisito: 'Mismo servicio',
    escenario: 'Servicios distintos',
    descripcion: 'El ancla 1001 es local y el candidato 1002 es foráneo.',
    esperado: '1002 no se integra.',
    cola: [ped(1001, 1), ped(1002, 2, { servicio: 'foraneo' })],
    config: cfg(),
    comprobar: { ronda: [1001], rechazados: [1002] },
  },
  {
    id: 'mismo-servicio',
    capacidad: E,
    requisito: 'Mismo servicio',
    escenario: 'Mismo servicio',
    descripcion: 'El ancla 1001 y el candidato 1002 son locales y 1002 cumple las demás reglas.',
    esperado: '1002 se integra.',
    cola: [ped(1001, 1), ped(1002, 2)],
    config: cfg(),
    comprobar: { ronda: [1001, 1002] },
  },

  /* ---- Pedidos de una división de factura ---- */
  {
    id: 'division-supera-topes',
    capacidad: E,
    requisito: 'Pedidos de una división de factura',
    escenario: 'División que supera los topes',
    descripcion:
      'BndUnificarRondasMontos activa, máximo 3 pedidos y 15 partidas. El ancla 2001 es la parte 1 de la factura F-88120, dividida en 5 partes (2001 a 2005) con 22 partidas. 1010 va después en la cola.',
    esperado: 'Las 5 partes entran a la misma ronda (5 pedidos, 22 partidas).',
    cola: [
      ...[5, 5, 4, 4, 4].map((n, i) =>
        ped(2001 + i, 1, {
          creado: `2026-11-09 07:0${i + 1}`,
          codigos: cods(2001 + i, n, [COMUN]),
          division: { id: 'F-88120', parte: i + 1 },
          minutos: 4,
        }),
      ),
      ped(1010, 2),
    ],
    config: cfg({ BndUnificarRondasMontos: true }),
    comprobar: { ronda: [2001, 2002, 2003, 2004, 2005], totalPartidas: 22, fueraDeVentana: [1010] },
  },
  {
    id: 'division-desactivada',
    capacidad: E,
    requisito: 'Pedidos de una división de factura',
    escenario: 'Unificación por montos desactivada',
    descripcion: 'BndUnificarRondasMontos inactiva. El ancla 2001 es la parte 1 de la factura F-88120, dividida en 5 partes (2001 a 2005).',
    esperado:
      'Las partes se tratan como pedidos independientes, como hoy: 2002 y 2003 se evalúan como cualquier candidato y 2004 y 2005 quedan fuera de la ventana.',
    cola: [1, 2, 3, 4, 5].map((n) =>
      ped(2000 + n, 1, {
        creado: `2026-11-09 07:0${n}`,
        codigos: cods(2000 + n, 3, [COMUN]),
        division: { id: 'F-88120', parte: n },
      }),
    ),
    config: cfg({ BndUnificarRondasMontos: false }),
    comprobar: { ronda: [2001, 2002, 2003], ordenEvaluacion: [2002, 2003], fueraDeVentana: [2004, 2005] },
  },
  {
    id: 'candidato-de-division',
    capacidad: E,
    requisito: 'Pedidos de una división de factura',
    escenario: 'Candidato que es parte de una división',
    descripcion:
      'BndUnificarRondasMontos activa. El ancla 1001 no viene de una división; 2001 es la parte 1 de la factura F-77310, dividida en 3 partes (2001 a 2003). 1003 cumple todo.',
    esperado: '2001 no se integra a la ronda de 1001 (queda con 1001 y 1003) y las 3 partes de F-77310 se surten en su propia ronda.',
    cola: [
      ped(1001, 1),
      ped(2001, 2, { division: { id: 'F-77310', parte: 1 } }),
      ped(1003, 3),
      ped(2002, 4, { division: { id: 'F-77310', parte: 2 } }),
      ped(2003, 4, { division: { id: 'F-77310', parte: 3 }, creado: '2026-11-09 08:01' }),
    ],
    config: cfg({ BndUnificarRondasMontos: true }),
    comprobar: { ronda: [1001, 1003], rechazados: [2001], fueraDeVentana: [2002, 2003] },
  },

  /* ---- Tipo de pedido ---- */
  {
    id: 'traspaso-en-ventana',
    capacidad: E,
    requisito: 'Tipo de pedido',
    escenario: 'Traspaso en la ventana',
    descripcion: 'Configuración inicial (Bandera_MultipedidoTraspasos inactiva). 1002 es un traspaso; 1003 es pedido de cliente.',
    esperado: '1002 no se integra; la ronda queda con 1001 y 1003.',
    cola: [ped(1001, 1), ped(1002, 2, { tipo: 'traspaso' }), ped(1003, 3)],
    config: cfg(),
    comprobar: { ronda: [1001, 1003], rechazados: [1002] },
  },
  {
    id: 'traspasos-habilitados',
    capacidad: E,
    requisito: 'Tipo de pedido',
    escenario: 'Traspasos habilitados',
    descripcion: 'Bandera_MultipedidoTraspasos activa. 1002 es un traspaso que cumple las demás reglas.',
    esperado: '1002 se integra.',
    cola: [ped(1001, 1), ped(1002, 2, { tipo: 'traspaso' })],
    config: cfg({ Bandera_MultipedidoTraspasos: true }),
    comprobar: { ronda: [1001, 1002] },
  },

  /* ---- Criterios de afinidad ---- */
  {
    id: 'direccion-sin-codigos',
    capacidad: E,
    requisito: 'Criterios de afinidad',
    escenario: 'Solo misma dirección, sin códigos en común',
    descripcion: 'Solo Bandera_MultipedidoMismaDireccion activa. 1003 va a la misma dirección que el ancla y no comparte códigos.',
    esperado: '1003 cumple la afinidad y se integra.',
    cola: [ped(1001, 1), ped(1003, 2, { codigos: cods(1003, 2) })],
    config: cfg({ Bandera_MultipedidoMismaDireccion: true, Bandera_MultipedidoValidarCodigos: false }),
    comprobar: { ronda: [1001, 1003] },
  },
  {
    id: 'direccion-otra',
    capacidad: E,
    requisito: 'Criterios de afinidad',
    escenario: 'Solo misma dirección, otra dirección',
    descripcion: 'Solo Bandera_MultipedidoMismaDireccion activa. 1003 va a otra dirección, aunque comparte 0486600.',
    esperado: '1003 no se integra.',
    cola: [ped(1001, 1), ped(1003, 2, { direccion: DIR_2 })],
    config: cfg({ Bandera_MultipedidoMismaDireccion: true, Bandera_MultipedidoValidarCodigos: false }),
    comprobar: { ronda: [1001], rechazados: [1003] },
  },
  {
    id: 'ambas-falta-codigo',
    capacidad: E,
    requisito: 'Criterios de afinidad',
    escenario: 'Las dos activas y falta el código',
    descripcion: 'Las dos banderas de afinidad activas. 1003 va a la misma dirección que el ancla, sin compartir códigos.',
    esperado: '1003 no se integra.',
    cola: [ped(1001, 1), ped(1003, 2, { codigos: cods(1003, 2) })],
    config: cfg({ Bandera_MultipedidoMismaDireccion: true, Bandera_MultipedidoValidarCodigos: true }),
    comprobar: { ronda: [1001], rechazados: [1003] },
  },
  {
    id: 'ambas-cumplen',
    capacidad: E,
    requisito: 'Criterios de afinidad',
    escenario: 'Las dos activas y se cumplen',
    descripcion: 'Las dos banderas de afinidad activas. 1003 va a la misma dirección que el ancla y comparte 0486600 con ella.',
    esperado: '1003 cumple la afinidad y se integra.',
    cola: [ped(1001, 1), ped(1003, 2)],
    config: cfg({ Bandera_MultipedidoMismaDireccion: true, Bandera_MultipedidoValidarCodigos: true }),
    comprobar: { ronda: [1001, 1003] },
  },
  {
    id: 'codigo-con-integrado',
    capacidad: E,
    requisito: 'Criterios de afinidad',
    escenario: 'Comparte código con un candidato ya integrado',
    descripcion:
      'Solo Bandera_MultipedidoValidarCodigos activa. 1002 comparte 1394010 con el ancla 1001 y se integra; 1003 no comparte con 1001, pero sí 2389475 con 1002.',
    esperado: '1003 cumple la afinidad: la ronda queda con 1001, 1002 y 1003.',
    cola: [
      ped(1001, 1, { codigos: ['0486600', '1394010'] }),
      ped(1002, 2, { codigos: ['1394010', '2389475'] }),
      ped(1003, 3, { codigos: ['2389475', '6200401'] }),
    ],
    config: cfg(),
    comprobar: { ronda: [1001, 1002, 1003] },
  },
  {
    id: 'ninguna-afinidad',
    capacidad: E,
    requisito: 'Criterios de afinidad',
    escenario: 'Ninguna bandera de afinidad activa',
    descripcion: 'Las dos banderas de afinidad inactivas. 1003 va a otra dirección, no comparte códigos y cumple las demás reglas.',
    esperado: '1003 se integra sin evaluar dirección ni códigos.',
    cola: [ped(1001, 1), ped(1003, 2, { direccion: DIR_2, codigos: cods(1003, 2) })],
    config: cfg({ Bandera_MultipedidoMismaDireccion: false, Bandera_MultipedidoValidarCodigos: false }),
    comprobar: { ronda: [1001, 1003] },
  },

  /* ---- Pedidos retenidos o cancelados ---- */
  {
    id: 'candidato-retenido',
    capacidad: E,
    requisito: 'Pedidos retenidos o cancelados',
    escenario: 'Candidato retenido',
    descripcion: '1002 está retenido desde Exodus Sucursales y cumple las demás reglas; 1003 cumple todo.',
    esperado: '1002 no se integra a la ronda; la ronda queda con 1001 y 1003.',
    cola: [ped(1001, 1), ped(1002, 2, { retenido: true }), ped(1003, 3)],
    config: cfg(),
    comprobar: { ronda: [1001, 1003], rechazados: [1002] },
  },
  {
    id: 'ancla-retenida',
    capacidad: E,
    requisito: 'Pedidos retenidos o cancelados',
    escenario: 'Retenido enviado a surtir manualmente',
    descripcion:
      '1001 está retenido y alguien lo envía a surtir manualmente desde Exodus Sucursales (vía de liberados), así que llega al frente de la cola; 1002 y 1003 cumplirían todo.',
    esperado:
      'No se evalúan candidatos y 1001 se surte en su propia ronda, como hoy, con la configuración y las banderas que tenga la sucursal en ese momento.',
    cola: [ped(1001, 1, { retenido: true, retencion: 'manual', via: 'liberado' }), ped(1002, 2), ped(1003, 3)],
    config: cfg(),
    comprobar: { ancla: 1001, ronda: [1001], ordenEvaluacion: [], fueraDeVentana: [1002, 1003] },
  },
  {
    id: 'candidato-cancelado',
    capacidad: E,
    requisito: 'Pedidos retenidos o cancelados',
    escenario: 'Candidato cancelado',
    descripcion: '1002 está cancelado y cumpliría las demás reglas; 1003 y 1004 cumplen todo.',
    esperado: '1002 no llega a la cola: no se evalúa ni se integra. La ronda queda con 1001, 1003 y 1004.',
    cola: [ped(1001, 1), ped(1002, 2, { cancelado: true }), ped(1003, 3), ped(1004, 4)],
    config: cfg(),
    comprobar: { ronda: [1001, 1003, 1004], ordenEvaluacion: [1003, 1004], fueraDeCola: [1002] },
  },
  {
    id: 'cancelacion-durante-surtido',
    capacidad: E,
    requisito: 'Pedidos retenidos o cancelados',
    escenario: 'Cancelación durante el surtido',
    descripcion:
      'La ronda lleva 1001, 1002 y 1003, se está surtiendo y 1002 se cancela. Ocurre con la ronda ya armada, así que se valida en el listado de la HH.',
    esperado: '1002 sale de la ronda, no aparece en la siguiente tarea de esos pedidos y lo surtido de 1001 y 1003 se conserva.',
    cola: [],
    config: cfg(),
    comprobar: {},
    enListado: true,
    textoListado:
      'La cancelación llega con la ronda ya armada y en surtido (cambio 2026-11-05-multipedido-surtido-listado-cierre · Pedido cancelado durante el surtido). Se valida al finalizar el surtido, en la demo de revisión multipedido (https://isaairojas.github.io/Revisi-n-multipedido/), en los casos del pedido cancelado: el listado no cambia, al finalizar se avisa y la ronda se cierra sin el cancelado.',
  },

  /* ---- Tope de partidas por ronda ---- */
  {
    id: 'codigo-en-dos-pedidos',
    capacidad: E,
    requisito: 'Tope de partidas por ronda',
    escenario: 'Código presente en dos pedidos',
    descripcion: 'Tope 15. El ancla 1001 tiene 6 partidas y 1002 tiene 7, de las cuales 0486600 y 2389475 también las pide el ancla.',
    esperado: '1002 se integra y la ronda suma 13 partidas: cada código compartido cuenta una vez en cada pedido.',
    cola: [
      ped(1001, 1, { codigos: cods(1001, 6, ['0486600', '2389475']) }),
      ped(1002, 2, { codigos: cods(1002, 7, ['0486600', '2389475']) }),
    ],
    config: cfg(),
    comprobar: { ronda: [1001, 1002], totalPartidas: 13 },
  },
  {
    id: 'segundo-cabe',
    capacidad: E,
    requisito: 'Tope de partidas por ronda',
    escenario: 'El segundo cabe',
    descripcion:
      'Tope 15. El ancla 1001 tiene 6 partidas y 1002 tiene 7, sin códigos en común (Bandera_MultipedidoValidarCodigos inactiva para aislar el tope).',
    esperado: '1002 se integra y la ronda suma 13.',
    cola: [ped(1001, 1, { codigos: cods(1001, 6) }), ped(1002, 2, { codigos: cods(1002, 7) })],
    config: cfg({ Bandera_MultipedidoValidarCodigos: false }),
    comprobar: { ronda: [1001, 1002], totalPartidas: 13 },
  },
  {
    id: 'justo-en-tope',
    capacidad: E,
    requisito: 'Tope de partidas por ronda',
    escenario: 'Justo en el tope',
    descripcion:
      'Tope 15. La ronda suma 13 (1001 con 6 y 1002 con 7) y 1003 tiene 2 partidas que no están en la ronda (Bandera_MultipedidoValidarCodigos inactiva).',
    esperado: '1003 se integra y la ronda suma 15.',
    cola: [
      ped(1001, 1, { codigos: cods(1001, 6) }),
      ped(1002, 2, { codigos: cods(1002, 7) }),
      ped(1003, 3, { codigos: cods(1003, 2) }),
    ],
    config: cfg({ Bandera_MultipedidoValidarCodigos: false }),
    comprobar: { ronda: [1001, 1002, 1003], totalPartidas: 15 },
  },
  {
    id: 'tercero-no-cabe',
    capacidad: E,
    requisito: 'Tope de partidas por ronda',
    escenario: 'El tercero no cabe',
    descripcion:
      'Tope 15. La ronda suma 13 (1001 con 6 y 1002 con 7) y 1003 tiene 4 partidas que no están en la ronda (Bandera_MultipedidoValidarCodigos inactiva).',
    esperado: '1003 no se integra; la ronda se queda en 13.',
    cola: [
      ped(1001, 1, { codigos: cods(1001, 6) }),
      ped(1002, 2, { codigos: cods(1002, 7) }),
      ped(1003, 3, { codigos: cods(1003, 4) }),
    ],
    config: cfg({ Bandera_MultipedidoValidarCodigos: false }),
    comprobar: { ronda: [1001, 1002], rechazados: [1003], totalPartidas: 13 },
  },
  {
    id: 'ancla-supera-tope',
    capacidad: E,
    requisito: 'Tope de partidas por ronda',
    escenario: 'Ancla que ya supera el tope',
    descripcion: 'Tope 15 y el ancla 1001 tiene 18 partidas. 1002 y 1003 tienen 2 cada uno y comparten 0486600.',
    esperado: 'Ningún candidato se integra y 1001 se surte solo, como hoy.',
    cola: [ped(1001, 1, { codigos: cods(1001, 18, [COMUN]) }), ped(1002, 2), ped(1003, 3)],
    config: cfg(),
    comprobar: { ronda: [1001], rechazados: [1002, 1003], totalPartidas: 18 },
  },
  {
    id: 'tope-corta-antes',
    capacidad: E,
    requisito: 'Tope de partidas por ronda',
    escenario: 'El tope de partidas corta antes que el máximo',
    descripcion:
      'Máximo 3 pedidos y tope de 15 partidas. El ancla 1001 tiene 9 partidas y 1002 aporta 5 (la ronda suma 14); 1003 aporta 4 y cumple todo lo demás. Todos comparten 0486600.',
    esperado: '1003 no se integra y la ronda cierra con 2 pedidos (14 partidas): corta el tope de partidas, no el máximo.',
    cola: [
      ped(1001, 1, { codigos: cods(1001, 9, [COMUN]) }),
      ped(1002, 2, { codigos: cods(1002, 5, [COMUN]) }),
      ped(1003, 3, { codigos: cods(1003, 4, [COMUN]) }),
    ],
    config: cfg(),
    comprobar: { maxPedidos: 3, ronda: [1001, 1002], rechazados: [1003], totalPartidas: 14 },
  },
  {
    id: 'tope-desactivado',
    capacidad: E,
    requisito: 'Tope de partidas por ronda',
    escenario: 'Tope desactivado',
    descripcion: 'Bandera_MultipedidoTopePartidas inactiva. La ronda suma 13 (1001 con 6 y 1002 con 7) y 1003 tiene 9 partidas; todos comparten 0486600.',
    esperado: '1003 se integra y la ronda suma 22.',
    cola: [
      ped(1001, 1, { codigos: cods(1001, 6, [COMUN]) }),
      ped(1002, 2, { codigos: cods(1002, 7, [COMUN]) }),
      ped(1003, 3, { codigos: cods(1003, 9, [COMUN]) }),
    ],
    config: cfg({ Bandera_MultipedidoTopePartidas: false }),
    comprobar: { ronda: [1001, 1002, 1003], totalPartidas: 22 },
  },

  /* ---- Tiempo de la franja de la ronda (regla del 2026-11-09: la franja se amplía) ---- */
  {
    id: 'tiempo-se-pasa',
    capacidad: E,
    requisito: 'Tiempo de la franja de la ronda',
    escenario: 'El candidato se pasa de la franja',
    descripcion: 'La franja permite 20 minutos; la ronda acumula 14 (1001 con 6 y 1002 con 8) y 1003 estima 9 y cumple las demás reglas.',
    esperado: '1003 se integra y la franja de la ronda se amplía de 20 a 23 minutos.',
    cola: [ped(1001, 1, { minutos: 6 }), ped(1002, 2, { minutos: 8 }), ped(1003, 3, { minutos: 9 })],
    config: cfg({ minutosFranja: 20 }),
    comprobar: { ronda: [1001, 1002, 1003], rechazados: [], totalMinutos: 23, minutosFranjaRonda: 23 },
  },
  {
    id: 'tiempo-cabe',
    capacidad: E,
    requisito: 'Tiempo de la franja de la ronda',
    escenario: 'El candidato cabe en la franja',
    descripcion: 'La franja permite 20 minutos; la ronda acumula 8 (el ancla 1001) y 1002 estima 7.',
    esperado: '1002 se integra, la ronda acumula 15 minutos y la franja sigue en 20.',
    cola: [ped(1001, 1, { minutos: 8 }), ped(1002, 2, { minutos: 7 })],
    config: cfg({ minutosFranja: 20 }),
    comprobar: { ronda: [1001, 1002], totalMinutos: 15, minutosFranjaRonda: 20 },
  },
  {
    id: 'franja-ajustada',
    capacidad: E,
    requisito: 'Tiempo de la franja de la ronda',
    escenario: 'Tres pedidos que superan la franja',
    descripcion: 'Máximo 3 pedidos que estiman 8, 7 y 9 minutos y cumplen todas las reglas; la franja permite 20.',
    esperado: 'Los 3 pedidos entran en la misma ronda y la franja de la ronda se amplía a 24 minutos.',
    cola: [ped(1001, 1, { minutos: 8 }), ped(1002, 2, { minutos: 7 }), ped(1003, 3, { minutos: 9 })],
    config: cfg({ minutosFranja: 20 }),
    comprobar: { ronda: [1001, 1002, 1003], totalMinutos: 24, minutosFranjaRonda: 24 },
  },
  {
    id: 'ampliacion-sin-tope',
    capacidad: E,
    requisito: 'Tiempo de la franja de la ronda',
    escenario: 'Ampliación sin tope',
    descripcion: 'La franja permite 20 minutos. El ancla 1001 estima 20 y el siguiente de la cola, 1002, estima 30 y cumple todas las reglas.',
    esperado: '1002 se integra y la franja de la ronda queda en 50 minutos.',
    cola: [ped(1001, 1, { minutos: 20 }), ped(1002, 2, { minutos: 30 })],
    config: cfg({ minutosFranja: 20 }),
    comprobar: { ronda: [1001, 1002], totalMinutos: 50, minutosFranjaRonda: 50 },
  },
  {
    id: 'ampliacion-maximo-4',
    capacidad: E,
    requisito: 'Tiempo de la franja de la ronda',
    escenario: 'Ampliación con un máximo de 4',
    descripcion: 'Sucursal 8: máximo de 4 pedidos y franja de 20 minutos. 1001 a 1004 estiman 8, 7, 9 y 6 minutos y cumplen todas las reglas.',
    esperado: 'Los 4 entran y la franja de esa ronda queda en 30 minutos.',
    cola: [
      ped(1001, 1, { minutos: 8 }),
      ped(1002, 2, { minutos: 7 }),
      ped(1003, 3, { minutos: 9 }),
      ped(1004, 4, { minutos: 6 }),
    ],
    config: cfg({ sucursal: 8, maxPedidos: 4, minutosFranja: 20 }),
    comprobar: { maxPedidos: 4, ronda: [1001, 1002, 1003, 1004], totalMinutos: 30, minutosFranjaRonda: 30 },
  },
  {
    id: 'franja-sin-ampliar',
    capacidad: E,
    requisito: 'Tiempo de la franja de la ronda',
    escenario: 'Un candidato que no cumple no amplía la franja',
    descripcion: 'La franja permite 20 minutos y el ancla 1001 estima 8. 1002 es un traspaso (no permitido) y estima 15.',
    esperado: '1002 no se integra por el tipo de pedido y la franja de la ronda sigue en 20 minutos.',
    cola: [ped(1001, 1, { minutos: 8 }), ped(1002, 2, { minutos: 15, tipo: 'traspaso' })],
    config: cfg({ minutosFranja: 20 }),
    comprobar: { ronda: [1001], rechazados: [1002], totalMinutos: 8, minutosFranjaRonda: 20 },
  },

  /* ---- Orden de evaluación con otras banderas ---- */
  {
    id: 'division-se-evalua-primero',
    capacidad: E,
    requisito: 'Orden de evaluación con otras banderas',
    escenario: 'La división de factura se evalúa primero',
    descripcion:
      'Bandera_MultipedidoEnHH, BndRondaXPedido y BndUnificarRondasMontos activas. El ancla 2001 es la parte 1 de la factura F-88121, dividida en 3 partes (2001 a 2003). 1010 va después en la cola y cumpliría todo.',
    esperado: 'Las 3 partes entran juntas a la ronda y no se evalúan más candidatos: 1010 no se evalúa.',
    cola: [
      ...[1, 2, 3].map((n) =>
        ped(2000 + n, 1, { creado: `2026-11-09 07:0${n}`, division: { id: 'F-88121', parte: n } }),
      ),
      ped(1010, 2),
    ],
    config: cfg({ BndRondaXPedido: true, BndUnificarRondasMontos: true }),
    comprobar: { modo: 'multipedido', ronda: [2001, 2002, 2003], rechazados: [], fueraDeVentana: [1010] },
  },
  {
    id: 'tres-activas-sin-division',
    capacidad: E,
    requisito: 'Orden de evaluación con otras banderas',
    escenario: 'Las tres activas y el ancla no viene de una división',
    descripcion:
      'Bandera_MultipedidoEnHH, BndRondaXPedido y BndUnificarRondasMontos activas. El ancla 1001 no viene de una división; 1002 y 1003 cumplen todas las reglas.',
    esperado: 'Se evalúan los candidatos con las reglas del multipedido V2, como si BndUnificarRondasMontos no estuviera activa: la ronda queda con 1001, 1002 y 1003.',
    cola: [ped(1001, 1), ped(1002, 2), ped(1003, 3)],
    config: cfg({ BndRondaXPedido: true, BndUnificarRondasMontos: true }),
    comprobar: { modo: 'multipedido', ordenEvaluacion: [1002, 1003], ronda: [1001, 1002, 1003] },
  },
  {
    id: 'por-pedido-evalua',
    capacidad: E,
    requisito: 'Orden de evaluación con otras banderas',
    escenario: 'La ronda por pedido no impide evaluar candidatos',
    descripcion: 'Bandera_MultipedidoEnHH y BndRondaXPedido activas. 1001 es el ancla y 1002 cumple todos los criterios para entrar con él.',
    esperado: '1002 se integra a la ronda de 1001.',
    cola: [ped(1001, 1), ped(1002, 2)],
    config: cfg({ BndRondaXPedido: true }),
    comprobar: { modo: 'multipedido', ordenEvaluacion: [1002], ronda: [1001, 1002] },
  },
  {
    id: 'por-pedido-sin-candidatos',
    capacidad: E,
    requisito: 'Orden de evaluación con otras banderas',
    escenario: 'Sin candidatos, el ancla se surte sola',
    descripcion:
      'Bandera_MultipedidoEnHH y BndRondaXPedido activas. Ni 1002 ni 1003 comparten códigos con 1001, y no quedan más pedidos por evaluar.',
    esperado: '1001 se surte en su propia ronda.',
    cola: [ped(1001, 1), ped(1002, 2, { codigos: cods(1002, 2) }), ped(1003, 3, { codigos: cods(1003, 2) })],
    config: cfg({ BndRondaXPedido: true }),
    comprobar: { modo: 'multipedido', ronda: [1001], rechazados: [1002, 1003], fueraDeVentana: [] },
  },
  /* ---- Elegibilidad: escenarios añadidos del 2026-11-18 al 2026-11-24 ---- */
  {
    id: 'paqueteria-prevalece',
    capacidad: E,
    requisito: 'Convivencia con las rondas actuales',
    escenario: 'Paquetería o embarque sugerido prevalecen',
    descripcion:
      'Multipedido V2 activo. Cola: 1001 (local, se puede sumar a un embarque existente), 1002 y 1003 (foráneos). En la sucursal 8 se alcanzó la hora límite de paquetería; en la 12 no, pero 1001 puede sumarse a un embarque existente.',
    esperado:
      'Se forma la ronda de paquetería (8: solo 1002 y 1003) o la sugerencia a embarques (12: 1001), como hoy, y no una ronda multipedido V2.',
    cola: [ped(1001, 1, { sugeridoEmbarque: true }), ped(1002, 2, { servicio: 'foraneo' }), ped(1003, 3, { servicio: 'foraneo' })],
    config: cfg({ sucursal: 8, paqueteria: true }),
    comprobar: { modo: 'paqueteria', ronda: [1002, 1003], mensaje: 'Se genero ronda unicamente de pedidos foraneos para paqueteria' },
    otraSucursal: {
      config: cfg({ sucursal: 12 }),
      comprobar: { modo: 'embarque', ronda: [1001], mensaje: 'Se sugirieron documentos a embarques existentes correctamente' },
    },
  },
  {
    id: 'cola-por-bloques',
    capacidad: E,
    requisito: 'Pedido ancla y ventana de evaluación',
    escenario: 'Ancla en una cola por bloques',
    descripcion:
      'La cola llega del procesador en bloques: el local 1001 (L1), después el vencido 1002 (V1) y después el foráneo 1003 (F1).',
    esperado: '1001 es el ancla y 1002 y 1003 se evalúan como candidatos, en ese orden (1003 no se integra por ser foráneo).',
    cola: [ped(1001, 1), ped(1002, 2, { vencido: true }), ped(1003, 3, { servicio: 'foraneo' })],
    config: cfg(),
    comprobar: { ancla: 1001, ordenEvaluacion: [1002, 1003], ronda: [1001, 1002], rechazados: [1003] },
  },
  {
    id: 'almacenista-rol-2',
    capacidad: E,
    requisito: 'Pedido ancla y ventana de evaluación',
    escenario: 'Almacenista (rol 2)',
    descripcion:
      'Multipedido V2 activo. Un almacenista (rol 2) pide su ronda a las 10:00. En la cola hay un pedido de cliente (1001) y dos balanceos: 3001 con reparto a las 12:00 y 3002 a las 11:00.',
    esperado:
      'Recibe solo balanceos, uno por ronda y elegido como hoy (el de reparto más próximo: 3002), y no se forma ronda multipedido V2.',
    cola: [ped(1001, 1), pet(3001, 2, 'balanceo', { reparto: hoy('12:00') }), pet(3002, 3, 'balanceo', { reparto: hoy('11:00') })],
    config: cfg({ rol: 2, ahora: AHORA }),
    comprobar: { modo: 'almacenista', ronda: [3002] },
  },
  {
    id: 'sustituye-ronda-por-pedido',
    capacidad: E,
    requisito: 'Pedido ancla y ventana de evaluación',
    escenario: 'Sustituye el criterio de la ronda por pedido',
    descripcion:
      'Bandera_MultipedidoEnHH y BndRondaXPedido activas. La cola entrega primero el traspaso 3001 (T) y después el pedido de venta 1001 (A).',
    esperado:
      '3001 es el ancla, porque manda el orden del procesador y no el criterio actual de la ronda por pedido (venta antes que traspaso).',
    cola: [pet(3001, 1, 'traspaso'), ped(1001, 2)],
    config: cfg({ BndRondaXPedido: true }),
    comprobar: { modo: 'multipedido', ancla: 3001 },
  },
  {
    id: 'sin-servicio-definido',
    capacidad: E,
    requisito: 'Mismo servicio',
    escenario: 'Pedido sin servicio definido',
    descripcion: '1002 no tiene definido si es local o foráneo; 1001 y 1003 son locales y cumplen todo.',
    esperado: '1002 no está en la cola y no se evalúa ni como ancla ni como candidato: la ronda queda con 1001 y 1003.',
    cola: [ped(1001, 1), ped(1002, 2, { servicio: null }), ped(1003, 3)],
    config: cfg(),
    comprobar: { fueraDeCola: [1002], ordenEvaluacion: [1003], ronda: [1001, 1003] },
  },
  {
    id: 'balanceo-traspasos-habilitados',
    capacidad: E,
    requisito: 'Tipo de pedido',
    escenario: 'Balanceo con traspasos habilitados',
    descripcion: 'Bandera_MultipedidoTraspasos activa. El candidato 1002 es un balanceo que cumple las demás reglas.',
    esperado: '1002 no se integra: los balanceos nunca entran a una ronda multipedido V2.',
    cola: [ped(1001, 1), pet(1002, 2, 'balanceo')],
    config: cfg({ Bandera_MultipedidoTraspasos: true }),
    comprobar: { ronda: [1001], rechazados: [1002] },
  },
  {
    id: 'balanceo-ancla',
    capacidad: E,
    requisito: 'Tipo de pedido',
    escenario: 'Balanceo como ancla',
    descripcion: 'El ancla 3001 es un balanceo y 1002 es un pedido de cliente que cumpliría las demás reglas.',
    esperado: 'El balanceo se surte por el flujo de hoy, sin candidatos: 1002 no se integra y no recibe tareas de balanceo.',
    cola: [pet(3001, 1, 'balanceo'), ped(1002, 2)],
    config: cfg(),
    comprobar: { ancla: 3001, ronda: [3001], ordenEvaluacion: [], fueraDeVentana: [1002] },
  },
  {
    id: 'corporativo-candidato',
    capacidad: E,
    requisito: 'Tipo de pedido',
    escenario: 'Corporativo como candidato',
    descripcion: '1002 es un pedido corporativo y cumple las demás reglas.',
    esperado: '1002 se integra a la ronda.',
    cola: [ped(1001, 1), ped(1002, 2, { corporativo: true })],
    config: cfg(),
    comprobar: { ronda: [1001, 1002] },
  },
  {
    id: 'candidato-sin-nombre',
    capacidad: E,
    requisito: 'Tipo de pedido',
    escenario: 'Candidato sin nombre de cliente',
    descripcion: '1002 no tiene nombre de cliente y cumple las demás reglas.',
    esperado: '1002 no se integra a la ronda.',
    cola: [ped(1001, 1), ped(1002, 2, { faltaDato: 'nombre de cliente' })],
    config: cfg(),
    comprobar: { ronda: [1001], rechazados: [1002] },
  },
  {
    id: 'ancla-sin-numero-cliente',
    capacidad: E,
    requisito: 'Tipo de pedido',
    escenario: 'Ancla sin número de cliente',
    descripcion: 'El ancla 1001 no tiene número de cliente; 1002 cumpliría las demás reglas.',
    esperado: '1001 se surte solo, como pedido único, y 1002 no se integra a su ronda.',
    cola: [ped(1001, 1, { faltaDato: 'número de cliente' }), ped(1002, 2)],
    config: cfg(),
    comprobar: { ancla: 1001, ronda: [1001], ordenEvaluacion: [], fueraDeVentana: [1002] },
  },
  {
    id: 'solo-codigo-sin-comunes',
    capacidad: E,
    requisito: 'Criterios de afinidad',
    escenario: 'Solo código compartido, sin códigos en común',
    descripcion:
      'Solo Bandera_MultipedidoValidarCodigos activa. 1002 comparte 1394010 con el ancla 1001 y se integra; 1003 no comparte ningún código ni con 1001 ni con 1002.',
    esperado: '1003 no se integra: la ronda queda con 1001 y 1002.',
    cola: [
      ped(1001, 1, { codigos: ['0486600', '1394010'] }),
      ped(1002, 2, { codigos: ['1394010', '2389475'] }),
      ped(1003, 3, { codigos: ['6200401', '6200404'] }),
    ],
    config: cfg(),
    comprobar: { ronda: [1001, 1002], rechazados: [1003] },
  },
  {
    id: 'retencion-durante-surtido',
    capacidad: E,
    requisito: 'Pedidos retenidos o cancelados',
    escenario: 'Retención durante el surtido',
    descripcion:
      'La ronda lleva 1001, 1002 y 1003, se está surtiendo y 1002 se retiene. Ocurre con la ronda ya armada, así que se valida en el listado de la HH.',
    esperado: 'La ronda se finaliza como hoy y el listado no muestra ningún aviso de retención.',
    cola: [],
    config: cfg(),
    comprobar: {},
    enListado: true,
    textoListado:
      'La retención llega con la ronda ya armada y en surtido. El listado V2 no usa el indicador de retenidos al guardar (clarificación 47): la ronda se finaliza como cualquier otra, sin aviso. Se valida al finalizar el surtido, en la demo de revisión multipedido (https://isaairojas.github.io/Revisi-n-multipedido/): al finalizar la ronda no aparece ningún aviso de retención.',
  },
  {
    id: 'pedido-cero-partidas',
    capacidad: E,
    requisito: 'Pedidos retenidos o cancelados',
    escenario: 'Pedido con 0 partidas',
    descripcion: 'Todas las partidas de 1002 se cancelaron y queda con 0 partidas; 1001 y 1003 cumplen todo.',
    esperado: '1002 no está en la cola y no se evalúa ni como ancla ni como candidato: la ronda queda con 1001 y 1003.',
    cola: [ped(1001, 1), ped(1002, 2, { codigos: [] }), ped(1003, 3)],
    config: cfg(),
    comprobar: { fueraDeCola: [1002], ordenEvaluacion: [1003], ronda: [1001, 1003] },
  },
  {
    id: 'retencion-automatica',
    capacidad: E,
    requisito: 'Pedidos retenidos o cancelados',
    escenario: 'Candidato con retención automática',
    descripcion: '1002 está retenido por crédito, sin retención manual, y cumple las demás reglas.',
    esperado: '1002 no se integra a la ronda (el sistema no distingue la causa de la retención).',
    cola: [ped(1001, 1), ped(1002, 2, { retenido: true, retencion: 'automatica' })],
    config: cfg(),
    comprobar: { ronda: [1001], rechazados: [1002] },
  },
  {
    id: 'tope-desactivado-cero',
    capacidad: E,
    requisito: 'Tope de partidas por ronda',
    escenario: 'Tope desactivado con el parámetro en 0',
    descripcion:
      'Bandera_MultipedidoTopePartidas inactiva y Parametro_MultipedidoMaxPartidas en 0. La ronda suma 13 (1001 con 6 y 1002 con 7) y 1003 tiene 9 partidas; todos comparten 0486600.',
    esperado: '1003 se integra y la ronda suma 22: con la bandera inactiva, el valor del tope no cuenta.',
    cola: [
      ped(1001, 1, { codigos: cods(1001, 6, [COMUN]) }),
      ped(1002, 2, { codigos: cods(1002, 7, [COMUN]) }),
      ped(1003, 3, { codigos: cods(1003, 9, [COMUN]) }),
    ],
    config: cfg({ Bandera_MultipedidoTopePartidas: false, maxPartidas: 0 }),
    comprobar: { ronda: [1001, 1002, 1003], totalPartidas: 22, maxPartidas: null },
  },

  /* ---- Catálogo · Banderas del multipedido V2 ---- */
  {
    id: 'cat-banderas-nuevas',
    capacidad: C,
    requisito: 'Banderas del multipedido V2',
    escenario: 'Banderas nuevas en el catálogo',
    descripcion: 'Sucursal dada de alta para el multipedido V2. Se consultan sus banderas como las demás.',
    esperado:
      'Se reportan habilitadas Bandera_MultipedidoValidarCodigos, Bandera_MultipedidoTopePartidas y Bandera_MultipedidoMismoCliente (además de Bandera_MultipedidoEnHH), y no se reportan habilitadas Bandera_MultipedidoMismaDireccion ni Bandera_MultipedidoTraspasos.',
    cola: [ped(1001, 1)],
    config: cfg(),
    comprobar: {
      reportadas: ['Bandera_MultipedidoEnHH', 'Bandera_MultipedidoValidarCodigos', 'Bandera_MultipedidoTopePartidas', 'Bandera_MultipedidoMismoCliente'],
    },
  },
  {
    id: 'cat-no-dada-de-alta',
    capacidad: C,
    requisito: 'Banderas del multipedido V2',
    escenario: 'Sucursal no dada de alta',
    descripcion: 'Sucursal sin el multipedido V2: ninguna de las seis banderas está asignada. Se consultan sus banderas.',
    esperado: 'Ninguna de las seis banderas del multipedido V2 se reporta habilitada y la sucursal sigue como hoy.',
    cola: [ped(1001, 1), ped(1002, 2)],
    config: cfg(
      sinAsignar(
        'Bandera_MultipedidoEnHH',
        'Bandera_MultipedidoValidarCodigos',
        'Bandera_MultipedidoTopePartidas',
        'Bandera_MultipedidoMismoCliente',
      ),
    ),
    comprobar: { reportadas: [], modo: 'actual' },
  },

  /* ---- Servicio · recuperacion-ordenes-por-surtir-por-rol · Precedencia del tipo de ronda ---- */
  {
    id: 'precedencia-paqueteria',
    capacidad: R,
    requisito: 'Precedencia del tipo de ronda',
    escenario: 'Aplica paquetería',
    descripcion: 'Sin el multipedido V2. Hay pedidos foráneos elegibles (1002 y 1003) y se alcanzó la hora límite de paquetería.',
    esperado: 'La ronda contiene solo pedidos foráneos (1002 y 1003) y el mensaje es "Se genero ronda unicamente de pedidos foraneos para paqueteria".',
    cola: [ped(1001, 1), ped(1002, 2, { servicio: 'foraneo' }), ped(1003, 3, { servicio: 'foraneo' })],
    config: cfg({ ...SIN_V2, paqueteria: true }),
    comprobar: { modo: 'paqueteria', ronda: [1002, 1003], mensaje: 'Se genero ronda unicamente de pedidos foraneos para paqueteria' },
  },
  {
    id: 'precedencia-embarque',
    capacidad: R,
    requisito: 'Precedencia del tipo de ronda',
    escenario: 'Aplica sugerencia de embarque',
    descripcion: 'Sin el multipedido V2. No aplica paquetería y 1002 puede sumarse a un embarque existente.',
    esperado: 'La respuesta lleva las órdenes sugeridas a embarque (1002) con el mensaje "Se sugirieron documentos a embarques existentes correctamente".',
    cola: [ped(1001, 1), ped(1002, 2, { sugeridoEmbarque: true })],
    config: cfg(SIN_V2),
    comprobar: { modo: 'embarque', ronda: [1002], mensaje: 'Se sugirieron documentos a embarques existentes correctamente' },
  },
  {
    id: 'precedencia-normal',
    capacidad: R,
    requisito: 'Precedencia del tipo de ronda',
    escenario: 'Ronda normal',
    descripcion:
      'Sin el multipedido V2, sin paquetería ni sugerencia de embarque. Presupuesto de 120 min con 25 % foráneo (30 foráneos y 90 locales). Cola: 1001 local de 40 min, 1002 vencido de 20, 1003 foráneo de 25 y 1004 local de 40.',
    esperado:
      'La ronda se arma con vencidos, foráneos y locales que caben en el presupuesto (1003, 1002 y 1001; 1004 ya no cabe) y el mensaje es "Se obtuvo la lista correctamente".',
    cola: [
      ped(1001, 1, { minutos: 40 }),
      ped(1002, 2, { minutos: 20, vencido: true }),
      ped(1003, 3, { minutos: 25, servicio: 'foraneo' }),
      ped(1004, 4, { minutos: 40 }),
    ],
    config: cfg({ ...SIN_V2, minutosFranja: 120, porcentajeForaneo: 0.25 }),
    comprobar: { modo: 'actual', ronda: [1003, 1002, 1001], mensaje: 'Se obtuvo la lista correctamente' },
  },
  {
    id: 'precedencia-v2',
    capacidad: R,
    requisito: 'Precedencia del tipo de ronda',
    escenario: 'Ronda multipedido V2',
    descripcion: 'Multipedido V2 activo, sin paquetería ni sugerencia de embarque. Cola 1001, 1002 y 1003, todos con 0486600.',
    esperado: 'La ronda la arma el multipedido V2 (1001, 1002 y 1003) y el mensaje es "Se obtuvo la lista correctamente".',
    cola: [ped(1001, 1), ped(1002, 2), ped(1003, 3)],
    config: cfg(),
    comprobar: { modo: 'multipedido', ronda: [1001, 1002, 1003], mensaje: 'Se obtuvo la lista correctamente' },
  },
  {
    id: 'precedencia-paqueteria-v2',
    capacidad: R,
    requisito: 'Precedencia del tipo de ronda',
    escenario: 'Paquetería con multipedido V2',
    descripcion: 'Multipedido V2 activo, pedidos foráneos elegibles (1002 y 1003) y la hora límite de paquetería alcanzada.',
    esperado: 'La ronda contiene solo pedidos foráneos (1002 y 1003), igual que sin el multipedido V2.',
    cola: [ped(1001, 1), ped(1002, 2, { servicio: 'foraneo' }), ped(1003, 3, { servicio: 'foraneo' })],
    config: cfg({ paqueteria: true }),
    comprobar: { modo: 'paqueteria', ronda: [1002, 1003], mensaje: 'Se genero ronda unicamente de pedidos foraneos para paqueteria' },
  },

  /* ---- Servicio · Órdenes locales activas elegibles ---- */
  {
    id: 'local-congelada',
    capacidad: R,
    requisito: 'Órdenes locales activas elegibles',
    escenario: 'Orden congelada por existencia',
    descripcion: '1002 es una orden local activa congelada por existencia.',
    esperado: '1002 no es elegible por esta vía: no llega a la cola.',
    cola: [ped(1001, 1), ped(1002, 2, { congelado: true })],
    config: cfg(),
    comprobar: { fueraDeCola: [1002], ronda: [1001] },
  },
  {
    id: 'local-sin-zona',
    capacidad: R,
    requisito: 'Órdenes locales activas elegibles',
    escenario: 'Orden sin zona',
    descripcion: '1002 es una orden local activa sin zona asignada.',
    esperado: '1002 no es elegible: no llega a la cola.',
    cola: [ped(1001, 1), ped(1002, 2, { sinZona: true })],
    config: cfg(),
    comprobar: { fueraDeCola: [1002], ronda: [1001] },
  },
  {
    id: 'local-sin-partidas-v2',
    capacidad: R,
    requisito: 'Órdenes locales activas elegibles',
    escenario: 'Orden sin partidas con multipedido V2',
    descripcion: 'Multipedido V2 activo. 1002 es una orden local activa sin partidas.',
    esperado: '1002 no es elegible.',
    cola: [ped(1001, 1), ped(1002, 2, { codigos: [] })],
    config: cfg(),
    comprobar: { fueraDeCola: [1002], ronda: [1001] },
  },

  /* ---- Servicio · Órdenes liberadas elegibles ---- */
  {
    id: 'liberado-foraneo',
    capacidad: R,
    requisito: 'Órdenes liberadas elegibles',
    escenario: 'Foráneo liberado',
    descripcion: '2001 es un pedido foráneo liberado para surtir y no surtido, con zona y holgura.',
    esperado: '2001 es elegible: llega a la cola y arma la ronda.',
    cola: [ped(2001, 1, { servicio: 'foraneo', via: 'liberado' })],
    config: cfg(),
    comprobar: { fueraDeCola: [], ronda: [2001] },
  },
  {
    id: 'liberado-surtido',
    capacidad: R,
    requisito: 'Órdenes liberadas elegibles',
    escenario: 'Liberado ya surtido',
    descripcion: '2001 es un pedido liberado marcado como surtido; 1001 es una orden local elegible.',
    esperado: '2001 no es elegible: no llega a la cola.',
    cola: [ped(1001, 2), ped(2001, 1, { via: 'liberado', surtido: true })],
    config: cfg(),
    comprobar: { fueraDeCola: [2001], ronda: [1001] },
  },
  {
    id: 'liberado-retenido-v2',
    capacidad: R,
    requisito: 'Órdenes liberadas elegibles',
    escenario: 'Liberado retenido con multipedido V2',
    descripcion:
      'Multipedido V2 activo. 2001 está retenido y alguien lo envió a surtir manualmente (vía de liberados); 1002 cumpliría todo para entrar con él.',
    esperado: '2001 es elegible como hoy y se surte en su propia ronda, sin candidatos.',
    cola: [ped(2001, 1, { via: 'liberado', retenido: true, retencion: 'manual' }), ped(1002, 2)],
    config: cfg(),
    comprobar: { fueraDeCola: [], ancla: 2001, ronda: [2001], ordenEvaluacion: [] },
  },
  {
    id: 'liberado-sin-servicio-v2',
    capacidad: R,
    requisito: 'Órdenes liberadas elegibles',
    escenario: 'Liberado sin servicio definido con multipedido V2',
    descripcion: 'Multipedido V2 activo. 2001 es el único pedido: liberado, con zona y holgura, sin definir si es local o foráneo.',
    esperado: '2001 no es elegible y la ronda va vacía.',
    cola: [ped(2001, 1, { via: 'liberado', servicio: null })],
    config: cfg(),
    comprobar: { fueraDeCola: [2001], ronda: [] },
  },

  /* ---- Servicio · Candidatos foráneos automáticos ---- */
  {
    id: 'automatico-sin-elegibles',
    capacidad: R,
    requisito: 'Candidatos foráneos automáticos',
    escenario: 'Sin elegibles y atención foránea activa',
    descripcion:
      'Ninguna orden elegible, Bnd_AtencionHH_PedidosForaneos activa y 4001, un pedido candidato automático no enviado. Pide la ronda un surtidor de rol 1.',
    esperado: '4001 es elegible y arma la ronda.',
    cola: [ped(4001, 1, { via: 'automatico', servicio: 'foraneo' })],
    config: cfg({ Bnd_AtencionHH_PedidosForaneos: true, rol: 1 }),
    comprobar: { fueraDeCola: [], ronda: [4001] },
  },
  {
    id: 'automatico-ya-hay-elegibles',
    capacidad: R,
    requisito: 'Candidatos foráneos automáticos',
    escenario: 'Ya existen elegibles',
    descripcion: 'Hay una orden elegible (1001) y 4001 es un candidato automático no enviado; la atención foránea está activa.',
    esperado: 'No se agregan candidatos automáticos: 4001 no llega a la cola.',
    cola: [ped(1001, 1), ped(4001, 2, { via: 'automatico', servicio: 'foraneo' })],
    config: cfg({ Bnd_AtencionHH_PedidosForaneos: true }),
    comprobar: { fueraDeCola: [4001], ronda: [1001] },
  },
  {
    id: 'automatico-cancelado-v2',
    capacidad: R,
    requisito: 'Candidatos foráneos automáticos',
    escenario: 'Candidato cancelado con multipedido V2',
    descripcion: 'Multipedido V2 activo, ninguna orden elegible, atención foránea activa y un único candidato automático (4001) cancelado.',
    esperado: '4001 no es elegible y la ronda va vacía.',
    cola: [ped(4001, 1, { via: 'automatico', servicio: 'foraneo', cancelado: true })],
    config: cfg({ Bnd_AtencionHH_PedidosForaneos: true }),
    comprobar: { fueraDeCola: [4001], ronda: [] },
  },
  {
    id: 'automatico-sin-zona-v2',
    capacidad: R,
    requisito: 'Candidatos foráneos automáticos',
    escenario: 'Candidato sin zona con multipedido V2',
    descripcion: 'Multipedido V2 activo, ninguna orden elegible, atención foránea activa y un único candidato automático (4001) sin zona asignada.',
    esperado: '4001 no es elegible y la ronda va vacía.',
    cola: [ped(4001, 1, { via: 'automatico', servicio: 'foraneo', sinZona: true })],
    config: cfg({ Bnd_AtencionHH_PedidosForaneos: true }),
    comprobar: { fueraDeCola: [4001], ronda: [] },
  },
  {
    id: 'automatico-sin-servicio-v2',
    capacidad: R,
    requisito: 'Candidatos foráneos automáticos',
    escenario: 'Candidato sin servicio definido con multipedido V2',
    descripcion:
      'Multipedido V2 activo, ninguna orden elegible, atención foránea activa y un único candidato automático (4001) sin definir si es local o foráneo.',
    esperado: '4001 no es elegible y la ronda va vacía.',
    cola: [ped(4001, 1, { via: 'automatico', servicio: null })],
    config: cfg({ Bnd_AtencionHH_PedidosForaneos: true }),
    comprobar: { fueraDeCola: [4001], ronda: [] },
  },
  {
    id: 'automatico-retenido-v2',
    capacidad: R,
    requisito: 'Candidatos foráneos automáticos',
    escenario: 'Candidato retenido con multipedido V2',
    descripcion: 'Multipedido V2 activo, ninguna orden elegible, atención foránea activa y un único candidato automático (4001) retenido.',
    esperado: '4001 no es elegible y la ronda va vacía; se surte cuando alguien lo envía a surtir manualmente.',
    cola: [ped(4001, 1, { via: 'automatico', servicio: 'foraneo', retenido: true })],
    config: cfg({ Bnd_AtencionHH_PedidosForaneos: true }),
    comprobar: { fueraDeCola: [4001], ronda: [] },
  },

  /* ---- Servicio · traspasos-y-prioridad-de-peticiones ---- */
  {
    id: 'rxp-varias-ordenes',
    capacidad: T,
    requisito: 'Ronda por pedido',
    escenario: 'Varias órdenes seleccionadas',
    descripcion:
      'BndRondaXPedido activa y sin el multipedido V2. Son las 10:00 y el presupuesto selecciona cuatro pedidos de venta: 1001 (reparto 11:00), 1002 (10:45), 1003 (10:20) y 1004 (12:00).',
    esperado: 'La ronda contiene solo la orden elegida (1003, la de menos tiempo disponible), con número de orden 1.',
    cola: [
      ped(1001, 1, { reparto: hoy('11:00') }),
      ped(1002, 2, { reparto: hoy('10:45') }),
      ped(1003, 3, { reparto: hoy('10:20') }),
      ped(1004, 4, { reparto: hoy('12:00') }),
    ],
    config: cfg({ ...SIN_V2, BndRondaXPedido: true, ahora: AHORA }),
    comprobar: { modo: 'actual', ronda: [1003] },
  },
  {
    id: 'rxp-v2',
    capacidad: T,
    requisito: 'Ronda por pedido',
    escenario: 'Multipedido V2 activo',
    descripcion: 'BndRondaXPedido activa y el multipedido V2 activo. El ancla 1001 tiene dos candidatos (1002 y 1003) que cumplen las reglas.',
    esperado: 'La ronda contiene las tres órdenes con números de orden 1, 2 y 3 (1001, 1002 y 1003).',
    cola: [ped(1001, 1), ped(1002, 2), ped(1003, 3)],
    config: cfg({ BndRondaXPedido: true }),
    comprobar: { modo: 'multipedido', ronda: [1001, 1002, 1003] },
  },
  {
    id: 'rxp-almacenista-v2',
    capacidad: T,
    requisito: 'Ronda por pedido',
    escenario: 'Almacenista con el multipedido V2 activo',
    descripcion:
      'BndRondaXPedido activa, el multipedido V2 activo y un almacenista (rol 2) con tres balanceos seleccionados: 3001 (reparto 12:00), 3002 (11:30) y 3003 (13:00). Son las 10:00.',
    esperado: 'Su ronda contiene solo un balanceo (3002), con número de orden 1, como hoy.',
    cola: [
      pet(3001, 1, 'balanceo', { reparto: hoy('12:00') }),
      pet(3002, 2, 'balanceo', { reparto: hoy('11:30') }),
      pet(3003, 3, 'balanceo', { reparto: hoy('13:00') }),
    ],
    config: cfg({ BndRondaXPedido: true, rol: 2, ahora: AHORA }),
    comprobar: { modo: 'almacenista', ronda: [3002] },
  },
  {
    id: 'venta-antes-traspaso',
    capacidad: T,
    requisito: 'Pedidos de venta antes que traspasos',
    escenario: 'Traspaso más urgente que el pedido',
    descripcion:
      'BndRondaXPedido activa y sin el multipedido V2. Son las 10:00: el pedido de venta 1001 tiene 90 minutos disponibles (reparto 11:30) y la petición de traspaso 3001, 10 minutos (10:10).',
    esperado: 'Se elige el pedido de venta 1001.',
    cola: [pet(3001, 1, 'traspaso', { reparto: hoy('10:10') }), ped(1001, 2, { reparto: hoy('11:30') })],
    config: cfg({ ...SIN_V2, BndRondaXPedido: true, ahora: AHORA }),
    comprobar: { ronda: [1001] },
  },
  {
    id: 'menor-tiempo-dos-pedidos',
    capacidad: T,
    requisito: 'Pedido con menor tiempo disponible',
    escenario: 'Dos pedidos',
    descripcion: 'BndRondaXPedido activa y sin el multipedido V2. Son las 10:00: 1001 tiene 40 minutos disponibles (10:40) y 1002, 15 (10:15).',
    esperado: 'Se elige 1002, el de 15 minutos.',
    cola: [ped(1001, 1, { reparto: hoy('10:40') }), ped(1002, 2, { reparto: hoy('10:15') })],
    config: cfg({ ...SIN_V2, BndRondaXPedido: true, ahora: AHORA }),
    comprobar: { ronda: [1002] },
  },
  {
    id: 'menor-tiempo-empate',
    capacidad: T,
    requisito: 'Pedido con menor tiempo disponible',
    escenario: 'Empate',
    descripcion:
      'BndRondaXPedido activa y sin el multipedido V2. 1001 y 1002 tienen 30 minutos disponibles (reparto 10:30); 1001 se registró a las 09:00 y 1002 a las 08:00.',
    esperado: 'Se elige 1002, el registrado a las 08:00.',
    cola: [
      ped(1001, 1, { reparto: hoy('10:30'), creado: hoy('09:00') }),
      ped(1002, 2, { reparto: hoy('10:30'), creado: hoy('08:00') }),
    ],
    config: cfg({ ...SIN_V2, BndRondaXPedido: true, ahora: AHORA }),
    comprobar: { ronda: [1002] },
  },
  {
    id: 'traspaso-dos-peticiones',
    capacidad: T,
    requisito: 'Petición de traspaso con menor tiempo disponible',
    escenario: 'Dos peticiones',
    descripcion: 'BndRondaXPedido activa y sin el multipedido V2. Son las 10:00: la petición 3001 tiene reparto hoy a las 12:00 y la 3002, a las 11:00.',
    esperado: 'Se elige 3002, la de reparto a las 11:00.',
    cola: [pet(3001, 1, 'traspaso', { reparto: hoy('12:00') }), pet(3002, 2, 'traspaso', { reparto: hoy('11:00') })],
    config: cfg({ ...SIN_V2, BndRondaXPedido: true, ahora: AHORA }),
    comprobar: { ronda: [3002] },
  },
  {
    id: 'traspaso-misma-fecha',
    capacidad: T,
    requisito: 'Petición de traspaso con menor tiempo disponible',
    escenario: 'Mismo día, distinta hora máxima',
    descripcion: 'BndRondaXPedido activa y sin el multipedido V2. Dos peticiones con la misma fecha de reparto: 3001 con hora máxima 17:00 y 3002 con 13:00.',
    esperado: 'Se elige 3002, la de 13:00.',
    cola: [pet(3001, 1, 'traspaso', { reparto: hoy('17:00') }), pet(3002, 2, 'traspaso', { reparto: hoy('13:00') })],
    config: cfg({ ...SIN_V2, BndRondaXPedido: true, ahora: AHORA }),
    comprobar: { ronda: [3002] },
  },
  {
    id: 'traspaso-almacenista-v2',
    capacidad: T,
    requisito: 'Petición de traspaso con menor tiempo disponible',
    escenario: 'Almacenista con el multipedido V2 activo',
    descripcion:
      'Multipedido V2 activo y un almacenista (rol 2) con dos balanceos: 3001 con reparto hoy a las 12:00 y 3002 a las 11:00. Son las 10:00.',
    esperado: 'Se elige el balanceo 3002, de reparto a las 11:00, como hoy.',
    cola: [pet(3001, 1, 'balanceo', { reparto: hoy('12:00') }), pet(3002, 2, 'balanceo', { reparto: hoy('11:00') })],
    config: cfg({ BndRondaXPedido: true, rol: 2, ahora: AHORA }),
    comprobar: { modo: 'almacenista', ronda: [3002] },
  },
  {
    id: 'peticion-sin-hora',
    capacidad: T,
    requisito: 'Petición sin fecha límite de reparto',
    escenario: 'Petición sin hora máxima',
    descripcion:
      'BndRondaXPedido activa y sin el multipedido V2. Son las 10:00: la petición 3001 se creó hoy a las 09:00 sin hora máxima de reparto y la 3002 tiene límite hoy a las 12:00.',
    esperado: 'Se elige 3001, la petición sin hora máxima: su límite es las 09:00, ya excedido.',
    cola: [pet(3002, 1, 'traspaso', { reparto: hoy('12:00'), creado: hoy('08:30') }), pet(3001, 2, 'traspaso', { creado: hoy('09:00') })],
    config: cfg({ ...SIN_V2, BndRondaXPedido: true, ahora: AHORA }),
    comprobar: { ronda: [3001] },
  },
  {
    id: 'rxp-tipo-no-reconocido',
    capacidad: T,
    requisito: 'Sin pedidos ni traspasos en ronda por pedido',
    escenario: 'Tipo no reconocido',
    descripcion: 'Sin el multipedido V2 y con BndRondaXPedido activa. Las órdenes seleccionadas (1001 y 1002) son de un tipo distinto a pedido o traspaso.',
    esperado: 'La ronda va vacía, con el mensaje "No se encontraron documentos para ordenar".',
    cola: [ped(1001, 1, { tipo: 'otro' }), ped(1002, 2, { tipo: 'otro' })],
    config: cfg({ ...SIN_V2, BndRondaXPedido: true }),
    comprobar: { ronda: [], mensaje: 'No se encontraron documentos para ordenar' },
  },

  /* ---- Servicio · presupuesto-de-tiempo-de-surtido (sin el multipedido V2) ---- */
  {
    id: 'presupuesto-25',
    capacidad: P,
    requisito: 'Reparto entre foráneos y locales',
    escenario: '25 % foráneo',
    descripcion: 'Sin el multipedido V2. Presupuesto total de 120 minutos y porcentaje foráneo de 0.25.',
    esperado: 'Foráneos tienen 30 minutos y locales 90.',
    cola: [ped(1001, 1, { minutos: 10 })],
    config: cfg({ ...SIN_V2, minutosFranja: 120, porcentajeForaneo: 0.25 }),
    comprobar: { modo: 'actual', presupuesto: { foraneo: 30, local: 90 } },
  },
  {
    id: 'presupuesto-v2',
    capacidad: P,
    requisito: 'Reparto entre foráneos y locales',
    escenario: 'Multipedido V2 activo',
    descripcion: 'Multipedido V2 activo, con el mismo presupuesto (120 min, 25 % foráneo). Se arma una ronda normal.',
    esperado: 'No se reparte presupuesto entre foráneos y locales: la ronda la arma el multipedido V2.',
    cola: [ped(1001, 1), ped(1002, 2)],
    config: cfg({ minutosFranja: 120, porcentajeForaneo: 0.25 }),
    comprobar: { modo: 'multipedido', presupuesto: null },
  },
  {
    id: 'caben-posterior-corta',
    capacidad: P,
    requisito: 'Solo entran órdenes que caben',
    escenario: 'Una orden posterior más corta sí cabe',
    descripcion: 'Sin el multipedido V2. Quedan 20 minutos locales y las órdenes locales, en prioridad, son 1001 de 30 minutos y 1002 de 15.',
    esperado: 'Se omite 1001 y se incluye 1002.',
    cola: [ped(1001, 1, { minutos: 30 }), ped(1002, 2, { minutos: 15 })],
    config: cfg({ ...SIN_V2, minutosFranja: 20 }),
    comprobar: { ronda: [1002] },
  },
  {
    id: 'caben-v2',
    capacidad: P,
    requisito: 'Solo entran órdenes que caben',
    escenario: 'Multipedido V2 activo',
    descripcion: 'Multipedido V2 activo. El ancla 1001 estima 30 minutos y la franja es de 20.',
    esperado: 'El ancla entra en la ronda.',
    cola: [ped(1001, 1, { minutos: 30 })],
    config: cfg({ minutosFranja: 20 }),
    comprobar: { modo: 'multipedido', ronda: [1001] },
  },
  {
    id: 'descuento-dos-locales',
    capacidad: P,
    requisito: 'Descuento del presupuesto',
    escenario: 'Dos locales',
    descripcion: 'Sin el multipedido V2. 90 minutos locales y dos órdenes locales de 40 minutos cada una.',
    esperado: 'Entran ambas y quedan 10 minutos locales.',
    cola: [ped(1001, 1, { minutos: 40 }), ped(1002, 2, { minutos: 40 })],
    config: cfg({ ...SIN_V2, minutosFranja: 90 }),
    comprobar: { ronda: [1001, 1002], presupuesto: { localRestante: 10 } },
  },
  {
    id: 'foraneo-no-cabe',
    capacidad: P,
    requisito: 'Foráneos consumen el presupuesto foráneo',
    escenario: 'Foráneo que no cabe',
    descripcion: 'Sin el multipedido V2. 30 minutos foráneos (120 min con 25 % foráneo) y un pedido foráneo, 1002, de 45 minutos.',
    esperado: 'El pedido foráneo no entra.',
    cola: [ped(1002, 1, { servicio: 'foraneo', minutos: 45 })],
    config: cfg({ ...SIN_V2, minutosFranja: 120, porcentajeForaneo: 0.25 }),
    comprobar: { ronda: [], presupuesto: { foraneo: 30 } },
  },
  {
    id: 'sobrante-sin-foraneos',
    capacidad: P,
    requisito: 'Sobrante foráneo pasa a locales',
    escenario: 'Sin foráneos',
    descripcion:
      'Sin el multipedido V2. 30 minutos foráneos sin pedidos foráneos y 90 minutos locales (120 con 25 % foráneo). Locales: 1001 y 1002, de 60 minutos cada uno.',
    esperado: 'El presupuesto local disponible es 120 minutos: entran 1001 y 1002 y no sobra nada.',
    cola: [ped(1001, 1, { minutos: 60 }), ped(1002, 2, { minutos: 60 })],
    config: cfg({ ...SIN_V2, minutosFranja: 120, porcentajeForaneo: 0.25 }),
    comprobar: { ronda: [1001, 1002], presupuesto: { foraneo: 30, local: 90, localRestante: 0 } },
  },
  {
    id: 'masivo-sobra',
    capacidad: P,
    requisito: 'Vencidos en modo masivo',
    escenario: 'Sobra presupuesto en modo masivo',
    descripcion:
      'Sin el multipedido V2 y con el modo masivo de vencidos activo. 90 minutos locales; los vencidos 1002 (30 min) y 1003 (20 min) suman 50, y 1001 es un no vencido pendiente de 10.',
    esperado: 'La ronda contiene solo los vencidos (1002 y 1003), aunque haya no vencidos pendientes.',
    cola: [ped(1001, 1, { minutos: 10 }), ped(1002, 2, { minutos: 30, vencido: true }), ped(1003, 3, { minutos: 20, vencido: true })],
    config: cfg({ ...SIN_V2, minutosFranja: 90, modoMasivoVencidos: true }),
    comprobar: { ronda: [1002, 1003] },
  },
  {
    id: 'vencido-mas-largo',
    capacidad: P,
    requisito: 'Primer vencido en modo individual',
    escenario: 'Vencido más largo que el presupuesto',
    descripcion: 'Sin el multipedido V2. 60 minutos locales, un único vencido (1002) de 80 minutos y una orden local (1001) de 10.',
    esperado: 'El vencido entra y ninguna orden local adicional cabe (el presupuesto local queda en −20).',
    cola: [ped(1001, 1, { minutos: 10 }), ped(1002, 2, { minutos: 80, vencido: true })],
    config: cfg({ ...SIN_V2, minutosFranja: 60 }),
    comprobar: { ronda: [1002], presupuesto: { localRestante: -20 } },
  },

  /* ================= 2026-11-20-multipedido-configuracion-armado · configuracion-ronda-multipedido ================= */
  {
    id: 'conf-sin-v2',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Criterios del multipedido V2 por sucursal',
    escenario: 'Sucursal sin multipedido V2',
    descripcion: 'La sucursal no tiene activa Bandera_MultipedidoEnHH. Cola 1001, 1002 y 1003, que cumplirían los criterios.',
    esperado: 'El resultado es el mismo que da hoy el armado de su ruta (por servicio): no se evalúan candidatos multipedido V2.',
    cola: [ped(1001, 1), ped(1002, 2), ped(1003, 3)],
    config: cfg(SIN_V2),
    comprobar: { modo: 'actual', ordenEvaluacion: [] },
  },
  {
    id: 'conf-sin-listado',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Criterios del multipedido V2 por sucursal',
    escenario: 'Sucursal sin listado en HH',
    descripcion: 'La sucursal tiene activa Bandera_MultipedidoEnHH y no tiene activa BanderaListadoDeProductosEnHH.',
    esperado: 'El resultado es el mismo que da hoy el armado de su ruta, sin ronda multipedido V2.',
    cola: [ped(1001, 1), ped(1002, 2), ped(1003, 3)],
    config: cfg({ BanderaListadoDeProductosEnHH: false }),
    comprobar: { modo: 'actual', ordenEvaluacion: [] },
  },
  {
    id: 'conf-alta',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Criterios del multipedido V2 por sucursal',
    escenario: 'Configuración del alta',
    descripcion:
      'Sucursal dada de alta para el multipedido V2, con los valores del alta. 1002 va a otra dirección que el ancla, comparte 0486600 con ella y deja la ronda en 12 partidas (6 + 6).',
    esperado: '1002 se integra: la misma dirección no se exige y se cumplen el código compartido y el tope de 15.',
    cola: [
      ped(1001, 1, { codigos: cods(1001, 6, [COMUN]) }),
      ped(1002, 2, { direccion: DIR_2, codigos: cods(1002, 6, [COMUN]) }),
    ],
    config: cfg(),
    comprobar: { ronda: [1001, 1002], totalPartidas: 12, maxPartidas: 15 },
  },
  {
    id: 'conf-direccion-y-tope',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Criterios del multipedido V2 por sucursal',
    escenario: 'Misma dirección y tope de partidas activos',
    descripcion:
      'Multipedido V2 activo con Bandera_MultipedidoMismaDireccion y Bandera_MultipedidoTopePartidas activas, tope en 15. 1002 va a la misma dirección que el ancla 1001 (10 partidas) y, con sus 8, dejaría la ronda en 18.',
    esperado: '1002 no se integra: cumple la dirección pero supera el tope.',
    cola: [
      ped(1001, 1, { codigos: cods(1001, 10, [COMUN]) }),
      ped(1002, 2, { codigos: cods(1002, 8, [COMUN]) }),
    ],
    config: cfg({ Bandera_MultipedidoMismaDireccion: true, Bandera_MultipedidoTopePartidas: true }),
    comprobar: { maxPartidas: 15, ronda: [1001], rechazados: [1002], totalPartidas: 10 },
  },
  {
    id: 'conf-traspasos-y-tope',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Criterios del multipedido V2 por sucursal',
    escenario: 'Traspasos y tope de partidas activos',
    descripcion:
      'Multipedido V2 activo con Bandera_MultipedidoTraspasos y Bandera_MultipedidoTopePartidas activas, tope en 15. 1002 es un traspaso que cumple las demás reglas y deja la ronda en 12 partidas (6 + 6).',
    esperado: '1002 se integra: los traspasos están permitidos y el tope no se supera.',
    cola: [
      ped(1001, 1, { codigos: cods(1001, 6, [COMUN]) }),
      pet(1002, 2, 'traspaso', { codigos: cods(1002, 6, [COMUN]) }),
    ],
    config: cfg({ Bandera_MultipedidoTraspasos: true, Bandera_MultipedidoTopePartidas: true }),
    comprobar: { maxPartidas: 15, ronda: [1001, 1002], totalPartidas: 12 },
  },
  {
    id: 'conf-direccion-sin-asignar',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Criterios del multipedido V2 por sucursal',
    escenario: 'Misma dirección sin asignar',
    descripcion: 'Multipedido V2 activo y Bandera_MultipedidoMismaDireccion sin asignar. 1002 va a otra dirección y cumple las demás reglas.',
    esperado: '1002 se integra: la bandera cuenta como inactiva.',
    cola: [ped(1001, 1), ped(1002, 2, { direccion: DIR_2 })],
    config: cfg(sinAsignar('Bandera_MultipedidoMismaDireccion')),
    comprobar: { ronda: [1001, 1002] },
  },
  {
    id: 'conf-codigo-sin-asignar',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Criterios del multipedido V2 por sucursal',
    escenario: 'Código compartido sin asignar',
    descripcion: 'Multipedido V2 activo y Bandera_MultipedidoValidarCodigos sin asignar. 1002 no comparte ningún código con la ronda y cumple las demás reglas.',
    esperado: '1002 se integra: la bandera cuenta como inactiva.',
    cola: [ped(1001, 1), ped(1002, 2, { codigos: cods(1002, 2) })],
    config: cfg(sinAsignar('Bandera_MultipedidoValidarCodigos')),
    comprobar: { ronda: [1001, 1002] },
  },
  {
    id: 'conf-tope-sin-asignar',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Criterios del multipedido V2 por sucursal',
    escenario: 'Tope de partidas sin asignar',
    descripcion:
      'Multipedido V2 activo y Bandera_MultipedidoTopePartidas sin asignar. El ancla 1001 tiene 12 partidas y 1002, con 10, deja la ronda en 22; cumple las demás reglas.',
    esperado: '1002 se integra: la bandera cuenta como inactiva y no hay límite de partidas.',
    cola: [ped(1001, 1, { codigos: cods(1001, 12, [COMUN]) }), ped(1002, 2, { codigos: cods(1002, 10, [COMUN]) })],
    config: cfg(sinAsignar('Bandera_MultipedidoTopePartidas')),
    comprobar: { ronda: [1001, 1002], totalPartidas: 22 },
  },
  {
    id: 'conf-traspasos-sin-asignar',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Criterios del multipedido V2 por sucursal',
    escenario: 'Traspasos sin asignar',
    descripcion: 'Multipedido V2 activo y Bandera_MultipedidoTraspasos sin asignar (como la deja el alta). El candidato 1002 es un traspaso.',
    esperado: '1002 no se integra a la ronda: la bandera cuenta como inactiva.',
    cola: [ped(1001, 1), pet(1002, 2, 'traspaso')],
    config: cfg(),
    comprobar: { ronda: [1001], rechazados: [1002] },
  },
  {
    id: 'conf-parametro-cero',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Parámetros numéricos del multipedido V2',
    escenario: 'Parámetro en cero',
    descripcion: 'Multipedido V2 activo, Bandera_MultipedidoTopePartidas activa y Parametro_MultipedidoMaxPartidas en 0. Cola 1001, 1002 y 1003, todos con 0486600.',
    esperado: 'No se evalúan candidatos, cada pedido sale en su propia ronda y el armado sigue con el siguiente pedido: 1001, después 1002 y después 1003.',
    cola: [ped(1001, 1), ped(1002, 2), ped(1003, 3)],
    config: cfg({ maxPartidas: 0 }),
    comprobar: { maxPartidas: null, ordenEvaluacion: [], ronda: [1001], rondas: [[1001], [1002], [1003]] },
  },
  {
    id: 'conf-tope-cero-inactiva',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Parámetros numéricos del multipedido V2',
    escenario: 'Tope en 0 con su bandera inactiva',
    descripcion: 'Multipedido V2 activo, Bandera_MultipedidoTopePartidas inactiva y Parametro_MultipedidoMaxPartidas en 0. Cola 1001, 1002 y 1003, todos con 0486600.',
    esperado: 'Se evalúan candidatos sin límite de partidas; el valor del tope no cuenta: la ronda queda con 1001, 1002 y 1003.',
    cola: [ped(1001, 1), ped(1002, 2), ped(1003, 3)],
    config: cfg({ Bandera_MultipedidoTopePartidas: false, maxPartidas: 0 }),
    comprobar: { ordenEvaluacion: [1002, 1003], ronda: [1001, 1002, 1003] },
  },
  {
    id: 'conf-max-sin-configurar',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Parámetros numéricos del multipedido V2',
    escenario: 'Máximo de pedidos sin configurar',
    descripcion: 'Multipedido V2 activo y Parametro_MultipedidoMaxPedidos sin configurar. Cola 1001, 1002 y 1003, todos con 0486600.',
    esperado: 'No se evalúan candidatos, cada pedido sale en su propia ronda y el armado no se detiene.',
    cola: [ped(1001, 1), ped(1002, 2), ped(1003, 3)],
    config: cfg({ maxPedidos: undefined }),
    comprobar: { maxPedidos: null, ordenEvaluacion: [], rondas: [[1001], [1002], [1003]] },
  },
  {
    id: 'conf-tope-sin-configurar',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Parámetros numéricos del multipedido V2',
    escenario: 'Tope de partidas sin configurar',
    descripcion:
      'Multipedido V2 activo, Bandera_MultipedidoTopePartidas activa y Parametro_MultipedidoMaxPartidas sin configurar. Cola 1001, 1002 y 1003, todos con 0486600.',
    esperado: 'No se evalúan candidatos, cada pedido sale en su propia ronda y el armado no se detiene.',
    cola: [ped(1001, 1), ped(1002, 2), ped(1003, 3)],
    config: cfg({ maxPartidas: undefined }),
    comprobar: { maxPartidas: null, ordenEvaluacion: [], rondas: [[1001], [1002], [1003]] },
  },
  {
    id: 'conf-sin-ordenamiento',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Parámetros numéricos del multipedido V2',
    escenario: 'Sucursal sin configuración de ordenamiento',
    descripcion: 'Multipedido V2 activo y la sucursal no tiene registrada ninguna configuración de ordenamiento. Un surtidor pide su ronda.',
    esperado:
      'No recibe ronda, como hoy, con el aviso de que no hay parámetros de ordenamiento ("No se han encontrado parametros de ordenamiento dentro del AdminOPS").',
    cola: [ped(1001, 1), ped(1002, 2)],
    config: cfg({ sinConfiguracionOrdenamiento: true }),
    comprobar: { modo: 'sin-rondas', ronda: [], mensaje: 'No se han encontrado parametros de ordenamiento dentro del AdminOPS' },
  },
  {
    id: 'conf-valor-configurado',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Parámetros numéricos del multipedido V2',
    escenario: 'Valor configurado',
    descripcion:
      'Multipedido V2 activo, Bandera_MultipedidoTopePartidas activa y Parametro_MultipedidoMaxPartidas en 20. El ancla 1001 tiene 10 partidas y 1002, con 8, deja la ronda en 18.',
    esperado: '1002 se integra, aunque con el tope del alta (15) no habría entrado.',
    cola: [
      ped(1001, 1, { codigos: cods(1001, 10, [COMUN]) }),
      ped(1002, 2, { codigos: cods(1002, 8, [COMUN]) }),
    ],
    config: cfg({ maxPartidas: 20 }),
    comprobar: { maxPartidas: 20, ronda: [1001, 1002], totalPartidas: 18 },
  },
  {
    id: 'conf-cada-sucursal',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Parámetros numéricos del multipedido V2',
    escenario: 'Cada sucursal con su valor',
    descripcion:
      'Las sucursales 8 y 12 tienen el multipedido V2 activo; la 8 con Parametro_MultipedidoMaxPedidos en 4 y la 12 en 3. Las dos arman una ronda con la misma cola: 1001 a 1005, todos con 0486600.',
    esperado: 'La 8 evalúa hasta 3 candidatos (1002 a 1004) y la 12 hasta 2 (1002 y 1003).',
    cola: [ped(1001, 1), ped(1002, 2), ped(1003, 3), ped(1004, 4), ped(1005, 5)],
    config: cfg({ sucursal: 8, maxPedidos: 4 }),
    comprobar: { maxPedidos: 4, ordenEvaluacion: [1002, 1003, 1004], fueraDeVentana: [1005] },
    otraSucursal: {
      config: cfg({ sucursal: 12, maxPedidos: 3 }),
      comprobar: { maxPedidos: 3, ordenEvaluacion: [1002, 1003], fueraDeVentana: [1004, 1005] },
    },
  },
  {
    id: 'conf-division-cero',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Parámetros numéricos del multipedido V2',
    escenario: 'División de factura con el parámetro en cero',
    descripcion:
      'Multipedido V2 activo, Parametro_MultipedidoMaxPedidos en 0 y BndUnificarRondasMontos activa. El ancla 2001 viene de la factura F-88122, dividida en 3 partes (2001 a 2003). 1010 va después en la cola.',
    esperado: 'Las 3 partes van juntas, como fija "Pedidos de una división de factura", y no se evalúan otros candidatos.',
    cola: [
      ...[1, 2, 3].map((n) => ped(2000 + n, 1, { creado: `2026-11-09 07:0${n}`, division: { id: 'F-88122', parte: n } })),
      ped(1010, 2),
    ],
    config: cfg({ maxPedidos: 0, BndUnificarRondasMontos: true }),
    comprobar: { maxPedidos: null, ronda: [2001, 2002, 2003], rechazados: [], fueraDeVentana: [1010] },
  },
  {
    id: 'conf-valores-alta',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Alta de una sucursal para el multipedido V2',
    escenario: 'Valores del alta',
    descripcion:
      'Sucursal recién dada de alta para el multipedido V2. 1002 va a otra dirección que el ancla y comparte 0486600; 1003 es un traspaso; 1004 cumpliría todo pero queda fuera de los 3 pedidos.',
    esperado:
      'Se exige al menos un código compartido (1002 lo cumple), se usan 3 pedidos como máximo y 15 partidas como tope, no se exige la misma dirección (1002 entra) y no entran traspasos (1003 no entra).',
    cola: [ped(1001, 1), ped(1002, 2, { direccion: DIR_2 }), pet(1003, 3, 'traspaso'), ped(1004, 4)],
    config: cfg(),
    comprobar: { maxPedidos: 3, maxPartidas: 15, ronda: [1001, 1002], rechazados: [1003], fueraDeVentana: [1004], altaCompleta: true },
  },
  {
    id: 'conf-alta-incompleta',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Alta de una sucursal para el multipedido V2',
    escenario: 'Alta incompleta',
    descripcion:
      'A la sucursal solo se le activó Bandera_MultipedidoEnHH (con el listado en HH ya activo): Bandera_MultipedidoValidarCodigos, Bandera_MultipedidoTopePartidas y Bandera_MultipedidoMismoCliente sin asignar y los parámetros sin configurar. Se revisa su alta en la prueba de aceptación.',
    esperado: 'El alta no se da por buena hasta que tenga asignadas las cuatro banderas y los dos parámetros del alta.',
    cola: [ped(1001, 1), ped(1002, 2)],
    config: cfg({
      ...sinAsignar('Bandera_MultipedidoValidarCodigos', 'Bandera_MultipedidoTopePartidas', 'Bandera_MultipedidoMismoCliente'),
      maxPedidos: undefined,
      maxPartidas: undefined,
    }),
    comprobar: { altaCompleta: false },
  },
  {
    id: 'conf-cambio-parametro',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Cambios de configuración sin desplegar',
    escenario: 'Cambio de parámetro sin desplegar',
    descripcion:
      'Las sucursales 8 y 12 tienen el multipedido V2 activo con Parametro_MultipedidoMaxPedidos en 3. El DBA cambia el de la 8 a 4, sin desplegar. Se arma la siguiente ronda en cada una, después de que el cambio llega a la base que lee el armado. Cola 1001 a 1005, todos con 0486600.',
    esperado: 'En la 8 se evalúan hasta 3 candidatos (1002 a 1004), sin desplegar, y las rondas de la sucursal 12 no cambian (2 candidatos).',
    cola: [ped(1001, 1), ped(1002, 2), ped(1003, 3), ped(1004, 4), ped(1005, 5)],
    config: cfg({ sucursal: 8, maxPedidos: 4 }),
    comprobar: { maxPedidos: 4, ordenEvaluacion: [1002, 1003, 1004] },
    otraSucursal: {
      config: cfg({ sucursal: 12, maxPedidos: 3 }),
      comprobar: { maxPedidos: 3, ordenEvaluacion: [1002, 1003] },
    },
  },
  {
    id: 'conf-cambio-bandera',
    cambio: 'configuracion',
    capacidad: K,
    requisito: 'Cambios de configuración sin desplegar',
    escenario: 'Cambio de bandera sin desplegar',
    descripcion:
      'Las sucursales 8 y 12 tienen el multipedido V2 activo e inactiva Bandera_MultipedidoMismaDireccion; se le activa a la 8. Se arma la siguiente ronda en cada una, después de que el cambio llega a la base que lee el armado. 1002 va a otra dirección que el ancla y comparte 0486600.',
    esperado: 'La 8 exige la misma dirección (1002 no entra) y la 12 no (1002 entra).',
    cola: [ped(1001, 1), ped(1002, 2, { direccion: DIR_2 })],
    config: cfg({ sucursal: 8, Bandera_MultipedidoMismaDireccion: true }),
    comprobar: { ronda: [1001], rechazados: [1002] },
    otraSucursal: {
      config: cfg({ sucursal: 12 }),
      comprobar: { ronda: [1001, 1002] },
    },
  },
];

export const presetArmado = (id: string | undefined): PresetArmado | undefined => PRESETS_ARMADO.find((p) => p.id === id);

/* ------------------------------------------------------------------ *
 * Comprobación
 * ------------------------------------------------------------------ */

const folios = (pedidos: PedidoCola[]) => pedidos.map((p) => p.folio);
const iguales = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const lista = (xs: number[]) => (xs.length ? xs.join(', ') : 'ninguno');

/**
 * Diferencias entre el resultado del simulador y lo que el preset espera. Vacío = coincide con el spec.
 * Lo usan las pruebas de dominio y la pantalla del armado.
 */
export function verificarPreset(p: PresetArmado, r: ResultadoArmado = armarRonda(p.cola, p.config)): string[] {
  contexto.set(r, { cola: p.cola, config: p.config });
  const fallas = comparar(p.comprobar, r);
  if (p.otraSucursal) {
    const otra = armarRonda(p.cola, p.otraSucursal.config);
    contexto.set(otra, { cola: p.cola, config: p.otraSucursal.config });
    const nombre = p.otraSucursal.config.sucursal ? `Sucursal ${p.otraSucursal.config.sucursal}` : 'Otra sucursal';
    fallas.push(...comparar(p.otraSucursal.comprobar, otra).map((f) => `${nombre} · ${f}`));
  }
  return fallas;
}

/** Cola y configuración con que se armó cada resultado (para las comprobaciones que vuelven a armar). */
const contexto = new WeakMap<ResultadoArmado, { cola: PedidoCola[]; config: ConfigSucursal }>();
const cfgDe = (r: ResultadoArmado) => contexto.get(r)!.config;
const colaDe = (r: ResultadoArmado) => contexto.get(r)!.cola;

/** Diferencias entre una comprobación y un resultado del simulador. */
function comparar(c: Comprobacion, r: ResultadoArmado): string[] {
  const fallas: string[] = [];
  const revisa = (nombre: string, esperado: number[] | undefined, obtenido: number[]) => {
    if (esperado && !iguales(esperado, obtenido)) fallas.push(`${nombre}: se esperaba ${lista(esperado)} y salió ${lista(obtenido)}`);
  };
  const revisaValor = (nombre: string, esperado: string | number | boolean | undefined, obtenido: string | number | boolean | undefined) => {
    if (esperado !== undefined && esperado !== obtenido) fallas.push(`${nombre}: se esperaba ${esperado} y salió ${obtenido ?? 'nada'}`);
  };

  revisaValor('Modo', c.modo, r.modo);
  revisaValor('Ruta', c.ruta, r.ruta);
  revisaValor('Ancla', c.ancla, r.ancla?.folio);
  revisa('Ronda', c.ronda, folios(r.ronda));
  revisa('Orden de evaluación', c.ordenEvaluacion, folios(r.evaluados.map((e) => e.pedido)));
  revisa('No integrados', c.rechazados, folios(r.evaluados.filter((e) => e.estado !== 'integrado').map((e) => e.pedido)));
  revisa('Fuera de la ventana', c.fueraDeVentana, folios(r.fueraDeVentana));
  revisa('Fuera de la cola', c.fueraDeCola, folios(r.fueraDeCola.map((x) => x.pedido)));
  revisaValor('Total de partidas', c.totalPartidas, r.totalPartidas);
  revisaValor('Total de minutos', c.totalMinutos, r.totalMinutos);
  revisaValor('Franja de la ronda', c.minutosFranjaRonda, r.minutosFranjaRonda);
  revisaValor('Máximo de pedidos', c.maxPedidos === null ? 'sin configurar' : c.maxPedidos, r.maxPedidos ?? 'sin configurar');
  revisaValor('Tope de partidas', c.maxPartidas === null ? 'sin configurar' : c.maxPartidas, r.maxPartidas ?? 'sin configurar');
  revisaValor('Mensaje', c.mensaje, r.mensaje);
  if (c.reportadas) {
    const obtenidas = banderasReportadas(cfgDe(r)).join(', ') || 'ninguna';
    const esperadas = c.reportadas.join(', ') || 'ninguna';
    if (obtenidas !== esperadas) fallas.push(`Banderas reportadas: se esperaba ${esperadas} y salió ${obtenidas}`);
  }
  if (c.altaCompleta !== undefined) {
    const alta = revisarAlta(cfgDe(r));
    if (alta.completa !== c.altaCompleta) fallas.push(`Alta: se esperaba ${c.altaCompleta ? 'completa' : 'incompleta'} y salió ${alta.completa ? 'completa' : `incompleta (faltan ${alta.faltan.join(', ')})`}`);
  }
  if (c.rondas) {
    const obtenidas = armarCola(colaDe(r), cfgDe(r)).map((x) => folios(x.ronda).join('+')).join(' · ');
    const esperadas = c.rondas.map((x) => x.join('+')).join(' · ');
    if (obtenidas !== esperadas) fallas.push(`Rondas de la cola: se esperaba ${esperadas} y salió ${obtenidas}`);
  }
  if (c.presupuesto === null && r.presupuesto) fallas.push('Presupuesto: se esperaba que no se repartiera y se repartió');
  if (c.presupuesto) {
    if (!r.presupuesto) fallas.push('Presupuesto: se esperaba un reparto y no se repartió');
    else {
      revisaValor('Presupuesto foráneo', c.presupuesto.foraneo, r.presupuesto.foraneo);
      revisaValor('Presupuesto local', c.presupuesto.local, r.presupuesto.local);
      revisaValor('Presupuesto local restante', c.presupuesto.localRestante, r.presupuesto.localRestante);
    }
  }
  return fallas;
}
