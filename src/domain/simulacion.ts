/**
 * Configuración simulada de la demo: banderas de la sucursal, datos de la tarea y fallas del servidor.
 * Cada escenario (`src/navigation/escenarios.ts`) siembra la suya; la HH real las obtiene de sus servicios.
 * Solo existe para que QA vea en la demo los escenarios que dependen del servidor (SDD
 * 2026-10-26-multipedido-surtido-listado, 2026-11-05-multipedido-surtido-listado-cierre y 2026-10-26-surtido-listado-imagen-familia).
 */
export type FallaBandera = 'conexion' | 'tiempo' | 'sesion';

/**
 * Quién armó la ronda (SDD 2026-10-26-multipedido-surtido-listado · Ronda multipedido V2 en la asignación,
 * clarificación 63): solo la que armó el multipedido V2 es ronda V2. La división de factura por montos
 * (`BndUnificarRondasMontos`), la paquetería de foráneos y la sugerencia a embarques siguen su flujo de hoy.
 */
export type OrigenRonda = 'multipedido-v2' | 'factura-dividida' | 'paqueteria' | 'sugerencia-embarque';

/**
 * Cuándo falla la consulta de los pedidos de la ronda (SDD 2026-10-26-multipedido-surtido-listado · Falla al cargar la
 * ronda, clarificaciones 51 y 65): al mostrar la tarea asignada (se ve como hoy, sin aviso; al aceptar vuelve a
 * consultar y vuelve a fallar) o al aceptar (alerta y la tarea no se toma; el reintento ya responde).
 */
export type FallaConsultaRonda = 'al-mostrar' | 'al-aceptar';

export type Simulacion = {
  /* ---- Sucursal ---- */
  /** `BanderaListadoDeProductosEnHH`: abre el surtido por listado. */
  banderaListado: boolean;
  /** La consulta de `BanderaListadoDeProductosEnHH` falla: se trata como inactiva (alerta global si es de conexión). */
  fallaBanderaListado: FallaBandera | null;
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
  /**
   * El servicio entrega la tarea sin el dato de familia: el listado se ordena como con la agrupación inactiva, sin
   * aviso (imagen-familia · Agrupación por familia · "La tarea llega sin familias", clarificación 20).
   */
  sinDatoFamilia: boolean;
  /** `Bandera_UbicacionesUDN`: sin agrupación por familia, ordena cada sección por ubicación (si no, por código). */
  ubicacionesUDN: boolean;

  /** "Lectura de elementos" de "Tareas de surtido" (preferencia del equipo): solo cuenta en la tarea 31. */
  lecturaElementos: boolean;

  /* ---- Tarea ---- */
  /** Quién armó la ronda (ver `OrigenRonda`). */
  origenRonda: OrigenRonda;
  /** Tipo de tarea: 31 (surtido) o 58. La 58 lee en voz alta aunque la lectura esté apagada. */
  tipoTarea: 31 | 58;
  /** `surtidoEtiquetaUnicaEnabled` de la tarea: los productos con `requiereEU` validan su QR. */
  etiquetaUnica: boolean;
  /** El servicio de etiqueta única encuentra etiquetas con caducidad más próxima que la escaneada (perecederos). */
  etiquetasMasAntiguas: boolean;
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
  /** Falla la consulta de los pedidos de la ronda (ver `FallaConsultaRonda`). */
  fallaConsultaRonda: FallaConsultaRonda | null;
  /** Pedido que llega sin número de pedido, número de cliente o nombre de cliente al aceptar la ronda. */
  pedidoSinDatos: string | null;
  /** Pedido cuya desvinculación no responde al salir ('*' = el servicio entero no responde). */
  fallaDesvincular: string | null;
  /** Pedido cuyo registro (`FillOrderFull`) falla al finalizar. */
  fallaGuardado: string | null;
  /** Si la falla del guardado es de red o del servidor. */
  tipoFallaGuardado: 'red' | 'servidor';
  /** Cuántas veces falla ese guardado antes de pasar (1 = el primer reintento ya pasa). */
  vecesFallaGuardado: number;
  /** Falla el cierre de la ronda (todos los pedidos ya registrados) la primera vez, por la red. */
  fallaCierreRonda: boolean;
  /** Falla la comprobación de cancelados al intentar finalizar (alerta de error de la app). */
  fallaComprobacionCancelados: boolean;
  /** Otro usuario ya concluyó la ronda en otra HH. */
  concluidaPorOtro: boolean;
  /** Otro usuario concluye la ronda justo antes de registrar este pedido (los anteriores ya se registraron). */
  concluidaAntesDe: string | null;
  /** El registro de la negación falla en este pedido ('*' = el servicio entero): no se niega ninguno. */
  fallaNegar: string | null;
  /** El registro de "Eliminar productos" de la promoción falla en este pedido: la promoción no se niega en ninguno. */
  fallaEliminarPromocion: string | null;
  /** Al sacar un corporativo falla el retiro (`RemoveFromRound`) o el registro del retiro. */
  fallaRetiro: 'retiro' | 'registro' | null;
};

/**
 * Sucursal con multipedido V2, listado y agrupación por familia; tarea 31 con "Lectura de elementos" encendida y
 * sin etiqueta única. Lo que la HH manda al servidor no se ve en la demo.
 */
export const SIMULACION_INICIAL: Simulacion = {
  banderaListado: true,
  fallaBanderaListado: null,
  multipedidoEnHH: true,
  fallaBanderaMultipedido: null,
  mismoCliente: true,
  agruparPorFamilia: true,
  fallaBanderaFamilia: false,
  sinDatoFamilia: false,
  ubicacionesUDN: false,
  lecturaElementos: true,
  origenRonda: 'multipedido-v2',
  tipoTarea: 31,
  etiquetaUnica: false,
  etiquetasMasAntiguas: false,
  sinProductos: false,
  cancelados: [],
  demoraCarga: 0,
  demoraImagen: 0,
  fallaCargaRonda: false,
  sinContenedor: null,
  fallaConsultaRonda: null,
  pedidoSinDatos: null,
  fallaDesvincular: null,
  fallaGuardado: null,
  tipoFallaGuardado: 'red',
  vecesFallaGuardado: 1,
  fallaCierreRonda: false,
  fallaComprobacionCancelados: false,
  concluidaPorOtro: false,
  concluidaAntesDe: null,
  fallaNegar: null,
  fallaEliminarPromocion: null,
  fallaRetiro: null,
};

/**
 * Fallas de una sola vez del servidor simulado (negar, retirar…): la primera vez fallan y el reintento ya responde,
 * para que QA vea el "puede reintentar" de la spec. Vive fuera de React porque el detalle se desmonta al regresar;
 * recargar la página (o "Reiniciar" el caso) lo vacía.
 */
const fallasConsumidas = new Set<string>();
export function fallaUnaVez(clave: string): boolean {
  if (fallasConsumidas.has(clave)) return false;
  fallasConsumidas.add(clave);
  return true;
}

/** La agrupación por familia aplica si la bandera está activa y su consulta no falló. */
export const agrupaPorFamilia = (s: Simulacion) => s.agruparPorFamilia && !s.fallaBanderaFamilia && !s.sinDatoFamilia;

/**
 * La tarea es una ronda multipedido V2 (SDD 2026-10-26-multipedido-surtido-listado · Ronda multipedido V2 en la
 * asignación): dos o más pedidos, las dos banderas activas y consultadas sin falla, y armada por el multipedido V2.
 * Los balanceos (actividad 58) nunca forman ronda V2 (armado-ronda, clarificación 35).
 */
export const esRondaV2 = (s: Simulacion, pedidos: number) =>
  pedidos > 1 &&
  s.banderaListado &&
  !s.fallaBanderaListado &&
  s.multipedidoEnHH &&
  !s.fallaBanderaMultipedido &&
  s.origenRonda === 'multipedido-v2' &&
  s.tipoTarea === 31;

/** Criterio de orden del listado con las banderas de la sucursal (ver `ordenarListado`). */
export const ordenDelListado = (s: Simulacion) => ({ familia: agrupaPorFamilia(s), ubicaciones: s.ubicacionesUDN });

