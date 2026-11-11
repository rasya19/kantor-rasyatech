import type { OfficeDivision } from '../../src/workflowTypes';
import { openRouterModel } from './openrouter';

export type AiSelection = { provider: 'openrouter'; model: string };

export function selectAi(division?: OfficeDivision): AiSelection {
  return { provider: 'openrouter', model: openRouterModel(division) };
}
