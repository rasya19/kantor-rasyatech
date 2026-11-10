export type TicketDivision = 'paud' | 'posyandu';
export type TicketCategory = 'BUG' | 'QUESTION' | 'COMPLAINT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED';
export const OFFICE_DIVISIONS = ['paud', 'posyandu', 'creator', 'engineer', 'cyber'] as const;
export type OfficeDivision = typeof OFFICE_DIVISIONS[number];

export function isOfficeDivision(value: unknown): value is OfficeDivision {
  return typeof value === 'string' && OFFICE_DIVISIONS.some((division) => division === value);
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
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
  ticketId: string | null;
  draftId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoJob {
  id: string;
  draftId: string;
  status: 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED' | 'UNKNOWN';
  error: string | null;
  createdAt: string;
}
