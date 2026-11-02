/**
 * Modales del surtido multi-orden.
 *
 * `CantidadModal` replica "Ingresa la cantidad surtida en contenedor" (Figma 3236:16208),
 * ya implementado en el proyecto hermano `Solicitud anticipada Uber`.
 *
 * `NegarProductoModal` parte del bottom sheet "Selección de motivo negado" de
 * Revision-HH-v2 (FR-017/FR-018): datos del producto y desplegable con los 4 motivos del
 * catálogo; Aceptar permanece inhabilitado hasta elegir uno. Propio del multi-orden
 * (SDD multiorden-surtido-listado · Negar producto desde el detalle): el aviso y la lista
 * de pedidos afectados, para que quede claro que también se niegan los pedidos que
 * todavía no se surten y que se retira lo ya surtido.
 *
 * `PedidoCompletadoModal` es nuevo: el aviso de transición entre pedidos (FR-019) no
 * existe en Figma ni en Revision-HH-v2 porque ambos son de un solo pedido. Se compone
 * con ModalSheet y tokens existentes.
 */
import { useState } from 'react';
import iconoCantidad from '@assets/icons/modal-icono-cantidad.svg';
import iconoNegado from '@assets/icons/modal-icono-negado.svg';
import iconoPregunta from '@assets/icons/modal-icono-pregunta.svg';
import botonCancelar from '@assets/icons/boton-cancelar.svg';
import { ModalHeader, ModalIcon, ModalSheet } from '@ds/components/organisms/ModalSheet/ModalSheet';
import { Button } from '@ds/components/atoms/Button/Button';
import { FloatingLabelInput } from '@ds/components/molecules/FloatingLabelInput/FloatingLabelInput';
import { MOTIVOS_NEGACION } from '../../../domain/ronda';
import { letraPedido } from '../Contenedores';
import styles from './overlays.module.css';

/* ---------- Ingresa la cantidad surtida en contenedor — 3236:16208 ---------- */
export function CantidadModal({
  codigo,
  sugerida,
  onCancel,
  onConfirm,
}: {
  codigo: string;
  sugerida: number;
  onCancel: () => void;
  onConfirm: (n: number) => void;
}) {
  const [valor, setValor] = useState(String(sugerida));
  const confirmar = () => onConfirm(parseInt(valor, 10) || 0);
  return (
    <ModalSheet icon={<ModalIcon src={iconoCantidad} inset="-2.84% -3.98% -0.56% -2.84%" offsetX={-1} />} gap={10}>
      <div className={styles.col} style={{ gap: 16 }}>
        <ModalHeader title="Ingresa la cantidad surtida en contenedor">
          <div className={styles.codeRow}>
            <b>Código</b>
            <span>{codigo}</span>
          </div>
        </ModalHeader>
        <input
          className={styles.qtyInput}
          value={valor}
          inputMode="numeric"
          autoFocus
          aria-label="Cantidad"
          onChange={(e) => setValor(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && confirmar()}
        />
        <div className={styles.buttons}>
          <Button asset={botonCancelar} label="Cancelar" className={styles.half} onClick={onCancel} />
          <Button variant="success" icon="check" label="Aceptar" className={styles.half} onClick={confirmar} />
        </div>
      </div>
    </ModalSheet>
  );
}

/* ---------- Selección de motivo negado — Revision-HH-v2 `bs-negacion` ---------- */
export function NegarProductoModal({
  codigo,
  descripcion,
  afectadas,
  onCancel,
  onConfirm,
}: {
  codigo: string;
  descripcion: string;
  /** Pedido en proceso primero y luego los posteriores, en el orden de la ronda. */
  afectadas: { pedidoId: string; pedidoIdx: number; surtido: number; solicitado: number }[];
  onCancel: () => void;
  onConfirm: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const piezas = afectadas.reduce((n, a) => n + a.solicitado, 0);
  const retiradas = afectadas.reduce((n, a) => n + a.surtido, 0);
  const posteriores = afectadas.length - 1;

  return (
    <ModalSheet icon={<ModalIcon src={iconoNegado} inset="-2.84% -2.27% -0.56% -1.14%" />} gap={10} doubleShadow>
      <div className={styles.col} style={{ gap: 18 }}>
        <ModalHeader title="Selección de motivo negado" gap={18} />

        <div className={styles.datos}>
          <div className={styles.datoFila}>
            <b>Código</b>
            <span className={styles.datoValor}>{codigo}</span>
          </div>
          <div className={styles.datoFila}>
            <b>Descripción</b>
            <span className={styles.datoValor} title={descripcion}>
              {descripcion}
            </span>
          </div>
          <div className={styles.datoFila}>
            <b>Piezas a negar</b>
            <span className={styles.datoValorNum}>{piezas}</span>
          </div>
        </div>

        <div className={styles.avisoNegacion} role="note">
          <p>
            El producto se negará en el pedido <b>{afectadas[0].pedidoId}</b>
            {posteriores > 0 && (
              <>
                {' '}
                y en {posteriores === 1 ? 'el pedido siguiente' : `los ${posteriores} pedidos siguientes`} que lo
                piden, <b>aunque todavía no se hayan surtido</b>
              </>
            )}
            .
          </p>
          {retiradas > 0 && (
            <p>
              Las <b>{retiradas}</b> {retiradas === 1 ? 'pieza ya surtida se retira' : 'piezas ya surtidas se retiran'}.
            </p>
          )}
          <ul className={styles.afectadas}>
            {afectadas.map((a) => (
              <li key={a.pedidoId} className={styles.afectada}>
                <span>
                  {letraPedido(a.pedidoIdx)} · Pedido {a.pedidoId}
                </span>
                <span>{a.surtido > 0 ? `${a.surtido} de ${a.solicitado} surtidas` : `${a.solicitado} sin surtir`}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.dropdown}>
          {abierto && (
            <div className={styles.dropdownLista} role="listbox" aria-label="Motivos de negación">
              {MOTIVOS_NEGACION.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="option"
                  aria-selected={motivo === m}
                  className={`${styles.dropdownOpcion} ${motivo === m ? styles.dropdownOpcionActiva : ''}`}
                  onClick={() => {
                    setMotivo(m);
                    setAbierto(false);
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          <FloatingLabelInput
            label="Motivo"
            placeholder="Seleccionar una opción"
            value={motivo ?? ''}
            isSelect
            labelFont="select"
            onClick={() => setAbierto((a) => !a)}
          />
        </div>

        <div className={styles.buttons}>
          <Button asset={botonCancelar} label="Cancelar" className={styles.half} onClick={onCancel} />
          <Button
            variant="success"
            icon="check"
            label="Aceptar"
            className={styles.half}
            disabled={motivo === null}
            onClick={() => motivo && onConfirm(motivo)}
          />
        </div>
      </div>
    </ModalSheet>
  );
}

/* ---------- Cambio de pedido de un código ----------
   SDD multiorden-surtido-listado · Avisos de cambio de pedido. Sin nodo en Figma: lo pidieron en la
   sesión del 2026-10-21 ("recuerda que esto va al siguiente contenedor"). El pedido destino va en
   rojo, el mismo indicador que lo marca en el desglose del detalle. */
export function CambioPedidoModal({
  codigo,
  desde,
  hacia,
  ordenHacia,
  onEntendido,
}: {
  codigo: string;
  desde: string;
  hacia: string;
  /** Índice del pedido destino en la ronda (0-based); da la letra del contenedor. */
  ordenHacia: number;
  onEntendido: () => void;
}) {
  return (
    <ModalSheet icon={<ModalIcon src={iconoPregunta} inset="-2.84% -2.27% -0.56% -1.14%" />} gap={10} doubleShadow>
      <div className={styles.col} style={{ gap: 18 }}>
        <ModalHeader title="Cambio de pedido" gap={18} />
        <p className={styles.text}>
          El código <b>{codigo}</b> ya está completo en el pedido <b>{desde}</b>.
        </p>
        <div className={styles.cambio}>
          <span className={styles.transicionEtiqueta}>Las siguientes piezas van al contenedor del</span>
          <span className={styles.cambioPedido}>Pedido {hacia}</span>
          <span className={styles.cambioOrden}>Contenedor {letraPedido(ordenHacia)}</span>
        </div>
        <p className={styles.text}>No mezcles la mercancía con la del pedido anterior.</p>
        <Button variant="success" label="Entendido" className={styles.full} onClick={onEntendido} />
      </div>
    </ModalSheet>
  );
}

/* ---------- Pedido completado, continuar con el siguiente (FR-019) ---------- */
export function PedidoCompletadoModal({
  pedidoCompletado,
  siguientePedido,
  siguienteCliente,
  ordenCompletado,
  ordenSiguiente,
  onContinuar,
}: {
  pedidoCompletado: string;
  /** Índices en la ronda (0-based) para la letra del contenedor. */
  ordenCompletado: number;
  ordenSiguiente: number | null;
  /** null cuando era el último pedido pendiente de la ronda. */
  siguientePedido: string | null;
  siguienteCliente: string | null;
  onContinuar: () => void;
}) {
  return (
    <ModalSheet icon={<ModalIcon src={iconoPregunta} inset="-2.84% -2.27% -0.56% -1.14%" />} gap={10} doubleShadow>
      <div className={styles.col} style={{ gap: 18 }}>
        <ModalHeader title="Pedido completado" gap={18} />

        <p className={styles.text}>
          Terminaste el pedido <b>{pedidoCompletado}</b> (contenedor {letraPedido(ordenCompletado)}).
        </p>

        {siguientePedido ? (
          <div className={styles.transicion}>
            <span className={styles.transicionEtiqueta}>Continúa con</span>
            <span className={styles.transicionPedido}>
              {ordenSiguiente !== null && `${letraPedido(ordenSiguiente)} · `}Pedido {siguientePedido}
            </span>
            {siguienteCliente && <span className={styles.transicionCliente}>{siguienteCliente}</span>}
          </div>
        ) : (
          <p className={styles.text}>No quedan pedidos pendientes en la ronda.</p>
        )}

        {/* Botón con texto en vez del ✓ de los modales de Figma: el aviso informa a qué pedido se pasa. */}
        <Button variant="success" label="Continuar" className={styles.full} onClick={onContinuar} />
      </div>
    </ModalSheet>
  );
}
