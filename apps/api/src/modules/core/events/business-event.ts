/**
 * Enveloppe commune des evenements metier publies via l'Outbox
 * (voir modules/outbox). `aggregateType`/`aggregateId` identifient
 * l'entite qui a produit l'evenement, `payload` doit rester serialisable
 * en JSON et suffisant pour que le worker n'ait pas besoin de recharger
 * l'aggregat pour les cas d'usage simples (email, notification).
 */
export interface BusinessEvent<TPayload = Record<string, unknown>> {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
  correlationId: string;
}

export const BUSINESS_EVENT_TYPES = {
  USER_REGISTERED: "UserRegistered",
  EMAIL_VERIFICATION_REQUESTED: "EmailVerificationRequested",
  ORDER_CREATED: "OrderCreated",
  ORDER_CONFIRMED: "OrderConfirmed",
  REPAIR_CASE_CREATED: "RepairCaseCreated",
  REPAIR_STATUS_CHANGED: "RepairStatusChanged",
  FILE_UPLOADED: "FileUploaded",
  COMPANY_APPLICATION_SUBMITTED: "CompanyApplicationSubmitted",
} as const;

export type BusinessEventType = (typeof BUSINESS_EVENT_TYPES)[keyof typeof BUSINESS_EVENT_TYPES];
