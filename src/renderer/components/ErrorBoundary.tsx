import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleRestart = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="h-screen bg-popover rounded-xl overflow-hidden flex flex-col items-center justify-center p-6"
          role="alert"
          aria-labelledby="error-title"
          aria-describedby="error-description"
        >
          <div className="popover-arrow" aria-hidden="true" />

          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h1
            id="error-title"
            className="text-lg font-medium text-theme-primary mb-2"
          >
            Something went wrong
          </h1>

          <p
            id="error-description"
            className="text-sm text-theme-tertiary text-center mb-4 max-w-xs"
          >
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>

          <button
            onClick={this.handleRestart}
            className="px-4 py-2 btn-macos btn-macos-primary text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ring-offset-theme"
            aria-label="Restart application"
          >
            Restart
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
