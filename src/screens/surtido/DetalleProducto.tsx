/**
 * Detalle de producto del surtido multi-orden.
 * Base: "Detalle de producto" (Figma 3199:6362), ya implementado en `Solicitud anticipada Uber`.
 *
 * Añadidos propios del multi-orden, sin respaldo en Figma (FIGMA_REPLICA.md):
 * - Desglose por pedido (FR-013): una fila por cada pedido donde vive el código,
 *   con su progreso individual y el motivo cuando está negado.
 * - El stepper y el lector actúan sobre la partida destino: el pedido con menor
 *   orden que todavía necesita el código (FR-015/FR-016), señalado en la etiqueta.
 *
 * Variantes (FR-014), replicando Revision-HH-v2:
 * - escaneable: lector + captura manual con el stepper.
 * - misceláneo: sin campo de lector; solo el stepper.
 * - negado: stepper bloqueado y "Negar producto" inhabilitado; se muestra el motivo.
 *
 * Negar (SDD multiorden-surtido-listado · Negar producto desde el detalle): niega el pedido en
 * proceso y todos los posteriores, retirando lo surtido; el modal lista los pedidos afectados.
 *
 * Indicadores del desglose (SDD multiorden-surtido-listado · Desglose por pedido en el detalle,
 * sesión del 2026-10-27): el pedido que se está surtiendo lleva barra y etiqueta rojas; los demás
 * van en gris, como inhabilitados. El chip conserva el color de su estatus (completo en verde).
 * Cuando el surtido pasa el código a otro pedido se avisa con `CambioPedidoModal`.
 *
 * El aviso de pedido completado y el cierre de la ronda no se resuelven aquí: los
 * detecta `SurtidoRonda` al volver a la lista, mirando el estado del store.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@ds/components/organisms/AppHeader/AppHeader';
import { ContentPanel } from '@ds/components/organisms/ContentPanel/ContentPanel';
import { BottomBar } from '@ds/components/organisms/BottomBar/BottomBar';
import { Button } from '@ds/components/atoms/Button/Button';
import { Chip } from '@ds/components/atoms/Chip/Chip';
import { Stepper } from '@ds/components/atoms/Stepper/Stepper';
import { Divider } from '@ds/components/atoms/Divider/Divider';
import { LabeledField } from '@ds/components/molecules/LabeledField/LabeledField';
import { ProductSummary } from '@ds/components/molecules/ProductSummary/ProductSummary';
import { ScanInput } from '@ds/components/molecules/ScanInput/ScanInput';
import { leerCodigo } from '../../domain/codigos';
import { sonar } from '../../domain/sonidos';
import {
  AVISOS,
  cambioDePedido,
  evaluarCantidadAbsoluta,
  evaluarSurtido,
  partidaEn,
  partidasANegar,
  productoVista,
  proximaPartidaPara,
  rondaReducer,
  statusDeEstado,
  type RondaAction,
} from '../../domain/ronda';
import { useStore } from '../../store/AppStore';
import { CambioPedidoModal, CantidadModal, NegarProductoModal } from './overlays/SurtidoModals';
import { ContenedorLetra } from './Contenedores';
import styles from './DetalleProducto.module.css';

const TOAST_CODIGO_DISTINTO = {
  kind: 'error' as const,
  title: 'Código inválido',
  message: 'El código escaneado no corresponde al producto que estás viendo.',
};

export function DetalleProducto() {
  const { codigo = '' } = useParams();
  const navigate = useNavigate();
  const { ronda, dispatch, mostrarToast, setUltimoEscaneo } = useStore();
  const [negando, setNegando] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [cambio, setCambio] = useState<{ desde: string; hacia: string; ordenHacia: number } | null>(null);

  const vista = productoVista(ronda.ronda, codigo);
  const destino = proximaPartidaPara(ronda.ronda, codigo);
  const aNegar = partidasANegar(ronda.ronda, codigo);

  // Ruta con un código que no vive en la ronda: se vuelve a la lista en vez de romper.
  if (!vista) {
    navigate('/surtido', { replace: true });
    return null;
  }

  const partidaDestino = destino ? partidaEn(ronda.ronda, destino) : null;
  const pedidoDestino = destino ? ronda.ronda.pedidos[destino.pedidoIdx] : null;

  const volver = () => navigate('/surtido');

  /**
   * Despacha y avisa si las siguientes piezas del código ya van a otro pedido. Aquí se avisa
   * aunque el pedido se haya cerrado: el aviso de pedido completado sale hasta volver a la lista.
   */
  const aplicar = (accion: RondaAction) => {
    const c = cambioDePedido(ronda.ronda, rondaReducer(ronda, accion).ronda, codigo);
    dispatch(accion);
    if (c) setCambio({ desde: c.desde.id, hacia: c.hacia.id, ordenHacia: c.ordenHacia });
  };

  const rechazar = (rechazo: keyof typeof AVISOS) => {
    sonar('error');
    mostrarToast({ kind: 'error', ...AVISOS[rechazo] });
  };

  /** Stepper: fija la cantidad absoluta de la partida destino, como el detalle de Revision-HH-v2. */
  const cambiarCantidad = (n: number) => {
    if (!partidaDestino || !pedidoDestino) return;
    const rechazo = evaluarCantidadAbsoluta(partidaDestino, n);
    if (rechazo) return rechazar(rechazo);
    setUltimoEscaneo({ codigo, pedidoId: pedidoDestino.id });
    aplicar({ type: 'fijarSurtido', pedidoId: pedidoDestino.id, codigo, cantidad: n });
  };

  /** Suma una cantidad al pedido destino con las validaciones de Revision-HH-v2. */
  const surtir = (cantidad: number) => {
    const ev = evaluarSurtido(ronda.ronda, codigo, cantidad);
    if (!ev.ok) return rechazar(ev.rechazo);
    sonar('ok');
    if (pedidoDestino) setUltimoEscaneo({ codigo, pedidoId: pedidoDestino.id });
    aplicar({ type: 'surtirPorCodigo', codigo, cantidad });
  };

  /** Lector dentro del detalle: solo acepta el código que se está viendo (FR-015). */
  const onScan = (valor: string) => {
    const l = leerCodigo(valor);
    if (l.tipo === 'invalido') return sonar('error');
    if (l.codigo !== codigo) {
      sonar('error');
      return mostrarToast(TOAST_CODIGO_DISTINTO);
    }
    // Código corto: la cantidad se captura a mano (Revision-HH-v2 abre el bottom sheet).
    if (l.tipo === 'codigo') return setCapturando(true);
    surtir(l.cantidad);
  };

  const negar = (motivo: string) => {
    dispatch({ type: 'negar', codigo, motivo });
    setNegando(false);
    const pedidos = aNegar.map((a) => a.pedidoId).join(', ');
    mostrarToast({ kind: 'error', title: 'Producto negado', message: `${codigo} negado en ${pedidos} por: ${motivo}` });
    volver();
  };

  const [planta, pasillo, torre, nivel] = vista.ubicacion;
  // Sin partida pendiente el detalle es de solo consulta (edge case de la spec): no hay stepper.
  const bloqueado = partidaDestino === null;

  return (
    <div className={styles.screen}>
      <AppHeader onBack={volver} />
      <ContentPanel title="Detalle del producto" bottom={124} scroll>
        <div className={styles.body}>
          <div className={styles.datos}>
            <ProductSummary foto={vista.imagen} codigo={vista.codigo} descripcion={vista.descripcion} photoStyle="framed" />
            <div className={styles.grid}>
              <div className={styles.pair}>
                <LabeledField label="Ubicación" value={planta} />
                <LabeledField label="Pasillo" value={pasillo} />
              </div>
              <div className={styles.pair}>
                <LabeledField label="Torre" value={torre} />
                <LabeledField label="Nivel" value={nivel} />
              </div>
              <div className={styles.pair}>
                <LabeledField label="Existencia" value={vista.existencia} valueBold />
                <LabeledField
                  label={
                    <>
                      Solicitado
                      <br />
                      ronda
                    </>
                  }
                  value={vista.solicitadoTotal}
                />
              </div>
            </div>
          </div>

          {/* Surtido por pedido — FR-013. Interfaz de 41:2429 (propuesta A): una fila por contenedor.
              Solo la fila del pedido que se está surtiendo lleva stepper; las demás quedan en gris. */}
          <section className={styles.desglose} aria-labelledby="surtido-por-pedido">
            <div className={styles.desgloseHead}>
              <h3 id="surtido-por-pedido" className={styles.desgloseTitulo}>
                Surtido por pedido
              </h3>
              {vista.miscelaneo && <span className={styles.varianteChip}>Misceláneo</span>}
            </div>
            <ul className={styles.presencias}>
              {vista.presencias.map((p, i) => {
                const esDestino = pedidoDestino?.id === p.pedidoId;
                // Sin destino (código resuelto) ninguna fila se apaga: el detalle es de consulta.
                const inactiva = pedidoDestino !== null && !esDestino;
                return (
                  <li key={p.pedidoId} className={styles.presenciaItem}>
                    {i > 0 && <Divider variant="list" />}
                    <div
                      className={[styles.presencia, esDestino ? styles.presenciaActiva : '', inactiva ? styles.presenciaInactiva : ''].join(' ')}
                      aria-current={esDestino ? 'step' : undefined}
                    >
                      <span className={styles.presenciaLetra}>
                        <ContenedorLetra idx={p.ordenPedido} variante={p.estado === 'completo' ? 'completo' : 'normal'} />
                      </span>
                      <div className={styles.presenciaInfo}>
                        <div className={styles.presenciaHead}>
                          <span className={styles.presenciaPedido}>#{p.pedidoId}</span>
                          {esDestino && <span className={styles.presenciaBadge}>Surtiendo</span>}
                        </div>
                        <span className={styles.presenciaSolicitado}>Solicitado {p.solicitado}</span>
                        {p.motivoNegacion && <p className={styles.presenciaMotivo}>{p.motivoNegacion}</p>}
                      </div>
                      <div className={styles.presenciaAccion}>
                        {p.estado === 'negado' ? (
                          <Chip status="negado" />
                        ) : esDestino && partidaDestino ? (
                          <Stepper
                            value={partidaDestino.surtido}
                            min={0}
                            max={Math.min(partidaDestino.solicitado, partidaDestino.existencia)}
                            onChange={cambiarCantidad}
                          />
                        ) : (
                          <Chip status={statusDeEstado(p.estado)} value={p.surtido} total={p.solicitado} />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {bloqueado && <p className={styles.consulta}>Este producto ya no tiene partidas pendientes en la ronda.</p>}

          {/* Misceláneo: sin campo de lector (FR-016) */}
          {!vista.miscelaneo && !bloqueado && (
            <div className={styles.lector}>
              <ScanInput onScan={onScan} autoFocus={!negando && !capturando && !cambio} />
            </div>
          )}
        </div>
      </ContentPanel>

      <BottomBar variant="footer">
        <Button variant="default" label="Regresar" className={styles.flex1} onClick={volver} />
        <Button
          variant="default"
          label="Negar producto"
          className={styles.flex1}
          disabled={aNegar.length === 0}
          onClick={() => setNegando(true)}
        />
      </BottomBar>

      {negando && aNegar.length > 0 && (
        <NegarProductoModal
          codigo={vista.codigo}
          descripcion={vista.descripcion}
          afectadas={aNegar}
          onCancel={() => setNegando(false)}
          onConfirm={negar}
        />
      )}

      {cambio && (
        <CambioPedidoModal
          codigo={codigo}
          {...cambio}
          onEntendido={() => setCambio(null)}
        />
      )}

      {capturando && (
        <CantidadModal
          codigo={vista.codigo}
          sugerida={partidaDestino ? partidaDestino.solicitado - partidaDestino.surtido : 0}
          onCancel={() => setCapturando(false)}
          onConfirm={(n) => {
            setCapturando(false);
            surtir(n);
          }}
        />
      )}
    </div>
  );
}
