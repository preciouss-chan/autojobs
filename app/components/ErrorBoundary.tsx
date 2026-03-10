"use client";

import React, { ReactNode, ReactElement } from "react";

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback?: (error: Error, reset: () => void) => ReactElement;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: Error | null;
}

/**
 * Error Boundary component to catch and display errors gracefully
 * Falls back to a default error UI if no custom fallback is provided
 * 
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * 
 * Or with custom fallback:
 * <ErrorBoundary fallback={(error, reset) => <CustomErrorUI error={error} onRetry={reset} />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("Error caught by ErrorBoundary:", error);
    console.error("Error info:", errorInfo);
  }

  private resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactElement {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-600 text-center mb-4">
              An unexpected error occurred. Try refreshing the page or contact
              support if the problem persists.
            </p>
            {process.env.NODE_ENV === "development" && (
              <div className="mb-4 p-4 bg-gray-100 rounded border border-gray-300">
                <p className="text-xs font-mono text-gray-700 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={this.resetError}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children as ReactElement;
  }
}
