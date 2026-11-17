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

/* ---------- 도감 데이터 (PokéAPI GraphQL, 한 번 받아서 기기에 저장) ---------- */
const GQL = 'https://beta.pokeapi.co/graphql/v1beta';
const QUERY = `query{pokemon_v2_pokemonspecies(order_by:{id:asc}){id
 pokemon_v2_pokemonspeciesnames(where:{pokemon_v2_language:{name:{_in:["ko","en"]}}}){name pokemon_v2_language{name}}
 pokemon_v2_pokemons(where:{is_default:{_eq:true}}){pokemon_v2_pokemontypes(order_by:{slot:asc}){pokemon_v2_type{name}}}}}`;
const CACHE_KEY = 'pc_dex_v1';
let DEX = [];

async function loadDex() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && c.length > 900) return c;
  } catch (e) {}
  const r = await fetch(GQL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query: QUERY})
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const list = j.data.pokemon_v2_pokemonspecies.map(s => {
    const names = s.pokemon_v2_pokemonspeciesnames;
    const get = l => (names.find(n => n.pokemon_v2_language.name === l) || {}).name;
    const p = s.pokemon_v2_pokemons[0];
    const types = p ? p.pokemon_v2_pokemontypes.map(t => t.pokemon_v2_type.name).filter(t => TYPE_KO[t]) : [];
    return {id: s.id, ko: get('ko') || get('en') || ('#' + s.id), en: get('en') || '', types};
  }).filter(p => p.types.length);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch (e) {}
  return list;
}

/* ---------- 유틸 ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sprite = id => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const badge = t => `<span class="tb" style="background:${TYPE_COLOR[t]}">${TYPE_KO[t]}</span>`;
const norm = s => s.toLowerCase().replace(/\s+/g, '');

/* ---------- 추천 계산 ---------- */
// 공격: 내 타입 중 상대에게 가장 잘 통하는 배율 / 방어: 상대 타입들의 공격이 나에게 주는 최대 배율
function recommend(target, safeOnly) {
  return DEX.filter(p => p.id !== target.id).map(p => {
    let off = 0, bt = null;
    for (const t of p.types) {
      const m = eff(t, target.types);
      if (m > off) { off = m; bt = t; }
    }
    let def = 0;
    for (const t of target.types) def = Math.max(def, eff(t, p.types));
    return {p, off, bt, def};
  }).filter(r => r.off >= 2 && (!safeOnly || r.def <= 1))
    .sort((a, b) => b.off - a.off || a.def - b.def || a.p.id - b.p.id);
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

function showSug(list) {
  const el = $('sug');
  if (!list.length) { el.classList.add('hide'); el.innerHTML = ''; return; }
  el.classList.remove('hide');
  el.innerHTML = list.map(p => `<button data-id="${p.id}"><img src="${sprite(p.id)}" loading="lazy" alt=""><span class="num">#${p.id}</span><span>${esc(p.ko)}</span><span style="margin-left:auto">${p.types.map(badge).join('')}</span></button>`).join('');
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
  const groups = {4: [], 2: [], 0.5: [], 0.25: [], 0: []};
  for (const a of TYPES) {
    const m = eff(a, t.types);
    if (groups[m]) groups[m].push(a);
  }
  const row = (label, arr) => arr.length ? `<div class="row"><b>${label}</b>${arr.map(badge).join('')}</div>` : '';
  const safe = $('result').querySelector('#safe') ? $('safe').checked : true;
  const recs = recommend(t, safe);
  const items = recs.slice(0, shown).map(r => `
    <div class="item">
      <img src="${sprite(r.p.id)}" loading="lazy" alt="">
      <div class="mid">
        <div class="nm">${esc(r.p.ko)} <span class="num">#${r.p.id}</span></div>
        <div>${r.p.types.map(badge).join('')}</div>
        <div class="meta">공격 <b class="good">${fmt(r.off)}</b> (${TYPE_KO[r.bt]}) · 받는 피해 <b class="${r.def > 1 ? 'bad' : (r.def < 1 ? 'good' : '')}">${fmt(r.def)}</b></div>
      </div>
    </div>`).join('');

  $('result').innerHTML = `
    <div class="card">
      <div class="target">
        <img src="${sprite(t.id)}" alt="">
        <div><h2>${esc(t.ko)}</h2><div class="en">#${t.id} ${esc(t.en)}</div><div class="row">${t.types.map(badge).join('')}</div></div>
      </div>
      <div style="margin-top:8px">
        ${row('4배', groups[4])}${row('2배', groups[2])}${row('½배', groups[0.5])}${row('¼배', groups[0.25])}${row('무효', groups[0])}
      </div>
    </div>
    <div class="card">
      <h3>카운터 추천 (${recs.length}마리)</h3>
      <label class="toggle"><input type="checkbox" id="safe" ${safe ? 'checked' : ''}> 상대 타입 공격을 1배 이하로 받는 포켓몬만</label>
      ${items || '<div class="msg">조건에 맞는 포켓몬이 없어요. 위 체크를 꺼보세요.</div>'}
      ${recs.length > shown ? '<button class="btn sec" id="more">더 보기</button>' : ''}
      <p class="small">공격 = 그 포켓몬의 타입 중 상대에게 가장 잘 통하는 배율, 받는 피해 = 상대 타입이 그 포켓몬에게 주는 최대 배율. 타입만 보는 계산이라 실제 기술·특성·종족값은 반영하지 않아요. 메가진화·리전폼은 기본 폼 기준이에요.</p>
    </div>`;
  $('safe').onchange = () => { shown = 30; render(); };
  const more = $('more');
  if (more) more.onclick = () => { shown += 30; render(); };
}

/* ---------- 시작 ---------- */
$('q').addEventListener('input', e => showSug(search(e.target.value)));
$('q').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const r = search($('q').value); if (r.length) select(r[0]); }
});
$('sug').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) select(DEX.find(p => p.id === +b.dataset.id));
});

function boot() {
  $('status').textContent = '도감 불러오는 중… (처음 한 번만 걸려요)';
  loadDex().then(d => {
    DEX = d;
    $('status').textContent = `전체 ${DEX.length}종 연결 완료. 이름을 입력해보세요.`;
    if ($('q').value) showSug(search($('q').value));
  }).catch(err => {
    $('status').innerHTML = '도감을 불러오지 못했어요 (' + esc(err.message) + ')<button class="btn sec" id="retry">다시 시도</button>';
    $('retry').onclick = boot;
  });
}
boot();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
