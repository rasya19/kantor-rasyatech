export type DivisionId = 'paud' | 'posyandu' | 'creator';

export type ActiveTab = 'dashboard' | 'blueprint' | 'approval' | 'staff' | 'history';

export interface StaffMember {
  id: string;
  name: string;
  divisionId: DivisionId;
  divisionName: string;
  role: string;
  specialty: string;
  defaultChannel: 'WhatsApp' | 'Social' | 'Web/App';
  mapX: number; // Percentage relative to blueprint image
  mapY: number;
  avatarBg: string;
}

export interface DraftReport {
  id: string;
  division: string;
  divisionId: DivisionId;
  assignedStaff: string;
  staffId: string;
  taskPrompt: string;
  pemicuTren?: string;
  ringkasanDraf?: string;
  hasilDraf: string;
  formattedReport: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REVISED';
  revisionNotes?: string;
  payloadPreview?: Record<string, unknown>;
  isProactive?: boolean;
  createdAt: string;
  approvedAt?: string;
  executionResult?: {
    channel: 'WhatsApp' | 'Social' | 'Web/App';
    status: 'Dispatched' | 'Published' | 'Scheduled';
    timestamp: string;
    details: string;
  };
}

export interface PresetTask {
  id: string;
  title: string;
  divisionId: DivisionId;
  staffId: string;
  prompt: string;
  badge: string;
}
