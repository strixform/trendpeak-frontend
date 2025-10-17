const form = document.getElementById('searchForm');
const qEl = document.getElementById('q');
const resEl = document.getElementById('result');
const titleEl = document.getElementById('title');
const freshnessEl = document.getElementById('freshness');
const coverageEl = document.getElementById('coverage');
const spikesEl = document.getElementById('spikes');
const sourcesEl = document.getElementById('sources');
const yrEl = document.getElementById('yr');
const dlEl = document.getElementById('dlReport');
let chart;

yrEl.textContent = new Date().getFullYear();
dlEl.addEventListener('click', e => { e.preventDefault(); alert('Reports coming soon'); });

form.addEventListener('submit', async e => {
  e.preventDefault();
  const q = qEl.value.trim();
  const geoSel = document.getElementById('geo');
  const geo = geoSel ? geoSel.value : 'NG';
  if (!q) return;

  resEl.classList.remove('hide');
  titleEl.textContent = q;
  freshnessEl.textContent = 'Fetching...';
  coverageEl.textContent = `Region: ${geo}`;
  spikesEl.innerHTML = 'Loading...';
  sourcesEl.innerHTML = '';

  try {
    const r = await fetch(`/api/trend?q=${encodeURIComponent(q)}&geo=${encodeURIComponent(geo)}`);
    if (!r.ok) throw new Error('API error');
    const data = await r.json();

    const regions = Array.isArray(data.regions) ? data.regions : [];
    const sources = data.sources || { news: [], reddit: [], youtube: [] };
    const explore = Array.isArray(data.explore) ? data.explore : [];

    freshnessEl.textContent = 'Updated just now';
    drawChart(data.timeline || []);
    renderSpikes(data.spikes || []);
    renderSources(sources, regions, explore);
    updateURL(q, geo);
  } catch (err) {
    spikesEl.innerHTML = 'Failed to load';
    console.error(err);
  }
});

function drawChart(points){
  const ctx = document.getElementById('chart').getContext('2d');
  const labels = points.map(p => p.t.slice(5));
  const values = points.map(p => p.v);
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ data: values, fill: false, tension: .2, pointRadius: 2 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { suggestedMax: 100, grid: { color: '#1a1a1a' } } } }
  });
}

function renderSpikes(spikes){
  if (!spikes.length){ spikesEl.innerHTML = 'No spikes found'; return; }
  spikesEl.innerHTML = '';
  spikes.forEach(s => {
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = `<strong>${s.time}</strong><div class="small">+${s.percent}% vs baseline</div><div class="small">${s.reason}</div>`;
    spikesEl.appendChild(d);
  });
}

function renderSources(sources, regions, explore){
  sourcesEl.innerHTML = '';

  if (Array.isArray(regions) && regions.length){
    const box = document.createElement('div');
    box.className = 'card';
    box.innerHTML = `<strong>Top regions</strong><div class="small">${regions.map(r => `${escapeHtml(r.name)} ${r.value}`).join(' • ')}</div>`;
    sourcesEl.appendChild(box);
  }

  section('News', sources.news || [], i => row(i.site, i.title, i.url));
  section('Reddit', sources.reddit || [], i => row(i.site, i.score ? `${i.title} • ${i.score}` : i.title, i.url));
  section('YouTube', sources.youtube || [], i => videoRow(i));

  if (explore && explore.length){
    const hdr = document.createElement('div');
    hdr.className = 'small';
    hdr.style.marginTop = '10px';
    hdr.textContent = 'Quick explore';
    sourcesEl.appendChild(hdr);

    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.innerHTML = explore.map(e => `<a href="${e.url}" target="_blank" rel="noopener" style="margin-right:12px">${escapeHtml(e.label)}</a>`).join('');
    sourcesEl.appendChild(wrap);
  }
}

function section(title, list, renderFn){
  if (!list.length) return;
  const hdr = document.createElement('div');
  hdr.className = 'small';
  hdr.style.marginTop = '10px';
  hdr.textContent = title;
  sourcesEl.appendChild(hdr);
  list.forEach(x => sourcesEl.appendChild(renderFn(x)));
}

function row(site, title, url){
  const div = document.createElement('div');
  div.className = 'source';
  div.innerHTML = `<a href="${url}" target="_blank" rel="noopener">${escapeHtml(site || '')} • ${escapeHtml(title || '')}</a>`;
  return div;
}

function videoRow(item){
  const div = document.createElement('div');
  div.className = 'source';
  div.innerHTML = `
    <a href="${item.url}" target="_blank" rel="noopener">
      ${item.thumbnail ? `<img src="${item.thumbnail}" alt="" style="width:72px;height:40px;object-fit:cover;border-radius:6px;margin-right:8px;vertical-align:middle">` : ''}
      ${escapeHtml(item.title || '')}
    </a>`;
  return div;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* Trending feed */
async function loadTrending() {
  const geoSel = document.getElementById('geo');
  const geo = geoSel ? geoSel.value : 'NG';
  const box = document.getElementById('trending');
  if (!box) return;
  box.innerHTML = 'Loading...';
  try {
    const r = await fetch(`/api/top?geo=${encodeURIComponent(geo)}`);
    const data = await r.json();
    renderTrending(data.top || []);
  } catch {
    box.innerHTML = 'Failed to load';
  }
}

function renderTrending(list){
  const box = document.getElementById('trending');
  if (!box) return;
  if (!list.length) { box.innerHTML = 'No data'; return; }
  box.innerHTML = '';
  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'card';
    const related = item.related && item.related.length ? `<div class="small">${item.related.join(' • ')}</div>` : '';
    const links = item.articles && item.articles.length
      ? item.articles.map(a => `<div class="small"><a href="${a.url}" target="_blank" rel="noopener">${escapeHtml(a.title || '')}</a></div>`).join('')
      : '';
    div.innerHTML = `<strong>${escapeHtml(item.title || '')}</strong>${related}${links}`;
    div.addEventListener('click', () => {
      qEl.value = item.title || '';
      form.dispatchEvent(new Event('submit'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    box.appendChild(div);
  });
}

/* Shareable URLs */
function updateURL(q, geo){
  const params = new URLSearchParams(location.search);
  params.set('q', q);
  params.set('geo', geo);
  history.replaceState(null, '', `?${params.toString()}`);
}

function initFromURL(){
  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  const geo = params.get('geo');
  const geoSel = document.getElementById('geo');
  if (geo && geoSel) geoSel.value = geo.toUpperCase();
  if (q){
    qEl.value = q;
    form.dispatchEvent(new Event('submit'));
  } else {
    loadTrending();
  }
}

/* Init */
document.addEventListener('DOMContentLoaded', () => {
  initFromURL();
  const geoSel = document.getElementById('geo');
  if (geoSel) geoSel.addEventListener('change', loadTrending);
});
