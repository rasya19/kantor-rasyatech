import type { ActivitySnapshot, DraftEvent, OfficeJob, OfficeDivision, Ticket, TicketCategory, TicketDivision, TicketStatus, VideoJob, WorkDraft } from '../workflowTypes';
import { OFFICE_DIVISIONS } from '../workflowTypes';

async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const response = await fetch(`/api/workflow${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : `Kesalahan server (${response.status}).`);
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
  retryJob: async (id: string) => {
    const response = await fetch(`/api/office-work/jobs/${encodeURIComponent(id)}/retry`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Gagal mencoba ulang tugas.');
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
  videos: () => request<{ enabled: boolean; jobs: VideoJob[] }>('/videos'),
  createVideo: (draftId: string) => request<{ id: string }>(`/videos/${encodeURIComponent(draftId)}`, 'POST'),
  createTicket: (body: { division: TicketDivision; category: TicketCategory; title: string; description: string }) =>
    request<{ ticket: Ticket }>('/tickets', 'POST', body),
  updateTicket: (id: string, status: TicketStatus, notes: string) =>
    request<{ ticket: Ticket }>(`/tickets/${encodeURIComponent(id)}`, 'PATCH', { status, notes }),
  ticketDraft: (id: string) => request<{ draft: WorkDraft }>(`/tickets/${encodeURIComponent(id)}/drafts`, 'POST'),
  contentDraft: (topic: string) => request<{ draft: WorkDraft }>('/drafts/content', 'POST', { topic }),
  mandate: (division: WorkDraft['division'], instruction: string) =>
    request<{ draft: WorkDraft }>('/drafts/mandate', 'POST', { division, instruction }),
  updateDraft: (id: string, body: { action: 'EDIT' | 'APPROVE' | 'REVISE'; content?: string; notes?: string }) =>
    request<{ draft: WorkDraft }>(`/drafts/${encodeURIComponent(id)}`, 'PATCH', body),
  events: (id: string) => request<{ events: DraftEvent[] }>(`/drafts/${encodeURIComponent(id)}/events`),
};
