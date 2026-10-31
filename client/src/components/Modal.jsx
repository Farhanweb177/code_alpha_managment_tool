import { useEffect, useRef } from 'react';
import { X } from './Icons';

export default function Modal({ title, ariaLabel, onClose, children, wide }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const fn = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', fn);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal ${wide ? 'modal-wide' : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title || 'Dialog'}
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="modal-head">
          {title ? <h2>{title}</h2> : <span className="sr-only">{ariaLabel || 'Dialog'}</span>}
          <button className="icon-btn" onClick={onClose} title="Close" aria-label="Close dialog">
            <X size={17} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
