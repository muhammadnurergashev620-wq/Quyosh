interface IconProps {
  size?: number;
}

/** Yandex Xarita belgisi: qizil nuqta (pin) ichida oq doira. */
export function YandexMapsIcon({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <ellipse cx="20" cy="35" rx="7" ry="2.2" fill="#000" opacity="0.14" />
      <path d="M20 3C13 3 7.5 8.4 7.5 15.2c0 8.4 9.3 15.6 11.6 19.2.4.6 1.4.6 1.8 0 2.3-3.6 11.6-10.8 11.6-19.2C32.5 8.4 27 3 20 3Z" fill="#FC3F1D" />
      <circle cx="20" cy="15" r="5.2" fill="#fff" />
    </svg>
  );
}

/** OpenStreetMap (Nominatim) — yashil xarita belgisi. */
export function OpenStreetMapIcon({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#7EBC6F" />
      <path d="M20 8c-4.6 0-8 3.4-8 7.7 0 5.5 6.2 10.6 7.4 12.6.3.5 1 .5 1.2 0C21.8 26.3 28 21.2 28 15.7 28 11.4 24.6 8 20 8Z" fill="#fff" />
      <circle cx="20" cy="15.5" r="3" fill="#7EBC6F" />
    </svg>
  );
}

/** OSRM (Open Source Routing Machine): ko‘k belgi ustida marshrut chizig‘i. */
export function OsrmIcon({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="2" y="2" width="36" height="36" rx="10" fill="#2F6FED" />
      <path d="M12 28c0-5 4-5 8-5s8 0 8-5.5S25 12 22 12" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="0.1 5.2" opacity="0.55" />
      <path d="M12 28c0-5 4-5 8-5s8 0 8-5.5S25 12 22 12" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="12" cy="28.5" r="3.2" fill="#fff" />
      <circle cx="12" cy="28.5" r="1.4" fill="#2F6FED" />
      <path d="M22 7.5 28.5 12 22 16.5Z" fill="#fff" />
    </svg>
  );
}

/** Telegram rasmiy belgisi: ko‘k doira va oq qog‘oz samolyot. */
export function TelegramIcon({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#229ED9" />
      <path d="M9.6 19.7 28.8 12.3c.9-.3 1.7.2 1.4 1.5l-3.3 15.4c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L13.6 22.5l-4.9-1.5c-1.1-.3-1.1-1.1.2-1.6Z" fill="#fff" />
    </svg>
  );
}
