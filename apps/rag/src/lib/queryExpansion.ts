import Anthropic from '@anthropic-ai/sdk'
 
const EXPANSION_MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 300
 
/**
 * Query Expansion via LLM — the production technique often called "HyDE"
 * (Hypothetical Document Embeddings) when applied to semantic search.
 *
 * The original query is rewritten into 2–3 phrasings that are more likely
 * to match how the answer would be worded *inside* a document. This
 * compensates for the vocabulary mismatch between how users ask and how
 * documents state things.
 *
 * Example:
 *   original:  "welche programmiererfahrung hat er"
 *   expanded:  ["programmiersprachen python java javascript",
 *               "full-stack developer berufserfahrung",
 *               "entwickelte mit react node.js"]
 *
 * We return the original plus the expansions so downstream retrieval
 * can run against all of them.
 */
export async function expandQuery(params: {
  apiKey: string
  query: string
}): Promise<{ original: string; expansions: string[] }> {
  const { apiKey, query } = params
 
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
 
  const systemPrompt = [
    'You rewrite search queries so they match how answers are typically phrased inside documents.',
    'Given a question, produce 2 or 3 short alternative phrasings that are likely to appear verbatim in a document that answers it.',
    '',
    'Rules:',
    '- Match the language of the input query.',
    '- Each phrasing should be a noun phrase or declarative fragment, NOT a question.',
    '- Focus on concrete terms the document would actually use.',
    '- Keep each phrasing under 10 words.',
    '- Output ONE phrasing per line. No numbering. No explanations. No quotes.',
  ].join('\n')
 
  try {
    const response = await client.messages.create({
      model: EXPANSION_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: query }],
    })
 
    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return { original: query, expansions: [] }
    }
 
    const expansions = textBlock.text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.length < 200)
      .slice(0, 3)
 
    return { original: query, expansions }
  } catch (err) {
    // Expansion failure is non-fatal — fall back to original query only.
    console.warn('Query expansion failed, using original query:', err)
    return { original: query, expansions: [] }
  }
}