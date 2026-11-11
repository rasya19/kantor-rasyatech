import test from 'node:test';
import assert from 'node:assert/strict';
import { isOpportunityResearchJob, isOpportunitySprintJob, isWeeklyResearch, opportunityTasks, sourceForOpportunityJob, weeklyResearchId } from '../server/services/opportunityFlow';
import { OFFICE_DIVISIONS } from '../src/workflowTypes';

test('weekly cycle uses Monday 06:00 WIB and catches up only the current week', () => {
  assert.equal(weeklyResearchId(new Date('2026-11-08T22:59:59Z')), null);
  assert.equal(weeklyResearchId(new Date('2026-11-08T23:00:00Z')), 'weekly-research-2026-11-09');
  assert.equal(weeklyResearchId(new Date('2026-11-15T16:59:59Z')), 'weekly-research-2026-11-09');
  assert.equal(weeklyResearchId(new Date('2026-11-15T23:00:00Z')), 'weekly-research-2026-11-16');
  assert.ok(isWeeklyResearch('weekly-research-2026-11-09'));
  assert.ok(isOpportunityResearchJob('weekly-research-2026-11-09'));
  assert.ok(isOpportunityResearchJob('manual-research-58bf9bd1-24fb-4c1a-98eb-a55a5f320a29'));
  assert.ok(isOpportunitySprintJob('weekly-research-2026-11-09'));
  assert.ok(isOpportunitySprintJob('manual-research-58bf9bd1-24fb-4c1a-98eb-a55a5f320a29:creator_lorisan'));
  assert.equal(isOpportunitySprintJob('unrelated-job'), false);
  assert.equal(sourceForOpportunityJob('weekly-research-2026-11-09:engineer_scanbite'), 'job-weekly-research-2026-11-09');
  assert.equal(sourceForOpportunityJob('manual-research-58bf9bd1-24fb-4c1a-98eb-a55a5f320a29:creator_lorisan'), 'job-manual-research-58bf9bd1-24fb-4c1a-98eb-a55a5f320a29');
  assert.equal(sourceForOpportunityJob('weekly-research-2026-11-09:qa'), 'job-weekly-research-2026-11-09');
  assert.equal(isOpportunityResearchJob('manual-research-invalid'), false);
  assert.equal(sourceForOpportunityJob('weekly-research-2026-11-09:unknown'), undefined);
});

test('weekly opportunity sprint routes project, content, and administration tasks to specialist divisions', () => {
  assert.deepEqual(
    Object.fromEntries(OFFICE_DIVISIONS.map((division) => [division, opportunityTasks.filter((task) => task.division === division).length])),
    { paud: 1, posyandu: 1, creator: 3, engineer: 3, cyber: 3, finance: 0, marketing: 0 },
  );
  assert.equal(new Set(opportunityTasks.map((task) => task.taskId)).size, opportunityTasks.length);
  assert.ok(opportunityTasks.some((task) => task.division === 'engineer' && task.title.startsWith('ScanBite')));
  assert.ok(opportunityTasks.some((task) => task.division === 'engineer' && task.title.startsWith('Konter +62')));
  assert.ok(opportunityTasks.some((task) => task.division === 'engineer' && task.title.startsWith('Lorisan Warung')));
  assert.ok(opportunityTasks.some((task) => task.division === 'paud' && task.title.includes('siput.id')));
  assert.ok(opportunityTasks.some((task) => task.division === 'posyandu' && task.title.includes('SIP Posyandu')));
  for (const task of opportunityTasks) {
    assert.match(task.instruction, /jangan/i);
  }
});
