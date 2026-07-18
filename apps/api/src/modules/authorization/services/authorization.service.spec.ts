import { AuthorizationService } from "./authorization.service.js";

describe("AuthorizationService", () => {
  it("autorise un utilisateur possedant la permission requise", async () => {
    const roles = { getPermissionKeysForUser: jest.fn().mockResolvedValue(new Set(["catalog.read"])) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AuthorizationService(roles as any);
    await expect(service.hasPermission("user-1", "catalog.read")).resolves.toBe(true);
  });

  it("refuse un utilisateur sans la permission requise", async () => {
    const roles = { getPermissionKeysForUser: jest.fn().mockResolvedValue(new Set([])) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AuthorizationService(roles as any);
    await expect(service.hasPermission("user-1", "role.manage")).resolves.toBe(false);
  });
});
