console.log('TrendPeak app loading');

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready');

  const ogBtn = document.getElementById('ogBtn');
  const form = document.getElementById('searchForm');
  const qEl = document.getElementById('q');
  const resEl = document.getElementById('result');
  const titleEl = document.getElementById('title');
  const freshnessEl = document.getElementById('freshness');
  const coverageEl = document.getElementById('coverage');
  const spikesEl = document.getElementById('spikes');
  const sourcesEl = document.getElementById('sources');
  const yrEl = document.getElementById('yr');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const csvBtn = document.getElementById('csvBtn');
  const shareX = document.getElementById('shareX');
  const shareTT = document.getElementById('shareTT');
  const shareYT = document.getElementById('shareYT');
  const saveBtn = document.getElementById('saveBtn');
  const savedBox = document.getElementById('saved');
  const recentBox = document.getElementById('recent');
  const clearRecent = document.getElementById('clearRecent');
  const alertQ = document.getElementById('alert_q');
  const alertGeo = document.getElementById('alert_geo');
  const pngBtn = document.getElementById('pngBtn');
const sharePageBtn = document.getElementById('sharePageBtn');


  if (!form || !qEl || !resEl) {
    console.error('Missing DOM nodes. Check IDs in index.html');
    return;
  }

  if (yrEl) yrEl.textContent = new Date().getFullYear();

  let chart;
  let lastTimeline = [];
  let lastQuery = '';
  let lastGeo = 'NG';

  function track(name, props){
    try{ if(window.plausible) window.plausible(name, { props }); }catch{}
  }

  form.addEventListener('submit', onSearchSubmit);

  async function onSearchSubmit(e){
    e.preventDefault();
    const q = qEl.value.trim();
    const geoSel = document.getElementById('geo');
    const geo = geoSel ? geoSel.value : 'NG';
    if (!q) return;

    lastQuery = q;
    lastGeo = geo;

    resEl.classList.remove('hide');
    if (titleEl) titleEl.textContent = q;
    if (freshnessEl) freshnessEl.textContent = 'Fetching...';
    if (coverageEl) coverageEl.textContent = `Region: ${geo}`;
    if (spikesEl) spikesEl.innerHTML = 'Loading...';
    if (sourcesEl) sourcesEl.innerHTML = '';

    try {
      const r = await fetch(`/api/trend?q=${encodeURIComponent(q)}&geo=${encodeURIComponent(geo)}`);
      if (!r.ok) throw new Error('API error');
      const data = await r.json();

      const regions = Array.isArray(data.regions) ? data.regions : [];
      const sources = data.sources || { news: [], reddit: [], youtube: [] };
      const explore = Array.isArray(data.explore) ? data.explore : [];

      lastTimeline = data.timeline || [];

      if (freshnessEl) freshnessEl.textContent = 'Updated just now';
      drawChart(lastTimeline);

      setTimeout(() => {
        renderSpikes(data.spikes || []);
        renderSources(sources, regions, explore);
      }, 50);

      updateURL(q, geo);
      updateShareLinks(q, geo);
      pushHistory({ q, geo });
      renderHistory();
      track('search', { q, geo });
      console.log('Search success', { q, geo });
      if (pngBtn) pngBtn.onclick = downloadPNG;
if (sharePageBtn) {
  const labels = lastTimeline.map(p => p.t.slice(5)).join(",");
  const values = lastTimeline.map(p => p.v).join(",");
  sharePageBtn.href = `/share.html?q=${encodeURIComponent(q)}&geo=${encodeURIComponent(geo)}&labels=${encodeURIComponent(labels)}&values=${encodeURIComponent(values)}`;
}

    } catch (err) {
      if (spikesEl) spikesEl.innerHTML = 'Failed to load';
      console.error(err);
    }
  }

  function drawChart(points){
    const canvas = document.getElementById('chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const labels = points.map(p => p.t.slice(5));
    const values = points.map(p => p.v);
    if (chart) chart.destroy();
    if (typeof Chart === 'undefined') {
      console.error('Chart.js not loaded');
      return;
    }
    chart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ data: values, fill: false, tension: .2, pointRadius: 2 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { suggestedMax: 100, grid: { color: '#1a1a1a' } } } }
    });
  }

  function renderSpikes(spikes){
    if (!spikesEl) return;
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
    if (!sourcesEl) return;
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
        track('trending_click', { q: item.title || '', geo: (document.getElementById('geo') || {}).value || 'NG' });
        qEl.value = item.title || '';
        form.dispatchEvent(new Event('submit'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      box.appendChild(div);
    });
  }

  function updateURL(q, geo){
    const params = new URLSearchParams(location.search);
    params.set('q', q);
    params.set('geo', geo);
    history.replaceState(null, '', `?${params.toString()}`);
  }

  function updateShareLinks(q, geo){
    const url = `${location.origin}${location.pathname}?q=${encodeURIComponent(q)}&geo=${encodeURIComponent(geo)}`;
    if (copyLinkBtn) copyLinkBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(url);
        copyLinkBtn.textContent = 'Copied';
        setTimeout(() => copyLinkBtn.textContent = 'Copy link', 1500);
      } catch {}
    };
    if (csvBtn) csvBtn.onclick = downloadCSV;
    if (ogBtn) ogBtn.onclick = openShareImage;
    if (shareX) shareX.href = `https://x.com/intent/tweet?text=${encodeURIComponent(q)}&url=${encodeURIComponent(url)}`;
    if (shareTT) shareTT.href = `https://www.tiktok.com/share?url=${encodeURIComponent(url)}&title=${encodeURIComponent(q)}`;
    if (shareYT) shareYT.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  }

  function downloadCSV(){
    if (!lastTimeline.length) return;
    const rows = [['date','value'], ...lastTimeline.map(p => [p.t, String(p.v)])];
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${lastQuery}_${lastGeo}_trend.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    track('csv_download', { q: lastQuery, geo: lastGeo });
  }

  function openShareImage(){
    if (!lastTimeline.length) return;
    const labels = lastTimeline.map(p => p.t.slice(5)).join(",");
    const values = lastTimeline.map(p => p.v).join(",");
    const u = `/api/og?q=${encodeURIComponent(lastQuery)}&labels=${encodeURIComponent(labels)}&values=${encodeURIComponent(values)}`;
    window.open(u, "_blank", "noopener");
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

  // Saved and recent remain unchanged below...
  function getSaved(){ try{ return JSON.parse(localStorage.getItem('tp_saved') || '[]'); }catch{return[]} }
  function setSaved(list){ localStorage.setItem('tp_saved', JSON.stringify(list.slice(0,30))); }
  function renderSaved(){
    if(!savedBox) return;
    const list = getSaved();
    savedBox.innerHTML = '';
    list.forEach(({q,geo}, idx) => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = `<span>${escapeHtml(q)} · ${geo}</span><button class="x" title="Remove">×</button>`;
      chip.addEventListener('click', e => {
        if(e.target.classList.contains('x')) return;
        qEl.value = q;
        const gs = document.getElementById('geo');
        if(gs) gs.value = geo;
        form.dispatchEvent(new Event('submit'));
        window.scrollTo({top:0,behavior:'smooth'});
      });
      chip.querySelector('.x').addEventListener('click', e => {
        e.stopPropagation();
        const l = getSaved();
        l.splice(idx,1);
        setSaved(l);
        renderSaved();
      });
      savedBox.appendChild(chip);
    });
  }
  function saveCurrent(){
    const q = qEl.value.trim();
    const gs = document.getElementById('geo');
    const geo = gs ? gs.value : 'NG';
    if(!q) return;
    const list = getSaved();
    const exists = list.find(x => x.q.toLowerCase() === q.toLowerCase() && x.geo === geo);
    if(!exists){
      list.unshift({q,geo});
      setSaved(list);
      renderSaved();
      track('save_search', { q, geo });
    }
  }
  if (saveBtn) saveBtn.addEventListener('click', saveCurrent);
  renderSaved();

  function getHistory(){ try{ return JSON.parse(localStorage.getItem('tp_recent') || '[]'); }catch{return[]} }
  function setHistory(list){ localStorage.setItem('tp_recent', JSON.stringify(list.slice(0,15))); }
  function pushHistory(item){
    const list = getHistory().filter(x => !(x.q.toLowerCase() === item.q.toLowerCase() && x.geo === item.geo));
    list.unshift(item);
    setHistory(list);
  }
  function renderHistory(){
    if(!recentBox) return;
    const list = getHistory();
    recentBox.innerHTML = '';
    list.forEach(({q,geo}) => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = `${q} · ${geo}`;
      chip.addEventListener('click', () => {
        qEl.value = q;
        const gs = document.getElementById('geo');
        if(gs) gs.value = geo;
        form.dispatchEvent(new Event('submit'));
        window.scrollTo({top:0,behavior:'smooth'});
      });
      recentBox.appendChild(chip);
    });
  }
  if (clearRecent) clearRecent.addEventListener('click', () => { setHistory([]); renderHistory(); });

  const welcome = document.getElementById('welcome');
  const welcomeOk = document.getElementById('welcomeOk');
  const welcomeHide = document.getElementById('welcomeHide');
  function showWelcomeOnce(){
    const seen = localStorage.getItem('tp_seen');
    if (seen || !welcome) return;
    welcome.classList.remove('hide');
  }
  function hideWelcome(){
    if (!welcome) return;
    welcome.classList.add('hide');
    localStorage.setItem('tp_seen','1');
  }
  if (welcomeOk) welcomeOk.addEventListener('click', hideWelcome);
  if (welcomeHide) welcomeHide.addEventListener('click', hideWelcome);

  initFromURL();
  const gs = document.getElementById('geo');
  if (gs) gs.addEventListener('change', loadTrending);
  renderHistory();
  showWelcomeOnce();

  console.log('TrendPeak app ready');
});
