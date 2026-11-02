/**
 * Mock de 1 ronda con 3 pedidos, con códigos reales del catálogo (2026-11-02).
 * - 100001 y 100002 comparten cliente CLI-A → chip "Mismo cliente".
 * - 100003 es de otro cliente.
 * - 1394010 (cinta) y 6200401 (limpiador de carburador) aparecen en 100001 y 100002.
 *
 * Variantes de partida (FR-014): todas son misceláneas (la cantidad se captura a mano) salvo la
 * bomba de gasolina 0607006, que se escanea siempre. Ninguna arranca negada: la negación la
 * registra el surtidor desde el detalle.
 *
 * `existencia` alimenta las validaciones de cantidad de Revision-HH-v2. El código
 * 6200404 tiene existencia por debajo de lo solicitado a propósito, para poder
 * probar el rechazo "mayor a la existencia actual" y la negación por "Sin existencia".
 *
 * - 1394010 vive en los 3 pedidos: prueba que el desglose del detalle quepa con 3 filas.
 * - Promoción AxB "Kit mantenimiento" (cinta 1394010 + limpiador 6200401) en 100001 y 100002. En
 *   el 100003 la cinta va suelta, sin promoción. Negar el limpiador cuando ya está completo en el
 *   100001 deja incompleta la promoción del 100002 y bloquea el cierre de la ronda.
 *
 * La ronda cumple las reglas de armado (sdd/changes/multiorden-armado-ronda): los tres pedidos
 * comparten algún código con la ronda (el 100003 comparte 2012000 y 1394010) y suman
 * 12 partidas, debajo del tope inicial de 15.
 *
 * Imágenes: fotos del catálogo de productos.
 */
import cinta from '@assets/productos/producto-1394010.jpg';
import limpiadorCarb from '@assets/productos/producto-6200401.jpg';
import limpiadorContacto from '@assets/productos/producto-6200404.jpg';
import bombaGasolina from '@assets/productos/producto-0607006.jpg';
import relevador from '@assets/productos/producto-1458000.jpg';
import foco1141 from '@assets/productos/producto-2012000.jpg';
import foco1157 from '@assets/productos/producto-2010000.jpg';
import foco158 from '@assets/productos/producto-1978000.jpg';
import type { Cliente, PartidaPedido, Pedido, Promocion, Ronda, Ubicacion } from '../domain/ronda';

const UBI: Ubicacion = ['Planta Baja', '1A', '3', '1'];
const UBI_2: Ubicacion = ['Planta Baja', '2B', '1', '2'];
const UBI_3: Ubicacion = ['Primer Piso', '4A', '5', '1'];

const CLI_A: Cliente = { id: 'CLI-A', nombre: 'AUTOPARTES DEL VALLE SA DE CV' };
const CLI_B: Cliente = { id: 'CLI-B', nombre: 'REFACCIONARIA LA ÚNICA' };

const KIT_MANTENIMIENTO: Promocion = { id: 'PROMO-MANTTO', nombre: 'Kit mantenimiento' };

const MISC = { miscelaneo: true } as const;

type Extras = Partial<Pick<PartidaPedido, 'miscelaneo' | 'motivoNegacion' | 'promocion'>> & { existencia?: number };

/** Descripción y familia de cada código, tal como vienen del catálogo (consulta del 2026-11-02). */
const CATALOGO: Record<string, { descripcion: string; familia: string }> = {
  '1394010': { descripcion: 'Cinta aislante negra 60 pies Temflex 155 3M', familia: 'Cinta' },
  '6200401': { descripcion: 'Limpiador carburador Clean-R-Carb CRC', familia: 'Limpiador' },
  '6200404': { descripcion: 'Limpiador contacto eléctrico QD CRC', familia: 'Limpiador' },
  '0607006': { descripcion: 'Bomba gasolina repuesto 100 PSI 170 L/H', familia: 'Bomba gasolina' },
  '1458000': { descripcion: 'Relevador universal 12V 30-40A', familia: 'Relevador' },
  '2012000': { descripcion: 'Foco incandescente 1141 transparente 12V 17W', familia: 'Foco' },
  '2010000': { descripcion: 'Foco incandescente 1034/1157 transparente 12V 32/3W', familia: 'Foco' },
  '1978000': { descripcion: 'Foco incandescente 158 transparente 12V 5W', familia: 'Foco' },
};

function p(
  codigo: string,
  imagen: string,
  solicitado: number,
  ubicacion: Ubicacion = UBI,
  extras: Extras = {},
): PartidaPedido {
  return {
    codigo,
    ...CATALOGO[codigo],
    imagen,
    ubicacion,
    surtido: 0,
    solicitado,
    // Por defecto hay holgura de existencia para que el camino feliz no tope.
    existencia: extras.existencia ?? solicitado + 20,
    miscelaneo: extras.miscelaneo ?? false,
    motivoNegacion: extras.motivoNegacion ?? null,
    promocion: extras.promocion ?? null,
  };
}

const PEDIDO_100001: Pedido = {
  id: '100001',
  cliente: CLI_A,
  partidas: [
    p('1394010', cinta, 11, UBI, { ...MISC, promocion: KIT_MANTENIMIENTO }),
    // Única partida escaneable de la ronda: se escanea siempre.
    p('0607006', bombaGasolina, 2, UBI_2),
    p('1458000', relevador, 2, UBI_2, MISC),
    p('6200401', limpiadorCarb, 8, UBI_3, { ...MISC, promocion: KIT_MANTENIMIENTO }),
  ],
};

const PEDIDO_100002: Pedido = {
  id: '100002',
  cliente: CLI_A,
  partidas: [
    p('1394010', cinta, 5, UBI, { ...MISC, promocion: KIT_MANTENIMIENTO }),
    p('6200401', limpiadorCarb, 4, UBI_3, { ...MISC, promocion: KIT_MANTENIMIENTO }),
    p('2012000', foco1141, 3, UBI_2, MISC),
    // Existencia 1 < solicitado 2: fuerza el rechazo por existencia y la negación.
    p('6200404', limpiadorContacto, 2, UBI_3, { ...MISC, existencia: 1 }),
  ],
};

const PEDIDO_100003: Pedido = {
  id: '100003',
  cliente: CLI_B,
  partidas: [
    p('1978000', foco158, 1, UBI_3, MISC),
    p('2010000', foco1157, 1, UBI_3, MISC),
    // Código compartido con el 100002: sin él, el 100003 no sería candidato (Requirement: Códigos compartidos).
    p('2012000', foco1141, 2, UBI_2, MISC),
    // Tercera presencia de la cinta, sin promoción: el desglose del detalle muestra 3 pedidos.
    p('1394010', cinta, 3, UBI, MISC),
  ],
};

export const RONDA_INICIAL: Ronda = {
  id: 'R-20261021-01',
  pedidos: [PEDIDO_100001, PEDIDO_100002, PEDIDO_100003],
};

export const EMPLEADO = { id: '9029', nombre: 'JUAN ANTONIO GUERRERO MEDINA' };

export const TAREA = {
  actividad: 'SURTIR RONDA DE PEDIDOS',
  documentoLabel: 'Pedidos',
  fecha: '21/10/2026',
  hora: '09:15 a.m.',
};
