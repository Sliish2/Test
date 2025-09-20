import React, { useEffect, useState } from "react";
import { onToast, dismiss } from "../lib/toast";

export default function Toaster() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const off = onToast(evt => {
      if (evt.type === "add") setToasts(prev => [...prev, evt.toast]);
      if (evt.type === "remove") setToasts(prev => prev.filter(t => t.id !== evt.id));
    });
    return off;
  }, []);

  return (
    <div className="toaster">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.type}`}>
          <div className="toast__content">
            <strong>{t.title}</strong>
            {t.message ? <div className="toast__msg">{t.message}</div> : null}
          </div>
          <button className="toast__close" onClick={() => dismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
