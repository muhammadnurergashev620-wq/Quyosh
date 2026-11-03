import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

interface EmitParams {
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  createdById?: string;
}

@Injectable()
export class OutboxService {
  async emit(tx: Prisma.TransactionClient, params: EmitParams): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        eventName: params.eventName,
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        payload: params.payload as Prisma.InputJsonValue,
        createdById: params.createdById,
        status: 'PENDING',
      },
    });
  }
}
