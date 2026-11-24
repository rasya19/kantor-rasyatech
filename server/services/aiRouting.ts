import type { OfficeDivision } from '../../src/workflowTypes.js';
import { openRouterModel } from './openrouter.js';

export type AiSelection = { provider: 'openrouter'; model: string };

export function selectAi(division?: OfficeDivision): AiSelection {
  return { provider: 'openrouter', model: openRouterModel(division) };
}
