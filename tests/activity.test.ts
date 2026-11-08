import test from 'node:test';
import assert from 'node:assert/strict';
import { getActivitySnapshot, trackActivity } from '../server/services/activityService';

test('activity counts concurrent work per division and clears on failure', async () => {
  let finish: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { finish = resolve; });
  const first = trackActivity('creator', 'CREATE', () => gate);
  const second = trackActivity('creator', 'REVISE', () => gate);
  const other = trackActivity('engineer', 'CREATE', () => gate);
  const cyber = trackActivity('cyber', 'REVISE', () => gate);
  const snapshot = getActivitySnapshot();
  assert.deepEqual(snapshot.divisions.find((item) => item.division === 'creator'), { division: 'creator', creating: 1, revising: 1 });
  assert.equal(snapshot.divisions.find((item) => item.division === 'engineer')?.creating, 1);
  assert.equal(snapshot.divisions.find((item) => item.division === 'paud')?.creating, 0);
  assert.equal(snapshot.divisions.find((item) => item.division === 'cyber')?.revising, 1);
  finish?.();
  await Promise.all([first, second, other, cyber]);
  await assert.rejects(trackActivity('creator', 'CREATE', async () => { throw new Error('test failure'); }));
  assert.deepEqual(getActivitySnapshot().divisions.find((item) => item.division === 'creator'), { division: 'creator', creating: 0, revising: 0 });
});
