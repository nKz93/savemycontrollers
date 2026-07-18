import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { StorageService, ALLOWED_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES } from "@smc/storage";
import { FileRepository } from "../repositories/file.repository.js";
import { ForbiddenDomainError, NotFoundDomainError, ValidationDomainError } from "../../core/errors/domain-error.js";
import type { FileVisibility, FileRelatedEntityType } from "@smc/database";

// `file-type` est un module ESM pur ; ce paquet est compile en CommonJS
// (voir apps/api/tsconfig.json), d'ou l'import dynamique plutot qu'un
// import statique (qui echouerait a l'execution sous CommonJS).
async function detectRealMimeType(buffer: Buffer): Promise<string | undefined> {
  const { fileTypeFromBuffer } = await import("file-type");
  const result = await fileTypeFromBuffer(buffer);
  return result?.mime;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Toute regle de securite fichier (taille, type reel par signature
 * binaire, visibilite, URL signee, controle d'acces) transite
 * exclusivement par ce service. Aucun controleur ne doit ecrire
 * directement dans le stockage (voir ADR-023).
 */
@Injectable()
export class FileService {
  private readonly storage: StorageService;

  constructor(private readonly files: FileRepository) {
    this.storage = new StorageService({
      endpoint: process.env.STORAGE_ENDPOINT ?? "http://localhost:9000",
      region: process.env.STORAGE_REGION ?? "eu-west-3",
      bucket: process.env.STORAGE_BUCKET ?? "smc-dev",
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? "",
    });
  }

  async upload(input: {
    buffer: Buffer;
    originalFileName: string;
    declaredMimeType: string; // fourni par le navigateur : jamais utilise pour decider, uniquement journalise pour detection d'anomalie
    visibility: FileVisibility;
    uploadedByUserId?: string;
    relatedEntityType?: FileRelatedEntityType;
    relatedEntityId?: string;
  }) {
    if (input.buffer.byteLength > MAX_UPLOAD_SIZE_BYTES) {
      throw new ValidationDomainError("Fichier trop volumineux.");
    }
    if (input.buffer.byteLength === 0) {
      throw new ValidationDomainError("Fichier vide.");
    }

    // Le type MIME declare par le navigateur n'est JAMAIS une source de
    // verite (voir section 20 du prompt) : seule la signature binaire
    // reelle du contenu determine le type accepte.
    const realMimeType = await detectRealMimeType(input.buffer);
    if (!realMimeType || !(ALLOWED_MIME_TYPES as readonly string[]).includes(realMimeType)) {
      throw new ValidationDomainError("Type de fichier non autorise ou signature binaire non reconnue.");
    }
    if (input.declaredMimeType && input.declaredMimeType !== realMimeType) {
      // Incoherence entre l'extension/type declare et le contenu reel :
      // rejete plutot que "corrige silencieusement", pour ne jamais
      // masquer une tentative de contournement.
      throw new ValidationDomainError("Le type de fichier declare ne correspond pas au contenu reel du fichier.");
    }

    // La cle S3 ne contient jamais le nom brut fourni par l'utilisateur
    // (risque d'injection de chemin, de caracteres de controle, ou de
    // fuite d'information) : uniquement un UUID et une extension deduite
    // du type reel detecte. Le nom d'origine est conserve separement en
    // base pour l'affichage (Content-Disposition a la lecture).
    const extension = EXTENSION_BY_MIME[realMimeType] ?? "bin";
    const storageKey = `${input.relatedEntityType ?? "misc"}/${randomUUID()}.${extension}`;

    await this.storage.putObject({ key: storageKey, body: input.buffer, contentType: realMimeType });

    // Point d'integration pret pour une analyse antivirus asynchrone
    // (ClamAV ou service externe) : non implementee dans cette phase, le
    // fichier est actuellement considere disponible immediatement apres
    // upload. Une extension future pourra inserer ici un statut
    // "PENDING_SCAN" bloquant la delivrance de l'URL signee tant que
    // l'analyse n'est pas terminee.
    return this.files.create({
      storageKey,
      originalFileName: sanitizeDisplayFileName(input.originalFileName),
      mimeType: realMimeType,
      sizeBytes: input.buffer.byteLength,
      visibility: input.visibility,
      uploadedByUserId: input.uploadedByUserId,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
    });
  }

  /**
   * Une URL signee n'est jamais generee sans verifier le contexte
   * d'acces : visibilite du fichier, propriete, et permission staff pour
   * les fichiers internes (voir section 20 du prompt — l'ancienne
   * signature `getSignedUrl(fileId)` sans contexte utilisateur est
   * supprimee).
   */
  async getSignedUrlForActor(
    fileId: string,
    actor: { userId?: string; isStaffWithAccess: boolean },
  ): Promise<{ url: string; downloadFileName: string }> {
    const file = await this.files.findById(fileId);
    if (!file) throw new NotFoundDomainError("Fichier introuvable.");

    const isOwner = actor.userId && file.uploadedByUserId === actor.userId;
    const allowed =
      file.visibility === "CLIENT"
        ? Boolean(isOwner) || actor.isStaffWithAccess
        : file.visibility === "INTERNAL"
          ? actor.isStaffWithAccess
          : file.visibility === "PRIVATE"
            ? Boolean(isOwner) || actor.isStaffWithAccess
            : false;

    if (!allowed) {
      throw new ForbiddenDomainError("Acces refuse a ce fichier.");
    }

    const url = await this.storage.getSignedDownloadUrl(file.storageKey, 300);
    return { url, downloadFileName: file.originalFileName };
  }
}

function sanitizeDisplayFileName(rawName: string): string {
  // Conserve uniquement des caracteres surs pour un affichage/En-tete
  // Content-Disposition ulterieur ; tronque a une longueur raisonnable.
  const stripped = rawName.replace(/[^\p{L}\p{N}\-_. ]/gu, "_").slice(0, 180);
  return stripped.length > 0 ? stripped : "fichier";
}
