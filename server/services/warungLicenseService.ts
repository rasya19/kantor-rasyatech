import type { Prisma } from '@prisma/client';
import type { validateWarungLicense } from '../../src/lib/warungLicense';

export async function recordWarungLicense(tx: Prisma.TransactionClient, input: ReturnType<typeof validateWarungLicense>) {
  const created = await tx.warung.createMany({
    data: [{ name: input.name, normalizedName: input.normalizedName }],
    skipDuplicates: true,
  });
  const warung = await tx.warung.findUniqueOrThrow({ where: { normalizedName: input.normalizedName } });
  const license = await tx.warungLicense.create({
    data: { warungId: warung.id, deviceId: input.deviceId, year: input.year, code: input.code },
  });
  return { warung: { id: warung.id, name: warung.name }, license, isNew: created.count === 1 };
}
