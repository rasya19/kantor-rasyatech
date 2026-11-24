import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWarungName, validateWarungLicense } from '../src/lib/warungLicense';

test('warung names match without case and edge spaces while preserving internal spaces', () => {
  assert.equal(normalizeWarungName('  Warung Berkah  '), normalizeWarungName('warung berkah'));
  assert.notEqual(normalizeWarungName('Warung  Berkah'), normalizeWarungName('Warung Berkah'));
});

test('validates and calculates saved licenses on the server', () => {
  assert.deepEqual(validateWarungLicense({ name: ' Warung Berkah ', deviceId: '020013', year: 2035 }), {
    name: 'Warung Berkah', normalizedName: 'warung berkah', deviceId: '20013', year: 2035, code: '140126',
  });
  assert.throws(() => validateWarungLicense({ name: ' ', deviceId: '20013', year: 2026 }), RangeError);
  assert.throws(() => validateWarungLicense({ name: 'A', deviceId: '1.5', year: 2026 }), RangeError);
  assert.throws(() => validateWarungLicense({ name: 'A', deviceId: '0', year: 2026 }), RangeError);
  assert.throws(() => validateWarungLicense({ name: 'A', deviceId: '9007199254740991', year: 2026 }), RangeError);
  assert.throws(() => validateWarungLicense({ name: 'A', deviceId: '1', year: 26 }), RangeError);
});
