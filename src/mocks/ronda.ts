/**
 * Mock de 1 ronda con 3 pedidos.
 * - 100001 y 100002 comparten cliente CLI-A → badge "Mismo cliente".
 * - 100003 es de otro cliente.
 * - Códigos 0486600 y 2389475 aparecen en 100001 y 100002 → badge "En N pedidos".
 *
 * Variantes de partida (FR-014), siguiendo el reparto de Revision-HH-v2 (3 de 5 misceláneos):
 * - 1365800 y 2095400 son misceláneos: no se escanean, la cantidad se captura a mano.
 * - El resto son escaneables.
 * - Ninguna arranca negada: la negación la registra el surtidor desde el detalle.
 *
 * `existencia` alimenta las validaciones de cantidad de Revision-HH-v2. El código
 * 0512300 tiene existencia por debajo de lo solicitado a propósito, para poder
 * probar el rechazo "mayor a la existencia actual" y la negación por "Sin existencia".
 *
 * - 0486600 vive en los 3 pedidos: prueba que el desglose del detalle quepa con 3 filas.
 * - Promoción AxB "Kit afinación" (filtro 0486600 + bujía 2389475) en 100001 y 100002. En el
 *   100003 el filtro va suelto, sin promoción. Negar la bujía cuando ya está completa en el
 *   100001 deja incompleta la promoción del 100002 y bloquea el cierre de la ronda.
 *
 * La ronda cumple las reglas de armado (sdd/changes/multiorden-armado-ronda): los tres pedidos
 * comparten algún código con la ronda (el 100003 comparte 1740900 y 0486600) y suman
 * 14 partidas, debajo del tope inicial de 15.
 */
import filtroAire from '@assets/productos/producto-filtro-aire.png';
import bombaGasolina from '@assets/productos/producto-bomba-gasolina.png';
import alternador from '@assets/productos/producto-alternador.png';
import bujiaDoble from '@assets/productos/producto-bujia-doble-platino.png';
import marcha from '@assets/productos/producto-marcha.png';
import bateria from '@assets/productos/producto-bateria-duralast.png';
import cables from '@assets/productos/producto-cables-bujias-kem.png';
import cuerpoAcel from '@assets/productos/producto-cuerpo-aceleracion.png';
import switchEnc from '@assets/productos/producto-switch-encendido.png';
import faro from '@assets/productos/producto-faro.png';
import type { Cliente, PartidaPedido, Pedido, Promocion, Ronda, Ubicacion } from '../domain/ronda';

const UBI: Ubicacion = ['Planta Baja', '1A', '3', '1'];
const UBI_2: Ubicacion = ['Planta Baja', '2B', '1', '2'];
const UBI_3: Ubicacion = ['Primer Piso', '4A', '5', '1'];

const CLI_A: Cliente = { id: 'CLI-A', nombre: 'AUTOPARTES DEL VALLE SA DE CV' };
const CLI_B: Cliente = { id: 'CLI-B', nombre: 'REFACCIONARIA LA ÚNICA' };

const KIT_AFINACION: Promocion = { id: 'PROMO-AFINA', nombre: 'Kit afinación' };

type Extras = Partial<Pick<PartidaPedido, 'miscelaneo' | 'motivoNegacion' | 'promocion'>> & { existencia?: number };

function p(
  codigo: string,
  descripcion: string,
  imagen: string,
  solicitado: number,
  ubicacion: Ubicacion = UBI,
  extras: Extras = {},
): PartidaPedido {
  return {
    codigo,
    descripcion,
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
    p('0486600', 'Filtro de aire', filtroAire, 11, UBI, { promocion: KIT_AFINACION }),
    p('1365800', 'Bomba de gasolina', bombaGasolina, 7, UBI_2, { miscelaneo: true }),
    p('1394001', 'Alternador 90A', alternador, 2, UBI_2),
    p('2389475', 'Bujía doble platino', bujiaDoble, 8, UBI_3, { promocion: KIT_AFINACION }),
  ],
};

const PEDIDO_100002: Pedido = {
  id: '100002',
  cliente: CLI_A,
  partidas: [
    p('0486600', 'Filtro de aire', filtroAire, 5, UBI, { promocion: KIT_AFINACION }),
    p('2389475', 'Bujía doble platino', bujiaDoble, 4, UBI_3, { promocion: KIT_AFINACION }),
    p('1740900', 'Marcha', marcha, 3, UBI_2),
    // Existencia 1 < solicitado 2: fuerza el rechazo por existencia y la negación.
    p('0512300', 'Batería Duralast', bateria, 2, UBI_3, { existencia: 1 }),
  ],
};

const PEDIDO_100003: Pedido = {
  id: '100003',
  cliente: CLI_B,
  partidas: [
    p('2095400', 'Cables bujías KEM', cables, 6, UBI_2, { miscelaneo: true }),
    p('7820001', 'Cuerpo aceleración', cuerpoAcel, 1, UBI_3),
    p('5600200', 'Switch encendido', switchEnc, 2, UBI),
    p('3310500', 'Faro halógeno', faro, 1, UBI_3),
    // Código compartido con el 100002: sin él, el 100003 no sería candidato (Requirement: Códigos compartidos).
    p('1740900', 'Marcha', marcha, 2, UBI_2),
    // Tercera presencia del filtro, sin promoción: el desglose del detalle muestra 3 pedidos.
    p('0486600', 'Filtro de aire', filtroAire, 3),
  ],
};

export const RONDA_INICIAL: Ronda = {
  id: 'R-20261021-01',
  pedidos: [PEDIDO_100001, PEDIDO_100002, PEDIDO_100003],
};

export const EMPLEADO = { id: '9029', nombre: 'JUAN ANTONIO GUERRERO MEDINA' };

export const TAREA = {
  actividad: 'SURTIR RONDA',
  documentoLabel: 'Ronda',
  fecha: '21/10/2026',
  hora: '09:15 a.m.',
};
