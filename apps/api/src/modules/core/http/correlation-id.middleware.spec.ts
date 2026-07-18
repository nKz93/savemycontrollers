import { correlationIdMiddleware, CORRELATION_ID_HEADER, type RequestWithCorrelationId } from "./correlation-id.middleware.js";

function buildReqRes(headerValue?: string | string[]) {
  const headers: Record<string, string | string[] | undefined> = {};
  if (headerValue !== undefined) headers[CORRELATION_ID_HEADER] = headerValue;
  const req = { headers } as unknown as RequestWithCorrelationId;
  const setHeader = jest.fn();
  const res = { setHeader } as never;
  const next = jest.fn();
  return { req, res, setHeader, next };
}

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("correlationIdMiddleware", () => {
  it("reutilise un UUID valide fourni par le client", () => {
    const { req, res, setHeader, next } = buildReqRes(VALID_UUID);
    correlationIdMiddleware(req, res, next);
    expect(req.correlationId).toBe(VALID_UUID);
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, VALID_UUID);
    expect(next).toHaveBeenCalled();
  });

  it("genere un UUID si aucun en-tete n'est fourni", () => {
    const { req, res, next } = buildReqRes(undefined);
    correlationIdMiddleware(req, res, next);
    expect(req.correlationId).toMatch(UUID_PATTERN);
    expect(next).toHaveBeenCalled();
  });

  it("genere un UUID si la valeur fournie n'est pas un UUID valide", () => {
    const { req, res, next } = buildReqRes("pas-un-uuid-du-tout");
    correlationIdMiddleware(req, res, next);
    expect(req.correlationId).toMatch(UUID_PATTERN);
    expect(req.correlationId).not.toBe("pas-un-uuid-du-tout");
  });

  it("genere un UUID si la valeur fournie est excessivement longue", () => {
    const tooLong = "a".repeat(5000);
    const { req, res, next } = buildReqRes(tooLong);
    correlationIdMiddleware(req, res, next);
    expect(req.correlationId).toMatch(UUID_PATTERN);
  });

  it("prend la premiere valeur si l'en-tete est fourni plusieurs fois", () => {
    const { req, res, next } = buildReqRes([VALID_UUID, "autre-valeur"]);
    correlationIdMiddleware(req, res, next);
    expect(req.correlationId).toBe(VALID_UUID);
  });
});
