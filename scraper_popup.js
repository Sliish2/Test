const $ = sel => document.querySelector(sel);

let allDatasets = []; // [{id,type,name,rows}]
let originalRows = [];
let originalRowsBackup = null;
let columnsState = { order: [], visible: {} };
let isLoading = false;
let currentOperation = null;

async function getActiveTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error('No active tab found');
        return tab;
    } catch (error) {
        console.error('Failed to get active tab:', error);
        throw new Error('Unable to access the current tab. Please refresh and try again.');
    }
}

function showError(message, details = '') {
    const errorEl = $('#error');
    errorEl.textContent = details ? `${message}: ${details}` : message;
    errorEl.style.display = 'block';
    setTimeout(() => {
        if (errorEl.style.display === 'block') {
            errorEl.style.display = 'none';
        }
    }, 8000);
}

function showProgress(show = true, text = '') {
    const container = $('#progressContainer');
    const bar = $('#progressBar');
    const info = $('#info');
    
    if (show) {
        container.style.display = 'block';
        bar.className = 'progress-bar indeterminate';
        if (text) info.textContent = text;
        isLoading = true;
    } else {
        container.style.display = 'none';
        bar.className = 'progress-bar';
        bar.style.width = '0%';
        isLoading = false;
        info.textContent = 'Grant access to this site if prompted.';
    }
}

function updateStats(rows) {
    const statsGrid = $('#statsGrid');
    if (!rows || !rows.length) {
        statsGrid.style.display = 'none';
        return;
    }
    
    const totalRows = rows.length;
    const headers = Object.keys(rows[0] || {});
    const totalCols = headers.length;
    
    // Count unique data types
    const dataTypes = new Set();
    headers.forEach(header => {
        if (header.endsWith('_type')) {
            rows.forEach(row => {
                if (row[header]) dataTypes.add(row[header]);
            });
        }
    });
    
    $('#totalRows').textContent = totalRows.toLocaleString();
    $('#totalCols').textContent = totalCols;
    $('#dataTypes').textContent = dataTypes.size || 1;
    
    statsGrid.style.display = 'grid';
}

function addDataTypeIndicators(headers) {
    return headers.map(header => {
        // Detect data type from header name patterns
        const lowerHeader = header.toLowerCase();
        let type = 'text';
        
        if (lowerHeader.includes('email')) type = 'email';
        else if (lowerHeader.includes('phone') || lowerHeader.includes('tel')) type = 'phone';
        else if (lowerHeader.includes('url') || lowerHeader.includes('link')) type = 'url';
        else if (lowerHeader.includes('date') || lowerHeader.includes('time')) type = 'date';
        else if (lowerHeader.includes('price') || lowerHeader.includes('cost') || lowerHeader.includes('amount')) type = 'currency';
        else if (lowerHeader.includes('rating') || lowerHeader.includes('score')) type = 'rating';
        else if (lowerHeader.includes('number') || lowerHeader.includes('count')) type = 'number';
        
        return { name: header, type };
    });
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
    const preview = $('#preview');
    const table = $('#previewTable');
    table.innerHTML = '';
    
    if (!rows || !rows.length) {
        preview.style.display = 'none';
        $('#summary').style.display = 'block';
        $('#summary').textContent = 'No data detected on this page.';
        $('#statsGrid').style.display = 'none';
        return;
    }
    
    const headers = Object.keys(rows[0]);
    const headersWithTypes = addDataTypeIndicators(headers);
    
    // Create enhanced table headers
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    
    headersWithTypes.forEach(headerInfo => {
        const th = document.createElement('th');
        th.innerHTML = `${headerInfo.name} <span class="data-type-indicator ${headerInfo.type}" title="${headerInfo.type}"></span>`;
        trh.appendChild(th);
    });
    
    thead.appendChild(trh);
    table.appendChild(thead);
    
    // Create table body with enhanced data display
    const tbody = document.createElement('tbody');
    const displayRows = rows.slice(0, 200);
    
    displayRows.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            const value = row[header] ?? '';
            const dataType = row[header + '_type'] || 'text';
            
            // Format cell content based on data type
            if (dataType === 'url' && value) {
                td.innerHTML = `<a href="${value}" target="_blank" style="color: #4fc3f7;">${value.length > 30 ? value.substring(0, 30) + '...' : value}</a>`;
            } else if (dataType === 'email' && value) {
                td.innerHTML = `<a href="mailto:${value}" style="color: #ff9800;">${value}</a>`;
            } else if (dataType === 'phone' && value) {
                td.innerHTML = `<a href="tel:${value}" style="color: #4caf50;">${value}</a>`;
            } else if (dataType === 'currency' && value) {
                td.innerHTML = `<span style="color: #4caf50; font-weight: 600;">${value}</span>`;
            } else if (dataType === 'rating' && value) {
                td.innerHTML = `<span style="color: #ffc107;">${value}</span>`;
            } else {
                td.textContent = String(value);
                if (String(value).length > 50) {
                    td.title = String(value);
                    td.textContent = String(value).substring(0, 50) + '...';
                }
            }
            
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    
    // Update UI elements
    const truncatedText = displayRows.length < rows.length ? ` (showing ${displayRows.length})` : '';
    $('#summary').style.display = 'block';
    $('#summary').textContent = `${rows.length} rows • ${headers.length} columns${meta?.autoScrolled ? ' • auto-scrolled' : ''}${truncatedText}`;
    
    updateStats(rows);
    preview.style.display = 'block';
    
    // Enhanced export handlers
    $('#exportCsv').onclick = async () => {
        try {
            showProgress(true, 'Preparing CSV...');
            await new Promise(resolve => setTimeout(resolve, 100)); // Allow UI update
            download(`${sanitizeFilename(currentDatasetName()||'scrape')}.csv`, toCSV(getRefinedRows()), 'text/csv');
            showProgress(false);
        } catch (error) {
            showError('Export failed', error.message);
            showProgress(false);
        }
    };
    
    $('#exportJson').onclick = async () => {
        try {
            showProgress(true, 'Preparing JSON...');
            await new Promise(resolve => setTimeout(resolve, 100));
            download(`${sanitizeFilename(currentDatasetName()||'scrape')}.json`, JSON.stringify(getRefinedRows(), null, 2), 'application/json');
            showProgress(false);
        } catch (error) {
            showError('Export failed', error.message);
            showProgress(false);
        }
    };
    
    $('#copyClipboard').onclick = async () => {
        try {
            showProgress(true, 'Copying to clipboard...');
            const data = getRefinedRows();
            await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            $('#summary').textContent = `${rows.length} rows • Copied to clipboard`;
            showProgress(false);
            setTimeout(() => {
                $('#summary').textContent = `${rows.length} rows • ${headers.length} columns${truncatedText}`;
            }, 2000);
        } catch (error) {
            showError('Copy failed', 'Unable to copy to clipboard');
            showProgress(false);
        }
    };
    
    // Fullscreen preview handler
    $('#previewFullscreen').onclick = () => {
        try {
            const data = getRefinedRows();
            const newWindow = window.open('', '_blank', 'width=1200,height=800');
            newWindow.document.write(`
                <!DOCTYPE html>
                <html><head><title>Data Preview - ${currentDatasetName() || 'Scraped Data'}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5; }
                    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; position: sticky; top: 0; }
                    tr:hover { background: #f8f9fa; }
                    .stats { margin-bottom: 20px; background: white; padding: 16px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                </style></head><body>
                <div class="stats">
                    <h1>${currentDatasetName() || 'Scraped Data'}</h1>
                    <p>${data.length} rows × ${Object.keys(data[0] || {}).length} columns</p>
                </div>
                <table>${table.outerHTML}</table>
                </body></html>
            `);
        } catch (error) {
            showError('Preview failed', 'Unable to open fullscreen preview');
        }
    };
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
    if (isLoading) return;
    
    try {
        showProgress(true, 'Analyzing page structure...');
        $('#error').style.display = 'none';
        $('#summary').style.display = 'none';
        $('#preview').style.display = 'none';
        $('#statsGrid').style.display = 'none';
        
        currentOperation = 'scraping';
        const tab = await getActiveTab();
        
        showProgress(true, 'Requesting permissions...');
        try {
            await chrome.permissions.request({ origins: [new URL(tab.url).origin + '/*'] });
        } catch (permError) {
            throw new Error('Permission denied. Please grant access to this site.');
        }
        
        showProgress(true, 'Injecting content script...');
        await ensureInjection(tab.id);
        
        showProgress(true, 'Extracting data from page...');
        const result = await chrome.tabs.sendMessage(tab.id, { action: 'SMART_SCRAPE' });
        
        if (!result || !result.success) {
            throw new Error(result?.error || 'Failed to extract data from page');
        }
        
        showProgress(true, 'Processing results...');
        populateDatasetsUI(result.datasets || []);
        const dataset = currentDataset() || { rows: result.rows || [], name: 'scrape' };
        
        $('#optionsBtn').style.display = 'inline-block';
        $('#refinePanel').style.display = 'none';
        updateSplitSubVisibility();
        loadDatasetIntoEditor(dataset);
        
        showProgress(false);
        
    } catch (error) {
        console.error('Smart scrape error:', error);
        showError('Scraping failed', error.message);
        showProgress(false);
    } finally {
        currentOperation = null;
    }
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

function analyzeDataset(rows) {
    if (!rows || !rows.length) return null;
    
    const headers = Object.keys(rows[0]);
    const analysis = {
        totalRows: rows.length,
        totalColumns: headers.length,
        dataTypes: {},
        nullValues: {},
        uniqueValues: {},
        patterns: []
    };
    
    // Analyze each column
    headers.forEach(header => {
        const values = rows.map(row => row[header]).filter(v => v != null && v !== '');
        const nullCount = rows.length - values.length;
        const uniqueCount = new Set(values).size;
        
        analysis.nullValues[header] = nullCount;
        analysis.uniqueValues[header] = uniqueCount;
        
        // Detect data types in the column
        const types = {};
        values.forEach(value => {
            const type = detectDataType(String(value));
            types[type] = (types[type] || 0) + 1;
        });
        
        analysis.dataTypes[header] = Object.keys(types).reduce((a, b) => types[a] > types[b] ? a : b);
        
        // Detect patterns
        if (analysis.dataTypes[header] === 'email') {
            analysis.patterns.push(`${header} contains email addresses`);
        }
        if (analysis.dataTypes[header] === 'url') {
            analysis.patterns.push(`${header} contains URLs`);
        }
        if (uniqueCount === 1) {
            analysis.patterns.push(`${header} has constant value`);
        }
        if (uniqueCount === rows.length) {
            analysis.patterns.push(`${header} has all unique values (potential ID)`);
        }
    });
    
    return analysis;
}

function showDataAnalysis(analysis) {
    if (!analysis) return;
    
    const analysisHTML = `
        <div class="data-card">
            <div class="data-card-header">
                <div class="data-card-title">Data Quality Analysis</div>
                <div class="data-card-meta">${analysis.totalRows} rows × ${analysis.totalColumns} columns</div>
            </div>
            <div style="margin-top: 12px;">
                <h4 style="margin-bottom: 8px; color: #fff; font-size: 12px;">Data Types by Column:</h4>
                ${Object.entries(analysis.dataTypes).map(([col, type]) => 
                    `<div style="font-size: 11px; color: #ddd; margin-bottom: 4px;">
                        <span class="data-type-indicator ${type}"></span> ${col}: ${type}
                    </div>`
                ).join('')}
                
                ${analysis.patterns.length > 0 ? `
                <h4 style="margin: 12px 0 8px 0; color: #fff; font-size: 12px;">Detected Patterns:</h4>
                ${analysis.patterns.map(pattern => 
                    `<div style="font-size: 11px; color: #a1a1a1; margin-bottom: 4px;">• ${pattern}</div>`
                ).join('')}
                ` : ''}
            </div>
        </div>
    `;
    
    // Show analysis in a temporary overlay or replace summary
    const summary = $('#summary');
    const originalContent = summary.innerHTML;
    summary.innerHTML = analysisHTML;
    summary.style.display = 'block';
    
    // Restore original content after 10 seconds
    setTimeout(() => {
        summary.innerHTML = originalContent;
    }, 10000);
}

document.addEventListener('DOMContentLoaded', () => {
    $('#scrapeBtn').addEventListener('click', smartScrape);
    $('#optionsBtn').addEventListener('click', () => { const p = $('#refinePanel'); p.style.display = (p.style.display === 'none' || !p.style.display) ? 'block' : 'none'; updateSplitSubVisibility(); });
    $('#confirmExport').addEventListener('click', splitAndExportCSV);

    document.addEventListener('change', (e) => {
        if (e.target && (e.target.name === 'splitMode')) updateSplitSubVisibility();
        if (e.target && e.target.id === 'datasetSelect') { const ds = currentDataset(); loadDatasetIntoEditor(ds); }
    });

    $('#exportAll')?.addEventListener('click', async () => {
        if (!allDatasets.length) return;
        try {
            showProgress(true, 'Exporting all datasets...');
            for (const ds of allDatasets) {
                const name = sanitizeFilename(ds.name || ds.id);
                if (ds.rows && ds.rows.length) {
                    download(`${name}.csv`, toCSV(ds.rows), 'text/csv');
                    await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between downloads
                }
            }
            showProgress(false);
        } catch (error) {
            showError('Export failed', error.message);
            showProgress(false);
        }
    });
    
    // Data analysis button handler
    $('#analyzeData')?.addEventListener('click', () => {
        const dataset = currentDataset();
        if (!dataset || !dataset.rows.length) return;
        
        const analysis = analyzeDataset(dataset.rows);
        showDataAnalysis(analysis);
    });
    $('#cleanBtn')?.addEventListener('click', runClean);
    $('#revertBtn')?.addEventListener('click', runRevert);

    updateSplitSubVisibility();
});
