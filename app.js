window.App = (() => {
  const DATA_URL = 'data.json';

  async function loadData() {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Erreur fetch ${DATA_URL}: ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  function uniq(values) {
    return [...new Set(values.filter(v => v !== null && v !== undefined && String(v).trim() !== ''))];
  }

  function normalize(s) {
    return String(s ?? '').toLowerCase().trim();
  }

  function countBy(arr, keyFn) {
    const m = new Map();
    for (const x of arr) {
      const k = keyFn(x);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a,b) => b[1]-a[1]);
  }

  function badge(resultat) {
    const v = String(resultat ?? '');
    const cls = normalize(v).includes('term') ? 'done' : 'ongoing';
    return `<span class="badge ${cls}">${escapeHtml(v || '—')}</span>`;
  }

  function escapeHtml(str){
    return String(str)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  // ---------------- Dashboard (index.html) ----------------
  async function initDashboard() {
    const data = await loadData();

    const total = data.length;
    const ongoing = data.filter(d => normalize(d.resultat).includes('en_cours')).length;
    const done = data.filter(d => normalize(d.resultat).includes('term')).length;
    const agents = uniq(data.map(d => d.agent)).length;

    document.getElementById('kpiTotal').textContent = total;
    document.getElementById('kpiOngoing').textContent = ongoing;
    document.getElementById('kpiDone').textContent = done;
    document.getElementById('kpiAgents').textContent = agents;

    const refreshed = new Date().toLocaleString('fr-FR');
    document.getElementById('lastUpdated').textContent = `Dernière lecture: ${refreshed}`;

    // Top bureaux
    const topBureaux = countBy(data, d => d.bureau || '—').slice(0, 5);
    const ulB = document.getElementById('topBureaux');
    ulB.innerHTML = topBureaux.map(([k,v]) => `<li><b>${escapeHtml(k)}</b> — ${v}</li>`).join('');

    // Top agents
    const topAgents = countBy(data, d => d.agent || '—').slice(0, 5);
    const ulA = document.getElementById('topAgents');
    ulA.innerHTML = topAgents.map(([k,v]) => `<li><b>${escapeHtml(k)}</b> — ${v}</li>`).join('');
  }

  // ---------------- Table (tasks.html) ----------------
  async function initTasks() {
    const data = await loadData();

    const fDate = document.getElementById('fDate');
    const fBureau = document.getElementById('fBureau');
    const fResultat = document.getElementById('fResultat');
    const fSearch = document.getElementById('fSearch');
    const btnReset = document.getElementById('btnReset');

    // Build filter options
    const dates = ['Tous', ...uniq(data.map(d => d.date)).sort().reverse()];
    const bureaux = ['Tous', ...uniq(data.map(d => d.bureau)).sort()];
    const resultats = ['Tous', ...uniq(data.map(d => d.resultat)).sort()];

    fDate.innerHTML = dates.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    fBureau.innerHTML = bureaux.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    fResultat.innerHTML = resultats.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');

    const tbody = document.querySelector('#tasksTable tbody');
    const countInfo = document.getElementById('countInfo');

    function applyFilters() {
      const vDate = fDate.value;
      const vBureau = fBureau.value;
      const vRes = fResultat.value;
      const q = normalize(fSearch.value);

      let filtered = data.slice();

      if (vDate !== 'Tous') filtered = filtered.filter(d => String(d.date) === vDate);
      if (vBureau !== 'Tous') filtered = filtered.filter(d => String(d.bureau) === vBureau);
      if (vRes !== 'Tous') filtered = filtered.filter(d => String(d.resultat) === vRes);

      if (q) {
        filtered = filtered.filter(d => {
          const blob = [
            d.agent, d.bureau, d.tache, d.resultat, d.commentaire, d.code_activite
          ].map(normalize).join(' | ');
          return blob.includes(q);
        });
      }

      // Render
      tbody.innerHTML = filtered.map(d => `
        <tr>
          <td>${escapeHtml(d.date || '—')}</td>
          <td>${escapeHtml(d.bureau || '—')}</td>
          <td>${escapeHtml(d.agent || '—')}</td>
          <td>${escapeHtml(d.tache || '—')}</td>
          <td>${badge(d.resultat)}</td>
          <td>${escapeHtml(d.code_activite || '—')}</td>
          <td>${escapeHtml(d.commentaire || '—')}</td>
        </tr>
      `).join('');

      countInfo.textContent = `${filtered.length} / ${data.length} tâches`;
    }

    // Events
    [fDate, fBureau, fResultat].forEach(el => el.addEventListener('change', applyFilters));
    fSearch.addEventListener('input', applyFilters);

    btnReset.addEventListener('click', () => {
      fDate.value = 'Tous';
      fBureau.value = 'Tous';
      fResultat.value = 'Tous';
      fSearch.value = '';
      applyFilters();
    });

    applyFilters();
  }

  return { initDashboard, initTasks };
})();
