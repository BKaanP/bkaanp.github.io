/**
 * Bilingual stopword list (German + English). Includes pronouns, articles,
 * auxiliary verbs, and common prepositions. Shared by query and document
 * tokenization in BM25 so both sides filter symmetrically.
 *
 * Keep this list conservative: removing too many words hurts recall on
 * short queries. These are words that carry almost no discriminative
 * signal in either language.
 */
 
// prettier-ignore
const STOPWORDS = new Set([
  // German articles & pronouns
  'der', 'die', 'das', 'den', 'dem', 'des',
  'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
  'er', 'sie', 'es', 'wir', 'ihr', 'ihn', 'ihm', 'ihnen',
  'mein', 'dein', 'sein', 'ihr', 'unser', 'euer',
  // German verbs (auxiliary, high frequency)
  'ist', 'sind', 'war', 'waren', 'bin', 'bist', 'seid',
  'hat', 'habe', 'hast', 'haben', 'hatte', 'hatten',
  'wird', 'werden', 'wurde', 'wurden',
  'kann', 'kannst', 'können', 'könnte', 'könnten',
  'muss', 'müssen', 'musste', 'sollte',
  // German conjunctions, prepositions, particles
  'und', 'oder', 'aber', 'denn', 'doch', 'also', 'jedoch',
  'in', 'im', 'an', 'am', 'auf', 'aus', 'bei', 'zu', 'zum', 'zur',
  'von', 'vom', 'für', 'mit', 'nach', 'vor', 'über', 'unter',
  'durch', 'gegen', 'ohne', 'um', 'bis',
  'nicht', 'auch', 'nur', 'noch', 'schon', 'mal', 'wohl',
  'als', 'wenn', 'ob', 'dass', 'weil', 'damit',
  // German question words
  'was', 'wer', 'wen', 'wem', 'wessen', 'welche', 'welcher', 'welches',
  'wie', 'wo', 'wann', 'warum', 'wieso', 'weshalb',
  // English articles & pronouns
  'the', 'a', 'an',
  'he', 'she', 'it', 'we', 'they', 'him', 'her', 'them',
  'his', 'hers', 'its', 'our', 'their', 'my', 'your',
  'this', 'that', 'these', 'those',
  // English verbs
  'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being',
  'has', 'have', 'had', 'having',
  'do', 'does', 'did', 'doing',
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',
  // English conjunctions, prepositions
  'and', 'or', 'but', 'nor', 'so', 'yet',
  'in', 'on', 'at', 'by', 'for', 'with', 'from', 'of', 'to',
  'about', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'among',
  'not', 'no', 'only', 'also', 'too', 'very',
  'as', 'if', 'when', 'because', 'since', 'while',
  // English question words
  'what', 'who', 'whom', 'whose', 'which',
  'how', 'where', 'when', 'why',
])
 
export function isStopword(token: string): boolean {
  return STOPWORDS.has(token)
}
 
/**
 * Filter out stopwords and very short tokens (length < 2).
 * Short tokens are almost always noise from OCR artifacts or page numbers.
 */
export function filterTokens(tokens: string[]): string[] {
  return tokens.filter((t) => t.length >= 2 && !STOPWORDS.has(t))
}