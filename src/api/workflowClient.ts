import type { ActivitySnapshot, DraftEvent, OfficeJob, OfficeDivision, Ticket, TicketCategory, TicketDivision, TicketStatus, VideoControlStatus, WorkDraft } from '../workflowTypes';
import { OFFICE_DIVISIONS } from '../workflowTypes';

async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const response = await fetch(`/api/workflow${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const responseBody = await response.text();
  const contentType = response.headers.get('content-type')?.split(';', 1)[0] || 'tidak diketahui';
  let data: unknown;
  if (responseBody) {
    try {
      data = JSON.parse(responseBody) as unknown;
    } catch {
      throw new Error(`Respons server bukan JSON (HTTP ${response.status}, ${contentType}). Periksa log server lalu coba lagi.`);
    }
  } else {
    throw new Error(`Server mengembalikan respons kosong (HTTP ${response.status}, ${contentType}). Periksa log server lalu coba lagi.`);
  }
  if (!response.ok) {
    const errorMessage = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error
      : `Kesalahan server (${response.status}).`;
    throw new Error(errorMessage);
  }
  return data as T;
}

export const workflowClient = {
  jobs: async () => {
    const response = await fetch('/api/office-work/jobs', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Antrean tidak tersedia.');
    return data as { jobs: OfficeJob[] };
  },
  enqueue: async (division: OfficeDivision, staffId: string, instruction: string) => {
    const response = await fetch('/api/office-work/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ division, staffId, instruction }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Gagal menambahkan tugas.');
    return data as { id: string };
  },
  enqueueTicket: async (body: { division: TicketDivision; category: TicketCategory; title: string; description: string }) => {
    const response = await fetch('/api/office-work/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Gagal menyimpan tiket.');
    return data as { ticket: Ticket };
  },
  enqueueTicketReport: async (id: string) => {
    const response = await fetch(`/api/office-work/tickets/${encodeURIComponent(id)}/jobs`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Gagal menambahkan laporan ke antrean.');
    return data as { id: string };
  },
  retryJob: async (id: string): Promise<{ alreadyActive: boolean }> => {
    const response = await fetch(`/api/office-work/jobs/${encodeURIComponent(id)}/retry`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Gagal mencoba ulang tugas.');
    return data as { alreadyActive: boolean };
  },
  dismissFailedSprint: async (id: string) => {
    const response = await fetch(`/api/business/opportunities/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Gagal menghapus tugas sprint.');
  },
  startSprintJob: async (id: string) => {
    const response = await fetch(`/api/business/opportunities/jobs/${encodeURIComponent(id)}/start`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Gagal memilih tugas sprint.');
  },
  startDailyProductJob: async (id: string) => {
    const response = await fetch(`/api/business/daily-product/jobs/${encodeURIComponent(id)}/start`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Gagal memulai tugas produk digital harian.');
  },
  continueContent: async (id: string) => {
    const response = await fetch(`/api/office-work/content-flow/from-draft/${encodeURIComponent(id)}`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Gagal meneruskan laporan.');
    return data as { id: string };
  },
  contentContinuation: async (id: string) => {
    const response = await fetch(`/api/office-work/content-flow/from-draft/${encodeURIComponent(id)}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Gagal memeriksa alur konten.');
    return data as { eligible: boolean; forwarded: boolean };
  },
  creatorFollowup: async (id: string) => request<{ eligible: boolean; status: string | null }>(`/drafts/${encodeURIComponent(id)}/creator-followup`),
  startCreatorFollowup: async (id: string, verifiedFacts: string) => request<{ id: string; status: string; created: boolean }>(`/drafts/${encodeURIComponent(id)}/creator-followup`, 'POST', { verifiedFacts }),
  startDigitalProductIdea: async (id: string, conceptTitle: string, concept: string) =>
    request<{ id: string; status: string; created: boolean }>(`/drafts/${encodeURIComponent(id)}/digital-product-ideas`, 'POST', { conceptTitle, concept }),
  mandateContentFollowup: async (id: string) => request<{ eligible: boolean; forwarded: boolean; flowId: string | null }>(`/drafts/${encodeURIComponent(id)}/mandate-content-followup`),
  startMandateContentFollowup: async (id: string) => request<{ id: string; created: boolean }>(`/drafts/${encodeURIComponent(id)}/mandate-content-followup`, 'POST', {}),
  marketingContentFollowup: async (id: string) => request<{
    eligible: boolean;
    forwarded: boolean;
    flowId: string | null;
    sourceBriefLinked: boolean;
    stages: { id: string; staffId: string; title: string; status: string; draftId: string | null; error: string | null }[];
  }>(`/drafts/${encodeURIComponent(id)}/marketing-content-followup`),
  startMarketingContentFollowup: async (id: string) => request<{ id: string; created: boolean }>(`/drafts/${encodeURIComponent(id)}/marketing-content-followup`, 'POST', {}),
  activity: async (signal: AbortSignal): Promise<ActivitySnapshot> => {
    const response = await fetch('/api/workflow/activity', { cache: 'no-store', signal });
    if (!response.ok) throw new Error(`Status aktivitas gagal dimuat (${response.status}).`);
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || !('divisions' in value) || !Array.isArray(value.divisions) ||
        !('observedAt' in value) || typeof value.observedAt !== 'string') {
      throw new Error('Respons status aktivitas tidak valid.');
    }
    const divisions: unknown[] = value.divisions;
    if (divisions.length !== OFFICE_DIVISIONS.length ||
        !OFFICE_DIVISIONS.every((division) =>
          divisions.filter((item: unknown) =>
            item && typeof item === 'object' && 'division' in item && item.division === division &&
            'creating' in item && Number.isInteger(item.creating) && Number(item.creating) >= 0 &&
            'revising' in item && Number.isInteger(item.revising) && Number(item.revising) >= 0).length === 1)) {
      throw new Error('Respons status aktivitas tidak valid.');
    }
    return value as ActivitySnapshot;
  },
  tickets: () => request<{ tickets: Ticket[] }>('/tickets'),
  drafts: () => request<{ drafts: WorkDraft[] }>('/drafts'),
  videos: () => request<VideoControlStatus>('/videos'),
  officeAssistant: (messages: { role: 'user' | 'assistant'; content: string }[]) =>
    request<{ reply: string; model: string }>('/assistant/chat', 'POST', { messages }),
  createVideo: (draftId: string, ideaKey: string) =>
    request<{ id: string }>(`/videos/${encodeURIComponent(draftId)}`, 'POST', { ideaKey }),
  acknowledgeUnknownVideo: (jobId: string) =>
    request<{ released: boolean }>(`/videos/${encodeURIComponent(jobId)}/acknowledge-unknown`, 'POST', { checked: true }),
  adminLogin: (password: string) => request<{ authenticated: boolean }>('/admin/login', 'POST', { password }),
  adminLogout: () => request<{ authenticated: boolean }>('/admin/logout', 'POST', {}),
  setVideoEnabled: (enabled: boolean) => request<{ enabled: boolean; approvedBudgetIdr: number }>('/admin/video', 'PATCH', { enabled }),
  createTicket: (body: { division: TicketDivision; category: TicketCategory; title: string; description: string }) =>
    request<{ ticket: Ticket }>('/tickets', 'POST', body),
  updateTicket: (id: string, status: TicketStatus, notes: string) =>
    request<{ ticket: Ticket }>(`/tickets/${encodeURIComponent(id)}`, 'PATCH', { status, notes }),
  ticketDraft: (id: string) => request<{ draft: WorkDraft }>(`/tickets/${encodeURIComponent(id)}/drafts`, 'POST'),
  contentDraft: (topic: string) => request<{ draft: WorkDraft }>('/drafts/content', 'POST', { topic }),
  mandate: (division: WorkDraft['division'], instruction: string) =>
    request<{ draft: WorkDraft }>('/drafts/mandate', 'POST', { division, instruction }),
  deleteDraft: (id: string) =>
    request<{ deletedDrafts: number; deletedJobs: number }>(`/drafts/${encodeURIComponent(id)}`, 'DELETE'),
  updateDraft: (id: string, body: { action: 'EDIT' | 'APPROVE' | 'REVISE'; content?: string; notes?: string }) =>
    request<{ draft: WorkDraft }>(`/drafts/${encodeURIComponent(id)}`, 'PATCH', body),
  events: (id: string) => request<{ events: DraftEvent[] }>(`/drafts/${encodeURIComponent(id)}/events`),
};
