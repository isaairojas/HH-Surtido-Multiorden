import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/roboto/100.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/700.css';
import './styles/global.css';
import { App } from './App';
import { AppStoreProvider } from './store/AppStore';
import { semillaDesdeUrl } from './navigation/escenarios';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppStoreProvider semilla={semillaDesdeUrl()}>
        <App />
      </AppStoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
