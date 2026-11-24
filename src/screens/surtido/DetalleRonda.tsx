/**
 * Detalle de la ronda — pantalla previa al surtido multipedido V2.
 * Interfaz: "Detalle de la ronda" 34:2 (archivo "Handheld for Claude", Zf1wV1oULSD14o7TPW4da9), ya implementada
 * en la propuesta A de `Solicitud anticipada Uber` (rama feature-surtido-multipedido).
 *
 * Un panel por contenedor: letra, piezas y códigos del pedido, folio y cliente como "{número de cliente} · {nombre del
 * cliente}" (SDD 2026-10-26-multipedido-surtido-listado · Cliente en el detalle de la ronda, clarificación 50): el número
 * se ve siempre y el nombre se corta con "…" si no cabe en una línea. "Mismo cliente" marca los pedidos que comparten
 * número de cliente cuando `Bandera_MultipedidoMismoCliente` está activa (simulada en la demo).
 * Detalle de la ronda al aceptar (clarificación 64): la flecha de regreso no lleva texto y vuelve a la tarea asignada
 * sin tomarla; la tarea se toma con "Iniciar surtido". Cliente y totales salen de los datos del propio pedido, sin
 * consumir folios de contenedor virtual. Diferencia con la referencia: no se muestra la hora de captura porque el
 * modelo de la ronda no la trae.
 */
import { useNavigate } from 'react-router-dom';
import assignment from '@assets/icons/assignment.svg';
import person from '@assets/icons/person-panel.svg';
import { AppHeader } from '@ds/components/organisms/AppHeader/AppHeader';
import { ContentPanel } from '@ds/components/organisms/ContentPanel/ContentPanel';
import { BottomBar } from '@ds/components/organisms/BottomBar/BottomBar';
import { Button } from '@ds/components/atoms/Button/Button';
import { clientesRepetidos, letraDe } from '../../domain/ronda';
import { useStore } from '../../store/AppStore';
import { ContenedorLetra } from './Contenedores';
import styles from './DetalleRonda.module.css';

export function DetalleRonda() {
  const navigate = useNavigate();
  const { ronda, simulacion, setEtapa } = useStore();
  const pedidos = ronda.ronda.pedidos;
  // Con la bandera inactiva ningún panel lleva "Mismo cliente".
  const compartido = simulacion.mismoCliente ? clientesRepetidos(pedidos) : new Set<string>();
  return (
    <div className={styles.screen}>
      <AppHeader onBack={() => navigate('/tareas')} />
      <ContentPanel title="Detalle de la ronda" bottom={124} scroll>
        <div className={styles.contenido}>
          {pedidos.map((p, idx) => {
            const piezas = p.partidas.reduce((n, x) => n + x.solicitado, 0);
            return (
              <section key={p.id} className={styles.panel} aria-label={`Contenedor ${letraDe(ronda.ronda, idx)}`}>
                <div className={styles.encabezado}>
                  <ContenedorLetra letra={letraDe(ronda.ronda, idx)} />
                  <div className={styles.totales}>
                    <b>{piezas} pz</b>
                    <span>
                      {p.partidas.length} {p.partidas.length === 1 ? 'código' : 'códigos'}
                    </span>
                  </div>
                </div>
                <div className={styles.divider} />
                <div className={styles.dato}>
                  <img src={assignment} alt="" width={20} height={20} />
                  <span className={styles.texto}>#{p.id}</span>
                </div>
                <div className={styles.dato}>
                  <img src={person} alt="" width={20} height={20} />
                  <span className={styles.cliente} title={`${p.cliente.id} · ${p.cliente.nombre}`}>
                    <span className={styles.numeroCliente}>{p.cliente.id} · </span>
                    <span className={styles.nombreCliente}>{p.cliente.nombre}</span>
                  </span>
                  {compartido.has(p.cliente.id) && <span className={styles.badge}>Mismo cliente</span>}
                </div>
              </section>
            );
          })}
        </div>
      </ContentPanel>
      <BottomBar variant="footer">
        <Button variant="success" label="Iniciar surtido" className={styles.flex1} onClick={() => {
            setEtapa('surtido');
            navigate('/surtido');
          }}
        />
      </BottomBar>
    </div>
  );
}
