/**
 * Modelo del surtido multipedido V2 (una ronda contiene N pedidos ya ordenados
 * por el algoritmo de picking; cada pedido tiene sus propias partidas).
 *
 * El orden de los pedidos y de las partidas dentro de un pedido se asume
 * ya calculado upstream — este módulo no reordena nada, solo opera sobre el
 * estado y expone una vista agregada por código para la pantalla principal.
 *
 * Las variantes de partida (escaneable / misceláneo / negado) y las validaciones
 * de cantidad replican Revision-HH-v2 (spec FR-018, https://isaairojas.github.io/Revision-HH-v2/).
 * Decisiones tomadas con el usuario el 2026-10-21:
 *   - La "excepción" de FR-014/FR-017 se modela como la negación de Revision-HH-v2:
 *     la registra el surtidor desde el detalle eligiendo un motivo del catálogo.
 *   - Una cantidad que excede lo solicitado o la existencia se rechaza entera
 *     (regla de Revision-HH-v2); no se aplica el remanente.
 *
 * Mejoras SDD sobre el canónico de exodus-gtm-pwa (ver sdd/README.md):
 *   - SDD 2026-10-26-multipedido-armado-ronda: qué pedidos forman la ronda. Lo evalúa el back-end; este
 *     módulo sigue recibiendo la ronda ya armada. El simulador del armado está en armado.ts.
 *   - SDD 2026-10-26-multipedido-surtido-listado: lo que este módulo simula (vista por código, asignación,
 *     negación, cierre de pedido).
 *   - Negación (2026-10-26, sustituye la regla de un solo pedido del 2026-10-21): se niegan el
 *     pedido en proceso y todos los posteriores que tengan el código, retirando lo ya surtido.
 *     No hay negación parcial: el surtidor no decide qué pedido se queda la mercancía.
 *   - Promociones AxB (2026-10-27): se evalúan por pedido con la regla del V2 real
 *     (`getPendingPromotionProducts`) y solo bloquean el cierre de la ronda. Ver `promocionesPendientes`.
 *   - Corrección en escalera (2026-11-09, clarify 9-17): "Corregir {letra}" deja en 0, con confirmación, el
 *     último pedido con piezas del código; con él en 0, se corrige el anterior, hasta el primero. Ver
 *     `partidaACorregir`.
 *   - "Cantidad surtida" del detalle como el V2 (clarify 28, sustituye a la 18): se surte desde el listado; en
 *     el detalle, el pedido en surtido se ajusta con −/+ o a mano solo si ya tiene piezas. Ver `fijarCantidad`.
 */
import type { OrderItemStatus } from '../design-system/components/molecules/OrderItemRow/OrderItemRow';
import { RONDA_INICIAL } from '../mocks/ronda';

export type Cliente = { id: string; nombre: string };

/** [Planta, Pasillo, Torre, Nivel] — mismo orden que el detalle de Revision-HH-v2. */
export type Ubicacion = [string, string, string, string];

/** La tupla guarda valores crudos; la lista los muestra con su etiqueta delante. */
export function ubicacionLegible(u: Ubicacion): [string, string, string, string] {
  return [u[0], `Pasillo ${u[1]}`, `Torre ${u[2]}`, `Nivel ${u[3]}`];
}

/** Promoción AxB. El mismo id puede repetirse en varios pedidos de la ronda. */
export type Promocion = { id: string; nombre: string };

export type PartidaPedido = {
  codigo: string;
  descripcion: string;
  ubicacion: Ubicacion;
  /** Piezas disponibles en la ubicación. Revision-HH-v2 valida contra ella antes de surtir. */
  existencia: number;
  surtido: number;
  solicitado: number;
  /** No se escanea: la cantidad se captura a mano (en el detalle no hay campo de lector). */
  miscelaneo: boolean;
  /** Motivo por el que el surtidor negó la partida. null = sin negar. */
  motivoNegacion: string | null;
  /** Imagen del producto (ruta relativa importable). */
  imagen: string;
  /** Promoción AxB a la que pertenece la partida en su pedido. null = sin promoción. */
  promocion: Promocion | null;
  /**
   * Familia del catálogo (`apFamilia`: Producto → apFamiliaGrupo → apDivisionFamilia → apFamilia).
   * SDD 2026-10-26-surtido-listado-imagen-familia · Agrupación por familia. En el real no viene en IAssortmentProduct.
   * Cadena vacía = el código no tiene familia en el catálogo (va al final al agrupar).
   */
  familia: string;
  /** El producto requiere etiqueta única (`requiereEU`): con la EU activa en la tarea, su QR se valida. */
  requiereEU?: boolean;
  /** Perecedero (`esPerecedero`): con EU, se comprueba que la etiqueta sea la de caducidad más próxima. */
  perecedero?: boolean;
};

/**
 * Etiqueta única ya surtida en la ronda y el pedido que recibió su pieza (SDD 2026-10-26-multipedido-surtido-listado ·
 * Validación de etiqueta única (EU)): una etiqueta no se repite en la ronda y se relaciona con su pedido.
 */
export type EtiquetaSurtida = { qr: string; pedidoId: string; codigo: string };

/*
 * Campos que este modelo no tiene y que el canónico tampoco trae en IAssortmentProduct:
 *   - SDD 2026-10-26-multipedido-armado-ronda: servicio, tipo de pedido y origen por división de factura.
 *   - SDD 2026-10-26-multipedido-armado-ronda · Pedidos corporativos: groupId de la ronda y relOrdenID por pedido.
 * `cliente` sí existe aquí pero no en el contrato real (choque C4 de sdd/changes/2026-10-26-multipedido-surtido-listado/analisis-repositorio.md).
 */
export type Pedido = {
  id: string;
  cliente: Cliente;
  partidas: PartidaPedido[];
  /** Corporativo con orden de compra: no permite negar y, si queda incompleto, se saca de la ronda. */
  corporativoOC?: boolean;
  /**
   * Letra del contenedor (A, B, C…), asignada por su lugar al tomar la ronda. No cambia si otro pedido sale
   * de la ronda: el contenedor físico sigue siendo el mismo.
   */
  contenedor?: string;
};

export type Ronda = {
  id: string;
  pedidos: Pedido[];
};

export type RondaState = { ronda: Ronda; etiquetas?: EtiquetaSurtida[] };

export type RondaAction =
  /**
   * Suma `cantidad` al pedido con menor orden que todavía necesita el código (lector o captura). Con `etiqueta`
   * (QR de etiqueta única validado), la relaciona con ese pedido.
   */
  | { type: 'surtirPorCodigo'; codigo: string; cantidad: number; etiqueta?: string }
  /**
   * Saca el pedido de la ronda (corporativo con orden de compra incompleto al finalizar).
   * SDD 2026-10-26-multipedido-surtido-listado · Sacar el pedido de la ronda.
   */
  | { type: 'retirarPedido'; pedidoId: string }
  /** Sustituye el estado completo: salir del listado descarta todo y la tarea vuelve a como llegó. */
  | { type: 'cargar'; estado: RondaState }
  /**
   * Regresa a 0 las piezas del código en el último pedido que tiene (`partidaACorregir`).
   * SDD 2026-10-26-multipedido-surtido-listado · Corregir la cantidad surtida de un pedido.
   */
  | { type: 'corregir'; codigo: string }
  /**
   * "Cantidad surtida" del detalle, como el V2 (clarify del 2026-11-09, fila 28): fija la cantidad del código en
   * el pedido en surtido al regresar al listado. Se valida antes con `evaluarCantidadDetalle`.
   */
  | { type: 'fijarCantidad'; codigo: string; pedidoId: string; cantidad: number }
  /**
   * Niega el código desde el pedido en proceso hasta el último de la ronda (`partidasANegar`).
   * SDD 2026-10-26-multipedido-surtido-listado · Negar producto desde el detalle.
   */
  | { type: 'negar'; codigo: string; motivo: string }
  /**
   * Niega la promoción en cada pedido donde quedó incompleta, retirando lo surtido.
   * SDD 2026-10-26-multipedido-surtido-listado · Promoción incompleta al finalizar la ronda.
   */
  | { type: 'negarPromocion'; promocionId: string }
  | { type: 'reiniciar' };

/**
 * Catálogo de motivos de negación.
 * Fuente: Revision-HH-v2, bottom sheet "Selección de motivo negado" (opciones `.neg-option`).
 */
export const MOTIVOS_NEGACION: string[] = [
  'Sin existencia',
  'Producto dañado',
  'Producto incorrecto',
  'Ubicación incorrecta',
];

/** Motivo con el que se niegan las partidas de una promoción retirada (reasonID 6 en el V2 real). */
export const MOTIVO_PROMOCION = 'Promoción incompleta';

/** Copia profunda: el estado inicial nunca comparte partidas con el mock. */
function clonar(ronda: Ronda): Ronda {
  return { ...ronda, pedidos: ronda.pedidos.map((p) => ({ ...p, partidas: p.partidas.map((x) => ({ ...x })) })) };
}

export function estadoInicial(ronda: Ronda = RONDA_INICIAL): RondaState {
  const r = clonar(ronda);
  return { ronda: { ...r, pedidos: r.pedidos.map((p, i) => ({ ...p, contenedor: p.contenedor ?? letraPorIndice(i) })) } };
}

/** Letra por el lugar en la ronda: 0 → A, 1 → B, … */
export const letraPorIndice = (idx: number) => String.fromCharCode(65 + idx);

/** Letra del contenedor del pedido en la posición `idx` (la asignada al tomar la ronda). */
export function letraDe(r: Ronda, idx: number): string {
  return r.pedidos[idx]?.contenedor ?? letraPorIndice(idx);
}

/**
 * La tarea tal como llega del servidor: sin piezas ni negaciones registradas desde la HH. Salir del listado
 * descarta todo lo registrado, negaciones incluidas, y la tarea vuelve a este estado.
 */
export function tareaSinAvance(s: RondaState): RondaState {
  const pedidos = s.ronda.pedidos.map((p) => ({ ...p, partidas: p.partidas.map((x) => ({ ...x, surtido: 0, motivoNegacion: null })) }));
  return { ronda: { ...s.ronda, pedidos } };
}

/** Ronda multipedido V2: más de un pedido. Con uno solo, el listado se comporta como hoy. */
export const esMultipedidoV2 = (r: Ronda) => r.pedidos.length > 1;

/* ------------------------------------------------------------------ *
 * Estado de una partida
 * ------------------------------------------------------------------ */

/** Sin `parcial-negado`: negar retira lo surtido, así que una partida negada siempre queda en 0. */
export type EstadoPartida = 'pendiente' | 'parcial' | 'completo' | 'negado';

export function estadoPartida(p: PartidaPedido): EstadoPartida {
  if (p.motivoNegacion) return 'negado';
  if (p.surtido <= 0) return 'pendiente';
  if (p.surtido < p.solicitado) return 'parcial';
  return 'completo';
}

/** Variante efectiva de la partida (FR-014). */
export type VariantePartida = 'escaneable' | 'miscelaneo' | 'negado';

export function variantePartida(p: PartidaPedido): VariantePartida {
  if (p.motivoNegacion) return 'negado';
  return p.miscelaneo ? 'miscelaneo' : 'escaneable';
}

/** Mapea el estado al chip del design-system. */
export function statusDeEstado(e: EstadoPartida): OrderItemStatus {
  if (e === 'negado') return 'negado';
  if (e === 'parcial') return 'parcial';
  if (e === 'completo') return 'completado';
  return 'no-iniciado';
}

export function statusPartida(p: PartidaPedido): OrderItemStatus {
  return statusDeEstado(estadoPartida(p));
}

/** La partida ya no pide más trabajo: se surtió completa o se negó. */
export function partidaResuelta(p: PartidaPedido): boolean {
  return p.motivoNegacion !== null || p.surtido >= p.solicitado;
}

/** La partida todavía necesita piezas de ese código. */
export function partidaNecesitaCodigo(p: PartidaPedido): boolean {
  return p.motivoNegacion === null && p.surtido < p.solicitado;
}

/* ------------------------------------------------------------------ *
 * Estado de pedidos y ronda
 * ------------------------------------------------------------------ */

/** Pedido sin trabajo pendiente: cada partida surtida al 100 % o negada. */
export function pedidoCompleto(p: Pedido): boolean {
  return p.partidas.every(partidaResuelta);
}

/** Ronda cerrada: todos los pedidos resueltos (FR-020). */
export function rondaCompleta(r: Ronda): boolean {
  return r.pedidos.every(pedidoCompleto);
}

/** Índice del primer pedido no completo. Si todos están completos, apunta al último. */
export function pedidoActualIdx(r: Ronda): number {
  const idx = r.pedidos.findIndex((p) => !pedidoCompleto(p));
  return idx < 0 ? r.pedidos.length - 1 : idx;
}

/**
 * Primer pedido que pasó de incompleto a completo entre dos estados (FR-019).
 * Devuelve el pedido cerrado y el siguiente pendiente, o null si no cerró ninguno.
 */
export function transicionDePedido(antes: Ronda, despues: Ronda): { completado: Pedido; siguiente: Pedido | null } | null {
  for (let i = 0; i < despues.pedidos.length; i++) {
    const previo = antes.pedidos[i];
    const actual = despues.pedidos[i];
    if (!previo || pedidoCompleto(previo) || !pedidoCompleto(actual)) continue;
    const siguiente = despues.pedidos.slice(i + 1).find((p) => !pedidoCompleto(p)) ?? null;
    return { completado: actual, siguiente };
  }
  return null;
}

/** ¿Todos los pedidos pertenecen al mismo cliente? */
export function mismoCliente(pedidos: Pedido[]): boolean {
  if (pedidos.length <= 1) return true;
  const id = pedidos[0].cliente.id;
  return pedidos.every((p) => p.cliente.id === id);
}

/**
 * Clientes que aparecen en más de un pedido de la ronda. La toma de tarea marca
 * con "Mismo cliente" a cada pedido cuyo cliente está en este conjunto (FR-003).
 */
export function clientesRepetidos(pedidos: Pedido[]): Set<string> {
  const veces = new Map<string, number>();
  for (const p of pedidos) veces.set(p.cliente.id, (veces.get(p.cliente.id) ?? 0) + 1);
  return new Set([...veces].filter(([, n]) => n > 1).map(([id]) => id));
}

/* ------------------------------------------------------------------ *
 * Vista agregada por código (pantalla principal)
 * ------------------------------------------------------------------ */

/**
 * Presencia de un código en cada pedido donde aparece, en el orden de la ronda.
 * Se usa para armar la vista agregada y el desglose por pedido del detalle.
 */
export type Presencia = {
  pedidoId: string;
  cliente: Cliente;
  ordenPedido: number;
  /** Letra del contenedor del pedido. */
  contenedor: string;
  surtido: number;
  solicitado: number;
  estado: EstadoPartida;
  motivoNegacion: string | null;
};

export type ProductoVista = {
  codigo: string;
  descripcion: string;
  imagen: string;
  ubicacion: Ubicacion;
  existencia: number;
  miscelaneo: boolean;
  familia: string;
  surtidoTotal: number;
  solicitadoTotal: number;
  presencias: Presencia[];
};

/**
 * Agrupa las partidas de la ronda por código. El orden del arreglo resultante
 * respeta la secuencia de picking: primer pedido primero, dentro de cada pedido
 * en el orden en que vienen las partidas; cada código solo aparece una vez
 * (en su primera aparición).
 *
 * Descripción, imagen, ubicación, existencia y variante se toman de la primera
 * aparición: son atributos del producto, no del pedido, así que se asumen iguales
 * en todas las partidas del mismo código.
 *
 * SDD 2026-10-26-multipedido-surtido-listado · Lista agregada por código: esta función.
 * SDD 2026-10-26-surtido-listado-imagen-familia · Agrupación por familia: agruparía por familia dentro de
 * cada sección. Ojo: el V2 real ordena por ubicación o código, no por primera aparición.
 */
export function productosVista(r: Ronda): ProductoVista[] {
  const porCodigo = new Map<string, ProductoVista>();
  r.pedidos.forEach((pedido, ordenPedido) => {
    for (const part of pedido.partidas) {
      const presencia: Presencia = {
        pedidoId: pedido.id,
        cliente: pedido.cliente,
        ordenPedido,
        contenedor: letraDe(r, ordenPedido),
        surtido: part.surtido,
        solicitado: part.solicitado,
        estado: estadoPartida(part),
        motivoNegacion: part.motivoNegacion,
      };
      const existente = porCodigo.get(part.codigo);
      if (existente) {
        existente.surtidoTotal += part.surtido;
        existente.solicitadoTotal += part.solicitado;
        existente.presencias.push(presencia);
        continue;
      }
      porCodigo.set(part.codigo, {
        codigo: part.codigo,
        descripcion: part.descripcion,
        imagen: part.imagen,
        ubicacion: part.ubicacion,
        existencia: part.existencia,
        miscelaneo: part.miscelaneo,
        familia: part.familia,
        surtidoTotal: part.surtido,
        solicitadoTotal: part.solicitado,
        presencias: [presencia],
      });
    }
  });
  return [...porCodigo.values()];
}

/**
 * Agrupación por familia (SDD 2026-10-26-surtido-listado-imagen-familia): las familias van en orden alfabético y,
 * dentro de cada una, los códigos de menor a mayor (regla del 2026-11-09: antes conservaban la secuencia de
 * picking y en "Foco" salía 2012000 antes que 1978000). Los códigos sin familia van juntos al final, también
 * de menor a mayor. Solo reordena la vista: no cambia a qué pedido entra cada escaneo.
 */
export function ordenarPorFamilia(v: ProductoVista[]): ProductoVista[] {
  const clave = (p: ProductoVista) => (p.familia.trim() ? 0 : 1);
  return [...v].sort(
    (a, b) =>
      clave(a) - clave(b) ||
      a.familia.localeCompare(b.familia, 'es', { sensitivity: 'base' }) ||
      a.codigo.localeCompare(b.codigo, 'es', { numeric: true }),
  );
}

/** Secciones del listado V2 (`getProductSections`), en su orden. No llevan encabezado y las vacías no se pintan. */
const SECCION: Record<OrderItemStatus, number> = { 'no-iniciado': 0, parcial: 1, negado: 2, completado: 3 };

/** Compara dos ubicaciones como el V2: zona, pasillo, torre y nivel, en ese orden. */
const compararUbicacion = (a: Ubicacion, b: Ubicacion) => {
  for (let i = 0; i < 4; i++) {
    const d = a[i].localeCompare(b[i], 'es', { numeric: true, sensitivity: 'base' });
    if (d) return d;
  }
  return 0;
};

const compararCodigo = (a: ProductoVista, b: ProductoVista) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true });

/**
 * Orden del listado, como el V2 de hoy (`AssortmentTaskController.getProductSections`): secciones Pendientes,
 * Parciales, Negados y Completados, sin encabezados y sin pintar las vacías, así que un código cambia de lugar al
 * cambiar de estado. Dentro de cada sección, por ubicación con `Bandera_UbicacionesUDN` o, si no, por código.
 * Con `Bandera_AgrupacionFamiliaEnHH`, dentro de cada sección manda la familia (alfabética, sin distinguir
 * mayúsculas ni acentos) y, dentro de la familia, el código: la ubicación ya no ordena. Los códigos sin familia van
 * al final de su sección.
 * SDD 2026-10-26-surtido-listado-imagen-familia · Agrupación por familia / Orden dentro de la agrupación por familia.
 */
export function ordenarListado(v: ProductoVista[], o: { familia: boolean; ubicaciones: boolean }): ProductoVista[] {
  const sinFamilia = (p: ProductoVista) => (p.familia.trim() ? 0 : 1);
  return [...v].sort((a, b) => {
    const seccion = SECCION[statusProducto(a)] - SECCION[statusProducto(b)];
    if (seccion) return seccion;
    if (o.familia) {
      return (
        sinFamilia(a) - sinFamilia(b) ||
        a.familia.localeCompare(b.familia, 'es', { sensitivity: 'base' }) ||
        compararCodigo(a, b)
      );
    }
    return (o.ubicaciones ? compararUbicacion(a.ubicacion, b.ubicacion) : 0) || compararCodigo(a, b);
  });
}

export function productoVista(r: Ronda, codigo: string): ProductoVista | undefined {
  return productosVista(r).find((v) => v.codigo === codigo);
}

/**
 * Estado consolidado del código en la ronda.
 * Mientras alguna presencia siga pendiente el código no está resuelto, aunque otra
 * esté negada. Ya resuelto, solo cuenta como negado si lo está en todas sus presencias;
 * si unos pedidos se surtieron y otros se negaron se muestra parcial.
 */
export function statusProducto(v: ProductoVista): OrderItemStatus {
  const resueltas = v.presencias.every((p) => p.estado === 'completo' || p.estado === 'negado');
  if (!resueltas) return v.surtidoTotal > 0 ? 'parcial' : 'no-iniciado';
  if (v.presencias.every((p) => p.estado === 'negado')) return 'negado';
  return v.surtidoTotal >= v.solicitadoTotal ? 'completado' : 'parcial';
}

/** Conteo agregado a nivel ronda, mostrado arriba de la lista (FR-012). */
export function conteosRonda(r: Ronda) {
  const c = { completado: 0, parcial: 0, negado: 0, pendientes: 0 };
  for (const v of productosVista(r)) {
    const st = statusProducto(v);
    if (st === 'completado') c.completado++;
    else if (st === 'parcial') c.parcial++;
    else if (st === 'negado') c.negado++;
    else c.pendientes++;
  }
  return c;
}

/* ------------------------------------------------------------------ *
 * Reglas de asignación y validación
 * ------------------------------------------------------------------ */

export type UbicacionPartida = { pedidoIdx: number; partidaIdx: number };

/**
 * Dado un código, decide a qué partida sumar. Regla acordada (FR-010):
 * se prioriza el pedido con menor orden en la ronda que aún necesite ese código.
 * Si ningún pedido lo necesita (todos resueltos o el código no existe), devuelve null.
 */
export function proximaPartidaPara(r: Ronda, codigo: string): UbicacionPartida | null {
  for (let i = 0; i < r.pedidos.length; i++) {
    const j = r.pedidos[i].partidas.findIndex((p) => p.codigo === codigo && partidaNecesitaCodigo(p));
    if (j >= 0) return { pedidoIdx: i, partidaIdx: j };
  }
  return null;
}

export const partidaEn = (r: Ronda, loc: UbicacionPartida): PartidaPedido =>
  r.pedidos[loc.pedidoIdx].partidas[loc.partidaIdx];

export type PartidaANegar = UbicacionPartida & {
  pedidoId: string;
  contenedor: string;
  /** Piezas ya surtidas que se retiran al negar. */
  surtido: number;
  solicitado: number;
};

/**
 * Partidas que se niegan juntas (SDD 2026-10-26-multipedido-surtido-listado · Negar producto desde el
 * detalle): la del pedido en proceso —el de menor orden que todavía necesita el código— y
 * las de todos los pedidos posteriores que lo tengan sin negar, aunque no se hayan surtido.
 * Los pedidos anteriores ya completos no se tocan. Vacío si ningún pedido necesita el código.
 */
export function partidasANegar(r: Ronda, codigo: string): PartidaANegar[] {
  const desde = proximaPartidaPara(r, codigo);
  if (!desde) return [];
  const out: PartidaANegar[] = [];
  for (let i = desde.pedidoIdx; i < r.pedidos.length; i++) {
    const j = r.pedidos[i].partidas.findIndex((p) => p.codigo === codigo && p.motivoNegacion === null);
    if (j < 0) continue;
    const p = r.pedidos[i].partidas[j];
    out.push({ pedidoIdx: i, partidaIdx: j, pedidoId: r.pedidos[i].id, contenedor: letraDe(r, i), surtido: p.surtido, solicitado: p.solicitado });
  }
  return out;
}

export type PartidaACorregir = UbicacionPartida & { pedidoId: string; contenedor: string; surtido: number; solicitado: number };

/**
 * Partida que corrige el detalle (SDD 2026-10-26-multipedido-surtido-listado · Corregir la cantidad surtida de un
 * pedido, regla del 2026-11-09): la del último pedido de la ronda con piezas del código. El escaneo
 * llena A, luego B, luego C, así que lo que sobra siempre quedó en el último; el surtidor no elige qué
 * pedido se queda la mercancía. Tras corregirla, la siguiente llamada da el pedido anterior con piezas
 * ("Corregir {anterior}"). null si ningún pedido tiene piezas del código.
 */
export function partidaACorregir(r: Ronda, codigo: string): PartidaACorregir | null {
  for (let i = r.pedidos.length - 1; i >= 0; i--) {
    const j = r.pedidos[i].partidas.findIndex((p) => p.codigo === codigo && p.surtido > 0);
    if (j < 0) continue;
    const p = r.pedidos[i].partidas[j];
    return { pedidoIdx: i, partidaIdx: j, pedidoId: r.pedidos[i].id, contenedor: letraDe(r, i), surtido: p.surtido, solicitado: p.solicitado };
  }
  return null;
}

/**
 * Motivos de rechazo de un surtido, con los textos exactos de Revision-HH-v2.
 * `fuera-de-ronda`: el código no está en ningún pedido de la ronda (FR-011). Un código que sí está pero ya se
 * surtió completo en todos los pedidos que lo piden es un sobrante, como hoy: `excede-solicitado`.
 */
export type RechazoSurtido =
  | 'fuera-de-ronda'
  | 'producto-negado'
  | 'cantidad-cero'
  | 'excede-solicitado'
  | 'excede-existencia';

/** Textos de hoy (es.ts del V2) salvo los propios del multipedido V2, marcados como provisionales. */
export const AVISOS: Record<RechazoSurtido, { title: string; message: string }> = {
  'fuera-de-ronda': {
    title: 'Código inválido',
    message: 'El código escaneado no pertenece a ningún pedido de esta ronda.',
  },
  // Validación de producto escaneado: el código ya no lo necesita ningún pedido y está negado.
  'producto-negado': {
    title: 'Producto negado',
    message: 'El código escaneado fue negado y no es posible agregar unidades.',
  },
  'cantidad-cero': {
    title: 'Cantidad inválida',
    message: 'No es posible surtir un producto con cantidad cero. Por favor, ingresa una cantidad mayor.',
  },
  'excede-solicitado': {
    title: 'Cantidad inválida',
    message: 'La cantidad que intentas ingresar es mayor a la solicitada. Por favor, ingresa una cantidad igual o menor.',
  },
  'excede-existencia': {
    title: 'Cantidad inválida',
    message: 'La cantidad que intentas ingresar es mayor a la existencia actual. Por favor, ingresa una cantidad igual o menor.',
  },
};

export type EvaluacionSurtido =
  | { ok: true; loc: UbicacionPartida; pedidoId: string }
  | { ok: false; rechazo: RechazoSurtido };

/**
 * Valida un surtido antes de aplicarlo, en el mismo orden que Revision-HH-v2:
 * destino → cantidad cero → excede lo solicitado → excede la existencia.
 */
export function evaluarSurtido(r: Ronda, codigo: string, cantidad: number): EvaluacionSurtido {
  const loc = proximaPartidaPara(r, codigo);
  if (!loc) {
    if (codigoNegado(r, codigo)) return { ok: false, rechazo: 'producto-negado' };
    if (!codigoEnRonda(r, codigo)) return { ok: false, rechazo: 'fuera-de-ronda' };
    // Sobrante (revisión del 2026-11-09): ya surtido en todos sus pedidos; se valida la cantidad como hoy.
    return { ok: false, rechazo: cantidad <= 0 ? 'cantidad-cero' : 'excede-solicitado' };
  }
  const p = partidaEn(r, loc);
  if (cantidad <= 0) return { ok: false, rechazo: 'cantidad-cero' };
  if (p.surtido + cantidad > p.solicitado) return { ok: false, rechazo: 'excede-solicitado' };
  if (p.surtido + cantidad > p.existencia) return { ok: false, rechazo: 'excede-existencia' };
  return { ok: true, loc, pedidoId: r.pedidos[loc.pedidoIdx].id };
}

/**
 * Validación de "Cantidad surtida" al regresar del detalle, la de hoy (`validateAssortedQuantity` del V2):
 * cantidad cero, mayor a la solicitada del pedido o mayor a la existencia. null si es válida.
 */
export function evaluarCantidadDetalle(p: PartidaPedido, cantidad: number): RechazoSurtido | null {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return 'cantidad-cero';
  if (cantidad > p.solicitado) return 'excede-solicitado';
  if (cantidad > p.existencia) return 'excede-existencia';
  return null;
}

/** El código está en algún pedido de la ronda, en cualquier estado. */
export function codigoEnRonda(r: Ronda, codigo: string): boolean {
  return r.pedidos.some((p) => p.partidas.some((x) => x.codigo === codigo));
}

/** El código está negado en algún pedido de la ronda. */
export function codigoNegado(r: Ronda, codigo: string): boolean {
  return r.pedidos.some((p) => p.partidas.some((x) => x.codigo === codigo && x.motivoNegacion !== null));
}

/**
 * Cambio de pedido de un código (SDD 2026-10-26-multipedido-surtido-listado · Avisos de cambio de pedido):
 * el surtido dejó completa la partida del código en un pedido y las siguientes piezas ya van a
 * otro. Devuelve los dos pedidos, o null si el destino no cambió o ya no hay destino.
 */
export function cambioDePedido(
  antes: Ronda,
  despues: Ronda,
  codigo: string,
): { desde: Pedido; ordenDesde: number; letraDesde: string; hacia: Pedido; ordenHacia: number } | null {
  const a = proximaPartidaPara(antes, codigo);
  const d = proximaPartidaPara(despues, codigo);
  if (!a || !d || a.pedidoIdx === d.pedidoIdx) return null;
  return {
    desde: despues.pedidos[a.pedidoIdx],
    ordenDesde: a.pedidoIdx,
    letraDesde: letraDe(despues, a.pedidoIdx),
    hacia: despues.pedidos[d.pedidoIdx],
    ordenHacia: d.pedidoIdx,
  };
}

/** Piezas surtidas de un código en un pedido (0 si el pedido no lo pide). Las muestra el aviso "Pedido surtido". */
export function piezasEn(p: Pedido, codigo: string): number {
  return p.partidas.find((x) => x.codigo === codigo)?.surtido ?? 0;
}

/* ------------------------------------------------------------------ *
 * Promociones AxB
 * ------------------------------------------------------------------ */

export type PartidaPromocion = { codigo: string; descripcion: string; surtido: number; solicitado: number; negado: boolean };

export type PromocionPendiente = {
  promocion: Promocion;
  /** Solo los pedidos donde la promoción quedó incompleta, en el orden de la ronda. */
  pedidos: { pedidoId: string; ordenPedido: number; contenedor: string; partidas: PartidaPromocion[] }[];
};

/**
 * Regla de `getPendingPromotionProducts` del V2 real, aplicada a las partidas de una promoción
 * dentro de un pedido: ya negada entera no cuenta; con algún código negado, o con todos
 * iniciados y alguno incompleto, la promoción está pendiente.
 */
function promocionIncompleta(partidas: PartidaPedido[]): boolean {
  if (partidas.every((p) => p.motivoNegacion)) return false;
  const conNegado = partidas.some((p) => p.motivoNegacion);
  const vivas = partidas.filter((p) => !p.motivoNegacion);
  if (!conNegado && !vivas.every((p) => p.surtido > 0)) return false;
  return conNegado || vivas.some((p) => p.surtido < p.solicitado);
}

/**
 * Promociones que impiden cerrar la ronda, agrupadas por id entre pedidos. Por el orden
 * consecutivo del surtido, el primer pedido puede completar la promoción y los siguientes no:
 * solo se listan los pedidos donde quedó incompleta.
 * SDD 2026-10-26-multipedido-surtido-listado · Promoción incompleta al finalizar la ronda.
 */
export function promocionesPendientes(r: Ronda): PromocionPendiente[] {
  const porId = new Map<string, PromocionPendiente>();
  r.pedidos.forEach((pedido, ordenPedido) => {
    const ids = new Set(pedido.partidas.flatMap((p) => (p.promocion ? [p.promocion.id] : [])));
    for (const id of ids) {
      const partidas = pedido.partidas.filter((p) => p.promocion?.id === id);
      if (!promocionIncompleta(partidas)) continue;
      const pendiente = porId.get(id) ?? { promocion: partidas[0].promocion!, pedidos: [] };
      pendiente.pedidos.push({
        pedidoId: pedido.id,
        ordenPedido,
        contenedor: letraDe(r, ordenPedido),
        partidas: partidas.map((p) => ({
          codigo: p.codigo,
          descripcion: p.descripcion,
          surtido: p.surtido,
          solicitado: p.solicitado,
          negado: p.motivoNegacion !== null,
        })),
      });
      porId.set(id, pendiente);
    }
  });
  return [...porId.values()];
}

/* ------------------------------------------------------------------ *
 * Finalizar el surtido (SDD 2026-11-05-multipedido-surtido-listado-cierre · Bloqueos y fallas al finalizar)
 * ------------------------------------------------------------------ */

/** Hay partidas en 0 sin negar: al finalizar de forma manual se pide negarlas primero. */
export function hayCodigosSinSurtir(r: Ronda): boolean {
  return r.pedidos.some((p) => p.partidas.some((x) => x.motivoNegacion === null && x.surtido === 0));
}

/** Pedidos con alguna partida surtida parcialmente, en el orden de la ronda. */
export function pedidosConParciales(r: Ronda): { pedido: Pedido; idx: number }[] {
  return r.pedidos
    .map((pedido, idx) => ({ pedido, idx }))
    .filter(({ pedido }) => pedido.partidas.some((x) => estadoPartida(x) === 'parcial'));
}

/**
 * Códigos con alguna partida surtida parcialmente, una vez cada uno y con su avance total y por contenedor,
 * como la fila del listado (revisión del 2026-11-09: "agrúpalos como en la ventana principal"). El orden lo
 * pone la pantalla, igual que el listado (por familia si la bandera está activa).
 */
export function codigosParciales(r: Ronda): ProductoVista[] {
  return productosVista(r).filter((v) => v.presencias.some((p) => p.estado === 'parcial'));
}

/** Primer pedido corporativo con orden de compra que sigue incompleto (se ofrece sacarlo de la ronda). */
export function corporativoIncompleto(r: Ronda): number {
  return r.pedidos.findIndex((p) => p.corporativoOC && !pedidoCompleto(p));
}

/** La ronda puede cerrarse: todo resuelto y sin promociones incompletas. */
export function rondaFinalizable(r: Ronda): boolean {
  return rondaCompleta(r) && promocionesPendientes(r).length === 0;
}

/* ------------------------------------------------------------------ *
 * Reducer
 * ------------------------------------------------------------------ */

export function rondaReducer(s: RondaState, a: RondaAction): RondaState {
  switch (a.type) {
    case 'surtirPorCodigo': {
      const ev = evaluarSurtido(s.ronda, a.codigo, a.cantidad);
      if (!ev.ok) return s;
      const p = partidaEn(s.ronda, ev.loc);
      const surtido = conPartida(s, ev.loc, { ...p, surtido: p.surtido + a.cantidad });
      if (!a.etiqueta) return surtido;
      const relacion = { qr: a.etiqueta, pedidoId: s.ronda.pedidos[ev.loc.pedidoIdx].id, codigo: a.codigo };
      return { ...surtido, etiquetas: [...(s.etiquetas ?? []), relacion] };
    }
    case 'corregir': {
      // Un pedido completo que queda incompleto se reabre solo: su partida vuelve a pedir el código.
      const loc = partidaACorregir(s.ronda, a.codigo);
      if (!loc) return s;
      return conPartida(s, loc, { ...partidaEn(s.ronda, loc), surtido: 0 });
    }
    case 'fijarCantidad': {
      // Solo la partida sin negar del pedido indicado, con una cantidad válida (si no, el estado no cambia).
      const pedidoIdx = s.ronda.pedidos.findIndex((p) => p.id === a.pedidoId);
      const partidaIdx = pedidoIdx < 0 ? -1 : s.ronda.pedidos[pedidoIdx].partidas.findIndex((x) => x.codigo === a.codigo);
      if (partidaIdx < 0) return s;
      const loc = { pedidoIdx, partidaIdx };
      const p = partidaEn(s.ronda, loc);
      if (p.motivoNegacion !== null || evaluarCantidadDetalle(p, a.cantidad)) return s;
      return conPartida(s, loc, { ...p, surtido: a.cantidad });
    }
    case 'negar': {
      // Cada partida negada vuelve a 0: lo que ya se había surtido se retira.
      return partidasANegar(s.ronda, a.codigo).reduce(
        (acc, loc) => conPartida(acc, loc, { ...partidaEn(acc.ronda, loc), surtido: 0, motivoNegacion: a.motivo }),
        s,
      );
    }
    case 'negarPromocion': {
      // Solo los pedidos donde quedó incompleta: el que la completó conserva lo surtido.
      const pendiente = promocionesPendientes(s.ronda).find((p) => p.promocion.id === a.promocionId);
      if (!pendiente) return s;
      const afectados = new Set(pendiente.pedidos.map((p) => p.pedidoId));
      const pedidos = s.ronda.pedidos.map((pedido) =>
        !afectados.has(pedido.id)
          ? pedido
          : {
              ...pedido,
              partidas: pedido.partidas.map((x) =>
                x.promocion?.id !== a.promocionId || x.motivoNegacion ? x : { ...x, surtido: 0, motivoNegacion: MOTIVO_PROMOCION },
              ),
            },
      );
      return { ...s, ronda: { ...s.ronda, pedidos } };
    }
    case 'retirarPedido': {
      // Solo sale el documento corporativo: los demás pedidos conservan lo surtido y su letra, y no entra
      // ningún otro pedido en su lugar (la ronda es la que calculó el sistema al tomar la tarea).
      if (!s.ronda.pedidos.some((p) => p.id === a.pedidoId)) return s;
      return { ...s, ronda: { ...s.ronda, pedidos: s.ronda.pedidos.filter((p) => p.id !== a.pedidoId) } };
    }
    case 'cargar':
      return a.estado.etiquetas ? { ronda: clonar(a.estado.ronda), etiquetas: [...a.estado.etiquetas] } : { ronda: clonar(a.estado.ronda) };
    case 'reiniciar':
      return estadoInicial();
  }
}

function conPartida(s: RondaState, loc: UbicacionPartida, partida: PartidaPedido): RondaState {
  const pedidos = s.ronda.pedidos.map((p, i) =>
    i !== loc.pedidoIdx ? p : { ...p, partidas: p.partidas.map((x, j) => (j !== loc.partidaIdx ? x : partida)) },
  );
  return { ...s, ronda: { ...s.ronda, pedidos } };
}
