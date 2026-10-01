import { Component, type ReactNode, type ErrorInfo } from "react";
import { ErrorState } from "./States";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="auth-single" style={{ padding: "40px 20px" }}>
          <div className="panel" style={{ maxWidth: "500px", margin: "auto" }}>
            <h2>Ocurrió un problema inesperado</h2>
            <ErrorState
              message={
                this.state.error?.message ||
                "Se produjo un error al cargar este componente en tu dispositivo."
              }
              retry={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
