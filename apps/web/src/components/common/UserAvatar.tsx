import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { cx, initials } from '@/lib/utils';
import { avatarSrc } from '@/lib/avatar';
import './UserAvatar.css';

const TONES = 8;

/** Foydalanuvchiga barqaror rang (0..7) beradi — avatar uchun. */
export function avatarTone(seed: string | null | undefined): number {
  const value = seed ?? '';
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % TONES;
}

interface UserAvatarProps {
  name: string;
  seed: string;
  size?: 'sm' | 'md' | 'lg';
  admin?: boolean;
  /** Profil rasmi (backenddagi `avatar`). Yuklanmasa yoki bo‘lmasa — bosh harflar ko‘rsatiladi. */
  src?: string | null;
}

export function UserAvatar({ name, seed, size = 'md', admin = false, src }: UserAvatarProps) {
  const url = avatarSrc(src);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  if (admin) {
    return (
      <span className={cx('gm-chat-avatar', `gm-chat-avatar--${size}`, 'gm-chat-avatar--admin')} aria-hidden="true">
        <ShieldCheck size={size === 'lg' ? 26 : size === 'sm' ? 14 : 20} />
      </span>
    );
  }
  const showImage = !!url && !failed;
  return (
    <span className={cx('gm-chat-avatar', `gm-chat-avatar--${size}`, !showImage && `gm-tone-${avatarTone(seed || name)}`, showImage && 'gm-chat-avatar--photo')} aria-hidden="true">
      {showImage ? <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} /> : initials(name)}
    </span>
  );
}
