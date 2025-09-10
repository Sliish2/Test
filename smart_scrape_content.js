// Smart scrape content script (multi-section)
(function(){
    function getVisible(el){
        const r = el.getBoundingClientRect();
        return r.width>0 && r.height>0;
    }

    function text(t){ return (t?.innerText || t?.textContent || '').trim(); }

    function headingNear(el){
        // Find a nearby heading to name a dataset
        let node = el; let tries = 0;
        while (node && tries++ < 4){
            const h = node.previousElementSibling && node.previousElementSibling.matches && node.previousElementSibling.matches('h1,h2,h3,h4,h5,h6') ? node.previousElementSibling : null;
            if (h) return text(h);
            node = node.parentElement;
        }
        const cap = el.querySelector && el.querySelector('caption');
        return cap ? text(cap) : '';
    }

    function extractTable(table){
        const headers = [];
        const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
        if (headerRow){
            headerRow.querySelectorAll('th,td').forEach((th,i)=>{
                const name = text(th) || `col_${i+1}`;
                headers.push(name);
            });
        }
        const rows = [];
        const bodyRows = table.querySelectorAll('tbody tr, tr');
        bodyRows.forEach(tr=>{
            const cells = Array.from(tr.querySelectorAll('td,th'));
            if (!cells.length) return;
            const rec = {};
            cells.forEach((td,i)=>{
                const h = headers[i] || `col_${i+1}`;
                rec[h] = text(td);
                const link = td.querySelector('a[href]'); if (link) rec[`${h}_link`] = link.href;
                const img = td.querySelector('img[src]'); if (img) rec[`${h}_img`] = img.src;
            });
            if (Object.values(rec).some(v=>String(v).trim())) rows.push(rec);
        });
        return rows;
    }

    function siblingsSimilarityScore(nodes){
        if (nodes.length<3) return 0;
        const sig = n => `${n.tagName}|${Array.from(n.classList).sort().join('.')}`;
        const map = {};
        nodes.forEach(n=>{ const s = sig(n); map[s]=(map[s]||0)+1; });
        const max = Math.max(...Object.values(map));
        return max / nodes.length;
    }

    function extractListFromContainer(container){
        const items = Array.from(container.children).filter(getVisible);
        const rows = items.map((it)=>{
            const rec = {};
            rec.text = text(it);
            const a = it.querySelector('a[href]'); if (a){ rec.url = a.href; rec.title = text(a) || rec.title; }
            const img = it.querySelector('img[src]'); if (img) rec.image = img.src;
            const price = it.querySelector('[class*="price" i], [data-price], .price'); if (price) rec.price = text(price);
            const rating = it.querySelector('[class*="rating" i], [aria-label*="stars" i]'); if (rating) rec.rating = (rating.getAttribute('aria-label')||text(rating));
            return Object.keys(rec).length ? rec : null;
        }).filter(Boolean);
        return rows;
    }

    function nonOverlappingTopCandidates(){
        // Pick several high-score containers across the page
        const all = Array.from(document.querySelectorAll('*'))
            .filter(n => n.children && n.children.length>=3 && getVisible(n))
            .map(n => ({ node:n, score: siblingsSimilarityScore(Array.from(n.children)) }));
        all.sort((a,b)=>b.score-a.score);
        const chosen = [];
        const seen = new Set();
        for (const c of all){
            if (c.score < 0.6) break;
            let skip = false;
            let p = c.node.parentElement;
            while (p){ if (seen.has(p)){ skip=true; break; } p = p.parentElement; }
            if (skip) continue;
            chosen.push(c);
            seen.add(c.node);
            if (chosen.length >= 4) break; // cap to keep result small
        }
        return chosen.map(c=>c.node);
    }

    async function autoScroll(limit=3){
        let autoScrolled=false;
        for (let i=0;i<limit;i++){
            const before = document.body.scrollHeight;
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            await new Promise(r=>setTimeout(r, 700));
            if (document.body.scrollHeight > before) autoScrolled=true; else break;
        }
        return autoScrolled;
    }

    async function smartScrape(){
        const meta = { autoScrolled:false };
        const datasets = [];

        // Collect visible tables
        const tables = Array.from(document.querySelectorAll('table')).filter(getVisible);
        let bestRows = [];
        let tIndex = 0;
        for (const t of tables){
            const rows = extractTable(t);
            if (rows.length){
                const name = headingNear(t) || `table_${++tIndex}`;
                datasets.push({ id:`table_${tIndex}`, type:'table', name, rows });
                if (rows.length > bestRows.length) bestRows = rows;
            }
        }

        // Try repeating lists (auto-scroll first)
        meta.autoScrolled = await autoScroll(3) || meta.autoScrolled;
        const listCandidates = nonOverlappingTopCandidates();
        let lIndex = 0;
        for (const node of listCandidates){
            const rows = extractListFromContainer(node);
            if (rows.length){
                const name = headingNear(node) || `list_${++lIndex}`;
                datasets.push({ id:`list_${lIndex}`, type:'list', name, rows });
                if (rows.length > bestRows.length) bestRows = rows;
            }
        }

        // Fallback: if nothing found, try a coarse text list of links
        if (!datasets.length){
            const links = Array.from(document.querySelectorAll('a[href]')).slice(0,300).map(a=>({ title:text(a), url:a.href })).filter(r=>r.title||r.url);
            if (links.length){ datasets.push({ id:'links', type:'links', name:'Links', rows:links }); bestRows = links; }
        }

        // Cap rows per dataset to avoid massive payloads
        datasets.forEach(d=>{ if (d.rows.length>2000) d.rows = d.rows.slice(0,2000); });

        return { rows: bestRows, meta, datasets };
    }

    chrome.runtime.onMessage.addListener((req, snd, sendResponse)=>{
        if (req.action === 'SMART_SCRAPE'){
            smartScrape().then(({rows, meta, datasets})=>sendResponse({ success:true, rows, meta, datasets }))
                         .catch(err=>sendResponse({ success:false, error: err.message }));
            return true;
        }
    });
})();
