/**
 * "Cantidad surtida" del detalle del producto, como el `SpinnerInput` del V2 (`ProductDetailScreen`): − / + y la
 * cantidad capturable a mano. Usa la misma imagen que el `Stepper` del design-system (3199:6429), que no tiene
 * campo editable; por eso vive aquí y no en el design-system.
 *
 * Reglas del V2 (clarify del 2026-11-09, fila 28): todo inhabilitado si el pedido entra al detalle sin piezas;
 * con piezas, + hasta lo solicitado, − hasta 0 y captura a mano. La validación es al regresar.
 */
import menos from '@assets/icons/stepper-menos.svg';
import mas from '@assets/icons/stepper-mas.svg';
import stepper from '@ds/components/atoms/Stepper/Stepper.module.css';
import styles from './DetalleProducto.module.css';

export function CantidadSurtida({
  valor,
  maximo,
  habilitada,
  onCambiar,
}: {
  valor: number;
  /** Lo solicitado del pedido: + se inhabilita al llegar. */
  maximo: number;
  /** El pedido ya tiene piezas del código al abrir el detalle. */
  habilitada: boolean;
  onCambiar: (v: number) => void;
}) {
  return (
    <div className={`${stepper.stepper} ${styles.cantidadSurtida} ${habilitada ? '' : styles.cantidadInhabilitada}`}>
      <button
        type="button"
        className={stepper.side}
        disabled={!habilitada || valor <= 0}
        onClick={() => onCambiar(Math.max(0, valor - 1))}
        aria-label="Menos"
      >
        <img src={menos} alt="" width={52.816} height={43} />
      </button>
      <input
        className={`${stepper.value} ${styles.cantidadInput}`}
        value={String(valor)}
        inputMode="numeric"
        disabled={!habilitada}
        aria-label="Cantidad surtida"
        onChange={(e) => onCambiar(Number(e.target.value.replace(/\D/g, '')) || 0)}
      />
      <button
        type="button"
        className={stepper.side}
        disabled={!habilitada || valor >= maximo}
        onClick={() => onCambiar(Math.min(maximo, valor + 1))}
        aria-label="Más"
      >
        <img src={mas} alt="" width={52.815} height={43} />
      </button>
    </div>
  );
}
