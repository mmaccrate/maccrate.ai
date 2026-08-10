import { describe, expect, it } from 'vitest';
import {
  STAGEHAND_SYSTEM_PROMPT,
  applyStagehandResponse,
  initialStagehandScene,
  parseStagehandResponse,
  stagehandPrompt,
  StagehandContractError,
} from './contract';

describe('Stagehand browser contract', () => {
  it('parses and applies a legal color edit atomically', () => {
    const response = parseStagehandResponse(JSON.stringify({ result: 'apply', ops: [{ op: 'color', target: 'title', value: '#d88932' }], message: 'Title color changed.' }));
    const scene = applyStagehandResponse(initialStagehandScene(), response);
    expect(scene.objects.title.color).toBe('#d88932');
    expect(scene.objects.subtitle.color).toBe('#a7afbf');
  });

  it('accepts scene reset before authored-target validation and restores the initial scene', () => {
    const changed = initialStagehandScene();
    changed.objects.title.color = '#d88932';
    const response = parseStagehandResponse('{"result":"apply","ops":[{"op":"reset","target":"scene"}]}');
    expect(applyStagehandResponse(changed, response)).toEqual(initialStagehandScene());
  });

  it('rejects malformed operations instead of repairing them', () => {
    expect(() => parseStagehandResponse(JSON.stringify({ result: 'apply', ops: [{ op: 'move', target: 'potato', x: .5, y: .5 }] }))).toThrow(StagehandContractError);
    expect(() => parseStagehandResponse('not json')).toThrow(StagehandContractError);
  });

  it('keeps unsupported and clarification responses non-mutating', () => {
    const scene = initialStagehandScene();
    const unsupported = parseStagehandResponse(JSON.stringify({ result: 'unsupported', reason_code: 'new_object_creation', message: 'I can only edit existing scene objects.', suggestions: ['change_color'] }));
    const clarify = parseStagehandResponse(JSON.stringify({ result: 'clarify', reason_code: 'ambiguous_target', question: 'Which spotlight should I edit?' }));
    expect(applyStagehandResponse(scene, unsupported)).toEqual(scene);
    expect(applyStagehandResponse(scene, clarify)).toEqual(scene);
  });

  it('freezes the exact trained no-thinking prompt contract and canonical scene order', () => {
    expect(STAGEHAND_SYSTEM_PROMPT).toContain('Return exactly one JSON object');
    expect(STAGEHAND_SYSTEM_PROMPT).toContain('- color: {op, target, value}');
    expect(STAGEHAND_SYSTEM_PROMPT).toContain('Never substitute a nearby object');
    const prompt = stagehandPrompt(initialStagehandScene(), 'Make the title amber.');
    expect(prompt).toMatch(/^CURRENT_SCENE:\n\{"objects":/);
    expect(prompt).toContain('\nREQUEST:\nMake the title amber.');
  });
});
