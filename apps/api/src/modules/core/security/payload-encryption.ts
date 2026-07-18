/**
 * Reexport du chiffrement applicatif partage (voir @smc/crypto), pour que
 * les modules de l'API importent depuis un chemin interne stable meme si
 * l'implementation partagee evolue.
 */
export { encryptSensitiveValue, decryptSensitiveValue, type EncryptedPayload } from "@smc/crypto";
