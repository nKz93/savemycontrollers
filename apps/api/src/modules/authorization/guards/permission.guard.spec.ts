import { PermissionGuard } from "./permission.guard.js";
import { ForbiddenException } from "@nestjs/common";

function buildContext(currentUser: { id: string } | undefined) {
  const request = { currentUser };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
}

function buildGuard(overrides: {
  anyOf?: string[];
  allOf?: string[];
  staffProfile?: { id: string; isActive: boolean; accountType: string } | null;
  hasAny?: boolean;
  hasAll?: boolean;
}) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === "require_any_permission") return overrides.anyOf ?? [];
      if (key === "require_all_permissions") return overrides.allOf ?? [];
      return undefined;
    }),
  };
  const authorization = {
    hasAnyPermission: jest.fn().mockResolvedValue(overrides.hasAny ?? true),
    hasAllPermissions: jest.fn().mockResolvedValue(overrides.hasAll ?? true),
  };
  const identity = {
    getStaffProfileForAssignment: jest.fn().mockResolvedValue(
      overrides.staffProfile !== undefined ? overrides.staffProfile : { id: "staff-1", isActive: true, accountType: "STAFF" },
    ),
  };
  /* eslint-disable @typescript-eslint/no-explicit-any -- mocks de test */
  return new PermissionGuard(reflector as any, authorization as any, identity as any);
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

describe("PermissionGuard — verification STAFF active", () => {
  it("refuse l'acces si le compte a un role attribue par erreur mais n'est pas STAFF (ex. client particulier)", async () => {
    const guard = buildGuard({ anyOf: ["catalog.read"], staffProfile: { id: "client-1", isActive: true, accountType: "INDIVIDUAL" } });
    const context = buildContext({ id: "client-1" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(guard.canActivate(context as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuse l'acces si le compte STAFF est desactive", async () => {
    const guard = buildGuard({ anyOf: ["catalog.read"], staffProfile: { id: "staff-1", isActive: false, accountType: "STAFF" } });
    const context = buildContext({ id: "staff-1" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(guard.canActivate(context as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuse l'acces si le compte n'existe plus", async () => {
    const guard = buildGuard({ anyOf: ["catalog.read"], staffProfile: null });
    const context = buildContext({ id: "deleted-user" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(guard.canActivate(context as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("autorise un compte STAFF actif possedant au moins une des permissions requises (ANY)", async () => {
    const guard = buildGuard({ anyOf: ["catalog.read"], hasAny: true });
    const context = buildContext({ id: "staff-1" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(guard.canActivate(context as any)).resolves.toBe(true);
  });

  it("refuse un compte STAFF actif ne possedant pas TOUTES les permissions requises (ALL)", async () => {
    const guard = buildGuard({ allOf: ["catalog.read", "role.manage"], hasAll: false });
    const context = buildContext({ id: "staff-1" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(guard.canActivate(context as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("laisse passer une route sans exigence de permission", async () => {
    const guard = buildGuard({});
    const context = buildContext(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(guard.canActivate(context as any)).resolves.toBe(true);
  });
});
