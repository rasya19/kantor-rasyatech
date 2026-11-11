import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activePrayerBreak,
  formatJakartaTime,
  jakartaDateKey,
  parsePrayerSchedule,
  prayerApiDate,
  PRAYER_BREAK_DURATION_MS,
} from '../src/lib/prayerSchedule';

const now = new Date('2026-11-10T04:00:00.000Z');
const response = {
  code: 200,
  data: {
    timings: {
      Fajr: '03:56',
      Dhuhr: '11:30 (WIB)',
      Asr: '14:50',
      Maghrib: '17:42',
      Isha: '18:55',
    },
  },
};

test('prayer API date and schedule use Kuningan local date and WIB', () => {
  assert.equal(jakartaDateKey(now), '2026-11-10');
  assert.equal(prayerApiDate(now), '10-11-2026');
  const schedule = parsePrayerSchedule(response, now);
  assert.deepEqual(schedule.prayers.map((prayer) => prayer.name), ['Subuh', 'Zuhur', 'Asar', 'Maghrib', 'Isya']);
  assert.equal(new Date(schedule.prayers[0].at).toISOString(), '2026-11-09T20:56:00.000Z');
  assert.equal(new Date(schedule.prayers[1].at).toISOString(), '2026-11-10T04:30:00.000Z');
});

test('prayer break is active for 7 minutes from the scheduled prayer time', () => {
  const schedule = parsePrayerSchedule(response, now);
  assert.equal(PRAYER_BREAK_DURATION_MS, 7 * 60 * 1000);
  assert.equal(activePrayerBreak(schedule, new Date('2026-11-10T04:29:59.000Z')), null);
  const active = activePrayerBreak(schedule, new Date('2026-11-10T04:33:00.000Z'));
  assert.equal(active?.prayer.name, 'Zuhur');
  assert.equal(formatJakartaTime(active!.endsAt), '11:37');
  assert.equal(activePrayerBreak(schedule, new Date('2026-11-10T04:36:59.000Z'))?.prayer.name, 'Zuhur');
  assert.equal(activePrayerBreak(schedule, new Date('2026-11-10T04:37:00.000Z')), null);
});

test('invalid prayer API responses are surfaced instead of triggering a simulated break', () => {
  assert.throws(() => parsePrayerSchedule({ code: 500 }, now), /Respons jadwal sholat tidak valid/);
  assert.throws(() => parsePrayerSchedule({ code: 200, data: { timings: { Fajr: 'invalid' } } }, now), /Format jadwal Subuh tidak valid/);
});
