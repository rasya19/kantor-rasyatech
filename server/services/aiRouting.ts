import { isOfficeDivision, type OfficeDivision } from '../../src/workflowTypes';

export type AiSelection = { provider: 'gemini' | 'copilot'; model: string };

export function selectAi(division?: OfficeDivision): AiSelection {
  const configured = (process.env.AI_COPILOT_DIVISIONS || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (configured.some((item) => !isOfficeDivision(item))) throw new Error('AI_COPILOT_DIVISIONS berisi divisi yang tidak valid.');
  if (division && configured.includes(division)) {
    const model = process.env[`COPILOT_MODEL_${division.toUpperCase()}`]?.trim() || process.env.COPILOT_MODEL?.trim();
    if (!model) throw new Error(`Model Copilot untuk divisi ${division} belum dikonfigurasi.`);
    return { provider: 'copilot', model };
  }
  return { provider: 'gemini', model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite' };
}
