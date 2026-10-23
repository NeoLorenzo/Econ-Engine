import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LifePage from './LifePage'
import '../styles/app.css'
import './life.css'
import './valley.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LifePage />
  </StrictMode>,
)
