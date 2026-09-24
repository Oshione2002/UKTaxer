import './styles.css';
import { calculators, categories, referenceAreas, getCalculator } from './catalog.js';
import { calculate, InputError, NATIONS, RULESET, TAX_YEAR } from './tax.js';

const app = document.querySelector('#app');
const state = { nation: localStorage.getItem('uktaxer-nation') || '', theme: localStorage.getItem('uktaxer-theme') || 'system', current: null, values: {}, output: null, law: null, lawCache: new Map(), search: '', linkedQueryRoute: '', area: 'all', doc: 'all', install: '' };
const fmt = n => `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const icon = name => ({ search: '⌕', arrow: '↗', chevron: '⌄', link: '↗', book: '▤', download: '↓', sparkle: '✦' })[name] || name;
const route = () => (location.hash || '#/').slice(1);
function setTheme() { document.documentElement.dataset.theme = state.theme; }
function nav(path) { location.hash = path; window.scrollTo({ top: 0, behavior: 'instant' }); }
function header() {
  return `<header class="site-header"><div class="header-inner"><a class="brand" href="#/" aria-label="UKTaxer home"><span class="brand-mark">U<span>K</span></span><span>UK<span>Taxer</span></span></a><nav class="main-nav" aria-label="Main navigation"><a href="#/" data-nav="home">Home</a><a href="#/calculators" data-nav="calculators">Calculators</a><a href="#/law" data-nav="law">Law library</a><a href="#/assistant" data-nav="assistant">AI helper</a><a href="#/" id="mobile-search" class="mobile-search">Search</a></nav><div class="header-actions"><button id="header-search" class="header-search" aria-label="Search UKTaxer">⌕</button><label class="nation-control"><span class="sr-only">UK nation</span><select id="nation" aria-label="UK nation"><option value="">Choose nation</option>${Object.entries(NATIONS).map(([id, label]) => `<option value="${id}" ${state.nation === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="theme-control"><span class="sr-only">Theme</span><select id="theme" aria-label="Theme"><option value="system" ${state.theme === 'system' ? 'selected' : ''}>System</option><option value="light" ${state.theme === 'light' ? 'selected' : ''}>Light</option><option value="dark" ${state.theme === 'dark' ? 'selected' : ''}>Dark</option></select></label><button id="menu-button" class="menu-button" aria-label="Toggle menu" aria-expanded="false">☰</button></div></div></header>`;
}
function footer() { return `<footer class="footer"><div class="container footer-inner"><div><strong>UKTaxer</strong><p>Clearer tax estimates for every UK nation.</p></div><div><span>Ruleset ${RULESET} · ${TAX_YEAR}</span><a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noopener">Open Government Licence ↗</a><span>Illustrative estimates. Review your circumstances before filing.</span></div></div></footer>`; }
function card(c) { return `<a class="calc-card" href="#/calculator/${c.id}"><span class="card-icon">${categories.find(x => x.id === c.category)?.icon || '◇'}</span><span><strong>${esc(c.title)}</strong><small>${esc(c.description)}</small></span><span class="card-arrow">↗</span></a>`; }
function home() {
  return `<main><section class="hero"><div class="container hero-grid"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span> BUILT FOR THE 2026–27 TAX YEAR</div><h1>Understand your tax.<br><em>Across the UK.</em></h1><p>Clear, source-linked estimates that update as you type. Explore the rules behind every number.</p><div class="hero-search"><span aria-hidden="true">⌕</span><input id="global-search" type="search" placeholder="Search a tax, calculator or law..." aria-label="Search UKTaxer"><kbd>⌘ K</kbd></div><div id="search-results" class="search-results" hidden></div><div class="hero-meta"><span>✓ Four UK nations</span><span>✓ Official sources</span><span>✓ Works offline</span></div></div><div class="hero-aside"><div class="preview-top"><span>LIVE ESTIMATE</span><span class="pulse">● LIVE</span></div><p>Annual salary · ${esc(NATIONS[state.nation] || 'Your nation')}</p><strong>See your take-home pay</strong><div class="preview-value">${state.nation ? fmt(calculate('salary', { gross: 42000 }, state.nation).net) : 'Choose a nation'}</div><div class="preview-bars"><span></span><span></span><span></span></div><a href="#/calculator/salary">Try the salary calculator <b>↗</b></a></div></div></section><section class="section container"><div class="section-heading"><div><span class="overline">FIND YOUR STARTING POINT</span><h2>What would you like to work out?</h2><p>Choose a tax area, then use a calculator or explore the law.</p></div><a href="#/calculators" class="text-link">View all calculators ↗</a></div><div class="category-grid">${categories.map(cat => `<a href="#/calculators?area=${cat.id}" class="category-card"><span class="category-icon">${cat.icon}</span><strong>${cat.title}</strong><small>${cat.subtitle}</small><span class="category-arrow">↗</span></a>`).join('')}</div></section><section class="section container feature-section"><div class="feature-panel"><div><span class="overline">BUILT FOR CONFIDENCE</span><h2>Every estimate has a trail.</h2><p>See the breakdown, assumptions, legal text and official rate guidance. Export a report for your records.</p><a class="button button-secondary" href="#/law">Explore the law library ↗</a></div><div class="feature-list"><div><b>01</b><span><strong>Type once</strong><small>Results change immediately, without a calculate button.</small></span></div><div><b>02</b><span><strong>See why</strong><small>Each estimate shows its inputs, assumptions and sources.</small></span></div><div><b>03</b><span><strong>Take it with you</strong><small>Download reports and install the library for offline use.</small></span></div></div></div></section></main>`;
}
function listing() {
  const area = new URLSearchParams(route().split('?')[1] || '').get('area') || 'all';
  const list = area === 'all' ? calculators : calculators.filter(c => c.category === area);
  return `<main class="container page"><div class="page-intro"><span class="overline">EXPLORE</span><h1>Tax calculators</h1><p>Estimates for defined situations, backed by official rules. Results update as you type.</p></div><div class="filter-row" aria-label="Tax area">${[['all','All'], ...categories.map(c => [c.id, c.title])].map(([id,label]) => `<a class="filter-chip ${area === id ? 'active' : ''}" href="#/calculators${id === 'all' ? '' : `?area=${id}`}">${label}</a>`).join('')}</div><div class="calculator-grid">${list.map(card).join('')}</div><div class="reference-block"><h2>More areas in the law library</h2><p>These areas have searchable source text. A reliable estimate needs more facts or specialist review.</p><div class="reference-grid">${referenceAreas.filter(a => area === 'all' || a.category === area).map(a => `<div class="reference-card"><strong>${a.title}</strong><small>${a.note}</small><a href="#/law">Explore law ↗</a></div>`).join('')}</div></div></main>`;
}
function field(f) {
  const value = state.values[f.id] ?? f.value;
  if (f.type === 'checkbox') return `<label class="check-field"><input name="${f.id}" type="checkbox" ${value ? 'checked' : ''}><span>${esc(f.label)}</span></label>`;
  if (f.type === 'select') return `<label class="field"><span>${esc(f.label)}</span><select name="${f.id}">${f.options.map(([id,label]) => `<option value="${id}" ${String(value) === id ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>`;
  return `<label class="field"><span>${esc(f.label)}</span><div class="input-wrap">${f.type === 'money' ? '<span>£</span>' : ''}<input name="${f.id}" type="number" inputmode="decimal" min="0" step="${f.type === 'number' ? '1' : '0.01'}" value="${esc(value)}" required></div></label>`;
}
function resultHTML(output) {
  if (!state.nation && getCalculator(state.current)?.nationSensitive) return `<div class="result-empty"><span>↗</span><h3>Choose your nation</h3><p>Select your UK nation in the header to see this estimate.</p><button class="button button-primary" id="choose-nation">Choose nation</button></div>`;
  if (output?.status === 'error') return `<div class="result-error" role="alert"><span>!</span><h3>Check your input</h3><p>${esc(output.message)}</p></div>`;
  if (output?.status === 'review') return `<div class="result-review"><span>◇ REVIEW NEEDED</span><h3>More facts are needed</h3><p>${esc(output.reason)}</p><div class="source-list">${output.sources.map((s,i) => `<a href="${esc(s)}" target="_blank" rel="noopener">Official source ${i + 1} ↗</a>`).join('')}</div></div>`;
  if (!output) return '';
  return `<div class="result-top"><span>ESTIMATED TAX</span><span class="live-label"><span></span> LIVE</span></div><div class="result-amount">${fmt(output.amount)}</div>${output.net !== undefined ? `<p class="result-net">Estimated take-home <strong>${fmt(output.net)}</strong></p>` : ''}${output.gross !== undefined ? `<p class="result-net">Price including VAT <strong>${fmt(output.gross)}</strong></p>` : ''}<div class="result-divider"></div><h3>Breakdown</h3><div class="breakdown">${output.breakdown.map(x => `<div><span>${esc(x.label)}</span><strong>${fmt(x.amount)}</strong></div>`).join('')}</div><div class="result-divider"></div><details><summary>Assumptions & sources</summary><ul>${output.assumptions.map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="source-list">${output.sources.map((s,i) => `<a href="${esc(s)}" target="_blank" rel="noopener">Official source ${i + 1} ↗</a>`).join('')}</div></details><div class="export-row"><button id="pdf-export">${icon('download')} PDF report</button><button id="excel-export">${icon('download')} Excel report</button></div>`;
}
function calculatorPage(id) {
  const c = getCalculator(id); if (!c) return notFound();
  if (state.current !== id) { state.current = id; state.values = Object.fromEntries(c.fields.map(f => [f.id, f.value])); }
  recalculate(c);
  return `<main class="container page calc-page"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="#/">Home</a><span>›</span><a href="#/calculators">Calculators</a><span>›</span>${esc(c.title)}</nav><div class="calc-title"><span class="overline">${esc(categories.find(x => x.id === c.category)?.title.toUpperCase())} · ${TAX_YEAR}</span><h1>${esc(c.title)}</h1><p>${esc(c.description)}</p></div><div class="calc-layout"><section class="form-panel"><div class="panel-heading"><div><span class="step">01</span><h2>Your details</h2></div><p>Figures are annual unless stated otherwise.</p></div><form id="calculator-form" novalidate>${c.fields.map(field).join('')}${!c.fields.length ? '<p class="muted">This area needs a reviewed calculation. Explore the source material below.</p>' : ''}</form><div class="form-foot"><span>✦</span> This estimate changes as you type. Nothing is sent to a server.</div></section><aside class="result-panel" id="main-result" aria-label="Tax estimate"><div id="result-content" aria-live="polite" aria-atomic="true">${resultHTML(state.output)}</div></aside></div><div class="below-calc"><div><span class="overline">THE RULES BEHIND IT</span><h2>Read the source</h2><p>Explore official law text and linked rate guidance for this estimate.</p></div><a href="#/law" class="button button-secondary">Open law library ↗</a></div><section class="related-section"><div><span class="overline">KEEP EXPLORING</span><h2>More ways to understand your tax</h2><p>Compare another scenario, inspect the legal text, or use the helper to understand an estimate.</p></div><div class="related-grid"><a href="#/calculators"><b>All calculators ↗</b><span>Explore personal, business, property and specialist tax.</span></a><a href="#/law"><b>Law library ↗</b><span>Search full official Acts and regulations by phrase.</span></a><a href="#/assistant"><b>AI helper ↗</b><span>Find the right calculator or explain a result.</span></a></div></section></main><button class="floating-result" id="floating-result" aria-label="Jump to full estimate"><span>LIVE ESTIMATE</span><strong id="floating-value">${state.output?.status === 'estimate' ? fmt(state.output.amount) : state.output?.status === 'review' ? 'Review needed' : 'Check input'}</strong><b>↗</b></button>`;
}
function recalculate(c) {
  try { state.output = state.nation || !c.nationSensitive ? calculate(c.id, state.values, state.nation || 'england') : null; }
  catch (e) { state.output = { status: 'error', message: e instanceof InputError ? e.message : 'Could not calculate this estimate.' }; }
}
async function saveReport(type) {
  const { exportPDF, exportExcel, download } = await import('./reports.js');
  const c = getCalculator(state.current);
  const blob = type === 'pdf' ? await exportPDF(c.title, state.nation, state.values, state.output) : await exportExcel(c.title, state.nation, state.values, state.output);
  download(blob, `UKTaxer-${c.id}.${type === 'pdf' ? 'pdf' : 'xlsx'}`);
}
function notFound() { return `<main class="container page"><h1>Page not found</h1><a href="#/">Return home ↗</a></main>`; }
function lawPage() {
  const linkedQuery = new URLSearchParams(route().split('?')[1] || '').get('q');
  if (linkedQuery !== null && state.linkedQueryRoute !== route()) { state.search = linkedQuery.slice(0, 120); state.linkedQueryRoute = route(); }
  return `<main class="container page law-page"><div class="page-intro"><span class="overline">OFFICIAL TEXT · LOCAL COPY</span><h1>Law library</h1><p>Search the complete in-scope Acts and read the provisions behind UKTaxer. The official links remain the authority.</p></div><div class="law-note">Contains public sector information licensed under the Open Government Licence v3.0. Revised text on legislation.gov.uk can have unapplied changes; check the linked official page for current legal effect.</div><div class="law-toolbar"><label class="law-search"><span>⌕</span><input id="law-search" type="search" placeholder="Search a phrase in legislation" value="${esc(state.search)}" aria-label="Search law text"></label><label><span class="sr-only">Tax area</span><select id="law-area"><option value="all">All tax areas</option>${categories.map(c => `<option value="${c.id}" ${state.area === c.id ? 'selected' : ''}>${c.title}</option>`).join('')}<option value="cross-cutting" ${state.area === 'cross-cutting' ? 'selected' : ''}>Cross-cutting</option></select></label><label><span class="sr-only">Document</span><select id="law-document"><option value="all">All documents</option>${(state.law?.documents || []).map(d => `<option value="${esc(d.id)}" ${state.doc === d.id ? 'selected' : ''}>${esc(d.title)}</option>`).join('')}</select></label></div><div id="law-status" class="law-status" role="status">${state.law ? `${state.law.documents.length} official documents · ${state.law.documents.reduce((n,d) => n + d.provisions,0).toLocaleString('en-GB')} provisions` : 'Loading library…'}</div><div id="law-results" class="law-results">${lawResults()}</div></main>`;
}
function lawResults() {
  if (!state.law) return '<div class="empty-box">Loading the law register…</div>';
  const docs = state.law.documents.filter(d => (state.area === 'all' || state.area === d.area) && (state.doc === 'all' || state.doc === d.id));
  if (!state.search.trim()) return docs.map(d => `<article class="document-card"><div><span class="doc-type">${d.id.startsWith('ssi/') ? 'SCOTTISH ORDER' : d.id.startsWith('wsi/') || d.id.startsWith('uksi/') ? 'STATUTORY INSTRUMENT' : 'ACT OF PARLIAMENT'}</span><h2>${esc(d.title)}</h2><p>${d.provisions.toLocaleString('en-GB')} provisions · Official text snapshot ${new Date(d.retrieved).toLocaleDateString('en-GB')}</p><div class="doc-actions"><button data-open-doc="${esc(d.id)}">Read in UKTaxer ↗</button><a href="${esc(d.source)}" target="_blank" rel="noopener">Official source ↗</a><a href="${esc(d.text)}" download>Full text ↓</a></div></div><span class="doc-badge">${esc(d.area)}</span></article>`).join('') || '<div class="empty-box">No documents match these filters.</div>';
  const q = state.search.trim().toLocaleLowerCase(); let matches = [];
  for (const d of docs) for (const s of state.lawCache.get(d.id) || []) if (`${s.heading} ${s.text}`.toLocaleLowerCase().includes(q)) { matches.push({ d, s }); if (matches.length >= 100) break; }
  return matches.map(({ d, s }) => `<article class="law-hit"><span>${esc(d.title)}</span><h2>${esc(s.heading)}</h2><p>${esc(s.text.slice(Math.max(0, s.text.toLocaleLowerCase().indexOf(q) - 100), Math.max(0, s.text.toLocaleLowerCase().indexOf(q) - 100) + 420))}${s.text.length > 420 ? '…' : ''}</p><a href="${esc(s.url)}" target="_blank" rel="noopener">Read official provision ↗</a></article>`).join('') || '<div class="empty-box">No matching provisions. Try another phrase or filter.</div>';
}
function assistantPage() { return `<main class="container page ai-page"><div class="page-intro"><span class="overline">GEMINI HELPER · ONLINE ONLY</span><h1>Ask UKTaxer</h1><p>Find the right calculator, ask about retrieved law, or explain an existing estimate. AI answers include source links and should be checked.</p></div><div class="ai-layout"><div class="ai-panel"><div class="mode-grid"><label><input type="radio" name="ai-mode" value="route" checked><span><b>Find a calculator</b><small>Describe what you want to estimate.</small></span></label><label><input type="radio" name="ai-mode" value="law"><span><b>Ask the law</b><small>Answer from retrieved provisions.</small></span></label><label><input type="radio" name="ai-mode" value="explain"><span><b>Explain a result</b><small>Understand your latest estimate.</small></span></label></div><label class="field"><span>Your question</span><textarea id="ai-question" rows="5" placeholder="For example, which tax applies when buying a home in Scotland?"></textarea></label><button id="ai-submit" class="button button-primary">Ask UKTaxer ✦</button><div id="ai-answer" class="ai-answer" role="status"></div></div><aside class="ai-context"><h2>How it works</h2><p>Calculator figures come from UKTaxer’s deterministic rules. Gemini is used to help you navigate and understand them.</p><p>Questions sent to Gemini are processed online. Do not enter names, account numbers or other personal information.</p><a href="#/law">Browse the law yourself ↗</a></aside></div></main>`; }
async function loadLaw() { if (state.law) return; try { const r = await fetch('/law/manifest.json'); if (!r.ok) throw new Error('Unavailable'); state.law = await r.json(); if (route().startsWith('/law')) render(); } catch { const el = document.querySelector('#law-status'); if (el) el.textContent = 'Law library could not be loaded. Check your connection or offline installation.'; } }
async function ensureLawIndexes() {
  if (!state.law) await loadLaw(); if (!state.law) return;
  const docs = state.law.documents.filter(d => (state.area === 'all' || state.area === d.area) && (state.doc === 'all' || state.doc === d.id));
  const status = document.querySelector('#law-status');
  for (const [i, d] of docs.entries()) if (!state.lawCache.has(d.id)) { if (status) status.textContent = `Searching document ${i + 1} of ${docs.length}…`; try { const r = await fetch(d.index); state.lawCache.set(d.id, await r.json()); } catch { if (status) status.textContent = `Could not load ${d.title}.`; } }
  if (status) status.textContent = `${docs.length} documents searched · Showing up to 100 matches`;
  const target = document.querySelector('#law-results'); if (target) target.innerHTML = lawResults();
}
function render() {
  const path = route(); let body;
  if (path === '/') body = home(); else if (path.startsWith('/calculator/')) body = calculatorPage(path.split('/')[2]); else if (path.startsWith('/calculators')) body = listing(); else if (path.startsWith('/law')) body = lawPage(); else if (path.startsWith('/assistant')) body = assistantPage(); else body = notFound();
  app.innerHTML = `${header()}<div id="main" tabindex="-1">${body}</div>${footer()}<div id="install-toast" class="install-toast" ${state.install ? '' : 'hidden'}>${esc(state.install)}</div>`;
  document.querySelectorAll('[data-nav]').forEach(link => { if ((link.dataset.nav === 'home' && path === '/') || (link.dataset.nav !== 'home' && path.startsWith(`/${link.dataset.nav}`))) link.setAttribute('aria-current', 'page'); });
  bind(); if (path.startsWith('/law')) { loadLaw(); if (state.search) ensureLawIndexes(); } if (path.startsWith('/calculator/')) setupFloating();
}
function bind() {
  document.querySelector('#header-search')?.addEventListener('click', () => { if (route() !== '/') nav('/'); setTimeout(() => document.querySelector('#global-search')?.focus(), 0); });
  document.querySelector('#mobile-search')?.addEventListener('click', () => setTimeout(() => document.querySelector('#global-search')?.focus(), 0));
  document.querySelector('#nation')?.addEventListener('change', e => { state.nation = e.target.value; localStorage.setItem('uktaxer-nation', state.nation); render(); });
  document.querySelector('#theme')?.addEventListener('change', e => { state.theme = e.target.value; localStorage.setItem('uktaxer-theme', state.theme); setTheme(); render(); });
  document.querySelector('#menu-button')?.addEventListener('click', e => { const nav = document.querySelector('.main-nav'); nav.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', nav.classList.contains('open')); });
  document.querySelector('#choose-nation')?.addEventListener('click', () => document.querySelector('#nation')?.focus());
  document.querySelector('#calculator-form')?.addEventListener('input', onInput);
  document.querySelector('#calculator-form')?.addEventListener('change', onInput);
  document.querySelector('#pdf-export')?.addEventListener('click', () => saveReport('pdf'));
  document.querySelector('#excel-export')?.addEventListener('click', () => saveReport('xlsx'));
  document.querySelector('#global-search')?.addEventListener('input', e => { const q = e.target.value.trim().toLowerCase(); const target = document.querySelector('#search-results'); if (!q) { target.hidden = true; return; } const hits = calculators.filter(c => `${c.title} ${c.description}`.toLowerCase().includes(q)).slice(0, 5); target.innerHTML = [...hits.map(c => `<a href="#/calculator/${c.id}">${esc(c.title)} <span>Calculator ↗</span></a>`), `<a href="#/law?q=${encodeURIComponent(q)}">Search “${esc(q)}” in law <span>Law library ↗</span></a>`].join(''); target.hidden = false; });
  document.querySelector('#law-search')?.addEventListener('input', e => { state.search = e.target.value; clearTimeout(window.lawTimer); window.lawTimer = setTimeout(() => state.search.trim() ? ensureLawIndexes() : document.querySelector('#law-results').innerHTML = lawResults(), 250); });
  document.querySelector('#law-area')?.addEventListener('change', e => { state.area = e.target.value; document.querySelector('#law-results').innerHTML = lawResults(); if (state.search) ensureLawIndexes(); });
  document.querySelector('#law-document')?.addEventListener('change', e => { state.doc = e.target.value; document.querySelector('#law-results').innerHTML = lawResults(); if (state.search) ensureLawIndexes(); });
  document.querySelector('#law-results')?.addEventListener('click', async e => { const button = e.target.closest('[data-open-doc]'); if (!button) return; const d = state.law.documents.find(x => x.id === button.dataset.openDoc); if (!state.lawCache.has(d.id)) { button.textContent = 'Loading…'; const r = await fetch(d.index); state.lawCache.set(d.id, await r.json()); } const sections = state.lawCache.get(d.id); const target = document.querySelector('#law-results'); target.innerHTML = `<div class="reader-header"><button id="back-law">← All documents</button><h2>${esc(d.title)}</h2><p>${sections.length.toLocaleString('en-GB')} provisions · <a href="${esc(d.source)}" target="_blank" rel="noopener">Official source ↗</a></p></div>${sections.map((s,i) => `<details class="reader-section" ${i === 0 ? 'open' : ''}><summary>${esc(s.heading)}</summary><p>${esc(s.text)}</p><a href="${esc(s.url)}" target="_blank" rel="noopener">Official provision ↗</a></details>`).join('')}`; document.querySelector('#back-law').addEventListener('click', () => target.innerHTML = lawResults()); });
  document.querySelector('#ai-submit')?.addEventListener('click', askAI);
}
function onInput(e) {
  const form = e.currentTarget, c = getCalculator(state.current);
  state.values = Object.fromEntries(c.fields.map(f => { const el = form.elements[f.id]; return [f.id, f.type === 'checkbox' ? el.checked : el.value]; }));
  recalculate(c);
  const target = document.querySelector('#result-content'); if (target) target.innerHTML = resultHTML(state.output);
  const floating = document.querySelector('#floating-value'); if (floating) floating.textContent = state.output?.status === 'estimate' ? fmt(state.output.amount) : state.output?.status === 'review' ? 'Review needed' : 'Check input';
  document.querySelector('#choose-nation')?.addEventListener('click', () => document.querySelector('#nation')?.focus());
  document.querySelector('#pdf-export')?.addEventListener('click', () => saveReport('pdf'));
  document.querySelector('#excel-export')?.addEventListener('click', () => saveReport('xlsx'));
}
function setupFloating() {
  const floating = document.querySelector('#floating-result'), main = document.querySelector('#main-result'); if (!floating || !main) return;
  const update = () => { const rect = main.getBoundingClientRect(); const visible = window.innerWidth <= 760 && (rect.top > window.innerHeight || rect.bottom < 78); floating.classList.toggle('visible', visible); floating.setAttribute('aria-hidden', String(!visible)); floating.tabIndex = visible ? 0 : -1; };
  update(); window.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update);
  floating.addEventListener('click', () => main.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }));
}
async function askAI() {
  const question = document.querySelector('#ai-question').value.trim(), mode = document.querySelector('input[name="ai-mode"]:checked').value, answer = document.querySelector('#ai-answer');
  if (!question) { answer.textContent = 'Enter a question first.'; return; }
  answer.textContent = 'Thinking…';
  try {
    const matches = mode === 'law' && state.law ? await retrieveLaw(question) : [];
    const response = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, question, matches, result: mode === 'explain' ? state.output : undefined, calculator: mode === 'explain' ? state.current : undefined }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Assistant unavailable');
    answer.innerHTML = `<p>${esc(data.answer).replaceAll('\n', '<br>')}</p>${(data.sources || []).map(s => `<a href="${esc(s)}" target="_blank" rel="noopener">Source ↗</a>`).join('')}`;
  } catch (e) { answer.textContent = e.message; }
}
async function retrieveLaw(question) {
  await loadLaw(); if (!state.law) return [];
  const words = question.toLowerCase().match(/[a-z]{4,}/g) || [];
  const hits = [];
  for (const d of state.law.documents) { if (!state.lawCache.has(d.id)) { try { state.lawCache.set(d.id, await (await fetch(d.index)).json()); } catch { continue; } } for (const s of state.lawCache.get(d.id)) { const text = `${s.heading} ${s.text}`.toLowerCase(); const score = words.reduce((n,w) => n + (text.includes(w) ? 1 : 0), 0); if (score) hits.push({ score, title: d.title, text: s.text.slice(0, 1200), url: s.url }); } }
  return hits.sort((a,b) => b.score - a.score).slice(0, 5);
}
function registerOffline() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', e => { const { type, done, total, error } = e.data || {}; if (type === 'progress') { state.install = `Saving offline library: ${done}/${total} files`; } else if (type === 'complete') state.install = 'Offline library ready'; else if (type === 'error') state.install = `Offline library could not finish: ${error}`; const toast = document.querySelector('#install-toast'); if (toast) { toast.hidden = !state.install; toast.textContent = state.install; } });
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
window.addEventListener('hashchange', render);
window.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (route() !== '/') nav('/'); setTimeout(() => document.querySelector('#global-search')?.focus(), 0); } });
setTheme(); render(); loadLaw(); registerOffline();




