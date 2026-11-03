import { toUzbekCyrillic } from '../../common/utils/translit';

/** Vidjet matnlari (U13). oz — lotindan kirillga. */
const UZ = {
  subtitle: 'Quyosh paneli kalkulyatori',
  region: 'Hudud',
  monthly: 'Oylik elektr sarfi, kWh',
  calc: 'Hisoblash',
  calculating: 'Hisoblanmoqda…',
  power: 'Tavsiya etilgan quvvat',
  saving: 'Oylik tejash',
  cost: 'Taxminiy narx',
  payback: 'O‘zini oqlash',
  years: 'yil',
  kw: 'kVt',
  sum: 'so‘m',
  estimateNote: 'Taxminiy natija. Aniq narxni do‘kon taklifida olasiz.',
  getQuote: 'Ushbu do‘kondan taklif olish',
  phone: 'Telefon raqamingiz',
  sendCode: 'Kod yuborish',
  code: 'SMS kodi',
  name: 'Ismingiz',
  consentPrefix: 'Platformaning',
  terms: 'foydalanuvchi shartlari',
  and: 'va',
  privacy: 'maxfiylik siyosatiga',
  consentSuffix: 'roziman',
  accountNote: 'Platformada sizga akkaunt yaratiladi — so‘rov va takliflarni u yerda kuzatasiz.',
  submit: 'Yuborish',
  sent: 'So‘rov yuborildi',
  sentText: 'Do‘kon tez orada bog‘lanadi. So‘rov raqami',
  open: 'Platformada ochish',
  powered: 'Quyosh platformasi asosida',
  error: 'Xatolik. Qayta urinib ko‘ring.',
  notCalculated: '—',
};
type Texts = typeof UZ;
const RU: Texts = {
  subtitle: 'Калькулятор солнечных панелей', region: 'Регион', monthly: 'Потребление в месяц, кВт·ч', calc: 'Рассчитать', calculating: 'Считаем…',
  power: 'Рекомендуемая мощность', saving: 'Экономия в месяц', cost: 'Ориентировочная цена', payback: 'Окупаемость', years: 'лет', kw: 'кВт', sum: 'сум',
  estimateNote: 'Предварительный результат. Точную цену вы получите в предложении магазина.', getQuote: 'Получить предложение от магазина',
  phone: 'Ваш телефон', sendCode: 'Отправить код', code: 'Код из SMS', name: 'Ваше имя', consentPrefix: 'Согласен с', terms: 'условиями использования', and: 'и',
  privacy: 'политикой конфиденциальности', consentSuffix: 'платформы', accountNote: 'На платформе будет создан аккаунт — там вы будете следить за заявкой и предложениями.',
  submit: 'Отправить', sent: 'Заявка отправлена', sentText: 'Магазин скоро свяжется с вами. Номер заявки', open: 'Открыть на платформе', powered: 'На платформе Quyosh',
  error: 'Ошибка. Попробуйте ещё раз.', notCalculated: '—',
};

function texts(lang: string): Texts {
  if (lang === 'ru') return RU;
  if (lang !== 'oz') return UZ;
  return Object.fromEntries(Object.entries(UZ).map(([k, v]) => [k, toUzbekCyrillic(v)])) as Texts;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface FrameInput {
  publicKey: string;
  nonce: string;
  shopName: string;
  theme: { primaryColor: string; title: string; lang: 'uz' | 'oz' | 'ru' };
  regions: Array<{ key: string; name: string }>;
  platformUrl: string;
}

/**
 * U13: iframe ichidagi Tez hisob (do‘kon brendi faqat tugma va aksentlarda), keyin telefon → OTP → ism → rozilik → yuborildi.
 * Uchinchi tomon cookie’lariga tayanmaydi — holat xotirada; balandlik postMessage bilan.
 */
export function renderWidgetFrame(input: FrameInput): string {
  const T = texts(input.theme.lang);
  const platform = input.platformUrl.replace(/\/$/, '');
  const regionName = (name: string) => (input.theme.lang === 'oz' ? toUzbekCyrillic(name) : name);
  const options = input.regions.map((r) => `<option value="${esc(r.key)}"${r.key === 'toshkent-shahri' ? ' selected' : ''}>${esc(regionName(r.name))}</option>`).join('');
  // <script> ichida: `</script>` yoki `<!--` bilan blokdan chiqib bo‘lmasin.
  const cfg = JSON.stringify({ key: input.publicKey, T, platform }).replace(/</g, '\\u003c');
  // CSS ichiga faqat #rrggbb tushadi (DTO ham shuni talab qiladi; bazadagi eski qiymatlarga qarshi qayta tekshiruv).
  const color = /^#[0-9a-fA-F]{6}$/.test(input.theme.primaryColor) ? input.theme.primaryColor : '#1d4ed8';
  return `<!doctype html>
<html lang="${input.theme.lang === 'ru' ? 'ru' : 'uz'}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(input.theme.title)}</title>
<style nonce="${input.nonce}">
:root{--p:${color};--ink:#07111d;--muted:#5b6678;--line:#d8dee8;--bg:#fff}
*{box-sizing:border-box}body{margin:0;font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg)}
.w{padding:18px;max-width:640px;margin:0 auto}h1{margin:0;font-size:19px}.sub{margin:2px 0 14px;color:var(--muted);font-size:13px}
label{display:block;margin:10px 0 4px;font-weight:600;font-size:13px}input,select{width:100%;height:42px;padding:0 12px;border:1px solid var(--line);border-radius:10px;font:inherit;color:var(--ink);background:#fff}
input:focus,select:focus{outline:2px solid var(--p);outline-offset:1px}
button{margin-top:14px;width:100%;height:44px;border:0;border-radius:10px;background:var(--p);color:#fff;font:inherit;font-weight:700;cursor:pointer}
button[disabled]{opacity:.6;cursor:default}.ghost{background:transparent;color:var(--p);border:1px solid var(--p)}
.kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.kpi{padding:10px 12px;border:1px solid var(--line);border-radius:12px}
.kpi small{display:block;color:var(--muted);font-size:12px}.kpi b{font-size:17px;font-variant-numeric:tabular-nums}
.note{margin:10px 0 0;color:var(--muted);font-size:12.5px}.err{margin-top:10px;color:#b42318;font-size:13px}
.check{display:flex;gap:8px;align-items:flex-start;font-weight:400}.check input{width:18px;height:18px;margin-top:2px}
.ok{padding:16px;border-radius:12px;background:#ecfdf3;color:#05603a}.foot{margin-top:16px;text-align:center;font-size:12px}.foot a{color:var(--muted)}
[hidden]{display:none!important}a{color:var(--p)}
@media (prefers-reduced-motion:no-preference){.kpis{animation:fade .6s ease}@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1}}}
</style>
</head>
<body>
<main class="w">
  <h1>${esc(input.theme.title)}</h1>
  <p class="sub">${esc(T.subtitle)} · ${esc(input.shopName)}</p>
  <form id="calc">
    <label for="region">${esc(T.region)}</label><select id="region">${options}</select>
    <label for="kwh">${esc(T.monthly)}</label><input id="kwh" type="number" inputmode="numeric" min="30" max="100000" value="300" required>
    <button id="calcBtn" type="submit">${esc(T.calc)}</button>
  </form>
  <section id="result" hidden aria-live="polite">
    <div class="kpis">
      <div class="kpi"><small>${esc(T.power)}</small><b id="r-power"></b></div>
      <div class="kpi"><small>${esc(T.saving)}</small><b id="r-saving"></b></div>
      <div class="kpi"><small>${esc(T.cost)}</small><b id="r-cost"></b></div>
      <div class="kpi"><small>${esc(T.payback)}</small><b id="r-payback"></b></div>
    </div>
    <p class="note">${esc(T.estimateNote)}</p>
    <button id="toLead" type="button">${esc(T.getQuote)}</button>
  </section>
  <form id="lead" hidden>
    <label for="phone">${esc(T.phone)}</label><input id="phone" type="tel" inputmode="tel" placeholder="+998 90 123 45 67" required autocomplete="tel">
    <button id="codeBtn" type="button" class="ghost">${esc(T.sendCode)}</button>
    <div id="step2" hidden>
      <label for="code">${esc(T.code)}</label><input id="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required>
      <label for="name">${esc(T.name)}</label><input id="name" maxlength="100" autocomplete="given-name" required>
      <label class="check"><input id="consent" type="checkbox" required> <span>${esc(T.consentPrefix)} <a href="${esc(platform)}/shartlar" target="_blank" rel="noopener">${esc(T.terms)}</a> ${esc(T.and)} <a href="${esc(platform)}/maxfiylik" target="_blank" rel="noopener">${esc(T.privacy)}</a> ${esc(T.consentSuffix)}</span></label>
      <p class="note">${esc(T.accountNote)}</p>
      <button id="submitBtn" type="submit">${esc(T.submit)}</button>
    </div>
  </form>
  <section id="done" hidden class="ok" aria-live="polite"><b>${esc(T.sent)}</b><p id="doneText"></p><a id="doneLink" target="_blank" rel="noopener">${esc(T.open)}</a></section>
  <p id="err" class="err" role="alert" hidden></p>
  <p class="foot"><a href="${esc(platform)}" target="_blank" rel="noopener">${esc(T.powered)}</a></p>
</main>
<script nonce="${input.nonce}">
(function(){
  var C=${cfg};var T=C.T;var base=location.pathname.replace(/\\/frame$/,'');var state={};
  var $=function(id){return document.getElementById(id)};
  function fmt(n){return Math.round(n).toLocaleString('ru-RU').replace(/\\u00a0/g,' ')}
  function money(n){if(n===null||n===undefined)return T.notCalculated;return n>=1e6?(Math.round(n/1e5)/10).toLocaleString('ru-RU')+' mln '+T.sum:fmt(n)+' '+T.sum}
  function err(m){var e=$('err');e.textContent=m||T.error;e.hidden=false}
  function ok(){$('err').hidden=true}
  function post(path,body){return fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){if(!r.ok||j.success===false)throw new Error(j.message||T.error);return j.data})})}
  function resize(){parent.postMessage({type:'quyosh-widget:height',key:C.key,height:document.documentElement.scrollHeight},'*')}
  if('ResizeObserver' in window)new ResizeObserver(resize).observe(document.body);window.addEventListener('load',resize);
  $('calc').addEventListener('submit',function(ev){ev.preventDefault();ok();var b=$('calcBtn');b.disabled=true;b.textContent=T.calculating;
    state.input={regionCode:$('region').value,monthlyKwh:Number($('kwh').value)};
    post('/estimate',state.input).then(function(r){$('r-power').textContent=r.systemPowerKw.toLocaleString('ru-RU')+' '+T.kw;$('r-saving').textContent=money(r.monthlySaving);$('r-cost').textContent=money(r.initialCost);$('r-payback').textContent=r.simplePaybackYears===null?T.notCalculated:r.simplePaybackYears.toLocaleString('ru-RU')+' '+T.years;$('result').hidden=false}).catch(function(e){err(e.message)}).finally(function(){b.disabled=false;b.textContent=T.calc})});
  $('toLead').addEventListener('click',function(){$('lead').hidden=false;$('toLead').hidden=true;$('phone').focus()});
  $('codeBtn').addEventListener('click',function(){ok();var b=$('codeBtn');b.disabled=true;post('/otp',{phone:$('phone').value}).then(function(r){$('step2').hidden=false;if(r.developmentCode)$('code').value=r.developmentCode;$('code').focus();setTimeout(function(){b.disabled=false},(r.resendAfter||60)*1000)}).catch(function(e){b.disabled=false;err(e.message)})});
  $('lead').addEventListener('submit',function(ev){ev.preventDefault();ok();if(!$('consent').checked)return;var b=$('submitBtn');b.disabled=true;
    post('/lead',Object.assign({},state.input,{phone:$('phone').value,code:$('code').value,firstName:$('name').value,consent:true})).then(function(r){$('lead').hidden=true;$('result').hidden=true;$('calc').hidden=true;$('done').hidden=false;$('doneText').textContent=T.sentText+': №'+r.requestNumber;$('doneLink').href=C.platform+'/mijoz/sorovlar';parent.postMessage({type:'quyosh-widget:lead',key:C.key},'*')}).catch(function(e){b.disabled=false;err(e.message)})});
})();
</script>
</body>
</html>`;
}

/** Saytga qo‘yiladigan skript: iframe yaratadi va balandlikni moslaydi (320–640 px kenglik). */
export function renderEmbedScript(frameUrl: string, publicKey: string): string {
  return `(function(){var s=document.currentScript;var f=document.createElement('iframe');f.src=${JSON.stringify(frameUrl)};f.title='Quyosh';f.loading='lazy';
f.style.cssText='width:100%;max-width:640px;min-width:320px;height:520px;border:0;display:block';s.parentNode.insertBefore(f,s.nextSibling);
var o=new URL(${JSON.stringify(frameUrl)}).origin;window.addEventListener('message',function(e){if(e.origin!==o||!e.data||e.data.key!==${JSON.stringify(publicKey)})return;
if(e.data.type==='quyosh-widget:height')f.style.height=Math.min(Math.max(e.data.height,360),1400)+'px';});})();`;
}
