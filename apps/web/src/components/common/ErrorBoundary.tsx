import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { reportClientError } from '@/lib/error-reporter';
import { ServerErrorPage } from './ServerErrorPage';


interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Kutilmagan interfeys xatosi:', error, info.componentStack);
    reportClientError({ kind: 'UI_CRASH', message: error.message, stack: error.stack, context: { componentStack: info.componentStack?.slice(0, 1500) } });
  }

  render() {
    if (this.state.error) {
      return <ServerErrorPage />;
    }
    return this.props.children;
  }
}
