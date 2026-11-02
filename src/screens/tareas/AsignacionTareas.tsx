/**
 * Toma de tarea para el surtido multi-orden.
 * Muestra la ronda asignada con sus N pedidos en el orden del algoritmo, uno por contenedor
 * (bloque "Pedidos" de la propuesta A). "Mismo cliente" se marca en el Detalle de la ronda.
 *
 * SDD multiorden-surtido-listado · Pedidos de la ronda en la tarea asignada: esta lista. El orden
 * (próximos a vencer) lo da el procesador de ordenamiento; la HH no reordena.
 */
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
import { letraPedido } from '../surtido/Contenedores';
import styles from './AsignacionTareas.module.css';

export function AsignacionTareas() {
  const navigate = useNavigate();
  const { ronda } = useStore();
  const pedidos = ronda.ronda.pedidos;
  const total = pedidos.length;

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
          rows={pedidos.map((p, idx) => ({ label: `Contenedor ${letraPedido(idx)}`, value: p.id }))}
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
            onClick={() => navigate('/ronda')}
          />
        </div>
      </BottomBar>
    </div>
  );
}
