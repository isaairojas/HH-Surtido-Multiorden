/**
 * Un preset por cada escenario de `sdd/changes/2026-10-26-multiorden-armado-ronda` (elegibilidad-ronda-multiorden y
 * catalogo-bandera-sucursal), con los datos que lo reproducen en el simulador del armado y lo que el spec
 * espera. `comprobar` es la parte verificable de ese resultado: la usan las pruebas y la pantalla, que marca
 * si el simulador coincide con el spec.
 *
 * "Corporativo retirado" (Requirement: Pedidos corporativos) ocurre al sacar el pedido de la ronda durante el
 * surtido, así que se valida en el listado de la HH (`enListado`), no aquí.
 */
import {
  armarRonda,
  CONFIG_INICIAL,
  type ConfigSucursal,
  type ModoArmado,
  type PedidoCola,
  type ResultadoArmado,
} from './armado';

export type CapacidadArmado = 'elegibilidad-ronda-multiorden' | 'catalogo-bandera-sucursal';

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

const E = 'elegibilidad-ronda-multiorden' as const;
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
    descripcion: 'Bandera_MultiordenEnHH inactiva. Cola 1001, 1002 y 1003, que cumplirían todos los criterios.',
    esperado: 'La ronda se arma con el algoritmo actual y 1001 se surte como hoy: no se evalúan candidatos multi-orden.',
    cola: [ped(1001, '11:00'), ped(1002, '11:30'), ped(1003, '12:00')],
    config: cfg({ Bandera_MultiordenEnHH: false }),
    comprobar: { modo: 'actual', ancla: 1001, ordenEvaluacion: [] },
  },
  {
    id: 'con-bandera',
    capacidad: E,
    requisito: 'Convivencia con las rondas actuales',
    escenario: 'Sucursal con la bandera',
    descripcion: 'Bandera_MultiordenEnHH activa y BndRondaXPedido inactiva. Cola 1001, 1002 y 1003, todos con 0486600.',
    esperado: 'Se aplican las reglas del multi-orden y no las de OrdenesporSurtir: la ronda queda con 1001, 1002 y 1003.',
    cola: [ped(1001, '11:00'), ped(1002, '11:30'), ped(1003, '12:00')],
    config: cfg(),
    comprobar: { modo: 'multiorden', ronda: [1001, 1002, 1003], totalPartidas: 6 },
  },
  {
    id: 'ronda-por-pedido',
    capacidad: E,
    requisito: 'Convivencia con las rondas actuales',
    escenario: 'La ronda por pedido prevalece',
    descripcion: 'Bandera_MultiordenEnHH y BndRondaXPedido activas. 1001 es el primero de la cola y 1002 cumple todos los criterios.',
    esperado: '1001 se surte en su propia ronda y 1002 en otra, cada uno solo.',
    cola: [ped(1001, '11:00'), ped(1002, '11:30')],
    config: cfg({ BndRondaXPedido: true }),
    comprobar: { modo: 'por-pedido', ronda: [1001], ordenEvaluacion: [] },
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

  /* ---- Tipo de pedido ---- */
  {
    id: 'traspaso-en-ventana',
    capacidad: E,
    requisito: 'Tipo de pedido',
    escenario: 'Traspaso en la ventana',
    descripcion: 'Configuración inicial (Bandera_MultiordenTraspasos inactiva). 1002 es un traspaso; 1003 es pedido de cliente.',
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
    descripcion: 'Bandera_MultiordenTraspasos activa. 1002 es un traspaso que cumple las demás reglas.',
    esperado: '1002 se integra.',
    cola: [ped(1001, '11:00'), ped(1002, '11:30', { tipo: 'traspaso' })],
    config: cfg({ Bandera_MultiordenTraspasos: true }),
    comprobar: { ronda: [1001, 1002] },
  },

  /* ---- Criterios de afinidad ---- */
  {
    id: 'direccion-sin-codigos',
    capacidad: E,
    requisito: 'Criterios de afinidad',
    escenario: 'Solo misma dirección, sin códigos en común',
    descripcion: 'Solo Bandera_MultiordenMismaDireccion activa. 1003 va a la misma dirección que el ancla y no comparte códigos.',
    esperado: '1003 cumple la afinidad y se integra.',
    cola: [ped(1001, '11:00'), ped(1003, '12:00', { codigos: cods(1003, 2) })],
    config: cfg({ Bandera_MultiordenMismaDireccion: true, Bandera_MultiordenValidarCodigos: false }),
    comprobar: { ronda: [1001, 1003] },
  },
  {
    id: 'direccion-otra',
    capacidad: E,
    requisito: 'Criterios de afinidad',
    escenario: 'Solo misma dirección, otra dirección',
    descripcion: 'Solo Bandera_MultiordenMismaDireccion activa. 1003 va a otra dirección, aunque comparte 0486600.',
    esperado: '1003 no se integra.',
    cola: [ped(1001, '11:00'), ped(1003, '12:00', { direccion: DIR_2 })],
    config: cfg({ Bandera_MultiordenMismaDireccion: true, Bandera_MultiordenValidarCodigos: false }),
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
    config: cfg({ Bandera_MultiordenMismaDireccion: true, Bandera_MultiordenValidarCodigos: true }),
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
    config: cfg({ Bandera_MultiordenMismaDireccion: true, Bandera_MultiordenValidarCodigos: true }),
    comprobar: { ronda: [1001, 1003] },
  },
  {
    id: 'codigo-con-integrado',
    capacidad: E,
    requisito: 'Criterios de afinidad',
    escenario: 'Comparte código con un candidato ya integrado',
    descripcion:
      'Solo Bandera_MultiordenValidarCodigos activa. 1002 comparte 1394010 con el ancla 1001 y se integra; 1003 no comparte con 1001, pero sí 2389475 con 1002.',
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
    config: cfg({ Bandera_MultiordenMismaDireccion: false, Bandera_MultiordenValidarCodigos: false }),
    comprobar: { ronda: [1001, 1003] },
  },

  /* ---- Pedidos retenidos ---- */
  {
    id: 'candidato-retenido',
    capacidad: E,
    requisito: 'Pedidos retenidos',
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
    requisito: 'Pedidos retenidos',
    escenario: 'Ancla retenida',
    descripcion: '1001 está retenido y llega al frente de la cola; 1002 y 1003 cumplirían todo.',
    esperado: 'No se arma ronda multi-orden con 1001 y 1001 se surte solo.',
    cola: [ped(1001, '11:00', { retenido: true }), ped(1002, '11:30'), ped(1003, '12:00')],
    config: cfg(),
    comprobar: { ancla: 1001, ronda: [1001], ordenEvaluacion: [] },
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
      'Tope 15. El ancla 1001 tiene 6 partidas y 1002 tiene 7, sin códigos en común (Bandera_MultiordenValidarCodigos inactiva para aislar el tope).',
    esperado: '1002 se integra y la ronda suma 13.',
    cola: [ped(1001, '11:00', { codigos: cods(1001, 6) }), ped(1002, '11:30', { codigos: cods(1002, 7) })],
    config: cfg({ Bandera_MultiordenValidarCodigos: false }),
    comprobar: { ronda: [1001, 1002], totalPartidas: 13 },
  },
  {
    id: 'justo-en-tope',
    capacidad: E,
    requisito: 'Tope de partidas por ronda',
    escenario: 'Justo en el tope',
    descripcion:
      'Tope 15. La ronda suma 13 (1001 con 6 y 1002 con 7) y 1003 tiene 2 partidas que no están en la ronda (Bandera_MultiordenValidarCodigos inactiva).',
    esperado: '1003 se integra y la ronda suma 15.',
    cola: [
      ped(1001, '11:00', { codigos: cods(1001, 6) }),
      ped(1002, '11:30', { codigos: cods(1002, 7) }),
      ped(1003, '12:00', { codigos: cods(1003, 2) }),
    ],
    config: cfg({ Bandera_MultiordenValidarCodigos: false }),
    comprobar: { ronda: [1001, 1002, 1003], totalPartidas: 15 },
  },
  {
    id: 'tercero-no-cabe',
    capacidad: E,
    requisito: 'Tope de partidas por ronda',
    escenario: 'El tercero no cabe',
    descripcion:
      'Tope 15. La ronda suma 13 (1001 con 6 y 1002 con 7) y 1003 tiene 4 partidas que no están en la ronda (Bandera_MultiordenValidarCodigos inactiva).',
    esperado: '1003 no se integra; la ronda se queda en 13.',
    cola: [
      ped(1001, '11:00', { codigos: cods(1001, 6) }),
      ped(1002, '11:30', { codigos: cods(1002, 7) }),
      ped(1003, '12:00', { codigos: cods(1003, 4) }),
    ],
    config: cfg({ Bandera_MultiordenValidarCodigos: false }),
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
    id: 'tope-desactivado',
    capacidad: E,
    requisito: 'Tope de partidas por ronda',
    escenario: 'Tope desactivado',
    descripcion: 'Bandera_MultiordenTopePartidas inactiva. La ronda suma 13 (1001 con 6 y 1002 con 7) y 1003 tiene 9 partidas; todos comparten 0486600.',
    esperado: '1003 se integra y la ronda suma 22.',
    cola: [
      ped(1001, '11:00', { codigos: cods(1001, 6, [COMUN]) }),
      ped(1002, '11:30', { codigos: cods(1002, 7, [COMUN]) }),
      ped(1003, '12:00', { codigos: cods(1003, 9, [COMUN]) }),
    ],
    config: cfg({ Bandera_MultiordenTopePartidas: false }),
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

  /* ---- Surtido unificado con revisión excluye multi-orden ---- */
  {
    id: 'surtido-unificado',
    capacidad: E,
    requisito: 'Surtido unificado con revisión excluye multi-orden',
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
  },

  /* ---- Catálogo · Banderas del multi-orden ---- */
  {
    id: 'cat-sin-multiorden',
    capacidad: C,
    requisito: 'Banderas del multi-orden',
    escenario: 'Sucursal sin multi-orden',
    descripcion: 'Bandera_MultiordenEnHH inactiva. Se envía 1001 a surtir.',
    esperado: '1001 se surte como hoy.',
    cola: [ped(1001, '11:00'), ped(1002, '11:30')],
    config: cfg({ Bandera_MultiordenEnHH: false }),
    comprobar: { modo: 'actual', ronda: [1001] },
  },
  {
    id: 'cat-config-inicial',
    capacidad: C,
    requisito: 'Banderas del multi-orden',
    escenario: 'Configuración inicial al liberar a productivo',
    descripcion:
      'Bandera_MultiordenEnHH activa y las demás en su valor inicial. 1002 va a otra dirección que el ancla, comparte 0486600 y deja la ronda en 12 partidas (6 + 6).',
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
    requisito: 'Banderas del multi-orden',
    escenario: 'Multi-orden con ronda por pedido',
    descripcion: 'Bandera_MultiordenEnHH y BndRondaXPedido activas. Se envía 1001 a surtir.',
    esperado: '1001 se surte en su propia ronda, sin candidatos.',
    cola: [ped(1001, '11:00'), ped(1002, '11:30')],
    config: cfg({ BndRondaXPedido: true }),
    comprobar: { modo: 'por-pedido', ronda: [1001], ordenEvaluacion: [] },
  },
  {
    id: 'cat-traspasos-inicial',
    capacidad: C,
    requisito: 'Banderas del multi-orden',
    escenario: 'Traspasos con la configuración inicial',
    descripcion: 'Bandera_MultiordenEnHH activa y Bandera_MultiordenTraspasos inactiva. El candidato 1002 es un traspaso.',
    esperado: '1002 no se integra a la ronda.',
    cola: [ped(1001, '11:00'), ped(1002, '11:30', { tipo: 'traspaso' })],
    config: cfg(),
    comprobar: { ronda: [1001], rechazados: [1002] },
  },

  /* ---- Catálogo · Parámetros numéricos del multi-orden ---- */
  {
    id: 'cat-valores-iniciales',
    capacidad: C,
    requisito: 'Parámetros numéricos del multi-orden',
    escenario: 'Valores iniciales',
    descripcion: 'Bandera_MultiordenEnHH activa y sin parámetros configurados. Cola 1001 a 1004.',
    esperado: 'Se usan 3 pedidos como máximo y 15 partidas como tope: la ronda queda con 1001, 1002 y 1003, y 1004 queda fuera.',
    cola: [ped(1001, '11:00'), ped(1002, '11:15'), ped(1003, '11:30'), ped(1004, '11:45')],
    config: cfg(),
    comprobar: { maxPedidos: 3, maxPartidas: 15, ronda: [1001, 1002, 1003], fueraDeVentana: [1004] },
  },
  {
    id: 'cat-valor-configurado',
    capacidad: C,
    requisito: 'Parámetros numéricos del multi-orden',
    escenario: 'Valor configurado',
    descripcion: 'Parametro_MultiordenMaxPartidas en 20. El ancla 1001 tiene 10 partidas y 1002, con 8, deja la ronda en 18.',
    esperado: '1002 se integra (con el valor inicial de 15 no habría cabido).',
    cola: [
      ped(1001, '11:00', { codigos: cods(1001, 10, [COMUN]) }),
      ped(1002, '11:30', { codigos: cods(1002, 8, [COMUN]) }),
    ],
    config: cfg({ maxPartidas: 20 }),
    comprobar: { maxPartidas: 20, ronda: [1001, 1002], totalPartidas: 18 },
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
  const c = p.comprobar;
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
  revisaValor('Total de partidas', c.totalPartidas, r.totalPartidas);
  revisaValor('Total de minutos', c.totalMinutos, r.totalMinutos);
  revisaValor('Franja de la ronda', c.minutosFranjaRonda, r.minutosFranjaRonda);
  revisaValor('Máximo de pedidos', c.maxPedidos, r.maxPedidos);
  revisaValor('Tope de partidas', c.maxPartidas, r.maxPartidas);
  return fallas;
}
