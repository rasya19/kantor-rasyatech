export type TicketDivision = 'paud' | 'posyandu';
export type TicketCategory = 'BUG' | 'QUESTION' | 'COMPLAINT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED';
export const OFFICE_DIVISIONS = ['paud', 'posyandu', 'creator', 'engineer', 'cyber', 'finance', 'marketing'] as const;
export type OfficeDivision = typeof OFFICE_DIVISIONS[number];

export function isOfficeDivision(value: unknown): value is OfficeDivision {
  return typeof value === 'string' && OFFICE_DIVISIONS.some((division) => division === value);
}

export function isDigitalProductResearchDraftId(id: string): boolean {
  return /^job-digital-product-research-[0-9a-f-]{36}$/.test(id) ||
    /^job-daily-digital-product-\d{4}-\d{2}-\d{2}$/.test(id);
}
export type ActivityAction = 'CREATE' | 'REVISE';

export interface DivisionActivity {
  division: OfficeDivision;
  creating: number;
  revising: number;
}

export interface ActivitySnapshot {
  divisions: DivisionActivity[];
  observedAt: string;
}

export interface Ticket {
  id: string;
  division: TicketDivision;
  category: TicketCategory;
  title: string;
  description: string;
  status: TicketStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkDraft {
  id: string;
  ticketId: string | null;
  division: OfficeDivision;
  title: string;
  content: string;
  contentPackageVersion?: 1;
  productPackageVersion?: 1;
  sourceDraftId?: string;
  grounding?: {
    searchSuggestions: string;
    sources: { title: string; url: string }[];
    citations: { text: string; sourceIndexes: number[] }[];
  };
  ai?: { provider: 'gemini' | 'copilot' | 'openrouter'; model: string };
  status: 'PENDING' | 'APPROVED' | 'INTERMEDIATE';
  createdAt: string;
  updatedAt: string;
}

export interface DraftEvent {
  id: string;
  action: string;
  notes: string;
  data: WorkDraft;
  createdAt: string;
}

export interface OfficeJob {
  id: string;
  division: OfficeDivision;
  staffId: string;
  title: string;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'PAUSED';
  ticketId: string | null;
  draftId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoJob {
  id: string;
  draftId: string;
  title: string;
  status: 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED' | 'UNKNOWN' | 'CANCELLED';
  error: string | null;
  createdAt: string;
}

export interface VideoControlStatus {
  enabled: boolean;
  approvedBudgetIdr: number;
  adminConfigured: boolean;
  authenticated: boolean;
  jobs: VideoJob[];
}
