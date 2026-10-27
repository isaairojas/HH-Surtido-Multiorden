/**
 * Escenarios de demo. ?escenario=<id> siembra el store al arrancar.
 * Mantiene el patrón del proyecto base: la semilla se lee una vez en main.tsx.
 */
import { estadoInicial, type PartidaPedido, type RondaState } from '../domain/ronda';
import type { Semilla } from '../store/AppStore';

/** Aplica un retoque a las partidas del pedido indicado por su índice en la ronda. */
function retocar(
  base: RondaState,
  cambios: Record<number, (p: PartidaPedido) => PartidaPedido>,
): RondaState {
  const pedidos = base.ronda.pedidos.map((pedido, i) => {
    const fn = cambios[i];
    return fn ? { ...pedido, partidas: pedido.partidas.map(fn) } : pedido;
  });
  return { ronda: { ...base.ronda, pedidos } };
}

const completar = (p: PartidaPedido): PartidaPedido => ({ ...p, surtido: p.solicitado });

function conAvanceMedio(): RondaState {
  return retocar(estadoInicial(), {
    0: (p) => {
      if (p.codigo === '0486600') return completar(p);
      if (p.codigo === '1365800') return { ...p, surtido: 3 };
      return p;
    },
  });
}

function primerPedidoCompleto(): RondaState {
  return retocar(estadoInicial(), { 0: completar });
}

/** El pedido 100001 solo necesita la última partida: el próximo escaneo lo cierra. */
function primerPedidoAlFilo(): RondaState {
  return retocar(estadoInicial(), {
    0: (p) => (p.codigo === '2389475' ? { ...p, surtido: p.solicitado - 1 } : completar(p)),
  });
}

/** Ronda con una partida negada: el código 0512300 no tiene existencia suficiente. */
function conNegado(): RondaState {
  return retocar(estadoInicial(), {
    1: (p) => (p.codigo === '0512300' ? { ...p, motivoNegacion: 'Sin existencia' } : p),
  });
}

/** Solo falta una pieza en todo el último pedido: el próximo escaneo cierra la ronda. */
function rondaAlFilo(): RondaState {
  return retocar(estadoInicial(), {
    0: completar,
    1: completar,
    2: (p) => (p.codigo === '3310500' ? { ...p, surtido: p.solicitado - 1 } : completar(p)),
  });
}

export const ESCENARIOS: Record<string, Semilla> = {
  /** Toma de tarea (ronda recién asignada, 3 pedidos pendientes). */
  tareas: { etapa: 'tareas' },

  /** Surtido vacío, nadie ha escaneado nada. */
  inicial: { etapa: 'surtido' },

  /** Surtido con avance intermedio sobre el primer pedido. */
  'con-avance': { etapa: 'surtido', ronda: conAvanceMedio() },

  /** Una pieza antes de cerrar el primer pedido: dispara el aviso de transición. */
  'cierra-pedido': { etapa: 'surtido', ronda: primerPedidoAlFilo() },

  /** El primer pedido quedó completo, listo para pasar al siguiente. */
  'primer-pedido-ok': { etapa: 'surtido', ronda: primerPedidoCompleto() },

  /** Una partida negada por falta de existencia. */
  negado: { etapa: 'surtido', ronda: conNegado() },

  /** Una pieza antes de cerrar la ronda entera. */
  'cierra-ronda': { etapa: 'surtido', ronda: rondaAlFilo() },
};

export function idEscenario(search: string = window.location.search): string | null {
  return new URLSearchParams(search).get('escenario');
}

export function semillaDesdeUrl(): Semilla | undefined {
  const id = idEscenario();
  return id ? ESCENARIOS[id] : undefined;
}
