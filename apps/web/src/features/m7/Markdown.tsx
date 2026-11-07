import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { isSafeInternalPath } from '@/lib/return-to';

/**
 * Bilimlar markazi uchun kichik, xavfsiz Markdown renderer: HTML qabul qilinmaydi (matn React orqali),
 * havolalar faqat http(s) yoki ichki yo‘llar. Qo‘llab-quvvatlanadi: ##/### sarlavhalar, paragraf, ro‘yxatlar,
 * jadval, **qalin**, *kursiv*, `kod`, [havola](url).
 */
const slugify = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[2]) out.push(<strong key={k}>{m[2]}</strong>);
    else if (m[3]) out.push(<em key={k}>{m[3]}</em>);
    else if (m[4]) out.push(<code key={k}>{m[4]}</code>);
    else if (m[5] && m[6]) {
      const href = m[6];
      if (isSafeInternalPath(href)) out.push(<Link key={k} to={href}>{m[5]}</Link>);
      else if (/^https?:\/\//.test(href)) out.push(<a key={k} href={href} target="_blank" rel="noopener noreferrer">{m[5]}</a>);
      else out.push(m[5]);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function headingsOf(md: string) {
  return md.split('\n').filter((l) => /^#{2,3}\s/.test(l)).map((l) => ({ level: l.startsWith('###') ? 3 : 2, text: l.replace(/^#+\s*/, ''), id: slugify(l.replace(/^#+\s*/, '')) }));
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) { i += 1; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = Math.min(4, Math.max(2, h[1]!.length));
      const Tag = (`h${level}` as 'h2' | 'h3' | 'h4');
      blocks.push(<Tag key={key++} id={slugify(h[2]!)}>{inline(h[2]!, key)}</Tag>);
      i += 1;
      continue;
    }
    if (/^\|/.test(line) && /^\|?\s*:?-{2,}/.test(lines[i + 1] ?? '')) {
      const cells = (l: string) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i]!)) { rows.push(cells(lines[i]!)); i += 1; }
      blocks.push(
        <div key={key++} className="qs-md-table"><table><thead><tr>{head.map((c, j) => <th key={j}>{inline(c, j)}</th>)}</tr></thead><tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, j)}</td>)}</tr>)}</tbody></table></div>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) { items.push(lines[i]!.replace(/^\s*([-*]|\d+\.)\s+/, '')); i += 1; }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(<List key={key++}>{items.map((it, j) => <li key={j}>{inline(it, j)}</li>)}</List>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,4}\s|\||\s*([-*]|\d+\.)\s+)/.test(lines[i]!)) { para.push(lines[i]!); i += 1; }
    blocks.push(<p key={key++}>{para.map((p, j) => <Fragment key={j}>{j > 0 && ' '}{inline(p, j)}</Fragment>)}</p>);
  }
  return <div className="qs-md">{blocks}</div>;
}
