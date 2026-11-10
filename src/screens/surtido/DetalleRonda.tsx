/**
 * Detalle de la ronda — pantalla previa al surtido multi-orden.
 * Interfaz: "Detalle de la ronda" 34:2 (archivo "Handheld for Claude", Zf1wV1oULSD14o7TPW4da9), ya implementada
 * en la propuesta A de `Solicitud anticipada Uber` (rama feature-surtido-multipedido).
 *
 * Un panel por contenedor: letra, piezas y códigos del pedido, folio y cliente; "Mismo cliente" cuando el
 * cliente se repite en la ronda (FR-003) y `Bandera_MultiordenMismoCliente` está activa (simulada en la demo). Diferencia con la referencia: no se muestra la hora de captura
 * porque el modelo de la ronda no la trae.
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
  const { ronda, simulacion } = useStore();
  const pedidos = ronda.ronda.pedidos;
  // Con la bandera inactiva ningún panel lleva "Mismo cliente".
  const compartido = simulacion.mismoCliente ? clientesRepetidos(pedidos) : new Set<string>();

  return (
    <div className={styles.screen}>
      <AppHeader backLabel="Tareas" onBack={() => navigate('/tareas')} />
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
                  <span className={styles.texto} title={p.cliente.nombre}>
                    {p.cliente.nombre}
                  </span>
                  {compartido.has(p.cliente.id) && <span className={styles.badge}>Mismo cliente</span>}
                </div>
              </section>
            );
          })}
        </div>
      </ContentPanel>
      <BottomBar variant="footer">
        <Button variant="success" label="Iniciar surtido" className={styles.flex1} onClick={() => navigate('/surtido')} />
      </BottomBar>
    </div>
  );
}
