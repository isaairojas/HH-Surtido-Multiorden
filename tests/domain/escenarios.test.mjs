/**
 * Las semillas de la demo dan los números de la spec. Cada prueba lleva el nombre del escenario (cambio ·
 * requisito · escenario) y comprueba, sobre la semilla que usa su caso del catálogo, el GIVEN y el THEN que se
 * pueden calcular en el dominio. Lo que solo se ve en pantalla (resaltados, modales, navegación) queda para QA.
 *
 * Correr con: npm run test:domain
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { etiqueta, leerCodigo } from '../../src/domain/codigos.ts';
import { debeLeer, resumenVoz } from '../../src/domain/voz.ts';
import { SIMULACION_INICIAL } from '../../src/domain/simulacion.ts';
import { interpretarLectura } from '../../src/domain/lector.ts';
import {
  cambioDePedido,
  codigosParciales,
  corporativoIncompleto,
  evaluarSurtido,
  letraDe,
  ordenarListado,
  partidaACorregir,
  partidasANegar,
  pedidoCompleto,
  productosVista,
  productoVista,
  promocionesPendientes,
  rondaReducer,
} from '../../src/domain/ronda.ts';
import { E1, E2, ESCENARIOS } from '../../src/navigation/escenarios.ts';
import { CASOS } from '../../src/navigation/catalogo.ts';
import { PRESETS_ARMADO } from '../../src/domain/armadoEscenarios.ts';

const semilla = (id) => {
  const s = ESCENARIOS[id];
  assert.ok(s, `no existe la semilla ${id}`);
  return s;
};
const ronda = (id) => semilla(id).ronda?.ronda ?? rondaReducer({ ronda: { id: '', pedidos: [] } }, { type: 'reiniciar' }).ronda;
const estado = (id) => ({ ronda: ronda(id) });
const desglose = (r, codigo) =>
  productoVista(r, codigo).presencias.map((p) => `${p.contenedor} ${p.estado === 'negado' ? 'Negado' : `${p.surtido}/${p.solicitado}`}`).join(' · ');
const surtir = (s, codigo, cantidad) => rondaReducer(s, { type: 'surtirPorCodigo', codigo, cantidad });
const orden = (r, o) => ordenarListado(productosVista(r), o).map((v) => v.codigo);
const piezas = (p) => p.partidas.reduce((n, x) => n + x.solicitado, 0);

test('cada caso del catálogo apunta a una semilla o a un preset del armado que existen', () => {
  const presets = new Set(PRESETS_ARMADO.map((p) => p.id));
  for (const c of CASOS) {
    if (c.armado) assert.ok(presets.has(c.armado), `${c.id}: preset ${c.armado}`);
    else assert.ok(ESCENARIOS[c.semilla], `${c.id}: semilla ${c.semilla}`);
  }
});

test('datos de la ronda: 1001 (A) y 1003 (C) del mismo cliente, 1002 (B) de otro; tarjetas 0 de 18, 12 y 12', () => {
  const r = ronda('inicial');
  assert.deepEqual(r.pedidos.map((p, i) => `${letraDe(r, i)}·${p.id}`), ['A·1001', 'B·1002', 'C·1003']);
  assert.equal(r.pedidos[0].cliente.id, r.pedidos[2].cliente.id);
  assert.notEqual(r.pedidos[0].cliente.id, r.pedidos[1].cliente.id);
  assert.deepEqual(r.pedidos.map(piezas), [18, 12, 12]);
  assert.ok(!r.pedidos.some((p) => p.partidas.some((x) => x.codigo === '9999999')));
});

test('Inicio de surtido · Ronda multipedido que no es V2: pedidos 101 y 102', () => {
  assert.deepEqual(ronda('sin-multipedido-v2').pedidos.map((p) => p.id), ['101', '102']);
  assert.equal(semilla('sin-multipedido-v2').simulacion.multipedidoEnHH, false);
});

test('Lista agregada · Código en dos pedidos: "0 de 16" y "A 0/11 · B 0/5"', () => {
  const v = productoVista(ronda('dos-pedidos'), '0486600');
  assert.equal(`${v.surtidoTotal} de ${v.solicitadoTotal}`, '0 de 16');
  assert.equal(desglose(ronda('dos-pedidos'), '0486600'), 'A 0/11 · B 0/5');
});

test('Lista agregada · Código negado en un pedido: "A 11/11 · B Negado"', () => {
  assert.equal(desglose(ronda('negado-un-pedido'), '0486600'), 'A 11/11 · B Negado');
});

test('Lista agregada · Ningún código compartido: cada código en un solo contenedor', () => {
  assert.ok(productosVista(ronda('sin-compartidos')).every((v) => v.presencias.length === 1));
});

test('Vinculación · Pieza de un código compartido y Validación · El primer pedido ya está completo', () => {
  assert.equal(desglose(ronda('primer-pedido-ok'), '0486600'), 'A 11/11 · B 0/5 · C 0/3');
  const res = interpretarLectura(estado('primer-pedido-ok'), etiqueta('0486600', 1));
  assert.deepEqual(res, { tipo: 'surtir', codigo: '0486600', cantidad: 1 });
  assert.equal(desglose(surtir(estado('primer-pedido-ok'), '0486600', 1).ronda, '0486600'), 'A 11/11 · B 1/5 · C 0/3');
  assert.equal(desglose(surtir(estado('primer-pedido-ok'), '0486600', 3).ronda, '0486600'), 'A 11/11 · B 3/5 · C 0/3');
});

test('Validación de producto escaneado: fuera de la ronda, sobrante, cero, existencia y negado', () => {
  assert.equal(interpretarLectura(estado('inicial'), '9999999').rechazo, 'fuera-de-ronda');
  assert.equal(evaluarSurtido(ronda('arnes-completo'), '0486600', 1).rechazo, 'excede-solicitado');
  assert.equal(evaluarSurtido(ronda('primer-pedido-ok'), '0486600', 0).rechazo, 'cantidad-cero');
  assert.equal(evaluarSurtido(ronda('primer-pedido-ok'), '2389475', 2).rechazo, 'excede-existencia');
  assert.equal(interpretarLectura(estado('negado'), etiqueta('1365800', 1)).rechazo, 'producto-negado');
});

test('Negar · cascada: en proceso, parcial y con el primer pedido ya surtido', () => {
  assert.deepEqual(partidasANegar(ronda('inicial'), '0486600').map((x) => x.pedidoId), ['1001', '1002', '1003']);
  const parcial = partidasANegar(ronda('negar-parcial'), '0486600');
  assert.deepEqual(parcial.map((x) => x.pedidoId), ['1001', '1002']);
  // "Aviso con pedidos sin surtir": 16 piezas a negar, 1001 con 3 de 11, 1002 con 5 sin surtir, se retiran 3.
  assert.equal(parcial.reduce((n, x) => n + x.solicitado, 0), 16);
  assert.deepEqual(parcial.map((x) => [x.surtido, x.solicitado]), [[3, 11], [0, 5]]);
  assert.deepEqual(partidasANegar(ronda('primer-pedido-ok'), '0486600').map((x) => x.pedidoId), ['1002', '1003']);
});

test('Restricciones para negar · Un corporativo en la cascada: 1002 es corporativo y tiene 0486600', () => {
  const r = ronda('corporativo');
  assert.ok(r.pedidos[1].corporativoOC);
  assert.ok(partidasANegar(r, '0486600').some((x) => x.pedidoId === '1002'));
});

test('Desglose · Detalle de un código en tres pedidos y Código resuelto en todos los pedidos', () => {
  assert.equal(desglose(ronda('primer-pedido-ok'), '0486600'), 'A 11/11 · B 0/5 · C 0/3');
  assert.equal(desglose(ronda('arnes-resuelto'), '0486600'), 'A 11/11 · B 5/5 · C Negado');
  assert.equal(productoVista(ronda('cinco-pedidos'), '0486600').presencias.length, 5);
});

test('Desglose y corrección: C surte 0486600 con 2 de 3 (A 11/11, B 5/5); 1394010 en A 4/4, B 2/2 y C 0/3', () => {
  assert.equal(desglose(ronda('correccion'), '0486600'), 'A 11/11 · B 5/5 · C 2/3');
  assert.equal(partidaACorregir(ronda('correccion'), '0486600').contenedor, 'C');
  assert.equal(partidaACorregir(ronda('arnes-en-c'), '0486600').contenedor, 'B');
  assert.equal(desglose(ronda('cinta-en-c'), '1394010'), 'A 4/4 · B 2/2 · C 0/3');
  assert.equal(partidaACorregir(ronda('cinta-en-c'), '1394010').contenedor, 'B');
  assert.equal(partidaACorregir(ronda('inicial'), '0486600'), null);
  assert.equal(desglose(ronda('cambio-pedido'), '0486600'), 'A 10/11 · B 0/5 · C 0/3');
});

test('Aviso de cambio de pedido: pasa al siguiente con 11 en A; sin otro pedido, no hay aviso', () => {
  const antes = estado('cambio-pedido');
  const cp = cambioDePedido(antes.ronda, surtir(antes, '0486600', 1).ronda, '0486600');
  assert.equal(cp.desde.id, '1001');
  assert.equal(cp.letraDesde, 'A');
  assert.equal(cp.desde.partidas.find((x) => x.codigo === '0486600').surtido, 11);
  assert.ok(!pedidoCompleto(cp.desde));
  const solo = estado('solo-en-a');
  assert.equal(cambioDePedido(solo.ronda, surtir(solo, '0486600', 1).ronda, '0486600'), null);
});

test('Aviso de pedido completado: 1001 se completa (con 1394010 y con un código compartido)', () => {
  assert.ok(pedidoCompleto(surtir(estado('cierra-pedido'), '1394010', 1).ronda.pedidos[0]));
  assert.ok(pedidoCompleto(surtir(estado('cierra-pedido-compartido'), '0486600', 1).ronda.pedidos[0]));
});

test('Promoción incompleta · solo en el segundo pedido: "Kit afinación" pendiente en 1002', () => {
  const p = promocionesPendientes(ronda('promocion'));
  assert.equal(p.length, 1);
  assert.equal(p[0].promocion.nombre, 'Kit afinación');
  assert.deepEqual(p[0].pedidos.map((x) => x.pedidoId), ['1002']);
  const b = p[0].pedidos[0].partidas.map((x) => `${x.codigo} ${x.negado ? 'Negado' : `${x.surtido} de ${x.solicitado}`}`);
  assert.deepEqual(b, ['0486600 5 de 5', '2389475 Negado']);
});

test('Bloqueos · Parciales en varios pedidos: 0486600 "8 de 16" (A 3/11 · B 5/5) y 2389475 "1 de 2" (C 1/2)', () => {
  const r = ronda('parciales');
  assert.equal(promocionesPendientes(r).length, 0);
  const parciales = ordenarListado(codigosParciales(r), { familia: true, ubicaciones: false });
  assert.deepEqual(
    parciales.map((v) => `${v.codigo} ${v.surtidoTotal} de ${v.solicitadoTotal} (${desglose(r, v.codigo)})`),
    ['0486600 8 de 16 (A 3/11 · B 5/5)', '2389475 1 de 2 (C 1/2)'],
  );
});

test('Orden de los avisos · La promoción negada sigue con el cierre: 2012000 "4 de 5" (B 3/3 · C 1/2)', () => {
  const s = estado('promocion-y-parciales');
  const id = promocionesPendientes(s.ronda)[0].promocion.id;
  const r = rondaReducer(s, { type: 'negarPromocion', promocionId: id }).ronda;
  assert.deepEqual(codigosParciales(r).map((v) => `${v.codigo} ${v.surtidoTotal} de ${v.solicitadoTotal} (${desglose(r, v.codigo)})`), [
    '2012000 4 de 5 (B 3/3 · C 1/2)',
  ]);
});

test('Orden de los avisos: el corporativo incompleto es 1002 y hay promoción y parciales detrás', () => {
  const r = ronda('cierre-en-orden');
  assert.equal(r.pedidos[corporativoIncompleto(r)].id, '1002');
  assert.equal(promocionesPendientes(r).length, 1);
  assert.ok(codigosParciales(r).length > 0);
});

test('Agrupación por familia: filtros juntos, acentos, la ubicación no ordena, sin familia al final y desactivada', () => {
  const f = { familia: true, ubicaciones: true };
  assert.deepEqual(orden(ronda('familias'), { familia: false, ubicaciones: true }), ['3001', '2001', '1001']);
  assert.deepEqual(orden(ronda('familias'), f), ['2001', '1001', '3001']);
  assert.deepEqual(orden(ronda('familias-acentos'), f), ['6001', '5001', '4001']);
  const focos = orden(ronda('inicial'), f).filter((c) => ['1978000', '2010000', '2012000'].includes(c));
  assert.deepEqual(focos, ['1978000', '2010000', '2012000']);
  assert.deepEqual(orden(ronda('sin-familia'), f).slice(-2), ['1365800', '2010000']);
  assert.deepEqual(orden(ronda('inicial'), { familia: false, ubicaciones: false }), [
    '0486600',
    '1365800',
    '1394010',
    '1978000',
    '2010000',
    '2012000',
    '2389475',
  ]);
});

test('Orden del listado: secciones Pendientes, Parciales, Negados y Completados, sin encabezados', () => {
  const r = surtir(estado('negado'), '0486600', 3).ronda;
  const o = ordenarListado(productosVista(r), { familia: true, ubicaciones: false }).map((v) => v.codigo);
  // 0486600 queda parcial y 1365800 negado: van después de los pendientes, en ese orden.
  assert.deepEqual(o.slice(-2), ['0486600', '1365800']);
});

const opciones = (id) => {
  const sim = { ...SIMULACION_INICIAL, ...semilla(id).simulacion };
  return { etiquetaUnica: sim.etiquetaUnica, etiquetasMasAntiguas: sim.etiquetasMasAntiguas };
};
const conEtiquetas = (id) => ({ ronda: ronda(id), etiquetas: semilla(id).ronda?.etiquetas });

test('Etiqueta única: el QR se lee como en el V2 (producto, cantidad y etiqueta)', () => {
  const l = leerCodigo(E1);
  assert.equal(l.tipo, 'qr');
  assert.equal(l.codigo, '0486600');
  assert.equal(l.cantidad, 1);
  assert.notEqual(E1, E2);
});

test('EU · QR sin etiqueta única activa: sigue la validación de cantidad y la pieza entra a 1001', () => {
  const res = interpretarLectura(estado('eu-inactiva'), E1, opciones('eu-inactiva'));
  assert.deepEqual(res, { tipo: 'surtir', codigo: '0486600', cantidad: 1 });
  assert.equal(desglose(surtir(estado('eu-inactiva'), '0486600', 1).ronda, '0486600'), 'A 1/11 · B 0/5 · C 0/3');
});

test('EU · Etiqueta repetida en la ronda: E1 ya surtida a 1001 se rechaza y no suma', () => {
  const s = conEtiquetas('eu-repetida-ronda');
  assert.deepEqual(s.etiquetas, [{ qr: E1, pedidoId: '1001', codigo: '0486600' }]);
  assert.deepEqual(interpretarLectura(s, E1, opciones('eu-repetida-ronda')), { tipo: 'etiqueta-repetida', codigo: '0486600', pedidoUnico: false });
  // Otra etiqueta sí entra y queda relacionada con el pedido que recibe la pieza.
  const otra = interpretarLectura(s, E2, opciones('eu-repetida-ronda'));
  assert.equal(otra.etiqueta, E2);
  const despues = rondaReducer(s, { type: 'surtirPorCodigo', codigo: '0486600', cantidad: 1, etiqueta: E2 });
  assert.deepEqual(despues.etiquetas.at(-1), { qr: E2, pedidoId: '1001', codigo: '0486600' });
});

test('EU · Etiqueta repetida en un pedido único: se rechaza con el texto del pedido', () => {
  const s = conEtiquetas('eu-repetida-pedido-unico');
  assert.equal(s.ronda.pedidos.length, 1);
  assert.equal(interpretarLectura(s, E1, opciones('eu-repetida-pedido-unico')).pedidoUnico, true);
});

test('EU · Caducidad más próxima en una ronda: "Etiqueta inválida" y, al confirmar, la pieza va a 1002', () => {
  const s = estado('eu-caducidad');
  const res = interpretarLectura(s, E2, opciones('eu-caducidad'));
  assert.deepEqual(res, { tipo: 'etiqueta-antigua', codigo: '0486600', cantidad: 1, etiqueta: E2 });
  const despues = rondaReducer(s, { type: 'surtirPorCodigo', codigo: res.codigo, cantidad: res.cantidad, etiqueta: res.etiqueta });
  assert.equal(desglose(despues.ronda, '0486600'), 'A 11/11 · B 1/5 · C 0/3');
  assert.deepEqual(despues.etiquetas, [{ qr: E2, pedidoId: '1002', codigo: '0486600' }]);
});

test('Guía por voz: "Ronda de 3 pedidos, …" sin folio y "Pedido 1001, …" con un solo pedido', () => {
  assert.equal(resumenVoz(ronda('voz-ronda-58')), 'Ronda de 3 pedidos, 0 códigos surtidos, 0 surtidos parcialmente y 7 pendientes de surtir');
  assert.ok(!resumenVoz(ronda('voz-ronda-58')).includes('R-2026'));
  assert.equal(resumenVoz(ronda('voz-pedido-unico-58')), 'Pedido 1001, 0 códigos surtidos, 0 surtidos parcialmente y 4 pendientes de surtir');
});

test('Guía por voz: la tarea 58 siempre lee; la 31 solo con "Lectura de elementos" encendida', () => {
  const sim = (id) => ({ ...SIMULACION_INICIAL, ...semilla(id).simulacion });
  assert.equal(debeLeer(sim('voz-58-apagada')), true);
  assert.equal(debeLeer(sim('voz-31-encendida')), true);
  assert.equal(debeLeer({ ...SIMULACION_INICIAL, tipoTarea: 31, lecturaElementos: false }), false);
});
