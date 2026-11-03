import { describe, expect, it } from 'vitest';
import { pickRequiredPolicyIds } from './policies';

describe('pickRequiredPolicyIds', () => {
  it('takes the newest published version of each required type, in a stable order', () => {
    const ids = pickRequiredPolicyIds([
      { id: 'priv-1', type: 'PRIVACY', publishedAt: '2026-01-01T00:00:00Z' },
      { id: 'terms-1', type: 'TERMS', publishedAt: '2026-01-01T00:00:00Z' },
      { id: 'terms-2', type: 'TERMS', publishedAt: '2026-06-01T00:00:00Z' },
      { id: 'rules-1', type: 'PLATFORM_RULES', publishedAt: null },
      { id: 'offer-1', type: 'PUBLIC_OFFER', publishedAt: '2026-01-01T00:00:00Z' },
    ]);
    expect(ids).toEqual(['terms-2', 'priv-1', 'rules-1']);
  });

  it('skips missing types instead of inventing ids', () => {
    expect(pickRequiredPolicyIds([])).toEqual([]);
  });
});
