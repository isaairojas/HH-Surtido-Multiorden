/**
 * Rutas del surtido multi-orden.
 * Los modales no son rutas: viven como estado de la pantalla que los abre.
 */
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AsignacionTareas } from './screens/tareas/AsignacionTareas';
import { DetalleRonda } from './screens/surtido/DetalleRonda';
import { SurtidoRonda } from './screens/surtido/SurtidoRonda';
import { DetalleProducto } from './screens/surtido/DetalleProducto';
import { RondaTerminada } from './screens/surtido/RondaTerminada';
import { ToastHost } from './navigation/ToastHost';
import { EscenariosPanel } from './navigation/EscenariosPanel';
import { CodigosCheatsheet } from './navigation/CodigosCheatsheet';

export function App() {
  // La hoja de códigos solo tiene sentido donde se escanea.
  const { pathname } = useLocation();
  const simulando = pathname.startsWith('/surtido') || pathname.startsWith('/detalle');

  return (
    <>
      <div className="app-frame">
        <Routes>
          <Route path="/tareas" element={<AsignacionTareas />} />
          <Route path="/ronda" element={<DetalleRonda />} />
          <Route path="/surtido" element={<SurtidoRonda />} />
          <Route path="/detalle/:codigo" element={<DetalleProducto />} />
          <Route path="/ronda-terminada" element={<RondaTerminada />} />
          <Route path="*" element={<Navigate to="/tareas" replace />} />
        </Routes>
        <ToastHost />
      </div>
      <EscenariosPanel />
      {simulando && <CodigosCheatsheet />}
    </>
  );
}
