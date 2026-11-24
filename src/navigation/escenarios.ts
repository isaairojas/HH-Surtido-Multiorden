/**
 * Semillas de la demo. `?escenario=<id>` siembra el store al arrancar: la ronda, la configuración simulada de
 * la sucursal y el servidor (`simulacion`) y la etapa. La pantalla va en el hash (`#/surtido`).
 * Mantiene el patrón del proyecto base: la semilla se lee una vez en main.tsx.
 *
 * Cada caso del catálogo (`catalogo.ts`) apunta a una de estas semillas; varias comparten la misma. Cada semilla
 * prepara, sobre la ronda de `src/mocks/ronda.ts`, el estado que describe el GIVEN de sus escenarios, con los
 * mismos números; `tests/domain/escenarios.test.mjs` lo comprueba.
 */
import { qrEtiquetaUnica } from '../domain/codigos';
import { estadoInicial, type PartidaPedido, type Pedido, type RondaState } from '../domain/ronda';
import { CLIENTE_A, CLIENTE_B, partida } from '../mocks/ronda';
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

/** Quita códigos de los pedidos indicados, cuando el escenario habla de menos pedidos con ese código. */
function sinCodigos(base: RondaState, cambios: Record<number, string[]>): RondaState {
  const pedidos = base.ronda.pedidos.map((pedido, i) => {
    const fuera = cambios[i];
    return fuera ? { ...pedido, partidas: pedido.partidas.filter((x) => !fuera.includes(x.codigo)) } : pedido;
  });
  return { ...base, ronda: { ...base.ronda, pedidos } };
}

/** Cambia datos del pedido (p. ej. corporativo con orden de compra). */
function conPedido(base: RondaState, idx: number, cambios: Partial<Pedido>): RondaState {
  const pedidos = base.ronda.pedidos.map((p, i) => (i === idx ? { ...p, ...cambios } : p));
  return { ...base, ronda: { ...base.ronda, pedidos } };
}

/** Deja en la ronda solo los pedidos indicados (por índice), en ese orden y con su letra de origen. */
function soloPedidos(base: RondaState, idxs: number[]): RondaState {
  return { ...base, ronda: { ...base.ronda, pedidos: idxs.map((i) => base.ronda.pedidos[i]) } };
}

/** Ronda nueva con los pedidos dados (letras A, B, C… por su lugar). */
function rondaCon(pedidos: Pedido[]): RondaState {
  return estadoInicial({ id: 'G-500', pedidos });
}

const completar: Retoque = (p) => ({ ...p, surtido: p.solicitado });
const surtir = (codigo: string, n: number): Retoque => (p) => (p.codigo === codigo ? { ...p, surtido: n } : p);
const negar = (codigo: string, motivo = 'Sin existencia'): Retoque => (p) =>
  p.codigo === codigo ? { ...p, surtido: 0, motivoNegacion: motivo } : p;
/** Completa todo salvo el código indicado, que queda con `n` piezas. */
const todoMenos = (codigo: string, n: number): Retoque => (p) => (p.codigo === codigo ? { ...p, surtido: n } : completar(p));
const sinPromocion: Retoque = (p) => ({ ...p, promocion: null });
const perecedero = (codigo: string): Retoque => (p) => (p.codigo === codigo ? { ...p, perecedero: true } : p);
const sinFamilia = (codigo: string): Retoque => (p) => (p.codigo === codigo ? { ...p, familia: '' } : p);
/** Ningún producto con familia (el servicio sí entrega el dato, pero vacío). */
const sinFamilias: Retoque = (p) => ({ ...p, familia: '' });
/** Niega todas las partidas del pedido. */
const negarTodo: Retoque = (p) => ({ ...p, surtido: 0, motivoNegacion: 'Sin existencia' });
const y = (...fns: Retoque[]): Retoque => (p) => fns.reduce((acc, fn) => fn(acc), p);

/* ------------------------------------------------------------------ *
 * Rondas (A · 1001, B · 1002, C · 1003)
 * ------------------------------------------------------------------ */

const base = () => estadoInicial();

/** 1001 con 3 de 11 de 0486600 y lo demás en 0: hay avance y hay códigos en 0. */
const conAvance = () => retocar(base(), { 0: surtir('0486600', 3) });

/** 1001 completo: 0486600 queda en A 11/11, B 0/5 y C 0/3. */
const primerPedidoCompleto = () => retocar(base(), { 0: completar });

/** 0486600 solo en 1001 y 1002 ("Código en dos pedidos": 11 en A y 5 en B). */
const arnesEnAyB = () => sinCodigos(base(), { 2: ['0486600'] });

/** A 1001 solo le falta 1 pieza de 1394010, que nadie más necesita antes: el próximo surtido lo cierra. */
const primerPedidoAlFilo = () => retocar(base(), { 0: todoMenos('1394010', 3) });

/** La última partida pendiente de 1001 es 0486600 (10 de 11), que 1002 también pide. */
const primerPedidoAlFiloCompartido = () => retocar(base(), { 0: todoMenos('0486600', 10) });

/** 1001 con 10 de 11 de 0486600 y le faltan otras partidas; 1002 también lo pide. */
const cambioDePedido = () => retocar(base(), { 0: surtir('0486600', 10) });

/** Solo falta 1 pieza de 2010000 en 1003: el próximo surtido resuelve la ronda. */
const rondaAlFilo = () => retocar(base(), { 0: completar, 1: completar, 2: todoMenos('2010000', 0) });

/** 1001 y 1002 completos y el código en C con `n` piezas (lo demás de C completo). */
const enC = (codigo: string, n: number) => retocar(base(), { 0: completar, 1: completar, 2: todoMenos(codigo, n) });

/**
 * "Kit afinación" (0486600 + 2389475) completo en 1001; en 1002 se negó 2389475 con 0486600 en 5 de 5. Falta 1
 * pieza de 2010000 en 1003 para resolver la ronda.
 */
const promocionIncompleta = () =>
  retocar(base(), { 0: completar, 1: y(completar, negar('2389475')), 2: todoMenos('2010000', 0) });

/** Promoción incompleta en 1001 (2389475 negado) y 1003 con 2012000 parcial (1 de 2). */
const promocionYParciales = () =>
  retocar(base(), { 0: y(completar, negar('2389475')), 1: completar, 2: todoMenos('2012000', 1) });

/**
 * Corporativo 1002 incompleto (0486600 en 2 de 5, lo demás en 0), promoción incompleta en 1001 (2389475 negado),
 * 1394010 parcial en 1001 (2 de 4) y 2012000 parcial en 1003 (1 de 2): el cierre recorre los avisos en orden.
 */
const cierreEnOrden = () =>
  conPedido(
    retocar(base(), {
      0: y(completar, negar('2389475'), surtir('1394010', 2)),
      1: surtir('0486600', 2),
      2: todoMenos('2012000', 1),
    }),
    1,
    { corporativoOC: true },
  );

/**
 * "Parciales en varios pedidos": 0486600 con 3 de 11 en A y 5 de 5 en B, y 2389475 con 1 de 2 solo en C; lo
 * demás completo. Sin promociones en esta ronda, para que el único aviso sea el de parciales.
 */
const parcialesEnVarios = () =>
  retocar(
    sinCodigos(base(), { 0: ['2389475'], 1: ['2389475'], 2: ['0486600'] }),
    { 0: y(sinPromocion, todoMenos('0486600', 3)), 1: y(sinPromocion, completar), 2: todoMenos('2389475', 1) },
  );

/** 1001 con 1394010 parcial (2 de 4); lo demás completo y la promoción completa. */
const parcialEnA = () => retocar(base(), { 0: todoMenos('1394010', 2), 1: completar, 2: completar });

/** Un solo pedido (1001), opcionalmente retocado. */
const pedidoUnico = (fn?: Retoque) => soloPedidos(fn ? retocar(base(), { 0: fn }) : base(), [0]);

/** Tres pedidos sin códigos en común. */
const sinCompartidos = () =>
  rondaCon([
    { id: '1001', cliente: CLIENTE_A, partidas: [partida('0486600', 11), partida('1365800', 1)] },
    { id: '1002', cliente: CLIENTE_B, partidas: [partida('2389475', 2), partida('2012000', 3)] },
    { id: '1003', cliente: CLIENTE_A, partidas: [partida('1394010', 3), partida('1978000', 1), partida('2010000', 1)] },
  ]);

/** Cinco pedidos con 0486600 en todos (la sucursal tiene el máximo en 5). */
function cincoPedidos(): RondaState {
  const s = base();
  const extra = (id: string, n: number): Pedido => ({
    id,
    cliente: { id: id === '1004' ? '60318' : '72940', nombre: id === '1004' ? 'TALLER MECÁNICO HERMANOS RUIZ' : 'AUTOSERVICIO EL PASO' },
    partidas: [partida('0486600', n), partida('2012000', 1)],
  });
  return estadoInicial({ ...s.ronda, pedidos: [...s.ronda.pedidos, extra('1004', 2), extra('1005', 4)] });
}

/** Ronda de los escenarios de familias: filtro 3001 (A), batería 2001 (B) y filtro 1001 (C), en pasillos 1, 2 y 4. */
const filtrosYBateria = () =>
  rondaCon([
    { id: '1001', cliente: CLIENTE_A, partidas: [partida('3001', 2)] },
    { id: '1002', cliente: CLIENTE_B, partidas: [partida('2001', 1)] },
    { id: '1003', cliente: CLIENTE_A, partidas: [partida('1001', 1)] },
  ]);

/** Pendientes de las familias "BUJÍA", "bomba" y "Batería". */
const familiasConAcentos = () =>
  rondaCon([
    { id: '1001', cliente: CLIENTE_A, partidas: [partida('4001', 4)] },
    { id: '1002', cliente: CLIENTE_B, partidas: [partida('5001', 1)] },
    { id: '1003', cliente: CLIENTE_A, partidas: [partida('6001', 1)] },
  ]);

/** Los tres pedidos son corporativos con orden de compra e incompletos. */
const tresCorporativos = () => {
  let s = retocar(base(), { 0: surtir('0486600', 3), 1: surtir('0486600', 2), 2: surtir('0486600', 1) });
  for (const i of [0, 1, 2]) s = conPedido(s, i, { corporativoOC: true });
  return s;
};

/** 1002 y 1003 corporativos con orden de compra e incompletos; 1001 completo. */
const dosCorporativos = () =>
  conPedido(conPedido(retocar(base(), { 0: completar, 1: surtir('0486600', 2), 2: surtir('0486600', 1) }), 1, { corporativoOC: true }), 2, {
    corporativoOC: true,
  });

/** 1002 corporativo con orden de compra e incompleto (0486600 en 2 de 5); 1001 y 1003 completos. */
const corporativoIncompleto = () =>
  conPedido(retocar(base(), { 0: completar, 1: surtir('0486600', 2), 2: completar }), 1, { corporativoOC: true });

/**
 * "Kit afinación" en 1002 con 0486600 en 5 de 5 y 2389475 en 1 de 2, sin ningún código negado; 1001 y 1003 completos
 * (Promoción incompleta al finalizar la ronda · "Incompleta sin códigos negados").
 */
const promocionSinNegados = () => retocar(base(), { 0: completar, 1: todoMenos('2389475', 1), 2: completar });

/** "Kit afinación" incompleta en 1001 y en 1002 (2389475 negado en los dos); lo demás completo. */
const promocionEnAyB = () => retocar(base(), { 0: y(completar, negar('2389475')), 1: y(completar, negar('2389475')), 2: completar });

/** Solo la promoción de 1001 incompleta (2389475 negado); sin parciales, códigos en 0 ni corporativos. */
const soloPromocionEnA = () => retocar(base(), { 0: y(completar, negar('2389475')), 1: completar, 2: completar });

/**
 * Solo códigos en cero: 1002 tiene 2389475 en 0 sin negar y lo demás está completo. El "Kit afinación" de 1002 no
 * cuenta como incompleto porque no todos sus códigos se iniciaron (regla del V2).
 */
const soloCeros = () => retocar(base(), { 0: completar, 1: todoMenos('2389475', 0), 2: completar });

/** La ronda G-500 con 1001 completo y 1002 corporativo completo salvo 1 pieza de 1394010. */
const corporativoAlFilo = () =>
  conPedido(soloPedidos(retocar(base(), { 0: completar, 1: todoMenos('1394010', 1) }), [0, 1]), 1, { corporativoOC: true });

/** Familia con texto de relleno: 3001 "Filtro", 2500 con la familia nula y 1500 con "SIN FAMILIA". */
const familiaRelleno = () =>
  rondaCon([
    { id: '1001', cliente: CLIENTE_A, partidas: [partida('2500', 1)] },
    { id: '1002', cliente: CLIENTE_B, partidas: [partida('1500', 2)] },
    { id: '1003', cliente: CLIENTE_A, partidas: [partida('3001', 1)] },
  ]);

/** Etiquetas únicas de 0486600 de la demo: E1 y E2 (1 pieza cada una). */
export const E1 = qrEtiquetaUnica('0486600', 1, 1);
export const E2 = qrEtiquetaUnica('0486600', 1, 2);

/** C (1003) tiene 2 de 3 de 0486600 con las etiquetas E1 y E2; A y B completos sin etiquetas registradas. */
const euEnC = (): RondaState => ({ ...enC('0486600', 2), etiquetas: [E1, E2].map((qr) => ({ qr, pedidoId: '1003', codigo: '0486600' })) });

/** E1 ya se surtió a 1001 (1 pieza de 0486600 en A, relacionada con ese pedido). */
const e1EnA = (s: RondaState): RondaState => ({
  ...retocar(s, { 0: surtir('0486600', 1) }),
  etiquetas: [{ qr: E1, pedidoId: '1001', codigo: '0486600' }],
});

/* ------------------------------------------------------------------ *
 * Semillas
 * ------------------------------------------------------------------ */

const tareas = (s: Omit<Semilla, 'etapa'> = {}): Semilla => ({ etapa: 'tareas', ...s });
const surtido = (s: Omit<Semilla, 'etapa'> = {}): Semilla => ({ etapa: 'surtido', ...s });

export const ESCENARIOS: Record<string, Semilla> = {
  /* ---- Toma de tarea y Detalle de la ronda ---- */
  tareas: tareas(),
  'detalle-ronda': tareas(),
  // "dos pedidos, 101 y 102": la spec usa otros folios en este escenario.
  'sin-multipedido-v2': tareas({
    ronda: conPedido(conPedido(soloPedidos(base(), [0, 1]), 0, { id: '101' }), 1, { id: '102' }),
    simulacion: { multipedidoEnHH: false },
  }),
  'pedido-unico-tarea': tareas({ ronda: pedidoUnico() }),
  'falla-bandera-conexion': tareas({ simulacion: { fallaBanderaMultipedido: 'conexion' } }),
  'falla-bandera-tiempo': tareas({ simulacion: { fallaBanderaMultipedido: 'tiempo' } }),
  'sesion-vencida': tareas({ simulacion: { fallaBanderaMultipedido: 'sesion' } }),
  'tarea-sin-productos': tareas({ simulacion: { sinProductos: true } }),
  'mismo-cliente-off': tareas({ simulacion: { mismoCliente: false } }),
  // Ronda multipedido V2 en la asignación: quién armó la ronda y la falla de la bandera de listado.
  'factura-dividida': tareas({ simulacion: { origenRonda: 'factura-dividida' } }),
  paqueteria: tareas({ simulacion: { origenRonda: 'paqueteria' } }),
  'sugerencia-embarque': tareas({ simulacion: { origenRonda: 'sugerencia-embarque' } }),
  'falla-bandera-listado': tareas({ simulacion: { fallaBanderaListado: 'conexion' } }),
  // Falla al cargar la ronda.
  'falla-ronda-al-aceptar': tareas({ simulacion: { fallaConsultaRonda: 'al-aceptar' } }),
  'falla-ronda-al-mostrar': tareas({ simulacion: { fallaConsultaRonda: 'al-mostrar' } }),
  'falla-ronda-factura': tareas({ simulacion: { origenRonda: 'factura-dividida', fallaConsultaRonda: 'al-aceptar' } }),
  'pedido-sin-datos': tareas({ simulacion: { pedidoSinDatos: '1002' } }),

  /* ---- Apertura del listado ---- */
  inicial: surtido(),
  'carga-lenta': surtido({ simulacion: { demoraCarga: 3000 } }),
  'falla-carga': surtido({ simulacion: { fallaCargaRonda: true } }),
  'sin-contenedor': surtido({ simulacion: { sinContenedor: '1002' } }),
  'pedido-unico': surtido({ ronda: pedidoUnico() }),

  /* ---- Escaneo y lista ---- */
  'con-avance': surtido({ ronda: conAvance(), ultimoEscaneo: { codigo: '0486600', pedidoId: '1001' } }),
  'primer-pedido-ok': surtido({ ronda: primerPedidoCompleto() }),
  'arnes-completo': surtido({ ronda: retocar(base(), { 0: surtir('0486600', 11), 1: surtir('0486600', 5), 2: surtir('0486600', 3) }) }),
  negado: surtido({ ronda: retocar(base(), { 0: negar('1365800') }) }),
  'dos-pedidos': surtido({ ronda: arnesEnAyB() }),
  'negado-un-pedido': surtido({ ronda: retocar(arnesEnAyB(), { 0: surtir('0486600', 11), 1: negar('0486600') }) }),
  'sin-compartidos': surtido({ ronda: sinCompartidos() }),
  'cierra-pedido': surtido({ ronda: primerPedidoAlFilo() }),
  'cierra-pedido-compartido': surtido({ ronda: primerPedidoAlFiloCompartido() }),
  'cambio-pedido': surtido({ ronda: cambioDePedido() }),
  'solo-en-a': surtido({ ronda: sinCodigos(cambioDePedido(), { 1: ['0486600'], 2: ['0486600'] }) }),
  'arnes-resuelto': surtido({ ronda: retocar(base(), { 0: surtir('0486600', 11), 1: surtir('0486600', 5), 2: negar('0486600') }) }),
  'cinco-pedidos': surtido({ ronda: cincoPedidos() }),
  'cancelado-surtiendo': surtido({ ronda: primerPedidoCompleto(), simulacion: { cancelados: ['1002'] } }),

  /* ---- Negar ---- */
  'negar-parcial': surtido({ ronda: retocar(arnesEnAyB(), { 0: surtir('0486600', 3) }) }),
  'pedido-unico-con-avance': surtido({ ronda: pedidoUnico(surtir('0486600', 1)) }),
  'pedido-unico-corporativo': surtido({ ronda: conPedido(pedidoUnico(), 0, { corporativoOC: true }) }),
  corporativo: surtido({ ronda: conPedido(base(), 1, { corporativoOC: true }) }),
  'falla-negar': surtido({ simulacion: { fallaNegar: '*' } }),
  // 0486600 en 1001 (3 de 11), 1002 y 1003; el registro de la negación de 1002 falla.
  'falla-negar-en-b': surtido({ ronda: conAvance(), simulacion: { fallaNegar: '1002' } }),

  /* ---- Corrección (escalera) ---- */
  correccion: surtido({ ronda: enC('0486600', 2), ultimoEscaneo: { codigo: '0486600', pedidoId: '1003' } }),
  'arnes-en-c': surtido({ ronda: enC('0486600', 0) }),
  'cinta-en-c': surtido({ ronda: enC('1394010', 0) }),

  /* ---- Promoción ---- */
  promocion: surtido({ ronda: promocionIncompleta() }),
  'promocion-sin-negados': surtido({ ronda: promocionSinNegados() }),
  'falla-eliminar-promocion': surtido({ ronda: promocionEnAyB(), simulacion: { fallaEliminarPromocion: '1002' } }),
  'solo-promocion': surtido({ ronda: soloPromocionEnA() }),
  'solo-ceros': surtido({ ronda: soloCeros() }),

  /* ---- Finalizar, sacar el corporativo, salir ---- */
  'cierra-ronda': surtido({ ronda: rondaAlFilo() }),
  'concluida-por-otro': surtido({ ronda: rondaAlFilo(), simulacion: { concluidaPorOtro: true } }),
  'concluida-a-mitad': surtido({ ronda: rondaAlFilo(), simulacion: { concluidaAntesDe: '1002' } }),
  'pedido-unico-al-filo': surtido({ ronda: pedidoUnico(todoMenos('1394010', 3)) }),
  'corporativo-incompleto': surtido({ ronda: corporativoIncompleto() }),
  'falla-retiro': surtido({ ronda: corporativoIncompleto(), simulacion: { fallaRetiro: 'retiro' } }),
  'falla-registro-retiro': surtido({ ronda: corporativoIncompleto(), simulacion: { fallaRetiro: 'registro' } }),
  'corporativo-al-filo': surtido({ ronda: corporativoAlFilo() }),
  'corporativo-sin-piezas': surtido({ ronda: conPedido(conAvance(), 1, { corporativoOC: true }) }),
  'pedido-unico-corporativo-incompleto': surtido({ ronda: conPedido(pedidoUnico(surtir('0486600', 5)), 0, { corporativoOC: true }) }),
  'ronda-dos-corporativo': surtido({
    ronda: conPedido(soloPedidos(retocar(base(), { 0: completar, 1: surtir('0486600', 2) }), [0, 1]), 1, { corporativoOC: true }),
  }),
  'tres-corporativos': surtido({ ronda: tresCorporativos() }),
  'dos-corporativos': surtido({ ronda: dosCorporativos() }),
  parciales: surtido({ ronda: parcialesEnVarios() }),
  'parcial-en-a': surtido({ ronda: parcialEnA() }),
  'promocion-y-parciales': surtido({ ronda: promocionYParciales() }),
  'cierre-en-orden': surtido({ ronda: cierreEnOrden() }),
  'cancelado-corporativo': surtido({ ronda: cierreEnOrden(), simulacion: { cancelados: ['1002'] } }),
  'cancelado-al-finalizar': surtido({ ronda: conAvance(), simulacion: { cancelados: ['1002'] } }),
  'cancelado-automatico': surtido({ ronda: rondaAlFilo(), simulacion: { cancelados: ['1002'] } }),
  'todos-cancelados': surtido({ ronda: conAvance(), simulacion: { cancelados: ['1001', '1002', '1003'] } }),
  'dos-cancelados': surtido({ ronda: conAvance(), simulacion: { cancelados: ['1002', '1003'] } }),
  'falla-cancelados': surtido({ ronda: rondaAlFilo(), simulacion: { fallaComprobacionCancelados: true } }),
  'todo-negado': surtido({ ronda: retocar(base(), { 0: negarTodo, 1: negarTodo, 2: y(negarTodo, (p) => (p.codigo === '2010000' ? { ...p, motivoNegacion: null } : p)) }) }),
  'falla-guardado': surtido({ ronda: rondaAlFilo(), simulacion: { fallaGuardado: '1002' } }),
  'falla-guardado-servidor': surtido({ ronda: rondaAlFilo(), simulacion: { fallaGuardado: '1002', tipoFallaGuardado: 'servidor' } }),
  'falla-guardado-dos-veces': surtido({ ronda: rondaAlFilo(), simulacion: { fallaGuardado: '1002', vecesFallaGuardado: 2 } }),
  'falla-cierre-ronda': surtido({ ronda: rondaAlFilo(), simulacion: { fallaCierreRonda: true } }),
  'falla-guardado-pedido-unico': surtido({ ronda: pedidoUnico(todoMenos('1394010', 3)), simulacion: { fallaGuardado: '1001' } }),
  'falla-desvincular-al-cancelar': surtido({ ronda: rondaAlFilo(), simulacion: { fallaGuardado: '1002', fallaDesvincular: '1002' } }),
  'falla-desvincular': surtido({ ronda: conAvance(), simulacion: { fallaDesvincular: '1002' } }),
  'pedido-unico-falla-desvincular': surtido({ ronda: pedidoUnico(surtir('0486600', 1)), simulacion: { fallaDesvincular: '*' } }),
  'negado-y-surtido': surtido({ ronda: retocar(base(), { 0: y(negar('1365800', 'Producto dañado'), surtir('0486600', 1)) }) }),

  /* ---- Etiqueta única (EU) ---- */
  'eu-inactiva': surtido({ simulacion: { etiquetaUnica: false } }),
  'eu-repetida-ronda': surtido({ ronda: e1EnA(base()), simulacion: { etiquetaUnica: true } }),
  'eu-repetida-pedido-unico': surtido({ ronda: e1EnA(pedidoUnico()), simulacion: { etiquetaUnica: true } }),
  'eu-correccion': surtido({ ronda: euEnC(), ultimoEscaneo: { codigo: '0486600', pedidoId: '1003' }, simulacion: { etiquetaUnica: true } }),
  'eu-caducidad': surtido({
    ronda: retocar(primerPedidoCompleto(), { 1: perecedero('0486600'), 2: perecedero('0486600') }),
    simulacion: { etiquetaUnica: true, etiquetasMasAntiguas: true },
  }),

  /* ---- Guía por voz ---- */
  // Los balanceos (actividad 58) nunca forman ronda multipedido V2 (armado-ronda, clarificación 35): la ronda V2 es
  // siempre de la actividad 31 y el balanceo, de un solo pedido.
  'voz-ronda-31': surtido({ simulacion: { tipoTarea: 31, lecturaElementos: true } }),
  'voz-pedido-unico-58': surtido({ ronda: pedidoUnico(), simulacion: { tipoTarea: 58 } }),
  'voz-31-encendida': surtido({ simulacion: { tipoTarea: 31, lecturaElementos: true } }),
  'voz-58-apagada': surtido({ ronda: pedidoUnico(), simulacion: { tipoTarea: 58, lecturaElementos: false } }),

  /* ---- Imagen y familia ---- */
  'imagen-lenta': surtido({ simulacion: { demoraImagen: 3000 } }),
  'sin-familia': surtido({ ronda: retocar(base(), { 0: sinFamilia('1365800'), 2: sinFamilia('2010000') }) }),
  'con-ubicaciones': surtido({ simulacion: { ubicacionesUDN: true } }),
  familias: surtido({ ronda: filtrosYBateria(), simulacion: { ubicacionesUDN: true } }),
  'familias-sin-agrupar': surtido({ ronda: filtrosYBateria(), simulacion: { ubicacionesUDN: true, agruparPorFamilia: false } }),
  'familias-acentos': surtido({ ronda: familiasConAcentos() }),
  'familia-off': surtido({ simulacion: { agruparPorFamilia: false } }),
  'familia-falla': surtido({ simulacion: { fallaBanderaFamilia: true } }),
  'sin-dato-familia': surtido({ simulacion: { sinDatoFamilia: true, ubicacionesUDN: true } }),
  'ninguna-familia': surtido({ ronda: retocar(base(), { 0: sinFamilias, 1: sinFamilias, 2: sinFamilias }), simulacion: { ubicacionesUDN: true } }),
  'clasificacion-incompleta': surtido({ ronda: retocar(base(), { 0: sinFamilia('0486600'), 1: sinFamilia('0486600'), 2: sinFamilia('0486600') }) }),
  'familia-relleno': surtido({ ronda: familiaRelleno() }),
};

export function idEscenario(search: string = window.location.search): string | null {
  return new URLSearchParams(search).get('escenario');
}

export function semillaDesdeUrl(): Semilla | undefined {
  const id = idEscenario();
  return id ? ESCENARIOS[id] : undefined;
}
