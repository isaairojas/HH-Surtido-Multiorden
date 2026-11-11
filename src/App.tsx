/**
 * Rutas del surtido multipedido V2.
 * Los modales no son rutas: viven como estado de la pantalla que los abre.
 *
 * Además de las pantallas de la HH, la demo tiene:
 * - `/surtido-anterior` y `/login`: pantallas de referencia a las que enruta la toma de tarea.
 * - `/armado/:id`: simulador del armado de la ronda (lógica del servidor), a todo el ancho y sin paneles.
 */
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AsignacionTareas } from './screens/tareas/AsignacionTareas';
import { DetalleRonda } from './screens/surtido/DetalleRonda';
import { SurtidoRonda } from './screens/surtido/SurtidoRonda';
import { DetalleProducto } from './screens/surtido/DetalleProducto';
import { InicioSesion, SurtidoAnterior } from './screens/referencia/PantallaReferencia';
import { ArmadoRonda } from './screens/armado/ArmadoRonda';
import { ToastHost } from './navigation/ToastHost';
import { VozHost } from './navigation/VozHost';
import { EscenariosPanel } from './navigation/EscenariosPanel';
import { CodigosCheatsheet } from './navigation/CodigosCheatsheet';

function ArmadoRuta() {
  const { id } = useParams();
  return <ArmadoRonda presetId={id} />;
}

export function App() {
  const { pathname } = useLocation();
  // El simulador del armado es una página aparte: ocupa todo el ancho y no lleva los paneles de la HH.
  if (pathname.startsWith('/armado')) {
    return (
      <Routes>
        <Route path="/armado/:id?" element={<ArmadoRuta />} />
      </Routes>
    );
  }
  // La hoja de códigos solo tiene sentido donde se escanea.
  const simulando = pathname === '/surtido' || pathname.startsWith('/detalle');

  return (
    <>
      <div className="app-frame">
        <Routes>
          <Route path="/tareas" element={<AsignacionTareas />} />
          <Route path="/ronda" element={<DetalleRonda />} />
          <Route path="/surtido" element={<SurtidoRonda />} />
          <Route path="/detalle/:codigo" element={<DetalleProducto />} />
          <Route path="/surtido-anterior" element={<SurtidoAnterior />} />
          <Route path="/login" element={<InicioSesion />} />
          <Route path="*" element={<Navigate to="/tareas" replace />} />
        </Routes>
        <ToastHost />
        <VozHost />
      </div>
      <EscenariosPanel />
      {simulando && <CodigosCheatsheet />}
    </>
  );
}
