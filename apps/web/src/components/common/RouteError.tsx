import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { reportClientError } from '@/lib/error-reporter';
import { ServerErrorPage } from './ServerErrorPage';

/** Sahifa ichida kutilmagan xato yuz berganda ko‘rsatiladi va «Errorlar» bo‘limiga yuboriladi. */
export function RouteError() {
  const error = useRouteError();
  useEffect(() => {
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Route error');
    reportClientError({ kind: 'UI_CRASH', message: err.message, stack: err.stack, context: { type: 'route' } });
  }, [error]);
  return <ServerErrorPage />;
}
