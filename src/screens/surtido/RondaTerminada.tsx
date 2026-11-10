/**
 * Pantalla final de la ronda (FR-020).
 * Réplica funcional de "¡Surtido completado!" de Revision-HH-v2, adaptada a la ronda:
 * en vez de un pedido se resumen los N pedidos y los productos únicos de toda la ronda.
 * No tiene respaldo en Figma (ver FIGMA_REPLICA.md): se compone con tokens y organismos existentes.
 *
 * SDD 2026-10-26-multiorden-surtido-listado · Finalizar el surtido del pedido: se llega aquí después de confirmar,
 * registrar cada pedido y guardar la ronda una vez; muestra "¡Se completó la ronda de surtido exitosamente!"
 * (texto de hoy) y regresa al menú.
 *
 * Antes de esta pantalla:
 *   - SDD 2026-10-26-multiorden-surtido-listado · Sacar el pedido de la ronda: corporativo incompleto al
 *     finalizar → se ofrece sacarlo; se vuelve al listado sin él y con los totales recalculados.
 *
 * Después: la revisión, la facturación y el embarque siguen como hoy. Los del multi-orden se trabajarán
 * después de la liberación de los cambios de Víctor Limón (decisión del 2026-11-10).
 */
import { useNavigate } from 'react-router-dom';
import completadoIcon from '@assets/icons/estado-completado.svg';
import negadoIcon from '@assets/icons/block.svg';
import parcialIcon from '@assets/icons/estado-parcial.svg';
import { AppHeader } from '@ds/components/organisms/AppHeader/AppHeader';
import { ContentPanel } from '@ds/components/organisms/ContentPanel/ContentPanel';
import { BottomBar } from '@ds/components/organisms/BottomBar/BottomBar';
import { Button } from '@ds/components/atoms/Button/Button';
import { Chip } from '@ds/components/atoms/Chip/Chip';
import { Divider } from '@ds/components/atoms/Divider/Divider';
import { conteosRonda, hayCodigosSinSurtir, pedidoCompleto, statusPartida } from '../../domain/ronda';
import { useStore } from '../../store/AppStore';
import styles from './RondaTerminada.module.css';

export function RondaTerminada() {
  const navigate = useNavigate();
  const { ronda, dispatch, setEtapa, setUltimoEscaneo, tareaOriginal } = useStore();
  const c = conteosRonda(ronda.ronda);
  const pedidos = ronda.ronda.pedidos;
  // Se llega aquí al finalizar, también con parciales confirmados (el aviso de parciales es la confirmación,
  // clarify del 2026-11-09): eso ya es surtido finalizado. Solo una entrada directa por URL con códigos en 0
  // sin negar muestra la ronda con pendientes.
  const completa = !hayCodigosSinSurtir(ronda.ronda);

  const volverAlMenu = () => {
    // La ronda queda cerrada: en la demo, la bandeja vuelve a ofrecer la misma tarea tal como llegó.
    dispatch({ type: 'cargar', estado: tareaOriginal });
    // La ronda nueva arranca sin pedido marcado.
    setUltimoEscaneo(null);
    setEtapa('tareas');
    navigate('/tareas');
  };

  return (
    <div className={styles.screen}>
      <AppHeader showBack={false} />
      <ContentPanel title="Ronda terminada" bottom={124} scroll>
        <div className={styles.body}>
          <div className={`${styles.hero} ${completa ? '' : styles.heroPendiente}`}>
            <img src={completa ? completadoIcon : parcialIcon} alt="" width={48} height={48} />
            <p className={styles.heroTitulo}>{completa ? 'Surtido finalizado' : 'Ronda con pendientes'}</p>
            <p className={styles.heroTexto}>
              {completa ? (
                <>
                  ¡Se completó la ronda de surtido exitosamente!
                  <br />
                  {pedidos.length === 1 ? (
                    <>
                      Se registró el pedido <b>{pedidos[0].id}</b>.
                    </>
                  ) : (
                    <>
                      Se registraron los {pedidos.length} pedidos de la ronda <b>{ronda.ronda.id}</b>.
                    </>
                  )}
                </>
              ) : (
                <>
                  La ronda <b>{ronda.ronda.id}</b> todavía tiene partidas sin surtir ni negar.
                </>
              )}
            </p>
          </div>

          <div className={styles.resumen}>
            <Resumen icono={completadoIcon} valor={c.completado} etiqueta="Completados" />
            <Resumen icono={negadoIcon} valor={c.negado} etiqueta="Negados" />
            <Resumen icono={parcialIcon} valor={c.parcial} etiqueta="Parciales" />
          </div>

          <div className={styles.pedidos}>
            <p className={styles.pedidosTitulo}>Pedidos de la ronda</p>
            <Divider variant="modal" />
            <ul className={styles.pedidosLista}>
              {pedidos.map((p, idx) => {
                const surtido = p.partidas.filter((x) => statusPartida(x) === 'completado').length;
                return (
                  <li key={p.id} className={styles.pedidoItem}>
                    <div className={styles.pedidoInfo}>
                      <span className={styles.pedidoId}>
                        {idx + 1}. Pedido {p.id}
                      </span>
                      <p className={styles.pedidoCliente} title={p.cliente.nombre}>
                        {p.cliente.nombre}
                      </p>
                    </div>
                    <Chip
                      status={pedidoCompleto(p) ? 'completado' : 'parcial'}
                      value={surtido}
                      total={p.partidas.length}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </ContentPanel>

      <BottomBar variant="exit">
        <Button variant="default" label="Volver al menú" className={styles.full} onClick={volverAlMenu} />
      </BottomBar>
    </div>
  );
}

function Resumen({ icono, valor, etiqueta }: { icono: string; valor: number; etiqueta: string }) {
  return (
    <div className={styles.resumenCol}>
      <img src={icono} alt="" width={28.846} height={28.846} />
      <b className={styles.resumenValor}>{valor}</b>
      <span className={styles.resumenEtiqueta}>{etiqueta}</span>
    </div>
  );
}
