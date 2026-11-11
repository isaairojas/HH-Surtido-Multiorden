/**
 * Estado global del surtido multipedido V2: ronda en curso, toasts y, solo para la demo, la configuración
 * simulada de la sucursal.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import { estadoInicial, pedidoCompleto, rondaReducer, tareaSinAvance, type RondaAction, type RondaState } from '../domain/ronda';
import { SIMULACION_INICIAL, type Simulacion } from '../domain/simulacion';
import { SIGUIENTE_RONDA } from '../mocks/ronda';
import type { ToastKind } from '../design-system/components/organisms/Toast/Toast';

export type Etapa = 'surtido' | 'tareas';

export type ToastData = { id: number; kind: ToastKind; title: string; message: string };

/** Último código surtido y el pedido que lo recibió: la lista y las tarjetas lo resaltan (solo presentación). */
export type UltimoEscaneo = { codigo: string; pedidoId: string };

type Store = {
  ronda: RondaState;
  dispatch: Dispatch<RondaAction>;
  etapa: Etapa;
  setEtapa: (e: Etapa) => void;
  toast: ToastData | null;
  mostrarToast: (t: Omit<ToastData, 'id'>) => void;
  cerrarToast: () => void;
  ultimoEscaneo: UltimoEscaneo | null;
  setUltimoEscaneo: (u: UltimoEscaneo | null) => void;
  /**
   * Pedidos cuyo aviso "Pedido completado" ya salió (o que ya estaban cerrados al arrancar). Vive aquí y
   * no en la lista porque un pedido también se cierra o se reabre desde el detalle, que desmonta la lista.
   */
  pedidosAvisados: Set<string>;
  /** Configuración simulada de la sucursal, la tarea y el servidor (la siembra el escenario). */
  simulacion: Simulacion;
  /** La tarea tal como llegó del servidor (sin avance): salir del listado descarta todo y vuelve a este estado. */
  tareaOriginal: RondaState;
  /**
   * El listado ya se abrió (contenedores vinculados). Ir al detalle y volver no es una
   * apertura nueva; salir, finalizar o retomar la tarea sí.
   */
  listadoAbierto: boolean;
  setListadoAbierto: (v: boolean) => void;
  /**
   * Carga la siguiente tarea de la cola al finalizar la ronda: la asignación de tareas la muestra ya cargada
   * (SDD 2026-10-26-multipedido-surtido-listado · Finalizar el surtido del pedido).
   */
  cargarSiguienteTarea: () => void;
};

const Ctx = createContext<Store | null>(null);

export type Semilla = {
  ronda?: RondaState;
  etapa?: Etapa;
  toast?: Omit<ToastData, 'id'>;
  ultimoEscaneo?: UltimoEscaneo;
  simulacion?: Partial<Simulacion>;
};

export function AppStoreProvider({ children, semilla }: { children: ReactNode; semilla?: Semilla }) {
  const [ronda, dispatch] = useReducer(rondaReducer, undefined, () => semilla?.ronda ?? estadoInicial());
  const [tareaOriginal, setTareaOriginal] = useState<RondaState>(() => tareaSinAvance(ronda));
  const [etapa, setEtapa] = useState<Etapa>(semilla?.etapa ?? 'tareas');
  const [toast, setToast] = useState<ToastData | null>(semilla?.toast ? { id: 0, ...semilla.toast } : null);
  const [ultimoEscaneo, setUltimoEscaneo] = useState<UltimoEscaneo | null>(semilla?.ultimoEscaneo ?? null);
  // Conjunto mutable y estable: la lista lo consulta y lo actualiza al mostrar el aviso.
  const [pedidosAvisados] = useState(() => new Set(ronda.ronda.pedidos.filter(pedidoCompleto).map((p) => p.id)));
  const [simulacion] = useState<Simulacion>(() => ({ ...SIMULACION_INICIAL, ...semilla?.simulacion }));
  const [listadoAbierto, setListadoAbierto] = useState(false);

  // SDD 2026-10-26-multipedido-surtido-listado · Corregir la cantidad surtida de un pedido: un pedido reabierto por
  // una corrección vuelve a avisar "Pedido completado" cuando se completa otra vez.
  useEffect(() => {
    for (const p of ronda.ronda.pedidos) if (!pedidoCompleto(p)) pedidosAvisados.delete(p.id);
  }, [ronda, pedidosAvisados]);

  const mostrarToast = useCallback((t: Omit<ToastData, 'id'>) => setToast({ id: Date.now(), ...t }), []);
  const cerrarToast = useCallback(() => setToast(null), []);

  const cargarSiguienteTarea = useCallback(() => {
    const siguiente = estadoInicial(SIGUIENTE_RONDA);
    pedidosAvisados.clear();
    dispatch({ type: 'cargar', estado: siguiente });
    setTareaOriginal(siguiente);
    setUltimoEscaneo(null);
    setListadoAbierto(false);
  }, [pedidosAvisados]);

  const value = useMemo(
    () => ({
      ronda,
      dispatch,
      etapa,
      setEtapa,
      toast,
      mostrarToast,
      cerrarToast,
      ultimoEscaneo,
      setUltimoEscaneo,
      pedidosAvisados,
      simulacion,
      tareaOriginal,
      listadoAbierto,
      setListadoAbierto,
      cargarSiguienteTarea,
    }),
    [ronda, etapa, toast, mostrarToast, cerrarToast, ultimoEscaneo, pedidosAvisados, simulacion, tareaOriginal, listadoAbierto, cargarSiguienteTarea],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore fuera de AppStoreProvider');
  return s;
}
