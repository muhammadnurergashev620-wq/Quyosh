import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FcmTransport } from './fcm.transport';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PUSH_TRANSPORT } from './push.transport';

@Global()
@Module({
  controllers: [PushController],
  providers: [
    {
      provide: PUSH_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => FcmTransport.create({ path: config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH'), json: config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON') }),
    },
    PushService,
  ],
  exports: [PushService],
})
export class PushModule {}
