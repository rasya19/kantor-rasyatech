import { generateLicenseCode } from './licenseCode.js';

export function normalizeWarungName(name: string): string {
  return name.trim().toLowerCase();
}

export function validateWarungLicense(input: { name: unknown; deviceId: unknown; year: unknown }) {
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 120) {
    throw new RangeError('Nama warung wajib diisi (maksimal 120 karakter).');
  }
  if (typeof input.deviceId !== 'string' || !/^\d+$/.test(input.deviceId)) {
    throw new RangeError('Device ID harus berupa bilangan bulat positif.');
  }
  const deviceId = Number(input.deviceId);
  if (typeof input.year !== 'number' || !Number.isInteger(input.year) || input.year < 2000 || input.year > 9999) {
    throw new RangeError('Tahun lisensi harus berupa tahun yang valid.');
  }
  const code = generateLicenseCode(deviceId, input.year % 100);
  const name = input.name.trim();
  return { name, normalizedName: normalizeWarungName(name), deviceId: String(deviceId), year: input.year, code };
}

export interface WarungLicenseRecord {
  id: string;
  deviceId: string;
  year: number;
  code: string;
  createdAt: string;
}

export interface WarungRecord {
  id: string;
  name: string;
  createdAt: string;
  licenses: WarungLicenseRecord[];
}
