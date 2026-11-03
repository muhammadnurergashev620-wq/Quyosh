import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { reportClientError } from '@/lib/error-reporter';
import './ErrorBoundary.css';
import { t } from '@/i18n';

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
      return (
        <div className="gm-error-boundary" role="alert">
          <h1>{t('Nimadir noto‘g‘ri ketdi')}</h1>
          <p>{t('Sahifani qayta yuklab ko‘ring. Muammo davom etsa, keyinroq qaytadan urinib ko‘ring.')}</p>
          <Button onClick={() => window.location.reload()}>{t('Sahifani qayta yuklash')}</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
