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

  function escapeHtml(str){
    return String(str ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
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

  // ---- Date helpers (YYYY-MM-DD) ----
  function getYear(d) {
    const s = String(d ?? '');
    return s.includes('-') ? s.split('-')[0] : '';
  }
  function getMonth(d) {
    const s = String(d ?? '');
    return s.includes('-') ? s.split('-')[1] : '';
  }
  function monthLabel(mm) {
    const map = {
      "01":"Janvier","02":"Février","03":"Mars","04":"Avril","05":"Mai","06":"Juin",
      "07":"Juillet","08":"Août","09":"Septembre","10":"Octobre","11":"Novembre","12":"Décembre"
    };
    return map[mm] || mm || '—';
  }
  function ymKey(d){
    const y = getYear(d);
    const m = getMonth(d);
    return (y && m) ? `${y}-${m}` : '';
  }

  // ---------------- Dashboard Global (index.html) ----------------
  async function initDashboardGlobal() {
    const dataAll = await loadData();

    // Elements
    const dYear = document.getElementById('dYear');
    const dMonth = document.getElementById('dMonth');
    const dBureau = document.getElementById('dBureau');
    const dResultat = document.getElementById('dResultat');
    const dSearch = document.getElementById('dSearch');
    const dReset = document.getElementById('dReset');

    const lastUpdated = document.getElementById('lastUpdated');
    const scopeInfo = document.getElementById('scopeInfo');
    const kpiInfo = document.getElementById('kpiInfo');

    // Build options (global)
    const years = ["Tous", ...uniq(dataAll.map(d => getYear(d.date))).sort().reverse()];
    const months = ["Tous", ...uniq(dataAll.map(d => getMonth(d.date))).sort()];
    const bureaux = ["Tous", ...uniq(dataAll.map(d => d.bureau)).sort()];
    const resultats = ["Tous", ...uniq(dataAll.map(d => d.resultat)).sort()];

    dYear.innerHTML = years.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    dMonth.innerHTML = months.map(v => {
      const label = (v === "Tous") ? "Tous" : monthLabel(v);
      return `<option value="${escapeHtml(v)}">${escapeHtml(label)}</option>`;
    }).join('');
    dBureau.innerHTML = bureaux.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    dResultat.innerHTML = resultats.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');

    lastUpdated.textContent = `Dernière lecture: ${new Date().toLocaleString('fr-FR')}`;

    // Render helpers
    function setText(id, value) {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    }
    function setList(id, items) {
      const el = document.getElementById(id);
      if (!el) return;
      if (!items.length) {
        el.innerHTML = `<li class="muted">Aucune donnée</li>`;
        return;
      }
      el.innerHTML = items.map(([k,v]) => `<li><b>${escapeHtml(k)}</b> — ${v}</li>`).join('');
    }

    function applyDashboardFilters() {
      const vYear = dYear.value;
      const vMonth = dMonth.value;
      const vBureau = dBureau.value;
      const vRes = dResultat.value;
      const q = normalize(dSearch.value);

      let data = dataAll.slice();

      if (vYear !== "Tous") data = data.filter(d => getYear(d.date) === vYear);
      if (vMonth !== "Tous") data = data.filter(d => getMonth(d.date) === vMonth);
      if (vBureau !== "Tous") data = data.filter(d => String(d.bureau) === vBureau);
      if (vRes !== "Tous") data = data.filter(d => String(d.resultat) === vRes);

      if (q) {
        data = data.filter(d => {
          const blob = [
            d.agent, d.agent_id, d.bureau, d.tache, d.resultat, d.commentaire, d.code_activite
          ].map(normalize).join(' | ');
          return blob.includes(q);
        });
      }

      // Scope info
      const sYear = (vYear === "Tous") ? "toutes années" : vYear;
      const sMonth = (vMonth === "Tous") ? "tous mois" : monthLabel(vMonth);
      const sBureau = (vBureau === "Tous") ? "tous bureaux" : vBureau;
      const sRes = (vRes === "Tous") ? "tous résultats" : vRes;
      scopeInfo.textContent = `${sYear} • ${sMonth} • ${sBureau} • ${sRes}`;

      // KPIs
      const total = data.length;
      const ongoing = data.filter(d => normalize(d.resultat).includes('en_cours')).length;
      const done = data.filter(d => normalize(d.resultat).includes('term')).length;
      const agents = uniq(data.map(d => d.agent)).length;
      const bureauxCount = uniq(data.map(d => d.bureau)).length;
      const linked = data.filter(d => normalize(d.lien_activite) === 'oui').length;
      const withCode = data.filter(d => String(d.code_activite ?? '').trim() !== '').length;

      // Period covered
      const dates = uniq(data.map(d => d.date)).sort();
      let period = "—";
      if (dates.length === 1) period = dates[0];
      if (dates.length > 1) period = `${dates[0]} → ${dates[dates.length - 1]}`;

      setText('kpiTotal', total);
      setText('kpiOngoing', ongoing);
      setText('kpiDone', done);
      setText('kpiAgents', agents);
      setText('kpiBureaux', bureauxCount);
      setText('kpiLinked', linked);
      setText('kpiWithCode', withCode);
      setText('kpiPeriod', period);

      kpiInfo.textContent = `${total} tâches dans le périmètre filtré`;

      // Distributions (Top 10)
      setList('byBureau', countBy(data, d => d.bureau || '—').slice(0, 10));
      setList('byAgent', countBy(data, d => d.agent || '—').slice(0, 10));
      setList('byResultat', countBy(data, d => d.resultat || '—').slice(0, 10));

      // By month (YYYY-MM)
      const byYM = countBy(data, d => ymKey(d.date) || '—')
        .slice(0, 10)
        .map(([k,v]) => {
          if (k === '—') return [k, v];
          const [yy, mm] = k.split('-');
          return [`${monthLabel(mm)} ${yy}`, v];
        });
      setList('byMonth', byYM);
    }

    // Events
    [dYear, dMonth, dBureau, dResultat].forEach(el => el.addEventListener('change', applyDashboardFilters));
    dSearch.addEventListener('input', applyDashboardFilters);

    dReset.addEventListener('click', () => {
      dYear.value = "Tous";
      dMonth.value = "Tous";
      dBureau.value = "Tous";
      dResultat.value = "Tous";
      dSearch.value = "";
      applyDashboardFilters();
    });

    applyDashboardFilters();
  }

  // ---------------- Table (tasks.html) ----------------
  async function initTasks() {
    const data = await loadData();

    const fYear = document.getElementById('fYear');
    const fMonth = document.getElementById('fMonth');
    const fBureau = document.getElementById('fBureau');
    const fResultat = document.getElementById('fResultat');
    const fSearch = document.getElementById('fSearch');
    const btnReset = document.getElementById('btnReset');

    const years = ["Tous", ...uniq(data.map(d => getYear(d.date))).sort().reverse()];
    const months = ["Tous", ...uniq(data.map(d => getMonth(d.date))).sort()];
    fYear.innerHTML = years.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    fMonth.innerHTML = months.map(v => {
      const label = (v === "Tous") ? "Tous" : monthLabel(v);
      return `<option value="${escapeHtml(v)}">${escapeHtml(label)}</option>`;
    }).join('');

    const bureaux = ["Tous", ...uniq(data.map(d => d.bureau)).sort()];
    const resultats = ["Tous", ...uniq(data.map(d => d.resultat)).sort()];
    fBureau.innerHTML = bureaux.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    fResultat.innerHTML = resultats.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');

    const tbody = document.querySelector('#tasksTable tbody');
    const countInfo = document.getElementById('countInfo');

    function applyFilters() {
      const vYear = fYear.value;
      const vMonth = fMonth.value;
      const vBureau = fBureau.value;
      const vRes = fResultat.value;
      const q = normalize(fSearch.value);

      let filtered = data.slice();

      if (vYear !== 'Tous') filtered = filtered.filter(d => getYear(d.date) === vYear);
      if (vMonth !== 'Tous') filtered = filtered.filter(d => getMonth(d.date) === vMonth);
      if (vBureau !== 'Tous') filtered = filtered.filter(d => String(d.bureau) === vBureau);
      if (vRes !== 'Tous') filtered = filtered.filter(d => String(d.resultat) === vRes);

      if (q) {
        filtered = filtered.filter(d => {
          const blob = [
            d.agent, d.agent_id, d.bureau, d.tache, d.resultat, d.commentaire, d.code_activite
          ].map(normalize).join(' | ');
          return blob.includes(q);
        });
      }

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

    [fYear, fMonth, fBureau, fResultat].forEach(el => el.addEventListener('change', applyFilters));
    fSearch.addEventListener('input', applyFilters);

    btnReset.addEventListener('click', () => {
      fYear.value = 'Tous';
      fMonth.value = 'Tous';
      fBureau.value = 'Tous';
      fResultat.value = 'Tous';
      fSearch.value = '';
      applyFilters();
    });

    applyFilters();
  }

  return { initDashboardGlobal, initTasks };
})();
