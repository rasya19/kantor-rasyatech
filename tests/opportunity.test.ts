import test from 'node:test';
import assert from 'node:assert/strict';
import { isWeeklyResearch, sourceForOpportunityJob, weeklyResearchId } from '../server/services/opportunityFlow';

test('weekly cycle uses Monday 06:00 WIB and catches up only the current week', () => {
  assert.equal(weeklyResearchId(new Date('2026-11-08T22:59:59Z')), null);
  assert.equal(weeklyResearchId(new Date('2026-11-08T23:00:00Z')), 'weekly-research-2026-11-09');
  assert.equal(weeklyResearchId(new Date('2026-11-15T16:59:59Z')), 'weekly-research-2026-11-09');
  assert.equal(weeklyResearchId(new Date('2026-11-15T23:00:00Z')), 'weekly-research-2026-11-16');
  assert.ok(isWeeklyResearch('weekly-research-2026-11-09'));
  assert.equal(sourceForOpportunityJob('weekly-research-2026-11-09:qa'), 'job-weekly-research-2026-11-09');
  assert.equal(sourceForOpportunityJob('weekly-research-2026-11-09:unknown'), undefined);
});
