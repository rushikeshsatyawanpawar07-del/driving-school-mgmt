import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
          <h1 style={{ color: "#e74c3c", marginBottom: 16 }}>Something went wrong</h1>
          <p style={{ color: "#666", marginBottom: 24, maxWidth: 500, margin: "0 auto 24px" }}>
            The app encountered an error. Try clearing your browser cache and refreshing.
            If the problem persists, disable any ad blockers for this site.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{ padding: "10px 24px", background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16 }}
          >
            Refresh App
          </button>
          {this.state.error && (
            <details style={{ marginTop: 24, textAlign: "left", maxWidth: 600, margin: "24px auto" }}>
              <summary style={{ cursor: "pointer", color: "#999" }}>Error details</summary>
              <pre style={{ fontSize: 12, color: "#999", marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {this.state.error.stack || this.state.error.message || String(this.state.error)}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
