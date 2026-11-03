# Hodisa (incident) tartibi

1. **Aniqlang**: `/api/v1/metrics`, `docker logs`, xato jurnali (admin → xatolar). 5xx ulushi, `queue_depth`, `payment_failure_total`, `circuit_breaker_state` ga qarang.
2. **Cheklang**: kerak bo'lsa to'lov provayderini o'chiring yoki ilovani texnik rejimga o'tkazing. Sessiyalarni ommaviy bekor qilmang (faqat zarur bo'lganda va aniq akkauntlar uchun).
3. **Tiklang**: oxirgi ishlagan versiyaga qayting (`git revert` / oldingi image), kerak bo'lsa `backup-restore.md` bo'yicha bazani tiklang.
4. **Xabar bering**: ta'sirlangan foydalanuvchilar va jamoaga qisqa holat yangilanishi.
5. **Yozib qo'ying**: nima bo'ldi, sabab, qanday topildi, qayta takrorlanmasligi uchun nima qilinadi.

Xavfsizlik hodisasida (kalit sizib chiqishi): kalitni darhol almashtiring, gitleaks bilan tarixni tekshiring (`gitleaks detect`), auditni ko'rib chiqing.
