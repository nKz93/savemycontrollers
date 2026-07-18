// Genere docs/api/openapi.json a partir des decorateurs NestJS/Swagger,
// sans demarrer de serveur HTTP. Consomme ensuite par
// packages/api-client/scripts/generate.mjs (prochaine phase).
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { AppModule } from "../dist/app.module.js";

const app = await NestFactory.create(AppModule, { logger: false });
const config = new DocumentBuilder()
  .setTitle("SaveMyControllers API")
  .setVersion("0.1.0")
  .build();
const document = SwaggerModule.createDocument(app, config);

const outPath = "../../docs/api/openapi.json";
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(document, null, 2));
console.log(`OpenAPI genere: ${outPath}`);
await app.close();
