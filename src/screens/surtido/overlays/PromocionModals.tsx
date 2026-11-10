/**
 * Modales de promoción incompleta al finalizar la ronda.
 * SDD 2026-10-26-multiorden-surtido-listado · Promoción incompleta al finalizar la ronda.
 *
 * Réplica del flujo del V2 real (`AssortmentTaskV2`, textos de `i18n/es.ts`), que en Figma vive en
 * "Surtido - Un pedido x ronda" › finalización de surtido manual:
 *   1. "Finalizar surtido": la promoción no se surtió completa; ✕ cierra sin retirar nada y
 *      "Eliminar productos" pasa al paso 2.
 *   2. "Escanea un producto de la promoción": confirma escaneando un código de la promoción;
 *      ✕ regresa al paso 1.
 *   3. "Promoción negada": "Retira los siguientes productos del contenedor:" con los códigos de la promoción
 *      tal como estaban antes de negarla (chips "Negado", "2 de 6"…); ✓ continúa el cierre (parciales o
 *      confirmación) sin regresar al listado.
 * Un código que no es de la promoción avisa "Código inválido" y regresa al paso 1. Mismas ventanas que el
 * flujo compartido por el usuario el 2026-11-09 (botones solo con ✕ / ✓).
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
};

/**
 * "Códigos de la promoción" (PromotionProductList del V2): código y chip de avance. En una ronda multi-orden
 * va agrupada por pedido, con la letra de su contenedor; con un solo pedido, la lista de hoy.
 */
function ListaPromocion({ pendiente, totalPedidos }: ListaProps) {
  const filas = (partidas: PromocionPendiente['pedidos'][number]['partidas']) =>
    partidas.map((p) => (
      <div key={p.codigo} className={styles.promoFila}>
        <b>{p.codigo}</b>
        <Chip
          status={p.negado ? 'negado' : p.surtido >= p.solicitado ? 'completado' : p.surtido > 0 ? 'parcial' : 'no-iniciado'}
          value={p.surtido}
          total={p.solicitado}
        />
      </div>
    ));
  if (totalPedidos <= 1) return <div className={styles.promoPedidos}>{pendiente.pedidos.flatMap((ped) => filas(ped.partidas))}</div>;
  return (
    <div className={styles.promoPedidos}>
      {pendiente.pedidos.map((ped) => (
        <div key={ped.pedidoId} className={styles.promoPedido}>
          <p className={styles.promoPedidoHead}>
            <ContenedorLetra letra={ped.contenedor} size={22} />
            <b>Pedido {ped.pedidoId}</b>
          </p>
          {filas(ped.partidas)}
        </div>
      ))}
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
  return (
    <ModalSheet icon={<ModalIcon src={iconoPregunta} inset="-2.84% -2.27% -0.56% -1.14%" />} gap={10} doubleShadow>
      <div className={styles.col} style={{ gap: 18 }}>
        <ModalHeader title="Finalizar surtido" gap={18} />
        <p className={styles.text}>La siguiente promoción no se surtió completamente.</p>
        <p className={styles.text}>
          Para continuar, <b>completa la promoción</b> o <b>elimina los productos del pedido.</b>
        </p>
        <p className={styles.promoTitulo}>Códigos de la promoción</p>
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
  return (
    <ModalSheet icon={<ModalIcon src={iconoNegado} inset="-2.84% -2.27% -0.56% -1.14%" />} gap={10} doubleShadow>
      <div className={styles.col} style={{ gap: 18 }}>
        <ModalHeader title="Promoción negada" gap={18} />
        <p className={styles.text}>
          <b>Retira</b> los siguientes productos del contenedor:
        </p>
        <p className={styles.promoTitulo}>Códigos de la promoción</p>
        <ListaPromocion pendiente={retirada} totalPedidos={totalPedidos} />
        <Button variant="success" icon="check" label="Aceptar" className={styles.full} onClick={onAceptar} />
      </div>
    </ModalSheet>
  );
}
