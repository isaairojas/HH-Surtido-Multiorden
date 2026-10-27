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
  evaluarCantidadAbsoluta,
  evaluarSurtido,
  partidaEn,
  partidasANegar,
  productoVista,
  proximaPartidaPara,
  statusDeEstado,
} from '../../domain/ronda';
import { useStore } from '../../store/AppStore';
import { CantidadModal, NegarProductoModal } from './overlays/SurtidoModals';
import styles from './DetalleProducto.module.css';

const TOAST_CODIGO_DISTINTO = {
  kind: 'error' as const,
  title: 'Código inválido',
  message: 'El código escaneado no corresponde al producto que estás viendo.',
};

export function DetalleProducto() {
  const { codigo = '' } = useParams();
  const navigate = useNavigate();
  const { ronda, dispatch, mostrarToast } = useStore();
  const [negando, setNegando] = useState(false);
  const [capturando, setCapturando] = useState(false);

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

  const rechazar = (rechazo: keyof typeof AVISOS) => {
    sonar('error');
    mostrarToast({ kind: 'error', ...AVISOS[rechazo] });
  };

  /** Stepper: fija la cantidad absoluta de la partida destino, como el detalle de Revision-HH-v2. */
  const cambiarCantidad = (n: number) => {
    if (!partidaDestino || !pedidoDestino) return;
    const rechazo = evaluarCantidadAbsoluta(partidaDestino, n);
    if (rechazo) return rechazar(rechazo);
    dispatch({ type: 'fijarSurtido', pedidoId: pedidoDestino.id, codigo, cantidad: n });
  };

  /** Suma una cantidad al pedido destino con las validaciones de Revision-HH-v2. */
  const surtir = (cantidad: number) => {
    const ev = evaluarSurtido(ronda.ronda, codigo, cantidad);
    if (!ev.ok) return rechazar(ev.rechazo);
    sonar('ok');
    dispatch({ type: 'surtirPorCodigo', codigo, cantidad });
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
  const bloqueado = partidaDestino === null;
  /**
   * Sin partida pendiente el detalle es de solo consulta (edge case de la spec): el stepper
   * enseña lo que se surtió en la ronda y queda inerte, en vez de mostrar un 0 engañoso.
   */
  const cantidadStepper = partidaDestino ? partidaDestino.surtido : vista.surtidoTotal;

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
                <LabeledField label="Solicitado" value={vista.solicitadoTotal} />
              </div>
            </div>
          </div>

          {/* Desglose por pedido — FR-013 */}
          <div className={styles.desglose}>
            <div className={styles.desgloseHead}>
              <p className={styles.desgloseTitulo}>Desglose por pedido ({vista.presencias.length})</p>
              {vista.miscelaneo && <span className={styles.varianteChip}>Misceláneo</span>}
            </div>
            <Divider variant="modal" />
            <ul className={styles.presencias}>
              {vista.presencias.map((p) => {
                const esDestino = pedidoDestino?.id === p.pedidoId;
                return (
                  <li key={p.pedidoId} className={`${styles.presencia} ${esDestino ? styles.presenciaActiva : ''}`}>
                    <div className={styles.presenciaInfo}>
                      <div className={styles.presenciaHead}>
                        <span className={styles.presenciaPedido}>Pedido {p.pedidoId}</span>
                        <span className={styles.presenciaOrden}>
                          {p.ordenPedido + 1}/{ronda.ronda.pedidos.length}
                        </span>
                        {esDestino && <span className={styles.presenciaBadge}>Surtiendo</span>}
                      </div>
                      <p className={styles.presenciaCliente} title={p.cliente.nombre}>
                        {p.cliente.nombre}
                      </p>
                      {p.motivoNegacion && <p className={styles.presenciaMotivo}>Negado: {p.motivoNegacion}</p>}
                    </div>
                    <Chip status={statusDeEstado(p.estado)} value={p.surtido} total={p.solicitado} />
                  </li>
                );
              })}
            </ul>
          </div>

          <div className={styles.cantidad}>
            <div className={styles.cantidadTexto}>
              <p className={styles.cantidadLabel}>Cantidad surtida:</p>
              {pedidoDestino && <span className={styles.cantidadPedido}>Pedido {pedidoDestino.id}</span>}
            </div>
            <Stepper
              value={cantidadStepper}
              min={bloqueado ? cantidadStepper : 0}
              max={partidaDestino ? Math.min(partidaDestino.solicitado, partidaDestino.existencia) : cantidadStepper}
              onChange={cambiarCantidad}
            />
          </div>

          {bloqueado && <p className={styles.consulta}>Este producto ya no tiene partidas pendientes en la ronda.</p>}

          {/* Misceláneo: sin campo de lector (FR-016) */}
          {!vista.miscelaneo && !bloqueado && (
            <div className={styles.lector}>
              <ScanInput onScan={onScan} autoFocus={!negando && !capturando} />
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
