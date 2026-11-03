/** Strip obvious personal data before text is sent to a model. Names of companies are kept: they are the evidence. */
export function redact(s: string): string {
  return s
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+?\d[\d\s().-]{8,}\d)/g, "[phone]")
    .replace(/\bhttps?:\/\/\S+/gi, "[link]");
}
