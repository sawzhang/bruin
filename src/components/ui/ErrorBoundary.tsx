import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-bear-text-muted p-4">
          <p className="text-[14px] font-medium text-bear-text">
            {this.props.fallbackMessage ?? "Something went wrong"}
          </p>
          <p className="text-[12px] max-w-[300px] text-center">
            {this.state.error?.message}
          </p>
          <button
            onClick={this.handleRetry}
            className="text-[12px] px-3 py-1.5 rounded border border-bear-border text-bear-text-secondary hover:bg-bear-hover transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
