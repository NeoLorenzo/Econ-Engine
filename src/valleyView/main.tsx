import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ValleyApp from './ValleyApp'
import '../styles/app.css'
import './life.css'
import './valley.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ValleyApp />
  </StrictMode>,
)
