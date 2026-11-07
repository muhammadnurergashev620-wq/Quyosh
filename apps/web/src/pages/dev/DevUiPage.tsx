import { useState } from 'react';
import { ArrowRight, Bell, Calculator, Download, FileText, Moon, Plus, Sun, Trash2, Wrench, Zap } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonGroup } from '@/components/ui/Button';
import { Card, CardHeader, CardLink, IconBox, List, ListItem, Meta } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Breadcrumb, Pagination } from '@/components/ui/Nav';
import { PageHeader } from '@/components/ui/PageHeader';
import { Progress, ProgressRing, Stepper } from '@/components/ui/Progress';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Switch } from '@/components/ui/Switch';
import { Tabs } from '@/components/ui/Tabs';
import { Tooltip } from '@/components/ui/Tooltip';
import { EmptyState } from '@/components/common/EmptyState';
import { INSTALLATION_STATUS, QUOTE_STATUS, REQUEST_STATUS } from '@/features/deals/labels';
import { toast } from '@/lib/toast';
import { getThemeMode, setThemeMode } from '@/lib/theme';
import './DevUiPage.css';

const VARIANTS = ['primary', 'secondary', 'soft', 'ghost', 'danger', 'danger-soft', 'accent', 'link'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

/** /dev/ui — komponentlar ko‘rgazmasi (faqat dev rejimida): barcha variant × o‘lcham × holat, yorug‘ va qorong‘i mavzuda. */
export function DevUiPage() {
  const [dark, setDark] = useState(getThemeMode() === 'dark');
  const [tab, setTab] = useState('all');
  const [seg, setSeg] = useState('30');
  const [chips, setChips] = useState<string[]>(['Montaj']);
  const [page, setPage] = useState(3);
  const [modal, setModal] = useState(false);
  const [check, setCheck] = useState(true);
  const [sw, setSw] = useState(true);
  const toggleTheme = () => { const next = !dark; setDark(next); setThemeMode(next ? 'dark' : 'light'); };

  return (
    <div className="dev-ui">
      <PageHeader eyebrow="DEV · UI" title="Komponentlar ko‘rgazmasi" description="Yagona dizayn tizimi: har bir komponent barcha holatlarda." actions={<Button variant="secondary" leftIcon={dark ? <Sun /> : <Moon />} onClick={toggleTheme}>{dark ? 'Yorug‘ mavzu' : 'Qorong‘i mavzu'}</Button>} />

      <Card><CardHeader title="Button — variantlar × o‘lchamlar" subtitle="hover, active, focus-visible, disabled, loading, success" />
        {SIZES.map((size) => (
          <div key={size} className="dev-ui__row">
            {VARIANTS.map((v) => <Button key={v} variant={v} size={size} rightIcon={v === 'primary' || v === 'accent' ? <ArrowRight /> : undefined}>{v}</Button>)}
            <Button size={size} iconOnly variant="secondary" aria-label="Yuklab olish"><Download /></Button>
          </div>
        ))}
        <div className="dev-ui__row">
          <Button disabled>Disabled</Button>
          <Button loading>Saqlash</Button>
          <Button success leftIcon={<FileText />}>Nusxa olindi</Button>
          <Button variant="danger" leftIcon={<Trash2 />}>O‘chirish</Button>
          <Button leftIcon={<Plus />}>Mahsulot qo‘shish</Button>
        </div>
        <ButtonGroup><Button variant="secondary">Bekor qilish</Button><Button>Taklif yuborish</Button></ButtonGroup>
      </Card>

      <StatGrid>
        <StatCard label="Yangi so‘rovlar" value={128} icon={<Bell />} trend={0.12} trendLabel="o‘tgan oyga nisbatan" spark={[3, 5, 4, 8, 7, 11, 12]} />
        <StatCard label="Quvvat" value={6.6} digits={1} unit="kVt" icon={<Zap />} tone="warning" note="12 ta panel" />
        <StatCard label="Tanlanish foizi" value={42} unit="%" icon={<Calculator />} tone="success" trend={-0.04} />
        <StatCard label="Ma’lumot yo‘q" value={null} icon={<Wrench />} tone="neutral" />
      </StatGrid>
      <StatGrid columns={3}>
        <StatCard variant="compact" label="Compact" value={1250000} unit="so‘m" icon={<FileText />} tone="info" onClick={() => undefined} selected />
        <StatCard variant="compact" label="Yuklanmoqda" value={0} loading icon={<Bell />} />
        <StatCard variant="hero" label="Hero" value={3482} unit="hisob" icon={<Calculator />} tone="violet" />
      </StatGrid>

      <Card><CardHeader title="Tabs va Segmented" />
        <Tabs items={[{ value: 'all', label: 'Hammasi', count: 12 }, { value: 'unread', label: 'O‘qilmagan', count: 3 }, { value: 'offers', label: 'Takliflar' }, { value: 'system', label: 'Tizim' }]} value={tab} onChange={setTab} label="Tablar" />
        <div className="dev-ui__row"><Tabs variant="segmented" items={[{ value: '7', label: '7 kun' }, { value: '30', label: '30 kun' }, { value: '90', label: '90 kun' }]} value={seg} onChange={setSeg} label="Davr" /></div>
      </Card>

      <Card><CardHeader title="Chip, Badge, StatusBadge" />
        <ChipGroup label="Xizmatlar">
          {['Montaj', 'Obyektga chiqish', 'Energiya auditi', 'Texnik xizmat'].map((c) => <Chip key={c} selected={chips.includes(c)} onClick={() => setChips((all) => (all.includes(c) ? all.filter((x) => x !== c) : [...all, c]))}>{c}</Chip>)}
          <Chip onRemove={() => undefined}>Toshkent ×</Chip>
          <Chip>Statik chip</Chip>
        </ChipGroup>
        <div className="dev-ui__row">
          {(['neutral', 'info', 'primary', 'success', 'warning', 'danger'] as const).map((tone) => <Badge key={tone} tone={tone}>{tone}</Badge>)}
          <Badge tone="warning" live>Javob kutilmoqda</Badge>
        </div>
        <div className="dev-ui__row">
          <StatusBadge map={REQUEST_STATUS} status="OPEN" />
          <StatusBadge map={QUOTE_STATUS} status="ACCEPTED" />
          <StatusBadge map={INSTALLATION_STATUS} status="INSTALLED" />
          <StatusBadge map={INSTALLATION_STATUS} status="DISPUTED" />
        </div>
      </Card>

      <div className="dev-ui__grid">
        <Card><CardHeader icon={<FileText />} title="Form elementlari" subtitle="46 px, surface-muted, fokus halqasi" />
          <div className="dev-ui__form">
            <Input label="Telefon raqami" prefix="+998" placeholder="90 123 45 67" hint="SMS kod shu raqamga keladi" />
            <Input label="Tizim narxi" suffix="so‘m" defaultValue="60 000 000" error="Summa juda katta" />
            <Input label="Parol" type="password" defaultValue="secret-123" />
            <Select label="Viloyat" options={[{ value: 'tsh', label: 'Toshkent shahri' }, { value: 'sam', label: 'Samarqand viloyati' }, { value: 'bux', label: 'Buxoro viloyati' }]} defaultValue="tsh" />
            <Checkbox label="Shartlarni qabul qilaman" checked={check} onChange={(e) => setCheck(e.target.checked)} />
            <label className="dev-ui__radio"><input type="radio" name="r" defaultChecked /> Tarmoqqa ulangan</label>
            <label className="dev-ui__radio"><input type="radio" name="r" /> Gibrid</label>
            <Switch label="SMS bildirishnomalar" checked={sw} onChange={setSw} />
          </div>
        </Card>
        <Card variant="highlight"><CardHeader icon={<Bell />} title="Ro‘yxat qatorlari" action={<CardLink to="/dev/ui">Hammasi</CardLink>} />
          <List>
            <ListItem media={<IconBox tone="info"><FileText /></IconBox>} title="Toshkent Quyosh Tizimlari taklif yubordi" meta={<Meta parts={['20 917 756 so‘m', '1,65 kVt', '5 daqiqa oldin']} />} trailing={<StatusBadge map={QUOTE_STATUS} status="SENT" />} onClick={() => undefined} unread />
            <ListItem media={<IconBox tone="success"><Wrench /></IconBox>} title="Montaj sanasi belgilandi" meta={<Meta parts={['2 noyabr', '10:00']} />} trailing="12 mln" to="/dev/ui" chevron />
            <ListItem media={<IconBox tone="violet"><Bell /></IconBox>} title="Yangi xabar" meta="Assalomu alaykum! Tomingiz qaysi tomonga qaragan?" />
          </List>
        </Card>
      </div>

      <div className="dev-ui__grid">
        <Card><CardHeader title="Bannerlar" />
          <div className="dev-ui__stack">
            <Alert tone="info" title="Test rejimi">Tasdiqlash kodi: 123456</Alert>
            <Alert tone="success" title="Taklif yuborildi" dismissible>Mijoz javobini kutamiz.</Alert>
            <Alert tone="warning" title="Parolni almashtiring" action={<Button size="sm" variant="secondary">Almashtirish</Button>}>Vaqtincha parol bilan kirdingiz.</Alert>
            <Alert tone="danger" title="Do‘kon vaqtincha to‘xtatilgan">Faqat ko‘rish mumkin.</Alert>
          </div>
        </Card>
        <Card><CardHeader title="Progress, Stepper, Nav" />
          <div className="dev-ui__row"><ProgressRing value={0.75} /><ProgressRing value={0.42} tone="success" size={64} stroke={7} /><Progress value={0.6} /></div>
          <Stepper steps={['Ma’lumot', 'Tasdiqlash', 'Tayyor']} current={1} />
          <Breadcrumb items={[{ label: 'So‘rovlar', to: '/dev/ui' }, { label: '№12' }, { label: 'Taklif' }]} />
          <Pagination page={page} pages={9} onChange={setPage} />
          <div className="dev-ui__row"><Tooltip content="kVt — tizimning eng yuqori quvvati"><Button variant="secondary" size="sm">Tooltip (400 ms)</Button></Tooltip><Button variant="secondary" size="sm" onClick={() => setModal(true)}>Modal</Button></div>
          <div className="dev-ui__row">
            <Button variant="soft" size="sm" onClick={() => toast.success('Taklif yuborildi', { description: 'Mijozga bildirishnoma ketdi.' })}>Toast success</Button>
            <Button variant="soft" size="sm" onClick={() => toast.error('Yuborib bo‘lmadi', { description: 'Internetni tekshiring.' })}>Toast error</Button>
            <Button variant="soft" size="sm" onClick={() => toast.warning('Muddat tugayapti')}>Toast warning</Button>
            <Button variant="soft" size="sm" onClick={() => toast.info('Yangi xabar', { action: { label: 'Ko‘rish', onClick: () => undefined } })}>Toast info</Button>
            <Button variant="soft" size="sm" onClick={() => void toast.promise(new Promise((r) => setTimeout(r, 1500)), { loading: 'Yuborilmoqda…', success: 'Yuborildi', error: 'Xato' })}>Promise toast</Button>
          </div>
        </Card>
      </div>

      <div className="dev-ui__grid">
        <Card><EmptyState icon={<Bell size={28} />} title="Hozircha yangilik yo‘q" description="So‘rov, taklif va montaj xabarlari shu yerda paydo bo‘ladi." action={<Button size="sm">Hisob qilish</Button>} /></Card>
        <Card><ErrorState onRetry={() => undefined} /></Card>
        <Card><div className="dev-ui__stack"><Skeleton /><Skeleton className="dev-ui__sk-wide" /><Skeleton className="dev-ui__sk-block" /></div></Card>
      </div>

      <div className="dev-ui__grid">
        <Card variant="dark"><CardHeader title="Dark karta" subtitle="ink fon" /><Button variant="accent" rightIcon={<ArrowRight />}>Do‘konlardan taklif olish</Button></Card>
        <Card variant="gradient"><CardHeader title="Gradient karta" subtitle="profil sarlavhasi" /></Card>
        <Card variant="muted" interactive><CardHeader title="Muted + interactive" subtitle="hover — 2 px ko‘tariladi" /></Card>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Do‘konni to‘xtatish" icon={<Trash2 size={22} />} footer={<><Button variant="secondary" onClick={() => setModal(false)}>Bekor qilish</Button><Button variant="danger" onClick={() => setModal(false)}>To‘xtatish</Button></>}>
        Do‘kon ro‘yxat va xaritadan yashiriladi, xodimlar faqat ko‘rish rejimida kiradi.
      </Modal>
    </div>
  );
}
