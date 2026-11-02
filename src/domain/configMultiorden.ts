/**
 * Parámetros del multi-orden por sucursal.
 * SDD multiorden-armado-ronda (sdd/changes/multiorden-armado-ronda) · Requirement: Parámetros del
 * multi-orden por sucursal.
 *
 * Solo declarados, salvo `agruparPorFamilia`, que la pantalla de surtido sí lee. La ronda la arma el
 * back-end y la HH la recibe armada. Los valores por defecto son la configuración inicial acordada el
 * 2026-10-26.
 */

/** Servicio de entrega. SDD multiorden-armado-ronda · Requirement: Mismo servicio. */
export type Servicio = 'local' | 'foraneo';

/** SDD multiorden-armado-ronda · Requirement: Tipo de pedido. */
export type TipoPedido = 'pedido' | 'traspaso' | 'corporativo';

/** Cada campo indica la bandera o el parámetro de sucursal que lo alimentaría (nombres propuestos). */
export type ConfigMultiorden = {
  /** `Bandera_MultiordenEnHH`. Inactiva: cada pedido se surte como hoy. */
  multiordenActivo: boolean;
  /** `Parametro_MultiordenMaxPedidos`: ancla + próximos a vencer que se evalúan. */
  maxPedidosPorRonda: number;
  /** `Bandera_MultiordenValidarCodigos`: un candidato entra solo si comparte códigos con la ronda. */
  validarCodigosCompartidos: boolean;
  /**
   * `Parametro_MultiordenMaxPartidas`: tope acumulado de la ronda. Un candidato entra solo si, con
   * sus partidas, la ronda no lo supera.
   */
  maxPartidasPorRonda: number;
  /** Tipos que pueden entrar a multi-orden. Traspasos: `Bandera_MultiordenTraspasos`. */
  tiposPedidoMultiorden: Record<TipoPedido, boolean>;
  /** `Bandera_AgrupacionFamiliaEnHH` (SDD surtido-listado-imagen-familia): agrupa el listado por familia. */
  agruparPorFamilia: boolean;
};

export const CONFIG_MULTIORDEN_DEFAULT: ConfigMultiorden = {
  multiordenActivo: true,
  maxPedidosPorRonda: 3,
  validarCodigosCompartidos: true,
  maxPartidasPorRonda: 15,
  tiposPedidoMultiorden: { pedido: true, corporativo: true, traspaso: false },
  // Activa en la demo desde el 2026-11-02: es regla del proyecto (SDD surtido-listado-imagen-familia).
  agruparPorFamilia: true,
};

/*
 * Reglas fijas (no son parámetros), en sdd/changes/multiorden-armado-ronda:
 *   - Requirement: Pedidos de una división de factura — no entran a multi-orden; la división de $2,000
 *     de Épico sigue igual.
 *   - Requirement: Mismo servicio — local con local, foráneo con foráneo.
 *   - Requirement: Surtido unificado con revisión excluye multi-orden — con `Bandera_RevisionPedidoEnHH`
 *     activa no se evalúan candidatos (la bandera ya existe en el catálogo de la sucursal).
 *   - Requirement: Integrar o surtir solo — el pedido que no cumple se surte solo, como hoy.
 */
