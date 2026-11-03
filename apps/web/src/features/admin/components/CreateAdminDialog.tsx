import { useState } from "react";
import { Check, CheckCircle2, Copy, RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { splitFullName } from '@/lib/account-name';
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { getErrorMessage } from "@/lib/error-messages";
import {
  formatLocalPhone,
  toFullPhone,
  toLocalDigits,
} from "@/features/auth/validation";
import { useCreateAdmin } from "../hooks/useAdmin";
import type { AdminScope } from "../types";
import { ADMIN_PERMISSION_OPTIONS } from "../permissions";
import { PermissionPicker } from "./PermissionPicker";
import { t } from '@/i18n';

/** Tasodifiy, o‘qish oson (o‘xshash belgilarsiz) parol. */
function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (value) => chars.charAt(value % chars.length)).join(
    "",
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="gm-save__field">
      <span className="gm-save__label">{label}</span>
      <div className="gm-save__box">
        <span className="gm-save__value">{value}</span>
        <button
          type="button"
          className={done ? "gm-save__btn gm-save__btn--done" : "gm-save__btn"}
          aria-label={t('{label}ni nusxalash', { label })}
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setDone(true);
              window.setTimeout(() => setDone(false), 1800);
            });
          }}
        >
          {done ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}
          <span>{done ? t('Nusxalandi') : t('Nusxa')}</span>
        </button>
      </div>
    </div>
  );
}

/** Yangi admin yaratish (faqat superadmin). Yaratilgach login va parol bir marta ko‘rsatiladi. */
export function CreateAdminDialog({ onClose, scope }: { onClose: () => void; scope?: AdminScope }) {
  const superAdminActor = scope?.superAdmin ?? true;
  const grantable = scope && !scope.superAdmin ? scope.grantable : undefined;
  const create = useCreateAdmin();
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const names = splitFullName(fullName);
  const [password, setPassword] = useState(() => generatePassword());
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [canCreateAdmins, setCanCreateAdmins] = useState(false);
  const [grantablePermissions, setGrantablePermissions] = useState<string[]>([]);
  const [created, setCreated] = useState<{
    phone: string;
    password: string;
    name: string;
    isSuperAdmin: boolean;
    permissionCount: number;
  } | null>(null);

  const digits = toLocalDigits(phone);
  const valid =
    digits.length === 9 &&
    !!names &&
    password.length >= 8 &&
    (isSuperAdmin || permissions.length > 0) &&
    (isSuperAdmin || !canCreateAdmins || grantablePermissions.length > 0);

  function submit() {
    if (!valid) return;
    const fullPhone = toFullPhone(digits);
    create.mutate(
      {
        phone: fullPhone,
        password,
        firstName: names!.firstName,
        lastName: names!.lastName,
        isSuperAdmin,
        permissions: isSuperAdmin ? [] : permissions,
        ...(superAdminActor && !isSuperAdmin && canCreateAdmins ? { canCreateAdmins: true, grantablePermissions } : {}),
      },
      {
        onSuccess: () =>
          setCreated({
            phone: fullPhone,
            password,
            name: fullName.trim().replace(/\s+/g, ' '),
            isSuperAdmin,
            permissionCount: isSuperAdmin
              ? ADMIN_PERMISSION_OPTIONS.length
              : permissions.length,
          }),
      },
    );
  }

  if (created) {
    return (
      <Modal
        open
        onClose={onClose}
        title={t('Admin yaratildi')}
        footer={<Button onClick={onClose}>{t('Tayyor')}</Button>}
      >
        <div className="gm-newadm gm-newadm--done">
          <div className="gm-newadm__ok">
            <span className="gm-newadm__ok-icon" aria-hidden="true">
              <CheckCircle2 size={26} />
            </span>
            <div>
              <strong>{created.name}</strong>
              <p>{t('admin sifatida qo‘shildi')}{created.isSuperAdmin
                  ? t(' (superadmin: barcha bo‘limlar)')
                  : t(' ({permissionCount} ta bo‘limga ruxsat bilan)', { permissionCount: created.permissionCount })}
                .
              </p>
            </div>
          </div>
          <div className="gm-newadm__creds">
            <CopyRow label={t('Login (telefon)')} value={created.phone} />
            <CopyRow label={t('Parol')} value={created.password} />
          </div>
          <p className="gm-newadm__warn" role="note">{t('Login va parolni adminga xavfsiz yo‘l bilan yetkazing.')}<strong>{t('Parol keyin qayta ko‘rsatilmaydi.')}</strong>
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={create.isPending ? () => undefined : onClose}
      title={t('Yangi admin yaratish')}
      large
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={create.isPending}
          >{t('Bekor qilish')}</Button>
          <Button loading={create.isPending} disabled={!valid} onClick={submit}>{t('Admin yaratish')}</Button>
        </>
      }
    >
      <form
        className="gm-newadm"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        noValidate
      >
        {create.isError && (
          <Alert tone="danger">{getErrorMessage(create.error)}</Alert>
        )}
        <section className="gm-newadm__sec" aria-labelledby="gm-newadm-s1">
          <h3 id="gm-newadm-s1" className="gm-newadm__sec-title">{t('Shaxsiy ma’lumotlar')}</h3>
          <Input
            label={t('Telefon raqami')}
            prefix="+998"
            inputMode="numeric"
            placeholder="90 123 45 67"
            maxLength={12}
            formatValue={formatLocalPhone}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoFocus
          />
          <Input
            label={t('To‘liq ism')}
            placeholder={t('Masalan: Kamronbek Ziyovuddinov')}
            value={fullName}
            maxLength={200}
            onChange={(event) => setFullName(event.target.value)}
          />
        </section>

        <section className="gm-newadm__sec" aria-labelledby="gm-newadm-s2">
          <h3 id="gm-newadm-s2" className="gm-newadm__sec-title">{t('Kirish paroli')}</h3>
          <div className="gm-newadm__pw">
            <Input
              label={t('Parol')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="gm-newadm__pwbar">
              <span>{t('Kamida 8 ta belgi')}</span>
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
              >
                <RefreshCw size={14} aria-hidden="true" />{' '}{t('Yangi parol yaratish')}</button>
            </div>
          </div>
        </section>

        <section className="gm-newadm__sec" aria-labelledby="gm-newadm-s3">
          <h3 id="gm-newadm-s3" className="gm-newadm__sec-title">{t('Huquqlar')}</h3>
          {superAdminActor && (
            <label className="gm-newadm__super">
              <input
                type="checkbox"
                checked={isSuperAdmin}
                onChange={(event) => setIsSuperAdmin(event.target.checked)}
              />
              <span>
                <strong>{t('Superadmin huquqi')}</strong>
                <small>{t('Boshqa adminlarni yaratish va boshqarish mumkin bo‘ladi. Odatda kerak emas.')}</small>
              </span>
            </label>
          )}
          {!isSuperAdmin && (
            <PermissionPicker
              value={permissions}
              onChange={setPermissions}
              disabled={create.isPending}
              allowed={grantable}
            />
          )}
          {superAdminActor && !isSuperAdmin && (
            <>
              <label className="gm-newadm__super">
                <input
                  type="checkbox"
                  checked={canCreateAdmins}
                  onChange={(event) => setCanCreateAdmins(event.target.checked)}
                />
                <span>
                  <strong>{t('Yangi adminlar yarata oladi')}</strong>
                  <small>{t('Bu admin o‘zi yaratgan adminlarni boshqaradi. Qaysi huquqlarni bera olishini quyida o‘zingiz belgilaysiz.')}</small>
                </span>
              </label>
              {canCreateAdmins && (
                <PermissionPicker
                  value={grantablePermissions}
                  onChange={setGrantablePermissions}
                  disabled={create.isPending}
                  title={t('Yangi adminlarga bera oladigan huquqlar')}
                />
              )}
            </>
          )}
        </section>
      </form>
    </Modal>
  );
}
