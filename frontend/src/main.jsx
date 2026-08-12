import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)

// Splash #root dışında bağımsız bir düğüm; React ondan sorumlu değil.
// Uygulama mount olduktan sonra elle kaldırılır.
document.getElementById('splash')?.remove()
