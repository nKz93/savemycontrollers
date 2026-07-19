import { AddressService } from "./address.service.js";
import { NotFoundDomainError } from "../../core/errors/domain-error.js";

function buildService() {
  const addresses = {
    listForUser: jest.fn(),
    findByIdForUser: jest.fn(),
    createForUser: jest.fn(),
    updateForUser: jest.fn(),
    deleteForUser: jest.fn(),
  };
  /* eslint-disable @typescript-eslint/no-explicit-any -- mocks de test */
  const service = new AddressService(addresses as any);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return { service, addresses };
}

const sampleRow = {
  id: "addr-1",
  userId: "user-A",
  companyId: null,
  label: "Domicile",
  recipientName: "Alice",
  line1: "1 rue Test",
  line2: null,
  postalCode: "75000",
  city: "Paris",
  country: "FR",
  phone: null,
  isDefaultBilling: true,
  isDefaultShipping: true,
  createdAt: new Date(),
};

describe("AddressService — appartenance stricte", () => {
  it("list() ne peut jamais renvoyer les adresses d'un autre utilisateur : la requete est scopee des le repository", async () => {
    const { service, addresses } = buildService();
    addresses.listForUser.mockResolvedValue([sampleRow]);
    await service.list("user-A");
    expect(addresses.listForUser).toHaveBeenCalledWith("user-A");
  });

  it("get() renvoie 404 si l'adresse n'appartient pas a l'utilisateur (findByIdForUser scope id+userId ensemble)", async () => {
    const { service, addresses } = buildService();
    addresses.findByIdForUser.mockResolvedValue(null); // simule "n'existe pas" ET "appartient a un autre"
    await expect(service.get("user-B", "addr-1")).rejects.toBeInstanceOf(NotFoundDomainError);
    expect(addresses.findByIdForUser).toHaveBeenCalledWith("addr-1", "user-B");
  });

  it("update() renvoie 404 (jamais Forbidden) si l'adresse n'appartient pas a l'utilisateur — aucune fuite d'information sur l'existence", async () => {
    const { service, addresses } = buildService();
    addresses.updateForUser.mockResolvedValue(null);
    await expect(service.update("user-B", "addr-1", { city: "Lyon" })).rejects.toBeInstanceOf(NotFoundDomainError);
  });

  it("remove() renvoie 404 si l'adresse n'appartient pas a l'utilisateur", async () => {
    const { service, addresses } = buildService();
    addresses.deleteForUser.mockResolvedValue(false);
    await expect(service.remove("user-B", "addr-1")).rejects.toBeInstanceOf(NotFoundDomainError);
  });

  it("create() ne transmet jamais de companyId au repository (perimetre personnel strict, aucune entreprise selectionnable par id)", async () => {
    const { service, addresses } = buildService();
    addresses.createForUser.mockResolvedValue(sampleRow);
    await service.create("user-A", {
      recipientName: "Alice",
      line1: "1 rue Test",
      postalCode: "75000",
      city: "Paris",
      country: "FR",
      isDefaultBilling: false,
      isDefaultShipping: false,
    });
    const [, dataPassed] = addresses.createForUser.mock.calls[0];
    expect(dataPassed).not.toHaveProperty("companyId");
  });

  it("le DTO ne contient pas userId/companyId (champs internes) — liste blanche stricte", async () => {
    const { service, addresses } = buildService();
    addresses.listForUser.mockResolvedValue([sampleRow]);
    const [dto] = await service.list("user-A");
    expect(dto).not.toHaveProperty("userId");
    expect(dto).not.toHaveProperty("companyId");
    expect(dto).not.toHaveProperty("createdAt");
  });
});
