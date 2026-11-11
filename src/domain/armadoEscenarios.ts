/**
 * Un preset por cada escenario de `sdd/changes/2026-10-26-multipedido-armado-ronda` (elegibilidad-ronda-multipedido y
 * catalogo-bandera-sucursal), con los datos que lo reproducen en el simulador del armado y lo que el spec
 * espera. `comprobar` es la parte verificable de ese resultado: la usan las pruebas y la pantalla, que marca
 * si el simulador coincide con el spec.
 *
 * "Corporativo retirado" (Requirement: Pedidos corporativos) y "Cancelación durante el surtido" (Requirement:
 * Pedidos retenidos o cancelados) ocurren durante el surtido de una ronda ya armada, así que se validan en el
 * listado de la HH (`enListado`), no aquí.
 */
import {
  armarRonda,
  CONFIG_INICIAL,
  type ConfigSucursal,
  type ModoArmado,
  type PedidoCola,
  type ResultadoArmado,
} from './armado';

export type CapacidadArmado = 'elegibilidad-ronda-multipedido' | 'catalogo-bandera-sucursal';

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
  totalPartidas?: number;
  totalMinutos?: number;
  /** Franja de la ronda tras ampliarla (si hizo falta). */
  minutosFranjaRonda?: number;
  maxPedidos?: number;
  maxPartidas?: number;
};

export type PresetArmado = {
  id: string;
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
  /** El escenario se valida en el surtido de la HH, no en el armado. */
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
function ped(folio: number, vence: string, extra: Partial<PedidoCola> = {}): PedidoCola {
  return {
    folio,
    vence,
    creado: '2026-11-09 08:00',
    codigos: cods(folio, 2, [COMUN]),
    servicio: 'local',
    tipo: 'cliente',
    direccion: DIR_1,
    minutos: 5,
    ...extra,
  };
}

const cfg = (cambios: Partial<ConfigSucursal> = {}): ConfigSucursal => ({ ...CONFIG_INICIAL, ...cambios });

const E = 'elegibilidad-ronda-multipedido' as const;
const C = 'catalogo-bandera-sucursal' as const;

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
    esperado: 'La ronda se arma con el algoritmo actual y 1001 se surte como hoy: no se evalúan candidatos multipedido V2.',
    cola: [ped(1001, '11:00'), ped(1002, '11:30'), ped(1003, '12:00')],
    config: cfg({ Bandera_MultipedidoEnHH: false }),
    comprobar: { modo: 'actual', ancla: 1001, ordenEvaluacion: [] },
  },
  {
    id: 'con-bandera',
    capacidad: E,
    requisito: 'Convivencia con las rondas actuales',
    escenario: 'Sucursal con la bandera',
    descripcion: 'Bandera_MultipedidoEnHH activa y BndRondaXPedido inactiva. Cola 1001, 1002 y 1003, todos con 0486600.',
    esperado: 'Se aplican las reglas del multipedido V2 y no las de OrdenesporSurtir: la ronda queda con 1001, 1002 y 1003.',
    cola: [ped(1001, '11:00'), ped(1002, '11:30'), ped(1003, '12:00')],
    config: cfg(),
    comprobar: { modo: 'multipedido', ronda: [1001, 1002, 1003], totalPartidas: 6 },
  },
  {
    id: 'sin-bandera-zona',
    capacidad: E,
    requisito: 'Convivencia con las rondas actuales',
    escenario: 'Sin la bandera, la zona sigue ordenando',
    descripcion:
      'Bandera_MultipedidoEnHH inactiva. 1001 (zona Z1) es el primero de la cola; 1002 (Z3) vence antes que 1003 (Z1). El simulador no reproduce el algoritmo actual: solo muestra que el multipedido V2 no interviene.',
    esperado:
      'La ronda se arma con el algoritmo actual, que sigue prefiriendo órdenes de la misma zona; no se aplican las reglas del multipedido V2 (el simulador no reproduce cuál elige el algoritmo actual).',
    cola: [ped(1001, '11:00', { zona: 'Z1' }), ped(1002, '11:30', { zona: 'Z3' }), ped(1003, '12:00', { zona: 'Z1' })],
    config: cfg({ Bandera_MultipedidoEnHH: false }),
    comprobar: { modo: 'actual', ancla: 1001, ordenEvaluacion: [] },
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
      ped(1001, '11:00', { creado: '2026-11-09 08:00' }),
      ped(1002, '11:30', { creado: '2026-11-09 09:00' }),
      ped(1003, '11:45', { creado: '2026-11-09 10:05' }),
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
    descripcion: 'Máximo 3 pedidos. Cola por vencimiento: 1001, 1002, 1003 y 1004.',
    esperado: 'Se evalúan 1002 y 1003 como candidatos; 1004 queda fuera de la ventana.',
    cola: [ped(1001, '11:00'), ped(1002, '11:15'), ped(1003, '11:30'), ped(1004, '11:45')],
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
    cola: [ped(1001, '11:00'), ped(1002, '11:15', { tipo: 'traspaso' }), ped(1003, '11:30'), ped(1004, '11:45')],
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
    cola: [ped(1001, '11:00')],
    config: cfg(),
    comprobar: { ronda: [1001], ordenEvaluacion: [] },
  },
  {
    id: 'vencimientos-distintos',
    capacidad: E,
    requisito: 'Pedido ancla y ventana de evaluación',
    escenario: 'Vencimientos distintos',
    descripcion: '1002 vence a las 12:00 y 1003 a las 12:30, aunque 1003 se creó antes (07:00 contra 09:00). La cola llega desordenada.',
    esperado: 'Se evalúa 1002 antes que 1003.',
    cola: [
      ped(1003, '12:30', { creado: '2026-11-09 07:00' }),
      ped(1001, '11:00'),
      ped(1002, '12:00', { creado: '2026-11-09 09:00' }),
    ],
    config: cfg(),
    comprobar: { ancla: 1001, ordenEvaluacion: [1002, 1003] },
  },
  {
    id: 'empate-ancla',
    capacidad: E,
    requisito: 'Pedido ancla y ventana de evaluación',
    escenario: 'Empate de vencimiento en el ancla',
    descripcion: '1001 y 1002 vencen a las 12:00; 1002 se creó antes (08:00 contra 09:00). 1003 vence a las 12:30.',
    esperado: '1002 es el ancla y 1001 se evalúa como candidato.',
    cola: [
      ped(1001, '12:00', { creado: '2026-11-09 09:00' }),
      ped(1002, '12:00', { creado: '2026-11-09 08:00' }),
      ped(1003, '12:30'),
    ],
    config: cfg(),
    comprobar: { ancla: 1002, ordenEvaluacion: [1001, 1003] },
  },
  {
    id: 'empate-candidatos',
    capacidad: E,
    requisito: 'Pedido ancla y ventana de evaluación',
    escenario: 'Empate de vencimiento entre candidatos',
    descripcion: '1003 y 1004 vencen a las 12:00; 1004 se creó antes (07:30 contra 08:00).',
    esperado: 'Se evalúa 1004 antes que 1003.',
    cola: [ped(1001, '11:00'), ped(1003, '12:00', { creado: '2026-11-09 08:00' }), ped(1004, '12:00', { creado: '2026-11-09 07:30' })],
    config: cfg(),
    comprobar: { ordenEvaluacion: [1004, 1003] },
  },
  {
    id: 'empate-partidas',
    capacidad: E,
    requisito: 'Pedido ancla y ventana de evaluación',
    escenario: 'Empate de vencimiento y de creación',
    descripcion: '1003 y 1004 vencen a la misma hora y se crearon al mismo tiempo; 1003 tiene 8 partidas y 1004 tiene 3.',
    esperado: 'Se evalúa 1004 antes que 1003.',
    cola: [
      ped(1001, '11:00'),
      ped(1003, '12:00', { codigos: cods(1003, 8, [COMUN]) }),
      ped(1004, '12:00', { codigos: cods(1004, 3, [COMUN]) }),
    ],
    config: cfg(),
    comprobar: { ordenEvaluacion: [1004, 1003] },
  },
  {
    id: 'empate-folio',
    capacidad: E,
    requisito: 'Pedido ancla y ventana de evaluación',
    escenario: 'Empate en vencimiento, creación y partidas',
    descripcion: '1050 y 1032 vencen a la misma hora, se crearon al mismo tiempo y tienen 5 partidas cada uno.',
    esperado: 'Se evalúa 1032 antes que 1050.',
    cola: [
      ped(1001, '11:00'),
      ped(1050, '12:00', { codigos: cods(1050, 5, [COMUN]) }),
      ped(1032, '12:00', { codigos: cods(1032, 5, [COMUN]) }),
    ],
    config: cfg(),
    comprobar: { ordenEvaluacion: [1032, 1050] },
  },
  {
    id: 'zona-no-cuenta',
    capacidad: E,
    requisito: 'Pedido ancla y ventana de evaluación',
    escenario: 'La zona no cuenta',
    descripcion: '1002 y 1003 vencen a la misma hora; 1003 está en la zona del ancla (Z1) y 1002 se creó antes.',
    esperado: 'Se evalúa 1002 antes que 1003.',
    cola: [
      ped(1001, '11:00', { zona: 'Z1' }),
      ped(1003, '12:00', { zona: 'Z1', creado: '2026-11-09 08:00' }),
      ped(1002, '12:00', { zona: 'Z3', creado: '2026-11-09 07:00' }),
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
    cola: [ped(1001, '11:00'), ped(1002, '11:30', { codigos: cods(1002, 2) }), ped(1003, '12:00')],
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
    cola: [ped(1001, '11:00'), ped(1002, '11:30', { codigos: cods(1002, 2) }), ped(1003, '12:00', { codigos: cods(1003, 2) })],
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
    cola: [ped(1001, '11:00'), ped(1002, '11:30', { servicio: 'foraneo' })],
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
    cola: [ped(1001, '11:00'), ped(1002, '11:30')],
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
      'BndUnificarRondasMontos activa, máximo 3 pedidos y 15 partidas. El ancla 2001 es la parte 1 de la factura F-88120, dividida en 5 partes (2001 a 2005) con 22 partidas. 1010 vence después.',
    esperado: 'Las 5 partes entran a la misma ronda (5 pedidos, 22 partidas).',
    cola: [
      ...[5, 5, 4, 4, 4].map((n, i) =>
        ped(2001 + i, '10:00', {
          creado: `2026-11-09 07:0${i + 1}`,
          codigos: cods(2001 + i, n, [COMUN]),
          division: { id: 'F-88120', parte: i + 1 },
          minutos: 4,
        }),
      ),
      ped(1010, '10:30'),
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
      ped(2000 + n, '10:00', {
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
      ped(1001, '11:00'),
      ped(2001, '11:15', { division: { id: 'F-77310', parte: 1 } }),
      ped(1003, '11:30'),
      ped(2002, '11:45', { division: { id: 'F-77310', parte: 2 } }),
      ped(2003, '11:45', { division: { id: 'F-77310', parte: 3 }, creado: '2026-11-09 08:01' }),
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
    cola: [ped(1001, '11:00'), ped(1002, '11:30', { tipo: 'traspaso' }), ped(1003, '12:00')],
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
    cola: [ped(1001, '11:00'), ped(1002, '11:30', { tipo: 'traspaso' })],
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
    cola: [ped(1001, '11:00'), ped(1003, '12:00', { codigos: cods(1003, 2) })],
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
    cola: [ped(1001, '11:00'), ped(1003, '12:00', { direccion: DIR_2 })],
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
    cola: [ped(1001, '11:00'), ped(1003, '12:00', { codigos: cods(1003, 2) })],
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
    cola: [ped(1001, '11:00'), ped(1003, '12:00')],
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
      ped(1001, '11:00', { codigos: ['0486600', '1394010'] }),
      ped(1002, '11:30', { codigos: ['1394010', '2389475'] }),
      ped(1003, '12:00', { codigos: ['2389475', '6200401'] }),
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
    cola: [ped(1001, '11:00'), ped(1003, '12:00', { direccion: DIR_2, codigos: cods(1003, 2) })],
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
    cola: [ped(1001, '11:00'), ped(1002, '11:30', { retenido: true }), ped(1003, '12:00')],
    config: cfg(),
    comprobar: { ronda: [1001, 1003], rechazados: [1002] },
  },
  {
    id: 'ancla-retenida',
    capacidad: E,
    requisito: 'Pedidos retenidos o cancelados',
    escenario: 'Ancla retenida',
    descripcion: '1001 está retenido y llega al frente de la cola; 1002 y 1003 cumplirían todo.',
    esperado: 'No se arma ronda multipedido V2 con 1001 y 1001 se surte solo.',
    cola: [ped(1001, '11:00', { retenido: true }), ped(1002, '11:30'), ped(1003, '12:00')],
    config: cfg(),
    comprobar: { ancla: 1001, ronda: [1001], ordenEvaluacion: [] },
  },
  {
    id: 'candidato-cancelado',
    capacidad: E,
    requisito: 'Pedidos retenidos o cancelados',
    escenario: 'Candidato cancelado',
    descripcion: '1002 está cancelado y cumpliría las demás reglas; 1003 y 1004 cumplen todo.',
    esperado: '1002 no llega a la cola: no se evalúa ni se integra. La ronda queda con 1001, 1003 y 1004.',
    cola: [ped(1001, '11:00'), ped(1002, '11:30', { cancelado: true }), ped(1003, '12:00'), ped(1004, '12:30')],
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
      'La cancelación llega con la ronda ya armada y en surtido (cambio 2026-11-05-multipedido-surtido-listado-cierre · Pedido cancelado durante el surtido). Ábrelo desde el panel de escenarios de la demo, en los casos del pedido cancelado: el listado no cambia, al finalizar se avisa y la ronda se cierra sin el cancelado.',
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
      ped(1001, '11:00', { codigos: cods(1001, 6, ['0486600', '2389475']) }),
      ped(1002, '11:30', { codigos: cods(1002, 7, ['0486600', '2389475']) }),
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
    cola: [ped(1001, '11:00', { codigos: cods(1001, 6) }), ped(1002, '11:30', { codigos: cods(1002, 7) })],
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
      ped(1001, '11:00', { codigos: cods(1001, 6) }),
      ped(1002, '11:30', { codigos: cods(1002, 7) }),
      ped(1003, '12:00', { codigos: cods(1003, 2) }),
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
      ped(1001, '11:00', { codigos: cods(1001, 6) }),
      ped(1002, '11:30', { codigos: cods(1002, 7) }),
      ped(1003, '12:00', { codigos: cods(1003, 4) }),
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
    cola: [ped(1001, '11:00', { codigos: cods(1001, 18, [COMUN]) }), ped(1002, '11:30'), ped(1003, '12:00')],
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
      ped(1001, '11:00', { codigos: cods(1001, 9, [COMUN]) }),
      ped(1002, '11:30', { codigos: cods(1002, 5, [COMUN]) }),
      ped(1003, '12:00', { codigos: cods(1003, 4, [COMUN]) }),
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
      ped(1001, '11:00', { codigos: cods(1001, 6, [COMUN]) }),
      ped(1002, '11:30', { codigos: cods(1002, 7, [COMUN]) }),
      ped(1003, '12:00', { codigos: cods(1003, 9, [COMUN]) }),
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
    cola: [ped(1001, '11:00', { minutos: 6 }), ped(1002, '11:30', { minutos: 8 }), ped(1003, '12:00', { minutos: 9 })],
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
    cola: [ped(1001, '11:00', { minutos: 8 }), ped(1002, '11:30', { minutos: 7 })],
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
    cola: [ped(1001, '11:00', { minutos: 8 }), ped(1002, '11:30', { minutos: 7 }), ped(1003, '12:00', { minutos: 9 })],
    config: cfg({ minutosFranja: 20 }),
    comprobar: { ronda: [1001, 1002, 1003], totalMinutos: 24, minutosFranjaRonda: 24 },
  },
  {
    id: 'ampliacion-sin-tope',
    capacidad: E,
    requisito: 'Tiempo de la franja de la ronda',
    escenario: 'Ampliación sin tope',
    descripcion: 'La franja permite 20 minutos. El ancla 1001 estima 20 y el siguiente a vencer, 1002, estima 30 y cumple todas las reglas.',
    esperado: '1002 se integra y la franja de la ronda queda en 50 minutos.',
    cola: [ped(1001, '11:00', { minutos: 20 }), ped(1002, '11:30', { minutos: 30 })],
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
      ped(1001, '11:00', { minutos: 8 }),
      ped(1002, '11:15', { minutos: 7 }),
      ped(1003, '11:30', { minutos: 9 }),
      ped(1004, '11:45', { minutos: 6 }),
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
    cola: [ped(1001, '11:00', { minutos: 8 }), ped(1002, '11:30', { minutos: 15, tipo: 'traspaso' })],
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
      'Bandera_MultipedidoEnHH, BndRondaXPedido y BndUnificarRondasMontos activas. El ancla 2001 es la parte 1 de la factura F-88121, dividida en 3 partes (2001 a 2003). 1010 vence después y cumpliría todo.',
    esperado: 'Las 3 partes entran juntas a la ronda y no se evalúan más candidatos: 1010 no se evalúa.',
    cola: [
      ...[1, 2, 3].map((n) =>
        ped(2000 + n, '10:00', { creado: `2026-11-09 07:0${n}`, division: { id: 'F-88121', parte: n } }),
      ),
      ped(1010, '10:30'),
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
    cola: [ped(1001, '11:00'), ped(1002, '11:30'), ped(1003, '12:00')],
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
    cola: [ped(1001, '11:00'), ped(1002, '11:30')],
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
    cola: [ped(1001, '11:00'), ped(1002, '11:30', { codigos: cods(1002, 2) }), ped(1003, '12:00', { codigos: cods(1003, 2) })],
    config: cfg({ BndRondaXPedido: true }),
    comprobar: { modo: 'multipedido', ronda: [1001], rechazados: [1002, 1003], fueraDeVentana: [] },
  },
  {
    id: 'surtido-unificado',
    capacidad: E,
    requisito: 'Orden de evaluación con otras banderas',
    escenario: 'Sucursal con surtido unificado',
    descripcion: 'Bandera_RevisionPedidoEnHH activa. 1002 y 1003 cumplirían todos los criterios.',
    esperado: '1001 se surte solo aunque existan candidatos que cumplan.',
    cola: [ped(1001, '11:00'), ped(1002, '11:30'), ped(1003, '12:00')],
    config: cfg({ Bandera_RevisionPedidoEnHH: true }),
    comprobar: { modo: 'unificado', ronda: [1001], ordenEvaluacion: [] },
  },

  /* ---- Pedidos corporativos ---- */
  {
    id: 'corporativo-retirado',
    capacidad: E,
    requisito: 'Pedidos corporativos',
    escenario: 'Corporativo retirado',
    descripcion:
      'Una ronda con un corporativo integrado, que se retira durante el surtido. Los corporativos se evalúan con las mismas reglas que los demás; el retiro ocurre en el listado de la HH.',
    esperado: 'Se puede consultar a qué grupo perteneció y con qué órdenes.',
    cola: [],
    config: cfg(),
    comprobar: {},
    enListado: true,
    textoListado:
      'El retiro de un pedido corporativo se hace desde el listado de la HH (Requirement: Sacar el pedido de la ronda). Ábrelo desde el panel de escenarios de la demo, en el escenario del corporativo retirado: ahí se ve qué pedido salió, de qué ronda y con qué órdenes iba.',
  },

  /* ---- Catálogo · Banderas del multipedido V2 ---- */
  {
    id: 'cat-sin-multipedido-v2',
    capacidad: C,
    requisito: 'Banderas del multipedido V2',
    escenario: 'Sucursal sin multipedido V2',
    descripcion: 'Bandera_MultipedidoEnHH inactiva. Se envía 1001 a surtir.',
    esperado: '1001 se surte como hoy.',
    cola: [ped(1001, '11:00'), ped(1002, '11:30')],
    config: cfg({ Bandera_MultipedidoEnHH: false }),
    comprobar: { modo: 'actual', ronda: [1001] },
  },
  {
    id: 'cat-config-inicial',
    capacidad: C,
    requisito: 'Banderas del multipedido V2',
    escenario: 'Configuración inicial al liberar a productivo',
    descripcion:
      'Bandera_MultipedidoEnHH activa y las demás en su valor inicial. 1002 va a otra dirección que el ancla, comparte 0486600 y deja la ronda en 12 partidas (6 + 6).',
    esperado: '1002 se integra: la misma dirección no se exige y se cumplen el código compartido y el tope de 15.',
    cola: [
      ped(1001, '11:00', { codigos: cods(1001, 6, [COMUN]) }),
      ped(1002, '11:30', { direccion: DIR_2, codigos: cods(1002, 6, [COMUN]) }),
    ],
    config: cfg(),
    comprobar: { ronda: [1001, 1002], totalPartidas: 12 },
  },
  {
    id: 'cat-por-pedido',
    capacidad: C,
    requisito: 'Banderas del multipedido V2',
    escenario: 'Multipedido V2 con ronda por pedido',
    descripcion:
      'Bandera_MultipedidoEnHH y BndRondaXPedido activas. Se envía 1001 a surtir y no hay más pedidos en la cola. ' +
      'Ojo: el THEN de este escenario ("sin candidatos") choca con "La ronda por pedido no impide evaluar candidatos" ' +
      '(elegibilidad · Orden de evaluación con otras banderas), pendiente de aclarar en la spec. El preset usa una cola sin ' +
      'más pedidos, donde las dos lecturas coinciden.',
    esperado: '1001 se surte en su propia ronda, sin candidatos.',
    cola: [ped(1001, '11:00')],
    config: cfg({ BndRondaXPedido: true }),
    comprobar: { modo: 'multipedido', ronda: [1001], ordenEvaluacion: [] },
  },
  {
    id: 'cat-direccion-y-tope',
    capacidad: C,
    requisito: 'Banderas del multipedido V2',
    escenario: 'Misma dirección y tope de partidas activos',
    descripcion:
      'Bandera_MultipedidoMismaDireccion y Bandera_MultipedidoTopePartidas activas, tope en 15. 1002 va a la misma dirección que el ancla 1001 (10 partidas) y, con sus 8, dejaría la ronda en 18.',
    esperado: '1002 no se integra: cumple la dirección pero supera el tope.',
    cola: [
      ped(1001, '11:00', { codigos: cods(1001, 10, [COMUN]) }),
      ped(1002, '11:30', { codigos: cods(1002, 8, [COMUN]) }),
    ],
    config: cfg({ Bandera_MultipedidoMismaDireccion: true, Bandera_MultipedidoTopePartidas: true }),
    comprobar: { maxPartidas: 15, ronda: [1001], rechazados: [1002], totalPartidas: 10 },
  },
  {
    id: 'cat-traspasos-y-tope',
    capacidad: C,
    requisito: 'Banderas del multipedido V2',
    escenario: 'Traspasos y tope de partidas activos',
    descripcion:
      'Bandera_MultipedidoTraspasos y Bandera_MultipedidoTopePartidas activas, tope en 15. 1002 es un traspaso que cumple las demás reglas y deja la ronda en 12 partidas (6 + 6).',
    esperado: '1002 se integra: los traspasos están permitidos y el tope no se supera.',
    cola: [
      ped(1001, '11:00', { codigos: cods(1001, 6, [COMUN]) }),
      ped(1002, '11:30', { tipo: 'traspaso', codigos: cods(1002, 6, [COMUN]) }),
    ],
    config: cfg({ Bandera_MultipedidoTraspasos: true, Bandera_MultipedidoTopePartidas: true }),
    comprobar: { maxPartidas: 15, ronda: [1001, 1002], totalPartidas: 12 },
  },
  {
    id: 'cat-traspasos-inicial',
    capacidad: C,
    requisito: 'Banderas del multipedido V2',
    escenario: 'Traspasos con la configuración inicial',
    descripcion: 'Bandera_MultipedidoEnHH activa y Bandera_MultipedidoTraspasos inactiva. El candidato 1002 es un traspaso.',
    esperado: '1002 no se integra a la ronda.',
    cola: [ped(1001, '11:00'), ped(1002, '11:30', { tipo: 'traspaso' })],
    config: cfg(),
    comprobar: { ronda: [1001], rechazados: [1002] },
  },

  /* ---- Catálogo · Parámetros numéricos del multipedido V2 ---- */
  {
    id: 'cat-valores-iniciales',
    capacidad: C,
    requisito: 'Parámetros numéricos del multipedido V2',
    escenario: 'Valores iniciales',
    descripcion: 'Bandera_MultipedidoEnHH activa y sin parámetros configurados. Cola 1001 a 1004.',
    esperado: 'Se usan 3 pedidos como máximo y 15 partidas como tope: la ronda queda con 1001, 1002 y 1003, y 1004 queda fuera.',
    cola: [ped(1001, '11:00'), ped(1002, '11:15'), ped(1003, '11:30'), ped(1004, '11:45')],
    config: cfg(),
    comprobar: { maxPedidos: 3, maxPartidas: 15, ronda: [1001, 1002, 1003], fueraDeVentana: [1004] },
  },
  {
    id: 'cat-valor-configurado',
    capacidad: C,
    requisito: 'Parámetros numéricos del multipedido V2',
    escenario: 'Valor configurado',
    descripcion: 'Parametro_MultipedidoMaxPartidas en 20. El ancla 1001 tiene 10 partidas y 1002, con 8, deja la ronda en 18.',
    esperado: '1002 se integra (con el valor inicial de 15 no habría cabido).',
    cola: [
      ped(1001, '11:00', { codigos: cods(1001, 10, [COMUN]) }),
      ped(1002, '11:30', { codigos: cods(1002, 8, [COMUN]) }),
    ],
    config: cfg({ maxPartidas: 20 }),
    comprobar: { maxPartidas: 20, ronda: [1001, 1002], totalPartidas: 18 },
  },
  {
    id: 'cat-cada-sucursal',
    capacidad: C,
    requisito: 'Parámetros numéricos del multipedido V2',
    escenario: 'Cada sucursal con su valor',
    descripcion:
      'La sucursal 8 tiene el máximo de pedidos en 4 y la sucursal 12 lo tiene en 3. Las dos arman una ronda con la misma cola: 1001 a 1005, todos con 0486600.',
    esperado: 'La 8 evalúa hasta 3 candidatos (1002 a 1004) y la 12 hasta 2 (1002 y 1003).',
    cola: [ped(1001, '11:00'), ped(1002, '11:15'), ped(1003, '11:30'), ped(1004, '11:45'), ped(1005, '12:00')],
    config: cfg({ sucursal: 8, maxPedidos: 4 }),
    comprobar: { maxPedidos: 4, ordenEvaluacion: [1002, 1003, 1004], fueraDeVentana: [1005] },
    otraSucursal: {
      config: cfg({ sucursal: 12, maxPedidos: 3 }),
      comprobar: { maxPedidos: 3, ordenEvaluacion: [1002, 1003], fueraDeVentana: [1004, 1005] },
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
  const fallas = comparar(p.comprobar, r);
  if (p.otraSucursal) {
    const otra = armarRonda(p.cola, p.otraSucursal.config);
    const nombre = p.otraSucursal.config.sucursal ? `Sucursal ${p.otraSucursal.config.sucursal}` : 'Otra sucursal';
    fallas.push(...comparar(p.otraSucursal.comprobar, otra).map((f) => `${nombre} · ${f}`));
  }
  return fallas;
}

/** Diferencias entre una comprobación y un resultado del simulador. */
function comparar(c: Comprobacion, r: ResultadoArmado): string[] {
  const fallas: string[] = [];
  const revisa = (nombre: string, esperado: number[] | undefined, obtenido: number[]) => {
    if (esperado && !iguales(esperado, obtenido)) fallas.push(`${nombre}: se esperaba ${lista(esperado)} y salió ${lista(obtenido)}`);
  };
  const revisaValor = (nombre: string, esperado: string | number | undefined, obtenido: string | number | undefined) => {
    if (esperado !== undefined && esperado !== obtenido) fallas.push(`${nombre}: se esperaba ${esperado} y salió ${obtenido ?? 'nada'}`);
  };

  revisaValor('Modo', c.modo, r.modo);
  revisaValor('Ancla', c.ancla, r.ancla?.folio);
  revisa('Ronda', c.ronda, folios(r.ronda));
  revisa('Orden de evaluación', c.ordenEvaluacion, folios(r.evaluados.map((e) => e.pedido)));
  revisa('No integrados', c.rechazados, folios(r.evaluados.filter((e) => e.estado !== 'integrado').map((e) => e.pedido)));
  revisa('Fuera de la ventana', c.fueraDeVentana, folios(r.fueraDeVentana));
  revisa('Fuera de la cola', c.fueraDeCola, folios(r.fueraDeCola.map((x) => x.pedido)));
  revisaValor('Total de partidas', c.totalPartidas, r.totalPartidas);
  revisaValor('Total de minutos', c.totalMinutos, r.totalMinutos);
  revisaValor('Franja de la ronda', c.minutosFranjaRonda, r.minutosFranjaRonda);
  revisaValor('Máximo de pedidos', c.maxPedidos, r.maxPedidos);
  revisaValor('Tope de partidas', c.maxPartidas, r.maxPartidas);
  return fallas;
}
