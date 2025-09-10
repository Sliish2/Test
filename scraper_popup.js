const $ = sel => document.querySelector(sel);

let allDatasets = []; // [{id,type,name,rows}]
let originalRows = [];
let originalRowsBackup = null;
let columnsState = { order: [], visible: {} };

async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

function toCSV(rows) {
    if (!rows || !rows.length) return '';
    const headers = Object.keys(rows[0]);
    const escape = v => (`${v ?? ''}`.replaceAll('"', '""'));
    const headerLine = headers.map(h => `"${escape(h)}"`).join(',');
    const lines = rows.map(r => headers.map(h => `"${escape(r[h])}"`).join(','));
    return [headerLine, ...lines].join('\n');
}

function download(filename, text, type = 'text/plain') {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFilename(name) { return (name || 'file').toString().replace(/[^a-z0-9\-_.]+/gi, '_').slice(0, 80); }

function getRefinedRows() {
    if (!originalRows.length) return [];
    const order = columnsState.order.filter(col => columnsState.visible[col]);
    return originalRows.map(row => { const obj = {}; order.forEach(col => { obj[col] = row[col]; }); return obj; });
}

function rebuildColumnsStateFromRows(rows) {
    const headers = Object.keys(rows[0] || {});
    columnsState.order = headers.slice();
    columnsState.visible = headers.reduce((acc, h) => (acc[h] = true, acc), {});
}

function renderColumnsUI() {
    const list = $('#columnsList'); const splitColumn = $('#splitColumn'); if (!list || !splitColumn) return;
    list.innerHTML = ''; splitColumn.innerHTML = '';
    columnsState.order.forEach((col, idx) => {
        const item = document.createElement('div'); item.className = 'col-item';
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !!columnsState.visible[col];
        checkbox.addEventListener('change', () => { columnsState.visible[col] = checkbox.checked; refreshPreview(); });
        const name = document.createElement('span'); name.className = 'col-name'; name.textContent = col;
        const actions = document.createElement('div'); actions.className = 'col-actions';
        const up = document.createElement('button'); up.className = 'icon-btn'; up.textContent = '↑'; up.addEventListener('click', () => {
            if (idx === 0) return; const arr = columnsState.order; [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; renderColumnsUI(); refreshPreview(); });
        const down = document.createElement('button'); down.className = 'icon-btn'; down.textContent = '↓'; down.addEventListener('click', () => {
            const arr = columnsState.order; if (idx >= arr.length - 1) return; [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]]; renderColumnsUI(); refreshPreview(); });
        actions.appendChild(up); actions.appendChild(down);
        item.appendChild(checkbox); item.appendChild(name); item.appendChild(actions); list.appendChild(item);
        const opt = document.createElement('option'); opt.value = col; opt.textContent = col; splitColumn.appendChild(opt);
    });
}

function renderPreview(rows, meta) {
    const preview = $('#preview'); const table = $('#previewTable'); table.innerHTML = '';
    if (!rows || !rows.length) { preview.style.display = 'none'; $('#summary').style.display = 'block'; $('#summary').textContent = 'No data detected on this page.'; return; }
    const headers = Object.keys(rows[0]);
    const thead = document.createElement('thead'); const trh = document.createElement('tr');
    headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; trh.appendChild(th); });
    thead.appendChild(trh); table.appendChild(thead);
    const tbody = document.createElement('tbody');
    rows.slice(0, 200).forEach(r => { const tr = document.createElement('tr'); headers.forEach(h => { const td = document.createElement('td'); td.textContent = r[h] ?? ''; tr.appendChild(td); }); tbody.appendChild(tr); });
    table.appendChild(tbody);
    $('#summary').style.display = 'block'; $('#summary').textContent = `${rows.length} rows • ${headers.length} columns${meta?.autoScrolled ? ' • auto-scrolled' : ''}`; preview.style.display = 'block';
    $('#exportCsv').onclick = () => download(`${sanitizeFilename(currentDatasetName()||'scrape')}.csv`, toCSV(getRefinedRows()), 'text/csv');
    $('#exportJson').onclick = () => download(`${sanitizeFilename(currentDatasetName()||'scrape')}.json`, JSON.stringify(getRefinedRows(), null, 2), 'application/json');
    $('#copyClipboard').onclick = async () => { await navigator.clipboard.writeText(JSON.stringify(getRefinedRows())); $('#summary').textContent = `${rows.length} rows • Copied to clipboard`; };
}

function refreshPreview() { renderPreview(getRefinedRows(), {}); }

async function ensureInjection(tabId) { try { await chrome.scripting.executeScript({ target: { tabId }, files: ['smart_scrape_content.js'] }); } catch {} }

function populateDatasetsUI(datasets){
    allDatasets = datasets || []; const bar = $('#datasetsBar'); const sel = $('#datasetSelect'); if (!allDatasets.length){ bar.style.display = 'none'; return; }
    sel.innerHTML = ''; allDatasets.forEach((d) => { const opt = document.createElement('option'); opt.value = d.id; opt.textContent = `${d.name || d.id} (${d.rows.length})`; sel.appendChild(opt); });
    bar.style.display = 'flex';
}

function currentDataset(){ const id = $('#datasetSelect')?.value; return allDatasets.find(d => d.id === id) || allDatasets[0]; }
function currentDatasetName(){ return currentDataset()?.name; }

function loadDatasetIntoEditor(dataset){
    originalRows = dataset?.rows || []; originalRowsBackup = JSON.parse(JSON.stringify(originalRows));
    rebuildColumnsStateFromRows(originalRows); renderColumnsUI(); refreshPreview();
    $('#cleanBtn').style.display = originalRows.length ? 'inline-block' : 'none';
    $('#revertBtn').style.display = 'none';
}

async function smartScrape() {
    $('#error').style.display = 'none'; $('#summary').style.display = 'none'; $('#preview').style.display = 'none';
    const tab = await getActiveTab(); if (!tab) return;
    try { await chrome.permissions.request({ origins: [new URL(tab.url).origin + '/*'] }); } catch {}
    await ensureInjection(tab.id);
    try {
        const result = await chrome.tabs.sendMessage(tab.id, { action: 'SMART_SCRAPE' });
        if (!result || !result.success) throw new Error(result?.error || 'Scrape failed');
        populateDatasetsUI(result.datasets || []);
        const dataset = currentDataset() || { rows: result.rows || [], name: 'scrape' };
        $('#optionsBtn').style.display = 'inline-block'; $('#refinePanel').style.display = 'none'; updateSplitSubVisibility();
        loadDatasetIntoEditor(dataset);
    } catch (e) { $('#error').style.display = 'block'; $('#error').textContent = `Error: ${e.message}`; }
}

function getSplitMode() { const el = document.querySelector('input[name="splitMode"]:checked'); return el ? el.value : 'none'; }
function updateSplitSubVisibility() { const subs = document.querySelectorAll('.split-sub'); const [subColumn, subSize] = subs; const mode = getSplitMode(); if (subColumn) subColumn.classList.toggle('active', mode === 'column'); if (subSize) subSize.classList.toggle('active', mode === 'size'); }

function splitAndExportCSV() {
    const rows = getRefinedRows(); if (!rows.length) return; const mode = getSplitMode();
    if (mode === 'none') { download(`${sanitizeFilename(currentDatasetName()||'scrape')}.csv`, toCSV(rows), 'text/csv'); return; }
    if (mode === 'column') { const col = $('#splitColumn').value; if (!col) { download(`${sanitizeFilename(currentDatasetName()||'scrape')}.csv`, toCSV(rows), 'text/csv'); return; } const groups = {}; rows.forEach(r => { const key = sanitizeFilename(r[col] ?? 'unknown'); (groups[key] ||= []).push(r); }); Object.entries(groups).forEach(([key, arr]) => { download(`${sanitizeFilename(currentDatasetName()||'scrape')}_${key}.csv`, toCSV(arr), 'text/csv'); }); return; }
    if (mode === 'size') { const size = Math.max(1, parseInt($('#batchSize').value || '500', 10)); let idx = 0; let batch = 0; while (idx < rows.length) { const chunk = rows.slice(idx, idx + size); download(`${sanitizeFilename(currentDatasetName()||'scrape')}_batch_${++batch}.csv`, toCSV(chunk), 'text/csv'); idx += size; } return; }
}

// Heuristic cleaner: attempts to split long text blobs into name, title, description
function heuristicCleanPeople(rows){
    const results = [];
    const push = (name, title, description) => { if (name || title || description) results.push({ name, title, description }); };
    const linesplit = (s) => (s||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);

    rows.forEach(r => {
        const values = Object.values(r).filter(v => v && typeof v === 'string').join('\n');
        const lines = linesplit(values);
        // detect pattern: Section header, Name, Title, Bio...
        for (let i=0; i<lines.length; i++){
            // name candidates: two words with capital initials
            const nameMatch = lines[i].match(/^([A-Z][A-Za-z'\-]+\s+[A-Z][A-Za-z'\-]+).*$/);
            if (nameMatch){
                const name = nameMatch[1].trim();
                // title may be on previous or next line
                let title = '';
                if (i>0 && lines[i-1].length <= 40 && /[A-Za-z]/.test(lines[i-1])) title = lines[i-1];
                if (!title && i+1<lines.length && lines[i+1].length <= 60) title = lines[i+1];
                // description: subsequent lines until next likely name
                let j = i+1; const descParts=[];
                while (j<lines.length){
                    const nm = lines[j].match(/^([A-Z][A-Za-z'\-]+\s+[A-Z][A-Za-z'\-]+)/);
                    if (nm && descParts.length>0) break; // next person
                    if (!nm) descParts.push(lines[j]);
                    j++;
                }
                push(name, title, descParts.join(' '));
                i = j-1;
            }
        }
    });
    // de-dup similar consecutive entries
    const unique = []; const seen = new Set();
    results.forEach(p => { const key = `${p.name}|${p.title}`; if (!seen.has(key)) { seen.add(key); unique.push(p); } });
    return unique.length ? unique : rows;
}

function runClean(){
    if (!originalRows.length) return;
    originalRowsBackup = originalRowsBackup || JSON.parse(JSON.stringify(originalRows));
    // Try to detect if dataset contains bios with names
    const textBlob = originalRows.map(r=>Object.values(r).join(' ')).join(' ');
    const likelyPeople = /General Partner|CEO|Founder|Manager|Engineer|Officer|Partner|President/i.test(textBlob);
    let cleaned = originalRows;
    if (likelyPeople) cleaned = heuristicCleanPeople(originalRows);
    originalRows = cleaned;
    rebuildColumnsStateFromRows(originalRows);
    renderColumnsUI();
    refreshPreview();
    $('#revertBtn').style.display = 'inline-block';
}

function runRevert(){
    if (!originalRowsBackup) return;
    originalRows = JSON.parse(JSON.stringify(originalRowsBackup));
    originalRowsBackup = null;
    rebuildColumnsStateFromRows(originalRows);
    renderColumnsUI();
    refreshPreview();
    $('#revertBtn').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    $('#scrapeBtn').addEventListener('click', smartScrape);
    $('#optionsBtn').addEventListener('click', () => { const p = $('#refinePanel'); p.style.display = (p.style.display === 'none' || !p.style.display) ? 'block' : 'none'; updateSplitSubVisibility(); });
    $('#confirmExport').addEventListener('click', splitAndExportCSV);

    document.addEventListener('change', (e) => {
        if (e.target && (e.target.name === 'splitMode')) updateSplitSubVisibility();
        if (e.target && e.target.id === 'datasetSelect') { const ds = currentDataset(); loadDatasetIntoEditor(ds); }
    });

    $('#exportAll')?.addEventListener('click', () => { if (!allDatasets.length) return; allDatasets.forEach(ds => { const name = sanitizeFilename(ds.name || ds.id); if (ds.rows && ds.rows.length) download(`${name}.csv`, toCSV(ds.rows), 'text/csv'); }); });
    $('#cleanBtn')?.addEventListener('click', runClean);
    $('#revertBtn')?.addEventListener('click', runRevert);

    updateSplitSubVisibility();
});
