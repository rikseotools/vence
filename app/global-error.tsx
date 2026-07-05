"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El root layout ha reventado → el SDK de observabilidad puede no estar
    // activo aquí. Enviamos DIRECTO a /api/observability/ingest por sendBeacon
    // (sobrevive a la navegación y no depende del SDK). Último recurso.
    try {
      const payload = JSON.stringify({
        events: [
          {
            ts: new Date().toISOString(),
            source: "frontend",
            severity: "error",
            eventType: "react_error_boundary",
            endpoint:
              typeof window !== "undefined" ? window.location.pathname : null,
            errorMessage: (error?.message || "global error").slice(0, 500),
            metadata: {
              boundary: "global_error_tsx",
              digest: error?.digest ?? null,
              stack: (error?.stack || "").slice(0, 2000),
            },
          },
        ],
      });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/observability/ingest", payload);
      } else {
        fetch("/api/observability/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // nunca romper el boundary
    }
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#f5f5f5',
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px', color: '#333' }}>
            Algo salió mal
          </h1>
          <p style={{ color: '#666', marginBottom: '24px', textAlign: 'center' }}>
            Ha ocurrido un error inesperado. Nuestro equipo ha sido notificado.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  );
}
