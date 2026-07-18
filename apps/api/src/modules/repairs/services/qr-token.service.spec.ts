import { QrTokenService } from "./qr-token.service.js";

describe("QrTokenService", () => {
  const service = new QrTokenService();

  it("genere un jeton opaque distinct de son hash", () => {
    const { rawToken, tokenHash } = service.generate();
    expect(rawToken).not.toBe(tokenHash);
    expect(service.hash(rawToken)).toBe(tokenHash);
  });

  it("deux jetons generes successivement sont distincts (non predictibles)", () => {
    const a = service.generate();
    const b = service.generate();
    expect(a.rawToken).not.toBe(b.rawToken);
  });
});
