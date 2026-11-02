/**
 * Pantalla principal del surtido multi-orden.
 * Lista agregada por código: una fila por producto único de la ronda, con
 * imagen, badge "En N pedidos" cuando aplica y chip "Mismo cliente".
 * El escaneo se dirige al pedido pendiente con menor orden que todavía lo necesite.
 *
 * Esta pantalla es el único punto que detecta el cierre de un pedido (FR-019) y el
 * de la ronda (FR-020): mira el estado del store, así que también reacciona a los
 * cambios hechos en el detalle del producto al volver a la lista.
 *
 * SDD multiorden-surtido-listado:
 * - Avisos de cambio de pedido: si un escaneo deja completo el código en un pedido que sigue
 *   abierto y las siguientes piezas van a otro, se avisa con `CambioPedidoModal`. Si el pedido
 *   se cerró, el aviso de pedido completado ya dice a cuál se pasa.
 * - Promoción incompleta al finalizar la ronda: con todo resuelto pero una promoción AxB
 *   incompleta, la ronda no se cierra. Se abre el flujo de promoción; ✕ deja la ronda como
 *   estaba (no se retira nada) y "Finalizar surtido" lo vuelve a abrir.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@ds/components/organisms/AppHeader/AppHeader';
import { ContentPanel } from '@ds/components/organisms/ContentPanel/ContentPanel';
import { BottomBar } from '@ds/components/organisms/BottomBar/BottomBar';
import { OrderProgress } from '@ds/components/molecules/OrderProgress/OrderProgress';
import { ScanInput, type ScanInputHandle } from '@ds/components/molecules/ScanInput/ScanInput';
import { Divider } from '@ds/components/atoms/Divider/Divider';
import { Button } from '@ds/components/atoms/Button/Button';
import { leerCodigo } from '../../domain/codigos';
import { sonar } from '../../domain/sonidos';
import {
  AVISOS,
  cambioDePedido,
  conteosRonda,
  evaluarSurtido,
  partidaEn,
  pedidoActualIdx,
  pedidoCompleto,
  ordenarPorFamilia,
  productosVista,
  promocionesPendientes,
  proximaPartidaPara,
  rondaCompleta,
  rondaReducer,
  type Pedido,
  type PromocionPendiente,
} from '../../domain/ronda';
import { CONFIG_MULTIORDEN_DEFAULT } from '../../domain/configMultiorden';
import { useStore } from '../../store/AppStore';
import { ProductoRondaRow } from './ProductoRondaRow';
import { ContenedoresResumen } from './Contenedores';
import { CambioPedidoModal, CantidadModal, PedidoCompletadoModal } from './overlays/SurtidoModals';
import { EscanearPromocionModal, PromocionNegadaModal, PromocionPendienteModal } from './overlays/PromocionModals';
import styles from './SurtidoRonda.module.css';

export function SurtidoRonda() {
  const navigate = useNavigate();
  const { ronda, dispatch, mostrarToast, ultimoEscaneo, setUltimoEscaneo } = useStore();
  const scanRef = useRef<ScanInputHandle>(null);
  const [capturando, setCapturando] = useState<string | null>(null);
  const [transicion, setTransicion] = useState<Pedido | null>(null);
  /** Pedidos cuyo aviso de cierre ya se mostró (o que ya estaban cerrados al entrar). */
  const avisados = useRef<Set<string>>(new Set(ronda.ronda.pedidos.filter(pedidoCompleto).map((p) => p.id)));
  const [cambio, setCambio] = useState<{ codigo: string; desde: string; hacia: string; ordenHacia: number } | null>(null);
  /** Flujo de promoción incompleta. `retirada` es la foto previa a negar, para el paso 3. */
  const [promo, setPromo] = useState<
    | { paso: 'pendiente' | 'escanear'; pendiente: PromocionPendiente }
    | { paso: 'negada'; retirada: PromocionPendiente }
    | null
  >(null);
  /** El flujo de promoción se abre solo una vez; después, con "Finalizar surtido". */
  const promoAbierta = useRef(false);

  // Agrupación por familia (Bandera_AgrupacionFamiliaEnHH): las familias quedan juntas y en orden
  // alfabético, sin rótulo; todas las filas se separan con la misma línea.
  const vista = productosVista(ronda.ronda);
  const productos = CONFIG_MULTIORDEN_DEFAULT.agruparPorFamilia ? ordenarPorFamilia(vista) : vista;
  const c = conteosRonda(ronda.ronda);
  const idxActual = pedidoActualIdx(ronda.ronda);
  /**
   * Pedido que se marca como "en surtido": el que recibió el último escaneo mientras siga abierto;
   * si ya se completó (o aún no se escanea nada), el siguiente pendiente.
   */
  const idxUltimo = ultimoEscaneo ? ronda.ronda.pedidos.findIndex((p) => p.id === ultimoEscaneo.pedidoId) : -1;
  const idxMarcado = idxUltimo >= 0 && !pedidoCompleto(ronda.ronda.pedidos[idxUltimo]) ? idxUltimo : idxActual;

  // El último producto escaneado se lleva a la vista para que el surtidor lo vea marcado.
  useEffect(() => {
    if (!ultimoEscaneo) return;
    document.querySelector(`[data-codigo="${ultimoEscaneo.codigo}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [ultimoEscaneo]);

  const completa = rondaCompleta(ronda.ronda);
  const totalPedidos = ronda.ronda.pedidos.length;

  /** Cierre de la ronda: con una promoción incompleta, abre su flujo en vez de cerrar. */
  const finalizar = () => {
    const pendientes = promocionesPendientes(ronda.ronda);
    if (pendientes.length === 0) return navigate('/ronda-terminada');
    setPromo({ paso: 'pendiente', pendiente: pendientes[0] });
  };

  // Cierre de pedido (FR-019) y de ronda (FR-020).
  useEffect(() => {
    // Mientras corre el flujo de promoción, negarla cambia la ronda: el cierre espera al paso 3.
    if (promo) return;
    if (rondaCompleta(ronda.ronda)) {
      if (promocionesPendientes(ronda.ronda).length === 0) return navigate('/ronda-terminada');
      if (!promoAbierta.current) {
        promoAbierta.current = true;
        finalizar();
      }
      return;
    }
    const cerrado = ronda.ronda.pedidos.find((p) => pedidoCompleto(p) && !avisados.current.has(p.id));
    if (cerrado) {
      avisados.current.add(cerrado.id);
      setTransicion(cerrado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ronda, navigate, promo]);

  const cerrarOverlay = () => {
    setCapturando(null);
    setTransicion(null);
    setCambio(null);
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
    // El pedido que recibe las piezas es el destino antes de aplicar el surtido (FR-010).
    const destino = proximaPartidaPara(ronda.ronda, codigo);
    if (destino) setUltimoEscaneo({ codigo, pedidoId: ronda.ronda.pedidos[destino.pedidoIdx].id });
    const accion = { type: 'surtirPorCodigo', codigo, cantidad } as const;
    const c = cambioDePedido(ronda.ronda, rondaReducer(ronda, accion).ronda, codigo);
    dispatch(accion);
    // Pedido cerrado: lo avisa PedidoCompletadoModal, que ya nombra el siguiente pedido.
    if (c && !pedidoCompleto(c.desde)) setCambio({ codigo, desde: c.desde.id, hacia: c.hacia.id, ordenHacia: c.ordenHacia });
  };

  /* ---- Promoción incompleta: paso 2, escanear un código de la promoción ---- */
  const onScanPromocion = (valor: string) => {
    if (promo?.paso !== 'escanear') return;
    const l = leerCodigo(valor);
    const codigos = promo.pendiente.pedidos.flatMap((p) => p.partidas.map((x) => x.codigo));
    if (l.tipo === 'invalido' || !codigos.includes(l.codigo)) {
      sonar('error');
      mostrarToast({ kind: 'error', title: 'Código inválido', message: 'El código escaneado no pertenece a los códigos con promoción.' });
      return setPromo({ paso: 'pendiente', pendiente: promo.pendiente });
    }
    sonar('ok');
    dispatch({ type: 'negarPromocion', promocionId: promo.pendiente.promocion.id });
    setPromo({ paso: 'negada', retirada: promo.pendiente });
  };

  /** Paso 3 aceptado: sigue la siguiente promoción pendiente o se cierra la ronda. */
  const aceptarPromocionNegada = () => {
    setPromo(null);
    finalizar();
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

  const hayOverlay = capturando !== null || transicion !== null || cambio !== null || promo !== null;

  return (
    <div className={styles.screen}>
      <AppHeader backLabel="Menú" onBack={() => navigate('/tareas')} />

      <ContentPanel title="Surtido de órdenes" bottom={124} scroll>
        <OrderProgress
          titulo="Avance de la ronda"
          etiquetas={false}
          completado={c.completado}
          negado={c.negado}
          parcial={c.parcial}
          pendientes={c.pendientes}
        />

        {/* Avance individual por pedido; el resaltado es el pedido que recibe el próximo escaneo. */}
        <ContenedoresResumen pedidos={ronda.ronda.pedidos} actualIdx={idxMarcado} />

        <div className={styles.list}>
          {productos.map((v, idx) => (
            <div key={v.codigo} className={styles.itemContainer}>
              {idx > 0 && <Divider variant="list" />}
              <ProductoRondaRow
                producto={v}
                marcado={ultimoEscaneo?.codigo === v.codigo}
                onClick={() => navigate(`/detalle/${v.codigo}`)}
              />
            </div>
          ))}
        </div>
      </ContentPanel>

      <BottomBar>
        {completa ? (
          // Ya no hay nada que escanear: solo queda una promoción incompleta por resolver.
          <Button variant="default" label="Finalizar surtido" className={styles.full} onClick={finalizar} />
        ) : (
          <ScanInput ref={scanRef} onScan={onScan} autoFocus={!hayOverlay} />
        )}
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

      {cambio && (
        <CambioPedidoModal {...cambio} onEntendido={cerrarOverlay} />
      )}

      {promo?.paso === 'pendiente' && (
        <PromocionPendienteModal
          pendiente={promo.pendiente}
          totalPedidos={totalPedidos}
          onCerrar={() => setPromo(null)}
          onEliminar={() => setPromo({ paso: 'escanear', pendiente: promo.pendiente })}
        />
      )}

      {promo?.paso === 'escanear' && (
        <EscanearPromocionModal
          pendiente={promo.pendiente}
          totalPedidos={totalPedidos}
          onCancelar={() => setPromo({ paso: 'pendiente', pendiente: promo.pendiente })}
          onScan={onScanPromocion}
        />
      )}

      {promo?.paso === 'negada' && (
        <PromocionNegadaModal retirada={promo.retirada} totalPedidos={totalPedidos} onAceptar={aceptarPromocionNegada} />
      )}

      {transicion && (
        <PedidoCompletadoModal
          pedidoCompletado={transicion.id}
          siguientePedido={siguientePedido?.id ?? null}
          siguienteCliente={siguientePedido?.cliente.nombre ?? null}
          ordenCompletado={ronda.ronda.pedidos.indexOf(transicion)}
          ordenSiguiente={siguientePedido ? ronda.ronda.pedidos.indexOf(siguientePedido) : null}
          onContinuar={cerrarOverlay}
        />
      )}
    </div>
  );
}
