import * as pdfjs from 'pdfjs-dist'
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
 
// pdf.js runs in a web worker to keep the main thread responsive.
// Vite's `?url` import gives us the worker bundle path.
pdfjs.GlobalWorkerOptions.workerSrc = PdfjsWorker
 
export interface PageText {
  page: number
  text: string
}
 
/**
 * Extract text from a PDF, one entry per page.
 * Whitespace is normalized but structure is largely preserved.
 */
export async function extractPdfText(file: File): Promise<PageText[]> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  const pages: PageText[] = []
 
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
 
    // pdf.js returns an item per text run; join with spaces and collapse whitespace.
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
 
    pages.push({ page: i, text })
  }
 
  return pages
}
 