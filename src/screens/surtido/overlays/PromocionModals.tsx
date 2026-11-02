/**
 * Modales de promoción incompleta al finalizar la ronda.
 * SDD multiorden-surtido-listado · Promoción incompleta al finalizar la ronda.
 *
 * Réplica del flujo del V2 real (`AssortmentTaskV2`, textos de `i18n/es.ts`), que en Figma vive en
 * "Surtido - Un pedido x ronda" › finalización de surtido manual:
 *   1. "Finalizar surtido": la promoción no se surtió completa; ✕ cierra sin retirar nada y
 *      "Eliminar productos" pasa al paso 2.
 *   2. "Escanea un producto de la promoción": confirma escaneando un código de la promoción;
 *      ✕ regresa al paso 1.
 *   3. "Promoción negada": lista lo que hay que sacar del contenedor; ✓ continúa el cierre.
 *
 * Propio del multi-orden: la lista va agrupada por pedido, porque la misma promoción puede
 * quedar incompleta en varios pedidos y la mercancía se retira del contenedor de cada uno.
 */
import iconoNegado from '@assets/icons/modal-icono-negado.svg';
import iconoPregunta from '@assets/icons/modal-icono-pregunta.svg';
import iconoCantidad from '@assets/icons/modal-icono-cantidad.svg';
import { ModalHeader, ModalIcon, ModalSheet } from '@ds/components/organisms/ModalSheet/ModalSheet';
import { Button } from '@ds/components/atoms/Button/Button';
import { Chip } from '@ds/components/atoms/Chip/Chip';
import { ScanInput } from '@ds/components/molecules/ScanInput/ScanInput';
import type { PromocionPendiente } from '../../../domain/ronda';
import { ContenedorLetra } from '../Contenedores';
import styles from './overlays.module.css';

type ListaProps = {
  pendiente: PromocionPendiente;
  totalPedidos: number;
  /** Paso 3: solo cuenta lo que hay que sacar físicamente (lo surtido antes de negar). */
  soloRetirar?: boolean;
};

/** "Códigos de la promoción" agrupados por pedido (PromotionProductList del V2, uno por pedido). */
function ListaPromocion({ pendiente, soloRetirar }: ListaProps) {
  return (
    <div className={styles.promoPedidos}>
      {pendiente.pedidos.map((ped) => {
        const partidas = soloRetirar ? ped.partidas.filter((p) => p.surtido > 0) : ped.partidas;
        return (
          <div key={ped.pedidoId} className={styles.promoPedido}>
            <p className={styles.promoPedidoHead}>
              <ContenedorLetra idx={ped.ordenPedido} size={22} />
              <b>Pedido {ped.pedidoId}</b>
            </p>
            {partidas.length === 0 ? (
              <p className={styles.promoVacio}>Sin piezas que retirar</p>
            ) : (
              partidas.map((p) => (
                <div key={p.codigo} className={styles.promoFila}>
                  <b>{p.codigo}</b>
                  {soloRetirar ? (
                    <span className={styles.promoPiezas}>
                      {p.surtido} {p.surtido === 1 ? 'pieza' : 'piezas'}
                    </span>
                  ) : (
                    <Chip
                      status={p.negado ? 'negado' : p.surtido >= p.solicitado ? 'completado' : p.surtido > 0 ? 'parcial' : 'no-iniciado'}
                      value={p.surtido}
                      total={p.solicitado}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- 1. Finalizar surtido: promoción incompleta ---------- */
export function PromocionPendienteModal({
  pendiente,
  totalPedidos,
  onCerrar,
  onEliminar,
}: {
  pendiente: PromocionPendiente;
  totalPedidos: number;
  onCerrar: () => void;
  onEliminar: () => void;
}) {
  const varios = pendiente.pedidos.length > 1;
  return (
    <ModalSheet icon={<ModalIcon src={iconoPregunta} inset="-2.84% -2.27% -0.56% -1.14%" />} gap={10} doubleShadow>
      <div className={styles.col} style={{ gap: 18 }}>
        <ModalHeader title="Finalizar surtido" gap={18} />
        <p className={styles.text}>
          La siguiente promoción no se surtió completamente
          {varios ? <> en <b>{pendiente.pedidos.length} pedidos</b></> : null}.
        </p>
        <p className={styles.text}>
          Para continuar, <b>completa la promoción</b> o <b>elimina los productos del pedido.</b>
        </p>
        <p className={styles.promoTitulo}>
          Códigos de la promoción <span>· {pendiente.promocion.nombre}</span>
        </p>
        <ListaPromocion pendiente={pendiente} totalPedidos={totalPedidos} />
        <Button variant="outline" label="Eliminar productos" className={styles.full} onClick={onEliminar} />
        <Button variant="error" icon="cross" label="Cerrar" className={styles.full} onClick={onCerrar} />
      </div>
    </ModalSheet>
  );
}

/* ---------- 2. Escanea un producto de la promoción ---------- */
export function EscanearPromocionModal({
  pendiente,
  totalPedidos,
  onCancelar,
  onScan,
}: {
  pendiente: PromocionPendiente;
  totalPedidos: number;
  onCancelar: () => void;
  onScan: (valor: string) => void;
}) {
  return (
    <ModalSheet icon={<ModalIcon src={iconoCantidad} inset="-2.84% -3.98% -0.56% -2.84%" offsetX={-1} />} gap={10} doubleShadow>
      <div className={styles.col} style={{ gap: 18 }}>
        <ModalHeader title="Escanea un producto de la promoción" gap={18} />
        <ListaPromocion pendiente={pendiente} totalPedidos={totalPedidos} />
        <div className={styles.promoLector}>
          <ScanInput onScan={onScan} />
        </div>
        <Button variant="error" icon="cross" label="Cancelar" className={styles.full} onClick={onCancelar} />
      </div>
    </ModalSheet>
  );
}

/* ---------- 3. Promoción negada: retirar del contenedor ---------- */
export function PromocionNegadaModal({
  retirada,
  totalPedidos,
  onAceptar,
}: {
  /** Foto de la promoción antes de negarla: conserva lo que se había surtido. */
  retirada: PromocionPendiente;
  totalPedidos: number;
  onAceptar: () => void;
}) {
  const conPiezas = retirada.pedidos.filter((p) => p.partidas.some((x) => x.surtido > 0)).length;
  return (
    <ModalSheet icon={<ModalIcon src={iconoNegado} inset="-2.84% -2.27% -0.56% -1.14%" />} gap={10} doubleShadow>
      <div className={styles.col} style={{ gap: 18 }}>
        <ModalHeader title="Promoción negada" gap={18} />
        <p className={styles.text}>
          <b>Retira</b> los siguientes productos del contenedor
          {conPiezas > 1 ? <> de <b>cada pedido</b></> : null}:
        </p>
        <ListaPromocion pendiente={retirada} totalPedidos={totalPedidos} soloRetirar />
        <Button variant="success" icon="check" label="Aceptar" className={styles.full} onClick={onAceptar} />
      </div>
    </ModalSheet>
  );
}
