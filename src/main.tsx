import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '@fontsource/roboto/100.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/700.css';
import './styles/global.css';
import { App } from './App';
import { AppStoreProvider } from './store/AppStore';
import { semillaDesdeUrl } from './navigation/escenarios';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Rutas en el hash (#/surtido), como una sola página: el servidor siempre entrega index.html con
        200. Con rutas reales, GitHub Pages respondía 404 a /surtido, /tareas… y en celular y HH la
        app no cargaba. */}
    <HashRouter>
      <AppStoreProvider semilla={semillaDesdeUrl()}>
        <App />
      </AppStoreProvider>
    </HashRouter>
  </StrictMode>,
);
