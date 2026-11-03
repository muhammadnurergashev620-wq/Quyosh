# Tashqi xizmat ishdan chiqsa

Geokoder (Yandex/OSM) va marshrut serveri (OSRM) **circuit breaker** bilan o'ralgan (`src/common/utils/circuit-breaker.ts`):
ketma-ket 5 ta xatodan keyin xizmatga murojaat to'xtatiladi (geokoder 30 s, OSRM 20 s), so'rovlar darhol 503 oladi va
ilova xaritada tashqi navigatsiyani taklif qiladi.

## Qanday bilish mumkin
Prometheus (`/api/v1/metrics`):
- `circuit_breaker_state{provider="geocoder|osrm"}` — 0 normal, 1 yarim ochiq, **2 ochiq (xizmat o'chiq)**.
- `provider_requests_total{provider,outcome}` — `success`, `failure`, `circuit_open`.

Tavsiya etilgan alert: `circuit_breaker_state == 2` 2 daqiqadan ko'p davom etsa.

## Nima qilish kerak
- **OSRM**: `docker ps` (docker-osrm-1), `docker logs`, kerak bo'lsa `docker restart`. `OSRM_URL` to'g'riligini tekshiring.
- **Yandex**: kalit/kvotani tekshiring (`YANDEX_*_API_KEY`); kalitni olib tashlasangiz tizim OSM Nominatim'ga o'tadi.
- Tiklangach breaker o'zi yopiladi (qo'lda hech narsa kerak emas).
