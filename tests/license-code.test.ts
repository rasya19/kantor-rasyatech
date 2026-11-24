import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLicenseCode, licenseYears } from '../src/lib/licenseCode';

test('license codes use the configured device and year formula', () => {
  assert.equal(generateLicenseCode(20013, 26), '140117');
  assert.equal(generateLicenseCode(20013, 27), '140118');
  assert.equal(generateLicenseCode(20013, 35), '140126');
  assert.equal(generateLicenseCode(20013, 0), '140091');
  assert.equal(generateLicenseCode(20013, 99), '140190');
});

test('license year choices span the current year and nine following years', () => {
  assert.deepEqual(licenseYears(2026), [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]);
  assert.deepEqual(licenseYears(2098).map((year) => year % 100), [98, 99, 0, 1, 2, 3, 4, 5, 6, 7]);
});

test('license code generation rejects invalid device IDs and years', () => {
  assert.throws(() => generateLicenseCode(0, 26), RangeError);
  assert.throws(() => generateLicenseCode(-1, 26), RangeError);
  assert.throws(() => generateLicenseCode(Number.MAX_SAFE_INTEGER, 27), RangeError);
  assert.throws(() => generateLicenseCode(20013, -1), RangeError);
  assert.throws(() => generateLicenseCode(20013, 100), RangeError);
  assert.throws(() => generateLicenseCode(20013, 26.5), RangeError);
});
