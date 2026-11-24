/**
 * Toma de tarea para el surtido multipedido V2.
 * Muestra la ronda asignada con sus N pedidos en el orden del algoritmo, uno por contenedor
 * (bloque "Pedidos" de la propuesta A). "Mismo cliente" se marca en el Detalle de la ronda.
 *
 * SDD 2026-10-26-multipedido-surtido-listado · Pedidos de la ronda en la tarea asignada: esta lista. El orden
 * (holgura, o ponderación V2) lo da el procesador de ordenamiento; la HH no reordena.
 *
 * SDD 2026-10-26-multipedido-surtido-listado · Inicio de surtido y elección de versión / Ronda multipedido V2 en la
 * asignación / Falla de la consulta de la bandera de multipedido V2 / Falla al cargar la ronda: "Aceptar" enruta según
 * las banderas de la sucursal y quién armó la ronda (simulados en la demo): listado de un pedido, Detalle de la ronda
 * multipedido V2, surtido anterior o inicio de sesión. La división de factura, la paquetería y la sugerencia a
 * embarques siguen su flujo de hoy (surtido anterior), con prioridad sobre el multipedido V2.
 * Si la consulta de los pedidos de la ronda falla al mostrar la tarea, se ve como hoy (sin "Contenedor {letra}" ni
 * aviso); si falla al aceptar, o un pedido llega sin datos, alerta y la tarea no se toma: sigue aquí para reintentar.
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import userIcon from '@assets/icons/user.svg';
import tareaIcon from '@assets/icons/user-tarea.svg';
import activityIcon from '@assets/icons/activity.svg';
import calendarIcon from '@assets/icons/calendar.svg';
import receiptIcon from '@assets/icons/receipt.svg';
import botonCancelar from '@assets/icons/boton-cancelar.svg';
import { AppHeader } from '@ds/components/organisms/AppHeader/AppHeader';
import { ContentPanel } from '@ds/components/organisms/ContentPanel/ContentPanel';
import { BottomBar } from '@ds/components/organisms/BottomBar/BottomBar';
import { Button } from '@ds/components/atoms/Button/Button';
import { LabeledField } from '@ds/components/molecules/LabeledField/LabeledField';
import { InfoBlock } from '@ds/components/molecules/InfoBlock/InfoBlock';
import { EMPLEADO, TAREA } from '../../mocks/ronda';
import { useStore } from '../../store/AppStore';
import { AvisoModal, TextoAviso } from '../surtido/overlays/Avisos';
import { letraDe } from '../../domain/ronda';
import { esRondaV2, type FallaBandera } from '../../domain/simulacion';
import styles from './AsignacionTareas.module.css';

export function AsignacionTareas() {
  const navigate = useNavigate();
  const { ronda, simulacion, mostrarToast, setEtapa } = useStore();
  const pedidos = ronda.ronda.pedidos;
  const total = pedidos.length;
  const [sinProductos, setSinProductos] = useState(false);
  /** Veces que ya falló la consulta de los pedidos de la ronda al aceptar (el reintento vuelve a consultar). */
  const fallosRonda = useRef(0);
  const v2 = esRondaV2(simulacion, total);
  // "Contenedor {letra}" solo en una ronda V2 cuyos pedidos se pudieron consultar al mostrar la tarea.
  const multipedido = v2 && simulacion.fallaConsultaRonda !== 'al-mostrar';
  const ALERTA_ERROR = { kind: 'error' as const, title: 'Error de conexión', message: 'Ocurrió un error de conexión con el servidor.' };

  const irAnterior = () => {
    setEtapa('surtido');
    navigate('/surtido-anterior');
  };

  /**
   * Una bandera que no se puede consultar se trata como inactiva (patrón de `2026-10-24-configuracion-aplicacion`):
   * alerta global si la falla es de conexión, nada si no responde a tiempo; con la sesión vencida, al inicio de sesión.
   * Devuelve true si ya enrutó.
   */
  const fallaDeBandera = (falla: FallaBandera | null) => {
    if (!falla) return false;
    if (falla === 'sesion') {
      navigate('/login');
      return true;
    }
    if (falla === 'conexion') mostrarToast(ALERTA_ERROR);
    irAnterior();
    return true;
  };

  /** Enrutamiento de "Aceptar" con las banderas de la sucursal. */
  const aceptar = () => {
    if (simulacion.sinProductos || total === 0) {
      return setSinProductos(true);
    }
    if (fallaDeBandera(simulacion.fallaBanderaListado)) return;
    if (!simulacion.banderaListado) return irAnterior();
    if (total === 1) {
      setEtapa('surtido');
      return navigate('/surtido');
    }
    if (fallaDeBandera(simulacion.fallaBanderaMultipedido)) return;
    if (!simulacion.multipedidoEnHH) return irAnterior();
    // Dos o más pedidos con las dos banderas activas: se consultan los pedidos de la ronda, aunque sea una factura
    // dividida (clarificación 65). Si falla o un pedido llega sin datos, la tarea no se toma.
    const debeFallar =
      (simulacion.fallaConsultaRonda === 'al-aceptar' || simulacion.fallaConsultaRonda === 'al-mostrar') && fallosRonda.current < 1;
    if (debeFallar) {
      fallosRonda.current += 1;
      return mostrarToast(ALERTA_ERROR);
    }
    if (simulacion.pedidoSinDatos && pedidos.some((p) => p.id === simulacion.pedidoSinDatos)) {
      return mostrarToast({ kind: 'error', title: 'Error', message: 'No se pudo cargar la información de la ronda.' });
    }
    // La división de factura, la paquetería, la sugerencia a embarques y los balanceos no son ronda V2.
    if (!v2) return irAnterior();
    // La tarea se toma al pulsar "Iniciar surtido" en el Detalle de la ronda.
    navigate('/ronda');
  };

  return (
    <div className={styles.screen}>
      <AppHeader backLabel="Menú" />
      <ContentPanel title="Asignación de tareas" paddingBottom={22} align="start" bottom={124} scroll>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <img src={userIcon} alt="" width={11.458} height={11.458} />
            <p>Empleado</p>
          </div>
          <div className={styles.fieldWidth}>
            <LabeledField labelWidth="hug" label={EMPLEADO.id} value={EMPLEADO.nombre} />
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <img src={tareaIcon} alt="" width={11.161} height={13.708} />
            <p>Tarea asignada</p>
          </div>
          <div className={styles.fieldWidth}>
            <LabeledField labelWidth="hug" label={ronda.ronda.id} value={`${total} ${total === 1 ? 'pedido' : 'pedidos'}`} />
          </div>
        </div>
        <InfoBlock
          title="Actividad"
          icon={activityIcon}
          iconSize={{ w: 13.482, h: 19.872 }}
          rows={[{ value: TAREA.actividad }]}
        />
        <InfoBlock
          title="Fecha"
          icon={calendarIcon}
          iconSize={{ w: 14.589, h: 16.21 }}
          rows={[
            { label: 'Fecha inicio:', value: TAREA.fecha },
            { label: 'Hora inicio:', value: TAREA.hora },
          ]}
        />
        {/* Igual que la propuesta A: una fila por contenedor con su pedido. Cliente, piezas y "Mismo cliente"
            se ven en el Detalle de la ronda, la pantalla siguiente. */}
        <InfoBlock
          title={TAREA.documentoLabel}
          icon={receiptIcon}
          iconSize={{ w: 13.482, h: 17.159 }}
          rows={pedidos.map((p, idx) => ({ label: multipedido ? `Contenedor ${letraDe(ronda.ronda, idx)}` : 'Pedido', value: p.id }))}
        />
      </ContentPanel>
      <BottomBar>
        <div className="row">
          <Button asset={botonCancelar} label="Cancelar" className={styles.half} />
          <Button
            variant="success"
            icon="check"
            label="Aceptar"
            className={styles.half}
            onClick={aceptar}
          />
        </div>
      </BottomBar>
      {sinProductos && (
        <AvisoModal titulo="Error" tipo="error" botones={[{ label: 'Aceptar', onClick: () => setSinProductos(false) }]}>
          <TextoAviso>Lo sentimos, no ha sido posible cargar la información necesaria. Por favor, regresa al menú principal.</TextoAviso>
        </AvisoModal>
      )}
    </div>
  );
}
