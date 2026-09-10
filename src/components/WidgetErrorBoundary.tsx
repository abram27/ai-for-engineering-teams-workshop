'use client';

import { Component, type ReactNode } from 'react';
import { logError, toUserMessage } from '@/lib/errors';

/** Metadata describing a widget registered inside a WidgetErrorBoundary region. */
export interface WidgetRegistration {
  name: string;
  ariaLabel: string;
  maxRetries?: number;
}

export interface WidgetErrorBoundaryProps {
  children: ReactNode;
  widget: WidgetRegistration;
  /** Called on every caught error, after logging, for orchestrator-level telemetry/live-region updates. */
  onWidgetError?: (widgetName: string, message: string) => void;
  /** Called whenever the widget is retried or manually reloaded. */
  onWidgetRetry?: (widgetName: string) => void;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  message: string | null;
  retryCount: number;
  remountKey: number;
}

const DEFAULT_MAX_RETRIES = 3;

function WidgetFallback({
  widgetName,
  message,
  canRetry,
  onRetry,
}: {
  widgetName: string;
  message: string;
  canRetry: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="w-full rounded-lg border border-gray-300 bg-gray-100 p-4 text-gray-700 shadow-sm sm:p-5"
    >
      <p className="text-sm font-medium">{widgetName} is unavailable</p>
      <p className="mt-1 text-sm">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-md border border-gray-400 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {canRetry ? 'Retry' : 'Reload widget'}
      </button>
    </div>
  );
}

/**
 * Wraps a single widget so its failures are isolated: sibling widgets, the
 * selector, and the rest of the dashboard stay fully interactive. Retries
 * are bounded (`maxRetries`); once exceeded, shows a persistent fallback
 * with a manual "reload widget" action that fully remounts the subtree.
 */
export default class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  state: WidgetErrorBoundaryState = {
    hasError: false,
    message: null,
    retryCount: 0,
    remountKey: 0,
  };

  static getDerivedStateFromError(): Partial<WidgetErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const message = toUserMessage(error, 'This widget failed to render.');
    logError({
      category: 'widget-render',
      widget: this.props.widget.name,
      message,
      timestamp: new Date().toISOString(),
    });
    this.setState({ hasError: true, message });
    this.props.onWidgetError?.(this.props.widget.name, message);
  }

  handleRetryOrReload = () => {
    const maxRetries = this.props.widget.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.setState((prev) => {
      const withinLimit = prev.retryCount < maxRetries;
      return {
        hasError: false,
        message: null,
        retryCount: withinLimit ? prev.retryCount + 1 : 0,
        remountKey: prev.remountKey + 1,
      };
    });
    this.props.onWidgetRetry?.(this.props.widget.name);
  };

  render() {
    const { widget, children } = this.props;
    const maxRetries = widget.maxRetries ?? DEFAULT_MAX_RETRIES;

    return (
      <section aria-label={widget.ariaLabel} className="w-full">
        {this.state.hasError ? (
          <WidgetFallback
            widgetName={widget.name}
            message={this.state.message ?? 'An unexpected error occurred.'}
            canRetry={this.state.retryCount < maxRetries}
            onRetry={this.handleRetryOrReload}
          />
        ) : (
          <div key={this.state.remountKey}>{children}</div>
        )}
      </section>
    );
  }
}
