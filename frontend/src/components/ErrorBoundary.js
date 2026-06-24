/**
 * ErrorBoundary — catches any render-time crash in the React tree and shows a
 * friendly, recoverable screen instead of a blank white page. It also surfaces
 * the underlying error (collapsible + copy button) so we can diagnose crashes
 * that only happen on a specific user's device (e.g. older iOS Safari).
 *
 * Intentionally dependency-light: it does NOT rely on react-router or i18next,
 * since those contexts may themselves be involved in the crash.
 */
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Keep a copy in the console for remote debugging.
    // eslint-disable-next-line no-console
    console.error("[UniTech ErrorBoundary]", error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = "/";
  };

  handleCopy = () => {
    const { error, info } = this.state;
    const text = [
      `Error: ${error?.message || error}`,
      error?.stack || "",
      info?.componentStack || "",
      `URL: ${window.location.href}`,
      `UA: ${navigator.userAgent}`,
    ].join("\n");
    try {
      navigator.clipboard?.writeText(text);
    } catch (e) { /* noop */ }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, info } = this.state;
    const detail = `${error?.message || error || "Error desconocido"}\n${
      error?.stack || ""
    }\n${info?.componentStack || ""}`;

    return (
      <div
        data-testid="error-boundary-screen"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#fafafa",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 30,
            }}
          >
            ⚠️
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#18181b",
              margin: "0 0 6px",
            }}
          >
            Algo salió mal
          </h1>
          <p style={{ color: "#71717a", fontSize: 14, margin: "0 0 20px" }}>
            Tuvimos un problema al mostrar esta pantalla. Puedes reintentar o
            volver al inicio. (Something went wrong.)
          </p>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              data-testid="error-boundary-retry"
              onClick={this.handleReset}
              style={btnPrimary}
            >
              Reintentar
            </button>
            <button
              data-testid="error-boundary-reload"
              onClick={this.handleReload}
              style={btnSecondary}
            >
              Recargar
            </button>
            <button
              data-testid="error-boundary-home"
              onClick={this.handleHome}
              style={btnSecondary}
            >
              Ir al inicio
            </button>
          </div>

          <details
            style={{
              marginTop: 24,
              textAlign: "left",
              background: "#fff",
              border: "1px solid #e4e4e7",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                color: "#a1a1aa",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Detalle del error
            </summary>
            <pre
              data-testid="error-boundary-detail"
              style={{
                marginTop: 10,
                fontSize: 11,
                color: "#52525b",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 220,
                overflow: "auto",
              }}
            >
              {detail}
            </pre>
            <button onClick={this.handleCopy} style={{ ...btnSecondary, marginTop: 8, fontSize: 12 }}>
              Copiar error
            </button>
          </details>
        </div>
      </div>
    );
  }
}

const btnBase = {
  border: "none",
  borderRadius: 12,
  padding: "11px 18px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  transition: "opacity .15s",
};
const btnPrimary = { ...btnBase, background: "#18181b", color: "#fff" };
const btnSecondary = {
  ...btnBase,
  background: "#fff",
  color: "#18181b",
  border: "1px solid #e4e4e7",
};
