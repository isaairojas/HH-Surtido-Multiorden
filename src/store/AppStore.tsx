/**
 * Estado global del surtido multi-orden: ronda en curso + toasts.
 */
import { createContext, useCallback, useContext, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import { estadoInicial, rondaReducer, type RondaAction, type RondaState } from '../domain/ronda';
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
};

const Ctx = createContext<Store | null>(null);

export type Semilla = { ronda?: RondaState; etapa?: Etapa; toast?: Omit<ToastData, 'id'>; ultimoEscaneo?: UltimoEscaneo };

export function AppStoreProvider({ children, semilla }: { children: ReactNode; semilla?: Semilla }) {
  const [ronda, dispatch] = useReducer(rondaReducer, undefined, () => semilla?.ronda ?? estadoInicial());
  const [etapa, setEtapa] = useState<Etapa>(semilla?.etapa ?? 'tareas');
  const [toast, setToast] = useState<ToastData | null>(semilla?.toast ? { id: 0, ...semilla.toast } : null);
  const [ultimoEscaneo, setUltimoEscaneo] = useState<UltimoEscaneo | null>(semilla?.ultimoEscaneo ?? null);

  const mostrarToast = useCallback((t: Omit<ToastData, 'id'>) => setToast({ id: Date.now(), ...t }), []);
  const cerrarToast = useCallback(() => setToast(null), []);

  const value = useMemo(
    () => ({ ronda, dispatch, etapa, setEtapa, toast, mostrarToast, cerrarToast, ultimoEscaneo, setUltimoEscaneo }),
    [ronda, etapa, toast, mostrarToast, cerrarToast, ultimoEscaneo],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore fuera de AppStoreProvider');
  return s;
}
