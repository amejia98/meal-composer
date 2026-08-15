import { useEffect, useRef, useState } from 'react';
import { subscribeToast } from './toastBus';

export function Toast() {
  const [message, setMessage] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => subscribeToast((m) => {
    setMessage(m);
    setShow(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(false), 2100);
  }), []);

  return (
    <div className={`toast${show ? ' show' : ''}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
