import { RepairCaseService } from "./repair-case.service.js";
import { ConflictDomainError, ForbiddenDomainError, OptimisticLockDomainError } from "../../core/errors/domain-error.js";

function buildService(overrides: {
  existingCase?: Record<string, unknown>;
  transitionAllowed?: boolean;
  optimisticLockSucceeds?: boolean;
  staffProfile?: { id: string; isActive: boolean; accountType: string } | null;
  hasAuthorizedRole?: boolean;
}) {
  const existingCase = overrides.existingCase ?? {
    id: "case-1",
    clientId: "client-1",
    statusKey: "RECEIVED",
    lockVersion: 3,
  };

  const cases = {
    findById: jest.fn().mockResolvedValue(existingCase),
    runInTransaction: jest.fn((fn: (tx: unknown) => unknown) => fn({})),
    updateStatusWithOptimisticLockInTransaction: jest
      .fn()
      .mockResolvedValue({ count: overrides.optimisticLockSucceeds === false ? 0 : 1 }),
    appendHistoryInTransaction: jest.fn(),
    assignTechnician: jest.fn().mockResolvedValue({ id: "case-1", assignedTechnicianId: "tech-1" }),
  };
  const statuses = {
    findStatus: jest.fn().mockResolvedValue({ key: "DIAGNOSING", label: "Diagnostic en cours" }),
    isTransitionAllowed: jest.fn().mockResolvedValue(overrides.transitionAllowed === false ? null : { id: "t1" }),
  };
  const history = { append: jest.fn() };
  const notes = { create: jest.fn() };
  const references = {};
  const qrTokens = {};
  const audit = { record: jest.fn() };
  const outbox = { runInTransaction: jest.fn((fn: (tx: unknown) => unknown) => fn({})), appendInTransaction: jest.fn() };
  const identity = {
    getStaffProfileForAssignment: jest.fn().mockResolvedValue(
      overrides.staffProfile !== undefined ? overrides.staffProfile : { id: "tech-1", isActive: true, accountType: "STAFF" },
    ),
  };
  const authorization = {
    hasAnyPermission: jest.fn().mockResolvedValue(overrides.hasAuthorizedRole ?? true),
  };

  /* eslint-disable @typescript-eslint/no-explicit-any -- mocks de test */
  return new RepairCaseService(
    cases as any, statuses as any, history as any, notes as any, references as any,
    qrTokens as any, audit as any, outbox as any, identity as any, authorization as any,
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

describe("RepairCaseService.changeStatus", () => {
  it("autorise une transition presente dans la matrice des transitions", async () => {
    const service = buildService({ transitionAllowed: true });
    await expect(
      service.changeStatus("case-1", "DIAGNOSING", { userId: "tech-1", correlationId: "corr-1" }),
    ).resolves.toBeDefined();
  });

  it("refuse une transition absente de la matrice des transitions", async () => {
    const service = buildService({ transitionAllowed: false });
    await expect(
      service.changeStatus("case-1", "DIAGNOSING", { userId: "tech-1", correlationId: "corr-1" }),
    ).rejects.toBeInstanceOf(ConflictDomainError);
  });

  it("detecte un conflit de verrouillage optimiste (dossier modifie entre-temps)", async () => {
    const service = buildService({ transitionAllowed: true, optimisticLockSucceeds: false });
    await expect(
      service.changeStatus("case-1", "DIAGNOSING", { userId: "tech-1", correlationId: "corr-1" }),
    ).rejects.toBeInstanceOf(OptimisticLockDomainError);
  });
});

describe("RepairCaseService.getForClient", () => {
  it("empeche un client de consulter le dossier d'un autre client", async () => {
    const service = buildService({ existingCase: { id: "case-1", clientId: "client-1", statusKey: "RECEIVED", lockVersion: 0 } });
    await expect(service.getForClient("case-1", "client-2")).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("autorise le proprietaire du dossier a le consulter", async () => {
    const service = buildService({ existingCase: { id: "case-1", clientId: "client-1", statusKey: "RECEIVED", lockVersion: 0 } });
    await expect(service.getForClient("case-1", "client-1")).resolves.toBeDefined();
  });
});

describe("RepairCaseService.assignTechnician", () => {
  it("empeche l'affectation d'un client particulier (accountType != STAFF)", async () => {
    const service = buildService({ staffProfile: { id: "client-1", isActive: true, accountType: "INDIVIDUAL" } });
    await expect(
      service.assignTechnician("case-1", "client-1", { userId: "admin-1", correlationId: "corr-1" }),
    ).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("empeche l'affectation d'un compte du personnel desactive", async () => {
    const service = buildService({ staffProfile: { id: "tech-1", isActive: false, accountType: "STAFF" } });
    await expect(
      service.assignTechnician("case-1", "tech-1", { userId: "admin-1", correlationId: "corr-1" }),
    ).rejects.toBeInstanceOf(Error);
  });

  it("empeche l'affectation d'un membre du personnel sans role autorise", async () => {
    const service = buildService({ hasAuthorizedRole: false });
    await expect(
      service.assignTechnician("case-1", "tech-1", { userId: "admin-1", correlationId: "corr-1" }),
    ).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("autorise l'affectation d'un technicien actif avec un role autorise", async () => {
    const service = buildService({});
    await expect(
      service.assignTechnician("case-1", "tech-1", { userId: "admin-1", correlationId: "corr-1" }),
    ).resolves.toBeDefined();
  });
});
