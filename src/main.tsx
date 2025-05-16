
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AUTH_CONFIG } from './config'

createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId={AUTH_CONFIG.GOOGLE_CLIENT_ID}>
    <App />
  </GoogleOAuthProvider>
);
