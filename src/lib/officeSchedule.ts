export type OfficeActivity = 'WORK' | 'BREAK' | 'OFF';

function jakartaTimeParts(now: Date): { weekday: number; minuteOfDay: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value('weekday'));
  const hour = Number(value('hour'));
  const minute = Number(value('minute'));
  return { weekday, minuteOfDay: hour * 60 + minute };
}

export function officeActivityAt(now: Date, staffIndex: number): OfficeActivity {
  const { weekday, minuteOfDay } = jakartaTimeParts(now);
  if (weekday === 0 || weekday === 6 || minuteOfDay < 8 * 60 || minuteOfDay >= 17 * 60) return 'OFF';
  if (minuteOfDay >= 12 * 60 && minuteOfDay < 13 * 60) {
    const breakGroup = Math.floor((minuteOfDay - 12 * 60) / 20);
    return staffIndex % 3 === breakGroup ? 'BREAK' : 'WORK';
  }
  if (minuteOfDay >= 15 * 60 + 30 && minuteOfDay < 16 * 60) {
    const breakGroup = Math.floor((minuteOfDay - (15 * 60 + 30)) / 10);
    return staffIndex % 3 === breakGroup ? 'BREAK' : 'WORK';
  }
  return 'WORK';
}
