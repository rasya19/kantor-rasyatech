import type { WarungLicenseRecord, WarungRecord } from '../lib/warungLicense';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/warung${path}`, { ...init, cache: 'no-store' });
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Respons server tidak valid (HTTP ${response.status}). Periksa server dan coba lagi.`);
  }
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error : `Kesalahan server (${response.status}).`;
    throw new Error(error);
  }
  return data as T;
}

export const warungClient = {
  list: () => request<{ warungs: WarungRecord[] }>(''),
  generate: (input: { name: string; deviceId: string; year: number }) =>
    request<{ warung: { id: string; name: string }; license: WarungLicenseRecord; isNew: boolean }>('/licenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
};
