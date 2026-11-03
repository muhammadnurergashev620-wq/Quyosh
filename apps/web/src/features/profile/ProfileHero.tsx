import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { UserAvatar } from '@/components/common/UserAvatar';
import './Profile.css';

export interface ProfileStat {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
}

interface ProfileHeroProps {
  name: string;
  seed: string;
  accountNumber?: number;
  subtitle?: string | null;
  badges?: ReactNode;
  stats: ProfileStat[];
  /** Tayyor avatar (masalan, yuklash tugmali AvatarEditor). Berilmasa — oddiy avatar. */
  avatar?: ReactNode;
}

export function ProfileHero({ name, seed, accountNumber, subtitle, badges, stats, avatar }: ProfileHeroProps) {
  return (
    <section className="gm-phero">
      <div className="gm-phero__cover" aria-hidden="true" />
      <div className="gm-phero__body">
        {avatar ?? <UserAvatar name={name} seed={seed} size="lg" />}
        <div className="gm-phero__who">
          <div className="gm-phero__name">
            <h2>{name}</h2>
            {accountNumber !== undefined && <span className="gm-phero__id">ID {accountNumber}</span>}
          </div>
          {subtitle && <p>{subtitle}</p>}
          {badges && <div className="gm-phero__badges">{badges}</div>}
        </div>
      </div>
      <dl className="gm-phero__stats">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label}>
              <dt>
                <Icon size={15} aria-hidden="true" /> {stat.label}
              </dt>
              <dd>
                {stat.value}
                {stat.hint && <small>{stat.hint}</small>}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
