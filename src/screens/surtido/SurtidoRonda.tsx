/**
 * Pantalla principal del surtido multi-orden.
 * Lista agregada por código: una fila por producto único de la ronda, con
 * imagen, badge "En N pedidos" cuando aplica y chip "Mismo cliente".
 * El escaneo se dirige al pedido pendiente con menor orden que todavía lo necesite.
 *
 * Esta pantalla es el único punto que detecta el cierre de un pedido (FR-019) y el
 * de la ronda (FR-020): mira el estado del store, así que también reacciona a los
 * cambios hechos en el detalle del producto al volver a la lista.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@ds/components/organisms/AppHeader/AppHeader';
import { ContentPanel } from '@ds/components/organisms/ContentPanel/ContentPanel';
import { BottomBar } from '@ds/components/organisms/BottomBar/BottomBar';
import { OrderProgress } from '@ds/components/molecules/OrderProgress/OrderProgress';
import { ScanInput, type ScanInputHandle } from '@ds/components/molecules/ScanInput/ScanInput';
import { Divider } from '@ds/components/atoms/Divider/Divider';
import { leerCodigo } from '../../domain/codigos';
import { sonar } from '../../domain/sonidos';
import {
  AVISOS,
  conteosRonda,
  evaluarSurtido,
  partidaEn,
  pedidoActualIdx,
  pedidoCompleto,
  productosVista,
  proximaPartidaPara,
  rondaCompleta,
  type Pedido,
} from '../../domain/ronda';
import { useStore } from '../../store/AppStore';
import { ProductoRondaRow } from './ProductoRondaRow';
import { CantidadModal, PedidoCompletadoModal } from './overlays/SurtidoModals';
import styles from './SurtidoRonda.module.css';

export function SurtidoRonda() {
  const navigate = useNavigate();
  const { ronda, dispatch, mostrarToast } = useStore();
  const scanRef = useRef<ScanInputHandle>(null);
  const [capturando, setCapturando] = useState<string | null>(null);
  const [transicion, setTransicion] = useState<Pedido | null>(null);
  /** Pedidos cuyo aviso de cierre ya se mostró (o que ya estaban cerrados al entrar). */
  const avisados = useRef<Set<string>>(new Set(ronda.ronda.pedidos.filter(pedidoCompleto).map((p) => p.id)));

  const productos = productosVista(ronda.ronda);
  const c = conteosRonda(ronda.ronda);
  const idxActual = pedidoActualIdx(ronda.ronda);
  const pedidoActual = ronda.ronda.pedidos[idxActual];

  // Cierre de pedido (FR-019) y de ronda (FR-020).
  useEffect(() => {
    if (rondaCompleta(ronda.ronda)) return navigate('/ronda-terminada');
    const cerrado = ronda.ronda.pedidos.find((p) => pedidoCompleto(p) && !avisados.current.has(p.id));
    if (cerrado) {
      avisados.current.add(cerrado.id);
      setTransicion(cerrado);
    }
  }, [ronda, navigate]);

  const cerrarOverlay = () => {
    setCapturando(null);
    setTransicion(null);
    window.setTimeout(() => scanRef.current?.focus(), 0);
  };

  const rechazar = (rechazo: keyof typeof AVISOS) => {
    sonar('error');
    mostrarToast({ kind: 'error', ...AVISOS[rechazo] });
  };

  /** Aplica la cantidad al pedido con menor orden que todavía necesita el código (FR-010). */
  const surtir = (codigo: string, cantidad: number) => {
    const ev = evaluarSurtido(ronda.ronda, codigo, cantidad);
    if (!ev.ok) return rechazar(ev.rechazo);
    sonar('ok');
    dispatch({ type: 'surtirPorCodigo', codigo, cantidad });
  };

  const onScan = (valor: string) => {
    const l = leerCodigo(valor);
    if (l.tipo === 'invalido') return sonar('error');

    const destino = proximaPartidaPara(ronda.ronda, l.codigo);
    if (!destino) return rechazar('fuera-de-ronda');

    // Código corto o partida misceláneo: la cantidad se captura a mano
    // (Revision-HH-v2 abre el bottom sheet de cantidad en ambos casos).
    if (l.tipo === 'codigo' || partidaEn(ronda.ronda, destino).miscelaneo) {
      return setCapturando(l.codigo);
    }
    surtir(l.codigo, l.cantidad);
  };

  const partidaCapturando = capturando ? proximaPartidaPara(ronda.ronda, capturando) : null;
  const faltantes = partidaCapturando
    ? partidaEn(ronda.ronda, partidaCapturando).solicitado - partidaEn(ronda.ronda, partidaCapturando).surtido
    : 0;

  const siguientePedido = transicion
    ? (ronda.ronda.pedidos.slice(ronda.ronda.pedidos.indexOf(transicion) + 1).find((p) => !pedidoCompleto(p)) ?? null)
    : null;

  const hayOverlay = capturando !== null || transicion !== null;

  return (
    <div className={styles.screen}>
      <AppHeader backLabel="Menú" onBack={() => navigate('/tareas')} />

      <ContentPanel title="Surtido de órdenes" bottom={124} scroll>
        <OrderProgress
          titulo="Avance de la ronda"
          pedido={`${pedidoActual.id} · ${idxActual + 1}/${ronda.ronda.pedidos.length}`}
          completado={c.completado}
          negado={c.negado}
          parcial={c.parcial}
          pendientes={c.pendientes}
        />

        <div className={styles.list}>
          {productos.map((v, idx) => (
            <div key={v.codigo} className={styles.itemContainer}>
              {idx > 0 && <Divider variant="list" />}
              <ProductoRondaRow producto={v} onClick={() => navigate(`/detalle/${v.codigo}`)} />
            </div>
          ))}
        </div>
      </ContentPanel>

      <BottomBar>
        <ScanInput ref={scanRef} onScan={onScan} autoFocus={!hayOverlay} />
      </BottomBar>

      {capturando && (
        <CantidadModal
          codigo={capturando}
          sugerida={faltantes}
          onCancel={cerrarOverlay}
          onConfirm={(n) => {
            const codigo = capturando;
            cerrarOverlay();
            surtir(codigo, n);
          }}
        />
      )}

      {transicion && (
        <PedidoCompletadoModal
          pedidoCompletado={transicion.id}
          siguientePedido={siguientePedido?.id ?? null}
          siguienteCliente={siguientePedido?.cliente.nombre ?? null}
          onContinuar={cerrarOverlay}
        />
      )}
    </div>
  );
}
