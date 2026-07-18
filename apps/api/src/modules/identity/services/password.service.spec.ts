import { PasswordService } from "./password.service.js";

describe("PasswordService", () => {
  const service = new PasswordService();

  it("hache puis verifie correctement un mot de passe valide", async () => {
    const hash = await service.hash("Correct-Horse-Battery-Staple-1!");
    await expect(service.verify(hash, "Correct-Horse-Battery-Staple-1!")).resolves.toBe(true);
  });

  it("rejette un mot de passe incorrect", async () => {
    const hash = await service.hash("Correct-Horse-Battery-Staple-1!");
    await expect(service.verify(hash, "un-autre-mot-de-passe")).resolves.toBe(false);
  });

  it("refuse un mot de passe trop court", () => {
    expect(service.isPasswordAcceptable("short1!")).toBe(false);
  });

  it("accepte un mot de passe conforme a la politique minimale", () => {
    expect(service.isPasswordAcceptable("Correct-Horse-Battery-Staple-1!")).toBe(true);
  });
});
