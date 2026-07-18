import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Abstraction de stockage compatible S3 (MinIO en developpement).
 * Regle de securite : tous les fichiers sont ecrits dans un bucket prive.
 * Aucun fichier n'est jamais expose par une URL publique statique :
 * l'acces se fait exclusivement via une URL signee a duree limitee,
 * generee au moment de la consultation et journalisee si le fichier
 * est sensible (voir modules/files).
 */
export type FileVisibility = "PRIVATE" | "CLIENT" | "INTERNAL";

export interface StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024; // 15 Mo

export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle ?? true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async putObject(params: { key: string; body: Buffer; contentType: string }): Promise<void> {
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(params.contentType)) {
      throw new Error(`Type MIME non autorise: ${params.contentType}`);
    }
    if (params.body.byteLength > MAX_UPLOAD_SIZE_BYTES) {
      throw new Error("Fichier trop volumineux");
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
