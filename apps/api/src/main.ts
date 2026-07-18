import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { HttpExceptionFilter } from "./modules/core/http/http-exception.filter.js";
import { validateEnv } from "./config/env.schema.js";
import { createCsrfProtection } from "./modules/core/security/csrf.js";
import { createOriginCheckMiddleware } from "./modules/core/security/origin-check.middleware.js";
import { correlationIdMiddleware } from "./modules/core/http/correlation-id.middleware.js";

async function bootstrap(): Promise<void> {
  // Valide l'environnement AVANT toute autre initialisation : l'application
  // ne doit jamais demarrer avec une configuration dangereuse (voir
  // config/env.schema.ts et ADR-018).
  const env = validateEnv();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const expressApp = app.getHttpAdapter().getInstance();

  // "trust proxy" n'est active qu'avec un nombre explicite de sauts de
  // proxy connus (reverse proxy interne / Cloudflare) — jamais une
  // confiance aveugle en X-Forwarded-For (voir section 8 du prompt).
  if (env.TRUSTED_PROXY_COUNT > 0) {
    expressApp.set("trust proxy", env.TRUSTED_PROXY_COUNT);
  }

  app.use(helmet());
  app.use(cookieParser());
  app.use(correlationIdMiddleware);

  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.use(createOriginCheckMiddleware(allowedOrigins));

  const { doubleCsrfProtection, generateToken } = createCsrfProtection(env.CSRF_SECRET);
  // Le token CSRF est expose via un endpoint dedie que le frontend appelle
  // au chargement pour obtenir son jeton avant tout POST/PUT/PATCH/DELETE.
  expressApp.get("/csrf-token", cookieParser(), (req: unknown, res: { setHeader: (k: string, v: string) => void; json: (body: unknown) => void }) => {
    res.setHeader("Cache-Control", "no-store");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.json({ csrfToken: generateToken(req as any, res as any) });
  });
  app.use(doubleCsrfProtection);

  // Aucune reponse liee a l'authentification ou aux jetons ne doit etre
  // mise en cache (par le navigateur ou un intermediaire) — voir section 7
  // du prompt de phase 2C.
  app.use((req: { path: string }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    if (req.path.startsWith("/auth") || req.path === "/csrf-token") {
      res.setHeader("Cache-Control", "no-store");
    }
    next();
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger desactive par defaut en production (voir section 9 du prompt) ;
  // reactivable derriere une authentification administrative si un besoin
  // operationnel l'exige (non fait ici pour rester dans le perimetre de
  // cette phase de stabilisation).
  if (env.NODE_ENV !== "production") {
    const openApiConfig = new DocumentBuilder()
      .setTitle("SaveMyControllers API")
      .setDescription("Contrat API du monolithe modulaire SaveMyControllers")
      .setVersion("0.1.0")
      .addCookieAuth("smc_access_token")
      .build();
    const document = SwaggerModule.createDocument(app, openApiConfig);
    SwaggerModule.setup("docs", app, document);
  }

  await app.listen(env.API_PORT);
   
  console.log(`API demarree sur http://localhost:${env.API_PORT}${env.NODE_ENV !== "production" ? " (documentation: /docs)" : ""}`);
}

bootstrap().catch((error) => {
   
  console.error("Echec du demarrage de l'API :", error instanceof Error ? error.message : error);
  process.exit(1);
});
