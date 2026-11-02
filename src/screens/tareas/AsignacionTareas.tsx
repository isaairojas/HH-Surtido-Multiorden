/**
 * Toma de tarea para el surtido multi-orden.
 * Muestra la ronda asignada con sus N pedidos en el orden del algoritmo.
 * Pedidos del mismo cliente llevan badge "Mismo cliente".
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
import { clientesRepetidos } from '../../domain/ronda';
import { EMPLEADO, TAREA } from '../../mocks/ronda';
import { useStore } from '../../store/AppStore';
import { ContenedorLetra } from '../surtido/Contenedores';
import styles from './AsignacionTareas.module.css';

export function AsignacionTareas() {
  const navigate = useNavigate();
  const { ronda } = useStore();
  const pedidos = ronda.ronda.pedidos;
  const total = pedidos.length;

  // Marca "Mismo cliente" por grupos: cada pedido lo lleva si comparte cliente con otro de la ronda.
  const compartido = clientesRepetidos(pedidos);

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
        <InfoBlock
          title={TAREA.documentoLabel}
          icon={receiptIcon}
          iconSize={{ w: 13.482, h: 17.159 }}
          rows={[{ value: ronda.ronda.id }]}
        />

        <div className={styles.pedidos}>
          <div className={styles.pedidosHeader}>
            <img src={receiptIcon} alt="" width={13.482} height={17.159} />
            <p>Pedidos de la ronda ({total})</p>
          </div>
          <ol className={styles.pedidosLista}>
            {pedidos.map((p, idx) => {
              const esMismoCliente = compartido.has(p.cliente.id);
              return (
                <li key={p.id} className={styles.pedidoItem}>
                  <div className={styles.pedidoOrden}>
                    <ContenedorLetra idx={idx} />
                    <span className={styles.pedidoTotal}>
                      {idx + 1} de {total}
                    </span>
                  </div>
                  <div className={styles.pedidoBody}>
                    <div className={styles.pedidoHead}>
                      <span className={styles.pedidoId}>Pedido {p.id}</span>
                      {esMismoCliente && <span className={styles.chipMismoCliente}>Mismo cliente</span>}
                    </div>
                    <p className={styles.pedidoCliente} title={p.cliente.nombre}>
                      {p.cliente.nombre}
                    </p>
                    <p className={styles.pedidoResumen}>
                      {p.partidas.length} {p.partidas.length === 1 ? 'producto' : 'productos'} ·{' '}
                      {p.partidas.reduce((n, x) => n + x.solicitado, 0)} piezas
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
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
