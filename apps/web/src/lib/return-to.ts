const KEY = 'quyosh.return-to';

/**
 * Faqat shu saytdagi yo‘l: "/" bilan boshlanadi, "//" va "/\" emas (brauzer ikkalasini ham boshqa domen deb tushunadi),
 * teskari chiziq va boshqaruv belgilari yo‘q.
 */
export function isSafeInternalPath(path: string | null | undefined): path is string {
  return !!path && path.startsWith('/') && !/^\/[/\\]/.test(path) && !/[\\\u0000-\u001f]/.test(path);
}

/** Kirishdan keyin qaytish manzili (masalan, do‘kon taklifi havolasi). Faqat ichki yo‘l saqlanadi. */
export function rememberReturnTo(path: string): void {
  if (isSafeInternalPath(path)) sessionStorage.setItem(KEY, path);
}

export function consumeReturnTo(): string | null {
  const value = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  return isSafeInternalPath(value) ? value : null;
}

/** Tashqi havola faqat http(s) bo‘lsa (`javascript:` va `data:` kabi sxemalar bloklanadi). */
export function safeExternalUrl(url: string | null | undefined): string | undefined {
  return url && /^https?:\/\/[^\s]+$/i.test(url.trim()) ? url.trim() : undefined;
}
