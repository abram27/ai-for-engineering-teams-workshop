'use client';

import { Component, type ReactNode } from 'react';
import { logError, toUserMessage } from '@/lib/errors';

export interface DashboardErrorBoundaryProps {
  children: ReactNode;
}

interface DashboardErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

/**
 * Top-level, application-wide error boundary. Catches any unhandled render
 * error that escapes the per-widget `WidgetErrorBoundary` layer and shows a
 * full-page fallback with a retry action, rather than crashing the app.
 */
export default class DashboardErrorBoundary extends Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  state: DashboardErrorBoundaryState = { hasError: false, message: null };

  static getDerivedStateFromError(): Partial<DashboardErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const message = toUserMessage(error, 'The dashboard encountered an unexpected error.');
    logError({
      category: 'widget-render',
      widget: 'dashboard-root',
      message,
      timestamp: new Date().toISOString(),
    });
    this.setState({ hasError: true, message });
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center"
        >
          <h1 className="text-xl font-semibold text-gray-900">Dashboard unavailable</h1>
          <p className="max-w-md text-sm text-gray-600">
            {this.state.message ?? 'Something went wrong loading the dashboard.'}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
