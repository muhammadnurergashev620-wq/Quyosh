import 'reflect-metadata';
import { setDefaultResultOrder } from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ErrorLogService } from './modules/error-log/error-log.service';
import { TelegramAlertService } from './infrastructure/telegram/telegram-alert.service';

setDefaultResultOrder('ipv4first');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(new Logger());
  configureApp(app);
  const alerts = app.get(TelegramAlertService);
  const errorLog = app.get(ErrorLogService);
  app.useGlobalFilters(new AllExceptionsFilter([alerts, errorLog]));

  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    Logger.error(`Ushlanmagan promise xatosi: ${error.message}`, error.stack);
    alerts.notifyError({ status: 500, code: 'UNHANDLED_REJECTION', message: error.message, stack: error.stack });
    errorLog.notifyError({ status: 500, code: 'UNHANDLED_REJECTION', message: error.message, stack: error.stack });
  });
  process.on('uncaughtException', (error) => {
    Logger.error(`Ushlanmagan xatolik: ${error.message}`, error.stack);
    alerts.notifyError({ status: 500, code: 'UNCAUGHT_EXCEPTION', message: error.message, stack: error.stack });
    errorLog.notifyError({ status: 500, code: 'UNCAUGHT_EXCEPTION', message: error.message, stack: error.stack });
    setTimeout(() => process.exit(1), 2_000).unref();
  });

  const port = app.get(ConfigService).get<number>('app.port', 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
