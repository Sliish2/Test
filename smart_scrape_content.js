// Smart scrape content script (multi-section)
(function(){
    function getVisible(el){
        const r = el.getBoundingClientRect();
        return r.width>0 && r.height>0;
    }

    function text(t){ return (t?.innerText || t?.textContent || '').trim(); }

    function detectDataType(value) {
        if (!value || typeof value !== 'string') return 'text';
        const trimmed = value.trim();
        
        // Email detection
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'email';
        
        // Phone detection
        if (/^[\+]?[1-9]?[\d\s\-\(\)]{7,15}$/.test(trimmed.replace(/\s+/g, ''))) return 'phone';
        
        // URL detection
        if (/^https?:\/\//.test(trimmed)) return 'url';
        
        // Date detection (various formats)
        if (/^\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4}$|^\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2}$/.test(trimmed)) return 'date';
        
        // Price/Currency detection
        if (/^[\$\€\£\¥]?\d+([,.]\d{2,3})*([.,]\d{1,2})?[\$\€\£\¥]?$/.test(trimmed.replace(/\s/g, ''))) return 'currency';
        
        // Number detection
        if (/^\d+([.,]\d+)*$/.test(trimmed.replace(/\s/g, ''))) return 'number';
        
        // Rating/Score detection
        if (/^\d+(\.\d+)?\/\d+$|^\d+(\.\d+)?\s?(star|★|out of)/i.test(trimmed)) return 'rating';
        
        return 'text';
    }

    function extractRichData(element) {
        const data = {};
        
        // Extract structured data attributes
        ['data-price', 'data-rating', 'data-id', 'data-category', 'data-brand'].forEach(attr => {
            if (element.hasAttribute(attr)) {
                data[attr.replace('data-', '')] = element.getAttribute(attr);
            }
        });
        
        // Extract microdata
        if (element.hasAttribute('itemtype')) {
            data.itemtype = element.getAttribute('itemtype');
        }
        
        // Extract JSON-LD data
        const jsonLD = element.querySelector('script[type="application/ld+json"]');
        if (jsonLD) {
            try {
                data.structuredData = JSON.parse(jsonLD.textContent);
            } catch (e) {}
        }
        
        return data;
    }

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
                headers.push({ name, type: 'text' });
            });
        }
        const rows = [];
        const bodyRows = table.querySelectorAll('tbody tr, tr');
        bodyRows.forEach(tr=>{
            const cells = Array.from(tr.querySelectorAll('td,th'));
            if (!cells.length) return;
            const rec = {};
            const richData = extractRichData(tr);
            
            cells.forEach((td,i)=>{
                const header = headers[i] || { name: `col_${i+1}`, type: 'text' };
                const cellText = text(td);
                const dataType = detectDataType(cellText);
                
                rec[header.name] = cellText;
                rec[`${header.name}_type`] = dataType;
                
                // Enhanced link extraction
                const links = td.querySelectorAll('a[href]');
                if (links.length === 1) {
                    rec[`${header.name}_link`] = links[0].href;
                } else if (links.length > 1) {
                    rec[`${header.name}_links`] = Array.from(links).map(l => ({ text: text(l), href: l.href }));
                }
                
                // Enhanced image extraction
                const images = td.querySelectorAll('img[src]');
                if (images.length === 1) {
                    rec[`${header.name}_img`] = images[0].src;
                    if (images[0].alt) rec[`${header.name}_img_alt`] = images[0].alt;
                } else if (images.length > 1) {
                    rec[`${header.name}_imgs`] = Array.from(images).map(img => ({ src: img.src, alt: img.alt || '' }));
                }
                
                // Extract other media
                const video = td.querySelector('video[src], video source[src]');
                if (video) rec[`${header.name}_video`] = video.src || video.querySelector('source').src;
                
                // Extract form inputs
                const input = td.querySelector('input, select, textarea');
                if (input) {
                    rec[`${header.name}_input_type`] = input.type || input.tagName.toLowerCase();
                    if (input.value) rec[`${header.name}_input_value`] = input.value;
                }
            });
            
            // Add rich data to record
            Object.assign(rec, richData);
            
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
        const rows = items.map((it, index)=>{
            const rec = { _index: index };
            const mainText = text(it);
            rec.text = mainText;
            rec.text_type = detectDataType(mainText);
            
            // Enhanced link extraction
            const links = it.querySelectorAll('a[href]');
            if (links.length === 1) {
                rec.url = links[0].href;
                rec.link_text = text(links[0]);
            } else if (links.length > 1) {
                rec.urls = Array.from(links).map(a => ({ href: a.href, text: text(a) }));
            }
            
            // Enhanced image extraction
            const images = it.querySelectorAll('img[src]');
            if (images.length === 1) {
                rec.image = images[0].src;
                rec.image_alt = images[0].alt || '';
            } else if (images.length > 1) {
                rec.images = Array.from(images).map(img => ({ src: img.src, alt: img.alt || '' }));
            }
            
            // Enhanced price detection
            const priceSelectors = [
                '[class*="price" i]', '[data-price]', '.price', '[class*="cost" i]',
                '[class*="amount" i]', '[class*="fee" i]', '[aria-label*="price" i]'
            ];
            const priceEl = it.querySelector(priceSelectors.join(', '));
            if (priceEl) {
                rec.price = text(priceEl);
                rec.price_type = 'currency';
            }
            
            // Enhanced rating detection
            const ratingSelectors = [
                '[class*="rating" i]', '[aria-label*="stars" i]', '[class*="score" i]',
                '[data-rating]', '[class*="review" i]'
            ];
            const ratingEl = it.querySelector(ratingSelectors.join(', '));
            if (ratingEl) {
                rec.rating = ratingEl.getAttribute('aria-label') || text(ratingEl);
                rec.rating_type = 'rating';
            }
            
            // Extract additional structured data
            const richData = extractRichData(it);
            Object.assign(rec, richData);
            
            // Extract contact information
            const emailEl = it.querySelector('a[href^="mailto:"]');
            if (emailEl) rec.email = emailEl.href.replace('mailto:', '');
            
            const phoneEl = it.querySelector('a[href^="tel:"]');
            if (phoneEl) rec.phone = phoneEl.href.replace('tel:', '');
            
            // Extract social media links
            const socialLinks = it.querySelectorAll('a[href*="facebook.com"], a[href*="twitter.com"], a[href*="linkedin.com"], a[href*="instagram.com"]');
            if (socialLinks.length) {
                rec.social_links = Array.from(socialLinks).map(link => ({
                    platform: link.href.includes('facebook') ? 'facebook' :
                             link.href.includes('twitter') ? 'twitter' :
                             link.href.includes('linkedin') ? 'linkedin' :
                             link.href.includes('instagram') ? 'instagram' : 'other',
                    url: link.href
                }));
            }
            
            // Extract dates
            const dateEl = it.querySelector('[datetime], [data-date], time');
            if (dateEl) {
                rec.date = dateEl.getAttribute('datetime') || dateEl.getAttribute('data-date') || text(dateEl);
                rec.date_type = 'date';
            }
            
            return Object.keys(rec).length > 1 ? rec : null; // > 1 because we always have _index
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

    function detectCardLayouts() {
        // Detect card-like layouts (common in modern web apps)
        const cardSelectors = [
            '[class*="card"]', '[class*="item"]', '[class*="post"]',
            '[class*="product"]', '[class*="result"]', '[class*="entry"]',
            '[data-testid*="card"]', '[data-testid*="item"]'
        ];
        
        const candidates = [];
        cardSelectors.forEach(selector => {
            const elements = Array.from(document.querySelectorAll(selector))
                .filter(el => getVisible(el) && el.children.length > 0);
            
            if (elements.length >= 3) {
                const container = elements[0].parentElement;
                if (container && !candidates.find(c => c.container === container)) {
                    candidates.push({
                        container,
                        elements,
                        score: siblingsSimilarityScore(elements),
                        type: 'cards'
                    });
                }
            }
        });
        
        return candidates.filter(c => c.score > 0.7);
    }
    
    function detectGridLayouts() {
        // Detect CSS Grid and Flexbox layouts
        const gridElements = Array.from(document.querySelectorAll('*'))
            .filter(el => {
                const style = window.getComputedStyle(el);
                return (style.display === 'grid' || style.display === 'flex') &&
                       el.children.length >= 3 && getVisible(el);
            });
            
        return gridElements.map(el => ({
            container: el,
            elements: Array.from(el.children).filter(getVisible),
            score: siblingsSimilarityScore(Array.from(el.children)),
            type: 'grid'
        })).filter(g => g.score > 0.6);
    }
    
    function extractFromCards(cardData) {
        return cardData.elements.map((card, index) => {
            const rec = { _index: index, _type: 'card' };
            
            // Extract common card elements
            const title = card.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="name"]');
            if (title) rec.title = text(title);
            
            const description = card.querySelector('p, [class*="description"], [class*="summary"]');
            if (description) rec.description = text(description);
            
            const image = card.querySelector('img[src]');
            if (image) {
                rec.image = image.src;
                if (image.alt) rec.image_alt = image.alt;
            }
            
            const link = card.querySelector('a[href]');
            if (link) rec.url = link.href;
            
            // Extract price/cost information
            const price = card.querySelector('[class*="price" i], [class*="cost" i], [data-price]');
            if (price) rec.price = text(price);
            
            // Extract rating/score information
            const rating = card.querySelector('[class*="rating" i], [class*="score" i], [aria-label*="star" i]');
            if (rating) rec.rating = rating.getAttribute('aria-label') || text(rating);
            
            // Extract any additional structured data
            const richData = extractRichData(card);
            Object.assign(rec, richData);
            
            // If no structured data found, fall back to all text content
            if (Object.keys(rec).length <= 3) { // _index, _type, and maybe one other field
                rec.text = text(card);
                rec.html = card.outerHTML;
            }
            
            return rec;
        }).filter(rec => Object.keys(rec).length > 2);
    }
    
    function detectSocialMediaContent() {
        // Detect common social media patterns
        const socialSelectors = [
            '[data-testid*="tweet"]', '[class*="tweet"]',
            '[class*="post"]', '[data-testid*="post"]',
            '[class*="story"]', '[class*="update"]'
        ];
        
        const socialElements = [];
        socialSelectors.forEach(selector => {
            const elements = Array.from(document.querySelectorAll(selector))
                .filter(getVisible);
            socialElements.push(...elements);
        });
        
        if (socialElements.length < 3) return [];
        
        return socialElements.map((el, index) => {
            const rec = { _index: index, _type: 'social' };
            
            // Extract user information
            const username = el.querySelector('[class*="username"], [class*="handle"], [data-testid*="username"]');
            if (username) rec.username = text(username);
            
            // Extract post content
            const content = el.querySelector('[class*="content"], [class*="text"], p');
            if (content) rec.content = text(content);
            
            // Extract timestamp
            const timestamp = el.querySelector('time, [class*="time"], [class*="date"]');
            if (timestamp) {
                rec.timestamp = timestamp.getAttribute('datetime') || 
                               timestamp.getAttribute('title') || 
                               text(timestamp);
            }
            
            // Extract engagement metrics
            const likes = el.querySelector('[aria-label*="like" i], [class*="like" i]');
            if (likes) rec.likes = text(likes);
            
            const shares = el.querySelector('[aria-label*="share" i], [class*="share" i], [aria-label*="retweet" i]');
            if (shares) rec.shares = text(shares);
            
            return rec;
        }).filter(rec => rec.content || rec.username);
    }

    async function smartScrape(){
        const meta = { autoScrolled:false };
        const datasets = [];

        // Enhanced table detection
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

        // Auto-scroll to load dynamic content
        meta.autoScrolled = await autoScroll(3) || meta.autoScrolled;
        
        // Enhanced card layout detection
        const cardLayouts = detectCardLayouts();
        let cIndex = 0;
        for (const cardData of cardLayouts) {
            const rows = extractFromCards(cardData);
            if (rows.length) {
                const name = headingNear(cardData.container) || `cards_${++cIndex}`;
                datasets.push({ id:`cards_${cIndex}`, type:'cards', name, rows });
                if (rows.length > bestRows.length) bestRows = rows;
            }
        }
        
        // Grid layout detection
        const gridLayouts = detectGridLayouts();
        let gIndex = 0;
        for (const gridData of gridLayouts) {
            const rows = extractListFromContainer(gridData.container);
            if (rows.length) {
                const name = headingNear(gridData.container) || `grid_${++gIndex}`;
                datasets.push({ id:`grid_${gIndex}`, type:'grid', name, rows });
                if (rows.length > bestRows.length) bestRows = rows;
            }
        }
        
        // Social media content detection
        const socialContent = detectSocialMediaContent();
        if (socialContent.length >= 3) {
            datasets.push({ id:'social', type:'social', name:'Social Media Posts', rows: socialContent });
            if (socialContent.length > bestRows.length) bestRows = socialContent;
        }

        // Original list-based detection (fallback)
        const listCandidates = nonOverlappingTopCandidates();
        let lIndex = 0;
        for (const node of listCandidates){
            // Skip if we already processed this as a card or grid
            const alreadyProcessed = datasets.some(ds => 
                ds.type === 'cards' || ds.type === 'grid'
            );
            if (alreadyProcessed) continue;
            
            const rows = extractListFromContainer(node);
            if (rows.length){
                const name = headingNear(node) || `list_${++lIndex}`;
                datasets.push({ id:`list_${lIndex}`, type:'list', name, rows });
                if (rows.length > bestRows.length) bestRows = rows;
            }
        }

        // Enhanced fallback: try structured data and links
        if (!datasets.length){
            // Look for JSON-LD structured data
            const jsonLDScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            const structuredData = [];
            
            jsonLDScripts.forEach((script, index) => {
                try {
                    const data = JSON.parse(script.textContent);
                    if (Array.isArray(data)) {
                        structuredData.push(...data.map((item, i) => ({ ...item, _index: i, _source: 'json-ld' })));
                    } else if (data && typeof data === 'object') {
                        structuredData.push({ ...data, _index: index, _source: 'json-ld' });
                    }
                } catch (e) {}
            });
            
            if (structuredData.length) {
                datasets.push({ id:'structured', type:'structured', name:'Structured Data', rows: structuredData });
                bestRows = structuredData;
            } else {
                // Final fallback: enhanced link extraction
                const links = Array.from(document.querySelectorAll('a[href]'))
                    .slice(0, 300)
                    .map((a, index) => {
                        const rec = {
                            _index: index,
                            title: text(a),
                            url: a.href,
                            _type: 'link'
                        };
                        
                        // Try to extract more context
                        const parent = a.closest('li, div, article, section');
                        if (parent && parent !== a) {
                            const contextText = text(parent);
                            if (contextText.length > rec.title.length) {
                                rec.context = contextText;
                            }
                        }
                        
                        return rec;
                    })
                    .filter(r => r.title || r.url);
                    
                if (links.length) {
                    datasets.push({ id:'links', type:'links', name:'Links', rows: links });
                    bestRows = links;
                }
            }
        }

        // Cap rows per dataset to avoid massive payloads
        datasets.forEach(d => {
            if (d.rows.length > 2000) {
                d.rows = d.rows.slice(0, 2000);
                d._truncated = true;
            }
        });

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
