import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { reportClientError } from '@/lib/error-reporter';
import { t } from '@/i18n';
import './ErrorBoundary.css';

/** Sahifa ichida kutilmagan xato yuz berganda ko‘rsatiladi va «Errorlar» bo‘limiga yuboriladi. */
export function RouteError() {
  const error = useRouteError();
  useEffect(() => {
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Route error');
    reportClientError({ kind: 'UI_CRASH', message: err.message, stack: err.stack, context: { type: 'route' } });
  }, [error]);
  return (
    <div className="gm-error-boundary" role="alert">
      <h1>{t('Nimadir noto‘g‘ri ketdi')}</h1>
      <p>{t('Sahifani qayta yuklab ko‘ring. Muammo davom etsa, keyinroq qaytadan urinib ko‘ring.')}</p>
      <Button onClick={() => window.location.reload()}>{t('Sahifani qayta yuklash')}</Button>
    </div>
  );
}
