import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LifeApp from './LifeApp'
import '../styles/app.css'
import './life.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LifeApp />
  </StrictMode>,
)
