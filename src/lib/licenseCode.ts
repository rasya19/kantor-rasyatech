export function licenseYears(currentYear: number): number[] {
  return Array.from({ length: 10 }, (_, offset) => currentYear + offset);
}

export function generateLicenseCode(deviceId: number, year: number): string {
  if (!Number.isSafeInteger(deviceId) || deviceId <= 0) {
    throw new RangeError('Device ID harus bilangan bulat positif yang aman.');
  }
  if (!Number.isInteger(year) || year < 0 || year > 99) {
    throw new RangeError('Nilai tahun lisensi harus berupa dua digit terakhir tahun (0–99).');
  }

  const code = deviceId * 7 + year;
  if (!Number.isSafeInteger(code)) {
    throw new RangeError('Hasil kode lisensi berada di luar batas angka yang aman.');
  }

  return String(code);
}
