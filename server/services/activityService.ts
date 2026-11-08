import { randomUUID } from 'node:crypto';
import type { ActivityAction, ActivitySnapshot, OfficeDivision } from '../../src/workflowTypes';
import { OFFICE_DIVISIONS } from '../../src/workflowTypes';

const running = new Map<string, { division: OfficeDivision; action: ActivityAction }>();

export async function trackActivity<T>(division: OfficeDivision, action: ActivityAction, work: () => Promise<T>): Promise<T> {
  const id = randomUUID();
  running.set(id, { division, action });
  try {
    return await work();
  } finally {
    running.delete(id);
  }
}

export function getActivitySnapshot(): ActivitySnapshot {
  return {
    observedAt: new Date().toISOString(),
    divisions: OFFICE_DIVISIONS.map((division) => {
      const activities = [...running.values()].filter((item) => item.division === division);
      return {
        division,
        creating: activities.filter((item) => item.action === 'CREATE').length,
        revising: activities.filter((item) => item.action === 'REVISE').length,
      };
    }),
  };
}
