/** Sarlavhadan id (yakor) yasash. */
export const slugify = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

export function headingsOf(md: string) {
  return md.split('\n').filter((l) => /^#{2,3}\s/.test(l)).map((l) => ({ level: l.startsWith('###') ? 3 : 2, text: l.replace(/^#+\s*/, ''), id: slugify(l.replace(/^#+\s*/, '')) }));
}
