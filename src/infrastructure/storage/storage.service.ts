import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: S3Client;
  private bucket!: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.bucket = this.config.getOrThrow<string>('storage.bucket');
    const endpoint = this.config.get<string>('storage.endpoint');
    this.client = new S3Client({
      region: this.config.getOrThrow<string>('storage.region'),
      endpoint: endpoint || undefined,
      forcePathStyle: this.config.get<boolean>('storage.forcePathStyle'),
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('storage.accessKeyId'),
        secretAccessKey: this.config.getOrThrow<string>('storage.secretAccessKey'),
      },
    });
    await this.ensureBucket();
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`${this.bucket} saqlash bucketi yaratildi`);
      } catch (error) {
        this.logger.warn(
          `${this.bucket} bucketini tekshirib/yaratib bo‘lmadi (davom etilyapti): ${(error as Error).message}`,
        );
      }
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  /** Faylni (ixtiyoriy Range bilan) oqim sifatida qaytaradi — API orqali uzatish uchun. */
  async getObjectStream(key: string, range?: string) {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range }));
    return {
      body: result.Body as NodeJS.ReadableStream,
      contentLength: result.ContentLength,
      contentRange: result.ContentRange,
      contentType: result.ContentType,
    };
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getSignedGetUrl(
    key: string,
    ttlSeconds: number,
    options?: { contentType?: string; downloadFilename?: string },
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentType: options?.contentType,
      ResponseContentDisposition: options?.downloadFilename
        ? `inline; filename="${options.downloadFilename.replace(/["\\]/g, '')}"`
        : undefined,
    });
    return getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
  }
}
