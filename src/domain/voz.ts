/**
 * Guía por voz en el listado (SDD 2026-11-05-multipedido-surtido-listado-cierre · Guía por voz en el listado), con
 * las reglas de lectura de `2026-10-24-configuracion-aplicacion` (Víctor Limón): se lee WHILE se trabaja una tarea
 * 58, o una tarea 31 con "Lectura de elementos" de "Tareas de surtido" encendida. Se lee el resumen al abrir el
 * listado, al completar un producto y con "Repetir audio". En una ronda multipedido V2 el resumen nombra la ronda
 * ("Ronda de {n} pedidos, …") sin leer su folio; en cualquier otra tarea, "Pedido {n}, …" como hoy.
 *
 * La lectura del detalle de producto y la detención de la voz al salir no cambian con este cambio; la demo solo
 * detiene la voz al salir del listado.
 */
import { conteosRonda, esMultipedidoV2, type Ronda } from './ronda';
import type { Simulacion } from './simulacion';

/** Resumen que se lee; `numero` es el pedido sin formato (en la voz se dice dígito por dígito, como el V2). */
export function resumenVoz(r: Ronda): string {
  const c = conteosRonda(r);
  const avance = `${c.completado} códigos surtidos, ${c.parcial} surtidos parcialmente y ${c.pendientes} pendientes de surtir`;
  if (esMultipedidoV2(r)) return `Ronda de ${r.pedidos.length} pedidos, ${avance}`;
  return `Pedido ${r.pedidos[0]?.id ?? ''}, ${avance}`;
}

/** Tarea 58: siempre. Tarea 31: solo con "Lectura de elementos" de "Tareas de surtido" encendida. */
export const debeLeer = (s: Simulacion) => s.tipoTarea === 58 || s.lecturaElementos;

/** Dígitos separados, como `formatSpeechDigits` del V2 ("Pedido 1 0 0 1"). */
const digitoPorDigito = (texto: string) => texto.replace(/^Pedido (\d+)/, (_, n: string) => `Pedido ${n.split('').join(' ')}`);

/** Lee en voz alta con la voz del navegador, si la tiene (la demo también lo muestra como subtítulo). */
export function hablar(texto: string): void {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(digitoPorDigito(texto));
    u.lang = 'es-MX';
    synth.speak(u);
  } catch {
    /* sin voz en este navegador: queda el subtítulo */
  }
}

export function callar(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* sin voz en este navegador */
  }
}
