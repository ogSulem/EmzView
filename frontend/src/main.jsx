import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './ui/App.jsx';
import { ErrorBoundary } from './ui/components/ErrorBoundary.jsx';
import { Toasts } from './ui/components/Toasts.jsx';
import './ui/styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <Toasts />
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
