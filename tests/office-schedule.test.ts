import test from 'node:test';
import assert from 'node:assert/strict';
import { officeActivityAt } from '../src/lib/officeSchedule';

test('office schedule follows Jakarta weekday and working hours', () => {
  assert.equal(officeActivityAt(new Date('2026-11-09T00:59:00Z'), 0), 'OFF');
  assert.equal(officeActivityAt(new Date('2026-11-09T01:00:00Z'), 0), 'WORK');
  assert.equal(officeActivityAt(new Date('2026-11-09T10:00:00Z'), 0), 'OFF');
  assert.equal(officeActivityAt(new Date('2026-11-14T03:00:00Z'), 0), 'OFF');
  assert.equal(officeActivityAt(new Date('2026-11-09T10:00:00Z'), 0), 'OFF');
});

test('office breaks rotate through staff groups at midday and afternoon', () => {
  assert.equal(officeActivityAt(new Date('2026-11-09T05:00:00Z'), 0), 'BREAK');
  assert.equal(officeActivityAt(new Date('2026-11-09T05:20:00Z'), 1), 'BREAK');
  assert.equal(officeActivityAt(new Date('2026-11-09T05:40:00Z'), 2), 'BREAK');
  assert.equal(officeActivityAt(new Date('2026-11-09T06:00:00Z'), 0), 'WORK');
  assert.equal(officeActivityAt(new Date('2026-11-09T08:30:00Z'), 0), 'BREAK');
  assert.equal(officeActivityAt(new Date('2026-11-09T08:40:00Z'), 1), 'BREAK');
});
