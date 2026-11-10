/**
 * Detalle de producto del surtido multi-orden.
 * Base: "Detalle de producto" (Figma 3199:6362), ya implementado en `Solicitud anticipada Uber`.
 *
 * Añadidos propios del multi-orden, sin respaldo en Figma (FIGMA_REPLICA.md):
 * - Desglose por pedido (FR-013): una fila por cada pedido donde vive el código,
 *   con su progreso individual y el motivo cuando está negado.
 * - El pedido en surtido es el de menor orden que todavía necesita el código (FR-015/FR-016), señalado con
 *   "Surtiendo".
 *
 * Cantidad (clarify del 2026-11-09, fila 28, sustituye a la 18): como el V2 hoy (`ProductDetail`). El detalle no
 * tiene lector: se surte desde el listado. La fila del pedido en surtido lleva "Cantidad surtida" (− / + y
 * captura a mano), inhabilitada si ese pedido no tiene piezas del código; con piezas se ajusta hasta lo
 * solicitado y se valida al regresar (cero, mayor a la solicitada, mayor a la existencia). Igual para todos los
 * productos; sin marca "Misceláneo" (fila 7). Negado: "Negar producto" inhabilitado y se muestra el motivo.
 *
 * Corrección en escalera (SDD 2026-10-26-multiorden-surtido-listado · Corregir la cantidad surtida de un pedido,
 * filas 9-18): la cantidad solo baja corrigiendo. "Corregir {letra}" apunta al último pedido con piezas del
 * código (el en curso o, si está en 0, el anterior) y pide confirmación con `ConfirmarCorreccionModal`; al
 * aceptar, ese pedido queda en 0 y el botón pasa al anterior.
 *
 * Negar (SDD 2026-10-26-multiorden-surtido-listado · Negar producto desde el detalle): niega el pedido en
 * proceso y todos los posteriores, retirando lo surtido; el modal lista los pedidos afectados.
 *
 * Indicadores del desglose (SDD 2026-10-26-multiorden-surtido-listado · Desglose por pedido en el detalle): el pedido
 * que se está surtiendo va resaltado en azul con "Surtiendo" (era rojo hasta el 2026-11-02); los demás van en
 * gris, como inhabilitados. El chip conserva el color de su estatus (completo en verde).
 * Cuando el surtido pasa el código a otro pedido se avisa con `CambioPedidoModal`.
 *
 * Si la cantidad que se guarda completa el pedido y el código sigue en otro, las siguientes piezas van a ese
 * otro pedido: se avisa con "Pedido surtido" antes de regresar.
 *
 * El aviso de pedido completado y el cierre de la ronda no se resuelven aquí: los
 * detecta `SurtidoRonda` al volver a la lista, mirando el estado del store.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@ds/components/organisms/AppHeader/AppHeader';
import { ContentPanel } from '@ds/components/organisms/ContentPanel/ContentPanel';
import { BottomBar } from '@ds/components/organisms/BottomBar/BottomBar';
import { Button } from '@ds/components/atoms/Button/Button';
import { Chip } from '@ds/components/atoms/Chip/Chip';
import { Divider } from '@ds/components/atoms/Divider/Divider';
import { LabeledField } from '@ds/components/molecules/LabeledField/LabeledField';
import { ProductSummary } from '@ds/components/molecules/ProductSummary/ProductSummary';
import { sonar } from '../../domain/sonidos';
import {
  AVISOS,
  cambioDePedido,
  esMultiorden,
  evaluarCantidadDetalle,
  partidaACorregir,
  partidaEn,
  partidasANegar,
  piezasEn,
  productoVista,
  proximaPartidaPara,
  rondaReducer,
  statusDeEstado,
  type RechazoSurtido,
} from '../../domain/ronda';
import { useStore } from '../../store/AppStore';
import { CambioPedidoModal, ConfirmarCorreccionModal, NegarProductoModal } from './overlays/SurtidoModals';
import { AvisoModal, ConNegritas, TextoAviso } from './overlays/Avisos';
import { ContenedorLetra } from './Contenedores';
import { CantidadSurtida } from './CantidadSurtida';
import styles from './DetalleProducto.module.css';


export function DetalleProducto() {
  const { codigo = '' } = useParams();
  const navigate = useNavigate();
  const { ronda, dispatch, mostrarToast, setUltimoEscaneo, simulacion } = useStore();
  const [negando, setNegando] = useState(false);
  /** "Pedido surtido" al guardar una cantidad que pasa el código a otro pedido; con "Entendido" se regresa. */
  const [cambio, setCambio] = useState<{ desde: string; contenedor: string; cantidad: number } | null>(null);
  /** Negación bloqueada por una restricción de hoy (pedido único con piezas, corporativo con orden de compra). */
  const [negacionBloqueada, setNegacionBloqueada] = useState<'con-piezas' | 'corporativo' | null>(null);
  /** "Corrección de surtido" abierta, esperando "Aceptar" o "Rechazar". */
  const [confirmandoCorreccion, setConfirmandoCorreccion] = useState(false);

  const vista = productoVista(ronda.ronda, codigo);
  const destino = proximaPartidaPara(ronda.ronda, codigo);
  const aNegar = partidasANegar(ronda.ronda, codigo);
  // Pedido que corrige el botón: el en curso si tiene piezas; si está en 0, el anterior con piezas.
  const aCorregir = partidaACorregir(ronda.ronda, codigo);

  // Ruta con un código que no vive en la ronda: se vuelve a la lista en vez de romper.
  if (!vista) {
    navigate('/surtido', { replace: true });
    return null;
  }

  const partidaDestino = destino ? partidaEn(ronda.ronda, destino) : null;
  const pedidoDestino = destino ? ronda.ronda.pedidos[destino.pedidoIdx] : null;
  const surtidoGuardado = partidaDestino?.surtido ?? 0;

  /**
   * "Cantidad surtida" del pedido en surtido. Vive en la pantalla y se guarda al regresar, como el V2. Si cambia
   * lo guardado (corregir) o el pedido en surtido, vuelve a lo guardado.
   */
  const [cantidad, setCantidad] = useState(surtidoGuardado);
  useEffect(() => setCantidad(surtidoGuardado), [pedidoDestino?.id, surtidoGuardado]);

  const irAlListado = () => navigate('/surtido');

  const rechazar = (rechazo: RechazoSurtido) => {
    sonar('error');
    mostrarToast({ kind: 'error', ...AVISOS[rechazo] });
  };

  /** "Aceptar" de "Corrección de surtido": el pedido queda en 0 y se regresa al detalle. */
  const corregir = () => {
    setConfirmandoCorreccion(false);
    if (!aCorregir) return;
    dispatch({ type: 'corregir', codigo });
    // El pedido corregido es a donde va el próximo escaneo del código: la lista lo marca.
    setUltimoEscaneo({ codigo, pedidoId: aCorregir.pedidoId });
  };

  /**
   * "Regresar" (o la flecha): sin cambios, solo vuelve. Con una cantidad distinta, la valida como el V2 y, si es
   * válida, la guarda en el pedido en surtido; si no, avisa y se queda. Si con ella el pedido completa el código y
   * otro pedido todavía lo necesita, avisa "Pedido surtido" antes de regresar.
   */
  const volver = () => {
    if (!partidaDestino || !pedidoDestino || cantidad === surtidoGuardado) return irAlListado();
    const rechazo = evaluarCantidadDetalle(partidaDestino, cantidad);
    if (rechazo) return rechazar(rechazo);
    const accion = { type: 'fijarCantidad', codigo, pedidoId: pedidoDestino.id, cantidad } as const;
    const c = cambioDePedido(ronda.ronda, rondaReducer(ronda, accion).ronda, codigo);
    dispatch(accion);
    sonar('ok');
    setUltimoEscaneo({ codigo, pedidoId: pedidoDestino.id });
    if (c) return setCambio({ desde: c.desde.id, contenedor: c.letraDesde, cantidad: piezasEn(c.desde, codigo) });
    irAlListado();
  };

  /**
   * "Negar producto". Con un solo pedido se conservan las restricciones de hoy (cantidad surtida en 0 y
   * corporativo con orden de compra). En la ronda multi-orden ya no se exige el 0 (la cascada retira lo
   * surtido), pero un corporativo con orden de compra entre los afectados bloquea la negación de todos.
   * SDD 2026-10-26-multiorden-surtido-listado · Restricciones para negar.
   */
  const pedirNegacion = () => {
    const pedidos = ronda.ronda.pedidos;
    if (aNegar.some((a) => pedidos[a.pedidoIdx]?.corporativoOC)) return setNegacionBloqueada('corporativo');
    if (!esMultiorden(ronda.ronda) && aNegar.some((a) => a.surtido > 0)) return setNegacionBloqueada('con-piezas');
    setNegando(true);
  };

  const negar = (motivo: string) => {
    setNegando(false);
    if (simulacion.fallaNegar) {
      sonar('error');
      return mostrarToast({ kind: 'error', title: 'Error', message: 'Ocurrió un error al negar el producto, por favor intenta de nuevo.' });
    }
    dispatch({ type: 'negar', codigo, motivo });
    const pedidos = aNegar.map((a) => a.pedidoId).join(', ');
    mostrarToast({ kind: 'error', title: 'Producto negado', message: `${codigo} negado en ${pedidos} por: ${motivo}` });
    irAlListado();
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
              La fila del pedido que se está surtiendo lleva "Cantidad surtida" como el V2 (clarify 28); las demás
              quedan en gris. */}
          <section className={styles.desglose} aria-labelledby="surtido-por-pedido">
            <div className={styles.desgloseHead}>
              <h3 id="surtido-por-pedido" className={styles.desgloseTitulo}>
                Surtido por pedido
              </h3>
              {/* La letra dice qué contenedor vuelve a 0; sin piezas surtidas no hay nada que corregir. */}
              <button type="button" className={styles.corregir} disabled={!aCorregir} onClick={() => setConfirmandoCorreccion(true)}>
                {aCorregir ? `Corregir ${aCorregir.contenedor}` : 'Corregir'}
              </button>
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
                        <ContenedorLetra letra={p.contenedor} variante={p.estado === 'completo' ? 'completo' : 'normal'} />
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
                          <CantidadSurtida
                            valor={cantidad}
                            maximo={partidaDestino.solicitado}
                            habilitada={surtidoGuardado > 0}
                            onCambiar={setCantidad}
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
        </div>
      </ContentPanel>

      {/* Botones de "Negar producto" (3199:6476), como el V2: el detalle no tiene lector (clarify 28). */}
      <BottomBar variant="footer">
        <Button variant="default" label="Regresar" className={styles.flex1} onClick={volver} />
        <Button
          variant="default"
          label="Negar producto"
          className={styles.flex1}
          disabled={aNegar.length === 0}
          onClick={pedirNegacion}
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
          descripcion={vista.descripcion}
          {...cambio}
          onEntendido={() => {
            setCambio(null);
            irAlListado();
          }}
        />
      )}

      {negacionBloqueada === 'con-piezas' && (
        <AvisoModal titulo="No es posible negar el producto" tipo="error" botones={[{ label: 'Aceptar', onClick: () => setNegacionBloqueada(null) }]}>
          <TextoAviso>
            <ConNegritas texto="Para poder negar un producto la **cantidad surtida debe ser cero.**" />
          </TextoAviso>
        </AvisoModal>
      )}

      {negacionBloqueada === 'corporativo' && (
        <AvisoModal titulo="Pedido corporativo" tipo="error" botones={[{ label: 'Aceptar', onClick: () => setNegacionBloqueada(null) }]}>
          <TextoAviso>
            <ConNegritas texto="Este pedido no permite negar productos. Para continuar, **finaliza el surtido de forma manual y saca el pedido de la ronda.**" />
          </TextoAviso>
        </AvisoModal>
      )}

      {confirmandoCorreccion && aCorregir && (
        <ConfirmarCorreccionModal
          codigo={codigo}
          pedidoId={aCorregir.pedidoId}
          contenedor={aCorregir.contenedor}
          onRechazar={() => setConfirmandoCorreccion(false)}
          onAceptar={corregir}
        />
      )}

    </div>
  );
}
