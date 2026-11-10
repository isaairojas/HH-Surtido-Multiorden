/**
 * Simulador del armado de la ronda multi-orden (SDD 2026-10-26-multiorden-armado-ronda).
 *
 * En la operación real esto lo resuelve el back-end (el servicio que asigna `GrupoID`): la HH recibe la ronda
 * ya armada. Aquí se reproduce con las reglas de las specs `elegibilidad-ronda-multiorden` y
 * `catalogo-bandera-sucursal` para que QA las valide en pantalla, escenario por escenario. Es lógica pura:
 * no toca el store ni la ronda del surtido.
 *
 * Decisiones del usuario que aplica (2026-11-09):
 * - Orden de la cola: vencimiento, luego creación más antigua, luego menos partidas, luego folio menor.
 *   La zona no cuenta.
 * - Criterios acumulativos: el candidato cumple todos los activos (misma dirección, código compartido, tope).
 * - Un código cuenta una partida en cada pedido donde está (en dos pedidos suma dos).
 * - El tope solo filtra candidatos: el ancla no se descarta, pero entonces ningún candidato cabe.
 * - `BndRondaXPedido` prevalece sobre el multi-orden.
 */

export type Servicio = 'local' | 'foraneo';
export type TipoPedido = 'cliente' | 'traspaso' | 'balanceo';

/** Pedido de la cola por surtir. Cada código del arreglo es una partida. */
export type PedidoCola = {
  folio: number;
  /** Hora de vencimiento, "HH:MM". */
  vence: string;
  /** Fecha y hora de creación, "AAAA-MM-DD HH:MM". */
  creado: string;
  codigos: string[];
  servicio: Servicio;
  tipo: TipoPedido;
  /** Dirección de entrega. */
  direccion: string;
  /** Retenido manualmente desde Exodus Sucursales. */
  retenido?: boolean;
  /** Parte de una factura dividida por montos. */
  division?: { id: string; parte: number };
  /** Tiempo estimado de surtido, en minutos. */
  minutos: number;
  /** Solo se muestra: la zona no influye en el orden. */
  zona?: string;
};

/** Banderas de la sucursal que intervienen en el armado. */
export type BanderasArmado = {
  Bandera_MultiordenEnHH: boolean;
  BndRondaXPedido: boolean;
  Bandera_RevisionPedidoEnHH: boolean;
  Bandera_MultiordenMismaDireccion: boolean;
  Bandera_MultiordenValidarCodigos: boolean;
  Bandera_MultiordenTopePartidas: boolean;
  Bandera_MultiordenTraspasos: boolean;
  BndUnificarRondasMontos: boolean;
};

export type ConfigSucursal = BanderasArmado & {
  /** Máximo de pedidos por ronda. Sin configurar: 3. */
  maxPedidos?: number;
  /** Tope acumulado de partidas por ronda (`Parametro_MultiordenMaxPartidas`). Sin configurar: 15. */
  maxPartidas?: number;
  /**
   * Tiempo máximo de la franja horaria, en minutos (hoy en `TiempoEstablecidoSurtido`). Ya no deja fuera a
   * nadie (regla del 2026-11-09): si un candidato cumple todo lo demás, la franja de la ronda se amplía.
   */
  minutosFranja: number;
};

export const NOMBRES_BANDERAS: (keyof BanderasArmado)[] = [
  'Bandera_MultiordenEnHH',
  'BndRondaXPedido',
  'Bandera_RevisionPedidoEnHH',
  'Bandera_MultiordenMismaDireccion',
  'Bandera_MultiordenValidarCodigos',
  'Bandera_MultiordenTopePartidas',
  'Bandera_MultiordenTraspasos',
  'BndUnificarRondasMontos',
];

export const MAX_PEDIDOS_INICIAL = 3;
export const MAX_PARTIDAS_INICIAL = 15;

/**
 * Configuración de ejemplo de la demo. Sigue la nota del catálogo para la liberación a productivo (multi-orden
 * activo, misma dirección inactiva, código compartido y tope activos, traspasos inactivos); las banderas que ya
 * existen hoy (`BndRondaXPedido`, `Bandera_RevisionPedidoEnHH`, `BndUnificarRondasMontos`) van inactivas y
 * cada escenario las enciende cuando las necesita. La franja de 30 min es un ejemplo: la demo no define valores
 * reales (revisión del 2026-11-09), solo muestra cómo están configurados.
 */
export const CONFIG_INICIAL: ConfigSucursal = {
  Bandera_MultiordenEnHH: true,
  BndRondaXPedido: false,
  Bandera_RevisionPedidoEnHH: false,
  Bandera_MultiordenMismaDireccion: false,
  Bandera_MultiordenValidarCodigos: true,
  Bandera_MultiordenTopePartidas: true,
  Bandera_MultiordenTraspasos: false,
  BndUnificarRondasMontos: false,
  minutosFranja: 30,
};

/** Cómo se arma la ronda según las banderas de la sucursal. */
export type ModoArmado = 'actual' | 'por-pedido' | 'unificado' | 'multiorden';

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

export type ResultadoArmado = {
  modo: ModoArmado;
  explicacionModo: string;
  /** La cola en el orden en que se atiende. */
  cola: PedidoCola[];
  ancla: PedidoCola | null;
  /** Candidatos dentro de la ventana, en el orden en que se evaluaron. */
  evaluados: EvaluacionCandidato[];
  /** Pedidos que quedaron fuera de la ventana: no se evaluaron para esta ronda. */
  fueraDeVentana: PedidoCola[];
  /** La ronda final, en orden (A, B, C…). */
  ronda: PedidoCola[];
  totalPartidas: number;
  totalMinutos: number;
  /** Tiempo máximo de la franja configurado en la sucursal. */
  minutosFranja: number;
  /** Franja de la ronda: la configurada o, si los pedidos integrados la superan, la ampliada para que quepan. */
  minutosFranjaRonda: number;
  maxPedidos: number;
  maxPartidas: number;
  notas: string[];
};

const etiquetaServicio = (s: Servicio) => (s === 'local' ? 'local' : 'foráneo');
const etiquetaTipo = (t: TipoPedido) => (t === 'cliente' ? 'pedido de cliente' : t === 'traspaso' ? 'traspaso' : 'balanceo manual');

/** Orden de la cola: vencimiento, creación más antigua, menos partidas, folio menor. La zona no cuenta. */
export function ordenarCola(cola: PedidoCola[]): PedidoCola[] {
  return [...cola].sort(
    (a, b) =>
      a.vence.localeCompare(b.vence) ||
      a.creado.localeCompare(b.creado) ||
      a.codigos.length - b.codigos.length ||
      a.folio - b.folio,
  );
}

const sumaPartidas = (pedidos: PedidoCola[]) => pedidos.reduce((n, p) => n + p.codigos.length, 0);
const sumaMinutos = (pedidos: PedidoCola[]) => pedidos.reduce((n, p) => n + p.minutos, 0);

/** Arma la ronda del primero de la cola con las reglas de la sucursal. */
export function armarRonda(cola: PedidoCola[], config: ConfigSucursal): ResultadoArmado {
  const ordenada = ordenarCola(cola);
  const maxPedidos = config.maxPedidos ?? MAX_PEDIDOS_INICIAL;
  const maxPartidas = config.maxPartidas ?? MAX_PARTIDAS_INICIAL;
  const ancla = ordenada[0] ?? null;
  const notas: string[] = [];

  const base = (modo: ModoArmado, explicacionModo: string): ResultadoArmado => ({
    modo,
    explicacionModo,
    cola: ordenada,
    ancla,
    evaluados: [],
    fueraDeVentana: [],
    ronda: ancla ? [ancla] : [],
    totalPartidas: ancla ? ancla.codigos.length : 0,
    totalMinutos: ancla ? ancla.minutos : 0,
    minutosFranja: config.minutosFranja,
    minutosFranjaRonda: Math.max(config.minutosFranja, ancla ? ancla.minutos : 0),
    maxPedidos,
    maxPartidas,
    notas,
  });

  if (!ancla) return base('multiorden', 'La cola está vacía: no hay ronda que armar.');

  // Convivencia con las rondas actuales.
  if (!config.Bandera_MultiordenEnHH) {
    notas.push('El simulador no reproduce el algoritmo actual (OrdenesporSurtir): solo muestra que el multi-orden no interviene.');
    return base(
      'actual',
      'Bandera_MultiordenEnHH inactiva: la ronda se arma con el algoritmo actual y se surte como hoy. No se evalúan candidatos multi-orden.',
    );
  }
  if (config.BndRondaXPedido) {
    const resto = ordenada.slice(1).map((p) => p.folio);
    if (resto.length) notas.push(`${resto.join(', ')} se surte${resto.length > 1 ? 'n' : ''} en otra ronda, cada uno solo.`);
    return base(
      'por-pedido',
      'BndRondaXPedido activa: prevalece la ronda por pedido. Cada pedido se surte en su propia ronda y no se evalúan candidatos, aunque cumplan los criterios.',
    );
  }
  if (config.Bandera_RevisionPedidoEnHH) {
    notas.push('Los demás pedidos se surten cada uno solo, en su turno.');
    return base(
      'unificado',
      'Bandera_RevisionPedidoEnHH activa (surtido unificado con revisión): no se evalúan candidatos; cada pedido se surte solo.',
    );
  }

  const multiorden = 'Bandera_MultiordenEnHH activa: la ronda se arma con las reglas del multi-orden.';

  // Pedidos retenidos: el ancla retenida no arma ronda multi-orden.
  if (ancla.retenido) {
    notas.push(`${ancla.folio} está retenido desde Exodus Sucursales: no se arma ronda multi-orden con él y se surte solo.`);
    return { ...base('multiorden', multiorden), fueraDeVentana: ordenada.slice(1) };
  }

  const ronda: PedidoCola[] = [ancla];
  const evaluados: EvaluacionCandidato[] = [];

  // División de factura por montos: con la bandera, todas las partes del ancla entran juntas, aunque superen topes.
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
  }

  const restantes = ordenada.slice(1).filter((p) => !ronda.includes(p));
  const lugares = Math.max(0, maxPedidos - ronda.length);
  const ventana = restantes.slice(0, lugares);
  const fueraDeVentana = restantes.slice(lugares);

  if (sumaPartidas([ancla]) > maxPartidas && config.Bandera_MultiordenTopePartidas) {
    notas.push(
      `El ancla tiene ${ancla.codigos.length} partidas, más que el tope de ${maxPartidas}: se surte, pero ningún candidato cabe.`,
    );
  }

  // La ventana es fija: un candidato que no cumple conserva su lugar y no se sustituye con el siguiente de la
  // cola (regla del 2026-11-09). La ronda que se arma es la que la HH recibe al tomar la tarea.
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

  if (ronda.length === 1 && evaluados.length > 0) notas.push(`Ningún candidato cumple: ${ancla.folio} se surte solo, igual que hoy.`);
  if (ventana.length === 0 && !divisionAncla) notas.push(`No hay candidatos en la ventana: ${ancla.folio} se surte solo.`);
  const rechazados = evaluados.filter((e) => e.estado !== 'integrado').map((e) => e.pedido.folio);
  if (rechazados.length && ronda.length > 1) {
    notas.push(`${rechazados.join(', ')} se surte${rechazados.length > 1 ? 'n' : ''} solo${rechazados.length > 1 ? 's' : ''} en su turno.`);
  }

  return {
    modo: 'multiorden',
    explicacionModo: multiorden,
    cola: ordenada,
    ancla,
    evaluados,
    fueraDeVentana,
    ronda,
    totalPartidas: sumaPartidas(ronda),
    totalMinutos,
    minutosFranja: config.minutosFranja,
    minutosFranjaRonda,
    maxPedidos,
    maxPartidas,
    notas,
  };
}

const REGLA_TIEMPO = 'Tiempo de la franja';

/** Revisa todas las reglas de un candidato contra la ronda que lleva acumulada. */
function evaluarCandidato(
  c: PedidoCola,
  ancla: PedidoCola,
  ronda: PedidoCola[],
  config: ConfigSucursal,
  maxPartidas: number,
): ReglaEvaluada[] {
  const reglas: ReglaEvaluada[] = [];

  reglas.push(
    c.retenido
      ? { regla: 'Retención', resultado: 'no-cumple', detalle: 'retenido manualmente desde Exodus Sucursales; no se evalúa para multi-orden.' }
      : { regla: 'Retención', resultado: 'cumple', detalle: 'no está retenido.' },
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

  if (c.tipo === 'cliente') {
    reglas.push({ regla: 'Tipo de pedido', resultado: 'cumple', detalle: 'pedido de cliente.' });
  } else if (config.Bandera_MultiordenTraspasos) {
    reglas.push({ regla: 'Tipo de pedido', resultado: 'cumple', detalle: `${etiquetaTipo(c.tipo)} permitido por Bandera_MultiordenTraspasos.` });
  } else {
    reglas.push({
      regla: 'Tipo de pedido',
      resultado: 'no-cumple',
      detalle: `es ${etiquetaTipo(c.tipo)} y Bandera_MultiordenTraspasos está inactiva.`,
    });
  }

  if (config.BndUnificarRondasMontos && c.division && c.division.id !== ancla.division?.id) {
    reglas.push({
      regla: 'División de factura',
      resultado: 'no-cumple',
      detalle: `es la parte ${c.division.parte} de la factura ${c.division.id}; con BndUnificarRondasMontos sus partes van juntas en su propia ronda.`,
    });
  }

  if (config.Bandera_MultiordenMismaDireccion) {
    reglas.push(
      c.direccion === ancla.direccion
        ? { regla: 'Misma dirección', resultado: 'cumple', detalle: 'va a la misma dirección que el ancla.' }
        : { regla: 'Misma dirección', resultado: 'no-cumple', detalle: `va a "${c.direccion}" y el ancla a "${ancla.direccion}".` },
    );
  } else {
    reglas.push({ regla: 'Misma dirección', resultado: 'no-aplica', detalle: 'no se exige (Bandera_MultiordenMismaDireccion inactiva).' });
  }

  if (config.Bandera_MultiordenValidarCodigos) {
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
    reglas.push({ regla: 'Código compartido', resultado: 'no-aplica', detalle: 'no se exige (Bandera_MultiordenValidarCodigos inactiva).' });
  }

  const partidas = sumaPartidas(ronda);
  const conCandidato = partidas + c.codigos.length;
  if (config.Bandera_MultiordenTopePartidas) {
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
      detalle: `sin límite (Bandera_MultiordenTopePartidas inactiva); la ronda sumaría ${conCandidato}.`,
    });
  }

  // Tiempo de la franja (regla del 2026-11-09): no es motivo de rechazo. Si el candidato cumple lo demás y se
  // pasa, la franja de la ronda se amplía para que entre.
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
