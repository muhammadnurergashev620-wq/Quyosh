/** English text of the knowledge-center seed articles (slug → title / summary / body). Merged into the i18n JSON as `en` by seed-knowledge.ts. */
export const KNOWLEDGE_EN: Record<string, { title: string; summary: string; body: string }> = {
  'quyosh-paneli-qanday-ishlaydi': {
    title: 'How a solar panel works',
    summary: 'From the panel to the socket: how sunlight becomes electricity and is used at home.',
    body: `## The main idea\n\nA solar panel is made of semiconductor cells. When light hits them, **direct current (DC)** is produced. Household appliances run on **alternating current (AC)**, so the system has an **inverter** — it converts DC into 220 V AC.\n\n## System components\n\n- **Panels** — on the roof or the ground; they produce the most when facing south.\n- **Inverter** — DC → AC, and it monitors production.\n- **Battery** (optional) — to use the daytime surplus in the evening or during an outage.\n- **Protection and cables** — circuit breakers, grounding, cable trays.\n\n## How much it produces and when\n\nProduction changes with the sun's height, air, shade and temperature: more in summer, less in winter, highest at noon. Our calculator works it out for every hour and shows a monthly forecast.\n\n## Next step\n\nMake a quick calculation from your address and monthly consumption — the result takes 1–2 minutes.`,
  },
  'tizim-turlari': {
    title: 'Grid-tied, hybrid or off-grid: which suits you',
    summary: 'The difference, price and outage behavior of the three system types.',
    body: `## Grid-tied (on-grid)\n\nNo battery, the cheapest option. By day the panels power the house, and any shortfall comes from the grid. **Important:** during an outage the inverter also shuts off for safety — it gives no backup.\n\n## Hybrid\n\nGrid + battery. The daytime surplus is stored in the battery and used in the evening or during an outage. It costs more, but is convenient where outages are frequent.\n\n## Off-grid\n\nFor places without a grid: country houses, farms, remote sites. The battery must be large, because winter days are accounted for.\n\n## How to choose\n\n| Situation | Recommendation |\n|---|---|\n| The main goal is to reduce the bill | Grid-tied |\n| Outages are frequent | Hybrid |\n| No grid | Off-grid |\n\nSwitch the system type in the calculator to compare price and backup time.`,
  },
  'qancha-quvvat-kerak': {
    title: 'How much capacity your home needs',
    summary: 'How to choose the system size from monthly kWh, roof area and tariff.',
    body: `## 1. Know your consumption\n\nTake the **monthly kWh** from your electricity bill. Data for several months is better — winter and summer differ a lot. If you don't know it, use the household appliance list in the calculator.\n\n## 2. Roof area limit\n\nOne modern panel takes about 2–2.6 m². If you draw your roof on the map, the calculator works out the usable area and the number of panels that fit.\n\n## 3. Three options\n\nThe calculator always gives three options: **economical**, **balanced** and **maximum**. The limiting factor (area, consumption, grid limit or budget) is also shown.\n\n## 4. Is extra capacity worthwhile?\n\nIf the rule for feeding surplus energy into the grid is not approved, a system much larger than your consumption pays back more slowly. The result page shows this separately.`,
  },
  'taklifni-qanday-tanlash': {
    title: 'How to compare and choose shop offers',
    summary: 'What to look at besides the price: price per 1 kW, warranty, timeline and what is included.',
    body: `## One request — several offers\n\nWith one request on the platform you get offers from up to 5 shops. Your contact is not opened until you allow it.\n\n## What to look at\n\n1. **Price per 1 kW** — to compare offers of different capacity fairly.\n2. **Warranty** — equipment and installation warranties are written separately.\n3. **Installation time** and **validity period**.\n4. **What is and isn't included** — mounting structure, cables, meter, roof repair.\n5. **Shop rating** — based only on reviews after confirmed installations.\n\n## The comparison page\n\nThe "Cheapest (per kW)", "Longest warranty" and "Fastest installation" badges are given only from a real comparison. The payback period is recalculated for your calculation with the offer price.\n\n## What choosing means\n\nChoosing an offer is not a contract or a payment. You agree on the next steps with the shop.`,
  },
  'montajni-qabul-qilish': {
    title: 'How to accept an installation: the checklist',
    summary: 'What to check when a shop says "installation done".',
    body: `## Why a checklist\n\nAn installation is not confirmed without the checklist. It protects both you and an honest shop.\n\n## Key items\n\n- The panels are firmly mounted, with no damage to the frame.\n- The inverter is on and shows production — **upload a photo of the screen**.\n- Grounding is done.\n- Protection breakers are installed and labeled on the DC and AC sides.\n- Cables are inside a protective box or corrugated conduit.\n- The battery (if any) is in a ventilated place.\n- You were shown how to switch on/off and the emergency shutdown.\n- Warranty documents were handed over and the site was cleaned.\n\n## If there is a problem\n\nMark "There is a problem" and write a note. Then: accept anyway, ask the shop to fix it, or raise an objection (the admin reviews it).`,
  },
  'tom-yonalishi-va-soya': {
    title: 'Roof orientation, slope and shade',
    summary: 'South, east or west — how it affects production.',
    body: `## Orientation\n\nIn Uzbekistan the most production comes from south-facing panels. East or west orientation usually reduces annual production by a few tens of percent, but fits morning or evening consumption better.\n\n## Slope\n\nFor the annual maximum the slope is close to the latitude (about 30–40°). On a flat roof the panels are mounted on a frame — a gap between rows is needed so that no shade falls on them.\n\n## Shade\n\nThe shade of a tree, chimney or neighboring building can lower a whole row. Set the shade level in the calculator; the shop checks it exactly at the measurement.\n\n## Data source\n\nThe calculation is based on PVGIS (European Commission JRC) or NASA POWER hourly data.`,
  },
  'akkumulyator-tanlash': {
    title: 'How to choose a battery',
    summary: 'LiFePO4 and lead-acid, usable capacity (DoD) and cycle count.',
    body: `## Chemistry\n\n- **LiFePO4 (lithium iron phosphate)** — long life (thousands of cycles), tolerates deep discharge, safe. Higher upfront price.\n- **Lead-acid (AGM/GEL)** — cheap, but has fewer cycles and lower usable capacity.\n\n## Usable capacity\n\nThe kWh on the battery label is not fully usable. **DoD** (depth of discharge) shows how much can be used: for example, 10 kWh × 90% = 9 kWh.\n\n## How much you need\n\nCalculate by the evening consumption or the essential load during an outage. The power outage calculator shows backup hours for essential appliances such as the fridge, lighting and router.\n\n## Compatibility\n\nThe battery voltage and chemistry must be compatible with the inverter — the compatibility badge in the offer checks this.`,
  },
  'invertor-tanlash': {
    title: 'How to choose an inverter',
    summary: 'Power ratio, MPPT voltage and hybrid functions.',
    body: `## Power\n\nThe inverter's AC power is usually chosen slightly smaller than or equal to the panel power (DC/AC ratio about 1.0–1.3). A too-small inverter increases daytime "clipping" losses.\n\n## Voltage window\n\nThe voltage of panels connected in series must not exceed the inverter's maximum DC voltage even on a cold day, and must not drop below the MPPT window in the heat. The compatibility check in the offer builder calculates this.\n\n## Hybrid inverter\n\nIf you need a battery and a backup output (working during an outage), choose a hybrid inverter.\n\n## Monitoring\n\nViewing production via an app or Wi‑Fi makes entering the monthly figure easier.`,
  },
  'tarif-va-tejash': {
    title: 'Tiered tariff and how much solar saves',
    summary: 'Why savings depend on tier limits and how the calculator computes it.',
    body: `## Tiered tariff\n\nFor household consumers the tariff is often tiered: part of the monthly consumption is at one price and the excess is more expensive. Solar energy first cuts the kWh in the **most expensive tier** — so the savings differ from a simple "kWh × price".\n\n## How the calculator computes it\n\n1. Hourly consumption and production are compared.\n2. The kWh drawn from the grid are priced by tier for each month.\n3. The difference between the monthly bill without solar and with solar is the savings.\n\n## Tariff source\n\nTariffs are entered by an admin with an official source and an effective date. If no tariff is found for your area, the calculator does not make up a price and does not show financial results.`,
  },
  'tarmoqqa-energiya-berish': {
    title: 'Feeding surplus energy into the grid',
    summary: 'Export rules, the meter, and why the calculator sometimes shows no income.',
    body: `## How it works\n\nIf the panels produce more than the house uses during the day, the surplus goes to the grid. This needs a two-way meter and an agreement with the energy supply organization.\n\n## Compensation types\n\n- **Net metering** — the kWh fed in are deducted from consumption in later months.\n- **Selling price** — the kWh fed in are paid at a set price.\n- **No compensation** — energy is exported, but no money is received.\n\n## In the calculator\n\nExport income is shown as money only if the export rule has been **approved** by an admin with a source. Otherwise the exported kWh is visible, but the income is not calculated — this is deliberate caution.\n\n## Grid limit\n\nThere may be a connection capacity limit; the calculator shows this as a limiting factor.`,
  },
  'kredit-va-bolib-tolash': {
    title: 'Credit and installments: monthly payment and the "out of pocket" amount',
    summary: 'Annuity and differential payments, overpayment and comparison with savings.',
    body: `## Payment types\n\n- **Annuity** — the same payment every month.\n- **Differential** — large at first, then decreasing.\n\n## What to compare\n\n1. **Monthly payment** and **overpayment** (interest + fees).\n2. **Out-of-pocket amount** — the monthly payment minus that month's savings. If negative, the system pays for the credit itself.\n3. **Self-financing period** — the month when the accumulated savings cover the payments.\n\n## Note\n\nThe credit calculator is approximate: the final rate, fees and terms are set by the bank or seller. Product details are shown with a source and a verified date.`,
  },
  'elektr-ochganda-zaxira': {
    title: 'During a power outage: how long the backup lasts',
    summary: 'Calculating the essential load and why an on-grid system gives no backup.',
    body: `## On-grid gives no backup\n\nA grid-tied inverter shuts off during an outage — this is required for repairers' safety. For backup you need a hybrid inverter and a battery.\n\n## Essential load\n\nDuring an outage keep only the necessary appliances: fridge, lighting, router, pump, the heating boiler's pump. Enter the power (W) and daily running hours of each in the calculator.\n\n## Calculation\n\nBackup hours ≈ the battery's usable capacity ÷ the essential load power. By day the panels can charge the battery, so daytime and nighttime backup are shown separately.\n\n## Motor-driven appliances\n\nPumps and air conditioners draw several times more current at startup — the inverter must withstand this peak.`,
  },
  'panellarni-tozalash': {
    title: 'When and how to clean the panels',
    summary: 'Dust reduces production: safe cleaning rules.',
    body: `## Why it matters\n\nDust and sand, especially in months without rain, reduce production noticeably. The platform sends a cleaning reminder every 90 days.\n\n## How to clean\n\n- In the morning or evening, when the panels are cool.\n- A soft brush and clean water; do not use abrasives or strong chemicals.\n- A high-pressure washer can damage the frame seals.\n- Safety first when going on the roof; call a specialist for high roofs.\n\n## Check the result\n\nEnter the production figure for the month after cleaning — you will see it approach the forecast.`,
  },
  'kafolatlar': {
    title: 'Warranties: equipment, installation and production',
    summary: 'What warranties exist and how to track their expiry.',
    body: `## Types\n\n- **Equipment warranty** — given by the manufacturer (panel, inverter, battery separately).\n- **Production warranty** — the panel's power must not fall below a set percentage over the years.\n- **Installation warranty** — given by the shop: mounting, connections, roof sealing.\n\n## On the platform\n\nIn the offer the equipment and installation warranties are written separately. After the installation is accepted, the "Installed system" card shows each component's warranty and the time left; a reminder arrives when 60 days remain.\n\n## Documents\n\nKeep warranty cards, serial numbers and the checklist result — you will need them for a claim.`,
  },
  'ishlab-chiqarish-kamaysa': {
    title: 'What to do if production is below the forecast',
    summary: 'Usual causes of a difference above 20% and how to check.',
    body: `## Comparing with the forecast\n\nEnter the kWh produced each month or the meter reading. If the difference exceeds 20%, an attention card appears in your account.\n\n## Usual causes\n\n1. **Dust** — the most common; clean the panels.\n2. **New shade** — a grown tree, new construction.\n3. **Weather** — a cloudy month being below the forecast is natural.\n4. **Inverter error** — check the error code on the screen.\n5. **Connection or breaker** — one string may have switched off.\n\n## Next step\n\nIf the cause is not found, contact the shop that did the installation via the "Write to the shop" button in your account — the conversation goes with the system's data.`,
  },
  'kalkulyator-qanchalik-aniq': {
    title: 'How accurate is the calculator result?',
    summary: 'About the forecast, the range and data sources.',
    body: `The result is a **forecast**. Production is calculated from PVGIS or NASA POWER hourly solar data; if they are unavailable, the region average is used and this is stated openly. The result page shows the low and high scenario range, the tariff used, the model version and the assumptions. The exact price and project come in the shop's offer after the measurement.`,
  },
  'kontakt-qachon-ochiladi': {
    title: 'When are my phone and address visible to a shop?',
    summary: 'Contact policy: until you allow it, a shop sees only the area and parameters.',
    body: `When a request is sent, a shop sees only **your name, district, system parameters and calculation summary**. The phone, exact address and roof drawing are opened in three cases: when you click "Open contact", confirm a measurement meeting, or choose an offer. Messaging works even without the contact being opened.`,
  },
  'sorov-limitlari': {
    title: 'How many requests can I send?',
    summary: '1–5 shops per request, 3 open requests at a time, 5 per day.',
    body: `One request can go to 1 to 5 shops (you can add more later, up to 5 in total). At most **3 open requests** at a time and **5 new requests** per day. The limit protects against spam and protects the shops' time. If you close an open request, you can send a new one.`,
  },
  'sharh-qachon-chiqadi': {
    title: 'Why did my review not appear right away?',
    summary: 'Reviews only after a confirmed installation; some go to moderation.',
    body: `A review is written only by a customer who accepted the installation through the checklist — one review per installation. There are automatic rules against fake reviews: if the text contains a phone number or link, the confirmation was too quick or there are other signs, the review goes to moderation and appears after the check. The rating is calculated only from published reviews.`,
  },
  'hisobni-ochirish': {
    title: 'How do I delete my account?',
    summary: 'The 14-day cancellation window and which data is deleted.',
    body: `Settings → "Delete account". After the request all sessions are closed and open requests are cancelled. Within **14 days** you can sign in again and cancel the deletion. After that your name, phone, email, properties (address and roof drawing), calculations and message texts are deleted; offer, installation and review records remain anonymized for statistics. A shop owner must first transfer ownership.`,
  },
  'kvt-va-kvt-soat': {
    title: 'kW and kWh',
    summary: 'The difference between power and energy.',
    body: `**kW (kilowatt)** is power, i.e. the rate of work at a moment. System size is written in kW (for example 5 kW). **kWh (kilowatt-hour)** is energy: 1 kW of power running for 1 hour is 1 kWh. The electricity bill and production are measured in kWh.`,
  },
  'ozini-oqlash-npv-irr': {
    title: 'Payback, NPV and IRR',
    summary: 'Financial indicators in plain language.',
    body: `**Payback period** — how many years it takes for the system price to be recovered by the annual net benefit (savings + export income − service cost). **NPV (net present value)** — the present value of 25 years of cash flows: if positive, the investment beats the discount rate. **IRR (internal rate of return)** — the investment's annual yield in percent.`,
  },
  'soc-va-dod': {
    title: 'SOC and DoD',
    summary: 'Battery state of charge and depth of discharge.',
    body: `**SOC (State of Charge)** — the battery's charge level, in percent. **DoD (Depth of Discharge)** — how deeply the battery may be discharged. Usable capacity = nominal capacity × DoD. The calculator never lets the SOC drop below the permitted limit.`,
  },
  'mppt-va-string': {
    title: 'MPPT and string',
    summary: 'Terms related to connecting the inverter and panels.',
    body: `**String** — a group of panels connected in series; their voltages add up. **MPPT** — the controller in the inverter that tracks the maximum power point: it adjusts voltage and current to draw the most power from each string. Each MPPT has a voltage window and a maximum current.`,
  },
};

export const KNOWLEDGE_CATEGORIES_EN: Record<string, string> = {
  asoslar: 'Basics',
  'tizim-va-uskunalar': 'System and equipment',
  'tom-va-joylashuv': 'Roof and location',
  'pul-va-tarif': 'Money, tariff and credit',
  'takliflar-va-montaj': 'Offers and installation',
  'xizmat-korsatish': 'Maintenance',
  platforma: 'Questions about the platform',
  atamalar: 'Glossary',
};
