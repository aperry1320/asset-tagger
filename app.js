/* Asset Tagger – offline HVAC/mechanical equipment tagging PWA.
   Vanilla JS, data in IndexedDB. Vendor libs (loaded on demand): html5-qrcode, SheetJS (xlsx); qrcode-generator loaded up front. */
'use strict';
(() => {
const APP_VERSION = '1.0.0';
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
  {key:'installDate', label:'Install Date', aliases:['install date','installed','installation date','date installed','install']},
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
    const r = indexedDB.open('asset-tagger', 1);
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
  photos: async aid => (await DB.by('photos', 'assetId', aid)).sort((a, b) => natCmp(a.createdAt, b.createdAt)),
  addPhoto: (assetId, blob) => DB.put('photos', {id: uid(), assetId, blob, type: blob.type || 'image/jpeg', createdAt: nowISO()}),
  deletePhoto: id => DB.del('photos', id),
  async findByTag(tag) { const t = normTag(tag); return (await DB.all('assets')).filter(a => normTag(a.tag) === t); },
};
async function photoCounts() {
  const m = {}; (await DB.all('photos')).forEach(p => { m[p.assetId] = (m[p.assetId] || 0) + 1; }); return m;
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
  revokeAll(); setBottomBar(''); window.scrollTo(0, 0);
  const {parts, q} = parseHash();
  try {
    if (!parts.length) return await renderHome();
    if (parts[0] === 'settings') return await renderSettings();
    if (parts[0] === 'find') return await handleScan(q.get('tag') || '', q.get('p'), true);
    if (parts[0] === 'p' && parts[1]) {
      const pid = parts[1];
      if (parts.length === 2) return await renderProject(pid);
      if (parts[2] === 'labels') return await renderLabels(pid, q);
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
    <div class="field"><label>Notes</label><textarea id="pjNotes">${esc(p.notes)}</textarea></div>`,
    onOpen: d => $('#pjName', d).focus(),
    actions: [{label: 'Cancel'}, {label: isNew ? 'Create' : 'Save', cls: 'primary', onClick: async d => {
      const name = $('#pjName', d).value.trim();
      if (!name) { toast('Project name is required'); $('#pjName', d).focus(); return false; }
      const rec = {...p, id: p.id || uid(), name, client: $('#pjClient', d).value.trim(), address: $('#pjAddr', d).value.trim(), notes: $('#pjNotes', d).value.trim(), createdAt: p.createdAt || nowISO()};
      await Data.saveProject(rec);
      toast(isNew ? 'Project created' : 'Project saved');
      if (isNew) go(`/p/${encodeURIComponent(rec.id)}`); else route();
    }}]});
}

/* ---------------- Project: asset list ---------------- */
const filterState = JSON.parse(sessionStorage.getItem('at-filters') || '{}');
const getFilter = pid => filterState[pid] || (filterState[pid] = {q: '', type: '', status: '', building: '', floor: '', sort: 'tag'});
const saveFilters = () => sessionStorage.setItem('at-filters', JSON.stringify(filterState));
function applyFilter(assets, f) {
  const q = f.q.trim().toLowerCase();
  let out = assets.filter(a =>
    (!f.type || a.type === f.type) && (!f.status || (a.status || 'Not started') === f.status) &&
    (!f.building || (a.building || '') === f.building) && (!f.floor || (a.floor || '') === f.floor) &&
    (!q || ['tag','type','manufacturer','model','serial','capacity','building','floor','room','areaServed','notes'].some(k => String(a[k] || '').toLowerCase().includes(q))));
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
const options = (vals, sel, allLabel) => `<option value="">${esc(allLabel)}</option>` + vals.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');

async function renderProject(pid) {
  const p = await Data.project(pid); if (!p) return go('/', true);
  const [assets, pc] = await Promise.all([Data.assets(pid), photoCounts()]);
  const f = getFilter(pid);
  setChrome(p.name, '/', `<button class="icon-btn" id="pMenu" aria-label="Project menu">${ICON.more}</button>`);
  const anyAdv = f.type || f.building || f.floor || f.sort !== 'tag';
  view.innerHTML = `
    <div class="chips" id="statusChips"></div>
    <div class="search"><span>${ICON.search}</span><input id="q" type="search" placeholder="Search tag, model, serial, room…" value="${esc(f.q)}" autocomplete="off" enterkeyhint="search"></div>
    <details class="filters" ${anyAdv ? 'open' : ''}><summary>Filters &amp; sort</summary>
      <div class="grid2">
        <div class="field"><label>Type</label><select id="fType">${options(TYPES, f.type, 'All types')}</select></div>
        <div class="field"><label>Building</label><select id="fBldg">${options(uniq(assets, 'building'), f.building, 'All buildings')}</select></div>
        <div class="field"><label>Floor</label><select id="fFloor">${options(uniq(assets, 'floor'), f.floor, 'All floors')}</select></div>
        <div class="field"><label>Sort by</label><select id="fSort">${[['tag','Tag'],['type','Type'],['location','Location'],['status','Status'],['updated','Recently updated']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      </div></details>
    <div class="resultbar"><span id="count"></span><button class="linkbtn" id="clearF">Clear filters</button></div>
    <div class="list" id="assetList"></div>
    <div class="row no-print"><button class="btn sm" id="bExport">Export</button><button class="btn sm" id="bImport">Import</button><button class="btn sm" id="bLabels">${ICON.print} Labels</button></div>`;
  setBottomBar(`<button class="btn" id="bScan">${ICON.scan} Scan</button><button class="btn primary" id="bAdd">${ICON.plus} Add asset</button>`);

  const renderList = () => {
    saveFilters();
    const counts = {}; assets.forEach(a => { const s = a.status || 'Not started'; counts[s] = (counts[s] || 0) + 1; });
    $('#statusChips').innerHTML = `<button class="chip ${!f.status ? 'active' : ''}" data-s="">All<span class="n">${assets.length}</span></button>` +
      STATUSES.map(s => `<button class="chip ${f.status === s ? 'active' : ''}" data-s="${esc(s)}">${esc(s)}<span class="n">${counts[s] || 0}</span></button>`).join('');
    const list = applyFilter(assets, f);
    $('#count').textContent = assets.length ? `Showing ${list.length} of ${assets.length}` : '';
    $('#clearF').hidden = !(f.q || f.type || f.status || f.building || f.floor);
    $('#assetList').innerHTML = !assets.length
      ? `<div class="empty"><div class="big">🏷️</div><p><b>No assets yet.</b></p><p>Tap <b>Add asset</b>, scan an existing tag, or import a CSV/Excel equipment schedule.</p></div>`
      : !list.length ? `<div class="empty">No assets match these filters.</div>`
      : list.map(a => `<a class="item" href="#/p/${encodeURIComponent(pid)}/a/${encodeURIComponent(a.id)}"><div class="main">
          <div class="t">${esc(a.tag)}</div>
          <div class="sub">${esc([a.manufacturer, a.model, a.capacity].filter(Boolean).join(' · ') || '—')}</div>
          <div class="sub">${esc(locLine(a) || a.areaServed || '')}${pc[a.id] ? ` · 📷 ${pc[a.id]}` : ''}</div></div>
          <div class="right"><span class="badge">${esc(a.type || '—')}</span>${statusPill(a.status)}</div></a>`).join('');
  };
  renderList();
  $('#statusChips').onclick = e => { const c = e.target.closest('.chip'); if (c) { f.status = c.dataset.s; renderList(); } };
  $('#q').oninput = e => { f.q = e.target.value; renderList(); };
  $('#fType').onchange = e => { f.type = e.target.value; renderList(); };
  $('#fBldg').onchange = e => { f.building = e.target.value; renderList(); };
  $('#fFloor').onchange = e => { f.floor = e.target.value; renderList(); };
  $('#fSort').onchange = e => { f.sort = e.target.value; renderList(); };
  $('#clearF').onclick = () => { Object.assign(f, {q: '', type: '', status: '', building: '', floor: ''}); renderProject(pid); };
  $('#bAdd').onclick = () => go(`/p/${encodeURIComponent(pid)}/a/new`);
  $('#bScan').onclick = () => openScanner(pid);
  $('#bExport').onclick = () => exportDialog(p, assets, applyFilter(assets, f));
  $('#bImport').onclick = () => importDialog(p, assets);
  $('#bLabels').onclick = () => go(`/p/${encodeURIComponent(pid)}/labels?filtered=1`);
  $('#pMenu').onclick = () => {
    const m = modal({title: p.name, body: `<div class="menu">
      <button class="btn" data-m="edit">✏️ Edit project details</button>
      <button class="btn" data-m="export">⬇️ Export to Excel / CSV</button>
      <button class="btn" data-m="import">⬆️ Import from Excel / CSV</button>
      <button class="btn" data-m="labels">🖨️ Print QR tag labels</button>
      <button class="btn danger" data-m="delete">🗑️ Delete project</button></div>`});
    m.el.addEventListener('click', async e => {
      const b = e.target.closest('[data-m]'); if (!b) return; m.close();
      const a = b.dataset.m;
      if (a === 'edit') projectDialog(p);
      if (a === 'export') exportDialog(p, assets, applyFilter(assets, f));
      if (a === 'import') importDialog(p, assets);
      if (a === 'labels') go(`/p/${encodeURIComponent(pid)}/labels?filtered=1`);
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
  const photos = await Data.photos(aid);
  const base = `/p/${encodeURIComponent(pid)}/a/${encodeURIComponent(aid)}`;
  setChrome(a.tag, `/p/${encodeURIComponent(pid)}`, `<button class="icon-btn" id="hdrEdit" aria-label="Edit" style="font-size:16px;font-weight:700">Edit</button>`);
  const rows = FIELDS.filter(fl => !['tag','type','status','notes'].includes(fl.key) && a[fl.key]).map(fl => `<dt>${esc(fl.label)}</dt><dd>${esc(a[fl.key])}</dd>`).join('');
  view.innerHTML = `
    <div class="hero"><div style="display:flex;gap:12px;align-items:flex-start">
      <div style="flex:1;min-width:0"><div class="tag">${esc(a.tag)}</div>
        <div class="meta"><span class="badge">${esc(a.type || '—')}</span>${statusPill(a.status)}</div>
        <div class="muted small" style="margin-top:8px">${esc(p.name)}</div></div>
      <div class="qr-mini" title="QR for ${esc(a.tag)}">${qrSvg(a.tag)}</div></div></div>
    <div class="card"><div class="lbl">Status — tap to update</div><div class="status-pick" id="stPick">${STATUSES.map(s =>
      `<button data-s="${esc(s)}" class="${(a.status || 'Not started') === s ? 'on ' + STATUS_CLASS[s] : ''}">${esc(s)}</button>`).join('')}</div></div>
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
  $('#bLabel').onclick = () => go(`/p/${encodeURIComponent(pid)}/labels?ids=${encodeURIComponent(aid)}`);
  $('#bDup').onclick = () => go(`/p/${encodeURIComponent(pid)}/a/new?from=${encodeURIComponent(aid)}`);
  $('#bDel').onclick = async () => {
    if (await confirmBox('Delete asset?', `Delete <b>${esc(a.tag)}</b> and its ${photos.length} photo(s)?`, 'Delete', true)) {
      await Data.deleteAsset(aid); toast('Asset deleted'); go(`/p/${encodeURIComponent(pid)}`);
    }
  };
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
    if (from) ['type','manufacturer','model','capacity','building','floor'].forEach(k => a[k] = from[k] || '');
    if (from) a.tag = nextTag(from.tag);
    if (q.get('tag')) a.tag = normTag(q.get('tag'));
    if (!a.type && a.tag) a.type = guessTypeFromTag(a.tag);
  }
  const existingPhotos = aid ? await Data.photos(aid) : [];
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
      <div class="field"><label for="f_installDate">Install date</label><input id="f_installDate" name="installDate" type="date" value="${esc(a.installDate)}"></div>
      <div class="field"><label for="f_notes">Notes</label><textarea id="f_notes" name="notes" placeholder="Deficiencies, observations, startup notes…">${esc(a.notes)}</textarea></div>
      <div class="field"><span class="lbl">Nameplate photos</span><div class="photos" id="phGrid"></div></div>
      ${dl('dl_mfr', 'manufacturer')}${dl('dl_bldg', 'building')}${dl('dl_floor', 'floor')}${dl('dl_room', 'room')}${dl('dl_area', 'areaServed')}
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
  $('#phGrid').onclick = e => {
    const r = e.target.closest('[data-rm]'); if (r) { removed.add(r.dataset.rm); dirty = true; renderPhotos(); }
    const s = e.target.closest('[data-rms]'); if (s) { staged.splice(+s.dataset.rms, 1); renderPhotos(); }
  };
  let typeAuto = !a.type;
  $('#f_type').onchange = () => { typeAuto = false; };
  $('#f_tag').oninput = e => { if (typeAuto) { const g = guessTypeFromTag(e.target.value); $('#f_type').value = g; } };
  $('#scanIntoTag').onclick = () => openScanner(pid, text => { $('#f_tag').value = normTag(extractTag(text)); $('#f_tag').dispatchEvent(new Event('input')); dirty = true; });
  if (isNew && !a.tag) setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) $('#f_tag').focus(); }, 50);
  const cancel = $('#bCancel'); if (cancel) cancel.onclick = async () => { if (!dirty || await confirmBox('Discard changes?', 'Your edits will be lost.', 'Discard', true)) go(back); };

  async function save(next) {
    const fd = new FormData(form); const rec = {...a};
    FIELDS.forEach(fl => { rec[fl.key] = String(fd.get(fl.key) ?? '').trim(); });
    rec.tag = normTag(rec.tag);
    if (!rec.tag) { toast('Tag / Asset ID is required'); $('#f_tag').focus(); return; }
    const dup = assets.find(x => normTag(x.tag) === rec.tag && x.id !== a.id);
    if (dup) {
      if (await confirmBox('Tag already exists', `<b>${esc(rec.tag)}</b> is already used in this project. Tags must be unique so scanning works. Open the existing asset?`, 'Open existing'))
        go(`/p/${encodeURIComponent(pid)}/a/${encodeURIComponent(dup.id)}`);
      return;
    }
    rec.id = a.id || uid(); rec.projectId = pid; rec.createdAt = a.createdAt || nowISO();
    await Data.saveAsset(rec);
    for (const id of removed) await Data.deletePhoto(id);
    for (const b of staged) await Data.addPhoto(rec.id, b);
    await Data.saveProject(p);
    toast(`${rec.tag} saved`);
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
  const opt = JSON.parse(localStorage.getItem('at-label-opts') || '{}');
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
    localStorage.setItem('at-label-opts', JSON.stringify(o));
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
const HEADERS = ['Project', ...FIELDS.map(f => f.label), 'Photos', 'Created', 'Last Updated'];
function assetRows(project, assets, pc) {
  return assets.slice().sort((a, b) => natCmp(a.tag, b.tag)).map(a => {
    const r = {'Project': project.name};
    FIELDS.forEach(fl => { r[fl.label] = fl.key === 'status' ? (a.status || 'Not started') : (a[fl.key] || ''); });
    r['Photos'] = pc[a.id] || 0;
    r['Created'] = a.createdAt ? new Date(a.createdAt).toLocaleString() : '';
    r['Last Updated'] = a.updatedAt ? new Date(a.updatedAt).toLocaleString() : '';
    return r;
  });
}
async function buildExport(project, assets, fmt) {
  await loadXLSX();
  const pc = await photoCounts();
  const rows = assetRows(project, assets, pc);
  const ws = XLSX.utils.json_to_sheet(rows, {header: HEADERS});
  ws['!cols'] = HEADERS.map(h => ({wch: Math.min(45, Math.max(h.length + 2, ...rows.map(r => String(r[h] ?? '').length + 1)))}));
  if (rows.length) ws['!autofilter'] = {ref: XLSX.utils.encode_range({s: {r: 0, c: 0}, e: {r: rows.length, c: HEADERS.length - 1}})};
  const name = `${slug(project.name)}_assets_${today()}`;
  if (fmt === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(ws);
    return {blob: new Blob(['\ufeff' + csv], {type: 'text/csv;charset=utf-8'}), name: name + '.csv'};
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Assets');
  const sum = [['Project', project.name], ['Client / owner', project.client || ''], ['Address', project.address || ''], ['Exported', new Date().toLocaleString()], ['Total assets', assets.length], [], ['Status', 'Count']];
  STATUSES.forEach(s => sum.push([s, assets.filter(a => (a.status || 'Not started') === s).length]));
  sum.push([], ['Equipment type', 'Count']);
  TYPES.forEach(t => { const n = assets.filter(a => a.type === t).length; if (n) sum.push([t, n]); });
  const ws2 = XLSX.utils.aoa_to_sheet(sum); ws2['!cols'] = [{wch: 22}, {wch: 40}];
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');
  wb.Props = {Title: `${project.name} – Asset register`, Author: 'Asset Tagger'};
  const out = XLSX.write(wb, {bookType: 'xlsx', type: 'array', compression: true});
  return {blob: new Blob([out], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), name: name + '.xlsx'};
}
function exportDialog(project, all, filtered) {
  const share = canShareFiles();
  const hasFilter = filtered.length !== all.length;
  modal({title: 'Export assets', body: `
    ${hasFilter ? `<div class="field"><label>Which assets?</label><select id="exScope"><option value="all">All assets (${all.length})</option><option value="filtered">Current filtered list (${filtered.length})</option></select></div>` : `<p>${all.length} asset${all.length === 1 ? '' : 's'} in <b>${esc(project.name)}</b>.</p>`}
    <div class="field"><label>Format</label><select id="exFmt"><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV (.csv)</option></select></div>
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
  const sheetName = wb.SheetNames.find(n => /asset|equip|schedule/i.test(n)) || wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {defval: '', raw: true});
}
function planImport(rows, existing, pid) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const hmap = mapHeaders(headers);
  const byTag = new Map(existing.map(a => [normTag(a.tag), a]));
  const plan = {create: [], update: [], skipped: 0, hmap, unmapped: headers.filter(h => !hmap[h] && !/^(project|photos|created|last updated)$/i.test(h.trim()))};
  const seen = new Map();
  rows.forEach(row => {
    const rec = {};
    Object.entries(hmap).forEach(([h, key]) => { const v = row[h]; rec[key] = v instanceof Date ? v : String(v ?? '').trim(); });
    rec.tag = normTag(rec.tag);
    if (!rec.tag) { plan.skipped++; return; }
    const extra = [];
    if ('type' in rec) { const t = normalizeType(rec.type); if (t === null) { extra.push(`Type: ${rec.type}`); rec.type = 'Other'; } else rec.type = t; }
    if ('status' in rec) rec.status = normalizeStatus(rec.status);
    if ('installDate' in rec) { const d = toISODate(rec.installDate); if (d === null) { extra.push(`Install date: ${rec.installDate}`); rec.installDate = ''; } else rec.installDate = d; }
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
    <p>Import an equipment list from <b>Excel (.xlsx)</b> or <b>CSV</b>. The first row must be column headers, e.g. <i>Tag, Type, Manufacturer, Model, Serial, Building, Floor, Room, Area Served, Status</i>. Column names are matched loosely.</p>
    <p class="muted small">Rows whose tag already exists in this project update that asset (blank cells don't overwrite). New tags are added.</p>
    <label class="btn primary block">Choose file…<input type="file" id="impFile" hidden accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></label>
    <div class="row"><button class="btn sm" id="tplBtn">Download blank template</button></div>
    <div id="impResult"></div>`,
    onOpen: d => {
      $('#tplBtn', d).onclick = async () => {
        await loadXLSX();
        const ws = XLSX.utils.aoa_to_sheet([FIELDS.map(f => f.label), ['AHU-1', 'AHU', 'Trane', 'CSAA012', 'K12345678', '8,000 CFM', 'Main', '1', 'Mech 101', 'East wing', today(), 'Installed', '']]);
        ws['!cols'] = FIELDS.map(f => ({wch: Math.max(14, f.label.length + 2)}));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Assets');
        downloadBlob(new Blob([XLSX.write(wb, {bookType: 'xlsx', type: 'array'})], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), 'asset_import_template.xlsx');
      };
      $('#impFile', d).onchange = async e => {
        const file = e.target.files[0]; if (!file) return;
        const out = $('#impResult', d); out.innerHTML = '<p>Reading…</p>';
        try {
          const rows = await parseImportFile(file);
          const plan = planImport(rows, existing.map(a => ({...a})), project.id);
          if (!Object.values(plan.hmap).includes('tag')) { out.innerHTML = `<div class="notice warn">Couldn't find a Tag / Asset ID column. Found: ${esc(Object.keys(rows[0] || {}).join(', ') || 'no columns')}</div>`; return; }
          out.innerHTML = `<div class="notice"><b>${rows.length}</b> rows read from ${esc(file.name)}<br>
            ➕ <b>${plan.create.length}</b> new assets<br>✏️ <b>${plan.update.length}</b> existing assets updated<br>${plan.skipped ? `⚠️ ${plan.skipped} rows skipped (no tag)<br>` : ''}
            <span class="small">Columns used: ${esc(Object.entries(plan.hmap).map(([h, k]) => `${h} → ${FIELDS.find(f => f.key === k).label}`).join(', '))}</span>
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
      <p style="margin:4px 0">${projects.length} projects · ${assets.length} assets · ${photos.length} photos</p>
      <p class="muted small" style="margin:4px 0">${esc(est)}${est ? '<br>' : ''}Storage protection: <b>${persisted ? 'on (browser won\'t auto-clear)' : 'not granted yet'}</b></p>
      ${persisted ? '' : '<button class="btn sm" id="persistBtn">Request storage protection</button>'}</div>
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
    const out = {app: 'asset-tagger', version: 1, exportedAt: nowISO(), projects, assets, photos: []};
    for (const ph of photos) out.photos.push({id: ph.id, assetId: ph.assetId, createdAt: ph.createdAt, type: ph.type, data: await blobToDataURL(ph.blob)});
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
      for (const ph of data.photos) await DB.put('photos', {id: ph.id, assetId: ph.assetId, createdAt: ph.createdAt, type: ph.type, blob: await dataURLToBlob(ph.data)});
      toast('Backup restored'); route();
    } catch (err) { toast('Restore failed: ' + err.message, 4000); }
  };
  $('#wipe').onclick = async () => {
    if (await confirmBox('Delete everything?', 'All projects, assets and photos on this device will be permanently deleted. Make a backup first!', 'Delete all', true)) { await DB.clear(); toast('All data deleted'); go('/'); }
  };
}

/* ---------------- boot ---------------- */
// html5-qrcode can leave a pending video.play() promise when the camera is stopped quickly; that rejection is harmless.
window.addEventListener('unhandledrejection', e => { const r = e.reason; if (r && r.name === 'AbortError' && /play\(\)/.test(r.message || '')) e.preventDefault(); });
window.AssetTagger = {Data, DB, buildExport, planImport, parseImportFile, handleScan, normalizeStatus, normalizeType, guessTypeFromTag, nextTag, extractTag, version: APP_VERSION};
if ('serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', {scope: './'}).catch(e => console.warn('SW registration failed', e)));
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => { if (!p) navigator.storage.persist().catch(() => {}); }).catch(() => {});
route();
})();
