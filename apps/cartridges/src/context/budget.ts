export interface ContextSection { id: string; text: string; required?: boolean; }
export interface ContextBudget { maxInputTokens: number; maxOutputTokens: number; }
export interface ContextComposition { prompt: string; estimatedInputTokens: number; included: string[]; dropped: string[]; }

// Conservative model-independent estimate for enforcing a hard pre-tokenizer ceiling.
export function estimateTokens(text: string): number {
  return Math.ceil(new TextEncoder().encode(text).byteLength / 3);
}

export function composeContext(sections: readonly ContextSection[], budget: ContextBudget): ContextComposition {
  if (budget.maxInputTokens <= 0 || budget.maxOutputTokens <= 0) throw new Error('Context budgets must be positive.');
  const included: string[] = [];
  const dropped: string[] = [];
  const chunks: string[] = [];
  let used = 0;
  for (const section of sections) {
    const text = section.text.trim();
    if (!text) continue;
    const cost = estimateTokens(text + '\n\n');
    if (used + cost <= budget.maxInputTokens) {
      chunks.push(text); included.push(section.id); used += cost;
    } else if (section.required) {
      throw new Error(`Required context section exceeds budget: ${section.id}`);
    } else dropped.push(section.id);
  }
  return { prompt: chunks.join('\n\n'), estimatedInputTokens: estimateTokens(chunks.join('\n\n')), included, dropped };
}
