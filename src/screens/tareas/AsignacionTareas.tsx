/**
 * Toma de tarea para el surtido multipedido V2.
 * Muestra la ronda asignada con sus N pedidos en el orden del algoritmo, uno por contenedor
 * (bloque "Pedidos" de la propuesta A). "Mismo cliente" se marca en el Detalle de la ronda.
 *
 * SDD 2026-10-26-multipedido-surtido-listado · Pedidos de la ronda en la tarea asignada: esta lista. El orden
 * (próximos a vencer) lo da el procesador de ordenamiento; la HH no reordena.
 *
 * SDD 2026-10-26-multipedido-surtido-listado · Inicio de surtido y elección de versión / Falla de la consulta de la
 * bandera de multipedido V2: "Aceptar" enruta según las banderas de la sucursal (simuladas en la demo):
 * listado de un pedido, Detalle de la ronda multipedido V2, surtido anterior o inicio de sesión.
 */
import { useState } from 'react';
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
import styles from './AsignacionTareas.module.css';

export function AsignacionTareas() {
  const navigate = useNavigate();
  const { ronda, simulacion, mostrarToast, setEtapa } = useStore();
  const pedidos = ronda.ronda.pedidos;
  const total = pedidos.length;
  const [sinProductos, setSinProductos] = useState(false);
  // Solo una ronda multipedido V2 identifica cada pedido con la letra de su contenedor.
  const multipedido = total > 1 && simulacion.multipedidoEnHH;

  const irAnterior = () => {
    navigate('/surtido-anterior');
  };

  /** Enrutamiento de "Aceptar" con las banderas de la sucursal. */
  const aceptar = () => {
    if (simulacion.sinProductos || total === 0) {
      return setSinProductos(true);
    }
    if (!simulacion.banderaListado) return irAnterior();
    setEtapa('surtido');
    if (total === 1) return navigate('/surtido');
    const falla = simulacion.fallaBanderaMultipedido;
    if (falla === 'sesion') {
      return navigate('/login');
    }
    if (falla === 'conexion') {
      mostrarToast({ kind: 'error', title: 'Error de conexión', message: 'Ocurrió un error de conexión con el servidor.' });
      return irAnterior();
    }
    if (falla === 'tiempo') {
      return irAnterior();
    }
    if (!simulacion.multipedidoEnHH) return irAnterior();
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
