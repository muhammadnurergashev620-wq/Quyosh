/** Sana/vaqtni foydalanuvchiga ko‘rsatish uchun formatlaydi (Toshkent vaqti, masalan "27-sentabr, 14:30"). */
export function formatUzDateTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('uz-Latn-UZ', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tashkent',
  }).format(date);
}
