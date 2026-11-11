/**
 * Ronda de la demo con los datos de ejemplo de las specs (decisión del 2026-11-10: manda la spec, principio 5;
 * tabla de equivalencias en `demo-alineacion.md` del cambio del listado en exodus-gtm-pwa). Cada código tiene el
 * papel que le dan los escenarios:
 *
 * | Código  | Papel en la spec                                                                 | A · 1001 | B · 1002 | C · 1003 |
 * | ------- | -------------------------------------------------------------------------------- | -------- | -------- | -------- |
 * | 0486600 | Compartido principal; se escanea; "Kit afinación" en A y B                       | 11       | 5        | 3        |
 * | 2389475 | Pareja del kit en A y B; en B la ubicación tiene 1 de existencia; sin imagen    | 2        | 2        | 2        |
 * | 1394010 | Misceláneo (la cantidad se captura a mano)                                       | 4        | 2        | 3        |
 * | 1365800 | En la ronda pero fuera de la promoción; se escanea                               | 1        | —        | —        |
 * | 2012000 | Familia Foco, pasillo 1                                                           | —        | 3        | 2        |
 * | 1978000 | Familia Foco, pasillo 4                                                           | —        | —        | 1        |
 * | 2010000 | Familia Foco, pasillo 4                                                           | —        | —        | 1        |
 * | 9999999 | Fuera de la ronda (no está en ningún pedido)                                      | —        | —        | —        |
 *
 * 1001 y 1003 son del mismo cliente ("Mismo cliente" en el Detalle de la ronda); 1002 es de otro. La ronda cumple
 * las reglas de armado: los tres pedidos comparten códigos y suman 14 partidas, debajo del tope inicial de 15.
 *
 * Los escenarios traen cada uno su propio estado ("1001 tiene 3 de 11…"): las semillas de
 * `src/navigation/escenarios.ts` lo preparan sobre esta ronda, quitando pedidos o partidas cuando el escenario
 * habla de menos. `tests/domain/escenarios.test.mjs` comprueba que dan los números de la spec.
 *
 * Imágenes: fotos del catálogo (`resources.apymsa.com.mx/imagenes/FotosSpeed/<código>/<código>2a.jpg`). 2389475 no
 * tiene foto en el catálogo: su fila muestra la imagen por defecto ("Imagen no disponible"). Las descripciones de
 * 0486600, 2389475 y 1365800 son ilustrativas (se tomaron de la foto, no de una consulta al catálogo); las demás
 * son las del catálogo (consulta del 2026-11-02).
 */
import arnes from '@assets/productos/producto-0486600.jpg';
import cilindro from '@assets/productos/producto-1365800.jpg';
import cinta from '@assets/productos/producto-1394010.jpg';
import foco1141 from '@assets/productos/producto-2012000.jpg';
import foco1157 from '@assets/productos/producto-2010000.jpg';
import foco158 from '@assets/productos/producto-1978000.jpg';
import filtroAire from '@assets/productos/producto-filtro-aire.png';
import bateria from '@assets/productos/producto-bateria-duralast.png';
import bujia from '@assets/productos/producto-bujia-autolite-plp.png';
import bombaGasolina from '@assets/productos/producto-bomba-gasolina.png';
import type { Cliente, PartidaPedido, Pedido, Promocion, Ronda, Ubicacion } from '../domain/ronda';

/** Foto que el catálogo no tiene: la fila cae en la imagen por defecto, como en el surtido anterior. */
const SIN_FOTO = './sin-foto/producto-2389475.jpg';

/** [zona, pasillo, torre, nivel] */
const PASILLO_1: Ubicacion = ['Planta Baja', '1', '2', '1'];
const PASILLO_2: Ubicacion = ['Planta Baja', '2', '1', '2'];
const PASILLO_3: Ubicacion = ['Planta Baja', '3', '3', '1'];
const PASILLO_4: Ubicacion = ['Primer Piso', '4', '5', '1'];
const PASILLO_4B: Ubicacion = ['Primer Piso', '4', '6', '2'];

export const CLIENTE_A: Cliente = { id: 'CLI-A', nombre: 'AUTOPARTES DEL VALLE SA DE CV' };
export const CLIENTE_B: Cliente = { id: 'CLI-B', nombre: 'REFACCIONARIA LA ÚNICA' };

export const KIT_AFINACION: Promocion = { id: 'PROMO-AFINACION', nombre: 'Kit afinación' };

type Producto = { descripcion: string; familia: string; imagen: string; ubicacion: Ubicacion; miscelaneo: boolean };

/** Atributos del producto (iguales en todos los pedidos). */
export const PRODUCTOS: Record<string, Producto> = {
  '0486600': { descripcion: 'Arnés eléctrico con conectores', familia: 'Arnés', imagen: arnes, ubicacion: PASILLO_2, miscelaneo: false },
  '2389475': { descripcion: 'Juego de bujías', familia: 'Bujía', imagen: SIN_FOTO, ubicacion: PASILLO_3, miscelaneo: true },
  '1394010': { descripcion: 'Cinta aislante negra 60 pies Temflex 155 3M', familia: 'Cinta', imagen: cinta, ubicacion: PASILLO_1, miscelaneo: true },
  '1365800': { descripcion: 'Cilindro de encendido con llaves', familia: 'Cilindro encendido', imagen: cilindro, ubicacion: PASILLO_3, miscelaneo: false },
  '2012000': { descripcion: 'Foco incandescente 1141 transparente 12V 17W', familia: 'Foco', imagen: foco1141, ubicacion: PASILLO_1, miscelaneo: true },
  '1978000': { descripcion: 'Foco incandescente 158 transparente 12V 5W', familia: 'Foco', imagen: foco158, ubicacion: PASILLO_4, miscelaneo: true },
  '2010000': { descripcion: 'Foco incandescente 1034/1157 transparente 12V 32/3W', familia: 'Foco', imagen: foco1157, ubicacion: PASILLO_4B, miscelaneo: true },
  /*
   * Productos de los escenarios de familias ("dos filtros y una batería"; familias "BUJÍA", "bomba" y "Batería").
   * La spec usa códigos de ejemplo; solo aparecen en las semillas de esos escenarios.
   */
  '1001': { descripcion: 'Filtro de aire', familia: 'Filtro', imagen: filtroAire, ubicacion: PASILLO_4, miscelaneo: true },
  '2001': { descripcion: 'Batería 12V', familia: 'Batería', imagen: bateria, ubicacion: PASILLO_2, miscelaneo: true },
  '3001': { descripcion: 'Filtro de aire', familia: 'Filtro', imagen: filtroAire, ubicacion: PASILLO_1, miscelaneo: true },
  '4001': { descripcion: 'Bujía de iridio', familia: 'BUJÍA', imagen: bujia, ubicacion: PASILLO_1, miscelaneo: true },
  '5001': { descripcion: 'Bomba de gasolina', familia: 'bomba', imagen: bombaGasolina, ubicacion: PASILLO_2, miscelaneo: true },
  '6001': { descripcion: 'Batería 12V', familia: 'Batería', imagen: bateria, ubicacion: PASILLO_3, miscelaneo: true },
};

type Extras = { existencia?: number; promocion?: Promocion };

/** Partida de un pedido con los atributos del producto. Por defecto hay holgura de existencia. */
export function partida(codigo: string, solicitado: number, extras: Extras = {}): PartidaPedido {
  const prod = PRODUCTOS[codigo];
  return {
    codigo,
    descripcion: prod.descripcion,
    familia: prod.familia,
    imagen: prod.imagen,
    ubicacion: prod.ubicacion,
    miscelaneo: prod.miscelaneo,
    surtido: 0,
    solicitado,
    existencia: extras.existencia ?? solicitado + 20,
    motivoNegacion: null,
    promocion: extras.promocion ?? null,
  };
}

const KIT = { promocion: KIT_AFINACION };

const PEDIDO_1001: Pedido = {
  id: '1001',
  cliente: CLIENTE_A,
  partidas: [partida('0486600', 11, KIT), partida('2389475', 2, KIT), partida('1394010', 4), partida('1365800', 1)],
};

const PEDIDO_1002: Pedido = {
  id: '1002',
  cliente: CLIENTE_B,
  partidas: [
    partida('0486600', 5, KIT),
    // La ubicación tiene 1 en existencia: "Cantidad mayor a la existencia".
    partida('2389475', 2, { ...KIT, existencia: 1 }),
    partida('1394010', 2),
    partida('2012000', 3),
  ],
};

const PEDIDO_1003: Pedido = {
  id: '1003',
  cliente: CLIENTE_A,
  partidas: [
    partida('0486600', 3),
    partida('2389475', 2),
    partida('1394010', 3),
    // La familia Foco llega en el orden 2012000, 1978000, 2010000 ("Códigos de una familia de menor a mayor").
    partida('2012000', 2),
    partida('1978000', 1),
    partida('2010000', 1),
  ],
};

export const RONDA_INICIAL: Ronda = {
  id: 'R-20261021-01',
  pedidos: [PEDIDO_1001, PEDIDO_1002, PEDIDO_1003],
};

/**
 * Siguiente tarea de la cola: la que queda cargada en la asignación de tareas al finalizar la ronda
 * (SDD 2026-10-26-multipedido-surtido-listado · Finalizar el surtido del pedido · "El cierre no muestra
 * resumen de la ronda"). Una ronda de un solo pedido, para que se distinga a simple vista de la anterior.
 */
export const SIGUIENTE_RONDA: Ronda = {
  id: 'R-20261021-02',
  pedidos: [{ id: '1004', cliente: CLIENTE_B, partidas: [partida('1978000', 2), partida('2010000', 1)] }],
};

/** Empleado ficticio: la demo no lleva datos de empleados reales (clarificación 32 del 2026-11-10). */
export const EMPLEADO = { id: '0001', nombre: 'SURTIDOR DE PRUEBA' };

export const TAREA = {
  actividad: 'SURTIR RONDA DE PEDIDOS',
  documentoLabel: 'Pedidos',
  fecha: '21/10/2026',
  hora: '09:15 a.m.',
};
