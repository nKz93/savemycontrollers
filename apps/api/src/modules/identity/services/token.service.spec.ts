process.env.ACCESS_TOKEN_SECRET ??= "test-only-access-token-secret-not-for-production-use";

import { TokenService } from "./token.service.js";

describe("TokenService", () => {
  const service = new TokenService();

  it("signe puis verifie un access token valide", () => {
    const token = service.signAccessToken({ sub: "user-1", accountType: "INDIVIDUAL" });
    const claims = service.verifyAccessToken(token);
    expect(claims.sub).toBe("user-1");
    expect(claims.accountType).toBe("INDIVIDUAL");
  });

  it("rejette un token altere", () => {
    const token = service.signAccessToken({ sub: "user-1", accountType: "INDIVIDUAL" });
    expect(() => service.verifyAccessToken(token + "tampered")).toThrow();
  });

  it("genere des jetons opaques distincts a chaque appel", () => {
    const a = service.generateOpaqueToken();
    const b = service.generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });

  it("le hash d'un jeton opaque est deterministe et non reversible visuellement", () => {
    const raw = service.generateOpaqueToken();
    const hash1 = service.hashOpaqueToken(raw);
    const hash2 = service.hashOpaqueToken(raw);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(raw);
  });
});
