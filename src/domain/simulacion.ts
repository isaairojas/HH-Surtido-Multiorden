/**
 * Configuración simulada de la demo: banderas de la sucursal, datos de la tarea y fallas del servidor.
 * Cada escenario (`src/navigation/escenarios.ts`) siembra la suya; la HH real las obtiene de sus servicios.
 * Solo existe para que QA vea en la demo los escenarios que dependen del servidor (SDD
 * 2026-10-26-multiorden-surtido-listado, 2026-11-05-multiorden-surtido-listado-cierre y 2026-10-26-surtido-listado-imagen-familia).
 */
export type FallaBandera = 'conexion' | 'tiempo' | 'sesion';

export type Simulacion = {
  /* ---- Sucursal ---- */
  /** `BanderaListadoDeProductosEnHH`: abre el surtido por listado. */
  banderaListado: boolean;
  /** `Bandera_MultiordenEnHH`: las rondas de varios pedidos se surten como multi-orden. */
  multiordenEnHH: boolean;
  /** Cómo falla la consulta de `Bandera_MultiordenEnHH` (null = responde bien). */
  fallaBanderaMultiorden: FallaBandera | null;
  /** `Bandera_MultiordenMismoCliente`: "Mismo cliente" en el Detalle de la ronda. */
  mismoCliente: boolean;
  /** `Bandera_AgrupacionFamiliaEnHH`: agrupa el listado por familia. */
  agruparPorFamilia: boolean;
  /** La consulta de `Bandera_AgrupacionFamiliaEnHH` falla: se trata como inactiva. */
  fallaBanderaFamilia: boolean;

  /* ---- Tarea ---- */
  /** La tarea llega sin productos. */
  sinProductos: boolean;

  /* ---- Servidor ---- */
  /** El servicio no devuelve los pedidos de la ronda al abrir el listado. */
  fallaCargaRonda: boolean;
  /** Pedido sin contenedor virtual al abrir el listado. */
  sinContenedor: string | null;
  /** Pedido cuya desvinculación no responde al salir ('*' = el servicio entero no responde). */
  fallaDesvincular: string | null;
  /** Pedido cuyo registro (`FillOrderFull`) falla al finalizar; el reintento sí pasa. */
  fallaGuardado: string | null;
  /** Otro usuario ya concluyó la ronda en otra HH. */
  concluidaPorOtro: boolean;
  /** El servicio de negación falla. */
  fallaNegar: boolean;
};

/**
 * Sucursal con multi-orden, listado y agrupación por familia. Fuera de la demo (2026-11-09): la etiqueta única
 * (QR), la guía por voz y lo que se manda al servidor; siguen en la spec.
 */
export const SIMULACION_INICIAL: Simulacion = {
  banderaListado: true,
  multiordenEnHH: true,
  fallaBanderaMultiorden: null,
  mismoCliente: true,
  agruparPorFamilia: true,
  fallaBanderaFamilia: false,
  sinProductos: false,
  fallaCargaRonda: false,
  sinContenedor: null,
  fallaDesvincular: null,
  fallaGuardado: null,
  concluidaPorOtro: false,
  fallaNegar: false,
};

/** La agrupación por familia aplica si la bandera está activa y su consulta no falló. */
export const agrupaPorFamilia = (s: Simulacion) => s.agruparPorFamilia && !s.fallaBanderaFamilia;

