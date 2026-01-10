"use client";

import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>
        Sentry Example Page
      </h1>
      <p style={{ color: '#666', marginBottom: '24px', textAlign: 'center' }}>
        Haz clic en el botón para probar que Sentry está funcionando correctamente.
      </p>
      <button
        onClick={() => {
          throw new Error("Sentry Example Frontend Error - Test desde vence.es");
        }}
        style={{
          padding: '12px 24px',
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '16px',
          marginBottom: '12px',
        }}
      >
        Lanzar Error de Cliente
      </button>
      <button
        onClick={async () => {
          await Sentry.startSpan({
            name: 'Example Frontend Span',
            op: 'test'
          }, async () => {
            const res = await fetch("/api/sentry-example-api");
            if (!res.ok) {
              throw new Error("Sentry Example API Error");
            }
          });
        }}
        style={{
          padding: '12px 24px',
          backgroundColor: '#f59e0b',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '16px',
        }}
      >
        Lanzar Error de API
      </button>
      <p style={{ marginTop: '24px', fontSize: '14px', color: '#999' }}>
        Después de probar, elimina esta página y la API de ejemplo.
      </p>
    </div>
  );
}
