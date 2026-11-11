/**
 * Configuración simulada de la demo: banderas de la sucursal, datos de la tarea y fallas del servidor.
 * Cada escenario (`src/navigation/escenarios.ts`) siembra la suya; la HH real las obtiene de sus servicios.
 * Solo existe para que QA vea en la demo los escenarios que dependen del servidor (SDD
 * 2026-10-26-multipedido-surtido-listado, 2026-11-05-multipedido-surtido-listado-cierre y 2026-10-26-surtido-listado-imagen-familia).
 */
export type FallaBandera = 'conexion' | 'tiempo' | 'sesion';

export type Simulacion = {
  /* ---- Sucursal ---- */
  /** `BanderaListadoDeProductosEnHH`: abre el surtido por listado. */
  banderaListado: boolean;
  /** `Bandera_MultipedidoEnHH`: las rondas de varios pedidos se surten como multipedido V2. */
  multipedidoEnHH: boolean;
  /** Cómo falla la consulta de `Bandera_MultipedidoEnHH` (null = responde bien). */
  fallaBanderaMultipedido: FallaBandera | null;
  /** `Bandera_MultipedidoMismoCliente`: "Mismo cliente" en el Detalle de la ronda. */
  mismoCliente: boolean;
  /** `Bandera_AgrupacionFamiliaEnHH`: agrupa el listado por familia. */
  agruparPorFamilia: boolean;
  /** La consulta de `Bandera_AgrupacionFamiliaEnHH` falla: se trata como inactiva. */
  fallaBanderaFamilia: boolean;
  /** `Bandera_UbicacionesUDN`: sin agrupación por familia, ordena cada sección por ubicación (si no, por código). */
  ubicacionesUDN: boolean;

  /* ---- Tarea ---- */
  /** La tarea llega sin productos. */
  sinProductos: boolean;
  /**
   * Pedidos cancelados mientras se surte. El listado no se entera hasta finalizar ("Pedido cancelado").
   * SDD 2026-11-05-multipedido-surtido-listado-cierre · Pedido cancelado durante el surtido.
   */
  cancelados: string[];

  /* ---- Servidor ---- */
  /** Milisegundos que tarda en cargar la ronda al abrir el listado (indicador de carga). */
  demoraCarga: number;
  /** Milisegundos que tardan en cargar las imágenes del listado. */
  demoraImagen: number;
  /** El servicio no devuelve los pedidos de la ronda al abrir el listado. */
  fallaCargaRonda: boolean;
  /** Pedido sin contenedor virtual al abrir el listado. */
  sinContenedor: string | null;
  /** Pedido cuyos datos (cliente y totales) no se pueden consultar al abrir el Detalle de la ronda. */
  fallaDatosPedido: string | null;
  /** Pedido cuya desvinculación no responde al salir ('*' = el servicio entero no responde). */
  fallaDesvincular: string | null;
  /** Pedido cuyo registro (`FillOrderFull`) falla al finalizar. */
  fallaGuardado: string | null;
  /** Si la falla del guardado es de red o del servidor. */
  tipoFallaGuardado: 'red' | 'servidor';
  /** Cuántas veces falla ese guardado antes de pasar (1 = el primer reintento ya pasa). */
  vecesFallaGuardado: number;
  /** Otro usuario ya concluyó la ronda en otra HH. */
  concluidaPorOtro: boolean;
  /** Otro usuario concluye la ronda justo antes de registrar este pedido (los anteriores ya se registraron). */
  concluidaAntesDe: string | null;
  /** El servicio de negación falla. */
  fallaNegar: boolean;
  /** El servicio de retiro (`RemoveFromRound`) falla al sacar un corporativo. */
  fallaRetiro: boolean;
};

/**
 * Sucursal con multipedido V2, listado y agrupación por familia. Fuera de la demo (2026-11-09): la etiqueta única
 * (QR), la guía por voz y lo que se manda al servidor; siguen en la spec.
 */
export const SIMULACION_INICIAL: Simulacion = {
  banderaListado: true,
  multipedidoEnHH: true,
  fallaBanderaMultipedido: null,
  mismoCliente: true,
  agruparPorFamilia: true,
  fallaBanderaFamilia: false,
  ubicacionesUDN: false,
  sinProductos: false,
  cancelados: [],
  demoraCarga: 0,
  demoraImagen: 0,
  fallaCargaRonda: false,
  sinContenedor: null,
  fallaDatosPedido: null,
  fallaDesvincular: null,
  fallaGuardado: null,
  tipoFallaGuardado: 'red',
  vecesFallaGuardado: 1,
  concluidaPorOtro: false,
  concluidaAntesDe: null,
  fallaNegar: false,
  fallaRetiro: false,
};

/** La agrupación por familia aplica si la bandera está activa y su consulta no falló. */
export const agrupaPorFamilia = (s: Simulacion) => s.agruparPorFamilia && !s.fallaBanderaFamilia;

/** Criterio de orden del listado con las banderas de la sucursal (ver `ordenarListado`). */
export const ordenDelListado = (s: Simulacion) => ({ familia: agrupaPorFamilia(s), ubicaciones: s.ubicacionesUDN });

