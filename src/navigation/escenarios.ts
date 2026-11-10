/**
 * Semillas de la demo. `?escenario=<id>` siembra el store al arrancar: la ronda, la configuración simulada de
 * la sucursal y el servidor (`simulacion`) y la etapa. La pantalla va en el hash (`#/surtido`).
 * Mantiene el patrón del proyecto base: la semilla se lee una vez en main.tsx.
 *
 * Cada caso del catálogo (`catalogo.ts`) apunta a una de estas semillas; varias comparten la misma.
 */
import { estadoInicial, type PartidaPedido, type Pedido, type RondaState } from '../domain/ronda';
import type { Semilla } from '../store/AppStore';

type Retoque = (p: PartidaPedido) => PartidaPedido;

/** Aplica un retoque a las partidas del pedido indicado por su índice en la ronda. */
function retocar(base: RondaState, cambios: Record<number, Retoque>): RondaState {
  const pedidos = base.ronda.pedidos.map((pedido, i) => {
    const fn = cambios[i];
    return fn ? { ...pedido, partidas: pedido.partidas.map(fn) } : pedido;
  });
  return { ...base, ronda: { ...base.ronda, pedidos } };
}

/** Cambia datos del pedido (p. ej. corporativo con orden de compra). */
function conPedido(base: RondaState, idx: number, cambios: Partial<Pedido>): RondaState {
  const pedidos = base.ronda.pedidos.map((p, i) => (i === idx ? { ...p, ...cambios } : p));
  return { ...base, ronda: { ...base.ronda, pedidos } };
}

/** Deja en la ronda solo los pedidos indicados (por índice), en ese orden. */
function soloPedidos(base: RondaState, idxs: number[]): RondaState {
  return { ...base, ronda: { ...base.ronda, pedidos: idxs.map((i) => base.ronda.pedidos[i]) } };
}

const completar: Retoque = (p) => ({ ...p, surtido: p.solicitado });
const surtir = (codigo: string, n: number): Retoque => (p) => (p.codigo === codigo ? { ...p, surtido: n } : p);
const negar = (codigo: string, motivo = 'Sin existencia'): Retoque => (p) => (p.codigo === codigo ? { ...p, motivoNegacion: motivo } : p);
/** Completa todo salvo el código indicado, que queda con `n` piezas. */
const todoMenos = (codigo: string, n: number): Retoque => (p) => (p.codigo === codigo ? { ...p, surtido: n } : completar(p));
const y = (...fns: Retoque[]): Retoque => (p) => fns.reduce((acc, fn) => fn(acc), p);

/** Partida del mock (primera aparición del código), para armar pedidos nuevos de la demo. */
function partidaBase(codigo: string, solicitado: number): PartidaPedido {
  const p = estadoInicial()
    .ronda.pedidos.flatMap((x) => x.partidas)
    .find((x) => x.codigo === codigo)!;
  return { ...p, solicitado, surtido: 0, motivoNegacion: null, promocion: null, existencia: solicitado + 20 };
}

/* ------------------------------------------------------------------ *
 * Rondas
 * ------------------------------------------------------------------ */

const base = () => estadoInicial();

function conAvanceMedio(): RondaState {
  return retocar(base(), { 0: y(surtir('1394010', 11), surtir('0607006', 1)) });
}

const primerPedidoCompleto = () => retocar(base(), { 0: completar });

/** El pedido 100001 solo necesita la última partida: el próximo escaneo lo cierra. */
const primerPedidoAlFilo = () => retocar(base(), { 0: todoMenos('6200401', 7) });

/** Ronda con una partida negada: el código 6200404 no tiene existencia suficiente. */
const conNegado = () => retocar(base(), { 1: negar('6200404') });

/** Solo falta una pieza en todo el último pedido: el próximo escaneo cierra la ronda. */
const rondaAlFilo = () => retocar(base(), { 0: completar, 1: completar, 2: todoMenos('2010000', 0) });

/** Al 100001 le falta 1 cinta 1394010: el próximo escaneo pasa el código al 100002. */
const cambioDePedido = () => retocar(base(), { 0: surtir('1394010', 10) });

/**
 * Limpiador 6200401 negado en el 100002 (sin existencia tras surtir el 100001): su "Kit mantenimiento"
 * queda incompleto con la cinta ya surtida. Falta 1 pieza de 2010000 para resolver la ronda.
 */
const promocionIncompleta = () =>
  retocar(base(), { 0: completar, 1: y(completar, negar('6200401'), surtir('6200401', 0)), 2: todoMenos('2010000', 0) });

/** 100001 y 100002 completos y la cinta 1394010 en C con `n` de 3. Corrección en escalera, 2026-11-09. */
const cintaEnC = (n: number) => retocar(base(), { 0: completar, 1: completar, 2: surtir('1394010', n) });

/** Un solo pedido (100001), opcionalmente retocado. */
const pedidoUnico = (fn?: Retoque) => soloPedidos(fn ? retocar(base(), { 0: fn }) : base(), [0]);

/** Tres pedidos sin códigos en común. */
function sinCompartidos(): RondaState {
  const s = base();
  const pedidos = s.ronda.pedidos.map((p, i) => ({
    ...p,
    partidas:
      i === 0
        ? [partidaBase('0607006', 2), partidaBase('1458000', 2)]
        : i === 1
          ? [partidaBase('2012000', 3), partidaBase('6200404', 1)]
          : [partidaBase('1978000', 1), partidaBase('2010000', 1)],
  }));
  return { ...s, ronda: { ...s.ronda, pedidos } };
}

/** Cinco pedidos con la cinta 1394010 en todos (máximo de 5 pedidos en la sucursal). */
function cincoPedidos(): RondaState {
  const s = base();
  const extra = (id: string, cliente: string, n: number): Pedido => ({
    id,
    cliente: { id: cliente, nombre: cliente === 'CLI-C' ? 'TALLER MECÁNICO HERMANOS RUIZ' : 'AUTOSERVICIO EL PASO' },
    partidas: [partidaBase('1394010', n), partidaBase('2012000', 1)],
  });
  return { ...s, ronda: { ...s.ronda, pedidos: [...s.ronda.pedidos, extra('100004', 'CLI-C', 2), extra('100005', 'CLI-D', 4)] } };
}

/**
 * Parciales en 100001 (relevador 1458000, 1 de 2) y 100003 (foco 2012000, 1 de 2); ningún código en 0 y la
 * promoción completa, para que solo aplique la confirmación de parciales.
 */
const conParciales = () => retocar(base(), { 0: todoMenos('1458000', 1), 1: completar, 2: todoMenos('2012000', 1) });

/**
 * Promoción incompleta en 100001 ("Kit mantenimiento": la cinta surtida y el limpiador 6200401 negado) y
 * parciales: el relevador 1458000 en A (1 de 2) y el foco 2012000 en C (1 de 2). Ningún código en 0.
 * Orden de los avisos al finalizar (revisión del 2026-11-09): promoción → parciales → confirmación.
 */
const promocionYParciales = () =>
  retocar(base(), {
    0: y(completar, negar('6200401'), surtir('6200401', 0), surtir('1458000', 1)),
    1: completar,
    2: todoMenos('2012000', 1),
  });

/**
 * Lo anterior más 100002 corporativo con orden de compra e incompleto (cinta 2 de 5, lo demás en 0): el
 * cierre recorre los avisos en orden. Primero el corporativo; al sacarlo, se regresa al listado sin él.
 */
const cierreEnOrden = () =>
  conPedido(
    retocar(base(), {
      0: y(completar, negar('6200401'), surtir('6200401', 0), surtir('1458000', 1)),
      1: surtir('1394010', 2),
      2: todoMenos('2012000', 1),
    }),
    1,
    { corporativoOC: true },
  );

/** Dos códigos sin familia en el catálogo. */
const sinFamilia = () =>
  retocar(base(), {
    0: (p) => (p.codigo === '1458000' ? { ...p, familia: '' } : p),
    2: (p) => (p.codigo === '2010000' ? { ...p, familia: '' } : p),
  });

/** La imagen del relevador 1458000 no responde. */
const imagenRota = () => retocar(base(), { 0: (p) => (p.codigo === '1458000' ? { ...p, imagen: './no-existe/producto-1458000.jpg' } : p) });

/* ------------------------------------------------------------------ *
 * Semillas
 * ------------------------------------------------------------------ */

const tareas = (s: Omit<Semilla, 'etapa'> = {}): Semilla => ({ etapa: 'tareas', ...s });
const surtido = (s: Omit<Semilla, 'etapa'> = {}): Semilla => ({ etapa: 'surtido', ...s });

export const ESCENARIOS: Record<string, Semilla> = {
  /* ---- Toma de tarea y Detalle de la ronda ---- */
  tareas: tareas(),
  'detalle-ronda': tareas(),
  'sin-multiorden': tareas({ ronda: soloPedidos(base(), [0, 1]), simulacion: { multiordenEnHH: false } }),
  'pedido-unico-tarea': tareas({ ronda: pedidoUnico() }),
  'falla-bandera-conexion': tareas({ simulacion: { fallaBanderaMultiorden: 'conexion' } }),
  'falla-bandera-tiempo': tareas({ simulacion: { fallaBanderaMultiorden: 'tiempo' } }),
  'sesion-vencida': tareas({ simulacion: { fallaBanderaMultiorden: 'sesion' } }),
  'tarea-sin-productos': tareas({ simulacion: { sinProductos: true } }),
  'mismo-cliente-off': tareas({ simulacion: { mismoCliente: false } }),

  /* ---- Listado ---- */
  inicial: surtido(),
  'con-avance': surtido({ ronda: conAvanceMedio(), ultimoEscaneo: { codigo: '0607006', pedidoId: '100001' } }),
  'cierra-pedido': surtido({ ronda: primerPedidoAlFilo() }),
  'primer-pedido-ok': surtido({ ronda: primerPedidoCompleto() }),
  negado: surtido({ ronda: conNegado() }),
  'cierra-ronda': surtido({ ronda: rondaAlFilo() }),
  'cambio-pedido': surtido({ ronda: cambioDePedido() }),
  promocion: surtido({ ronda: promocionIncompleta() }),
  'pedido-unico': surtido({ ronda: pedidoUnico() }),
  'falla-carga': surtido({ simulacion: { fallaCargaRonda: true } }),
  'sin-contenedor': surtido({ simulacion: { sinContenedor: '100002' } }),
  'sin-compartidos': surtido({ ronda: sinCompartidos() }),
  'negado-un-pedido': surtido({ ronda: retocar(base(), { 0: surtir('6200401', 8), 1: negar('6200401') }) }),
  'cinta-resuelta': surtido({ ronda: retocar(base(), { 0: surtir('1394010', 11), 1: surtir('1394010', 5), 2: negar('1394010') }) }),
  'cinco-pedidos': surtido({ ronda: cincoPedidos(), simulacion: { mismoCliente: true } }),

  /* ---- Negar ---- */
  'negar-parcial': surtido({ ronda: retocar(base(), { 0: surtir('1394010', 3) }) }),
  'pedido-unico-con-avance': surtido({ ronda: pedidoUnico(surtir('0607006', 1)) }),
  'pedido-unico-corporativo': surtido({ ronda: conPedido(pedidoUnico(), 0, { corporativoOC: true }) }),
  corporativo: surtido({ ronda: conPedido(base(), 1, { corporativoOC: true }) }),
  'falla-negar': surtido({ simulacion: { fallaNegar: true } }),

  /* ---- Corrección (escalera) ---- */
  correccion: surtido({ ronda: cintaEnC(2), ultimoEscaneo: { codigo: '1394010', pedidoId: '100003' } }),
  'cinta-en-c': surtido({ ronda: cintaEnC(0) }),

  /* ---- Finalizar, sacar el corporativo, salir ---- */
  'concluida-por-otro': surtido({ ronda: rondaAlFilo(), simulacion: { concluidaPorOtro: true } }),
  'pedido-unico-al-filo': surtido({ ronda: pedidoUnico(todoMenos('6200401', 7)) }),
  'corporativo-incompleto': surtido({
    ronda: conPedido(retocar(base(), { 0: completar, 1: surtir('1394010', 2), 2: completar }), 1, { corporativoOC: true }),
  }),
  'corporativo-sin-piezas': surtido({ ronda: conPedido(conAvanceMedio(), 1, { corporativoOC: true }) }),
  'pedido-unico-corporativo-incompleto': surtido({ ronda: conPedido(pedidoUnico(surtir('1394010', 5)), 0, { corporativoOC: true }) }),
  'ronda-dos-corporativo': surtido({
    ronda: conPedido(soloPedidos(retocar(base(), { 0: completar, 1: surtir('1394010', 2) }), [0, 1]), 1, { corporativoOC: true }),
  }),
  parciales: surtido({ ronda: conParciales() }),
  'promocion-y-parciales': surtido({ ronda: promocionYParciales() }),
  'cierre-en-orden': surtido({ ronda: cierreEnOrden() }),
  'falla-guardado': surtido({ ronda: rondaAlFilo(), simulacion: { fallaGuardado: '100002' } }),
  'falla-desvincular': surtido({ ronda: conAvanceMedio(), simulacion: { fallaDesvincular: '100002' } }),
  'pedido-unico-falla-desvincular': surtido({ ronda: pedidoUnico(surtir('0607006', 1)), simulacion: { fallaDesvincular: '*' } }),
  'negado-y-surtido': surtido({ ronda: retocar(base(), { 0: y(negar('1458000', 'Producto dañado'), surtir('0607006', 1)) }) }),

  /* ---- Imagen y familia ---- */
  'imagen-rota': surtido({ ronda: imagenRota() }),
  'sin-familia': surtido({ ronda: sinFamilia() }),
  'familia-off': surtido({ simulacion: { agruparPorFamilia: false } }),
  'familia-falla': surtido({ simulacion: { fallaBanderaFamilia: true } }),
};

export function idEscenario(search: string = window.location.search): string | null {
  return new URLSearchParams(search).get('escenario');
}

export function semillaDesdeUrl(): Semilla | undefined {
  const id = idEscenario();
  return id ? ESCENARIOS[id] : undefined;
}
