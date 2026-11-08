import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Markdown } from './Markdown';
import { headingsOf } from './Markdown.helpers';

const md = (s: string) => render(<MemoryRouter><Markdown source={s} /></MemoryRouter>).container;

describe('Markdown (xavfsiz)', () => {
  it('sarlavha, ro‘yxat, jadval va qalin matn', () => {
    const c = md('## Asosiy g‘oya\n\nMatn **qalin**.\n\n- bir\n- ikki\n\n| A | B |\n|---|---|\n| 1 | 2 |');
    expect(c.querySelector('h2')?.id).toBe('asosiy-g-oya');
    expect(c.querySelector('strong')?.textContent).toBe('qalin');
    expect(c.querySelectorAll('li')).toHaveLength(2);
    expect(c.querySelector('td')?.textContent).toBe('1');
  });
  it('HTML va javascript: havolalar bajarilmaydi', () => {
    const c = md('<img src=x onerror=alert(1)> [x](javascript:alert(1)) [ok](https://pvgis.eu)');
    expect(c.querySelector('img')).toBeNull();
    expect(c.querySelectorAll('a')).toHaveLength(1);
    expect(c.querySelector('a')?.getAttribute('rel')).toContain('noopener');
  });
  it('mundarija', () => {
    expect(headingsOf('## A\ntext\n### B')).toEqual([{ level: 2, text: 'A', id: 'a' }, { level: 3, text: 'B', id: 'b' }]);
  });
});
