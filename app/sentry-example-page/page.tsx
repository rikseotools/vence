"use client";

import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  const handleClientError = () => {
    try {
      // Esto lanzará un error que Sentry capturará
      throw new Error("Sentry Test Error - Cliente vence.es");
    } catch (error) {
      Sentry.captureException(error);
      alert("Error enviado a Sentry. Revisa el dashboard.");
    }
  };

  const handleApiError = async () => {
    try {
      const res = await fetch("/api/sentry-example-api");
      if (!res.ok) {
        throw new Error("API returned error");
      }
    } catch (error) {
      Sentry.captureException(error);
      alert("Error de API enviado a Sentry. Revisa el dashboard.");
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#f9fafb',
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '16px', color: '#111' }}>
        Sentry Test Page
      </h1>
      <p style={{ color: '#666', marginBottom: '24px', textAlign: 'center', maxWidth: '400px' }}>
        Haz clic en los botones para enviar errores de prueba a Sentry.
      </p>

      <button
        type="button"
        onClick={handleClientError}
        style={{
          padding: '12px 24px',
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '16px',
          marginBottom: '12px',
          fontWeight: '500',
        }}
      >
        Enviar Error de Cliente
      </button>

      <button
        type="button"
        onClick={handleApiError}
        style={{
          padding: '12px 24px',
          backgroundColor: '#f59e0b',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: '500',
        }}
      >
        Enviar Error de API
      </button>

      <p style={{ marginTop: '24px', fontSize: '14px', color: '#999' }}>
        Los errores aparecerán en Sentry → Issues
      </p>
    </div>
  );
}
