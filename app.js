'use strict';

/* ---------- 타입 데이터 (6세대 이후 18타입 상성표) ---------- */
const TYPE_KO = {normal:'노말',fire:'불꽃',water:'물',electric:'전기',grass:'풀',ice:'얼음',fighting:'격투',poison:'독',ground:'땅',flying:'비행',psychic:'에스퍼',bug:'벌레',rock:'바위',ghost:'고스트',dragon:'드래곤',dark:'악',steel:'강철',fairy:'페어리'};
const TYPE_COLOR = {normal:'#9fa19f',fire:'#e8622c',water:'#3a8de0',electric:'#e2b90a',grass:'#3fa129',ice:'#3fc8d8',fighting:'#c03028',poison:'#9141cb',ground:'#a0702a',flying:'#6f94e0',psychic:'#ee4a7c',bug:'#7a9a1a',rock:'#a8943a',ghost:'#6a4a8a',dragon:'#4f55d8',dark:'#5a4a40',steel:'#5a8ea2',fairy:'#e88ae0'};
const TYPES = Object.keys(TYPE_KO);

// 공격 타입 -> [효과 굉장함, 별로, 효과 없음]
const RAW = {
  normal:  [[],['rock','steel'],['ghost']],
  fire:    [['grass','ice','bug','steel'],['fire','water','rock','dragon'],[]],
  water:   [['fire','ground','rock'],['water','grass','dragon'],[]],
  electric:[['water','flying'],['electric','grass','dragon'],['ground']],
  grass:   [['water','ground','rock'],['fire','grass','poison','flying','bug','dragon','steel'],[]],
  ice:     [['grass','ground','flying','dragon'],['fire','water','ice','steel'],[]],
  fighting:[['normal','ice','rock','dark','steel'],['poison','flying','psychic','bug','fairy'],['ghost']],
  poison:  [['grass','fairy'],['poison','ground','rock','ghost'],['steel']],
  ground:  [['fire','electric','poison','rock','steel'],['grass','bug'],['flying']],
  flying:  [['grass','fighting','bug'],['electric','rock','steel'],[]],
  psychic: [['fighting','poison'],['psychic','steel'],['dark']],
  bug:     [['grass','psychic','dark'],['fire','fighting','poison','flying','ghost','steel','fairy'],[]],
  rock:    [['fire','ice','flying','bug'],['fighting','ground','steel'],[]],
  ghost:   [['psychic','ghost'],['dark'],['normal']],
  dragon:  [['dragon'],['steel'],['fairy']],
  dark:    [['psychic','ghost'],['fighting','dark','fairy'],[]],
  steel:   [['ice','rock','fairy'],['fire','water','electric','steel'],[]],
  fairy:   [['fighting','dragon','dark'],['fire','poison','steel'],[]]
};
const CHART = {};
for (const a of TYPES) {
  CHART[a] = {};
  for (const d of TYPES) CHART[a][d] = 1;
  RAW[a][0].forEach(d => CHART[a][d] = 2);
  RAW[a][1].forEach(d => CHART[a][d] = 0.5);
  RAW[a][2].forEach(d => CHART[a][d] = 0);
}
function eff(att, defTypes) {
  let m = 1;
  for (const d of defTypes) m *= CHART[att][d];
  return m;
}
function fmt(m) {
  if (m === 0) return '0배';
  if (m === 0.25) return '¼배';
  if (m === 0.5) return '½배';
  return m + '배';
}

/* ---------- 포켓몬 GO 배율 ----------
   GO: 효과 굉장함 x1.6, 별로 x0.625, 효과 없음은 이중 저항 x0.390625 (무효 없음). 복합 타입은 곱셈. */
let goMode = false;
function effGo(att, defTypes) {
  let m = 1;
  for (const d of defTypes) {
    const v = CHART[att][d];
    m *= v === 2 ? 1.6 : v === 0.5 ? 0.625 : v === 0 ? 0.390625 : 1;
  }
  return Number(m.toFixed(4));
}
const E = (att, defTypes) => goMode ? effGo(att, defTypes) : eff(att, defTypes);
const SE = () => goMode ? 1.6 : 2;
const fmtAny = m => goMode ? Number(m.toFixed(3)) + '배' : fmt(m);

/* ---------- 도감 데이터 (GitHub CSV 우선, 실패하면 PokéAPI GraphQL, 한 번 받아서 기기에 저장) ---------- */
const CACHE_KEY = 'pc_dex_v2';
const CSV_BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';
const TYPE_BY_ID = {1:'normal',2:'fighting',3:'flying',4:'poison',5:'ground',6:'rock',7:'bug',8:'ghost',9:'steel',10:'fire',11:'water',12:'grass',13:'electric',14:'psychic',15:'ice',16:'dragon',17:'dark',18:'fairy'};
let DEX = [];

function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.slice(1);
}
async function getCSV(name) {
  const r = await fetch(CSV_BASE + name);
  if (!r.ok) throw new Error(name + ' HTTP ' + r.status);
  return parseCSV(await r.text());
}
async function loadFromCSV() {
  const [names, types] = await Promise.all([getCSV('pokemon_species_names.csv'), getCSV('pokemon_types.csv')]);
  const ko = {}, en = {};
  for (const [id, lang, name] of names) {
    const n = +id;
    if (n > 1025) continue;
    if (lang === '3') ko[n] = name; else if (lang === '9') en[n] = name;
  }
  const ty = {};
  for (const [pid, tid, slot] of types) {
    const n = +pid;
    if (n > 1025 || !TYPE_BY_ID[tid]) continue;
    (ty[n] = ty[n] || []).push([+slot, TYPE_BY_ID[tid]]);
  }
  const list = [];
  for (let id = 1; id <= 1025; id++) {
    if (!ty[id]) continue;
    list.push({id, ko: ko[id] || en[id] || ('#' + id), en: en[id] || '', types: ty[id].sort((a, b) => a[0] - b[0]).map(x => x[1])});
  }
  return list;
}

const GQL = 'https://beta.pokeapi.co/graphql/v1beta';
const QUERY = `query{pokemon_v2_pokemonspecies(order_by:{id:asc}){id
 pokemon_v2_pokemonspeciesnames(where:{pokemon_v2_language:{name:{_in:["ko","en"]}}}){name pokemon_v2_language{name}}
 pokemon_v2_pokemons(where:{is_default:{_eq:true}}){pokemon_v2_pokemontypes(order_by:{slot:asc}){pokemon_v2_type{name}}}}}`;
async function loadFromGQL() {
  const r = await fetch(GQL, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({query: QUERY})});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return j.data.pokemon_v2_pokemonspecies.map(s => {
    const names = s.pokemon_v2_pokemonspeciesnames;
    const get = l => (names.find(n => n.pokemon_v2_language.name === l) || {}).name;
    const p = s.pokemon_v2_pokemons[0];
    const types = p ? p.pokemon_v2_pokemontypes.map(t => t.pokemon_v2_type.name).filter(t => TYPE_KO[t]) : [];
    return {id: s.id, ko: get('ko') || get('en') || ('#' + s.id), en: get('en') || '', types};
  }).filter(p => p.types.length);
}

async function loadDex() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && c.length > 900) return c;
  } catch (e) {}
  let list, e1;
  try { list = await loadFromCSV(); } catch (e) { e1 = e; }
  if (!list || list.length < 900) {
    try { list = await loadFromGQL(); }
    catch (e2) { throw new Error('CSV: ' + (e1 ? e1.message : '데이터 부족') + ' / GQL: ' + e2.message); }
  }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch (e) {}
  return list;
}

/* ---------- 유틸 ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sprite = id => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const badge = t => `<span class="tb" style="background:${TYPE_COLOR[t]}">${TYPE_KO[t]}</span>`;
const norm = s => s.toLowerCase().replace(/\s+/g, '');

/* ---------- 내 포켓몬 / 설정 저장 ---------- */
const OWN_KEY = 'pc_owned_v1', PREF_KEY = 'pc_pref_v1';
let owned = [];
const pref = {go: false, view: null};
try { owned = (JSON.parse(localStorage.getItem(OWN_KEY) || '[]') || []).filter(Number.isInteger); } catch (e) {}
try { Object.assign(pref, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) {}
goMode = !!pref.go;
let DEXMAP = new Map();
const saveOwned = () => { try { localStorage.setItem(OWN_KEY, JSON.stringify(owned)); } catch (e) {} };
const savePref = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(pref)); } catch (e) {} };
const view = () => pref.view || (owned.length ? 'owned' : 'all');

/* ---------- 추천 계산 ---------- */
// 공격: 내 타입 중 상대에게 가장 잘 통하는 배율 / 방어: 상대 타입들의 공격이 나에게 주는 최대 배율
function scoreOf(p, target) {
  let off = 0, bt = null;
  for (const t of p.types) {
    const m = E(t, target.types);
    if (m > off) { off = m; bt = t; }
  }
  let def = 0;
  for (const t of target.types) def = Math.max(def, E(t, p.types));
  return {p, off, bt, def};
}
const byRank = (a, b) => b.off - a.off || a.def - b.def || a.p.id - b.p.id;
function recommendAll(target, safeOnly) {
  return DEX.filter(p => p.id !== target.id).map(p => scoreOf(p, target))
    .filter(r => r.off >= SE() && (!safeOnly || r.def <= 1)).sort(byRank);
}
// 내 포켓몬은 약점을 못 찌르는 경우도 "그나마 나은 순"으로 보여준다
function recommendOwned(target, safeOnly) {
  return owned.map(id => DEXMAP.get(id)).filter(Boolean).map(p => scoreOf(p, target))
    .filter(r => !safeOnly || r.def <= 1).sort(byRank);
}

/* ---------- 이름 찾기 ---------- */
function findByName(s) {
  const n = norm(s);
  if (!n) return null;
  if (/^\d+$/.test(n)) return DEXMAP.get(+n) || null;
  const ex = DEX.find(p => norm(p.ko) === n || norm(p.en) === n);
  if (ex) return ex;
  const st = DEX.filter(p => norm(p.ko).startsWith(n) || norm(p.en).startsWith(n));
  return st.length === 1 ? st[0] : null;
}

/* ---------- 화면 ---------- */
let current = null, shown = 30;

function search(q) {
  const n = norm(q);
  if (!n) return [];
  if (/^\d+$/.test(n)) return DEX.filter(p => String(p.id) === n).slice(0, 8);
  const starts = [], inc = [];
  for (const p of DEX) {
    const ko = norm(p.ko), en = norm(p.en);
    if (ko.startsWith(n) || en.startsWith(n)) starts.push(p);
    else if (ko.includes(n) || en.includes(n)) inc.push(p);
  }
  return starts.concat(inc).slice(0, 8);
}

function sugHTML(list) {
  return list.map(p => `<button type="button" data-id="${p.id}"><img src="${sprite(p.id)}" loading="lazy" alt=""><span class="num">#${p.id}</span><span>${esc(p.ko)}</span><span style="margin-left:auto">${p.types.map(badge).join('')}</span></button>`).join('');
}
function showSug(list) {
  const el = $('sug');
  if (!list.length) { el.classList.add('hide'); el.innerHTML = ''; return; }
  el.classList.remove('hide');
  el.innerHTML = sugHTML(list);
}

function select(p) {
  current = p; shown = 30;
  $('sug').classList.add('hide');
  $('q').value = p.ko;
  $('q').blur();
  render();
}

function render() {
  if (!current) { $('result').innerHTML = ''; return; }
  const t = current;
  const vals = new Map();
  for (const a of TYPES) {
    const m = E(a, t.types);
    if (m !== 1) { if (!vals.has(m)) vals.set(m, []); vals.get(m).push(a); }
  }
  const keys = [...vals.keys()].sort((a, b) => b - a);
  const label = k => goMode ? Number(k.toFixed(3)) + '배' : (k === 0 ? '무효' : fmt(k));
  const rows = keys.map(k => `<div class="row"><b>${label(k)}</b>${vals.get(k).map(badge).join('')}</div>`).join('');

  const safe = $('result').querySelector('#safe') ? $('safe').checked : true;
  const v = view();
  const recs = v === 'owned' ? recommendOwned(t, safe) : recommendAll(t, safe);
  const items = recs.slice(0, shown).map(r => {
    const offCls = r.off > 1 ? 'good' : (r.off < 1 ? 'bad' : '');
    const defCls = r.def > 1 ? 'bad' : (r.def < 1 ? 'good' : '');
    return `
    <div class="item${r.off < SE() ? ' dim' : ''}">
      <img src="${sprite(r.p.id)}" loading="lazy" alt="">
      <div class="mid">
        <div class="nm">${esc(r.p.ko)} <span class="num">#${r.p.id}</span></div>
        <div>${r.p.types.map(badge).join('')}</div>
        <div class="meta">공격 <b class="${offCls}">${fmtAny(r.off)}</b> (${TYPE_KO[r.bt]}) · 받는 피해 <b class="${defCls}">${fmtAny(r.def)}</b></div>
      </div>
    </div>`;
  }).join('');
  const empty = (v === 'owned' && !owned.length)
    ? '<div class="msg">내 포켓몬을 먼저 추가해 주세요.<button type="button" class="btn sec" id="openOwn">내 포켓몬 추가하기</button></div>'
    : '<div class="msg">조건에 맞는 포켓몬이 없어요. 위 체크를 꺼보세요.</div>';
  const note = goMode
    ? '포켓몬 GO 배율이에요. 효과 굉장함 1.6배, 별로 0.625배, 효과 없음은 0.391배(이중 저항)로 계산해요. GO에서 실제 위력은 사용하는 기술의 타입·위력과 CP, 레벨에 크게 좌우돼요. 이 계산은 포켓몬 본인 타입만 보는 참고용이에요.'
    : '공격 = 그 포켓몬의 타입 중 상대에게 가장 잘 통하는 배율, 받는 피해 = 상대 타입이 그 포켓몬에게 주는 최대 배율. 타입만 보는 계산이라 실제 기술·특성·종족값은 반영하지 않아요. 메가진화·리전폼은 기본 폼 기준이에요.';

  $('result').innerHTML = `
    <div class="card">
      <div class="target">
        <img src="${sprite(t.id)}" alt="">
        <div><h2>${esc(t.ko)}</h2><div class="en">#${t.id} ${esc(t.en)}</div><div class="row">${t.types.map(badge).join('')}</div></div>
      </div>
      <div style="margin-top:8px">${rows}</div>
    </div>
    <div class="card">
      <div class="seg" role="group" aria-label="추천 범위">
        <button type="button" data-view="all" aria-pressed="${v === 'all'}">전체 도감</button>
        <button type="button" data-view="owned" aria-pressed="${v === 'owned'}">내 포켓몬 (${owned.length})</button>
      </div>
      <h3 style="margin-top:12px">${v === 'owned' ? '내 포켓몬 순위' : '카운터 추천'} (${recs.length}마리)</h3>
      <label class="toggle"><input type="checkbox" id="safe" ${safe ? 'checked' : ''}> 상대 타입 공격을 1배 이하로 받는 포켓몬만</label>
      ${items || empty}
      ${recs.length > shown ? '<button type="button" class="btn sec" id="more">더 보기</button>' : ''}
      <p class="small">${note}</p>
    </div>`;
}

function syncMode() {
  document.querySelectorAll('#modeSeg button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.go === '1') === goMode)));
}

/* ---------- 내 포켓몬 관리 ---------- */
function renderOwn() {
  $('ownCount').textContent = owned.length;
  const list = owned.map(id => DEXMAP.get(id)).filter(Boolean).sort((a, b) => a.id - b.id);
  $('ownList').innerHTML = list.length
    ? list.map(p => `<span class="oc"><img src="${sprite(p.id)}" alt="" loading="lazy">${esc(p.ko)}<button type="button" data-rm="${p.id}" aria-label="${esc(p.ko)} 삭제">✕</button></span>`).join('')
    : '<div class="msg">아직 추가한 포켓몬이 없어요.</div>';
}
function addOwned(ids) {
  let added = 0, dup = 0;
  for (const id of ids) { if (owned.includes(id)) dup++; else { owned.push(id); added++; } }
  if (added) saveOwned();
  return {added, dup};
}
function afterOwnChange() { renderOwn(); render(); }

/* ---------- 시작 ---------- */
$('q').addEventListener('input', e => showSug(search(e.target.value)));
$('q').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const r = search($('q').value); if (r.length) select(r[0]); }
});
$('sug').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) select(DEXMAP.get(+b.dataset.id));
});

$('modeSeg').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  goMode = b.dataset.go === '1';
  pref.go = goMode; savePref(); syncMode();
  shown = 30; render();
});
$('result').addEventListener('click', e => {
  const vb = e.target.closest('[data-view]');
  if (vb) { pref.view = vb.dataset.view; savePref(); shown = 30; render(); return; }
  if (e.target.id === 'more') { shown += 30; render(); return; }
  if (e.target.id === 'openOwn') { const box = $('ownBox'); box.open = true; box.scrollIntoView({block: 'start', behavior: 'smooth'}); }
});
$('result').addEventListener('change', e => { if (e.target.id === 'safe') { shown = 30; render(); } });

function addFromSuggestion(p) {
  addOwned([p.id]);
  $('ownQ').value = '';
  $('ownSug').classList.add('hide'); $('ownSug').innerHTML = '';
  $('bulkMsg').textContent = `${p.ko} 추가했어요.`;
  afterOwnChange();
}
$('ownQ').addEventListener('input', e => {
  const list = search(e.target.value), el = $('ownSug');
  if (!list.length) { el.classList.add('hide'); el.innerHTML = ''; return; }
  el.classList.remove('hide'); el.innerHTML = sugHTML(list);
});
$('ownQ').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const r = search($('ownQ').value); if (r.length) addFromSuggestion(r[0]); }
});
$('ownSug').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) addFromSuggestion(DEXMAP.get(+b.dataset.id));
});
$('ownList').addEventListener('click', e => {
  const b = e.target.closest('[data-rm]');
  if (!b) return;
  owned = owned.filter(id => id !== +b.dataset.rm);
  saveOwned(); afterOwnChange();
});
$('bulkAdd').addEventListener('click', () => {
  const toks = $('bulk').value.split(/[\n,;、\/]+/).map(s => s.trim()).filter(Boolean);
  const ids = [], miss = [];
  for (const tk of toks) {
    let p = findByName(tk);
    if (!p) { const w = tk.split(/\s+/)[0]; if (w !== tk && !/^\d+$/.test(w)) p = findByName(w); }
    if (p) ids.push(p.id); else miss.push(tk);
  }
  const r = addOwned([...new Set(ids)]);
  $('bulkMsg').textContent = `${r.added}마리 추가` + (r.dup ? `, 이미 있음 ${r.dup}` : '') +
    (miss.length ? `, 찾지 못함 ${miss.length}개: ${miss.slice(0, 8).join(', ')}${miss.length > 8 ? ' …' : ''}` : '');
  if (!miss.length) $('bulk').value = '';
  afterOwnChange();
});
let clearTimer = null;
$('ownClear').addEventListener('click', () => {
  const b = $('ownClear');
  if (!clearTimer) {
    b.textContent = '정말 지울까요? 한 번 더 누르세요';
    clearTimer = setTimeout(() => { clearTimer = null; b.textContent = '내 포켓몬 모두 지우기'; }, 4000);
    return;
  }
  clearTimeout(clearTimer); clearTimer = null;
  b.textContent = '내 포켓몬 모두 지우기';
  owned = []; saveOwned(); $('bulkMsg').textContent = '모두 지웠어요.'; afterOwnChange();
});

function boot() {
  $('status').textContent = '도감 불러오는 중… (처음 한 번만 걸려요)';
  loadDex().then(d => {
    DEX = d;
    DEXMAP = new Map(d.map(p => [p.id, p]));
    owned = owned.filter(id => DEXMAP.has(id));
    $('status').textContent = `전체 ${DEX.length}종 연결 완료. 이름을 입력해보세요.`;
    if ($('q').value) showSug(search($('q').value));
    renderOwn();
    render();
  }).catch(err => {
    $('status').innerHTML = '도감을 불러오지 못했어요 (' + esc(err.message) + ')<button class="btn sec" id="retry">다시 시도</button>';
    $('retry').onclick = boot;
  });
}
syncMode();
boot();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ---- 홈 화면 설치 (안드로이드 크롬: 설치 버튼, 그 외: 안내) ----
(function () {
  const btn = document.getElementById('install');
  const hint = document.getElementById('iosHint');
  if (!btn) return;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return;                       // 이미 앱으로 열었으면 아무것도 안 보여요
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    btn.classList.add('show');
    hint.classList.remove('show');
  });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch (e) {}
    deferred = null;
    btn.classList.remove('show');
  });
  window.addEventListener('appinstalled', () => { btn.classList.remove('show'); hint.classList.remove('show'); });
  // 설치 이벤트가 안 오는 브라우저(아이폰 사파리 등)에는 안내만 보여줘요
  setTimeout(() => { if (!deferred) hint.classList.add('show'); }, 2500);
})();
