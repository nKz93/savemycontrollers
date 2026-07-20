import "reflect-metadata";
import { randomUUID } from "node:crypto";
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
    // BUG REEL CORRIGE : generateToken(req, res) sans troisieme argument
    // REUTILISE le cookie CSRF existant s'il y en a deja un
    // (overwrite=false par defaut dans csrf-csrf), meme si l'identifiant
    // de session a change entre-temps (ex. connexion : l'identifiant
    // passe de "anonymous" au JWT de l'utilisateur — voir
    // getSessionIdentifier dans csrf.ts). Le cookie restait alors lie a
    // l'ancienne session tandis que le jeton retourne dans la reponse
    // etait calcule pour la nouvelle, causant un 403 CSRF_TOKEN_INVALID
    // des la premiere requete mutante suivant une connexion — trouve par
    // la CI E2E reelle (le seul type de test qui rejoue un vrai
    // enchainement connexion -> action mutante avec un vrai navigateur et
    // de vrais cookies). overwrite=true force la regeneration du cookie
    // a chaque appel, garantissant qu'il correspond toujours a la
    // session courante.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.json({ csrfToken: generateToken(req as any, res as any, true) });
  });
  app.use(doubleCsrfProtection);
  // BUG REEL CORRIGE : doubleCsrfProtection est un middleware Express brut,
  // enregistre AVANT que NestJS ne prenne la main sur la requete. Les
  // erreurs qu'il leve (jeton CSRF manquant ou invalide) ne passent donc
  // JAMAIS par HttpExceptionFilter (qui ne s'applique qu'au pipeline
  // NestJS lui-meme) : sans ce gestionnaire d'erreur Express dedie, une
  // requete mutante sans jeton CSRF valide remontait comme une erreur 500
  // non structuree plutot qu'un 403 clair — verifie par un test E2E reel
  // contre l'API reelle (voir tests/e2e/playwright).
  app.use((err: unknown, req: { headers: Record<string, string | string[] | undefined> }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: (err?: unknown) => void) => {
    // csrf-csrf leve une erreur http-errors avec le code exact
    // "EBADCSRFTOKEN" (voir node_modules/csrf-csrf) : verification precise,
    // pas une correspondance approximative sur le message ou le nom
    // generique de la classe d'erreur (qui pourrait entrer en collision
    // avec d'autres 403 legitimes ailleurs dans l'application).
    const isCsrfError = typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "EBADCSRFTOKEN";
    if (!isCsrfError) {
      next(err);
      return;
    }
    const correlationId = (req.headers["x-correlation-id"] as string | undefined) ?? randomUUID();
    res.status(403).json({
      error: {
        code: "CSRF_TOKEN_INVALID",
        message: "Jeton CSRF manquant ou invalide.",
        correlationId,
      },
    });
  });

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
