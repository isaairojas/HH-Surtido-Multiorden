/**
 * Pantallas de referencia de la demo: marcan a dónde enruta la HH cuando un escenario sale del surtido
 * multi-orden (surtido anterior, inicio de sesión). No replican esas pantallas: solo dicen cuál se abriría.
 * SDD 2026-10-26-multiorden-surtido-listado · Inicio de surtido y elección de versión / Falla de la consulta de la
 * bandera de multi-orden.
 */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@ds/components/organisms/AppHeader/AppHeader';
import { ContentPanel } from '@ds/components/organisms/ContentPanel/ContentPanel';
import { BottomBar } from '@ds/components/organisms/BottomBar/BottomBar';
import { Button } from '@ds/components/atoms/Button/Button';
import { useStore } from '../../store/AppStore';
import styles from './PantallaReferencia.module.css';

function PantallaReferencia({ titulo, etiqueta, children }: { titulo: string; etiqueta: string; children: ReactNode }) {
  const navigate = useNavigate();
  const { setEtapa } = useStore();
  const volver = () => {
    setEtapa('tareas');
    navigate('/tareas');
  };
  return (
    <div className={styles.screen}>
      <AppHeader backLabel="Menú" onBack={volver} />
      <ContentPanel title={titulo} bottom={124}>
        <div className={styles.cuerpo}>
          <span className={styles.etiqueta}>{etiqueta}</span>
          {children}
        </div>
      </ContentPanel>
      <BottomBar variant="exit">
        <Button variant="default" label="Volver a la toma de tarea" className={styles.full} onClick={volver} />
      </BottomBar>
    </div>
  );
}

/** La tarea no es multi-orden (o la bandera no se pudo consultar): abre el surtido de hoy, sin cambios. */
export function SurtidoAnterior() {
  const { ronda } = useStore();
  return (
    <PantallaReferencia titulo="Surtido de órdenes" etiqueta="Surtido anterior (surtido-ronda)">
      <p className={styles.texto}>
        Aquí la HH abre el <b>surtido anterior</b>, el de hoy, con los {ronda.ronda.pedidos.length} pedidos de la tarea.
      </p>
      <p className={styles.texto}>Este cambio no lo modifica; la demo solo muestra que se enrutó aquí.</p>
    </PantallaReferencia>
  );
}

/** La consulta de la bandera se rechazó por sesión vencida: regresa al inicio de sesión. */
export function InicioSesion() {
  return (
    <PantallaReferencia titulo="Inicio de sesión" etiqueta="Sesión vencida">
      <p className={styles.texto}>
        <b>Tu sesión ha expirado</b>
      </p>
      <p className={styles.texto}>Tu sesión ha expirado, por favor inicia sesión nuevamente</p>
      <p className={styles.nota}>No se abrió ningún surtido.</p>
    </PantallaReferencia>
  );
}
