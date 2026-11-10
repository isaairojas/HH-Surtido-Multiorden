/**
 * Contenedores de la ronda: letra por pedido y tarjetas de avance individual.
 * Interfaz de la propuesta A de `Solicitud anticipada Uber` (rama feature-surtido-multipedido),
 * mockups 15:1437 / 15:1500 del archivo "Handheld for Claude" (Zf1wV1oULSD14o7TPW4da9).
 *
 * Diferencias con la referencia (sesión del 2026-11-02):
 * - Las tarjetas no filtran la lista: solo muestran el avance de cada pedido.
 * - En vez del pedido seleccionado, se resalta (relleno azul) el pedido que se está surtiendo; ninguno
 *   hasta el primer escaneo.
 * - La letra se dibuja con CSS en lugar de los SVG A/B/C, para servir con cualquier número de pedidos.
 * Solo presentación: no cambia ninguna regla de la ronda.
 */
import { pedidoCompleto, type Pedido } from '../../domain/ronda';
import styles from './Contenedores.module.css';

/** Letra del contenedor según la posición del pedido en la ronda: 0 → A, 1 → B, … */
export const letraPedido = (idx: number) => String.fromCharCode(65 + idx);

type Variante = 'normal' | 'invertido' | 'completo';

/** Círculo con la letra del contenedor (azul; blanco sobre fondo azul; verde si está completo). */
export function ContenedorLetra({ letra, variante = 'normal', size = 30 }: { letra: string; variante?: Variante; size?: number }) {
  return (
    <span
      className={`${styles.letra} ${styles[variante]}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      role="img"
      aria-label={`Contenedor ${letra}`}
    >
      {letra}
    </span>
  );
}

/** Piezas surtidas y solicitadas del pedido; las partidas negadas dejan de contar como solicitadas. */
export function avancePedido(p: Pedido) {
  const vivas = p.partidas.filter((x) => !x.motivoNegacion);
  return {
    surtido: vivas.reduce((n, x) => n + x.surtido, 0),
    solicitado: vivas.reduce((n, x) => n + x.solicitado, 0),
    completo: pedidoCompleto(p),
  };
}

/** Una tarjeta por pedido con su letra, número y avance en piezas. `actualIdx` = -1: ninguna marcada. */
export function ContenedoresResumen({ pedidos, actualIdx }: { pedidos: Pedido[]; actualIdx: number }) {
  return (
    <div className={styles.contenedores}>
      {pedidos.map((p, idx) => {
        const a = avancePedido(p);
        const letra = p.contenedor ?? letraPedido(idx);
        const actual = idx === actualIdx && !a.completo;
        return (
          <div
            key={p.id}
            className={[styles.contenedor, a.completo ? styles.listo : '', actual ? styles.actual : ''].join(' ')}
            aria-current={actual ? 'step' : undefined}
          >
            <span className={styles.icono}>
              <ContenedorLetra letra={letra} variante={actual ? 'invertido' : a.completo ? 'completo' : 'normal'} />
              {a.completo && (
                <span className={styles.insignia} aria-label="Completo">
                  ✓
                </span>
              )}
            </span>
            <span className={styles.datos}>
              <span>#{p.id}</span>
              <b>
                {a.surtido} de {a.solicitado}
              </b>
            </span>
          </div>
        );
      })}
    </div>
  );
}
