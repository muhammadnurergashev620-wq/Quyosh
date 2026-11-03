# Xavfsizlik siyosati

## Zaiflik haqida xabar berish

Xavfsizlik zaifligini topsangiz, uni ochiq issue sifatida e’lon qilmang. Loyiha jamoasiga to‘g‘ridan-to‘g‘ri yozing va quyidagilarni ko‘rsating:

- zaiflik qaysi endpoint yoki modulda ekanligi;
- uni takrorlash bosqichlari;
- mumkin bo‘lgan ta’sir.

## Loyihadagi asosiy himoya choralari

- Parollar va OTP kodlari bcrypt bilan hash qilinadi.
- Access token qisqa muddatli JWT; refresh token HttpOnly cookie’da saqlanadi, rotation va qayta ishlatishni aniqlash bor.
- Har bir so‘rov `AuthGuard` va `RolesGuard` orqali tekshiriladi (RBAC).
- Obyekt darajasida avtorizatsiya: foydalanuvchi faqat o‘ziga tegishli buyurtma, suhbat, to‘lov va fayllarni ko‘radi.
- Barcha DTO’lar `class-validator` bilan tekshiriladi, noma’lum maydonlar rad etiladi.
- Redis asosidagi rate limit va OTP suiiste’molidan himoya.
- Muhim POST so‘rovlarda `Idempotency-Key` majburiy.
- Fayllar ClamAV bilan tekshiriladi va faqat vaqtinchalik signed URL orqali beriladi.
- Admin amallari `AuditLog` jadvaliga yoziladi.
- Xato javoblarida ichki ma’lumot (SQL, stack trace) qaytarilmaydi.

## Maxfiy ma’lumotlar

- `.env` fayli repozitoriyga qo‘shilmaydi (`.gitignore`da). Namuna uchun `.env.example` ishlatiladi.
- Production kalitlari faqat muhit o‘zgaruvchilari yoki secret manager orqali beriladi.
