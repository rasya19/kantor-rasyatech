import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateWarungLicense } from '../src/lib/warungLicense';
import { recordWarungLicense } from '../server/services/warungLicenseService';

test('database records new and returning warungs atomically', { skip: process.env.TEST_WARUNG_DB !== '1' }, async () => {
  await import('dotenv/config');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const name = `test-warung-${randomUUID()}`;
  const rollback = new Error('test rollback');
  try {
    await assert.rejects(prisma.$transaction(async (tx) => {
      const first = await recordWarungLicense(tx, validateWarungLicense({ name, deviceId: '20013', year: 2026 }));
      const second = await recordWarungLicense(tx, validateWarungLicense({ name: ` ${name.toUpperCase()} `, deviceId: '20014', year: 2027 }));
      assert.equal(first.isNew, true);
      assert.equal(second.isNew, false);
      assert.equal(first.warung.id, second.warung.id);
      assert.equal(first.license.code, '140117');
      assert.equal(second.license.code, '140125');
      assert.equal(await tx.warungLicense.count({ where: { warungId: first.warung.id } }), 2);
      throw rollback;
    }, { timeout: 30000 }), (error) => error === rollback);
    assert.equal(await prisma.warung.count({ where: { normalizedName: name } }), 0);
  } finally {
    await prisma.$disconnect();
  }
});
