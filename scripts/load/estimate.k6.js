// k6 yuklama testi (TZ 17 Performance, 11.15): 200 parallel Tez hisob.
// Ishga tushirish: k6 run -e API=https://staging.quyosh.uz/api/v1 scripts/load/estimate.k6.js
// Eslatma: guest uchun estimate rate-limit (U8.9) staging’da test IP lari uchun yumshatilishi kerak.
import http from 'k6/http';
import { check, sleep } from 'k6';

const API = __ENV.API || 'http://localhost:3100/api/v1';
const POINTS = [
  [41.3111, 69.2797], [39.6542, 66.9597], [42.4601, 59.6166], [40.3864, 71.7864], [37.2242, 67.2783],
];

export const options = {
  scenarios: {
    estimate: { executor: 'constant-vus', vus: 200, duration: '2m' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:estimate}': ['p(95)<3000'],
    'http_req_duration{name:knowledge}': ['p(95)<500'],
  },
};

export default function () {
  const [lat, lon] = POINTS[Math.floor(Math.random() * POINTS.length)];
  const res = http.post(`${API}/calculations/estimate`, JSON.stringify({ mode: 'QUICK', lat, lon, areaPreset: 'MEDIUM', consumption: { monthlyKwh: 200 + Math.floor(Math.random() * 600) } }), {
    headers: { 'Content-Type': 'application/json', 'x-app-panel': 'CUSTOMER' },
    tags: { name: 'estimate' },
  });
  check(res, { 'estimate 200': (r) => r.status === 200 || r.status === 201, 'has power': (r) => !!r.json('data.systemPowerKw') });
  const k = http.get(`${API}/knowledge/articles?limit=9`, { tags: { name: 'knowledge' } });
  check(k, { 'knowledge 200': (r) => r.status === 200 });
  sleep(1);
}
