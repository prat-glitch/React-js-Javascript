import React from 'react'

window.deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPrompt = e;
});
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import 'react-toastify/dist/ReactToastify.css'
import { BrowserRouter } from 'react-router-dom'
import Appcontextprovider from './context/Appcontext.jsx'
import { CallProvider } from './context/Callcontext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Appcontextprovider>
      <CallProvider>
        <App />
      </CallProvider>
    </Appcontextprovider>
  </BrowserRouter>,
)
