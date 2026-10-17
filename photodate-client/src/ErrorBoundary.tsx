import React from "react";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            color: "var(--c-text-hi)",
            padding: "32px",
            backgroundColor: "var(--c-surface-1)",
            minHeight: "50vh",
            overflow: "auto",
          }}
        >
          <h2>We couldn’t display this page.</h2>
          <p>
            Reload to reconnect to your session. If the problem continues,
            return to the home page.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload session
          </button>{" "}
          <a href="/">Return home</a>
          {import.meta.env.DEV && (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: "12px",
              }}
            >
              {this.state.error?.stack ?? this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
