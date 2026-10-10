/* Asset Tagger – offline HVAC/mechanical equipment tagging PWA.
   Vanilla JS, data in IndexedDB. Vendor libs (loaded on demand): html5-qrcode, SheetJS (xlsx); qrcode-generator loaded up front. */
'use strict';
(() => {
const APP_VERSION = '1.5.0';
/* Demo mode (?demo=1): separate IndexedDB + storage keys, preloaded sample data. Never touches the real 'asset-tagger' DB. */
const DEMO = /(?:^|[?&])demo=1(?:&|$)/.test(location.search.slice(1));
const DB_NAME = DEMO ? 'asset-tagger-demo' : 'asset-tagger';
const LSK = k => DEMO ? 'demo:' + k : k;
const TYPES = ['AHU','RTU','Chiller','Boiler','Pump','VAV','FCU','Exhaust Fan','Cooling Tower','Heat Exchanger','VRF Unit','Other'];
const STATUSES = ['Not started','Installed','Started up','Commissioned','Issue'];
const STATUS_CLASS = {'Not started':'s-none','Installed':'s-inst','Started up':'s-start','Commissioned':'s-cx','Issue':'s-issue'};
const TYPE_ALIASES = {
  'ahu':'AHU','air handling unit':'AHU','air handler':'AHU','air handler unit':'AHU','mau':'AHU','doas':'AHU',
  'rtu':'RTU','rooftop unit':'RTU','roof top unit':'RTU','rooftop':'RTU',
  'ch':'Chiller','chlr':'Chiller','chiller':'Chiller',
  'b':'Boiler','blr':'Boiler','boiler':'Boiler',
  'p':'Pump','pump':'Pump','chwp':'Pump','hwp':'Pump','cwp':'Pump','pchwp':'Pump','schwp':'Pump',
  'vav':'VAV','vav box':'VAV','variable air volume':'VAV','vav terminal':'VAV',
  'fcu':'FCU','fan coil':'FCU','fan coil unit':'FCU','fc':'FCU',
  'ef':'Exhaust Fan','exhaust fan':'Exhaust Fan','exh fan':'Exhaust Fan','exf':'Exhaust Fan',
  'ct':'Cooling Tower','cooling tower':'Cooling Tower',
  'hx':'Heat Exchanger','phe':'Heat Exchanger','heat exchanger':'Heat Exchanger','hex':'Heat Exchanger',
  'vrf':'VRF Unit','vrf unit':'VRF Unit','vrv':'VRF Unit','vrf indoor unit':'VRF Unit','vrf outdoor unit':'VRF Unit',
  'other':'Other'
};
const LIFE_DEFAULTS = {
  'AHU': 25, 'RTU': 15, 'Chiller': 25, 'Boiler': 30, 'Pump': 20, 'VAV': 20,
  'FCU': 20, 'Exhaust Fan': 20, 'Cooling Tower': 20, 'Heat Exchanger': 25, 'VRF Unit': 15, 'Other': 20
};
/* Typical mid-range ASHRAE / industry service lives (years). Prefill only — always overrideable. */
const FIELDS = [
  {key:'tag', label:'Tag / Asset ID', aliases:['tag','asset id','assetid','asset tag','tag id','equipment tag','equipment id','unit tag','mark','id']},
  {key:'type', label:'Equipment Type', aliases:['type','equipment type','equipment','equip type','asset type','unit type']},
  {key:'manufacturer', label:'Manufacturer', aliases:['manufacturer','mfr','mfg','make','manuf','vendor']},
  {key:'model', label:'Model', aliases:['model','model number','model no','model #','model num']},
  {key:'serial', label:'Serial Number', aliases:['serial','serial number','serial no','serial #','s/n','sn','serial num']},
  {key:'capacity', label:'Capacity / Size', aliases:['capacity','size','capacity / size','capacity/size','rating','tons','cfm']},
  {key:'building', label:'Building', aliases:['building','bldg','facility']},
  {key:'floor', label:'Floor', aliases:['floor','level','flr']},
  {key:'room', label:'Room / Location', aliases:['room / location','room/location','room','location','room #','room number','space']},
  {key:'areaServed', label:'Area Served', aliases:['area served','serves','served area','zone','area']},
  {key:'fedFrom', label:'Fed From', aliases:['fed from','fed by','served by','served from','upstream','upstream equipment','upstream unit','supplied by','parent','parent equipment','parent unit','source equipment','fed from equipment']},
  {key:'controlledBy', label:'Controlled By', aliases:['controlled by','controller','controls','control','bas controller','ddc controller','ddc panel','control panel','bas','controlled from','thermostat']},
  {key:'powerPanel', label:'Power Panel', aliases:['power panel','panel','electrical panel','panelboard','panel board','breaker panel','elec panel','power source','power','mcc','fed from panel','panel name','panel #','power panel / mcc']},
  {key:'breaker', label:'Breaker/Circuit', aliases:['breaker/circuit','breaker / circuit','breaker / circuit #','circuit/breaker','breaker','breakers','circuit','circuits','circuit #','circuit number','circuit no','ckt','ckt #','ckts','breaker #','breaker number','breaker no','cb','circuit breaker']},
  {key:'voltage', label:'Voltage/Phase', aliases:['voltage/phase','voltage / phase','voltage','volts','volt/phase','volts/phase','v/ph','v/ph/hz','voltage/phase/hz','voltage / phase / hz','electrical','power supply']},
  {key:'disconnect', label:'Disconnect Location', aliases:['disconnect location','disconnect','disconnect loc','disc location','disconnect switch','disconnect switch location','lockout location','loto location','loto point']},
  {key:'installYear', label:'Install Year', aliases:['install year','year installed','manufacture year','year of manufacture','mfg year','year built','built year','install yr','mfr year']},
  {key:'installDate', label:'Install Date', aliases:['install date','installed','installation date','date installed','install']},
  {key:'lifeExpectancy', label:'Life Expectancy', aliases:['life expectancy','life expectancy (years)','expected life','service life','useful life','design life','life (years)','life years']},
  {key:'ageOverride', label:'Age Override', aliases:['age override','age (years)','age years','age','equipment age'], export:false},
  {key:'status', label:'Status', aliases:['status','cx status','commissioning status','state']},
  {key:'notes', label:'Notes', aliases:['notes','note','comments','comment','remarks','issues']},
];
const ICON = {
  scan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  more:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  camera:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  print:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6z"/></svg>',
};

/* ---------------- utilities ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
  : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
const normTag = s => String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
const normKey = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9#/]+/g, ' ').trim();
const nowISO = () => new Date().toISOString();
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const natCmp = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, {numeric: true, sensitivity: 'base'});
const slug = s => String(s || 'project').trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 40) || 'project';
const statusPill = s => `<span class="pill ${STATUS_CLASS[s] || 's-none'}">${esc(s || 'Not started')}</span>`;
const locLine = a => [a.building && `Bldg ${a.building}`, a.floor && `Flr ${a.floor}`, a.room].filter(Boolean).join(' · ');
/* ---- Relationships (fed from / feeds) & power ----
   Stored on the asset by TAG (not id) so a not-yet-tagged upstream unit can be referenced and spreadsheets round-trip:
   fedFrom: "AHU-1" or "AHU-1, CH-1"; controlledBy: free text; powerPanel: "2A3"; breaker: "14,16,18"; voltage: "480V/3ph"; disconnect: free text. */
const splitTags = s => [...new Set(String(s ?? '').split(/[,;\n]+/).map(normTag).filter(Boolean))];
const fedList = a => splitTags(a && a.fedFrom);
const normPanel = s => { const t = normTag(s); return t.replace(/^(PANEL|PANELBOARD|PNL)\b\s*[:#-]?\s*/, '') || t; };
const normBreaker = s => String(s ?? '').trim().replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ');
const cktLabel = b => /^(ckt|cb|circuit|breaker|bkr)/i.test(b) ? b : `Ckt ${b}`;
const powerLine = a => [a.powerPanel && `Panel ${normPanel(a.powerPanel)}`, a.breaker && cktLabel(a.breaker), a.voltage].filter(Boolean).join(' · ');
const hasPower = a => !!(a && (a.powerPanel || a.breaker || a.voltage || a.disconnect));
const plural = (n, w) => `${n} ${w}${n === 1 || /s$/i.test(w) ? '' : 's'}`;
/** "12 VAVs, 1 FCU" */
const typeSummary = list => { const c = new Map(); list.forEach(a => { const t = a.type || 'unit'; c.set(t, (c.get(t) || 0) + 1); });
  return [...c.entries()].sort((x, y) => y[1] - x[1] || natCmp(x[0], y[0])).map(([t, n]) => plural(n, t === 'Other' ? 'other unit' : t)).join(', '); };
/** Tag lookups + reverse "feeds" lists for one project's assets. */
function relIndex(assets) {
  const byTag = new Map(), children = new Map();
  assets.forEach(a => { const t = normTag(a.tag); if (t && !byTag.has(t)) byTag.set(t, a); });
  assets.forEach(a => fedList(a).forEach(t => { if (t === normTag(a.tag)) return; if (!children.has(t)) children.set(t, []); children.get(t).push(a); }));
  children.forEach(l => l.sort((x, y) => natCmp(x.tag, y.tag)));
  return {byTag, children, feeds: tag => children.get(normTag(tag)) || []};
}
/** Primary upstream chain, top first: [CH-1, AHU-1] for VAV-1-2. Stops on loops / unknown tags. */
function upstreamPath(a, idx) {
  const path = [], seen = new Set([normTag(a.tag)]); let cur = a;
  while (cur && path.length < 25) {
    const t = fedList(cur).find(x => x !== normTag(cur.tag)); if (!t) break;
    if (seen.has(t)) { path.unshift({tag: t, loop: true}); break; }
    seen.add(t); cur = idx.byTag.get(t); path.unshift({tag: t, asset: cur});
  }
  return path;
}
/** When a tag is renamed, point other assets' Fed From / Controlled By at the new tag. Returns the changed assets. */
function renameRefs(assets, selfId, oldTag, newTag) {
  const o = normTag(oldTag), n = normTag(newTag), changed = [];
  if (!o || !n || o === n) return changed;
  assets.forEach(x => {
    if (x.id === selfId) return; let hit = false;
    const f = fedList(x);
    if (f.includes(o)) { x.fedFrom = [...new Set(f.map(t => t === o ? n : t))].filter(t => t !== normTag(x.tag)).join(', '); hit = true; }
    if (x.controlledBy) {
      const parts = String(x.controlledBy).split(/\s*,\s*/);
      if (parts.some(p => normTag(p) === o)) { x.controlledBy = parts.map(p => normTag(p) === o ? n : p).join(', '); hit = true; }
    }
    if (hit) changed.push(x);
  });
  return changed;
}
const VOLTAGES = ['120V/1ph', '208V/1ph', '208V/3ph', '230V/1ph', '230V/3ph', '277V/1ph', '460V/3ph', '480V/3ph', '575V/3ph', '24VAC'];
function parseYear(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && isFinite(v)) { const y = Math.round(v); return (y >= 1800 && y <= 2100) ? y : null; }
  const s = String(v).trim();
  if (/^(19|20)\d{2}$/.test(s)) return +s;
  const m = s.match(/(19|20)\d{2}/); return m ? +m[0] : null;
}
function defaultLife(type) { return LIFE_DEFAULTS[type] ?? 20; }
/** Prefer explicit installYear, else year from installDate. */
function effectiveYear(a) {
  const y = parseYear(a && a.installYear);
  if (y != null) return y;
  return parseYear(a && a.installDate);
}
/** Age in whole years. Uses ageOverride if set; else install date anniversary; else install year. */
function computeAge(a, asOf = new Date()) {
  if (!a) return null;
  if (a.ageOverride !== undefined && a.ageOverride !== null && String(a.ageOverride).trim() !== '') {
    const n = Number(a.ageOverride); return (isFinite(n) && n >= 0) ? Math.round(n) : null;
  }
  if (a.installDate && /^\d{4}-\d{2}-\d{2}/.test(String(a.installDate))) {
    const d = new Date(String(a.installDate).slice(0, 10) + 'T12:00:00');
    if (!isNaN(d)) {
      let age = asOf.getFullYear() - d.getFullYear();
      const md = asOf.getMonth() - d.getMonth();
      if (md < 0 || (md === 0 && asOf.getDate() < d.getDate())) age--;
      return Math.max(0, age);
    }
  }
  const y = effectiveYear(a);
  return y == null ? null : Math.max(0, asOf.getFullYear() - y);
}
function computeRemaining(a) {
  const life = (a && a.lifeExpectancy !== undefined && a.lifeExpectancy !== null && String(a.lifeExpectancy).trim() !== '')
    ? Number(a.lifeExpectancy) : null;
  const age = computeAge(a);
  if (life == null || !isFinite(life) || age == null) return null;
  return Math.round((life - age) * 10) / 10;
}
/** green = plenty left, amber = ≤15% of life or ≤3 yrs left, red = at/past expectancy */
function lifeTone(remaining, life) {
  if (remaining == null) return '';
  if (remaining <= 0) return 'life-past';
  const thresh = life != null && isFinite(life) ? Math.max(3, Math.ceil(life * 0.15)) : 3;
  if (remaining <= thresh) return 'life-warn';
  return 'life-ok';
}
function lifePill(a) {
  const age = computeAge(a), rem = computeRemaining(a), life = a.lifeExpectancy;
  if (age == null && rem == null) return '';
  const tone = lifeTone(rem, life != null && life !== '' ? Number(life) : null);
  const parts = [];
  if (age != null) parts.push(`${age}y old`);
  if (rem != null) parts.push(rem < 0 ? `${Math.abs(rem)}y over` : rem === 0 ? 'at end' : `${rem}y left`);
  return `<span class="pill life ${tone}" title="Age / remaining service life">${esc(parts.join(' · '))}</span>`;
}
function lifeCardHtml(a) {
  const age = computeAge(a), rem = computeRemaining(a), y = effectiveYear(a);
  const life = a.lifeExpectancy !== undefined && a.lifeExpectancy !== null && String(a.lifeExpectancy).trim() !== '' ? Number(a.lifeExpectancy) : null;
  if (age == null && rem == null && y == null && (life == null || !isFinite(life))) return '';
  const tone = lifeTone(rem, life);
  const overrideNote = (a.ageOverride !== undefined && a.ageOverride !== null && String(a.ageOverride).trim() !== '') ? ' (manual override)' : '';
  return `<div class="card life-card">
    <div class="lbl">Age &amp; remaining life</div>
    <div class="life-stats">
      <div><div class="life-n">${y != null ? esc(y) : '—'}</div><div class="life-l">Install / mfr year</div></div>
      <div><div class="life-n">${age != null ? esc(age) + ' yrs' : '—'}</div><div class="life-l">Age${esc(overrideNote)}</div></div>
      <div><div class="life-n">${life != null && isFinite(life) ? esc(life) + ' yrs' : '—'}</div><div class="life-l">Life expectancy</div></div>
      <div class="${tone}"><div class="life-n">${rem == null ? '—' : (rem < 0 ? esc(Math.abs(rem)) + ' yrs over' : rem === 0 ? '0 yrs' : esc(rem) + ' yrs')}</div><div class="life-l">${rem == null ? 'Remaining' : rem < 0 ? 'Past expectancy' : rem === 0 ? 'At end of life' : 'Remaining'}</div></div>
    </div>
    <p class="muted small" style="margin:8px 0 0">Age updates automatically from install year/date. Defaults for life expectancy follow typical ASHRAE / industry mid-range values and are editable.</p>
  </div>`;
}


function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
}
const scriptCache = {};
function loadScript(src) {
  if (!scriptCache[src]) scriptCache[src] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res;
    s.onerror = () => { delete scriptCache[src]; rej(new Error('Could not load ' + src)); };
    document.head.appendChild(s);
  });
  return scriptCache[src];
}
const loadXLSX = () => window.XLSX ? Promise.resolve() : loadScript('vendor/xlsx.full.min.js');
const loadScanner = () => window.Html5Qrcode ? Promise.resolve() : loadScript('vendor/html5-qrcode.min.js');

function guessTypeFromTag(tag) {
  const m = normTag(tag).match(/^[A-Z]+/);
  return m ? (TYPE_ALIASES[m[0].toLowerCase()] || '') : '';
}
function normalizeType(v) {
  const s = String(v ?? '').trim(); if (!s) return '';
  const exact = TYPES.find(t => t.toLowerCase() === s.toLowerCase()); if (exact) return exact;
  return TYPE_ALIASES[normKey(s)] || TYPE_ALIASES[s.toLowerCase()] || null; // null = unknown
}
function normalizeStatus(v) {
  const s = String(v ?? '').trim().toLowerCase(); if (!s) return '';
  const exact = STATUSES.find(t => t.toLowerCase() === s); if (exact) return exact;
  if (/not|pend|todo|to do/.test(s)) return 'Not started';
  if (/issue|problem|defic|fail|open item/.test(s)) return 'Issue';
  if (/commission|^cx|complete|done|pass/.test(s)) return 'Commissioned';
  if (/start/.test(s)) return 'Started up';
  if (/install|set|placed/.test(s)) return 'Installed';
  return 'Not started';
}
function toISODate(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) { let y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`; }
  if (/^\d{5}$/.test(s)) { const d = new Date(Math.round((+s - 25569) * 864e5)); return d.toISOString().slice(0, 10); } // Excel serial
  return null; // unparseable
}
function nextTag(tag) {
  const m = String(tag || '').match(/^(.*?)(\d+)(\D*)$/);
  if (!m) return tag ? tag + '-2' : '';
  const n = String(+m[2] + 1).padStart(m[2].length, '0');
  return m[1] + n + m[3];
}
function extractTag(raw) {
  const s = String(raw ?? '').trim();
  try { // app-link QR: https://host/path/#/find?tag=AHU-1
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      const h = u.hash.includes('?') ? new URLSearchParams(u.hash.split('?')[1]) : null;
      const t = (h && h.get('tag')) || u.searchParams.get('tag');
      if (t) return t;
    }
  } catch (e) {}
  return s;
}
function qrSvg(text, ecc = 'M') {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  const qr = qrcode(0, ecc); qr.addData(String(text)); qr.make();
  return qr.createSvgTag({cellSize: 4, margin: 8, scalable: true}); // 2-module quiet zone
}
function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
async function shareOrDownload(blob, name, share) {
  if (share) {
    const file = new File([blob], name, {type: blob.type});
    if (navigator.canShare && navigator.canShare({files: [file]})) {
      try { await navigator.share({files: [file], title: name}); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
  }
  downloadBlob(blob, name);
}
const canShareFiles = () => { try { return !!(navigator.canShare && navigator.canShare({files: [new File(['x'], 'x.txt', {type: 'text/plain'})]})); } catch (e) { return false; } };
function blobToDataURL(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); }); }
async function dataURLToBlob(d) { return (await fetch(d)).blob(); }
async function resizeImage(file, max = 1600, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Not an image')); i.src = url; });
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', quality));
  } finally { URL.revokeObjectURL(url); }
}
let objectURLs = [];
function objURL(blob) { const u = URL.createObjectURL(blob); objectURLs.push(u); return u; }
function revokeAll() { objectURLs.forEach(u => URL.revokeObjectURL(u)); objectURLs = []; }

/* ---------------- IndexedDB ---------------- */
const DB = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore('projects', {keyPath: 'id'});
      db.createObjectStore('assets', {keyPath: 'id'}).createIndex('projectId', 'projectId');
      db.createObjectStore('photos', {keyPath: 'id'}).createIndex('assetId', 'assetId');
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const done = t => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Transaction aborted')); });
  return {
    async get(store, key) { const db = await open(); return rq(db.transaction(store).objectStore(store).get(key)); },
    async all(store) { const db = await open(); return rq(db.transaction(store).objectStore(store).getAll()); },
    async by(store, index, val) { const db = await open(); return rq(db.transaction(store).objectStore(store).index(index).getAll(val)); },
    async put(store, ...objs) { const db = await open(); const t = db.transaction(store, 'readwrite'); objs.forEach(o => t.objectStore(store).put(o)); return done(t); },
    async del(store, ...keys) { const db = await open(); const t = db.transaction(store, 'readwrite'); keys.forEach(k => t.objectStore(store).delete(k)); return done(t); },
    async clear() { const db = await open(); const t = db.transaction(['projects','assets','photos'], 'readwrite'); ['projects','assets','photos'].forEach(s => t.objectStore(s).clear()); return done(t); },
  };
})();
const Data = {
  projects: () => DB.all('projects'),
  project: id => DB.get('projects', id),
  saveProject: p => DB.put('projects', {...p, updatedAt: nowISO()}),
  async deleteProject(id) {
    const assets = await DB.by('assets', 'projectId', id);
    for (const a of assets) await Data.deleteAsset(a.id);
    await DB.del('projects', id);
  },
  assets: pid => DB.by('assets', 'projectId', pid),
  allAssets: () => DB.all('assets'),
  asset: id => DB.get('assets', id),
  saveAsset: a => DB.put('assets', {...a, updatedAt: nowISO()}),
  async deleteAsset(id) {
    const photos = await DB.by('photos', 'assetId', id);
    if (photos.length) await DB.del('photos', ...photos.map(p => p.id));
    await DB.del('assets', id);
  },
  photos: async aid => (await DB.by('photos', 'assetId', aid)).filter(p => !p.inspId).sort((a, b) => natCmp(a.createdAt, b.createdAt)),
  addPhoto: (assetId, blob) => DB.put('photos', {id: uid(), assetId, blob, type: blob.type || 'image/jpeg', createdAt: nowISO()}),
  deletePhoto: id => DB.del('photos', id),
  async findByTag(tag) { const t = normTag(tag); return (await DB.all('assets')).filter(a => normTag(a.tag) === t); },
};
async function photoCounts() {
  const m = {}; (await DB.all('photos')).forEach(p => { if (p.inspId) return; m[p.assetId] = (m[p.assetId] || 0) + 1; }); return m;
}

/* ---------------- modal helper ---------------- */
function modal({title = '', body = '', actions = [], onOpen, onClose, wide} = {}) {
  const d = document.createElement('dialog');
  if (wide) d.style.width = 'min(720px,96vw)';
  d.innerHTML = `<div class="dlg-head"><span>${esc(title)}</span><button class="icon-btn" data-close aria-label="Close">${ICON.close}</button></div>
    <div class="dlg-body">${body}</div>${actions.length ? `<div class="dlg-foot">${actions.map((a, i) =>
      `<button class="btn ${a.cls || ''}" data-act="${i}">${a.label}</button>`).join('')}</div>` : ''}`;
  document.body.appendChild(d);
  const close = () => { if (d.open) d.close(); };
  d.addEventListener('close', () => { onClose && onClose(); d.remove(); });
  d.addEventListener('click', e => {
    if (e.target === d) return close();
    if (e.target.closest('[data-close]')) return close();
    const b = e.target.closest('[data-act]');
    if (b) { const a = actions[+b.dataset.act]; Promise.resolve(a.onClick ? a.onClick(d) : null).then(r => { if (r !== false) close(); }); }
  });
  d.showModal(); onOpen && onOpen(d);
  return {el: d, close};
}
function confirmBox(title, msg, okLabel = 'OK', danger = false) {
  return new Promise(res => {
    let v = false;
    modal({title, body: `<p>${msg}</p>`, onClose: () => res(v), actions: [
      {label: 'Cancel'},
      {label: okLabel, cls: danger ? 'danger' : 'primary', onClick: () => { v = true; }},
    ]});
  });
}

/* ---------------- Filters & belts (maintenance parts) ---------------- */
const PART_KINDS = ['Filter', 'Belt', 'Other'];
const FREQS = [[1, 'Monthly'], [2, 'Every 2 months'], [3, 'Quarterly'], [4, 'Every 4 months'], [6, 'Semi-annual'], [12, 'Annual']];
const DEFAULT_FREQ = {Filter: 3, Belt: 6, Other: 6};
const MAILTO_MAX = 6000; // keep the whole mailto: URL well inside what phone mail apps accept
const freqLabel = m => { m = +m; const f = FREQS.find(x => x[0] === m); return f ? f[1] : (m > 0 ? `Every ${m} months` : '—'); };
function addMonths(iso, n) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return '';
  let y = +m[1], mo = +m[2] - 1 + Math.round(+n || 0);
  y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
  const last = new Date(y, mo + 1, 0).getDate();
  return `${y}-${String(mo + 1).padStart(2, '0')}-${String(Math.min(+m[3], last)).padStart(2, '0')}`;
}
const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const shiftMonth = (key, n) => addMonths(key + '-01', n).slice(0, 7);
const nextMonthKey = () => shiftMonth(monthKey(), 1);
const monthLabel = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-US', {month: 'long', year: 'numeric'}); };
const monthShort = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-US', {month: 'long'}); };
const fmtDate = iso => { if (!iso) return ''; const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); return isNaN(d) ? String(iso) : d.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}); };
function normKind(k) {
  const s = String(k ?? '').trim().toLowerCase();
  if (!s) return '';
  if (/filt|merv|media|pleat/.test(s)) return 'Filter';
  if (/belt/.test(s)) return 'Belt';
  return 'Other';
}
function normPart(p) {
  p = p || {};
  const kind = normKind(p.kind) || 'Filter';
  let freq = Math.round(Number(p.freq)); if (!isFinite(freq) || freq < 1) freq = DEFAULT_FREQ[kind]; if (freq > 120) freq = 120;
  let qty = Math.round(Number(p.qty)); if (!isFinite(qty) || qty < 1) qty = 1; if (qty > 9999) qty = 9999;
  const lastReplaced = toISODate(p.lastReplaced) || '';
  return {id: p.id || uid(), kind, size: String(p.size ?? '').trim(), qty, freq, lastReplaced,
    dueManual: lastReplaced ? '' : (toISODate(p.dueManual) || ''), notes: String(p.notes ?? '').trim()};
}
const assetParts = a => Array.isArray(a && a.parts) ? a.parts.map(normPart) : [];
/** Next due = last replaced + frequency; with no last-replaced date, the manually entered next due date. */
const partNextDue = p => p.lastReplaced ? addMonths(p.lastReplaced, p.freq) : (p.dueManual || '');
function partStatus(p, t = today()) {
  const d = partNextDue(p); if (!d) return {key: 'none', label: 'No date set', cls: 'pt-none'};
  if (d < t) return {key: 'overdue', label: 'Overdue', cls: 'pt-over'};
  const mk = d.slice(0, 7);
  if (mk === t.slice(0, 7)) return {key: 'this', label: 'Due this month', cls: 'pt-soon'};
  if (mk === shiftMonth(t.slice(0, 7), 1)) return {key: 'next', label: 'Due next month', cls: 'pt-next'};
  return {key: 'ok', label: 'Scheduled', cls: 'pt-ok'};
}
/** Occurrences of a part relative to service month mk.
    overdue: next due is before today (schedule restarts once it's replaced, so no projection).
    month:   due inside mk (directly, or projected forward by the frequency from an upcoming date).
    earlier: due between today and the start of mk. */
function partHits(p, mk, t = today()) {
  const d = partNextDue(p); if (!d) return [];
  const start = mk + '-01', end = addMonths(start, 1);
  if (d < t) return [{due: d, bucket: 'overdue'}];
  if (d >= end) return [];
  if (d >= start) return [{due: d, bucket: 'month'}];
  const out = [{due: d, bucket: 'earlier'}];
  for (let k = 1; k < 1000; k++) {
    const dk = addMonths(d, k * p.freq); if (dk >= end) break;
    if (dk >= start) { out.push({due: dk, bucket: 'month', projected: true}); break; }
  }
  return out;
}
function collectParts(projects, assets, mk, t = today()) {
  const pmap = new Map(projects.map(p => [p.id, p])); const hits = [];
  assets.forEach(a => {
    const p = pmap.get(a.projectId); if (!p) return;
    assetParts(a).forEach(part => partHits(part, mk, t).forEach(h => hits.push({project: p, asset: a, part, ...h})));
  });
  return hits;
}
function groupHits(hits) {
  const m = new Map();
  hits.forEach(h => { const g = m.get(h.asset.id) || {project: h.project, asset: h.asset, items: []}; g.items.push(h); m.set(h.asset.id, g); });
  const out = [...m.values()];
  out.forEach(g => g.items.sort((x, y) => natCmp(x.due, y.due) || PART_KINDS.indexOf(x.part.kind) - PART_KINDS.indexOf(y.part.kind)));
  return out.sort((x, y) => natCmp(x.project.name, y.project.name) || natCmp(x.asset.tag, y.asset.tag));
}
const sizeKey = s => String(s || '').trim().replace(/(\d)\s*[x×]\s*(?=\d)/gi, '$1X').replace(/\s+/g, ' ').toUpperCase();
function partTotals(hits) {
  const m = new Map();
  hits.forEach(h => {
    const k = h.part.kind + '|' + sizeKey(h.part.size);
    const t = m.get(k) || {kind: h.part.kind, qty: 0, tags: new Set(), variants: new Map()};
    t.qty += h.part.qty; t.tags.add(h.asset.tag); t.variants.set(h.part.size, (t.variants.get(h.part.size) || 0) + h.part.qty); m.set(k, t);
  });
  // show the most-used spelling of each size (e.g. "20x25x2 MERV 13" over "20 x 25 x 2 merv 13")
  return [...m.values()].map(({variants, ...t}) => ({...t, size: [...variants.entries()].sort((a, b) => b[1] - a[1])[0][0], tags: [...t.tags].sort(natCmp)}))
    .sort((a, b) => PART_KINDS.indexOf(a.kind) - PART_KINDS.indexOf(b.kind) || natCmp(sizeKey(a.size), sizeKey(b.size)));
}
const kindCounts = hits => { const c = {}; hits.forEach(h => { c[h.part.kind] = (c[h.part.kind] || 0) + h.part.qty; }); return c; };
const kindSummary = hits => { const c = kindCounts(hits); return PART_KINDS.filter(k => c[k]).map(k => `${c[k]} ${k === 'Other' ? 'other' : k.toLowerCase()}${c[k] === 1 ? '' : 's'}`).join(', '); };
function parseEmails(s) {
  const list = String(s || '').split(/[,;\s]+/).map(x => x.trim().replace(/^<|>$/g, '')).filter(Boolean);
  const ok = e => /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]+$/.test(e);
  return {valid: [...new Set(list.filter(ok))], invalid: list.filter(e => !ok(e))};
}
/** Build a parts-due context for one project (or several). */
function partsContext(projects, assets, mk, inc, single) {
  const hits = collectParts(projects, assets, mk);
  const by = b => hits.filter(h => h.bucket === b);
  const month = by('month'), overdue = by('overdue'), earlier = by('earlier');
  const ordered = inc ? [...month, ...overdue, ...earlier] : month;
  return {projects, single: single || null, name: single ? single.name : 'All projects', mk, inc, hits, month, overdue, earlier, ordered,
    groups: {month: groupHits(month), overdue: groupHits(overdue), earlier: groupHits(earlier)}, totals: partTotals(ordered)};
}
const plainLoc = a => [a.building && `Bldg ${a.building}`, a.floor && `Flr ${a.floor}`, a.room, a.areaServed && `serves ${a.areaServed}`].filter(Boolean).join(', ');
function buildMailto(to, subject, body) {
  return `mailto:${to.map(e => e.replace(/[%?&#\s]/g, c => encodeURIComponent(c))).join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
/** Plain-text email: order totals first, then the per-equipment breakdown. Also returns a length-limited mailto body. */
function partsEmail(ctx, to = []) {
  const ml = monthLabel(ctx.mk), multi = !ctx.single;
  const subject = `Filters & belts needed for ${ctx.name} - ${ml}`;
  const head = [`Filters & belts needed for ${ctx.name} - service month ${ml}.`];
  if (ctx.single) { const det = [ctx.single.client, ctx.single.address].filter(Boolean).join(', '); if (det) head.push(det); }
  head.push('', `Please order the following so they are delivered before service in ${ml}.`, '');
  const extra = ctx.inc && (ctx.overdue.length || ctx.earlier.length);
  const tot = [`ORDER TOTALS${extra ? ' (includes overdue / earlier items)' : ''}:`];
  ctx.totals.forEach(t => tot.push(`- ${t.qty} x ${t.size || '(size not set)'} (${t.kind === 'Other' ? 'part' : t.kind.toLowerCase()})`));
  if (!ctx.totals.length) tot.push('- Nothing due');
  const block = (g, label) => {
    const a = g.asset, loc = plainLoc(a);
    const lines = [`${multi ? g.project.name + ' / ' : ''}${a.tag}${a.type ? ' (' + a.type + ')' : ''}${loc ? ' - ' + loc : ''}`];
    g.items.forEach(h => lines.push(`  - ${h.part.kind}: ${h.part.size || '(size not set)'} x ${h.part.qty} - ${label === 'overdue' ? 'OVERDUE, was due' : 'due'} ${fmtDate(h.due)} (${freqLabel(h.part.freq).toLowerCase()})${h.part.notes ? ' - ' + h.part.notes : ''}`));
    return lines;
  };
  const sections = [{title: `DUE IN ${ml.toUpperCase()}:`, groups: ctx.groups.month, label: 'month'}];
  if (ctx.inc && ctx.groups.overdue.length) sections.push({title: 'OVERDUE:', groups: ctx.groups.overdue, label: 'overdue'});
  if (ctx.inc && ctx.groups.earlier.length) sections.push({title: `ALSO DUE BEFORE ${monthShort(ctx.mk).toUpperCase()}:`, groups: ctx.groups.earlier, label: 'earlier'});
  const nAssets = new Set(ctx.ordered.map(h => h.asset.id)).size;
  const foot = ['', `${ctx.ordered.length} line item${ctx.ordered.length === 1 ? '' : 's'} on ${nAssets} piece${nAssets === 1 ? '' : 's'} of equipment.`];
  const full = [...head, ...tot, '', 'BY EQUIPMENT'];
  sections.forEach(s => { if (!s.groups.length) return; full.push('', s.title); s.groups.forEach(g => full.push(...block(g, s.label))); });
  full.push(...foot);
  const text = full.join('\n');
  // Mail body: same order, but stop adding equipment blocks when the mailto URL would get too long.
  const fits = lines => buildMailto(to, subject, lines.join('\r\n')).length <= MAILTO_MAX;
  const reserve = ['', 'x'.repeat(300)];
  let mail = [...head], truncated = false, omitted = 0;
  for (const l of tot) { if (fits([...mail, l, ...reserve])) mail.push(l); else { truncated = true; break; } }
  if (!truncated) {
    mail.push('', 'BY EQUIPMENT');
    for (const s of sections) {
      let titled = false;
      for (const g of s.groups) {
        if (truncated) { omitted++; continue; }
        const add = [...(titled ? [] : ['', s.title]), ...block(g, s.label)];
        if (fits([...mail, ...add, ...reserve])) { mail.push(...add); titled = true; } else { truncated = true; omitted++; }
      }
    }
  }
  if (truncated) mail.push('', omitted ? `...plus ${omitted} more piece${omitted === 1 ? '' : 's'} of equipment not listed here to keep this email short. Full breakdown: see the Excel list (attached or sent separately).`
    : 'List too long for one email. The full list is in the attached Excel file.');
  else mail.push(...foot);
  const body = mail.join('\r\n');
  return {subject, text, body, truncated, omitted, mailto: buildMailto(to, subject, body)};
}
const PART_LIST_HEADERS = ['Project', 'Asset Tag', 'Equipment Type', 'Building', 'Floor', 'Room / Location', 'Area Served', 'Part Type', 'Size / Part #', 'Qty', 'Frequency', 'Frequency (months)', 'Last Replaced', 'Next Due', 'Due Status', 'Part Notes'];
function partRow(project, a, p, due, statusLabel) {
  return {'Project': project ? project.name : '', 'Asset Tag': a.tag || '', 'Equipment Type': a.type || '', 'Building': a.building || '', 'Floor': a.floor || '',
    'Room / Location': a.room || '', 'Area Served': a.areaServed || '', 'Part Type': p.kind, 'Size / Part #': p.size, 'Qty': p.qty,
    'Frequency': freqLabel(p.freq), 'Frequency (months)': p.freq, 'Last Replaced': p.lastReplaced || '', 'Next Due': due != null ? due : partNextDue(p),
    'Due Status': statusLabel != null ? statusLabel : partStatus(p).label, 'Part Notes': p.notes || ''};
}
const autoCols = (headers, rows) => headers.map(h => ({wch: Math.min(45, Math.max(String(h).length + 2, ...rows.map(r => String(r[h] ?? '').length + 1)))}));
async function buildPartsXlsx(ctx) {
  await loadXLSX();
  const ml = monthLabel(ctx.mk);
  const tHead = ['Part Type', 'Size / Part #', 'Total Qty', 'Equipment'];
  const aoa = [['Filters & belts needed', ctx.name], ['Service month', ml], ['Generated', new Date().toLocaleString()],
    ['Includes overdue / earlier items', ctx.inc ? 'Yes' : 'No'], [], tHead,
    ...ctx.totals.map(t => [t.kind, t.size, t.qty, t.tags.join(', ')])];
  const ws1 = XLSX.utils.aoa_to_sheet(aoa); ws1['!cols'] = [{wch: 30}, {wch: 28}, {wch: 10}, {wch: 50}];
  const bucketLabel = {month: `Due ${ml}`, overdue: 'Overdue', earlier: `Due before ${monthShort(ctx.mk)}`};
  const rows = [];
  ['month', 'overdue', 'earlier'].forEach(b => { if (b !== 'month' && !ctx.inc) return; ctx.groups[b].forEach(g => g.items.forEach(h => rows.push(partRow(g.project, g.asset, h.part, h.due, bucketLabel[b])))); });
  const hdr = PART_LIST_HEADERS.map(h => h === 'Next Due' ? 'Due Date' : h);
  const rows2 = rows.map(r => { const o = {...r, 'Due Date': r['Next Due']}; delete o['Next Due']; return o; });
  const ws2 = XLSX.utils.json_to_sheet(rows2, {header: hdr}); ws2['!cols'] = autoCols(hdr, rows2);
  if (rows2.length) ws2['!autofilter'] = {ref: XLSX.utils.encode_range({s: {r: 0, c: 0}, e: {r: rows2.length, c: hdr.length - 1}})};
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Order totals'); XLSX.utils.book_append_sheet(wb, ws2, 'By equipment');
  wb.Props = {Title: `Filters & belts – ${ctx.name} – ${ml}`, Author: 'Asset Tagger'};
  const out = XLSX.write(wb, {bookType: 'xlsx', type: 'array', compression: true});
  return {blob: new Blob([out], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), name: `${slug(ctx.name)}_filters-belts_${ctx.mk}.xlsx`};
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  try { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch (e) { return false; }
}
async function markPartReplaced(aid, partId) {
  const a = await Data.asset(aid); if (!a) return null;
  const parts = assetParts(a); const p = parts.find(x => x.id === partId); if (!p) return null;
  p.lastReplaced = today(); p.dueManual = '';
  a.parts = parts; await Data.saveAsset(a);
  return {asset: a, part: p, next: partNextDue(p)};
}
/** Home / project reminder: items due next month (and overdue) per project. */
function partsReminders(projects, assets) {
  const mk = nextMonthKey(), out = [];
  projects.forEach(p => {
    const hits = collectParts([p], assets.filter(a => a.projectId === p.id), mk);
    const month = hits.filter(h => h.bucket === 'month'), overdue = hits.filter(h => h.bucket === 'overdue');
    if (month.length || overdue.length) out.push({project: p, mk, month, overdue, emailed: (p.partsEmailed || {})[mk]});
  });
  return out;
}
function reminderHtml(r) {
  const p = r.project, ml = monthShort(r.mk);
  return `<a class="notice due-banner ${r.emailed ? 'done' : ''}" href="#/p/${encodeURIComponent(p.id)}/parts?m=${r.mk}">
    <div class="db-ico">🔧</div><div class="db-main">
    ${r.month.length ? `<div><b>Parts due next month (${esc(ml)}) for ${esc(p.name)}:</b> ${r.month.length} item${r.month.length === 1 ? '' : 's'}${kindSummary(r.month) ? ` <span class="muted">(qty ${esc(kindSummary(r.month))})</span>` : ''}</div>`
      : `<div><b>${esc(p.name)}:</b> filters / belts overdue</div>`}
    ${r.overdue.length ? `<div class="db-over">${r.overdue.length} overdue</div>` : ''}
    <div class="db-cta">${r.emailed ? `✓ List emailed ${esc(fmtDate(r.emailed))} · review` : 'Review &amp; email list'} ›</div></div></a>`;
}
function partsPill(a) {
  const st = assetParts(a).map(p => partStatus(p).key);
  if (st.includes('overdue')) return '<span class="pill pt-pill pt-over">Parts overdue</span>';
  if (st.includes('this') || st.includes('next')) return '<span class="pill pt-pill pt-next">Parts due soon</span>';
  return '';
}

/* ---------------- Service / parts due screen ---------------- */
async function renderParts(pid, q) {
  let projects, single = null;
  if (pid) { single = await Data.project(pid); if (!single) return go('/', true); projects = [single]; }
  else projects = await Data.projects();
  const assets = pid ? await Data.assets(pid) : await Data.allAssets();
  const cur = monthKey();
  const mk = /^\d{4}-(0[1-9]|1[0-2])$/.test(q.get('m') || '') ? q.get('m') : nextMonthKey();
  const inc = localStorage.getItem(LSK('at-parts-inc')) !== '0';
  const baseHash = pid ? `/p/${encodeURIComponent(pid)}/parts` : '/parts';
  setChrome(single ? `Parts due – ${single.name}` : 'Parts due – all projects', pid ? `/p/${encodeURIComponent(pid)}` : '/');
  const ctx = partsContext(projects, assets, mk, inc, single);
  const to = single ? parseEmails(single.partsEmails).valid : [];
  const mail = partsEmail(ctx, to);
  const anyParts = assets.some(a => assetParts(a).length);
  const months = []; for (let i = -3; i <= 12; i++) months.push(shiftMonth(cur, i));
  if (!months.includes(mk)) months.push(mk); months.sort();
  const ml = monthLabel(mk);
  const itemRow = (h, bucket) => {
    const p = h.part;
    return `<div class="due-row"><div class="main">
      <div><b>${esc(p.qty)} × ${esc(p.size || '(size not set)')}</b> <span class="badge">${esc(p.kind)}</span></div>
      <div class="small ${bucket === 'overdue' ? 'over-txt' : 'muted'}">${bucket === 'overdue' ? 'Overdue – was due' : 'Due'} ${esc(fmtDate(h.due))}${h.projected ? ' (projected)' : ''} · ${esc(freqLabel(p.freq))}</div>
      ${p.notes ? `<div class="small muted">${esc(p.notes)}</div>` : ''}</div>
      <button class="btn sm" data-rep="${esc(h.asset.id)}|${esc(p.id)}" title="Mark replaced today">✓ Replaced</button></div>`;
  };
  const groupCards = (groups, bucket) => groups.map(g => `<div class="card due-asset ${bucket === 'overdue' ? 'is-over' : ''}">
    <a class="due-head" href="#/p/${encodeURIComponent(g.project.id)}/a/${encodeURIComponent(g.asset.id)}">
      <span class="t">${esc(g.asset.tag)}</span><span class="badge">${esc(g.asset.type || '—')}</span><span class="chev">›</span></a>
    <div class="small muted due-loc">${esc([!single && g.project.name, locLine(g.asset), g.asset.areaServed && 'Serves ' + g.asset.areaServed].filter(Boolean).join(' · ') || 'No location')}</div>
    ${g.items.map(h => itemRow(h, bucket)).join('')}</div>`).join('');
  const nMonth = ctx.month.length;
  view.innerHTML = `
    <div class="card parts-ctl">
      <label class="lbl" for="pmMonth">Service month</label>
      <div class="month-nav"><button class="btn sm" id="pmPrev" aria-label="Previous month">‹</button>
        <select id="pmMonth">${months.map(m => `<option value="${m}" ${m === mk ? 'selected' : ''}>${esc(monthLabel(m))}${m === cur ? ' (this)' : m === shiftMonth(cur, 1) ? ' (next)' : ''}</option>`).join('')}</select>
        <button class="btn sm" id="pmNext" aria-label="Next month">›</button></div>
      <label class="chk"><input type="checkbox" id="pmInc" ${inc ? 'checked' : ''}> Include overdue &amp; earlier items in the order</label>
    </div>
    ${!anyParts ? `<div class="empty"><div class="big">🔧</div><p><b>No filters or belts set up yet.</b></p><p>Open an asset → <b>Edit details</b> → <b>Filters &amp; belts</b> to add sizes and replacement frequency.</p></div>` : `
    <div class="due-summary">
      <div><span class="n">${nMonth}</span> due in ${esc(ml)}</div>
      ${ctx.overdue.length ? `<div class="over-txt"><span class="n">${ctx.overdue.length}</span> overdue</div>` : ''}
      ${ctx.earlier.length ? `<div><span class="n">${ctx.earlier.length}</span> due before ${esc(monthShort(mk))}</div>` : ''}
    </div>
    <div class="card"><div class="lbl">Order totals – ${esc(ml)}${ctx.inc && (ctx.overdue.length || ctx.earlier.length) ? ' (incl. overdue / earlier)' : ''}</div>
      ${ctx.totals.length ? `<ul class="totals">${ctx.totals.map(t => `<li><span class="q">${esc(t.qty)}×</span><span class="s">${esc(t.size || '(size not set)')}</span><span class="badge">${esc(t.kind)}</span></li>`).join('')}</ul>`
        : `<p class="muted small" style="margin:4px 0">Nothing to order for ${esc(ml)}.</p>`}
    </div>
    <div class="card no-print"><div class="lbl">Send to customer / contractor</div>
      ${single ? (to.length ? `<p class="small" style="margin:2px 0 8px">To: <b>${esc(to.join(', '))}</b> <button class="linkbtn" id="pmEditEmails">Edit</button></p>`
        : `<div class="notice warn" style="margin:4px 0 10px">No parts order email set for this project. <button class="linkbtn" id="pmEditEmails">Add email(s)</button></div>`)
        : `<p class="small muted" style="margin:2px 0 8px">Combined list for all projects – recipients are left blank. Open a project's list to email its customer directly.</p>`}
      ${mail.truncated ? `<div class="notice warn" style="margin:4px 0 10px">Long list: the email includes the order totals${mail.omitted ? ` and part of the breakdown (${mail.omitted} equipment not listed)` : ''}. Use <b>Download Excel</b> and attach it for the full list.</div>` : ''}
      <div class="row" style="margin-bottom:0">
        ${navigator.share ? '<button class="btn sm" id="pmShare">Share text…</button>' : ''}
        <button class="btn sm" id="pmCopy">Copy text</button>
        <button class="btn sm" id="pmXlsx">Download Excel</button>
        ${canShareFiles() ? '<button class="btn sm" id="pmXlsxShare">Share Excel…</button>' : ''}
      </div>
      <p class="muted small" style="margin:8px 0 0">“Email this list” opens your mail app with the list filled in – review and press Send there. Email links can't carry attachments; to send the Excel, use Share Excel… (phone) or download and attach it.</p>
    </div>
    ${ctx.overdue.length ? `<h2 class="over-txt">Overdue (${ctx.overdue.length})</h2>${groupCards(ctx.groups.overdue, 'overdue')}` : ''}
    <h2>Due in ${esc(ml)} (${nMonth})</h2>
    ${nMonth ? groupCards(ctx.groups.month, 'month') : `<div class="empty" style="padding:16px">No filters or belts due in ${esc(ml)}.</div>`}
    ${ctx.earlier.length ? `<h2>Due before ${esc(monthShort(mk))} (${ctx.earlier.length})</h2>${groupCards(ctx.groups.earlier, 'earlier')}` : ''}`}`;
  const canSend = anyParts && ctx.ordered.length;
  setBottomBar(anyParts ? `<a class="btn primary ${canSend ? '' : 'disabled'}" id="pmEmail" ${canSend ? `href="${esc(mail.mailto)}"` : 'aria-disabled="true"'}>✉️ Email this list</a>` : '');
  const goMonth = m => go(`${baseHash}?m=${m}`, true);
  $('#pmMonth').onchange = e => goMonth(e.target.value);
  $('#pmPrev').onclick = () => goMonth(shiftMonth(mk, -1));
  $('#pmNext').onclick = () => goMonth(shiftMonth(mk, 1));
  $('#pmInc').onchange = e => { localStorage.setItem(LSK('at-parts-inc'), e.target.checked ? '1' : '0'); route(); };
  if (!anyParts) return;
  const ee = $('#pmEditEmails'); if (ee) ee.onclick = () => projectDialog(single);
  const em = $('#pmEmail');
  if (em) em.onclick = async e => {
    if (!canSend) { e.preventDefault(); toast(`Nothing due in ${ml}`); return; }
    if (single) { single.partsEmailed = {...(single.partsEmailed || {}), [mk]: nowISO()}; await DB.put('projects', single); }
    if (single && !to.length) toast('No recipient set – add the address in your mail app', 3500);
  };
  const sh = $('#pmShare'); if (sh) sh.onclick = async () => {
    try { await navigator.share({title: mail.subject, text: mail.text}); } catch (e) { if (e.name !== 'AbortError') toast('Share failed: ' + e.message); }
  };
  $('#pmCopy').onclick = async () => toast(await copyText(mail.subject + '\n\n' + mail.text) ? 'List copied' : 'Copy failed');
  const xl = async share => {
    try { const {blob, name} = await buildPartsXlsx(ctx); await shareOrDownload(blob, name, share); toast('Excel ready: ' + name); }
    catch (e) { console.error(e); toast('Excel failed: ' + e.message); }
  };
  $('#pmXlsx').onclick = () => xl(false);
  const xs = $('#pmXlsxShare'); if (xs) xs.onclick = () => xl(true);
  view.onclick = async e => {
    const b = e.target.closest('[data-rep]'); if (!b) return;
    const [aid, partId] = b.dataset.rep.split('|');
    const h = ctx.hits.find(x => x.asset.id === aid && x.part.id === partId); if (!h) return;
    if (!await confirmBox('Mark replaced today?', `${esc(h.part.kind)} <b>${esc(h.part.size)}</b> on ${esc(h.asset.tag)} replaced ${esc(fmtDate(today()))}. Next due becomes <b>${esc(fmtDate(partNextDue({...h.part, lastReplaced: today()})))}</b>.`, 'Mark replaced')) return;
    const r = await markPartReplaced(aid, partId);
    if (r) { toast(`${r.asset.tag}: ${r.part.kind} replaced – next due ${fmtDate(r.next)}`, 3000); route(); }
  };
}

/* ---------------- Inspection checklists ----------------
   Templates: per equipment type, defaults below; edited copies saved in localStorage (LSK('at-insp-tpl')) and in backups.
   Asset: a.inspFreq ('' = type default, '0' = no schedule, else months), a.inspExtra = [item], a.inspections = [inspection].
   Inspection: {id, date, inspector, status:'draft'|'complete', items:[{id,text,required,reading,unit,result:''|'done'|'na'|'fail',value,note,resolvedAt}], notes, signature, startedAt, completedAt}.
   Item photos live in the photos store with {inspId, itemId} so they never show as nameplate photos. */
const INSP_TYPES = TYPES;
const defic = n => `${n} ${n === 1 ? 'deficiency' : 'deficiencies'}`;
const R = (text, o = {}) => ({text, required: o.opt ? false : true, reading: !!o.unit, unit: o.unit || ''});
const INSP_DEFAULTS = {
  'AHU': {freq: 3, items: [R('Check / replace filters'), R('Inspect belts & tension – adjust or replace'), R('Lubricate fan & motor bearings'), R('Check coils clean (heating / cooling)'),
    R('Check drain pan & condensate line clear'), R('Check dampers & actuators stroke freely'), R('Check fan motor amps', {unit: 'A'}), R('Measure supply air temperature', {unit: '°F', opt: 1}),
    R('Verify controls / sensors reading correctly'), R('Check for unusual noise / vibration'), R('Check access doors, gaskets & casing', {opt: 1})]},
  'RTU': {freq: 3, items: [R('Check / replace filters'), R('Inspect belts & tension – adjust or replace'), R('Clean / inspect condenser & evaporator coils'), R('Check drain pan & condensate line clear'),
    R('Check compressor amps', {unit: 'A'}), R('Check refrigerant suction pressure', {unit: 'psig', opt: 1}), R('Inspect economizer damper & actuator'), R('Inspect gas heat: burners, flue, ignition', {opt: 1}),
    R('Measure supply air temperature', {unit: '°F'}), R('Verify thermostat / controls'), R('Check electrical connections & contactors'), R('Check for unusual noise / vibration'), R('Check curb, panels & roof penetrations', {opt: 1})]},
  'Chiller': {freq: 3, items: [R('Review operating log & alarm history'), R('Record chilled water leaving temperature', {unit: '°F'}), R('Record condenser water entering temperature', {unit: '°F'}),
    R('Record evaporator refrigerant pressure', {unit: 'psig'}), R('Record condenser refrigerant pressure', {unit: 'psig'}), R('Check compressor amps', {unit: 'A'}), R('Check oil level & oil pressure'),
    R('Check for refrigerant leaks'), R('Verify water flow & flow switches'), R('Inspect starter / electrical connections'), R('Verify controls, setpoints & safeties'), R('Check for unusual noise / vibration'), R('Check insulation & condensation', {opt: 1})]},
  'Boiler': {freq: 3, items: [R('Review operating log & alarm history'), R('Inspect burner flame & combustion'), R('Inspect flue / venting & combustion air openings'), R('Test low-water cutoff'),
    R('Check operating & high-limit controls'), R('Record supply water temperature', {unit: '°F'}), R('Record system pressure', {unit: 'psi'}), R('Check for leaks & corrosion'),
    R('Check gas pressure at manifold', {unit: 'in. w.c.', opt: 1}), R('Test safety / relief valve', {opt: 1}), R('Check condensate neutralizer', {opt: 1})]},
  'Pump': {freq: 6, items: [R('Check for leaks at seals / packing'), R('Lubricate pump & motor bearings'), R('Check coupling & alignment'), R('Record differential pressure', {unit: 'psi', opt: 1}),
    R('Check motor amps', {unit: 'A'}), R('Check for unusual noise / vibration'), R('Check strainer clean'), R('Verify VFD / controls operation'), R('Check isolation valves & gauges', {opt: 1})]},
  'VAV': {freq: 12, items: [R('Verify damper actuator strokes full open / closed'), R('Check airflow vs. design', {unit: 'CFM', opt: 1}), R('Verify reheat valve operation', {opt: 1}),
    R('Verify space temperature sensor', {unit: '°F'}), R('Check controller communicating with BAS'), R('Inspect box & duct connections for leaks')]},
  'FCU': {freq: 6, items: [R('Check / replace filter'), R('Clean coil'), R('Check drain pan & condensate line clear'), R('Check fan motor & bearings'), R('Verify valve & controls operation'),
    R('Verify thermostat / sensor'), R('Check for unusual noise / vibration')]},
  'Exhaust Fan': {freq: 6, items: [R('Inspect belt & tension (belt drive)', {opt: 1}), R('Lubricate bearings'), R('Check fan motor amps', {unit: 'A'}), R('Verify rotation & airflow'), R('Check backdraft damper'),
    R('Check for unusual noise / vibration'), R('Check disconnect & wiring'), R('Inspect curb, housing & bird screen', {opt: 1})]},
  'Cooling Tower': {freq: 1, items: [R('Inspect fill & drift eliminators'), R('Check basin water level & makeup valve'), R('Clean basin & strainers'), R('Check water treatment / chemical levels'),
    R('Inspect fan belts & tension / gearbox oil level'), R('Check fan motor amps', {unit: 'A'}), R('Test vibration switch'), R('Check spray nozzles / water distribution'),
    R('Check basin heater operation', {opt: 1}), R('Record leaving water temperature', {unit: '°F', opt: 1})]},
  'Heat Exchanger': {freq: 12, items: [R('Record primary entering / leaving temperature', {unit: '°F'}), R('Record secondary leaving temperature', {unit: '°F'}), R('Check pressure drop', {unit: 'psi', opt: 1}),
    R('Check for leaks at gaskets / connections'), R('Verify control valve operation'), R('Inspect insulation'), R('Check relief valve & air vents', {opt: 1})]},
  'VRF Unit': {freq: 6, items: [R('Clean / replace filters'), R('Clean coils'), R('Check drain pan / condensate pump'), R('Check error codes & alarm history'), R('Check refrigerant pressure', {unit: 'psig', opt: 1}),
    R('Check compressor amps', {unit: 'A', opt: 1}), R('Verify controls / remote controller'), R('Check for unusual noise / vibration'), R('Inspect refrigerant piping insulation')]},
  'Other': {freq: 12, items: [R('Visual inspection – overall condition'), R('Check for leaks'), R('Check electrical connections'), R('Verify controls / operation'), R('Check for unusual noise / vibration'), R('Clean equipment & area', {opt: 1})]},
};
const INSP_FREQS = [[1, 'Monthly'], [2, 'Every 2 months'], [3, 'Quarterly'], [4, 'Every 4 months'], [6, 'Semi-annual'], [12, 'Annual'], [24, 'Every 2 years']];
const inspFreqLabel = m => { m = +m; if (!m) return 'No schedule'; const f = INSP_FREQS.find(x => x[0] === m); return f ? f[1] : `Every ${m} months`; };
const normItem = (it, keepResult) => {
  it = it || {};
  const unit = String(it.unit ?? '').trim().slice(0, 20);
  const o = {id: it.id || uid(), text: String(it.text ?? '').trim().slice(0, 200), required: it.required !== false, reading: !!(it.reading || unit), unit};
  if (keepResult) { o.result = ['done', 'na', 'fail'].includes(it.result) ? it.result : ''; o.value = String(it.value ?? '').trim(); o.note = String(it.note ?? '').trim(); o.resolvedAt = it.resolvedAt || ''; o.extra = it.extra || ''; }
  return o;
};
function loadTplStore() { try { return JSON.parse(localStorage.getItem(LSK('at-insp-tpl')) || '{}') || {}; } catch (e) { return {}; } }
function saveTplStore(s) { localStorage.setItem(LSK('at-insp-tpl'), JSON.stringify(s)); }
const tplType = type => INSP_DEFAULTS[type] ? type : 'Other';
function defaultTemplate(type) { const d = INSP_DEFAULTS[tplType(type)]; return {freq: d.freq, items: d.items.map((x, i) => normItem({...x, id: `d-${slug(tplType(type)).toLowerCase()}-${i}`}))}; }
function getTemplate(type) {
  const t = tplType(type), s = loadTplStore()[t];
  if (s && Array.isArray(s.items)) return {freq: Number.isFinite(+s.freq) ? +s.freq : INSP_DEFAULTS[t].freq, items: s.items.map(x => normItem(x)).filter(x => x.text), custom: true};
  return defaultTemplate(t);
}
const inspList = a => (Array.isArray(a && a.inspections) ? a.inspections : []).slice().sort((x, y) => natCmp(y.date, x.date) || natCmp(y.startedAt, x.startedAt));
const assetExtra = a => (Array.isArray(a && a.inspExtra) ? a.inspExtra : []).map(x => normItem(x)).filter(x => x.text);
/** Months between inspections for this asset: per-asset override, else the type template's default. 0 = not scheduled. */
function inspFreqOf(a) { const v = a && a.inspFreq; if (v !== undefined && v !== null && v !== '' && isFinite(+v)) return Math.max(0, Math.round(+v)); return getTemplate(a && a.type).freq; }
function inspCounts(insp) {
  const items = insp.items || [], c = {total: items.length, done: 0, na: 0, fail: 0, open: 0, reqTotal: 0, reqLeft: [], failNoNote: []};
  items.forEach(it => {
    if (it.result === 'done') c.done++; else if (it.result === 'na') c.na++; else if (it.result === 'fail') { c.fail++; if (!it.resolvedAt) c.open++; }
    if (it.required) c.reqTotal++;
    if (it.result === 'fail' && !String(it.note || '').trim()) c.failNoNote.push(it);
    else if (it.required && !it.result) c.reqLeft.push(it);
  });
  c.answered = c.done + c.na + c.fail;
  c.reqDone = c.reqTotal - items.filter(it => it.required && (!it.result || (it.result === 'fail' && !String(it.note || '').trim()))).length;
  return c;
}
const inspResult = insp => insp.status !== 'complete' ? 'In progress' : (inspCounts(insp).fail ? 'Passed with deficiencies' : 'Passed');
const inspResultCls = r => r === 'Passed' ? 'ir-pass' : r === 'Passed with deficiencies' ? 'ir-def' : 'ir-prog';
const inspResultPill = insp => { const r = inspResult(insp); return `<span class="pill ${inspResultCls(r)}">${esc(r)}</span>`; };
const lastComplete = a => inspList(a).find(i => i.status === 'complete') || null;
const openDraft = a => inspList(a).find(i => i.status !== 'complete') || null;
const openDeficiencies = a => inspList(a).filter(i => i.status === 'complete').reduce((n, i) => n + inspCounts(i).open, 0);
function inspNextDue(a) { const f = inspFreqOf(a); if (!f) return ''; const l = lastComplete(a); return l ? addMonths(l.date, f) : ''; }
/** {key, label, cls}: overdue / this / next / ok / never / none (no schedule). */
function inspDueStatus(a, t = today()) {
  const f = inspFreqOf(a); if (!f) return {key: 'none', label: 'Not scheduled', cls: 'pt-none'};
  const d = inspNextDue(a); if (!d) return {key: 'never', label: 'Not inspected yet', cls: 'pt-none'};
  if (d < t) return {key: 'overdue', label: 'Inspection overdue', cls: 'pt-over'};
  const mk = d.slice(0, 7);
  if (mk === t.slice(0, 7)) return {key: 'this', label: 'Inspection due this month', cls: 'pt-soon'};
  if (mk === shiftMonth(t.slice(0, 7), 1)) return {key: 'next', label: 'Inspection due next month', cls: 'pt-next'};
  return {key: 'ok', label: 'Inspection scheduled', cls: 'pt-ok'};
}
function newInspection(a) {
  const tpl = getTemplate(a.type);
  const items = [...tpl.items.map(x => normItem({...x, id: uid()}, true)), ...assetExtra(a).map(x => normItem({...x, id: uid(), extra: 'asset'}, true))];
  return {id: uid(), date: today(), inspector: localStorage.getItem(LSK('at-inspector')) || '', status: 'draft', items, notes: '', signature: '', startedAt: nowISO(), completedAt: '', template: tplType(a.type)};
}
async function saveInspection(aid, insp) {
  const a = await Data.asset(aid); if (!a) return null;
  const list = Array.isArray(a.inspections) ? a.inspections.slice() : [];
  const i = list.findIndex(x => x.id === insp.id); insp.updatedAt = nowISO();
  if (i >= 0) list[i] = insp; else list.push(insp);
  a.inspections = list; await Data.saveAsset(a); return a;
}
async function deleteInspection(aid, iid) {
  const a = await Data.asset(aid); if (!a) return;
  a.inspections = (a.inspections || []).filter(x => x.id !== iid); await Data.saveAsset(a);
  const ph = await inspPhotos(aid, iid); if (ph.length) await DB.del('photos', ...ph.map(p => p.id));
}
const inspPhotos = async (aid, iid) => (await DB.by('photos', 'assetId', aid)).filter(p => p.inspId && (!iid || p.inspId === iid)).sort((a, b) => natCmp(a.createdAt, b.createdAt));
/** Short status line for lists: "Inspected Sep 12, 2026 · Passed" */
function inspLine(a) {
  const l = lastComplete(a), d = openDraft(a), parts = [];
  if (l) parts.push(`Inspected ${fmtDate(l.date).replace(', ' + new Date().getFullYear(), '')} · ${inspResult(l) === 'Passed' ? 'Passed' : 'Passed w/ ' + defic(inspCounts(l).fail)}`);
  if (d) parts.push('inspection in progress');
  return parts.join(' · ');
}
function inspPill(a) {
  const open = openDeficiencies(a), st = inspDueStatus(a), dr = openDraft(a);
  if (open) return `<span class="pill pt-pill pt-over">${defic(open)} open</span>`;
  if (dr) return '<span class="pill pt-pill ir-prog">Insp. in progress</span>';
  if (st.key === 'overdue') return '<span class="pill pt-pill pt-over">Insp. overdue</span>';
  if (st.key === 'this') return '<span class="pill pt-pill pt-soon">Insp. due</span>';
  return '';
}

const inspBase = (pid, aid) => `/p/${encodeURIComponent(pid)}/a/${encodeURIComponent(aid)}`;
const inspHref = (pid, aid, iid, sub = '') => `#${inspBase(pid, aid)}/i/${encodeURIComponent(iid)}${sub}`;
/** Asset detail card: last result, next due, start / continue, history. */
function inspCardHtml(pid, a) {
  const list = inspList(a), last = lastComplete(a), draft = openDraft(a), f = inspFreqOf(a), st = inspDueStatus(a), nd = inspNextDue(a), open = openDeficiencies(a);
  const tpl = getTemplate(a.type), nItems = tpl.items.length + assetExtra(a).length;
  const hist = list.map(i => { const c = inspCounts(i);
    return `<a class="ih-row" href="${inspHref(pid, a.id, i.id)}"><div class="main">
      <div><b>${esc(fmtDate(i.date))}</b> ${inspResultPill(i)}</div>
      <div class="small muted">${esc(i.inspector || 'No inspector')} · ${i.status === 'complete' ? `${c.done} done, ${c.na} N/A, ${c.fail} failed` : `${c.answered}/${c.total} answered`}${c.open ? ` · <b class="over-txt">${defic(c.open)} open</b>` : ''}</div></div><span class="chev">›</span></a>`; }).join('');
  return `<div class="card insp-card" id="inspCard"><div class="lbl">Inspections</div>
    <div class="insp-sum">
      <div><div class="life-l">Last inspection</div><div class="is-v">${last ? esc(fmtDate(last.date)) : '—'}</div>${last ? `<div>${inspResultPill(last)}</div>` : '<div class="small muted">None yet</div>'}</div>
      <div><div class="life-l">Next due</div><div class="is-v">${nd ? esc(fmtDate(nd)) : f ? 'Now' : '—'}</div><div><span class="pill pt-pill ${st.cls}">${esc(st.key === 'ok' ? 'Scheduled' : st.label.replace('Inspection ', '').replace(/^./, c => c.toUpperCase()))}</span></div></div>
    </div>
    ${open ? `<div class="notice warn small" style="margin:10px 0 0"><b>${defic(open)} open</b> from past inspections – open the inspection to see notes / mark resolved.</div>` : ''}
    <p class="small muted" style="margin:10px 0 0">${esc(inspFreqLabel(f))}${a.inspFreq === undefined || a.inspFreq === '' ? ' (type default)' : ''} · ${nItems} checklist item${nItems === 1 ? '' : 's'} (${esc(tplType(a.type))}${assetExtra(a).length ? ` + ${assetExtra(a).length} for this unit` : ''})</p>
    <div class="row" style="margin:10px 0 0">${draft
      ? `<a class="btn primary" id="bInspGo" href="${inspHref(pid, a.id, draft.id)}">▶ Continue inspection (${inspCounts(draft).answered}/${draft.items.length})</a>`
      : `<button class="btn primary" id="bInspStart">✓ Start inspection</button>`}
      <button class="btn sm" id="bInspSetup">Checklist &amp; schedule</button></div>
    ${hist ? `<div class="lbl" style="margin-top:14px">History (${list.length})</div><div class="ih-list">${hist}</div>` : ''}
  </div>`;
}
async function startInspection(pid, aid) {
  const a = await Data.asset(aid); if (!a) return;
  const d = openDraft(a); if (d) return go(`${inspBase(pid, aid)}/i/${encodeURIComponent(d.id)}`);
  const insp = newInspection(a);
  if (!insp.items.length) { toast('This checklist has no items – add some in Checklist & schedule'); return; }
  await saveInspection(aid, insp);
  go(`${inspBase(pid, aid)}/i/${encodeURIComponent(insp.id)}`);
}
/** Shared item-list editor (Settings templates + per-asset extras). items: [{id,text,required,reading,unit}] (mutated). */
function itemsEditor(host, items, onChange) {
  const row = (it, i) => `<div class="ti-row" data-i="${i}">
    <div class="ti-top"><span class="ti-n">${i + 1}</span><input data-k="text" value="${esc(it.text)}" placeholder="Task, e.g. Check belt tension" aria-label="Item ${i + 1} text">
      <button type="button" class="icon-btn ti-rm" data-rm="${i}" aria-label="Remove item ${i + 1}">${ICON.close}</button></div>
    <div class="ti-opts">
      <label class="chk"><input type="checkbox" data-k="required" ${it.required ? 'checked' : ''}> Required</label>
      <label class="chk"><input type="checkbox" data-k="reading" ${it.reading ? 'checked' : ''}> Reading</label>
      <input class="ti-unit" data-k="unit" value="${esc(it.unit)}" placeholder="unit (A, °F, psi)" aria-label="Reading unit" ${it.reading ? '' : 'hidden'}>
      <span class="ti-mv"><button type="button" class="btn sm" data-up="${i}" aria-label="Move up" ${i ? '' : 'disabled'}>↑</button><button type="button" class="btn sm" data-dn="${i}" aria-label="Move down" ${i < items.length - 1 ? '' : 'disabled'}>↓</button></span>
    </div></div>`;
  const render = () => { host.innerHTML = items.length ? items.map(row).join('') : '<p class="muted small" style="margin:0 0 8px">No items.</p>'; };
  render();
  host.oninput = host.onchange = e => {
    const el = e.target.closest('[data-k]'), r = e.target.closest('.ti-row'); if (!el || !r) return;
    const it = items[+r.dataset.i], k = el.dataset.k;
    if (k === 'text' || k === 'unit') it[k] = el.value;
    else { it[k] = el.checked; if (k === 'reading') { const u = $('.ti-unit', r); u.hidden = !el.checked; if (el.checked) u.focus(); } }
    onChange && onChange();
  };
  host.onclick = e => {
    const b = e.target.closest('[data-rm],[data-up],[data-dn]'); if (!b) return;
    if (b.dataset.rm != null) items.splice(+b.dataset.rm, 1);
    else { const i = +(b.dataset.up ?? b.dataset.dn), j = b.dataset.up != null ? i - 1 : i + 1; if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; }
    render(); onChange && onChange();
  };
  return {render, add() { items.push(normItem({text: '', required: true})); render(); const f = host.querySelector(`.ti-row[data-i="${items.length - 1}"] [data-k="text"]`); if (f) f.focus(); onChange && onChange(); }};
}
const freqOptions = (sel, withDefault, defFreq) => (withDefault ? `<option value="" ${sel === '' ? 'selected' : ''}>Type default (${esc(inspFreqLabel(defFreq))})</option>` : '') +
  INSP_FREQS.map(([m, l]) => `<option value="${m}" ${String(sel) === String(m) ? 'selected' : ''}>${l}</option>`).join('') +
  `<option value="0" ${String(sel) === '0' ? 'selected' : ''}>No schedule</option>` +
  (sel !== '' && +sel && !INSP_FREQS.some(f => f[0] === +sel) ? `<option value="${esc(sel)}" selected>Every ${esc(sel)} months</option>` : '');
function inspSetupDialog(pid, a) {
  const tpl = getTemplate(a.type), extra = assetExtra(a).map(x => ({...x}));
  const sel = a.inspFreq === undefined || a.inspFreq === null ? '' : String(a.inspFreq);
  const m = modal({title: `${a.tag} – checklist & schedule`, body: `
    <div class="field"><label for="isFreq">Inspect every</label><select id="isFreq">${freqOptions(sel, true, tpl.freq)}</select>
      <p class="muted small" style="margin:6px 0 0">Next due = last completed inspection + this interval.</p></div>
    <details class="filters"><summary>${esc(tplType(a.type))} checklist (${tpl.items.length} items${tpl.custom ? ', customized' : ''})</summary>
      <ol class="tpl-peek">${tpl.items.map(x => `<li>${esc(x.text)}${x.required ? '' : ' <span class="muted">(optional)</span>'}${x.reading ? ` <span class="badge">${esc(x.unit || 'reading')}</span>` : ''}</li>`).join('')}</ol>
      <p class="muted small">Edit the ${esc(tplType(a.type))} checklist for all units in <a data-close href="#/settings/checklists/${encodeURIComponent(tplType(a.type))}">Settings → Inspection checklists</a>.</p></details>
    <div class="lbl" style="margin-top:12px">Extra items for this unit only</div>
    <div id="isExtra"></div>
    <button type="button" class="btn sm" id="isAdd">+ Add item</button>`,
    actions: [{label: 'Cancel'}, {label: 'Save', cls: 'primary', onClick: async d => {
      const cur = await Data.asset(a.id); if (!cur) return;
      cur.inspFreq = $('#isFreq', d).value;
      cur.inspExtra = extra.map(x => normItem(x)).filter(x => x.text);
      await Data.saveAsset(cur); toast('Checklist saved'); route();
    }}]});
  const ed = itemsEditor($('#isExtra', m.el), extra);
  $('#isAdd', m.el).onclick = () => ed.add();
}

const RES_LABEL = {done: 'Done', na: 'N/A', fail: 'Fail', '': 'Not checked'};
const RES_ICON = {done: '✓', na: 'N/A', fail: '✗', '': '–'};
const addInspPhoto = (assetId, inspId, itemId, blob) => DB.put('photos', {id: uid(), assetId, inspId, itemId, blob, type: blob.type || 'image/jpeg', createdAt: nowISO()});
async function renderInspection(pid, aid, iid, q) {
  const [p, a] = await Promise.all([Data.project(pid), Data.asset(aid)]);
  if (!p) return go('/', true);
  if (!a) return go(`/p/${encodeURIComponent(pid)}`, true);
  const insp = (a.inspections || []).find(x => x.id === iid);
  if (!insp) { toast('Inspection not found'); return go(inspBase(pid, aid), true); }
  insp.items = (insp.items || []).map(x => normItem(x, true));
  if (q.get('report')) return renderInspReport(p, a, insp);
  if (insp.status === 'complete') return renderInspView(p, a, insp);
  return renderInspEdit(p, a, insp);
}
function renderInspEdit(p, a, insp) {
  const pid = p.id, aid = a.id, back = inspBase(pid, aid);
  setChrome(`Inspect ${a.tag}`, back, `<button class="icon-btn" id="iMenu" aria-label="Inspection menu">${ICON.more}</button>`);
  let photos = [];
  const itemHtml = (it, i) => {
    const ph = photos.filter(x => x.itemId === it.id);
    const showNote = it.result === 'fail' || it.note || it._noteOpen;
    return `<div class="ii card ${it.result ? 'r-' + it.result : ''}" data-id="${esc(it.id)}" id="ii-${esc(it.id)}">
      <div class="ii-top"><span class="ii-n">${i + 1}</span><div class="ii-t">${esc(it.text)}
        <div class="ii-tags">${it.required ? '<span class="badge req-b">Required</span>' : '<span class="badge opt-b">Optional</span>'}${it.extra === 'asset' ? '<span class="badge">This unit</span>' : it.extra === 'adhoc' ? '<span class="badge">Added</span>' : ''}</div></div></div>
      <div class="ir-btns" role="group" aria-label="Result for ${esc(it.text)}">
        <button type="button" data-r="done" class="${it.result === 'done' ? 'on' : ''}" aria-pressed="${it.result === 'done'}">✓ Done</button>
        <button type="button" data-r="na" class="${it.result === 'na' ? 'on' : ''}" aria-pressed="${it.result === 'na'}">N/A</button>
        <button type="button" data-r="fail" class="${it.result === 'fail' ? 'on' : ''}" aria-pressed="${it.result === 'fail'}">✗ Fail</button></div>
      ${it.reading ? `<div class="ii-read"><label for="rv-${esc(it.id)}">Reading${it.unit ? ` (${esc(it.unit)})` : ''}</label><input id="rv-${esc(it.id)}" data-f="value" value="${esc(it.value)}" inputmode="decimal" enterkeyhint="done" placeholder="${it.unit ? 'e.g. value in ' + esc(it.unit) : 'Value'}" autocomplete="off"></div>` : ''}
      ${showNote ? `<div class="ii-note"><label for="nt-${esc(it.id)}">${it.result === 'fail' ? 'Deficiency note <span class="req">* required</span>' : 'Note'}</label>
        <textarea id="nt-${esc(it.id)}" data-f="note" rows="2" placeholder="${it.result === 'fail' ? 'What is wrong / what is needed? e.g. Belt cracked – replace BX-62' : 'Optional note'}">${esc(it.note)}</textarea></div>` : `<button type="button" class="linkbtn ii-addnote" data-note>+ Note</button>`}
      ${it.result === 'fail' || ph.length ? `<div class="photos ii-ph">${ph.map(x => `<div class="ph"><img alt="Deficiency photo" src="${objURL(x.blob)}"><button type="button" class="x" data-rmph="${esc(x.id)}" aria-label="Remove photo">×</button></div>`).join('')}
        <label class="addph">${ICON.camera}<span>Photo</span><input type="file" accept="image/*" capture="environment" hidden data-addph></label></div>` : ''}
    </div>`;
  };
  view.innerHTML = `
    <div class="hero insp-hero"><div class="tag">${esc(a.tag)}</div>
      <div class="meta"><span class="badge">${esc(a.type || '—')}</span>${inspResultPill(insp)}</div>
      <div class="muted small" style="margin-top:6px">${esc([p.name, locLine(a)].filter(Boolean).join(' · '))}</div>
      <div class="grid2" style="margin-top:12px">
        <div class="field" style="margin:0"><label for="iDate">Inspection date</label><input id="iDate" type="date" value="${esc(insp.date)}"></div>
        <div class="field" style="margin:0"><label for="iBy">Inspector</label><input id="iBy" value="${esc(insp.inspector)}" placeholder="Your name" autocomplete="name"></div>
      </div></div>
    <div class="card insp-prog" id="iProg"></div>
    <div id="iItems">${insp.items.map(itemHtml).join('')}</div>
    <div class="row"><button class="btn sm" id="iAddItem">+ Add item to this inspection</button></div>
    <div class="card"><div class="field" style="margin:0"><label for="iNotes">General notes</label><textarea id="iNotes" placeholder="Observations, follow-up, parts used…">${esc(insp.notes)}</textarea></div></div>
    <p class="muted small" style="text-align:center">Saved automatically as a draft on this device.</p>`;
  const renderProg = () => {
    const c = inspCounts(insp), pct = c.reqTotal ? Math.round(100 * c.reqDone / c.reqTotal) : 100;
    $('#iProg').innerHTML = `<div class="ip-head"><span><b class="ip-n">${c.reqDone}/${c.reqTotal}</b> required complete</span><span class="muted small">${c.answered}/${c.total} items answered${c.fail ? ` · <b class="over-txt">${c.fail} failed</b>` : ''}</span></div>
      <div class="progress"><span style="width:${pct}%"></span></div>`;
    const b = $('#iDone'); if (b) { b.innerHTML = `Complete (${c.reqDone}/${c.reqTotal})`; b.classList.toggle('disabled', c.reqDone < c.reqTotal); }
  };
  setBottomBar(`<button class="btn" id="iSave">Save draft</button><button class="btn primary" id="iDone">Complete</button>`);
  renderProg();
  let timer = null;
  let chain = Promise.resolve();
  const persist = () => { clearTimeout(timer); timer = null; const {items, ...rest} = insp; const snap = {...rest, items: items.map(({_noteOpen, ...x}) => ({...x}))};
    return (chain = chain.then(() => saveInspection(aid, snap)).catch(e => { console.error(e); toast('Save failed: ' + e.message); })); };
  const later = () => { clearTimeout(timer); timer = setTimeout(() => persist().catch(console.error), 500); };
  // flush pending edits if the user navigates away mid-typing
  const flush = () => { if (timer) persist().catch(console.error); window.removeEventListener('hashchange', flush); };
  window.addEventListener('hashchange', flush);
  const refreshItem = it => { const el = $(`#ii-${CSS.escape(it.id)}`); if (el) el.outerHTML = itemHtml(it, insp.items.indexOf(it)); };
  inspPhotos(aid, insp.id).then(ph => { photos = ph; if (ph.length) insp.items.forEach(it => { if (ph.some(x => x.itemId === it.id)) refreshItem(it); }); });
  const items = $('#iItems');
  items.onclick = async e => {
    const card = e.target.closest('.ii'); if (!card) return;
    const it = insp.items.find(x => x.id === card.dataset.id); if (!it) return;
    const rb = e.target.closest('[data-r]');
    if (rb) {
      const r = rb.dataset.r; it.result = it.result === r ? '' : r;
      refreshItem(it); renderProg(); await persist();
      if (it.result === 'fail' && !it.note) { const t = $(`#nt-${CSS.escape(it.id)}`); if (t) t.focus(); }
      return;
    }
    if (e.target.closest('[data-note]')) { it._noteOpen = true; refreshItem(it); const t = $(`#nt-${CSS.escape(it.id)}`); if (t) t.focus(); return; }
    const rm = e.target.closest('[data-rmph]');
    if (rm && await confirmBox('Remove photo?', 'This photo will be deleted.', 'Remove', true)) { await Data.deletePhoto(rm.dataset.rmph); photos = photos.filter(x => x.id !== rm.dataset.rmph); refreshItem(it); }
  };
  items.oninput = e => {
    const f = e.target.closest('[data-f]'), card = e.target.closest('.ii'); if (!f || !card) return;
    const it = insp.items.find(x => x.id === card.dataset.id); if (!it) return;
    it[f.dataset.f] = f.value; if (f.dataset.f === 'note') renderProg(); later();
  };
  items.onchange = async e => {
    const inp = e.target.closest('[data-addph]'); if (!inp || !inp.files.length) return;
    const it = insp.items.find(x => x.id === e.target.closest('.ii').dataset.id);
    toast('Saving photo…');
    for (const f of inp.files) await addInspPhoto(aid, insp.id, it.id, await resizeImage(f));
    photos = await inspPhotos(aid, insp.id); refreshItem(it); toast('Photo added');
  };
  $('#iDate').onchange = e => { insp.date = e.target.value || today(); later(); };
  $('#iBy').oninput = e => { insp.inspector = e.target.value; later(); };
  $('#iNotes').oninput = e => { insp.notes = e.target.value; later(); };
  $('#iAddItem').onclick = () => {
    modal({title: 'Add item to this inspection', body: `<div class="field"><label for="aiText">Task</label><input id="aiText" placeholder="e.g. Check VFD fault history"></div>
      <label class="chk"><input type="checkbox" id="aiReq" checked> Required</label>
      <div class="field" style="margin-top:8px"><label for="aiUnit">Reading unit <span class="muted">(optional – leave blank for no reading)</span></label><input id="aiUnit" placeholder="e.g. A, °F, psi"></div>
      <p class="muted small">Only added to this inspection. To add it every time, use <b>Checklist &amp; schedule</b> on the asset.</p>`,
      onOpen: d => $('#aiText', d).focus(),
      actions: [{label: 'Cancel'}, {label: 'Add', cls: 'primary', onClick: async d => {
        const text = $('#aiText', d).value.trim(); if (!text) { toast('Enter the task'); return false; }
        const it = normItem({text, required: $('#aiReq', d).checked, unit: $('#aiUnit', d).value, extra: 'adhoc'}, true); it.extra = 'adhoc';
        insp.items.push(it); items.insertAdjacentHTML('beforeend', itemHtml(it, insp.items.length - 1)); renderProg(); await persist();
        $(`#ii-${CSS.escape(it.id)}`).scrollIntoView({block: 'center'});
      }}]});
  };
  $('#iMenu').onclick = () => {
    const m = modal({title: 'Inspection', body: `<div class="menu">
      <button class="btn" data-m="all">✓ Mark all unchecked items Done</button>
      <button class="btn" data-m="report">🖨️ Preview report</button>
      <button class="btn danger" data-m="del">🗑️ Delete this draft</button></div>`});
    m.el.addEventListener('click', async e => {
      const b = e.target.closest('[data-m]'); if (!b) return; m.close();
      if (b.dataset.m === 'all') {
        const n = insp.items.filter(x => !x.result).length; if (!n) return toast('Every item already has a result');
        if (!await confirmBox('Mark all Done?', `Sets the ${n} item${n === 1 ? '' : 's'} with no result to <b>Done</b>. Only do this if you actually checked them.`, 'Mark Done')) return;
        insp.items.forEach(x => { if (!x.result) x.result = 'done'; }); await persist(); route();
      }
      if (b.dataset.m === 'report') { await persist(); go(`${back}/i/${encodeURIComponent(insp.id)}?report=1`); }
      if (b.dataset.m === 'del' && await confirmBox('Delete draft inspection?', 'All results, notes and photos in this draft will be deleted.', 'Delete', true)) {
        clearTimeout(timer); timer = null; await deleteInspection(aid, insp.id); toast('Draft deleted'); go(back);
      }
    });
  };
  $('#iSave').onclick = async () => { await persist(); toast('Draft saved'); };
  $('#iDone').onclick = async () => {
    await persist();
    const c = inspCounts(insp);
    if (c.reqLeft.length || c.failNoNote.length) {
      const li = it => `<li><button type="button" class="linkbtn" data-goto="${esc(it.id)}">${insp.items.indexOf(it) + 1}. ${esc(it.text)}</button></li>`;
      const m = modal({title: "Can't complete yet", body: `<p class="small" style="margin-top:0">Every required item must be <b>Done</b>, <b>N/A</b>, or <b>Fail</b> with a note.</p>
        ${c.reqLeft.length ? `<div class="lbl">Still to check (${c.reqLeft.length})</div><ul class="left-list">${c.reqLeft.map(li).join('')}</ul>` : ''}
        ${c.failNoNote.length ? `<div class="lbl">Failed – add a deficiency note (${c.failNoNote.length})</div><ul class="left-list">${c.failNoNote.map(li).join('')}</ul>` : ''}`,
        actions: [{label: 'OK', cls: 'primary'}]});
      m.el.id = 'blockDlg';
      m.el.addEventListener('click', e => { const b = e.target.closest('[data-goto]'); if (!b) return; m.close();
        const el = $(`#ii-${CSS.escape(b.dataset.goto)}`); if (el) { el.scrollIntoView({block: 'center'}); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); } });
      return;
    }
    signOffDialog(p, a, insp, async () => { clearTimeout(timer); timer = null; });
  };
}
function signOffDialog(p, a, insp, beforeSave) {
  const c = inspCounts(insp), skipped = insp.items.filter(x => !x.result).length, result = c.fail ? 'Passed with deficiencies' : 'Passed';
  let drawn = false;
  const m = modal({title: 'Sign off & complete', body: `
    <div class="so-sum"><span class="pill ${inspResultCls(result)}">${esc(result)}</span>
      <span class="small">${c.done} done · ${c.na} N/A · ${c.fail} failed${skipped ? ` · ${skipped} optional not checked` : ''}</span></div>
    <div class="field" style="margin-top:12px"><label for="soName">Inspector name <span class="req">*</span></label><input id="soName" value="${esc(insp.inspector)}" autocomplete="name"></div>
    <div class="field"><label>Signature <span class="muted">(optional – draw with your finger)</span></label>
      <canvas id="soSig" class="sig-pad" width="600" height="200" aria-label="Signature pad"></canvas>
      <button type="button" class="linkbtn" id="soClear">Clear signature</button></div>
    <p class="muted small">Completing locks the results. You can reopen it later if something needs correcting.</p>`,
    actions: [{label: 'Cancel'}, {label: '✓ Sign &amp; complete', cls: 'primary', onClick: async d => {
      const name = $('#soName', d).value.trim(); if (!name) { toast('Enter the inspector name'); $('#soName', d).focus(); return false; }
      await beforeSave();
      const fresh = await Data.asset(a.id); const cur = fresh && (fresh.inspections || []).find(x => x.id === insp.id) || insp;
      Object.assign(cur, {inspector: name, signedName: name, signature: drawn ? $('#soSig', d).toDataURL('image/png') : '', status: 'complete', completedAt: nowISO()});
      localStorage.setItem(LSK('at-inspector'), name);
      await saveInspection(a.id, cur);
      toast(`${a.tag}: inspection complete – ${result}`, 3000);
      const dest = `${inspBase(p.id, a.id)}/i/${encodeURIComponent(insp.id)}`;
      if (location.hash === '#' + dest) route(); else go(dest, true);
    }}]});
  m.el.id = 'signDlg';
  const cv = $('#soSig', m.el), g = cv.getContext('2d'); g.lineWidth = 3.2; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#13202d';
  let down = false;
  const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  cv.onpointerdown = e => { down = true; cv.setPointerCapture(e.pointerId); g.beginPath(); g.moveTo(...pt(e)); e.preventDefault(); };
  cv.onpointermove = e => { if (!down) return; g.lineTo(...pt(e)); g.stroke(); drawn = true; e.preventDefault(); };
  cv.onpointerup = cv.onpointercancel = () => { down = false; };
  $('#soClear', m.el).onclick = () => { g.clearRect(0, 0, cv.width, cv.height); drawn = false; };
}

function inspText(p, a, insp) {
  const c = inspCounts(insp), r = inspResult(insp), loc = plainLoc(a);
  const subject = `Inspection ${insp.status === 'complete' ? 'report' : '(in progress)'}: ${a.tag}${a.type ? ' (' + a.type + ')' : ''} – ${fmtDate(insp.date)} – ${r}`;
  const L = [`${p.name}`, `${a.tag}${a.type ? ' (' + a.type + ')' : ''}${loc ? ' - ' + loc : ''}`];
  const mm = [a.manufacturer, a.model && 'Model ' + a.model, a.serial && 'S/N ' + a.serial].filter(Boolean).join(', '); if (mm) L.push(mm);
  L.push('', `Date: ${fmtDate(insp.date)}`, `Inspector: ${insp.inspector || '-'}`, `Result: ${r}`, `Items: ${c.done} done, ${c.na} N/A, ${c.fail} failed${c.total - c.answered ? `, ${c.total - c.answered} not checked` : ''}`);
  const fails = insp.items.filter(x => x.result === 'fail');
  if (fails.length) { L.push('', `DEFICIENCIES (${fails.length}):`); fails.forEach(x => L.push(`- ${x.text}${x.value ? ` [${x.value}${x.unit ? ' ' + x.unit : ''}]` : ''}: ${x.note || '(no note)'}${x.resolvedAt ? ` (resolved ${fmtDate(x.resolvedAt)})` : ''}`)); }
  const reads = insp.items.filter(x => x.reading && x.value);
  if (reads.length) { L.push('', 'READINGS:'); reads.forEach(x => L.push(`- ${x.text}: ${x.value}${x.unit ? ' ' + x.unit : ''}`)); }
  L.push('', 'CHECKLIST:'); insp.items.forEach((x, i) => L.push(`${i + 1}. [${RES_LABEL[x.result || '']}] ${x.text}${x.value ? ` - ${x.value}${x.unit ? ' ' + x.unit : ''}` : ''}${x.note && x.result !== 'fail' ? ` - ${x.note}` : ''}`));
  if (insp.notes) L.push('', 'NOTES:', insp.notes);
  if (insp.status === 'complete') L.push('', `Signed off by ${insp.signedName || insp.inspector || '-'}${insp.completedAt ? ' on ' + new Date(insp.completedAt).toLocaleString() : ''}.`);
  const text = L.join('\n');
  let body = L.join('\r\n'); const mk = b => buildMailto([], subject, b);
  if (mk(body).length > MAILTO_MAX) { while (L.length > 8 && mk(L.join('\r\n') + '\r\n...').length > MAILTO_MAX) L.pop(); body = L.join('\r\n') + '\r\n...(shortened – print the full report to PDF and attach it)'; }
  return {subject, text, mailto: mk(body)};
}
function shareInspDialog(p, a, insp) {
  const t = inspText(p, a, insp);
  const m = modal({title: 'Share inspection summary', body: `<pre class="share-pre">${esc(t.text)}</pre>
    <p class="muted small">“Email” opens your mail app with this summary – add recipients there. For a formatted copy, use <b>Report</b> → Print → Save as PDF.</p>`,
    actions: [...(navigator.share ? [{label: 'Share…', onClick: async () => { try { await navigator.share({title: t.subject, text: t.text}); } catch (e) { if (e.name !== 'AbortError') toast('Share failed'); } }}] : []),
      {label: 'Copy', onClick: async () => { toast(await copyText(t.subject + '\n\n' + t.text) ? 'Summary copied' : 'Copy failed'); }},
      {label: '✉️ Email', cls: 'primary', onClick: () => { location.href = t.mailto; }}]});
  m.el.id = 'shareDlg';
}
async function renderInspView(p, a, insp) {
  const pid = p.id, aid = a.id, back = inspBase(pid, aid), c = inspCounts(insp), r = inspResult(insp);
  setChrome(`${a.tag} inspection`, back, `<button class="icon-btn" id="iMenu" aria-label="Inspection menu">${ICON.more}</button>`);
  const photos = await inspPhotos(aid, insp.id);
  const phs = it => { const l = photos.filter(x => x.itemId === it.id); return l.length ? `<div class="photos ii-ph">${l.map(x => `<button class="ph" data-ph="${esc(x.id)}"><img alt="Deficiency photo" src="${objURL(x.blob)}"></button>`).join('')}</div>` : ''; };
  const fails = insp.items.filter(x => x.result === 'fail');
  view.innerHTML = `
    <div class="hero insp-hero"><div class="tag">${esc(a.tag)}</div>
      <div class="meta"><span class="badge">${esc(a.type || '—')}</span>${inspResultPill(insp)}</div>
      <dl class="kv" style="margin-top:10px"><dt>Date</dt><dd>${esc(fmtDate(insp.date))}</dd><dt>Inspector</dt><dd>${esc(insp.inspector || '—')}</dd>
        <dt>Completed</dt><dd>${esc(insp.completedAt ? new Date(insp.completedAt).toLocaleString() : '—')}</dd><dt>Project</dt><dd>${esc(p.name)}</dd></dl></div>
    <div class="due-summary"><div><span class="n">${c.done}</span> done</div><div><span class="n">${c.na}</span> N/A</div><div class="${c.fail ? 'over-txt' : ''}"><span class="n">${c.fail}</span> failed</div>${c.total - c.answered ? `<div><span class="n">${c.total - c.answered}</span> not checked</div>` : ''}</div>
    ${fails.length ? `<div class="card def-card"><div class="lbl over-txt">Deficiencies (${fails.length}${c.open !== fails.length ? `, ${c.open} open` : ''})</div>
      ${fails.map(it => `<div class="def-row ${it.resolvedAt ? 'resolved' : ''}"><div class="main"><b>${esc(it.text)}</b>${it.value ? ` <span class="badge">${esc(it.value)}${it.unit ? ' ' + esc(it.unit) : ''}</span>` : ''}
        <div class="def-note">${esc(it.note)}</div>${phs(it)}
        <div class="small ${it.resolvedAt ? '' : 'over-txt'}">${it.resolvedAt ? `✓ Resolved ${esc(fmtDate(it.resolvedAt))}` : 'Open'}</div></div>
        <button class="btn sm" data-res="${esc(it.id)}">${it.resolvedAt ? 'Reopen' : '✓ Resolved'}</button></div>`).join('')}</div>` : ''}
    <div class="card"><div class="lbl">Checklist (${c.total})</div><ul class="ck-list">${insp.items.map((it, i) => `<li class="r-${it.result || 'none'}"><span class="ck-ico">${RES_ICON[it.result || '']}</span>
      <div class="main"><div>${i + 1}. ${esc(it.text)}${it.required ? '' : ' <span class="muted small">(optional)</span>'}</div>
      ${it.value ? `<div class="small"><b>${esc(it.value)}${it.unit ? ' ' + esc(it.unit) : ''}</b></div>` : ''}${it.note && it.result !== 'fail' ? `<div class="small muted">${esc(it.note)}</div>` : ''}${it.result !== 'fail' ? phs(it) : ''}</div></li>`).join('')}</ul></div>
    ${insp.notes ? `<div class="card"><div class="lbl">Notes</div><div style="white-space:pre-wrap">${esc(insp.notes)}</div></div>` : ''}
    <div class="card"><div class="lbl">Sign-off</div><p style="margin:4px 0">${esc(insp.signedName || insp.inspector || '—')}</p>${insp.signature ? `<img class="sig-img" src="${esc(insp.signature)}" alt="Signature">` : '<p class="muted small" style="margin:0">No signature drawn.</p>'}</div>`;
  setBottomBar(`<a class="btn" id="iReport" href="${inspHref(pid, aid, insp.id, '?report=1')}">${ICON.print} Report</a><button class="btn primary" id="iShare">✉️ Share / email</button>`);
  $('#iShare').onclick = () => shareInspDialog(p, a, insp);
  view.onclick = async e => {
    const ph = e.target.closest('[data-ph]');
    if (ph) { const x = photos.find(y => y.id === ph.dataset.ph); if (x) modal({title: 'Deficiency photo', wide: true, body: `<img class="photo-full" src="${objURL(x.blob)}" alt="Photo">`, actions: [{label: 'Download', onClick: () => downloadBlob(x.blob, `${slug(a.tag)}_deficiency_${x.id.slice(0, 6)}.jpg`)}]}); return; }
    const b = e.target.closest('[data-res]'); if (!b) return;
    const it = insp.items.find(x => x.id === b.dataset.res); if (!it) return;
    it.resolvedAt = it.resolvedAt ? '' : today(); await saveInspection(aid, insp);
    toast(it.resolvedAt ? 'Deficiency marked resolved' : 'Deficiency reopened'); route();
  };
  $('#iMenu').onclick = () => {
    const m = modal({title: 'Inspection', body: `<div class="menu">
      <button class="btn" data-m="report">🖨️ Printable report / PDF</button>
      <button class="btn" data-m="share">✉️ Share / email summary</button>
      <button class="btn" data-m="reopen">✏️ Reopen to edit</button>
      <button class="btn danger" data-m="del">🗑️ Delete inspection</button></div>`});
    m.el.addEventListener('click', async e => {
      const b = e.target.closest('[data-m]'); if (!b) return; m.close();
      const k = b.dataset.m;
      if (k === 'report') go(`${back}/i/${encodeURIComponent(insp.id)}?report=1`);
      if (k === 'share') shareInspDialog(p, a, insp);
      if (k === 'reopen' && await confirmBox('Reopen inspection?', 'It goes back to draft so results can be changed. Sign off again to complete it.', 'Reopen')) {
        insp.status = 'draft'; insp.completedAt = ''; await saveInspection(aid, insp); route();
      }
      if (k === 'del' && await confirmBox('Delete inspection?', `Permanently delete the ${esc(fmtDate(insp.date))} inspection of ${esc(a.tag)} and its photos?`, 'Delete', true)) {
        await deleteInspection(aid, insp.id); toast('Inspection deleted'); go(back);
      }
    });
  };
}
async function renderInspReport(p, a, insp) {
  const pid = p.id, aid = a.id, c = inspCounts(insp), r = inspResult(insp);
  setChrome(`Report – ${a.tag}`, `${inspBase(pid, aid)}/i/${encodeURIComponent(insp.id)}`);
  const photos = await inspPhotos(aid, insp.id);
  const kv = (k, v) => v ? `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>` : '';
  const fails = insp.items.filter(x => x.result === 'fail');
  view.innerHTML = `
    <div class="row no-print"><button class="btn primary" id="rPrint">${ICON.print} Print / Save as PDF</button><button class="btn" id="rShare">✉️ Share / email text</button></div>
    ${insp.status !== 'complete' ? '<div class="notice warn">Draft – this inspection has not been signed off yet.</div>' : ''}
    <article class="report" id="report">
      <header class="rp-head"><div><div class="rp-title">Equipment Inspection Report</div><div class="rp-sub">${esc(p.name)}${p.client ? ' · ' + esc(p.client) : ''}</div>${p.address ? `<div class="rp-sub">${esc(p.address)}</div>` : ''}</div>
        <div class="rp-qr">${qrSvg(a.tag)}</div></header>
      <div class="rp-grid">
        <table class="rp-kv"><tbody>${kv('Asset tag', a.tag)}${kv('Type', a.type)}${kv('Manufacturer', a.manufacturer)}${kv('Model', a.model)}${kv('Serial', a.serial)}${kv('Capacity', a.capacity)}${kv('Location', plainLoc(a))}</tbody></table>
        <table class="rp-kv"><tbody>${kv('Inspection date', fmtDate(insp.date))}${kv('Inspector', insp.inspector || '—')}${kv('Status', insp.status === 'complete' ? 'Complete' : 'Draft')}
          <tr><th>Result</th><td><b class="${c.fail ? 'over-txt' : 'ok-txt'}">${esc(r)}</b></td></tr>${kv('Items', `${c.done} done · ${c.na} N/A · ${c.fail} failed${c.total - c.answered ? ` · ${c.total - c.answered} not checked` : ''}`)}${kv('Next due', inspNextDue(a) ? fmtDate(inspNextDue(a)) : '')}</tbody></table>
      </div>
      ${fails.length ? `<h3 class="rp-h over-txt">Deficiencies (${fails.length})</h3><table class="rp-tbl"><thead><tr><th>Item</th><th>Note</th><th>Status</th></tr></thead><tbody>
        ${fails.map(x => `<tr><td>${esc(x.text)}${x.value ? `<br><b>${esc(x.value)} ${esc(x.unit)}</b>` : ''}</td><td>${esc(x.note)}</td><td>${x.resolvedAt ? 'Resolved ' + esc(fmtDate(x.resolvedAt)) : '<b>Open</b>'}</td></tr>`).join('')}</tbody></table>` : ''}
      <h3 class="rp-h">Checklist</h3>
      <table class="rp-tbl"><thead><tr><th>#</th><th>Task</th><th>Result</th><th>Reading</th><th>Note</th></tr></thead><tbody>
        ${insp.items.map((x, i) => `<tr class="rr-${x.result || 'none'}"><td>${i + 1}</td><td>${esc(x.text)}${x.required ? '' : ' <span class="muted">(opt.)</span>'}</td><td class="rp-res">${esc(RES_LABEL[x.result || ''])}</td><td>${x.value ? esc(x.value) + (x.unit ? ' ' + esc(x.unit) : '') : ''}</td><td>${esc(x.note)}</td></tr>`).join('')}</tbody></table>
      ${insp.notes ? `<h3 class="rp-h">Notes</h3><p style="white-space:pre-wrap;margin:4px 0">${esc(insp.notes)}</p>` : ''}
      ${photos.length ? `<h3 class="rp-h">Photos</h3><div class="rp-photos">${photos.map(x => { const it = insp.items.find(y => y.id === x.itemId); return `<figure><img src="${objURL(x.blob)}" alt=""><figcaption>${esc(it ? it.text : '')}</figcaption></figure>`; }).join('')}</div>` : ''}
      <div class="rp-sign"><div><div class="rp-sl">Inspector</div><div class="rp-sv">${esc(insp.signedName || insp.inspector || '')}</div></div>
        <div><div class="rp-sl">Signature</div>${insp.signature ? `<img src="${esc(insp.signature)}" alt="Signature">` : '<div class="rp-line"></div>'}</div>
        <div><div class="rp-sl">Date</div><div class="rp-sv">${esc(insp.completedAt ? new Date(insp.completedAt).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}) : '')}</div></div></div>
      <footer class="rp-foot">Generated by Asset Tagger · ${esc(new Date().toLocaleString())}</footer>
    </article>`;
  $('#rPrint').onclick = () => window.print();
  $('#rShare').onclick = () => shareInspDialog(p, a, insp);
}

/* ---- Project "Inspections" screen ---- */
function inspBuckets(assets, t = today()) {
  const mk = t.slice(0, 7), b = {overdue: [], this: [], next: [], never: [], draft: [], doneMonth: [], defs: []};
  assets.forEach(a => {
    const st = inspDueStatus(a, t);
    if (st.key === 'overdue') b.overdue.push(a); else if (st.key === 'this') b.this.push(a); else if (st.key === 'next') b.next.push(a); else if (st.key === 'never') b.never.push(a);
    inspList(a).forEach(i => {
      if (i.status !== 'complete') b.draft.push({a, i});
      else {
        if (String(i.date).slice(0, 7) === mk) b.doneMonth.push({a, i});
        (i.items || []).forEach(it => { if (it.result === 'fail' && !it.resolvedAt) b.defs.push({a, i, it}); });
      }
    });
  });
  const byTag = (x, y) => natCmp((x.a || x).tag, (y.a || y).tag);
  b.overdue.sort((x, y) => natCmp(inspNextDue(x), inspNextDue(y)) || byTag(x, y)); b.this.sort((x, y) => natCmp(inspNextDue(x), inspNextDue(y)) || byTag(x, y)); b.next.sort(byTag); b.never.sort(byTag);
  b.draft.sort(byTag); b.doneMonth.sort((x, y) => natCmp(y.i.date, x.i.date)); b.defs.sort((x, y) => natCmp(y.i.date, x.i.date) || byTag(x, y));
  return b;
}
function inspNoticeHtml(pid, assets) {
  const b = inspBuckets(assets), bits = [];
  if (b.overdue.length) bits.push(`<b class="over-txt">${b.overdue.length} overdue</b>`);
  if (b.this.length) bits.push(`${b.this.length} due this month`);
  if (b.draft.length) bits.push(`${b.draft.length} in progress`);
  if (b.defs.length) bits.push(`<b class="over-txt">${defic(b.defs.length)} open</b>`);
  if (!bits.length) return '';
  return `<a class="notice insp-notice" href="#/p/${encodeURIComponent(pid)}/inspections"><span class="db-ico">✅</span><span class="db-main"><b>Inspections:</b> ${bits.join(' · ')} <span class="db-cta">›</span></span></a>`;
}
async function renderInspections(pid) {
  const p = await Data.project(pid); if (!p) return go('/', true);
  const assets = await Data.assets(pid), b = inspBuckets(assets), t = today();
  setChrome(`Inspections – ${p.name}`, `/p/${encodeURIComponent(pid)}`);
  const ah = a => assetHref(pid, a);
  const dueRow = (a, showStart = true) => { const st = inspDueStatus(a, t), nd = inspNextDue(a), l = lastComplete(a);
    return `<div class="item insp-row"><a class="main" href="${ah(a)}"><div class="t">${esc(a.tag)} <span class="badge">${esc(a.type || '—')}</span></div>
      <div class="sub">${esc(locLine(a) || a.areaServed || '')}</div>
      <div class="sub">${nd ? `${st.key === 'overdue' ? '<b class="over-txt">Was due' : 'Due'} ${esc(fmtDate(nd))}${st.key === 'overdue' ? '</b>' : ''}` : 'Never inspected'}${l ? ` · last ${esc(fmtDate(l.date))}` : ''} · ${esc(inspFreqLabel(inspFreqOf(a)).toLowerCase())}</div></a>
      ${showStart ? `<button class="btn sm" data-start="${esc(a.id)}">${openDraft(a) ? '▶ Continue' : '✓ Start'}</button>` : ''}</div>`; };
  const inspRow = ({a, i}) => { const c = inspCounts(i);
    return `<a class="item insp-row" href="${inspHref(pid, a.id, i.id)}"><div class="main"><div class="t">${esc(a.tag)} <span class="badge">${esc(a.type || '—')}</span></div>
      <div class="sub">${esc(fmtDate(i.date))} · ${esc(i.inspector || 'No inspector')}</div>
      <div class="sub">${i.status === 'complete' ? `${c.done} done · ${c.na} N/A · ${c.fail} failed` : `${c.answered}/${c.total} answered · ${c.reqDone}/${c.reqTotal} required`}</div></div>
      <div class="right">${inspResultPill(i)}${c.open ? `<span class="pill pt-pill pt-over">${c.open} open</span>` : ''}</div></a>`; };
  const defRow = ({a, i, it}) => `<a class="card def-item" href="${inspHref(pid, a.id, i.id)}"><div class="di-head"><b>${esc(a.tag)}</b><span class="badge">${esc(a.type || '—')}</span><span class="muted small">${esc(fmtDate(i.date))}</span><span class="chev">›</span></div>
    <div class="di-text">✗ ${esc(it.text)}${it.value ? ` <span class="badge">${esc(it.value)} ${esc(it.unit)}</span>` : ''}</div><div class="small">${esc(it.note)}</div></a>`;
  const sec = (title, arr, fn, cls = '', empty = '') => arr.length ? `<h2 class="${cls}">${title} (${arr.length})</h2><div class="list">${arr.map(fn).join('')}</div>` : (empty ? `<h2>${title} (0)</h2><p class="muted small">${empty}</p>` : '');
  const scheduled = assets.filter(a => inspFreqOf(a)).length;
  view.innerHTML = `
    <div class="insp-stats">
      <div class="${b.overdue.length ? 'bad' : ''}"><span class="n">${b.overdue.length}</span>Overdue</div>
      <div><span class="n">${b.this.length}</span>Due this month</div>
      <div><span class="n">${b.draft.length}</span>In progress</div>
      <div class="${b.defs.length ? 'bad' : ''}"><span class="n">${b.defs.length}</span>Open deficiencies</div>
      <div class="good"><span class="n">${b.doneMonth.length}</span>Done ${esc(monthShort(t.slice(0, 7)))}</div>
    </div>
    ${!assets.length ? '<div class="empty"><p>No assets in this project yet.</p></div>' : ''}
    ${sec('Open deficiencies', b.defs, defRow, 'over-txt')}
    ${sec('In progress', b.draft, inspRow)}
    ${sec('Overdue', b.overdue, a => dueRow(a), 'over-txt')}
    ${sec('Due this month', b.this, a => dueRow(a))}
    ${sec('Due next month', b.next, a => dueRow(a))}
    ${sec(`Completed in ${esc(monthShort(t.slice(0, 7)))}`, b.doneMonth, inspRow, '', 'No inspections completed this month yet.')}
    ${b.never.length ? `<details class="filters card"><summary>Never inspected (${b.never.length})</summary><div class="list">${b.never.map(a => dueRow(a)).join('')}</div></details>` : ''}
    <p class="muted small">${scheduled} of ${assets.length} assets on an inspection schedule. Set the interval per unit on the asset (Checklist &amp; schedule) and default intervals per type in <a href="#/settings/checklists">Settings → Inspection checklists</a>.</p>`;
  view.onclick = e => { const s = e.target.closest('[data-start]'); if (s) startInspection(pid, s.dataset.start); };
}
/* ---- Settings: checklist templates ---- */
async function renderChecklists() {
  setChrome('Inspection checklists', '/settings');
  const st = loadTplStore();
  view.innerHTML = `<p class="small muted">Default task list used when you tap <b>Start inspection</b> on an asset of each type. Changes apply to new inspections (completed ones keep their own copy).</p>
    <div class="list">${INSP_TYPES.map(t => { const tp = getTemplate(t), req = tp.items.filter(x => x.required).length;
      return `<a class="item" href="#/settings/checklists/${encodeURIComponent(t)}"><div class="main"><div class="t">${esc(t)}</div>
        <div class="sub">${tp.items.length} items · ${req} required · ${esc(inspFreqLabel(tp.freq))}</div></div>
        <div class="right">${st[t] ? '<span class="badge">Customized</span>' : '<span class="badge opt-b">Default</span>'}</div><span class="chev">›</span></a>`; }).join('')}</div>`;
}
async function renderChecklistEdit(type) {
  if (!INSP_DEFAULTS[type]) return go('/settings/checklists', true);
  setChrome(`${type} checklist`, '/settings/checklists');
  const tp = getTemplate(type), items = tp.items.map(x => ({...x}));
  let dirty = false;
  view.innerHTML = `
    <div class="card"><div class="field" style="margin:0"><label for="tFreq">Default inspection interval for ${esc(type)}</label><select id="tFreq">${freqOptions(String(tp.freq), false)}</select></div></div>
    <div class="card"><div class="lbl">Checklist items</div>
      <p class="muted small" style="margin:0 0 10px"><b>Required</b> items must be Done, N/A or failed with a note before an inspection can be completed. Tick <b>Reading</b> to ask for a value (amps, temps, pressure).</p>
      <div id="tItems"></div><button type="button" class="btn sm" id="tAdd">+ Add item</button></div>
    <div class="row"><button class="btn danger sm" id="tReset">Reset to default</button></div>`;
  const ed = itemsEditor($('#tItems'), items, () => { dirty = true; });
  $('#tFreq').onchange = () => { dirty = true; };
  $('#tAdd').onclick = () => ed.add();
  setBottomBar(`<button class="btn" id="tCancel">Cancel</button><button class="btn primary" id="tSave">Save checklist</button>`);
  $('#tCancel').onclick = async () => { if (!dirty || await confirmBox('Discard changes?', 'Your edits to this checklist will be lost.', 'Discard', true)) go('/settings/checklists'); };
  $('#tSave').onclick = () => {
    const clean = items.map(x => normItem(x)).filter(x => x.text);
    if (!clean.length) { toast('Add at least one item'); return; }
    const s = loadTplStore(); s[type] = {freq: +$('#tFreq').value, items: clean, updatedAt: nowISO()}; saveTplStore(s);
    toast(`${type} checklist saved`); go('/settings/checklists');
  };
  $('#tReset').onclick = async () => {
    if (!await confirmBox('Reset to default?', `Replaces the ${esc(type)} checklist with the built-in default list.`, 'Reset', true)) return;
    const s = loadTplStore(); delete s[type]; saveTplStore(s); toast('Reset to default'); route();
  };
}
/* ---- Export rows ---- */
const INSP_HEADERS = ['Project', 'Asset Tag', 'Equipment Type', 'Building', 'Floor', 'Room / Location', 'Inspection Date', 'Inspector', 'Status', 'Result', 'Items', 'Done', 'N/A', 'Failed', 'Not Checked', 'Open Deficiencies', 'Readings', 'Notes', 'Signed By', 'Signature', 'Completed At', 'Inspection ID'];
const INSP_ITEM_HEADERS = ['Project', 'Asset Tag', 'Equipment Type', 'Inspection Date', 'Inspector', 'Inspection Status', '#', 'Item', 'Required', 'Result', 'Reading', 'Unit', 'Note', 'Photos', 'Deficiency Status', 'Inspection ID'];
function inspRows(project, assets, phCount = {}) {
  const ins = [], items = [];
  assets.slice().sort((a, b) => natCmp(a.tag, b.tag)).forEach(a => inspList(a).slice().reverse().forEach(i => {
    const c = inspCounts(i), base = {'Project': project.name, 'Asset Tag': a.tag || '', 'Equipment Type': a.type || ''};
    ins.push({...base, 'Building': a.building || '', 'Floor': a.floor || '', 'Room / Location': a.room || '', 'Inspection Date': i.date || '', 'Inspector': i.inspector || '',
      'Status': i.status === 'complete' ? 'Complete' : 'Draft', 'Result': inspResult(i), 'Items': c.total, 'Done': c.done, 'N/A': c.na, 'Failed': c.fail, 'Not Checked': c.total - c.answered,
      'Open Deficiencies': c.open, 'Readings': (i.items || []).filter(x => x.value).map(x => `${x.text}: ${x.value}${x.unit ? ' ' + x.unit : ''}`).join('; '), 'Notes': i.notes || '',
      'Signed By': i.status === 'complete' ? (i.signedName || i.inspector || '') : '', 'Signature': i.signature ? 'Yes' : 'No', 'Completed At': i.completedAt ? new Date(i.completedAt).toLocaleString() : '', 'Inspection ID': i.id});
    (i.items || []).forEach((x, n) => items.push({...base, 'Inspection Date': i.date || '', 'Inspector': i.inspector || '', 'Inspection Status': i.status === 'complete' ? 'Complete' : 'Draft', '#': n + 1,
      'Item': x.text, 'Required': x.required ? 'Yes' : 'No', 'Result': RES_LABEL[x.result || ''], 'Reading': x.value || '', 'Unit': x.unit || '', 'Note': x.note || '', 'Photos': phCount[i.id + '|' + x.id] || 0,
      'Deficiency Status': x.result === 'fail' ? (x.resolvedAt ? `Resolved ${x.resolvedAt}` : 'Open') : '', 'Inspection ID': i.id}));
  }));
  return {ins, items};
}

/* Demo inspections – built relative to today so due / overdue / "this month" always look right. */
function demoInspections(assets, t) {
  const day = +t.slice(8, 10), mk = t.slice(0, 7);
  const inMonth = back => `${mk}-${String(Math.max(1, day - back)).padStart(2, '0')}`;
  const val = it => { const s = it.text.toLowerCase();
    if (it.unit === '°F') return /condenser water/.test(s) ? '85.1' : /chilled water/.test(s) ? '44.2' : /supply water/.test(s) ? '162' : /space/.test(s) ? '72.4' : /leaving water/.test(s) ? '84.6' : /secondary/.test(s) ? '140' : /primary/.test(s) ? '180 / 150' : '55.6';
    return {A: '18.4', psig: /condenser/.test(s) ? '128' : '62', psi: /system/.test(s) ? '14' : '8.5', CFM: '640', 'in. w.c.': '3.5'}[it.unit] || '1'; };
  const stamp = d => new Date(d + 'T15:30:00').toISOString();
  const mkI = (tag, pid, date, o = {}) => {
    const a = assets.find(x => x.tag === tag && x.projectId === pid); if (!a) return;
    const tpl = getTemplate(a.type), items = tpl.items.map((x, n) => {
      const it = normItem({...x, id: `demo-i-${slug(tag).toLowerCase()}-${date}-${n}`}, true);
      const ans = o.answered == null || n < o.answered;
      if (ans) { it.result = (o.fail && o.fail[n]) ? 'fail' : (o.na || []).includes(n) ? 'na' : 'done';
        if (it.reading && it.result === 'done') it.value = (o.vals && o.vals[n]) || val(it);
        if (o.fail && o.fail[n]) { it.note = o.fail[n]; if (it.reading) it.value = (o.vals && o.vals[n]) || val(it); } }
      return it; });
    const done = o.status !== 'draft';
    (a.inspections = a.inspections || []).push({id: `demo-insp-${slug(tag).toLowerCase()}-${date}`, date, inspector: o.by || 'J. Rivera (demo)', status: done ? 'complete' : 'draft', items, notes: o.notes || '',
      signature: '', signedName: done ? (o.by || 'J. Rivera (demo)') : '', startedAt: stamp(date), completedAt: done ? stamp(date) : '', template: tplType(a.type), updatedAt: stamp(date)});
  };
  const P1 = 'demo-mob', P2 = 'demo-school';
  mkI('AHU-1', P1, addMonths(t, -4), {notes: 'Quarterly PM. All good.'});
  mkI('AHU-1', P1, addMonths(t, -1), {notes: 'Quarterly PM. Pre-filters changed.'});
  mkI('AHU-3', P1, inMonth(3), {fail: {1: 'Both BX-55 belts glazed and cracked – replace (2 needed).', 4: 'Drain pan rusted, standing water; condensate trap partly clogged. Cleared trap, pan needs coating or replacement.'},
    notes: 'Existing 23-year-old unit. Recommend budgeting for replacement.'});
  mkI('CH-2', P1, addMonths(t, -2), {by: 'A. Sample (demo)', fail: {4: 'Condenser pressure high (see reading); compressor 2 tripped on high pressure during test. Service tech scheduled.'}, vals: {4: '182'}});
  mkI('CH-1', P1, addMonths(t, -3), {by: 'A. Sample (demo)'});
  mkI('B-1', P1, addMonths(t, -2), {notes: 'Combustion looks good.'});
  mkI('CT-1', P1, addMonths(t, -2));
  mkI('RTU-1', P1, addMonths(t, -4), {notes: 'Spring PM.'});
  mkI('EF-1', P1, inMonth(6), {na: [0]});
  mkI('CHWP-1', P1, addMonths(t, -5));
  mkI('AHU-2', P1, t, {status: 'draft', answered: 6, notes: ''});
  [1, 2, 3].forEach(i => mkI(`RTU-${i}`, P2, inMonth(i), {by: 'A. Sample (demo)'}));
}

/* ---------------- router ---------------- */
const view = $('#view');
const go = (h, replace) => { if (replace) location.replace('#' + h); else location.hash = h; };
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  return {parts: path.split('/').filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(qs || '')};
}
function setChrome(title, back, actions = '') {
  $('#title').textContent = title; document.title = title === 'Asset Tagger' ? title : `${title} – Asset Tagger`;
  const b = $('#backBtn'); b.hidden = !back; b.onclick = () => go(back);
  $('#topActions').innerHTML = actions;
}
let bottomBar = null;
function setBottomBar(html) {
  if (bottomBar) { bottomBar.remove(); bottomBar = null; }
  if (html) { bottomBar = document.createElement('div'); bottomBar.className = 'bottombar no-print'; bottomBar.innerHTML = html; document.body.appendChild(bottomBar); }
}
async function route() {
  revokeAll(); setBottomBar(''); window.scrollTo(0, 0); view.onclick = null;
  const {parts, q} = parseHash();
  try {
    if (!parts.length) return await renderHome();
    if (parts[0] === 'settings' && parts[1] === 'checklists') return parts[2] ? await renderChecklistEdit(parts[2]) : await renderChecklists();
    if (parts[0] === 'settings') return await renderSettings();
    if (parts[0] === 'parts') return await renderParts(null, q);
    if (parts[0] === 'find') return await handleScan(q.get('tag') || '', q.get('p'), true);
    if (parts[0] === 'p' && parts[1]) {
      const pid = parts[1];
      if (parts.length === 2) return await renderProject(pid);
      if (parts[2] === 'labels') return await renderLabels(pid, q);
      if (parts[2] === 'parts') return await renderParts(pid, q);
      if (parts[2] === 'tree') return await renderTree(pid, q);
      if (parts[2] === 'panels') return await renderPanels(pid, q);
      if (parts[2] === 'inspections') return await renderInspections(pid);
      if (parts[2] === 'a' && parts[3] && parts[4] === 'i' && parts[5]) return await renderInspection(pid, parts[3], parts[5], q);
      if (parts[2] === 'a' && parts[3] === 'new') return await renderAssetForm(pid, null, q);
      if (parts[2] === 'a' && parts[3] && parts[4] === 'edit') return await renderAssetForm(pid, parts[3], q);
      if (parts[2] === 'a' && parts[3]) return await renderAsset(pid, parts[3]);
    }
    go('/', true);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card"><b>Something went wrong.</b><p class="muted">${esc(e.message || e)}</p><a class="btn" href="#/">Go home</a></div>`;
  }
}
window.addEventListener('hashchange', route);

/* ---------------- Home: projects ---------------- */
async function renderHome() {
  setChrome('Asset Tagger', null,
    `<button class="icon-btn" id="hdrScan" aria-label="Scan tag">${ICON.scan}</button><button class="icon-btn" id="hdrSettings" aria-label="Settings">${ICON.gear}</button>`);
  const [projects, assets] = await Promise.all([Data.projects(), Data.allAssets()]);
  projects.sort((a, b) => natCmp(b.updatedAt, a.updatedAt));
  const stats = {};
  assets.forEach(a => { const s = stats[a.projectId] || (stats[a.projectId] = {n: 0, cx: 0, issue: 0}); s.n++; if (a.status === 'Commissioned') s.cx++; if (a.status === 'Issue') s.issue++; });
  view.innerHTML = `
    <div class="row"><button class="btn primary" id="newProj">${ICON.plus} New Project</button><button class="btn" id="scanAny">${ICON.scan} Scan tag</button></div>
    ${partsReminders(projects, assets).map(reminderHtml).join('')}
    ${assets.some(a => assetParts(a).length) ? `<a class="btn block" id="allParts" href="#/parts" style="margin:4px 0 6px">🔧 Filters &amp; belts due – all projects</a>` : ''}
    ${projects.length ? `<h2>Projects</h2><div class="list">${projects.map(p => {
      const s = stats[p.id] || {n: 0, cx: 0, issue: 0}; const pct = s.n ? Math.round(100 * s.cx / s.n) : 0;
      return `<a class="item" href="#/p/${encodeURIComponent(p.id)}"><div class="main">
        <div class="t">${esc(p.name)}</div>
        <div class="sub">${esc([p.client, p.address].filter(Boolean).join(' · ') || 'No details')}</div>
        <div class="sub">${s.n} asset${s.n === 1 ? '' : 's'} · ${s.cx} commissioned${s.issue ? ` · <b style="color:var(--s-issue)">${s.issue} issue${s.issue === 1 ? '' : 's'}</b>` : ''}</div>
        <div class="progress"><span style="width:${pct}%"></span></div></div><span class="chev">›</span></a>`;
    }).join('')}</div>` : `<div class="empty"><div class="big">🏗️</div><p><b>No projects yet.</b></p><p>Create a project (job site) and start tagging AHUs, chillers, pumps, VAVs and more. Everything is saved on this device and works offline.</p></div>`}
    <p class="muted small" style="text-align:center;margin-top:24px">Data is stored only on this device. Use <a href="#/settings">Settings → Backup</a> regularly.</p>`;
  $('#newProj').onclick = () => projectDialog();
  $('#scanAny').onclick = $('#hdrScan').onclick = () => openScanner(null);
  $('#hdrSettings').onclick = () => go('/settings');
}
function projectDialog(p) {
  const isNew = !p; p = p || {};
  modal({title: isNew ? 'New project' : 'Edit project', body: `
    <div class="field"><label>Project / job site name <span class="req">*</span></label><input id="pjName" value="${esc(p.name)}" placeholder="e.g. St. Mary's Hospital – East Wing" autocomplete="off"></div>
    <div class="field"><label>Client / owner</label><input id="pjClient" value="${esc(p.client)}"></div>
    <div class="field"><label>Address</label><input id="pjAddr" value="${esc(p.address)}"></div>
    <div class="field"><label for="pjEmails">Parts order email(s)</label><input id="pjEmails" type="text" inputmode="email" autocapitalize="off" autocomplete="off" spellcheck="false" value="${esc(p.partsEmails)}" placeholder="customer@example.com, contractor@example.com">
      <p class="muted small" style="margin:6px 0 0">Customer / contractor who orders filters &amp; belts. Separate several with commas. Used to pre-fill “Email this list”.</p></div>
    <div class="field"><label>Notes</label><textarea id="pjNotes">${esc(p.notes)}</textarea></div>`,
    onOpen: d => $('#pjName', d).focus(),
    actions: [{label: 'Cancel'}, {label: isNew ? 'Create' : 'Save', cls: 'primary', onClick: async d => {
      const name = $('#pjName', d).value.trim();
      if (!name) { toast('Project name is required'); $('#pjName', d).focus(); return false; }
      const em = parseEmails($('#pjEmails', d).value);
      if (em.invalid.length) { toast(`Check email address: ${em.invalid.join(', ')}`, 3500); $('#pjEmails', d).focus(); return false; }
      const rec = {...p, id: p.id || uid(), name, client: $('#pjClient', d).value.trim(), address: $('#pjAddr', d).value.trim(), partsEmails: em.valid.join(', '), notes: $('#pjNotes', d).value.trim(), createdAt: p.createdAt || nowISO()};
      await Data.saveProject(rec);
      toast(isNew ? 'Project created' : 'Project saved');
      if (isNew) go(`/p/${encodeURIComponent(rec.id)}`); else route();
    }}]});
}

/* ---------------- Project: asset list ---------------- */
const filterState = JSON.parse(sessionStorage.getItem(LSK('at-filters')) || '{}');
const getFilter = pid => { const f = filterState[pid] || (filterState[pid] = {q: '', type: '', status: '', building: '', floor: '', sort: 'tag'});
  if (f.panel === undefined) f.panel = ''; if (f.fed === undefined) f.fed = ''; return f; };
const saveFilters = () => sessionStorage.setItem(LSK('at-filters'), JSON.stringify(filterState));
function applyFilter(assets, f) {
  const q = f.q.trim().toLowerCase();
  let out = assets.filter(a =>
    (!f.type || a.type === f.type) && (!f.status || (a.status || 'Not started') === f.status) &&
    (!f.building || (a.building || '') === f.building) && (!f.floor || (a.floor || '') === f.floor) &&
    (!f.panel || (f.panel === NO_PANEL ? !a.powerPanel : normPanel(a.powerPanel) === f.panel)) &&
    (!f.fed || fedList(a).includes(f.fed)) &&
    (!q || ['tag','type','manufacturer','model','serial','capacity','building','floor','room','areaServed','notes','fedFrom','controlledBy','powerPanel','breaker','voltage','disconnect'].some(k => String(a[k] || '').toLowerCase().includes(q))
      || (a.powerPanel && `panel ${normPanel(a.powerPanel)}`.toLowerCase().includes(q))
      || (a.fedFrom && `fed from ${fedList(a).join(', ')}`.toLowerCase().includes(q))
      || assetParts(a).some(pt => pt.size.toLowerCase().includes(q))));
  const sorters = {
    tag: (a, b) => natCmp(a.tag, b.tag),
    type: (a, b) => natCmp(a.type, b.type) || natCmp(a.tag, b.tag),
    location: (a, b) => natCmp(a.building, b.building) || natCmp(a.floor, b.floor) || natCmp(a.room, b.room) || natCmp(a.tag, b.tag),
    status: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || natCmp(a.tag, b.tag),
    updated: (a, b) => natCmp(b.updatedAt, a.updatedAt),
  };
  return out.sort(sorters[f.sort] || sorters.tag);
}
const uniq = (arr, k) => [...new Set(arr.map(a => a[k]).filter(Boolean))].sort(natCmp);
const NO_PANEL = '(none)';
const panelsOf = assets => [...new Set(assets.map(a => a.powerPanel && normPanel(a.powerPanel)).filter(Boolean))].sort(natCmp);
const parentsOf = assets => [...new Set(assets.flatMap(fedList))].sort(natCmp);
const relSub = a => { const f = fedList(a), pw = a.powerPanel ? `⚡ ${normPanel(a.powerPanel)}${a.breaker ? ' / ' + a.breaker : ''}` : '';
  return [f.length && `Fed from ${f.join(', ')}`, pw].filter(Boolean).join(' · '); };
const options = (vals, sel, allLabel) => `<option value="">${esc(allLabel)}</option>` + vals.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');

async function renderProject(pid) {
  const p = await Data.project(pid); if (!p) return go('/', true);
  const [assets, pc] = await Promise.all([Data.assets(pid), photoCounts()]);
  const f = getFilter(pid);
  setChrome(p.name, '/', `<button class="icon-btn" id="pMenu" aria-label="Project menu">${ICON.more}</button>`);
  const anyAdv = f.type || f.building || f.floor || f.panel || f.fed || f.sort !== 'tag';
  const pnls = panelsOf(assets), pars = parentsOf(assets);
  view.innerHTML = `
    ${partsReminders([p], assets).map(reminderHtml).join('')}
    ${inspNoticeHtml(pid, assets)}
    <div class="chips" id="statusChips"></div>
    <div class="search"><span>${ICON.search}</span><input id="q" type="search" placeholder="Search tag, model, serial, room, panel…" value="${esc(f.q)}" autocomplete="off" enterkeyhint="search"></div>
    <details class="filters" ${anyAdv ? 'open' : ''}><summary>Filters &amp; sort</summary>
      <div class="grid2">
        <div class="field"><label>Type</label><select id="fType">${options(TYPES, f.type, 'All types')}</select></div>
        <div class="field"><label>Building</label><select id="fBldg">${options(uniq(assets, 'building'), f.building, 'All buildings')}</select></div>
        <div class="field"><label>Floor</label><select id="fFloor">${options(uniq(assets, 'floor'), f.floor, 'All floors')}</select></div>
        <div class="field"><label>Power panel</label><select id="fPanel">${options(pnls, f.panel, 'All panels')}${assets.some(a => !a.powerPanel) ? `<option value="${NO_PANEL}" ${f.panel === NO_PANEL ? 'selected' : ''}>No panel recorded</option>` : ''}</select></div>
        <div class="field"><label>Fed from</label><select id="fFed">${options(pars, f.fed, 'Any upstream')}</select></div>
        <div class="field"><label>Sort by</label><select id="fSort">${[['tag','Tag'],['type','Type'],['location','Location'],['status','Status'],['updated','Recently updated']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      </div></details>
    <div class="resultbar"><span id="count"></span><button class="linkbtn" id="clearF">Clear filters</button></div>
    <div class="list" id="assetList"></div>
    <div class="row no-print"><button class="btn sm" id="bExport">Export</button><button class="btn sm" id="bImport">Import</button><button class="btn sm" id="bLabels">${ICON.print} Labels</button><button class="btn sm" id="bInsp">✅ Inspections</button><button class="btn sm" id="bParts">🔧 Parts due</button><button class="btn sm" id="bTree">🌳 System tree</button><button class="btn sm" id="bPanels">⚡ By panel</button></div>`;
  setBottomBar(`<button class="btn" id="bScan">${ICON.scan} Scan</button><button class="btn primary" id="bAdd">${ICON.plus} Add asset</button>`);

  const renderList = () => {
    saveFilters();
    const counts = {}; assets.forEach(a => { const s = a.status || 'Not started'; counts[s] = (counts[s] || 0) + 1; });
    $('#statusChips').innerHTML = `<button class="chip ${!f.status ? 'active' : ''}" data-s="">All<span class="n">${assets.length}</span></button>` +
      STATUSES.map(s => `<button class="chip ${f.status === s ? 'active' : ''}" data-s="${esc(s)}">${esc(s)}<span class="n">${counts[s] || 0}</span></button>`).join('');
    const list = applyFilter(assets, f);
    $('#count').textContent = assets.length ? `Showing ${list.length} of ${assets.length}` : '';
    $('#clearF').hidden = !(f.q || f.type || f.status || f.building || f.floor || f.panel || f.fed);
    $('#assetList').innerHTML = !assets.length
      ? `<div class="empty"><div class="big">🏷️</div><p><b>No assets yet.</b></p><p>Tap <b>Add asset</b>, scan an existing tag, or import a CSV/Excel equipment schedule.</p></div>`
      : !list.length ? `<div class="empty">No assets match these filters.</div>`
      : list.map(a => `<a class="item" href="#/p/${encodeURIComponent(pid)}/a/${encodeURIComponent(a.id)}"><div class="main">
          <div class="t">${esc(a.tag)}</div>
          <div class="sub">${esc([a.manufacturer, a.model, a.capacity].filter(Boolean).join(' · ') || '—')}</div>
          <div class="sub">${esc(locLine(a) || a.areaServed || '')}${pc[a.id] ? ` · 📷 ${pc[a.id]}` : ''}</div>${relSub(a) ? `<div class="sub rel-sub">${esc(relSub(a))}</div>` : ''}${inspLine(a) ? `<div class="sub insp-sub">✓ ${esc(inspLine(a))}</div>` : ''}</div>
          <div class="right"><span class="badge">${esc(a.type || '—')}</span>${statusPill(a.status)}${lifePill(a)}${partsPill(a)}${inspPill(a)}</div></a>`).join('');
  };
  renderList();
  $('#statusChips').onclick = e => { const c = e.target.closest('.chip'); if (c) { f.status = c.dataset.s; renderList(); } };
  $('#q').oninput = e => { f.q = e.target.value; renderList(); };
  $('#fType').onchange = e => { f.type = e.target.value; renderList(); };
  $('#fBldg').onchange = e => { f.building = e.target.value; renderList(); };
  $('#fFloor').onchange = e => { f.floor = e.target.value; renderList(); };
  $('#fPanel').onchange = e => { f.panel = e.target.value; renderList(); };
  $('#fFed').onchange = e => { f.fed = e.target.value; renderList(); };
  $('#fSort').onchange = e => { f.sort = e.target.value; renderList(); };
  $('#clearF').onclick = () => { Object.assign(f, {q: '', type: '', status: '', building: '', floor: '', panel: '', fed: ''}); renderProject(pid); };
  $('#bAdd').onclick = () => go(`/p/${encodeURIComponent(pid)}/a/new`);
  $('#bScan').onclick = () => openScanner(pid);
  $('#bExport').onclick = () => exportDialog(p, assets, applyFilter(assets, f));
  $('#bImport').onclick = () => importDialog(p, assets);
  $('#bLabels').onclick = () => go(`/p/${encodeURIComponent(pid)}/labels?filtered=1`);
  $('#bParts').onclick = () => go(`/p/${encodeURIComponent(pid)}/parts`);
  $('#bInsp').onclick = () => go(`/p/${encodeURIComponent(pid)}/inspections`);
  $('#bTree').onclick = () => go(`/p/${encodeURIComponent(pid)}/tree`);
  $('#bPanels').onclick = () => go(`/p/${encodeURIComponent(pid)}/panels`);
  $('#pMenu').onclick = () => {
    const m = modal({title: p.name, body: `<div class="menu">
      <button class="btn" data-m="edit">✏️ Edit project details</button>
      <button class="btn" data-m="export">⬇️ Export to Excel / CSV</button>
      <button class="btn" data-m="import">⬆️ Import from Excel / CSV</button>
      <button class="btn" data-m="labels">🖨️ Print QR tag labels</button>
      <button class="btn" data-m="insp">✅ Inspections – due, in progress, deficiencies</button>
      <button class="btn" data-m="parts">🔧 Filters &amp; belts due / email list</button>
      <button class="btn" data-m="tree">🌳 System tree (what feeds what)</button>
      <button class="btn" data-m="panels">⚡ Equipment by electrical panel</button>
      <button class="btn danger" data-m="delete">🗑️ Delete project</button></div>`});
    m.el.addEventListener('click', async e => {
      const b = e.target.closest('[data-m]'); if (!b) return; m.close();
      const a = b.dataset.m;
      if (a === 'edit') projectDialog(p);
      if (a === 'export') exportDialog(p, assets, applyFilter(assets, f));
      if (a === 'import') importDialog(p, assets);
      if (a === 'labels') go(`/p/${encodeURIComponent(pid)}/labels?filtered=1`);
      if (a === 'parts') go(`/p/${encodeURIComponent(pid)}/parts`);
      if (a === 'insp') go(`/p/${encodeURIComponent(pid)}/inspections`);
      if (a === 'tree') go(`/p/${encodeURIComponent(pid)}/tree`);
      if (a === 'panels') go(`/p/${encodeURIComponent(pid)}/panels`);
      if (a === 'delete' && await confirmBox('Delete project?', `This permanently deletes <b>${esc(p.name)}</b> and all ${assets.length} assets and photos on this device. Export or back up first if you need them.`, 'Delete', true)) {
        await Data.deleteProject(pid); toast('Project deleted'); go('/');
      }
    });
  };
}

/* ---------------- Asset detail ---------------- */
async function renderAsset(pid, aid) {
  const [p, a] = await Promise.all([Data.project(pid), Data.asset(aid)]);
  if (!p) return go('/', true);
  if (!a) return go(`/p/${encodeURIComponent(pid)}`, true);
  const [photos, projAssets] = await Promise.all([Data.photos(aid), Data.assets(pid)]);
  const base = `/p/${encodeURIComponent(pid)}/a/${encodeURIComponent(aid)}`;
  setChrome(a.tag, `/p/${encodeURIComponent(pid)}`, `<button class="icon-btn" id="hdrEdit" aria-label="Edit" style="font-size:16px;font-weight:700">Edit</button>`);
  const rows = FIELDS.filter(fl => !['tag','type','status','notes','installYear','lifeExpectancy','ageOverride',...REL_KEYS].includes(fl.key) && a[fl.key]).map(fl => `<dt>${esc(fl.label)}</dt><dd>${esc(a[fl.key])}</dd>`).join('');
  const aParts = assetParts(a);
  const partsCard = `<div class="card parts-card" id="partsCard"><div class="lbl">Filters &amp; belts</div>
    ${aParts.length ? aParts.map(pt => { const st = partStatus(pt), nd = partNextDue(pt); return `<div class="part-row"><div class="main">
      <div><b>${esc(pt.qty)} × ${esc(pt.size || '(size not set)')}</b> <span class="badge">${esc(pt.kind)}</span></div>
      <div class="small muted">${esc(freqLabel(pt.freq))} · Last replaced ${esc(fmtDate(pt.lastReplaced) || '—')}</div>
      <div class="small" style="margin-top:4px">Next due <b>${esc(fmtDate(nd) || '—')}</b></div><div style="margin-top:4px"><span class="pill pt-pill ${st.cls}">${esc(st.label)}</span></div>
      ${pt.notes ? `<div class="small muted">${esc(pt.notes)}</div>` : ''}</div>
      <button class="btn sm" data-prep="${esc(pt.id)}" title="Mark replaced today">✓ Replaced</button></div>`; }).join('')
      + `<a class="linkbtn" style="display:inline-flex;align-items:center" href="#/p/${encodeURIComponent(pid)}/parts">Parts due list &amp; email ›</a>`
    : '<p class="muted small" style="margin:4px 0">None set up. Tap <b>Edit details</b> to add filter sizes or belts and how often they’re replaced.</p>'}</div>`;
  view.innerHTML = `
    <div class="hero"><div style="display:flex;gap:12px;align-items:flex-start">
      <div style="flex:1;min-width:0"><div class="tag">${esc(a.tag)}</div>
        <div class="meta"><span class="badge">${esc(a.type || '—')}</span>${statusPill(a.status)}${lifePill(a)}</div>
        <div class="muted small" style="margin-top:8px">${esc(p.name)}</div></div>
      <div class="qr-mini" title="QR for ${esc(a.tag)}">${qrSvg(a.tag)}</div></div></div>
    <div class="card"><div class="lbl">Status — tap to update</div><div class="status-pick" id="stPick">${STATUSES.map(s =>
      `<button data-s="${esc(s)}" class="${(a.status || 'Not started') === s ? 'on ' + STATUS_CLASS[s] : ''}">${esc(s)}</button>`).join('')}</div></div>
    ${inspCardHtml(pid, a)}
    ${relCardHtml(pid, a, relIndex(projAssets))}
    ${lifeCardHtml(a)}
    ${partsCard}
    <div class="card">${rows ? `<dl class="kv">${rows}</dl>` : '<span class="muted">No details yet. Tap Edit to add manufacturer, model, serial, location…</span>'}</div>
    ${a.notes ? `<div class="card"><div class="lbl">Notes</div><div style="white-space:pre-wrap">${esc(a.notes)}</div></div>` : ''}
    <div class="card"><div class="lbl">Nameplate photos (${photos.length})</div><div class="photos" id="phGrid">
      ${photos.map(ph => `<button class="ph" data-ph="${esc(ph.id)}"><img alt="Photo" src="${objURL(ph.blob)}"></button>`).join('')}
      <label class="addph">${ICON.camera}<span>Add photo</span><input type="file" accept="image/*" capture="environment" multiple hidden id="phInput"></label></div></div>
    <div class="row"><button class="btn" id="bLabel">${ICON.print} Print label</button><button class="btn" id="bDup">Duplicate</button></div>
    <div class="row"><button class="btn danger" id="bDel">Delete asset</button></div>
    <p class="muted small">Updated ${esc(new Date(a.updatedAt || a.createdAt).toLocaleString())}</p>`;
  setBottomBar(`<button class="btn" id="bScan">${ICON.scan} Scan next</button><button class="btn primary" id="bEdit">Edit details</button>`);
  $('#hdrEdit').onclick = $('#bEdit').onclick = () => go(base + '/edit');
  $('#bScan').onclick = () => openScanner(pid);
  $('#stPick').onclick = async e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    a.status = b.dataset.s; await Data.saveAsset(a); toast(`${a.tag}: ${a.status}`);
    $$('#stPick button').forEach(x => x.className = x.dataset.s === a.status ? 'on ' + STATUS_CLASS[a.status] : '');
    $('.hero .pill').outerHTML = statusPill(a.status);
  };
  $('#phInput').onchange = async e => {
    const files = [...e.target.files]; if (!files.length) return;
    toast('Saving photo…');
    for (const f of files) await Data.addPhoto(aid, await resizeImage(f));
    await Data.saveAsset(a); toast(files.length > 1 ? `${files.length} photos added` : 'Photo added'); route();
  };
  $('#phGrid').onclick = e => {
    const b = e.target.closest('[data-ph]'); if (!b) return;
    const ph = photos.find(x => x.id === b.dataset.ph);
    modal({title: `${a.tag} photo`, wide: true, body: `<img class="photo-full" src="${objURL(ph.blob)}" alt="Photo">`, actions: [
      {label: 'Download', onClick: () => downloadBlob(ph.blob, `${slug(a.tag)}_${ph.id.slice(0, 6)}.jpg`)},
      {label: 'Delete photo', cls: 'danger', onClick: async () => { if (await confirmBox('Delete photo?', 'This cannot be undone.', 'Delete', true)) { await Data.deletePhoto(ph.id); route(); } }},
    ]});
  };
  $('#partsCard').onclick = async e => {
    const b = e.target.closest('[data-prep]'); if (!b) return;
    const pt = aParts.find(x => x.id === b.dataset.prep); if (!pt) return;
    const nd = partNextDue({...pt, lastReplaced: today()});
    if (!await confirmBox('Mark replaced today?', `${esc(pt.kind)} <b>${esc(pt.size || '')}</b> on ${esc(a.tag)} replaced ${esc(fmtDate(today()))}. Next due becomes <b>${esc(fmtDate(nd))}</b>.`, 'Mark replaced')) return;
    const r = await markPartReplaced(aid, pt.id);
    if (r) { toast(`Next due ${fmtDate(r.next)}`); route(); }
  };
  const bis = $('#bInspStart'); if (bis) bis.onclick = () => startInspection(pid, aid);
  $('#bInspSetup').onclick = () => inspSetupDialog(pid, a);
  $('#bLabel').onclick = () => go(`/p/${encodeURIComponent(pid)}/labels?ids=${encodeURIComponent(aid)}`);
  $('#bDup').onclick = () => go(`/p/${encodeURIComponent(pid)}/a/new?from=${encodeURIComponent(aid)}`);
  $('#bDel').onclick = async () => {
    if (await confirmBox('Delete asset?', `Delete <b>${esc(a.tag)}</b> and its ${photos.length} photo(s)?`, 'Delete', true)) {
      await Data.deleteAsset(aid); toast('Asset deleted'); go(`/p/${encodeURIComponent(pid)}`);
    }
  };
}

const REL_KEYS = ['fedFrom', 'controlledBy', 'powerPanel', 'breaker', 'voltage', 'disconnect'];
const assetHref = (pid, a) => `#/p/${encodeURIComponent(pid)}/a/${encodeURIComponent(a.id)}`;
const newTagHref = (pid, tag) => `#/p/${encodeURIComponent(pid)}/a/new?tag=${encodeURIComponent(tag)}`;
const panelHref = (pid, panel) => `#/p/${encodeURIComponent(pid)}/panels?panel=${encodeURIComponent(panel)}`;
function relCardHtml(pid, a, idx) {
  const fed = fedList(a).filter(t => t !== normTag(a.tag)), feeds = idx.feeds(a.tag), path = upstreamPath(a, idx);
  const tagLink = t => { const x = idx.byTag.get(t);
    return x ? `<a class="rel-link" href="${assetHref(pid, x)}"><b>${esc(x.tag)}</b>${x.type ? `<span class="badge">${esc(x.type)}</span>` : ''}<span class="chev">›</span></a>`
      : `<a class="rel-link missing" href="${newTagHref(pid, t)}" title="Not tagged yet – tap to add it"><b>${esc(t)}</b><span class="muted small">not tagged yet · add</span><span class="chev">+</span></a>`; };
  const ctrl = String(a.controlledBy || '').split(/\s*,\s*/).filter(Boolean).map(c => { const x = idx.byTag.get(normTag(c));
    return x && x.id !== a.id ? `<a href="${assetHref(pid, x)}"><b>${esc(x.tag)}</b></a>` : esc(c); }).join(', ');
  const pw = [a.powerPanel && `<a class="rel-panel" href="${panelHref(pid, normPanel(a.powerPanel))}">Panel ${esc(normPanel(a.powerPanel))}</a>`, a.breaker && `<b>${esc(cktLabel(a.breaker))}</b>`, a.voltage && esc(a.voltage)].filter(Boolean).join(' · ');
  const rows = [];
  if (fed.length) rows.push(`<dt>Fed from</dt><dd id="relFed">${fed.map(tagLink).join('')}</dd>`);
  if (path.length > 1) rows.push(`<dt>System path</dt><dd class="rel-path">${path.map(n => n.asset ? `<a href="${assetHref(pid, n.asset)}">${esc(n.tag)}</a>` : `<span${n.loop ? ' class="over-txt" title="Loop: this chain feeds back on itself"' : ''}>${esc(n.tag)}${n.loop ? ' ↻' : ''}</span>`).join(' › ')} › <b>${esc(a.tag)}</b></dd>`);
  if (feeds.length) rows.push(`<dt>Feeds (${feeds.length})</dt><dd id="relFeeds"><div class="small muted" style="margin-bottom:6px">${esc(typeSummary(feeds))}</div><div class="rel-chips">${feeds.map(x => `<a class="rel-chip" href="${assetHref(pid, x)}">${esc(x.tag)}</a>`).join('')}</div></dd>`);
  if (a.controlledBy) rows.push(`<dt>Controlled by</dt><dd id="relCtrl">${ctrl}</dd>`);
  if (pw) rows.push(`<dt>Power</dt><dd id="relPower">${pw}</dd>`);
  if (a.disconnect) rows.push(`<dt>Disconnect</dt><dd>${esc(a.disconnect)}</dd>`);
  const none = !fed.length && !a.controlledBy && !hasPower(a);
  return `<div class="card rel-card" id="relCard"><div class="lbl">Relationships &amp; power</div>
    ${rows.length ? `<dl class="kv rel-kv">${rows.join('')}</dl>` : ''}
    ${none ? `<p class="muted small" style="margin:4px 0">${feeds.length ? 'This unit\'s own feed, controller and power aren\'t recorded.' : 'Not recorded.'} Tap <b>Edit details</b> to add what feeds it (e.g. AHU-1), what controls it, and its panel / breaker.</p>` : ''}
    <div class="rel-actions"><a class="linkbtn" href="#/p/${encodeURIComponent(pid)}/a/new?fed=${encodeURIComponent(a.tag)}">+ Add unit fed from ${esc(a.tag)}</a>
      <a class="linkbtn" href="#/p/${encodeURIComponent(pid)}/tree?focus=${encodeURIComponent(normTag(a.tag))}">System tree ›</a></div></div>`;
}

/* ---------------- System tree (what feeds what) ---------------- */
async function renderTree(pid, q) {
  const p = await Data.project(pid); if (!p) return go('/', true);
  const assets = await Data.assets(pid), idx = relIndex(assets);
  setChrome(`System tree – ${p.name}`, `/p/${encodeURIComponent(pid)}`);
  const focus = normTag(q.get('focus') || '');
  const own = t => { const x = idx.byTag.get(t); return x ? fedList(x).filter(u => u !== t) : []; };
  const linked = new Set();
  assets.forEach(a => { const t = normTag(a.tag), f = own(t); if (f.length) { linked.add(t); f.forEach(u => linked.add(u)); } });
  const reached = new Set();
  const node = (t, path, parent) => {
    const a = idx.byTag.get(t), kids = idx.feeds(t), loop = path.has(t);
    const others = own(t).filter(u => u !== parent);
    reached.add(t);
    const pw = a && a.powerPanel ? `<span class="tn-pwr">⚡ ${esc(normPanel(a.powerPanel))}${a.breaker ? ' / ' + esc(a.breaker) : ''}</span>` : '';
    const row = `<div class="tn-row${t === focus ? ' tn-focus' : ''}" ${t === focus ? 'id="tnFocus"' : ''}>${a
      ? `<a class="tn-tag" href="${assetHref(pid, a)}">${esc(a.tag)}</a>${a.type ? `<span class="badge">${esc(a.type)}</span>` : ''}`
      : `<a class="tn-tag missing" href="${newTagHref(pid, t)}">${esc(t)}</a><span class="muted small">not tagged yet</span>`}${pw}
      ${kids.length && !loop ? `<span class="tn-n" title="Feeds ${kids.length}">${kids.length}</span>` : ''}
      ${kids.length && !loop && !parent ? `<div class="tn-note small muted">feeds ${esc(typeSummary(kids))}</div>` : ''}
      ${others.length ? `<div class="tn-note small muted">also fed from ${esc(others.join(', '))}</div>` : ''}
      ${loop ? '<div class="tn-note small over-txt">↻ loop – this unit is already above in this branch</div>' : ''}</div>`;
    if (!kids.length || loop) return `<li class="tn-leaf">${row}</li>`;
    const np = new Set(path); np.add(t);
    return `<li><details open><summary>${row}</summary><ul>${kids.map(k => node(normTag(k.tag), np, t)).join('')}</ul></details></li>`;
  };
  const roots = [...linked].filter(t => !own(t).length).sort((x, y) => idx.feeds(y).length - idx.feeds(x).length || natCmp(x, y));
  let html = roots.map(t => node(t, new Set(), null)).join('');
  // anything left only sits inside a loop (A feeds B feeds A): show it from its first tag
  [...linked].sort(natCmp).forEach(t => { if (!reached.has(t)) { html += node(t, new Set(), null); } });
  const unlinked = assets.filter(a => !linked.has(normTag(a.tag))).sort((x, y) => natCmp(x.tag, y.tag));
  const nSys = roots.length;
  view.innerHTML = `
    <div class="due-summary"><div><span class="n">${nSys}</span> system${nSys === 1 ? '' : 's'}</div><div><span class="n">${[...linked].filter(t => idx.byTag.has(t)).length}</span> linked</div>${unlinked.length ? `<div><span class="n">${unlinked.length}</span> not linked</div>` : ''}</div>
    ${linked.size ? `<div class="row no-print" style="margin:6px 0"><button class="btn sm" id="tExpand">Expand all</button><button class="btn sm" id="tCollapse">Collapse all</button><button class="btn sm" id="tPanels">⚡ By panel</button></div>
      <div class="card tree-card"><ul class="tree" id="tree">${html}</ul></div>`
      : `<div class="empty"><div class="big">🌳</div><p><b>No relationships yet.</b></p><p>Open an asset → <b>Edit details</b> → <b>Relationships / power</b> and set <b>Fed from</b> (e.g. VAV-1-2 fed from AHU-1). The tree builds itself.</p></div>`}
    ${unlinked.length ? `<details class="card" ${linked.size ? '' : 'open'}><summary class="lbl" style="margin:0;min-height:40px;display:flex;align-items:center;cursor:pointer">Not linked to anything (${unlinked.length})</summary>
      <div class="rel-chips" style="margin-top:8px">${unlinked.map(a => `<a class="rel-chip" href="${assetHref(pid, a)}">${esc(a.tag)}</a>`).join('')}</div></details>` : ''}
    <p class="muted small">A unit fed from two sources appears under both. Tap a tag to open it; tap ▸ to fold a branch.</p>`;
  const all = open => $$('#tree details').forEach(d => { d.open = open; });
  const ex = $('#tExpand'); if (ex) { ex.onclick = () => all(true); $('#tCollapse').onclick = () => all(false); $('#tPanels').onclick = () => go(`/p/${encodeURIComponent(pid)}/panels`); }
  const fe = $('#tnFocus'); if (fe) setTimeout(() => fe.scrollIntoView({block: 'center'}), 50);
}

/* ---------------- Equipment by electrical panel (shutdowns / LOTO) ---------------- */
async function renderPanels(pid, q) {
  const p = await Data.project(pid); if (!p) return go('/', true);
  const assets = await Data.assets(pid), idx = relIndex(assets);
  setChrome(`By panel – ${p.name}`, `/p/${encodeURIComponent(pid)}`);
  const groups = new Map();
  assets.forEach(a => { const k = a.powerPanel ? normPanel(a.powerPanel) : ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); });
  groups.forEach(l => l.sort((x, y) => natCmp(x.breaker || '~', y.breaker || '~') || natCmp(x.tag, y.tag)));
  const panels = [...groups.keys()].filter(Boolean).sort(natCmp);
  const sel = q.get('panel') ? normPanel(q.get('panel')) : '';
  const base = `/p/${encodeURIComponent(pid)}/panels`;
  const row = a => { const feeds = idx.feeds(a.tag), fed = fedList(a);
    return `<a class="pn-row" href="${assetHref(pid, a)}"><div class="main">
      <div><span class="t">${esc(a.tag)}</span> <span class="badge">${esc(a.type || '—')}</span></div>
      <div class="small muted">${esc([a.voltage, a.disconnect && `Disc: ${a.disconnect}`, locLine(a)].filter(Boolean).join(' · ') || 'No details')}</div>
      ${fed.length || feeds.length ? `<div class="small muted">${esc([fed.length && `Fed from ${fed.join(', ')}`, feeds.length && `Feeds ${typeSummary(feeds)}`].filter(Boolean).join(' · '))}</div>` : ''}</div>
      <div class="pn-ckt">${a.breaker ? esc(cktLabel(a.breaker)) : '<span class="muted">Ckt ?</span>'}</div></a>`; };
  const card = k => { const l = groups.get(k) || [];
    return `<div class="card pn-card" data-panel="${esc(k)}"><div class="pn-head"><span class="pn-name">Panel ${esc(k)}</span><span class="pn-count">${plural(l.length, 'unit')}</span></div>
      <div class="small muted" style="margin:-2px 0 4px">${esc(typeSummary(l))}</div>${l.map(row).join('')}</div>`; };
  const none = groups.get('') || [];
  view.innerHTML = panels.length ? `
    <div class="chips no-print" id="pnChips"><button class="chip ${!sel ? 'active' : ''}" data-p="">All<span class="n">${panels.length}</span></button>${panels.map(k => `<button class="chip ${sel === k ? 'active' : ''}" data-p="${esc(k)}">${esc(k)}<span class="n">${groups.get(k).length}</span></button>`).join('')}</div>
    <div class="row no-print" style="margin:6px 0"><button class="btn sm" id="pnPrint">${ICON.print} Print / PDF</button><button class="btn sm" id="pnTree">🌳 System tree</button></div>
    ${sel && !groups.has(sel) ? `<div class="notice warn">No equipment on panel <b>${esc(sel)}</b>.</div>` : ''}
    ${(sel ? [sel].filter(k => groups.has(k)) : panels).map(card).join('')}
    ${!sel && none.length ? `<details class="card"><summary class="lbl" style="margin:0;min-height:40px;display:flex;align-items:center;cursor:pointer">No panel recorded (${none.length})</summary>
      <div class="rel-chips" style="margin-top:8px">${none.sort((x, y) => natCmp(x.tag, y.tag)).map(a => `<a class="rel-chip" href="${assetHref(pid, a)}">${esc(a.tag)}</a>`).join('')}</div></details>` : ''}
    <p class="muted small">Grouped by the <b>Power panel</b> on each asset, sorted by circuit. Use it to see everything that goes dark when a panel or breaker is shut off. Always verify in the field before LOTO.</p>`
    : `<div class="empty"><div class="big">⚡</div><p><b>No panels recorded yet.</b></p><p>Open an asset → <b>Edit details</b> → <b>Relationships / power</b> and enter the power panel (e.g. 2A3) and breaker / circuit numbers.</p></div>`;
  const ch = $('#pnChips'); if (ch) ch.onclick = e => { const c = e.target.closest('.chip'); if (c) go(c.dataset.p ? `${base}?panel=${encodeURIComponent(c.dataset.p)}` : base, true); };
  const pr = $('#pnPrint'); if (pr) pr.onclick = () => window.print();
  const tr = $('#pnTree'); if (tr) tr.onclick = () => go(`/p/${encodeURIComponent(pid)}/tree`);
}

/* ---------------- Asset form (new / edit) ---------------- */
async function renderAssetForm(pid, aid, q) {
  const p = await Data.project(pid); if (!p) return go('/', true);
  const assets = await Data.assets(pid);
  let a, isNew = !aid;
  if (aid) { a = await Data.asset(aid); if (!a) return go(`/p/${encodeURIComponent(pid)}`, true); }
  else {
    a = {tag: '', type: '', status: 'Not started'};
    const from = q.get('from') && await Data.asset(q.get('from'));
    // Duplicate / Save & next: same model run → carry type, make/model, location, upstream, controller, panel & voltage (not breaker / disconnect)
    if (from) ['type','manufacturer','model','capacity','building','floor','lifeExpectancy','fedFrom','controlledBy','powerPanel','voltage'].forEach(k => a[k] = from[k] || '');
    if (from) a.tag = nextTag(from.tag);
    if (from) a.parts = assetParts(from).map(pt => ({...pt, id: uid()}));
    if (from && from.inspFreq !== undefined) a.inspFreq = from.inspFreq;
    if (from) a.inspExtra = assetExtra(from).map(x => ({...x, id: uid()}));
    if (q.get('tag')) a.tag = normTag(q.get('tag'));
    if (q.get('fed')) a.fedFrom = splitTags(q.get('fed')).join(', ');
    if (!a.type && a.tag) a.type = guessTypeFromTag(a.tag);
    if (a.type && !a.lifeExpectancy) a.lifeExpectancy = String(defaultLife(a.type));
  }
  const existingPhotos = aid ? await Data.photos(aid) : [];
  const relIdx = relIndex(assets), feedsHere = aid ? relIdx.feeds(a.tag).filter(x => x.id !== a.id) : [];
  const staged = []; const removed = new Set();
  const back = aid ? `/p/${encodeURIComponent(pid)}/a/${encodeURIComponent(aid)}` : `/p/${encodeURIComponent(pid)}`;
  setChrome(isNew ? 'New asset' : `Edit ${a.tag}`, back);
  const dl = (id, k) => `<datalist id="${id}">${uniq(assets, k).map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
  const inp = (k, label, extra = '') => `<div class="field"><label for="f_${k}">${label}</label><input id="f_${k}" name="${k}" value="${esc(a[k])}" ${extra}></div>`;
  view.innerHTML = `
    ${isNew && q.get('scanned') ? `<div class="notice">Tag <b>${esc(a.tag)}</b> isn't in this project yet — fill in the details to create it.</div>` : ''}
    <form id="aForm" autocomplete="off">
      <div class="field"><label for="f_tag">Tag / Asset ID <span class="req">*</span></label>
        <div style="display:flex;gap:8px"><input id="f_tag" name="tag" class="tag-input" value="${esc(a.tag)}" placeholder="e.g. AHU-1" required autocapitalize="characters" spellcheck="false">
        <button type="button" class="btn" id="scanIntoTag" aria-label="Scan tag into field" style="flex:0 0 auto;padding:0 14px">${ICON.scan}</button></div></div>
      <div class="grid2">
        <div class="field"><label for="f_type">Equipment type</label><select id="f_type" name="type"><option value="">Select…</option>${TYPES.map(t => `<option ${a.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label for="f_status">Status</label><select id="f_status" name="status">${STATUSES.map(s => `<option ${(a.status || 'Not started') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      </div>
      ${inp('manufacturer', 'Manufacturer', 'list="dl_mfr" placeholder="e.g. Trane, Carrier, York"')}
      <div class="grid2">${inp('model', 'Model', 'spellcheck="false" autocapitalize="characters"')}${inp('serial', 'Serial number', 'spellcheck="false" autocapitalize="characters"')}</div>
      ${inp('capacity', 'Capacity / size', 'placeholder="e.g. 20 ton, 8,000 CFM, 150 GPM"')}
      <div class="grid2">${inp('building', 'Building', 'list="dl_bldg"')}${inp('floor', 'Floor', 'list="dl_floor"')}</div>
      ${inp('room', 'Room / location', 'list="dl_room" placeholder="e.g. Mech Rm 101, Roof"')}
      ${inp('areaServed', 'Area served', 'list="dl_area" placeholder="e.g. 2nd floor east wing"')}
      <div class="card rel-ed-card" id="relEd" style="padding:12px;margin:0 0 14px">
        <div class="lbl">Relationships / power</div>
        <div class="field"><label for="f_fedPick">Fed from / served by</label>
          <div class="rel-chips" id="fedChips"></div>
          <div style="display:flex;gap:8px"><input id="f_fedPick" list="dl_tags" placeholder="Pick or type a tag, e.g. AHU-1" autocapitalize="characters" spellcheck="false" enterkeyhint="done">
          <button type="button" class="btn" id="fedAdd" style="flex:0 0 auto;padding:0 16px">Add</button></div>
          <input type="hidden" name="fedFrom" id="f_fedFrom" value="${esc(fedList(a).join(', '))}">
          <p class="muted small" style="margin:6px 0 0">Upstream unit(s): e.g. AHU-1 for a VAV, CH-1 for a pump. Add more than one if needed. Tags that aren't tagged yet are fine.</p></div>
        ${!isNew && feedsHere.length ? `<p class="small" style="margin:-4px 0 12px">Feeds <b>${feedsHere.length}</b>: ${esc(feedsHere.map(x => x.tag).join(', '))} <span class="muted">(set on those units)</span></p>` : ''}
        ${inp('controlledBy', 'Controlled by', 'list="dl_ctrl" placeholder="e.g. DDC panel NAE-2, T-stat, VFD-3"')}
        <div class="grid2">${inp('powerPanel', 'Power panel', 'list="dl_panel" placeholder="e.g. 2A3" autocapitalize="characters" spellcheck="false"')}${inp('breaker', 'Breaker / circuit #', 'placeholder="e.g. 14,16,18" spellcheck="false"')}</div>
        <div class="grid2">${inp('voltage', 'Voltage / phase', 'list="dl_volt" placeholder="e.g. 480V/3ph"')}${inp('disconnect', 'Disconnect location', 'list="dl_disc" placeholder="e.g. at unit, roof"')}</div>
      </div>
      <div class="card" style="padding:12px;margin:0 0 14px">
        <div class="lbl">Age &amp; life expectancy</div>
        <div class="grid2">
          <div class="field"><label for="f_installYear">Install / mfr year</label>
            <input id="f_installYear" name="installYear" inputmode="numeric" pattern="[12][0-9]{3}" maxlength="4" placeholder="e.g. 2008" value="${esc(a.installYear)}"></div>
          <div class="field"><label for="f_lifeExpectancy">Life expectancy (yrs)</label>
            <input id="f_lifeExpectancy" name="lifeExpectancy" type="number" inputmode="numeric" min="1" max="100" step="1" placeholder="e.g. 25" value="${esc(a.lifeExpectancy)}"></div>
        </div>
        <div class="field"><label for="f_installDate">Install date <span class="muted">(optional)</span></label>
          <input id="f_installDate" name="installDate" type="date" value="${esc(a.installDate)}"></div>
        <div class="life-preview" id="lifePreview"></div>
        <details class="filters" id="ageOverrideDetails" ${a.ageOverride ? 'open' : ''}><summary>Override age manually</summary>
          <div class="field" style="margin-top:8px"><label for="f_ageOverride">Age override (years)</label>
            <input id="f_ageOverride" name="ageOverride" type="number" inputmode="numeric" min="0" max="150" step="1" placeholder="Leave blank to auto-calculate" value="${esc(a.ageOverride)}">
            <p class="muted small" style="margin:6px 0 0">Only fill this if the year is unknown. Clear it to go back to automatic age.</p></div>
        </details>
        <p class="muted small" style="margin:8px 0 0">Life expectancy prefills from equipment type (ASHRAE mid-range). Age and remaining life update automatically.</p>
      </div>
      <div class="card parts-ed-card" style="padding:12px;margin:0 0 14px">
        <div class="lbl">Filters &amp; belts</div>
        <p class="muted small" style="margin:0 0 10px">Add each filter size or belt this unit needs and how often it's replaced. Items show on the <b>Parts due</b> list (and home-screen reminder) the month before they're due.</p>
        <div id="partsList"></div>
        <div class="row" style="margin:4px 0 0"><button type="button" class="btn sm" data-add-part="Filter">+ Filter</button><button type="button" class="btn sm" data-add-part="Belt">+ Belt</button><button type="button" class="btn sm" data-add-part="Other">+ Other</button></div>
      </div>
      <datalist id="dl_psize">${[...new Set(assets.flatMap(x => assetParts(x).map(pt => pt.size)).filter(Boolean))].sort(natCmp).map(v => `<option value="${esc(v)}">`).join('')}</datalist>
      <div class="field"><label for="f_notes">Notes</label><textarea id="f_notes" name="notes" placeholder="Deficiencies, observations, startup notes…">${esc(a.notes)}</textarea></div>
      <div class="field"><span class="lbl">Nameplate photos</span><div class="photos" id="phGrid"></div></div>
      ${dl('dl_mfr', 'manufacturer')}${dl('dl_bldg', 'building')}${dl('dl_floor', 'floor')}${dl('dl_room', 'room')}${dl('dl_area', 'areaServed')}${dl('dl_ctrl', 'controlledBy')}${dl('dl_disc', 'disconnect')}
      <datalist id="dl_panel">${panelsOf(assets).map(v => `<option value="${esc(v)}">`).join('')}</datalist>
      <datalist id="dl_volt">${[...new Set([...VOLTAGES, ...uniq(assets, 'voltage')])].map(v => `<option value="${esc(v)}">`).join('')}</datalist>
      <datalist id="dl_tags">${assets.filter(x => x.id !== a.id && x.tag).sort((x, y) => natCmp(x.tag, y.tag)).map(x => `<option value="${esc(x.tag)}">${esc([x.type, locLine(x)].filter(Boolean).join(' · '))}</option>`).join('')}</datalist>
    </form>`;
  setBottomBar(isNew
    ? `<button class="btn" id="bSaveNext">Save &amp; next</button><button class="btn primary" id="bSave">Save</button>`
    : `<button class="btn" id="bCancel">Cancel</button><button class="btn primary" id="bSave">Save</button>`);
  const form = $('#aForm'); let dirty = false; form.oninput = () => { dirty = true; };
  const renderPhotos = () => {
    $('#phGrid').innerHTML = existingPhotos.filter(ph => !removed.has(ph.id)).map(ph => `<div class="ph"><img alt="" src="${objURL(ph.blob)}"><button type="button" class="x" data-rm="${esc(ph.id)}" aria-label="Remove">×</button></div>`).join('') +
      staged.map((b, i) => `<div class="ph"><img alt="" src="${objURL(b)}"><button type="button" class="x" data-rms="${i}" aria-label="Remove">×</button></div>`).join('') +
      `<label class="addph">${ICON.camera}<span>Take / add photo</span><input type="file" accept="image/*" capture="environment" multiple hidden id="phInput"></label>`;
    $('#phInput').onchange = async e => { for (const f of e.target.files) staged.push(await resizeImage(f)); dirty = true; renderPhotos(); };
  };
  renderPhotos();
  /* Filters & belts editor */
  const parts = assetParts(a).map(pt => ({...pt, _custom: !FREQS.some(f => f[0] === pt.freq)}));
  const dueCell = (pt, i) => pt.lastReplaced
    ? `<label>Next due</label><div class="due-auto"><b>${esc(fmtDate(partNextDue(pt)))}</b> <span class="muted small">auto</span></div>`
    : `<label for="pd_${i}">Next due <span class="muted small">(set if no last date)</span></label><input id="pd_${i}" type="date" data-k="dueManual" value="${esc(pt.dueManual)}">`;
  const partEditor = (pt, i) => `<div class="part-ed" data-i="${i}">
    <div class="part-ed-top">
      <select data-k="kind" aria-label="Part type">${PART_KINDS.map(k => `<option ${pt.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select>
      <label class="qty">Qty <input data-k="qty" type="number" inputmode="numeric" min="1" max="9999" step="1" value="${esc(pt.qty)}"></label>
      <button type="button" class="icon-btn part-rm" data-rm-part="${i}" aria-label="Remove item">${ICON.close}</button></div>
    <div class="field"><label>Size / part #</label><input data-k="size" list="dl_psize" value="${esc(pt.size)}" placeholder="${pt.kind === 'Belt' ? 'e.g. A42, BX55' : pt.kind === 'Filter' ? 'e.g. 20x25x2 MERV 13' : 'Part number / description'}" spellcheck="false" autocapitalize="characters"></div>
    <div class="grid2">
      <div class="field"><label>Replace every</label><select data-k="freqSel">${FREQS.map(([m, l]) => `<option value="${m}" ${!pt._custom && pt.freq === m ? 'selected' : ''}>${l}</option>`).join('')}<option value="custom" ${pt._custom ? 'selected' : ''}>Custom (months)…</option></select></div>
      <div class="field" ${pt._custom ? '' : 'hidden'}><label>Every N months</label><input data-k="freqCustom" type="number" inputmode="numeric" min="1" max="120" step="1" value="${esc(pt.freq)}"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>Last replaced</label><input type="date" data-k="lastReplaced" value="${esc(pt.lastReplaced)}"></div>
      <div class="field" data-due>${dueCell(pt, i)}</div>
    </div>
    <div class="row" style="margin:0 0 10px"><button type="button" class="btn sm" data-rep-part="${i}">✓ Mark replaced today</button></div>
    <div class="field" style="margin:0"><label>Notes</label><input data-k="notes" value="${esc(pt.notes)}" placeholder="e.g. 4 in bank, pleated"></div>
  </div>`;
  const pl = $('#partsList');
  const renderPartsEd = () => { pl.innerHTML = parts.length ? parts.map(partEditor).join('') : '<p class="muted small" style="margin:0 0 6px">No filters or belts yet.</p>'; };
  const refreshEd = i => { const el = $(`.part-ed[data-i="${i}"]`, pl); if (el) el.outerHTML = partEditor(parts[i], i); };
  renderPartsEd();
  const onPartInput = e => {
    const el = e.target.closest('[data-k]'), ed = e.target.closest('.part-ed'); if (!el || !ed) return;
    const i = +ed.dataset.i, pt = parts[i], k = el.dataset.k, v = el.value; dirty = true;
    if (k === 'kind') { const was = pt.kind; pt.kind = v; if (!pt._custom && pt.freq === DEFAULT_FREQ[was]) pt.freq = DEFAULT_FREQ[v]; if (e.type === 'change') refreshEd(i); }
    else if (k === 'freqSel') { if (v === 'custom') pt._custom = true; else { pt._custom = false; pt.freq = +v; } if (e.type === 'change') refreshEd(i); }
    else if (k === 'freqCustom') { const n = Math.round(+v); if (n >= 1 && n <= 120) pt.freq = n; $('[data-due]', ed).innerHTML = dueCell(pt, i); }
    else if (k === 'lastReplaced') { if (pt.lastReplaced !== v) { pt.lastReplaced = v; $('[data-due]', ed).innerHTML = dueCell(pt, i); } }
    else pt[k] = v;
  };
  pl.addEventListener('input', onPartInput); pl.addEventListener('change', onPartInput);
  form.addEventListener('click', e => {
    const add = e.target.closest('[data-add-part]');
    if (add) { parts.push({...normPart({kind: add.dataset.addPart}), _custom: false}); dirty = true; renderPartsEd(); const f = $(`.part-ed[data-i="${parts.length - 1}"] [data-k="size"]`, pl); if (f) f.focus(); return; }
    const rm = e.target.closest('[data-rm-part]'); if (rm) { parts.splice(+rm.dataset.rmPart, 1); dirty = true; renderPartsEd(); return; }
    const rp = e.target.closest('[data-rep-part]');
    if (rp) { const i = +rp.dataset.repPart; parts[i].lastReplaced = today(); parts[i].dueManual = ''; dirty = true; refreshEd(i); toast(`Replaced today – next due ${fmtDate(partNextDue(parts[i]))}`); }
  });
  $('#phGrid').onclick = e => {
    const r = e.target.closest('[data-rm]'); if (r) { removed.add(r.dataset.rm); dirty = true; renderPhotos(); }
    const s = e.target.closest('[data-rms]'); if (s) { staged.splice(+s.dataset.rms, 1); renderPhotos(); }
  };
  /* Fed-from picker: chips + datalist input (allows tags that don't exist yet) */
  let fed = fedList(a);
  const renderFed = () => {
    $('#f_fedFrom').value = fed.join(', ');
    $('#fedChips').innerHTML = fed.map((t, i) => { const x = relIdx.byTag.get(t);
      return `<span class="rel-chip ed ${x && x.id !== a.id ? '' : 'missing'}">${esc(t)}${x && x.id !== a.id && x.type ? ` <small>${esc(x.type)}</small>` : x ? '' : ' <small>new</small>'}<button type="button" data-rm-fed="${i}" aria-label="Remove ${esc(t)}">×</button></span>`; }).join('');
  };
  const addFed = (raw, quiet) => {
    const add = splitTags(raw); if (!add.length) return false;
    const self = normTag($('#f_tag').value);
    let n = 0; add.forEach(t => { if (t === self) { if (!quiet) toast("A unit can't be fed from itself"); return; } if (!fed.includes(t)) { fed.push(t); n++; } });
    $('#f_fedPick').value = ''; if (n) { dirty = true; renderFed(); } return n > 0;
  };
  renderFed();
  $('#fedAdd').onclick = () => { addFed($('#f_fedPick').value); $('#f_fedPick').focus(); };
  $('#f_fedPick').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addFed(e.target.value); } };
  $('#f_fedPick').oninput = e => { // picking from the datalist (no typing) adds right away
    const v = normTag(e.target.value); if ((!e.inputType || e.inputType === 'insertReplacementText') && relIdx.byTag.has(v)) addFed(v);
  };
  $('#fedChips').onclick = e => { const b = e.target.closest('[data-rm-fed]'); if (b) { fed.splice(+b.dataset.rmFed, 1); dirty = true; renderFed(); } };
  let typeAuto = !a.type;
  let lifeAuto = !a.lifeExpectancy || (a.type && String(a.lifeExpectancy) === String(defaultLife(a.type)));
  const refreshLifePreview = () => {
    const snap = {
      installYear: $('#f_installYear').value.trim(),
      installDate: $('#f_installDate').value,
      lifeExpectancy: $('#f_lifeExpectancy').value.trim(),
      ageOverride: $('#f_ageOverride').value.trim(),
    };
    const age = computeAge(snap), rem = computeRemaining(snap);
    const life = snap.lifeExpectancy !== '' ? Number(snap.lifeExpectancy) : null;
    const tone = lifeTone(rem, life);
    if (age == null && rem == null) { $('#lifePreview').innerHTML = '<p class="muted small" style="margin:4px 0 0">Enter an install year (or date) to see age and remaining life.</p>'; return; }
    $('#lifePreview').innerHTML = `<div class="life-preview-row">
      <span>Age: <b>${age != null ? age + ' yrs' : '—'}</b>${snap.ageOverride !== '' ? ' <span class="muted">(override)</span>' : ''}</span>
      <span class="pill life ${tone}">${rem == null ? 'Remaining: —' : (rem < 0 ? Math.abs(rem) + ' yrs past expectancy' : rem === 0 ? 'At end of life' : rem + ' yrs remaining')}</span>
    </div>`;
  };
  const applyTypeLife = (type) => {
    if (!type) return;
    if (lifeAuto || !$('#f_lifeExpectancy').value.trim()) {
      $('#f_lifeExpectancy').value = String(defaultLife(type));
      lifeAuto = true;
    }
  };
  $('#f_type').onchange = () => { typeAuto = false; applyTypeLife($('#f_type').value); refreshLifePreview(); };
  $('#f_lifeExpectancy').oninput = () => { lifeAuto = false; refreshLifePreview(); };
  $('#f_installYear').oninput = refreshLifePreview;
  $('#f_ageOverride').oninput = refreshLifePreview;
  $('#f_installDate').onchange = () => {
    const d = $('#f_installDate').value;
    if (d && /^\d{4}/.test(d) && !$('#f_installYear').value.trim()) $('#f_installYear').value = d.slice(0, 4);
    refreshLifePreview();
  };
  $('#f_tag').oninput = e => {
    if (typeAuto) {
      const g = guessTypeFromTag(e.target.value);
      $('#f_type').value = g;
      if (g) applyTypeLife(g);
    }
  };
  if (a.type && !a.lifeExpectancy) applyTypeLife(a.type);
  refreshLifePreview();
  $('#scanIntoTag').onclick = () => openScanner(pid, text => { $('#f_tag').value = normTag(extractTag(text)); $('#f_tag').dispatchEvent(new Event('input')); dirty = true; });
  if (isNew && !a.tag) setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) $('#f_tag').focus(); }, 50);
  const cancel = $('#bCancel'); if (cancel) cancel.onclick = async () => { if (!dirty || await confirmBox('Discard changes?', 'Your edits will be lost.', 'Discard', true)) go(back); };

  async function save(next) {
    if ($('#f_fedPick').value.trim()) addFed($('#f_fedPick').value, true);
    const fd = new FormData(form); const rec = {...a};
    FIELDS.forEach(fl => { rec[fl.key] = String(fd.get(fl.key) ?? '').trim(); });
    rec.tag = normTag(rec.tag);
    if (!rec.tag) { toast('Tag / Asset ID is required'); $('#f_tag').focus(); return; }
    if (rec.installYear) {
      const y = parseYear(rec.installYear);
      if (y == null) { toast('Install year must be a 4-digit year (e.g. 2008)'); $('#f_installYear').focus(); return; }
      rec.installYear = String(y);
    }
    if (rec.installDate && !rec.installYear) {
      const y = parseYear(rec.installDate); if (y != null) rec.installYear = String(y);
    }
    if (rec.lifeExpectancy !== '') {
      const n = Number(rec.lifeExpectancy);
      if (!isFinite(n) || n < 1 || n > 100) { toast('Life expectancy must be 1–100 years'); $('#f_lifeExpectancy').focus(); return; }
      rec.lifeExpectancy = String(Math.round(n));
    }
    if (rec.ageOverride !== '') {
      const n = Number(rec.ageOverride);
      if (!isFinite(n) || n < 0 || n > 150) { toast('Age override must be 0–150 years'); $('#f_ageOverride').focus(); return; }
      rec.ageOverride = String(Math.round(n));
    } else { delete rec.ageOverride; }
    const dup = assets.find(x => normTag(x.tag) === rec.tag && x.id !== a.id);
    if (dup) {
      if (await confirmBox('Tag already exists', `<b>${esc(rec.tag)}</b> is already used in this project. Tags must be unique so scanning works. Open the existing asset?`, 'Open existing'))
        go(`/p/${encodeURIComponent(pid)}/a/${encodeURIComponent(dup.id)}`);
      return;
    }
    rec.parts = parts.map(({_custom, ...pt}) => normPart(pt)).filter(pt => pt.size || pt.lastReplaced || pt.dueManual || pt.notes);
    rec.fedFrom = splitTags(rec.fedFrom).filter(t => t !== rec.tag).join(', ');
    rec.powerPanel = rec.powerPanel ? normPanel(rec.powerPanel) : '';
    rec.breaker = normBreaker(rec.breaker);
    rec.id = a.id || uid(); rec.projectId = pid; rec.createdAt = a.createdAt || nowISO();
    await Data.saveAsset(rec);
    const renamed = !isNew ? renameRefs(assets, rec.id, a.tag, rec.tag) : [];
    for (const x of renamed) await Data.saveAsset(x);
    for (const id of removed) await Data.deletePhoto(id);
    for (const b of staged) await Data.addPhoto(rec.id, b);
    await Data.saveProject(p);
    toast(renamed.length ? `${rec.tag} saved – updated ${plural(renamed.length, 'link')} from ${normTag(a.tag)}` : `${rec.tag} saved`, renamed.length ? 3500 : 2200);
    if (next) go(`/p/${encodeURIComponent(pid)}/a/new?from=${encodeURIComponent(rec.id)}&t=${Date.now()}`);
    else go(`/p/${encodeURIComponent(pid)}/a/${encodeURIComponent(rec.id)}`, isNew);
  }
  form.onsubmit = e => { e.preventDefault(); save(false); };
  $('#bSave').onclick = () => save(false);
  const sn = $('#bSaveNext'); if (sn) sn.onclick = () => save(true);
}

/* ---------------- Scanner ---------------- */
async function openScanner(pid, onResult) {
  let scanner = null, fileScanner = null, finished = false;
  const m = modal({title: onResult ? 'Scan tag' : 'Scan QR / barcode', body: `
    <div id="reader"></div>
    <p id="scanMsg" class="muted small" style="margin:8px 2px">Starting camera…</p>
    <div class="row" style="margin-top:4px"><label class="btn">${ICON.camera} Scan from photo<input type="file" accept="image/*" capture="environment" hidden id="scanFile"></label></div>
    <div id="readerFile" hidden></div>
    <div class="sep"></div>
    <form id="manualForm"><label class="lbl" for="manualTag">Or type the tag</label>
    <div style="display:flex;gap:8px"><input id="manualTag" class="tag-input" placeholder="e.g. VAV-2-14" autocapitalize="characters" autocomplete="off" spellcheck="false" enterkeyhint="go">
    <button class="btn primary" style="flex:0 0 auto">Go</button></div></form>`,
    onClose: () => stop()});
  const msg = t => { const el = $('#scanMsg', m.el); if (el) el.innerHTML = t; };
  async function stop() {
    if (scanner) { const s = scanner; scanner = null; try { if (s.isScanning) await s.stop(); s.clear(); } catch (e) {} }
  }
  async function finish(text) {
    if (finished || !text) return; finished = true;
    if (navigator.vibrate) navigator.vibrate(80);
    await stop(); m.close();
    if (onResult) onResult(text); else handleScan(text, pid);
  }
  $('#manualForm', m.el).onsubmit = e => { e.preventDefault(); const v = $('#manualTag', m.el).value.trim(); if (v) finish(v); };
  try { await loadScanner(); } catch (e) { msg('Scanner library failed to load. Type the tag below.'); return; }
  const F = window.Html5QrcodeSupportedFormats;
  const formats = F ? [F.QR_CODE, F.DATA_MATRIX, F.CODE_128, F.CODE_39, F.CODE_93, F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.ITF, F.CODABAR, F.PDF_417, F.AZTEC].filter(x => x !== undefined) : undefined;
  const cfg = {formatsToSupport: formats, verbose: false, experimentalFeatures: {useBarCodeDetectorIfSupported: true}};
  $('#scanFile', m.el).onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    msg('Reading code from photo…');
    try {
      await stop();
      fileScanner = fileScanner || new Html5Qrcode('readerFile', cfg);
      const text = await fileScanner.scanFile(file, false);
      finish(text);
    } catch (err) { msg('No QR code or barcode found in that photo. Try again closer and in focus, or type the tag.'); }
  };
  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $('#reader', m.el).hidden = true;
    msg('Live camera scanning needs the app to be opened over <b>https://</b>. Use <b>Scan from photo</b> or type the tag.');
    return;
  }
  try {
    scanner = new Html5Qrcode('reader', cfg);
    await scanner.start({facingMode: 'environment'}, {
      fps: 12, aspectRatio: 1.333,
      qrbox: (w, h) => ({width: Math.max(50, Math.floor(w * 0.85)), height: Math.max(50, Math.floor(Math.min(w, h) * 0.6))}),
    }, text => finish(text), () => {});
    if (finished || !m.el.open) return stop();
    msg('Point the camera at a QR code or barcode.');
  } catch (err) {
    console.warn('Camera start failed', err);
    const r = $('#reader', m.el); if (r) r.hidden = true; scanner = null;
    msg('Camera unavailable (' + esc(String(err && (err.message || err)).slice(0, 120)) + '). Allow camera access, or use <b>Scan from photo</b> / type the tag.');
  }
}
async function handleScan(raw, pid, fromRoute) {
  const tag = normTag(extractTag(raw));
  if (!tag) return fromRoute ? go('/', true) : undefined;
  const matches = await Data.findByTag(tag);
  const projects = await Data.projects(); const pName = id => (projects.find(p => p.id === id) || {}).name || 'Unknown project';
  const openA = a => go(`/p/${encodeURIComponent(a.projectId)}/a/${encodeURIComponent(a.id)}`, fromRoute);
  const createIn = id => go(`/p/${encodeURIComponent(id)}/a/new?tag=${encodeURIComponent(tag)}&scanned=1`, fromRoute);
  if (pid && projects.find(p => p.id === pid)) {
    const local = matches.find(a => a.projectId === pid);
    if (local) return openA(local);
    if (!matches.length) return createIn(pid);
    if (fromRoute) go(`/p/${encodeURIComponent(pid)}`, true);
    return modal({title: `Tag ${tag}`, body: `<p>Not in this project, but found in:</p>${matches.map(a => `<p>• <b>${esc(pName(a.projectId))}</b> (${esc(a.type || '—')})</p>`).join('')}`,
      actions: [{label: 'Open it', onClick: () => openA(matches[0])}, {label: 'Create here', cls: 'primary', onClick: () => createIn(pid)}]});
  }
  if (matches.length === 1) return openA(matches[0]);
  if (fromRoute) go('/', true);
  if (matches.length > 1) return modal({title: `Tag ${tag}`, body: `<p>Found in ${matches.length} projects:</p><div class="menu">${matches.map((a, i) => `<button class="btn" data-i="${i}">${esc(pName(a.projectId))}</button>`).join('')}</div>`,
    onOpen: d => d.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { d.close(); openA(matches[+b.dataset.i]); } })});
  if (!projects.length) return modal({title: `Tag ${tag}`, body: '<p>No asset with this tag yet. Create a project first, then scan again to add it.</p>', actions: [{label: 'New project', cls: 'primary', onClick: () => projectDialog()}]});
  modal({title: `New tag ${tag}`, body: `<p>No asset with this tag yet. Add it to which project?</p><div class="menu">${projects.sort((a, b) => natCmp(b.updatedAt, a.updatedAt)).map(p => `<button class="btn" data-p="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>`,
    onOpen: d => d.addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) { d.close(); createIn(b.dataset.p); } })});
}

/* ---------------- Labels ---------------- */
async function renderLabels(pid, q) {
  const p = await Data.project(pid); if (!p) return go('/', true);
  const all = await Data.assets(pid);
  let assets;
  if (q.get('ids')) { const ids = q.get('ids').split(','); assets = all.filter(a => ids.includes(a.id)); }
  else assets = q.get('filtered') ? applyFilter(all, getFilter(pid)) : all.slice().sort((a, b) => natCmp(a.tag, b.tag));
  const back = q.get('ids') && assets.length === 1 ? `/p/${encodeURIComponent(pid)}/a/${encodeURIComponent(assets[0].id)}` : `/p/${encodeURIComponent(pid)}`;
  setChrome('Print labels', back);
  const opt = JSON.parse(localStorage.getItem(LSK('at-label-opts')) || '{}');
  const o = {size: 'md', content: 'tag', project: true, location: true, border: true, ...opt};
  const canLink = /^https:/.test(location.protocol);
  if (!canLink && o.content === 'link') o.content = 'tag';
  const chk = (id, label) => `<label style="display:flex;gap:10px;align-items:center;min-height:44px"><input type="checkbox" id="${id}" style="width:24px;min-height:24px"> ${label}</label>`;
  view.innerHTML = `
    <div class="card no-print">
      <div class="grid2">
        <div class="field"><label>Label size</label><select id="lSize"><option value="sm">Small 2×1"</option><option value="md">Medium 3×1.5"</option><option value="lg">Large 4×2"</option></select></div>
        <div class="field"><label>QR contains</label><select id="lContent"><option value="tag">Tag ID only</option>${canLink ? '<option value="link">Link to this app</option>' : ''}</select></div>
      </div>
      ${chk('lProj', 'Show project name')}${chk('lLoc', 'Show location / area served')}${chk('lBorder', 'Print cut lines')}
      <p class="muted small">${assets.length} label${assets.length === 1 ? '' : 's'}${q.get('filtered') ? ' (matching the current list filters)' : ''}. "Tag ID only" works with any scanner${canLink ? '; "Link" lets a phone\'s normal camera open the asset in this app' : ''}. Print to a label printer or to letter paper and cut, or Save as PDF.</p>
      <button class="btn primary block" id="lPrint">${ICON.print} Print / Save as PDF</button>
    </div>
    <div class="labels" id="labels"></div>`;
  $('#lSize').value = o.size; $('#lContent').value = o.content; $('#lProj').checked = o.project; $('#lLoc').checked = o.location; $('#lBorder').checked = o.border;
  const appBase = location.href.split('#')[0];
  const draw = () => {
    Object.assign(o, {size: $('#lSize').value, content: $('#lContent').value, project: $('#lProj').checked, location: $('#lLoc').checked, border: $('#lBorder').checked});
    localStorage.setItem(LSK('at-label-opts'), JSON.stringify(o));
    $('#labels').innerHTML = assets.length ? assets.map(a => {
      const data = o.content === 'link' ? `${appBase}#/find?tag=${encodeURIComponent(a.tag)}` : a.tag;
      const loc = [locLine(a), a.areaServed && `Serves: ${a.areaServed}`].filter(Boolean).join(' · ');
      return `<div class="label ${o.size} ${o.border ? '' : 'noborder'}"><div class="qr">${qrSvg(data, o.content === 'link' ? 'L' : 'M')}</div><div class="txt">
        <div class="t1">${esc(a.tag)}</div><div class="t2">${esc(a.type || '')}</div>
        ${o.location && loc ? `<div class="t3">${esc(loc)}</div>` : ''}${o.project ? `<div class="t3">${esc(p.name)}</div>` : ''}</div></div>`;
    }).join('') : '<div class="empty">No assets to label.</div>';
  };
  draw();
  ['lSize','lContent','lProj','lLoc','lBorder'].forEach(id => $('#' + id).onchange = draw);
  $('#lPrint').onclick = () => window.print();
}

/* ---------------- Export / import ---------------- */
const EXPORT_FIELDS = FIELDS.filter(f => f.export !== false);
const HEADERS = ['Project', ...EXPORT_FIELDS.flatMap(f => f.key === 'fedFrom' ? [f.label, 'Feeds'] : [f.label]), 'Age', 'Remaining Life', 'Filters & Belts', 'Last Inspection', 'Last Inspection Result', 'Next Inspection Due', 'Open Deficiencies', 'Photos', 'Created', 'Last Updated'];
const partsSummary = a => assetParts(a).map(pt => `${pt.qty}x ${pt.kind} ${pt.size || '(size not set)'} (${freqLabel(pt.freq).toLowerCase()}, next due ${partNextDue(pt) || 'not set'})`).join('; ');
function assetRows(project, assets, pc, idx) {
  idx = idx || relIndex(assets);
  return assets.slice().sort((a, b) => natCmp(a.tag, b.tag)).map(a => {
    const r = {'Project': project.name};
    EXPORT_FIELDS.forEach(fl => { r[fl.label] = fl.key === 'status' ? (a.status || 'Not started') : (a[fl.key] || ''); });
    r['Feeds'] = idx.feeds(a.tag).map(x => x.tag).join(', ');
    const age = computeAge(a), rem = computeRemaining(a);
    r['Age'] = age != null ? age : '';
    r['Remaining Life'] = rem != null ? rem : '';
    r['Filters & Belts'] = partsSummary(a);
    const li = lastComplete(a); r['Last Inspection'] = li ? li.date : ''; r['Last Inspection Result'] = li ? inspResult(li) : ''; r['Next Inspection Due'] = inspNextDue(a); r['Open Deficiencies'] = openDeficiencies(a) || '';
    r['Photos'] = pc[a.id] || 0;
    r['Created'] = a.createdAt ? new Date(a.createdAt).toLocaleString() : '';
    r['Last Updated'] = a.updatedAt ? new Date(a.updatedAt).toLocaleString() : '';
    return r;
  });
}
async function buildExport(project, assets, fmt) {
  await loadXLSX();
  const pc = await photoCounts();
  let all = assets; try { if (project.id) { const x = await Data.assets(project.id); if (x.length) all = x; } } catch (e) {}
  const rows = assetRows(project, assets, pc, relIndex(all)); // "Feeds" always reflects the whole project
  const ws = XLSX.utils.json_to_sheet(rows, {header: HEADERS});
  ws['!cols'] = HEADERS.map(h => ({wch: Math.min(45, Math.max(h.length + 2, ...rows.map(r => String(r[h] ?? '').length + 1)))}));
  if (rows.length) ws['!autofilter'] = {ref: XLSX.utils.encode_range({s: {r: 0, c: 0}, e: {r: rows.length, c: HEADERS.length - 1}})};
  const name = `${slug(project.name)}_assets_${today()}`;
  const pRows = [];
  assets.slice().sort((a, b) => natCmp(a.tag, b.tag)).forEach(a => assetParts(a).forEach(pt => pRows.push(partRow(project, a, pt))));
  const wsP = XLSX.utils.json_to_sheet(pRows, {header: PART_LIST_HEADERS});
  wsP['!cols'] = autoCols(PART_LIST_HEADERS, pRows);
  if (pRows.length) wsP['!autofilter'] = {ref: XLSX.utils.encode_range({s: {r: 0, c: 0}, e: {r: pRows.length, c: PART_LIST_HEADERS.length - 1}})};
  if (fmt === 'parts-csv') {
    const csv = XLSX.utils.sheet_to_csv(wsP);
    return {blob: new Blob(['\ufeff' + csv], {type: 'text/csv;charset=utf-8'}), name: `${slug(project.name)}_filters-belts_${today()}.csv`};
  }
  if (fmt === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(ws);
    return {blob: new Blob(['\ufeff' + csv], {type: 'text/csv;charset=utf-8'}), name: name + '.csv'};
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Assets');
  XLSX.utils.book_append_sheet(wb, wsP, 'Parts');
  const sum = [['Project', project.name], ['Client / owner', project.client || ''], ['Address', project.address || ''], ['Exported', new Date().toLocaleString()], ['Total assets', assets.length], [], ['Status', 'Count']];
  STATUSES.forEach(s => sum.push([s, assets.filter(a => (a.status || 'Not started') === s).length]));
  sum.push([], ['Equipment type', 'Count']);
  TYPES.forEach(t => { const n = assets.filter(a => a.type === t).length; if (n) sum.push([t, n]); });
  sum.push([], ['Assets with Fed From set', assets.filter(a => fedList(a).length).length], ['Assets with a power panel', assets.filter(a => a.powerPanel).length], ['Power panels', panelsOf(assets).join(', ')]);
  sum.push([], ['Filter / belt line items', pRows.length], ['Overdue', pRows.filter(r => r['Due Status'] === 'Overdue').length], ['Due next month', pRows.filter(r => r['Due Status'] === 'Due next month').length]);
  { const ib = inspBuckets(assets), all = assets.flatMap(inspList);
    sum.push([], ['Inspections recorded', all.length], ['Completed', all.filter(i => i.status === 'complete').length], ['In progress (draft)', ib.draft.length], ['Open deficiencies', ib.defs.length], ['Inspections overdue', ib.overdue.length], ['Inspections due this month', ib.this.length]); }
  const ws2 = XLSX.utils.aoa_to_sheet(sum); ws2['!cols'] = [{wch: 22}, {wch: 40}];
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');
  const phc = {}; (await DB.all('photos')).forEach(ph => { if (ph.inspId) phc[ph.inspId + '|' + ph.itemId] = (phc[ph.inspId + '|' + ph.itemId] || 0) + 1; });
  const ir = inspRows(project, assets, phc);
  const wsI = XLSX.utils.json_to_sheet(ir.ins, {header: INSP_HEADERS}); wsI['!cols'] = autoCols(INSP_HEADERS, ir.ins);
  if (ir.ins.length) wsI['!autofilter'] = {ref: XLSX.utils.encode_range({s: {r: 0, c: 0}, e: {r: ir.ins.length, c: INSP_HEADERS.length - 1}})};
  const wsII = XLSX.utils.json_to_sheet(ir.items, {header: INSP_ITEM_HEADERS}); wsII['!cols'] = autoCols(INSP_ITEM_HEADERS, ir.items);
  if (ir.items.length) wsII['!autofilter'] = {ref: XLSX.utils.encode_range({s: {r: 0, c: 0}, e: {r: ir.items.length, c: INSP_ITEM_HEADERS.length - 1}})};
  XLSX.utils.book_append_sheet(wb, wsI, 'Inspections'); XLSX.utils.book_append_sheet(wb, wsII, 'Inspection Items');
  wb.Props = {Title: `${project.name} – Asset register`, Author: 'Asset Tagger'};
  const out = XLSX.write(wb, {bookType: 'xlsx', type: 'array', compression: true});
  return {blob: new Blob([out], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), name: name + '.xlsx'};
}
function exportDialog(project, all, filtered) {
  const share = canShareFiles();
  const hasFilter = filtered.length !== all.length;
  modal({title: 'Export assets', body: `
    ${hasFilter ? `<div class="field"><label>Which assets?</label><select id="exScope"><option value="all">All assets (${all.length})</option><option value="filtered">Current filtered list (${filtered.length})</option></select></div>` : `<p>${all.length} asset${all.length === 1 ? '' : 's'} in <b>${esc(project.name)}</b>.</p>`}
    <div class="field"><label>Format</label><select id="exFmt"><option value="xlsx">Excel (.xlsx) – all sheets</option><option value="csv">CSV (.csv) – assets</option><option value="parts-csv">CSV (.csv) – filters &amp; belts list</option></select></div>
    <p class="muted small">Excel sheets: Assets, Parts, Summary, Inspections and Inspection Items (one row per checklist item).</p>
    <p class="muted small">Photos aren't included in spreadsheets (a photo count is). Use Settings → Backup to keep photos.</p>`,
    actions: [
      ...(share ? [{label: 'Share…', onClick: d => doExport(d, true)}] : []),
      {label: 'Download', cls: 'primary', onClick: d => doExport(d, false)},
    ]});
  async function doExport(d, viaShare) {
    const scope = $('#exScope', d) ? $('#exScope', d).value : 'all';
    try {
      const {blob, name} = await buildExport(project, scope === 'filtered' ? filtered : all, $('#exFmt', d).value);
      await shareOrDownload(blob, name, viaShare); toast('Exported ' + name);
    } catch (e) { console.error(e); toast('Export failed: ' + e.message); }
  }
}
function mapHeaders(headers) {
  const map = {};
  headers.forEach(h => {
    const k = normKey(h);
    if (/^(remaining life|remaining|yrs remaining|years remaining)$/.test(k)) return; // computed on export
    const f = FIELDS.find(fl => normKey(fl.label) === k) || FIELDS.find(fl => fl.aliases.some(al => normKey(al) === k));
    if (f && !Object.values(map).includes(f.key)) map[h] = f.key;
  });
  return map;
}
async function parseImportFile(file) {
  await loadXLSX();
  const buf = await file.arrayBuffer();
  const wb = /\.csv$/i.test(file.name) || file.type === 'text/csv'
    ? XLSX.read(new TextDecoder().decode(buf), {type: 'string', raw: true})
    : XLSX.read(buf, {type: 'array', cellDates: true});
  const toRows = n => XLSX.utils.sheet_to_json(wb.Sheets[n], {defval: '', raw: true});
  const partsName = wb.SheetNames.find(n => /^(parts|filters|belts|maintenance parts)\b/i.test(n.trim()));
  const skip = n => n === partsName || /^(summary|order totals|by equipment|inspections|inspection items)$/i.test(n.trim());
  const assetName = wb.SheetNames.find(n => !skip(n) && /asset|equip|schedule/i.test(n)) || wb.SheetNames.find(n => !skip(n));
  let rows = assetName ? toRows(assetName) : [], parts = partsName ? toRows(partsName) : [];
  if (!partsName && rows.length && isPartsHeaders(Object.keys(rows[0]))) { parts = rows; rows = []; } // a parts-only list (e.g. Parts CSV)
  return {rows, parts};
}
const PART_IMPORT = {
  tag: ['asset tag', 'tag', 'asset id', 'equipment tag', 'unit tag', 'equipment id', 'unit', 'mark'],
  kind: ['part type', 'type', 'part', 'item type', 'kind', 'category', 'item'],
  size: ['size / part #', 'size/part #', 'size / part number', 'size', 'part #', 'part number', 'part no', 'filter size', 'belt size', 'description'],
  qty: ['qty', 'quantity', 'count'],
  freqMonths: ['frequency (months)', 'frequency months', 'months', 'interval (months)'],
  freqText: ['frequency', 'replacement frequency', 'interval', 'replace every'],
  lastReplaced: ['last replaced', 'last changed', 'last replaced date', 'replaced', 'last change'],
  nextDue: ['next due', 'next due date', 'due date', 'due'],
  notes: ['part notes', 'notes', 'note', 'comments'],
};
function mapPartHeaders(headers) {
  const m = {};
  Object.entries(PART_IMPORT).forEach(([k, al]) => { for (const x of al) { const h = headers.find(h => normKey(h) === normKey(x) && !Object.values(m).includes(h)); if (h) { m[k] = h; break; } } });
  return m;
}
const isPartsHeaders = headers => headers.map(normKey).some(k => ['part type', normKey('Size / Part #'), 'part #', 'part number'].includes(k));
function parseFreq(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v > 0 ? Math.round(v) : null;
  const s = String(v).toLowerCase().trim(); let m;
  if ((m = s.match(/(\d+)\s*(y|yr|yrs|year|years)\b/))) return +m[1] * 12;
  const f = FREQS.find(([, l]) => l.toLowerCase() === s); if (f) return f[0];
  if (/semi|twice a year|bi-?annual/.test(s)) return 6;
  if (/quarter/.test(s)) return 3;
  if (/bi-?month/.test(s)) return 2;
  if ((m = s.match(/(\d+)\s*(m|mo|mos|month|months)?\b/))) return +m[1];
  if (/annual|year/.test(s)) return 12;
  if (/month/.test(s)) return 1;
  return null;
}
/** Parts sheet rows → asset.parts. Each asset listed gets its filter/belt list replaced by the sheet's rows. */
function applyPartsImport(plan, partRows, existing) {
  const res = {items: 0, assets: 0, unknown: [], noTag: false, rows: (partRows || []).length};
  plan.parts = res;
  if (!partRows || !partRows.length) return res;
  const hm = mapPartHeaders(Object.keys(partRows[0]));
  if (!hm.tag) { res.noTag = true; return res; }
  const byTag = new Map();
  existing.forEach(a => byTag.set(normTag(a.tag), a));
  [...plan.update, ...plan.create].forEach(a => byTag.set(normTag(a.tag), a));
  const grouped = new Map();
  partRows.forEach(r => { const t = normTag(r[hm.tag]); if (!t) return; if (!grouped.has(t)) grouped.set(t, []); grouped.get(t).push(r); });
  grouped.forEach((rows, t) => {
    const a = byTag.get(t); if (!a) { res.unknown.push(t); return; }
    const g = (r, k) => hm[k] ? r[hm[k]] : '';
    const list = rows.map(r => {
      const size = String(g(r, 'size') ?? '').trim();
      const last = toISODate(g(r, 'lastReplaced')) || '';
      return normPart({kind: normKind(g(r, 'kind')) || (/^(a|b|c|ax|bx|cx|3l|4l|5l)\d{2,3}$/i.test(size) ? 'Belt' : 'Filter'), size,
        qty: g(r, 'qty'), freq: parseFreq(g(r, 'freqMonths')) || parseFreq(g(r, 'freqText')), lastReplaced: last,
        dueManual: last ? '' : (toISODate(g(r, 'nextDue')) || ''), notes: String(g(r, 'notes') ?? '').trim()});
    }).filter(pt => pt.size || pt.lastReplaced || pt.dueManual);
    a.parts = list; res.items += list.length; res.assets++;
    if (!plan.create.includes(a) && !plan.update.includes(a)) plan.update.push(a);
  });
  return res;
}
function planImport(rows, existing, pid) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const hmap = mapHeaders(headers);
  const byTag = new Map(existing.map(a => [normTag(a.tag), a]));
  const plan = {create: [], update: [], skipped: 0, hmap, unmapped: headers.filter(h => !hmap[h] && !/^(project|photos|created|last updated|remaining life|remaining|filters & belts|feeds|last inspection|last inspection result|next inspection due|open deficiencies)$/i.test(h.trim()))};
  const seen = new Map();
  rows.forEach(row => {
    const rec = {};
    Object.entries(hmap).forEach(([h, key]) => { const v = row[h]; rec[key] = v instanceof Date ? v : String(v ?? '').trim(); });
    rec.tag = normTag(rec.tag);
    if (!rec.tag) { plan.skipped++; return; }
    const extra = [];
    if ('type' in rec) { const t = normalizeType(rec.type); if (t === null) { extra.push(`Type: ${rec.type}`); rec.type = 'Other'; } else rec.type = t; }
    if ('status' in rec) rec.status = normalizeStatus(rec.status);
    if ('fedFrom' in rec) rec.fedFrom = splitTags(rec.fedFrom).filter(t => t !== rec.tag).join(', ');
    if ('powerPanel' in rec) rec.powerPanel = rec.powerPanel ? normPanel(rec.powerPanel) : '';
    if ('breaker' in rec) rec.breaker = normBreaker(rec.breaker instanceof Date ? '' : rec.breaker);
    if ('installDate' in rec) { const d = toISODate(rec.installDate); if (d === null) { extra.push(`Install date: ${rec.installDate}`); rec.installDate = ''; } else rec.installDate = d; }
    if ('installYear' in rec) {
      const y = parseYear(rec.installYear);
      if (rec.installYear !== '' && y == null) { extra.push(`Install year: ${rec.installYear}`); delete rec.installYear; }
      else if (y != null) rec.installYear = String(y);
    }
    if (!rec.installYear && rec.installDate) { const y = parseYear(rec.installDate); if (y != null) rec.installYear = String(y); }
    if ('lifeExpectancy' in rec && rec.lifeExpectancy !== '') {
      const n = Number(String(rec.lifeExpectancy).replace(/[^0-9.]/g, ''));
      if (!isFinite(n) || n < 1) { extra.push(`Life expectancy: ${rec.lifeExpectancy}`); delete rec.lifeExpectancy; }
      else rec.lifeExpectancy = String(Math.round(n));
    }
    if ('ageOverride' in rec && rec.ageOverride !== '') {
      // Imported "Age" becomes a manual override only when no install year/date is present;
      // otherwise prefer calculated age from year/date and drop the override.
      const n = Number(String(rec.ageOverride).replace(/[^0-9.]/g, ''));
      if (!isFinite(n) || n < 0) { delete rec.ageOverride; }
      else if (rec.installYear || rec.installDate) { delete rec.ageOverride; }
      else rec.ageOverride = String(Math.round(n));
    }
    if (!rec.lifeExpectancy && rec.type) rec.lifeExpectancy = String(defaultLife(rec.type));
    if (extra.length) rec.notes = [rec.notes, ...extra].filter(Boolean).join('\n');
    Object.keys(rec).forEach(k => { if (rec[k] === '') delete rec[k]; });
    const cur = seen.get(rec.tag) || byTag.get(rec.tag);
    if (cur) {
      Object.assign(cur, rec);
      if (!cur.type) cur.type = guessTypeFromTag(cur.tag);
      if (!plan.update.includes(cur) && !plan.create.includes(cur)) plan.update.push(cur);
      seen.set(rec.tag, cur);
    } else {
      const a = {id: uid(), projectId: pid, status: 'Not started', createdAt: nowISO(), ...rec};
      if (!a.type) a.type = guessTypeFromTag(a.tag);
      plan.create.push(a); seen.set(rec.tag, a);
    }
  });
  return plan;
}
function importDialog(project, existing) {
  modal({title: 'Import assets', body: `
    <p>Import an equipment list from <b>Excel (.xlsx)</b> or <b>CSV</b>. The first row must be column headers, e.g. <i>Tag, Type, Manufacturer, Model, Serial, Building, Floor, Room, Area Served, Fed From, Controlled By, Power Panel, Breaker/Circuit, Voltage/Phase, Disconnect Location, Status</i>. Column names are matched loosely.</p>
    <p class="muted small">Rows whose tag already exists in this project update that asset (blank cells don't overwrite). New tags are added. A <b>Parts</b> sheet (Asset Tag, Part Type, Size / Part #, Qty, Frequency, Last Replaced, Next Due) imports filters &amp; belts and replaces the filter/belt list of each asset it lists.</p>
    <label class="btn primary block">Choose file…<input type="file" id="impFile" hidden accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></label>
    <div class="row"><button class="btn sm" id="tplBtn">Download blank template</button></div>
    <div id="impResult"></div>`,
    onOpen: d => {
      $('#tplBtn', d).onclick = async () => {
        await loadXLSX();
        const cols = EXPORT_FIELDS.map(f => f.label);
        const ex1 = {tag: 'AHU-1', type: 'AHU', manufacturer: 'Trane', model: 'CSAA012', serial: 'K12345678', capacity: '8,000 CFM', building: 'Main', floor: '1', room: 'Mech 101', areaServed: 'East wing',
          controlledBy: 'DDC panel NAE-1', powerPanel: '2A3', breaker: '14,16,18', voltage: '480V/3ph', disconnect: 'At unit', installYear: '2010', installDate: today(), lifeExpectancy: '25', status: 'Installed'};
        const ex2 = {tag: 'VAV-1-1', type: 'VAV', manufacturer: 'Price', model: 'SDV', building: 'Main', floor: '1', room: 'Rm 110', fedFrom: 'AHU-1', controlledBy: 'VAV-1-1 DDC', powerPanel: '2A3', breaker: '20', voltage: '120V/1ph', lifeExpectancy: '20', status: 'Not started'};
        const ws = XLSX.utils.aoa_to_sheet([cols, ...[ex1, ex2].map(x => EXPORT_FIELDS.map(f => x[f.key] || ''))]);
        ws['!cols'] = cols.map(h => ({wch: Math.max(14, h.length + 2)}));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Assets');
        const pCols = ['Asset Tag', 'Part Type', 'Size / Part #', 'Qty', 'Frequency', 'Last Replaced', 'Next Due', 'Part Notes'];
        const wsP = XLSX.utils.aoa_to_sheet([pCols, ['AHU-1', 'Filter', '20x25x2 MERV 13', 6, 'Quarterly', today(), '', 'Pre-filter bank'], ['AHU-1', 'Belt', 'BX55', 2, 'Semi-annual', today(), '', '']]);
        wsP['!cols'] = pCols.map(h => ({wch: Math.max(14, h.length + 2)})); XLSX.utils.book_append_sheet(wb, wsP, 'Parts');
        downloadBlob(new Blob([XLSX.write(wb, {bookType: 'xlsx', type: 'array'})], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), 'asset_import_template.xlsx');
      };
      $('#impFile', d).onchange = async e => {
        const file = e.target.files[0]; if (!file) return;
        const out = $('#impResult', d); out.innerHTML = '<p>Reading…</p>';
        try {
          const {rows, parts} = await parseImportFile(file);
          const ex = existing.map(a => ({...a}));
          const plan = planImport(rows, ex, project.id);
          const pr = applyPartsImport(plan, parts, ex);
          if (!rows.length && !parts.length) { out.innerHTML = '<div class="notice warn">No rows found in that file.</div>'; return; }
          if (rows.length && !Object.values(plan.hmap).includes('tag')) { out.innerHTML = `<div class="notice warn">Couldn't find a Tag / Asset ID column. Found: ${esc(Object.keys(rows[0] || {}).join(', ') || 'no columns')}</div>`; return; }
          out.innerHTML = `<div class="notice">${rows.length ? `<b>${rows.length}</b> asset rows` : `<b>${parts.length}</b> filter/belt rows`} read from ${esc(file.name)}<br>
            ➕ <b>${plan.create.length}</b> new assets<br>✏️ <b>${plan.update.length}</b> existing assets updated<br>${plan.skipped ? `⚠️ ${plan.skipped} rows skipped (no tag)<br>` : ''}
            ${pr.rows ? `🔧 <b>${pr.items}</b> filter/belt items for ${pr.assets} asset${pr.assets === 1 ? '' : 's'}<br>` : ''}
            ${pr.noTag ? '⚠️ Parts sheet has no Asset Tag column – skipped<br>' : ''}${pr.unknown.length ? `⚠️ Parts for unknown tags skipped: ${esc(pr.unknown.slice(0, 10).join(', '))}${pr.unknown.length > 10 ? '…' : ''}<br>` : ''}
            ${rows.length ? `<span class="small">Columns used: ${esc(Object.entries(plan.hmap).map(([h, k]) => `${h} → ${FIELDS.find(f => f.key === k).label}`).join(', '))}</span>` : ''}
            ${plan.unmapped.length ? `<br><span class="small">Ignored columns: ${esc(plan.unmapped.join(', '))}</span>` : ''}</div>
            <button class="btn primary block" id="impApply" ${plan.create.length + plan.update.length ? '' : 'disabled'}>Import ${plan.create.length + plan.update.length} assets</button>`;
          $('#impApply', d).onclick = async () => {
            const recs = [...plan.create, ...plan.update].map(a => ({...a, updatedAt: nowISO()}));
            await DB.put('assets', ...recs); await Data.saveProject(project);
            d.close(); toast(`Imported: ${plan.create.length} new, ${plan.update.length} updated`); route();
          };
        } catch (err) { console.error(err); out.innerHTML = `<div class="notice warn">Couldn't read that file: ${esc(err.message)}</div>`; }
      };
    }});
}

/* ---------------- Settings / backup ---------------- */
async function renderSettings() {
  setChrome('Settings & backup', '/');
  const [projects, assets, photos] = await Promise.all([Data.projects(), Data.allAssets(), DB.all('photos')]);
  let est = ''; try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); est = `${(e.usage / 1048576).toFixed(1)} MB used of ~${(e.quota / 1073741824).toFixed(1)} GB available`; } } catch (e) {}
  let persisted = false; try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false; } catch (e) {}
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  view.innerHTML = `
    <div class="card"><div class="lbl">On this device</div>
      <p style="margin:4px 0">${projects.length} projects · ${assets.length} assets · ${assets.reduce((n, a) => n + inspList(a).length, 0)} inspections · ${photos.length} photos</p>
      <p class="muted small" style="margin:4px 0">${esc(est)}${est ? '<br>' : ''}Storage protection: <b>${persisted ? 'on (browser won\'t auto-clear)' : 'not granted yet'}</b></p>
      ${persisted ? '' : '<button class="btn sm" id="persistBtn">Request storage protection</button>'}</div>
    <div class="card"><div class="lbl">Inspection checklists</div>
      <p class="small" style="margin:4px 0 10px">Task lists per equipment type (AHU, chiller, pump…): add, remove or reorder items, mark required / optional, ask for readings, and set the default interval.</p>
      <a class="btn block" id="setChk" href="#/settings/checklists">✅ Edit inspection checklists</a></div>
    <div class="card"><div class="lbl">Backup (includes photos)</div>
      <p class="small">Saves everything to one <b>.json</b> file you can keep in email / Drive / OneDrive and restore on any device. Do this at the end of each site visit.</p>
      <div class="row">${canShareFiles() ? '<button class="btn" id="bkShare">Share backup…</button>' : ''}<button class="btn primary" id="bkDl">Download backup</button></div>
      <div class="sep"></div>
      <div class="lbl">Restore</div><p class="small">Merges a backup file into this device (records with the same ID are replaced).</p>
      <label class="btn block">Restore from backup file…<input type="file" accept=".json,application/json" hidden id="bkFile"></label></div>
    <div class="card"><div class="lbl">Install on your phone</div>
      ${standalone ? '<p>✅ Running as an installed app.</p>' : `<p class="small"><b>iPhone (Safari):</b> Share button → <i>Add to Home Screen</i>.<br><b>Android (Chrome):</b> ⋮ menu → <i>Install app</i> / <i>Add to Home screen</i>.</p>`}
      <p class="small muted">Once installed it opens full-screen and works with no signal. Live camera scanning requires the app to be served over https.</p></div>
    <div class="card"><div class="lbl">Danger zone</div><button class="btn danger block" id="wipe">Delete ALL data on this device</button></div>
    <p class="muted small" style="text-align:center">Asset Tagger v${APP_VERSION}</p>`;
  const pb = $('#persistBtn'); if (pb) pb.onclick = async () => { const ok = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; toast(ok ? 'Storage protection on' : 'Browser declined — install to home screen and try again'); route(); };
  const doBackup = async share => {
    toast('Preparing backup…');
    const out = {app: 'asset-tagger', version: 1, appVersion: APP_VERSION, exportedAt: nowISO(), projects, assets, photos: [],
      settings: {inspTemplates: loadTplStore(), inspector: localStorage.getItem(LSK('at-inspector')) || ''}};
    for (const ph of photos) out.photos.push({id: ph.id, assetId: ph.assetId, createdAt: ph.createdAt, type: ph.type, ...(ph.inspId ? {inspId: ph.inspId, itemId: ph.itemId} : {}), data: await blobToDataURL(ph.blob)});
    await shareOrDownload(new Blob([JSON.stringify(out)], {type: 'application/json'}), `asset-tagger-backup_${today()}.json`, share);
  };
  $('#bkDl').onclick = () => doBackup(false);
  const bs = $('#bkShare'); if (bs) bs.onclick = () => doBackup(true);
  $('#bkFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'asset-tagger') throw new Error('Not an Asset Tagger backup file');
      if (!await confirmBox('Restore backup?', `${data.projects.length} projects, ${data.assets.length} assets, ${data.photos.length} photos from ${esc(new Date(data.exportedAt).toLocaleString())}.`, 'Restore')) return;
      if (data.projects.length) await DB.put('projects', ...data.projects);
      if (data.assets.length) await DB.put('assets', ...data.assets);
      for (const ph of data.photos) await DB.put('photos', {id: ph.id, assetId: ph.assetId, createdAt: ph.createdAt, type: ph.type, ...(ph.inspId ? {inspId: ph.inspId, itemId: ph.itemId} : {}), blob: await dataURLToBlob(ph.data)});
      const st = data.settings || {};
      if (st.inspTemplates && typeof st.inspTemplates === 'object') saveTplStore({...loadTplStore(), ...st.inspTemplates});
      if (st.inspector && !localStorage.getItem(LSK('at-inspector'))) localStorage.setItem(LSK('at-inspector'), st.inspector);
      toast('Backup restored'); route();
    } catch (err) { toast('Restore failed: ' + err.message, 4000); }
  };
  $('#wipe').onclick = async () => {
    if (await confirmBox('Delete everything?', 'All projects, assets and photos on this device will be permanently deleted. Make a backup first!', 'Delete all', true)) { await DB.clear(); toast('All data deleted'); go('/'); }
  };
}

/* ---------------- Demo mode: sample data ---------------- */
// Dates are built relative to today so "due next month", "overdue" and equipment ages always look right.
function demoData() {
  const Y = new Date().getFullYear(), t = today();
  const dueIn = (offset, freq, day) => { const d = addMonths(t.slice(0, 8) + String(day).padStart(2, '0'), offset); return addMonths(d, -freq); }; // lastReplaced so next due lands `offset` months from now
  const P1 = 'demo-mob', P2 = 'demo-school';
  const stamp = (m) => new Date(Date.now() - m * 60000).toISOString();
  const projects = [
    {id: P1, name: 'Sample Medical Office Building', client: 'Sample Health Partners (demo)', address: '100 Example Way, Anytown, USA',
      partsEmails: 'orders@example.com', notes: 'Fictional sample project for the Asset Tagger demo. Makes, models and serial numbers are made up.', createdAt: stamp(9000), updatedAt: stamp(1)},
    {id: P2, name: 'Sample Elementary School – RTU Replacement', client: 'Sample School District (demo)', address: '200 Demo Street, Anytown, USA',
      partsEmails: 'facilities@example.com', notes: 'Fictional sample project.', createdAt: stamp(20000), updatedAt: stamp(600)},
  ];
  const assets = []; let n = 0;
  const A = (pid, o) => { n++; assets.push({id: `demo-${pid === P1 ? 'm' : 's'}-${normTag(o.tag).toLowerCase()}`, projectId: pid, type: guessTypeFromTag(o.tag) || 'Other',
    manufacturer: '', model: '', serial: '', capacity: '', building: '', floor: '', room: '', areaServed: '', fedFrom: '', controlledBy: '', powerPanel: '', breaker: '', voltage: '', disconnect: '',
    installDate: '', ageOverride: '', status: 'Not started', notes: '', parts: [], createdAt: stamp(8000 - n * 30), updatedAt: stamp(500 - n * 10), ...o,
    lifeExpectancy: o.lifeExpectancy ?? defaultLife(o.type || guessTypeFromTag(o.tag) || 'Other')}); };
  const F = (size, qty, freq, offset, day, notes) => normPart({kind: 'Filter', size, qty, freq, lastReplaced: dueIn(offset, freq, day), notes: notes || ''});
  const B = (size, qty, freq, offset, day, notes) => normPart({kind: 'Belt', size, qty, freq, lastReplaced: dueIn(offset, freq, day), notes: notes || ''});
  const plant = {building: 'MOB', floor: 'B', room: 'Central Plant B-01'};
  // Chiller plant
  A(P1, {tag: 'CH-1', manufacturer: 'Northstar Chillers (sample)', model: 'NSC-300W', serial: 'DEMO-CH1-04417', capacity: '300 tons', ...plant, areaServed: 'Building chilled water',
    controlledBy: 'BAS plant controller PC-1', powerPanel: 'MDP', breaker: '3', voltage: '480V/3ph', disconnect: 'Unit-mounted, Central Plant', installYear: String(Y - 21), status: 'Commissioned',
    notes: 'Lead chiller. Functional test passed; staging verified with CH-2.'});
  A(P1, {tag: 'CH-2', manufacturer: 'Northstar Chillers (sample)', model: 'NSC-300W', serial: 'DEMO-CH2-03981', capacity: '300 tons', ...plant, areaServed: 'Building chilled water',
    controlledBy: 'BAS plant controller PC-1', powerPanel: 'MDP', breaker: '4', voltage: '480V/3ph', disconnect: 'Unit-mounted, Central Plant', installYear: String(Y - 26), status: 'Issue',
    notes: 'ISSUE: high condenser pressure trip on compressor 2 during startup. Service tech scheduled. Unit is past its expected service life – budget for replacement.'});
  A(P1, {tag: 'CT-1', manufacturer: 'Bluewater Towers (sample)', model: 'BWT-2C-900', serial: 'DEMO-CT1-11872', capacity: '900 GPM, 2-cell', building: 'MOB', floor: 'Roof', room: 'Roof – north', areaServed: 'Condenser water',
    controlledBy: 'BAS plant controller PC-1', powerPanel: 'MDP', breaker: '7', voltage: '480V/3ph', disconnect: 'Roof, at each cell', installYear: String(Y - 21), status: 'Started up',
    parts: [B('B-75 (fan belt)', 2, 6, 1, 8, 'One per cell')], notes: 'Basin heater checked. Vibration switch reset tested.'});
  A(P1, {tag: 'CHWP-1', manufacturer: 'Keystone Pump Co. (sample)', model: 'KP-4x3-10', serial: 'DEMO-P1-55021', capacity: '600 GPM @ 80 ft, 20 HP', ...plant, areaServed: 'Chilled water loop',
    fedFrom: 'CH-1', controlledBy: 'VFD-CHWP-1 / BAS', powerPanel: '4HA', breaker: '1,3,5', voltage: '480V/3ph', disconnect: 'VFD, Central Plant', installYear: String(Y - 12), status: 'Commissioned'});
  A(P1, {tag: 'CHWP-2', manufacturer: 'Keystone Pump Co. (sample)', model: 'KP-4x3-10', serial: 'DEMO-P2-55022', capacity: '600 GPM @ 80 ft, 20 HP', ...plant, areaServed: 'Chilled water loop',
    fedFrom: 'CH-2', controlledBy: 'VFD-CHWP-2 / BAS', powerPanel: '4HA', breaker: '2,4,6', voltage: '480V/3ph', disconnect: 'VFD, Central Plant', installYear: String(Y - 12), status: 'Commissioned'});
  A(P1, {tag: 'CWP-1', manufacturer: 'Keystone Pump Co. (sample)', model: 'KP-5x4-10', serial: 'DEMO-P3-55023', capacity: '900 GPM @ 60 ft, 25 HP', ...plant, areaServed: 'Condenser water – CH-1',
    fedFrom: 'CT-1', controlledBy: 'BAS plant controller PC-1', powerPanel: '4HA', breaker: '7,9,11', voltage: '480V/3ph', disconnect: 'Wall, Central Plant', installYear: String(Y - 12), status: 'Commissioned'});
  A(P1, {tag: 'CWP-2', manufacturer: 'Keystone Pump Co. (sample)', model: 'KP-5x4-10', serial: 'DEMO-P4-55024', capacity: '900 GPM @ 60 ft, 25 HP', ...plant, areaServed: 'Condenser water – CH-2',
    fedFrom: 'CT-1', controlledBy: 'BAS plant controller PC-1', powerPanel: '4HA', breaker: '8,10,12', voltage: '480V/3ph', disconnect: 'Wall, Central Plant', installYear: String(Y - 12), status: 'Commissioned'});
  A(P1, {tag: 'B-1', manufacturer: 'Ridgeline Boiler Works (sample)', model: 'RB-2000C', serial: 'DEMO-B1-77310', capacity: '2,000 MBH condensing', ...plant, areaServed: 'Heating hot water',
    controlledBy: 'Boiler controller / BAS', powerPanel: '2A3', breaker: '21', voltage: '120V/1ph', disconnect: 'Wall switch by boiler', installYear: String(Y - 8), status: 'Commissioned'});
  A(P1, {tag: 'HWP-1', manufacturer: 'Keystone Pump Co. (sample)', model: 'KP-3x2-8', serial: 'DEMO-P5-55025', capacity: '200 GPM @ 50 ft, 7.5 HP', ...plant, areaServed: 'Heating hot water loop',
    fedFrom: 'B-1', controlledBy: 'VFD-HWP-1 / BAS', powerPanel: '4HA', breaker: '13,15,17', voltage: '480V/3ph', disconnect: 'VFD, Central Plant', installYear: String(Y - 19), status: 'Commissioned'});
  // Air side
  const ahu = (i, o) => A(P1, {tag: `AHU-${i}`, manufacturer: 'Summit Air Systems (sample)', model: `SAS-${i === 3 ? '120' : '160'}`, serial: `DEMO-AHU${i}-2${i}904`,
    capacity: i === 3 ? '12,000 CFM' : '16,000 CFM', building: 'MOB', floor: 'Roof', room: `Mech Penthouse ${i}`, areaServed: `Floor ${i}`, fedFrom: i === 3 ? 'CHWP-2' : 'CHWP-1',
    controlledBy: `BAS controller NAE-${i}`, powerPanel: '4HA', voltage: '480V/3ph',
    disconnect: `Unit-mounted, Penthouse ${i}`, ...o});
  ahu(1, {breaker: '19,21,23', installYear: String(Y - 6), status: 'Commissioned', parts: [F('24x24x2 MERV 8', 8, 3, 1, 5, 'Pre-filters'), F('24x24x12 MERV 14', 8, 12, 5, 5, 'Final filters'), B('BX-62', 2, 6, 3, 5)]});
  ahu(2, {breaker: '25,27,29', installYear: String(Y - 6), status: 'Started up', parts: [F('24x24x2 MERV 8', 8, 3, 1, 12, 'Pre-filters'), F('24x24x12 MERV 14', 8, 12, 7, 12, 'Final filters'), B('BX-62', 2, 6, 1, 12)],
    notes: 'Economizer damper stroke verified. Awaiting TAB report.'});
  ahu(3, {breaker: '31,33,35', installYear: String(Y - 23), status: 'Installed', parts: [F('20x24x2 MERV 8', 6, 3, -1, 15, 'Pre-filters'), F('20x24x12 MERV 14', 6, 12, 4, 15, 'Final filters'), B('BX-55', 2, 6, 2, 15)],
    notes: 'Existing unit, re-used. Pre-filters overdue – loaded at last walk-through.'});
  // VAVs – 5 per floor, fed from that floor's AHU
  const vavSt = {1: ['Commissioned', 'Commissioned', 'Commissioned', 'Commissioned', 'Commissioned'], 2: ['Started up', 'Started up', 'Started up', 'Issue', 'Started up'], 3: ['Installed', 'Installed', 'Installed', 'Not started', 'Not started']};
  const rooms = ['Exam suite A', 'Exam suite B', 'Waiting / reception', 'Offices – east', 'Conference'];
  for (let f = 1; f <= 3; f++) for (let k = 1; k <= 5; k++) {
    const st = vavSt[f][k - 1];
    A(P1, {tag: `VAV-${f}-${k}`, manufacturer: 'AirLogic Terminals (sample)', model: k === 3 ? 'ALT-SD-10 w/ HW reheat' : 'ALT-SD-8 w/ HW reheat', serial: `DEMO-V${f}${k}-${3100 + f * 10 + k}`,
      capacity: k === 3 ? '1,100 CFM' : '650 CFM', building: 'MOB', floor: String(f), room: `Rm ${f}${String(k * 2).padStart(2, '0')}`, areaServed: rooms[k - 1],
      fedFrom: `AHU-${f}`, controlledBy: `VAV controller (BAS NAE-${f})`, powerPanel: '2A3', breaker: String(1 + (f - 1) * 2 + (k > 3 ? 1 : 0)),
      voltage: '120V/1ph', disconnect: 'Toggle at controller', installYear: String(f === 3 ? Y - 23 : Y - 6), status: st,
      notes: st === 'Issue' ? 'ISSUE: damper actuator not responding to BAS command. Controls contractor notified.' : ''});
  }
  A(P1, {tag: 'EF-1', type: 'Exhaust Fan', manufacturer: 'Ventex Fans (sample)', model: 'VX-18B', serial: 'DEMO-EF1-6620', capacity: '2,400 CFM, 1 HP', building: 'MOB', floor: 'Roof', room: 'Roof – east', areaServed: 'Toilet exhaust',
    fedFrom: '', controlledBy: 'Interlocked with AHU-1', powerPanel: '2A3', breaker: '13,15', voltage: '208V/1ph', disconnect: 'At fan curb', installYear: String(Y - 17), status: 'Commissioned', parts: [B('A-42', 1, 6, 1, 20)]});
  A(P1, {tag: 'EF-2', type: 'Exhaust Fan', manufacturer: 'Ventex Fans (sample)', model: 'VX-12D', serial: 'DEMO-EF2-6621', capacity: '800 CFM, 1/4 HP', building: 'MOB', floor: 'Roof', room: 'Roof – west', areaServed: 'Lab / soiled utility',
    controlledBy: 'BAS schedule', powerPanel: '2A3', breaker: '17', voltage: '120V/1ph', disconnect: 'At fan curb', installYear: String(Y - 6), status: 'Installed'});
  A(P1, {tag: 'EF-3', type: 'Exhaust Fan', manufacturer: 'Ventex Fans (sample)', model: 'VX-16B', serial: 'DEMO-EF3-5180', capacity: '1,800 CFM, 3/4 HP', building: 'MOB', floor: 'B', room: 'Central Plant B-01', areaServed: 'Mechanical room ventilation',
    controlledBy: 'Thermostat in plant', powerPanel: '2A3', breaker: '23,25', voltage: '208V/1ph', disconnect: 'Wall, Central Plant', installYear: String(Y - 22), status: 'Not started', parts: [B('A-38', 1, 6, 4, 20)]});
  A(P1, {tag: 'RTU-1', manufacturer: 'Horizon Rooftop (sample)', model: 'HR-10G', serial: 'DEMO-RTU1-9045', capacity: '10 tons, gas heat', building: 'MOB', floor: 'Roof', room: 'Roof – over lobby', areaServed: 'Main lobby',
    controlledBy: 'Standalone thermostat', powerPanel: '4HA', breaker: '37,39,41', voltage: '460V/3ph', disconnect: 'Unit-mounted', installYear: String(Y - 16), status: 'Started up',
    parts: [F('20x25x2 MERV 13', 4, 3, 1, 10), B('A-48', 1, 6, 3, 10)]});
  // Second, smaller sample project
  for (let i = 1; i <= 4; i++) A(P2, {tag: `RTU-${i}`, manufacturer: 'Horizon Rooftop (sample)', model: i < 3 ? 'HR-7G' : 'HR-12G', serial: `DEMO-S-RTU${i}-81${i}0`, capacity: i < 3 ? '7.5 tons, gas heat' : '12.5 tons, gas heat',
    building: 'Main', floor: 'Roof', room: `Roof – wing ${'ABCD'[i - 1]}`, areaServed: ['Classrooms 101-108', 'Classrooms 109-116', 'Gymnasium', 'Cafeteria / kitchen'][i - 1],
    powerPanel: 'RP-1', breaker: `${i * 6 - 5},${i * 6 - 3},${i * 6 - 1}`, voltage: '208V/3ph', disconnect: 'Unit-mounted', installYear: String(Y - 1), status: i === 4 ? 'Started up' : 'Commissioned',
    parts: [F(i < 3 ? '16x25x2 MERV 13' : '20x25x2 MERV 13', 4, 3, 3, 1)]});
  A(P2, {tag: 'EF-1', type: 'Exhaust Fan', manufacturer: 'Ventex Fans (sample)', model: 'VX-14K', serial: 'DEMO-S-EF1-3301', capacity: '1,200 CFM', building: 'Main', floor: 'Roof', room: 'Roof – kitchen', areaServed: 'Kitchen hood',
    fedFrom: '', controlledBy: 'Hood control panel', powerPanel: 'RP-1', breaker: '25,27', voltage: '208V/1ph', disconnect: 'At fan', installYear: String(Y - 1), status: 'Installed'});
  demoInspections(assets, t);
  return {projects, assets};
}
function demoNameplate(a) {
  // Draws an obviously-sample "nameplate photo" so the photo strip isn't empty. No network needed.
  return new Promise(res => {
    try {
      const c = document.createElement('canvas'); c.width = 960; c.height = 600; const g = c.getContext('2d');
      const bg = g.createLinearGradient(0, 0, 960, 600); bg.addColorStop(0, '#5b6670'); bg.addColorStop(1, '#2f373e'); g.fillStyle = bg; g.fillRect(0, 0, 960, 600);
      const pl = g.createLinearGradient(0, 80, 0, 520); pl.addColorStop(0, '#e9edf0'); pl.addColorStop(.5, '#cfd6db'); pl.addColorStop(1, '#e2e7ea');
      g.save(); g.translate(480, 300); g.rotate(-0.035); g.fillStyle = pl; g.fillRect(-380, -220, 760, 440); g.strokeStyle = '#8b959c'; g.lineWidth = 6; g.strokeRect(-380, -220, 760, 440);
      g.fillStyle = '#9aa3a9'; [[-355, -195], [355, -195], [-355, 195], [355, 195]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill(); });
      g.fillStyle = '#1d2a36'; g.font = 'bold 40px Arial, sans-serif'; g.textAlign = 'center'; g.fillText(String(a.manufacturer || '').replace(' (sample)', '').toUpperCase(), 0, -150);
      g.font = 'bold 22px Arial, sans-serif'; g.fillStyle = '#b3261e'; g.fillText('SAMPLE NAMEPLATE – DEMO DATA', 0, -112);
      g.textAlign = 'left'; g.fillStyle = '#1d2a36'; g.font = '26px "Courier New", monospace';
      [['MODEL', a.model], ['SERIAL', a.serial], ['CAPACITY', a.capacity], ['VOLTAGE', a.voltage], ['MFG YEAR', a.installYear], ['TAG', a.tag]].forEach(([k, v], i) => {
        g.font = 'bold 24px Arial, sans-serif'; g.fillText(k, -330, -55 + i * 46); g.font = '28px "Courier New", monospace'; g.fillText(String(v || ''), -130, -55 + i * 46);
        g.strokeStyle = '#a7b0b6'; g.lineWidth = 1; g.beginPath(); g.moveTo(-140, -45 + i * 46); g.lineTo(330, -45 + i * 46); g.stroke(); });
      g.restore();
      c.toBlob(b => res(b), 'image/jpeg', 0.8);
    } catch (e) { res(null); }
  });
}
async function seedDemo() {
  const {projects, assets} = demoData();
  await DB.put('projects', ...projects); await DB.put('assets', ...assets);
  for (const tag of ['CH-1', 'AHU-1', 'RTU-1']) {
    const a = assets.find(x => x.projectId === 'demo-mob' && x.tag === tag); const b = a && await demoNameplate(a);
    if (b) await Data.addPhoto(a.id, b);
  }
}
async function ensureDemo() { if (!DEMO) return; if (!(await DB.all('projects')).length) await seedDemo(); }
async function resetDemo() {
  if (!DEMO) return;
  await DB.clear(); ['at-parts-inc', 'at-label-opts', 'at-insp-tpl', 'at-inspector'].forEach(k => localStorage.removeItem(LSK(k))); sessionStorage.removeItem(LSK('at-filters'));
  Object.keys(filterState).forEach(k => delete filterState[k]);
  await seedDemo();
}
function demoBanner() {
  document.body.classList.add('demo');
  const b = document.createElement('div'); b.className = 'demo-banner no-print'; b.id = 'demoBanner'; b.setAttribute('role', 'note');
  b.innerHTML = `<span class="db-txt"><span><b>Demo mode</b> – sample data</span></span><span class="db-btns"><button class="btn sm" id="demoReset">Reset demo</button><button class="btn sm" id="demoExit">Exit demo</button></span>`;
  document.body.insertBefore(b, document.body.firstChild);
  $('#demoReset').onclick = async () => {
    if (!await confirmBox('Reset demo?', 'Puts the sample projects back the way they started. Your own data (outside demo mode) is not affected.', 'Reset demo')) return;
    await resetDemo(); toast('Demo data reset'); if (location.hash.replace(/^#\/?/, '')) go('/'); else route();
  };
  $('#demoExit').onclick = () => { location.href = location.pathname + '#/'; };
}

/* ---------------- boot ---------------- */
// html5-qrcode can leave a pending video.play() promise when the camera is stopped quickly; that rejection is harmless.
window.addEventListener('unhandledrejection', e => { const r = e.reason; if (r && r.name === 'AbortError' && /play\(\)/.test(r.message || '')) e.preventDefault(); });
window.AssetTagger = {Data, DB, buildExport, planImport, parseImportFile, handleScan, normalizeStatus, normalizeType, guessTypeFromTag, nextTag, extractTag, computeAge, computeRemaining, defaultLife, LIFE_DEFAULTS,
  splitTags, fedList, normPanel, relIndex, upstreamPath, renameRefs, powerLine, typeSummary, applyFilter, FIELDS,
  addMonths, normPart, partNextDue, partStatus, partHits, collectParts, partTotals, partsContext, partsEmail, parseEmails, parseFreq, applyPartsImport, buildPartsXlsx, version: APP_VERSION,
  getTemplate, defaultTemplate, newInspection, inspCounts, inspResult, inspNextDue, inspDueStatus, inspFreqOf, inspBuckets, inspRows, inspText, INSP_DEFAULTS,
  demo: DEMO, dbName: DB_NAME, seedDemo: () => seedDemo(), resetDemo: () => resetDemo()};
if ('serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', {scope: './'}).catch(e => console.warn('SW registration failed', e)));
}
if (!DEMO && navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => { if (!p) navigator.storage.persist().catch(() => {}); }).catch(() => {});
if (DEMO) { demoBanner(); ensureDemo().catch(e => console.error('Demo data failed', e)).then(route); }
else route();
})();
