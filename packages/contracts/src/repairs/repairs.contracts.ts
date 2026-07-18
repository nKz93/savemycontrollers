import { z } from "zod";

export interface RepairStatusDto {
  key: string;
  label: string;
  color: string;
  isSystem: boolean;
  displayOrder: number;
}

export interface RepairStatusHistoryEntryDto {
  id: string;
  statusKey: string;
  changedAt: string;
  changedByUserId: string | null;
  comment: string | null;
}

export interface RepairCaseSummaryDto {
  id: string;
  reference: string;
  statusKey: string;
  deviceModelName: string;
  createdAt: string;
  estimatedReadyAt: string | null;
}

export interface RepairCaseDetailDto extends RepairCaseSummaryDto {
  reportedIssue: string | null;
  technicianDiagnosis: string | null;
  assignedTechnicianId: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  history: RepairStatusHistoryEntryDto[];
  clientMessages: Array<{ id: string; body: string; createdAt: string; authorRole: string }>;
}

export const changeStatusSchema = z.object({
  toStatusKey: z.string().min(1),
  comment: z.string().max(2000).optional(),
});
export type ChangeStatusRequest = z.infer<typeof changeStatusSchema>;

export const addInternalNoteSchema = z.object({
  body: z.string().min(1).max(4000),
});
export type AddInternalNoteRequest = z.infer<typeof addInternalNoteSchema>;

export const addClientMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});
export type AddClientMessageRequest = z.infer<typeof addClientMessageSchema>;
