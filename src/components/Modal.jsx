import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ onClose, maxWidth = 520, children }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  )
}
