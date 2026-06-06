"use client";

import React, { ReactNode, ReactElement } from "react";

interface FormErrorBoundaryProps {
  readonly children: ReactNode;
  readonly onError?: (error: Error) => void;
}

interface FormErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: Error | null;
  readonly errorCount: number;
}

/**
 * Specialized Error Boundary for form operations
 * Catches errors from API calls, file uploads, and form submissions
 * Displays user-friendly error messages
 */
export default class FormErrorBoundary extends React.Component<
  FormErrorBoundaryProps,
  FormErrorBoundaryState
> {
  constructor(props: FormErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<FormErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const newErrorCount = this.state.errorCount + 1;
    this.setState({ errorCount: newErrorCount });

    console.error("Form operation error:", error);
    console.error("Error info:", errorInfo);

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error);
    }

    // If too many errors, could implement auto-recovery or refresh
    if (newErrorCount > 5) {
      console.warn(
        "Too many errors detected. Consider page refresh or contacting support."
      );
    }
  }

  private resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactElement {
    if (this.state.hasError && this.state.error) {
      const isNetworkError =
        this.state.error.message.includes("fetch") ||
        this.state.error.message.includes("network");

      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800">
                {isNetworkError ? "Network Error" : "Operation Failed"}
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                {isNetworkError
                  ? "Unable to reach the server. Please check your connection and try again."
                  : "An error occurred during this operation. Please try again."}
              </p>
              {process.env.NODE_ENV === "development" && (
                <p className="text-xs text-yellow-600 mt-2 font-mono break-all">
                  {this.state.error.message}
                </p>
              )}
              <button
                type="button"
                onClick={this.resetError}
                className="mt-3 text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
              >
                Dismiss and try again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children as ReactElement;
  }
}
