export const PRAYER_BREAK_DURATION_MS = 7 * 60 * 1000;
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const prayerKeys = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

export type PrayerKey = typeof prayerKeys[number];
export type PrayerTime = { key: PrayerKey; name: string; at: number; time: string };
export type PrayerSchedule = { dateKey: string; prayers: PrayerTime[] };
export type PrayerBreak = { prayer: PrayerTime; endsAt: number };

const prayerNames: Record<PrayerKey, string> = {
  Fajr: 'Subuh',
  Dhuhr: 'Zuhur',
  Asr: 'Asar',
  Maghrib: 'Maghrib',
  Isha: 'Isya',
};

export function jakartaDateKey(now: Date): string {
  const date = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function prayerApiDate(now: Date): string {
  return jakartaDateKey(now).split('-').reverse().join('-');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parsePrayerSchedule(payload: unknown, now: Date): PrayerSchedule {
  if (!isRecord(payload) || payload.code !== 200 || !isRecord(payload.data) ||
      !isRecord(payload.data.timings)) {
    throw new Error('Respons jadwal sholat tidak valid.');
  }
  const timings = payload.data.timings;
  const dateKey = jakartaDateKey(now);
  const [year, month, day] = dateKey.split('-').map(Number);
  const prayers = prayerKeys.map((key) => {
    const raw = timings[key];
    if (typeof raw !== 'string') throw new Error(`Jadwal ${prayerNames[key]} tidak tersedia.`);
    const match = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
    if (!match) throw new Error(`Format jadwal ${prayerNames[key]} tidak valid.`);
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) throw new Error(`Format jadwal ${prayerNames[key]} tidak valid.`);
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return {
      key,
      name: prayerNames[key],
      time,
      at: Date.UTC(year, month - 1, day, hour - 7, minute),
    };
  });
  return { dateKey, prayers };
}

export async function fetchPrayerSchedule(now = new Date(), signal?: AbortSignal): Promise<PrayerSchedule> {
  const date = prayerApiDate(now);
  const url = new URL(`https://api.aladhan.com/v1/timings/${date}`);
  url.search = new URLSearchParams({
    latitude: '-6.975',
    longitude: '108.483',
    method: '20',
    timezonestring: 'Asia/Jakarta',
  }).toString();
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Layanan jadwal sholat gagal (HTTP ${response.status}).`);
  return parsePrayerSchedule(await response.json(), now);
}

export function activePrayerBreak(schedule: PrayerSchedule | null, now: Date): PrayerBreak | null {
  if (!schedule || schedule.dateKey !== jakartaDateKey(now)) return null;
  const timestamp = now.getTime();
  const prayer = schedule.prayers.find((item) =>
    timestamp >= item.at && timestamp < item.at + PRAYER_BREAK_DURATION_MS,
  );
  return prayer ? { prayer, endsAt: prayer.at + PRAYER_BREAK_DURATION_MS } : null;
}

export function formatJakartaTime(timestamp: number): string {
  const date = new Date(timestamp + JAKARTA_OFFSET_MS);
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}
