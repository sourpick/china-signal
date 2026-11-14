#!/usr/bin/env node
/* ============================================================
   中 SIGNAL 빌드 스크립트 (외부 라이브러리 없음)
   src/ 의 마크다운 글과 JSON 데이터를 읽어 dist/ 에 정적 HTML을 만듭니다.
   실행: node build.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'dist');

// 폴더 구조(src/posts, src/issues …)와, 모든 파일을 한 폴더에 둔 구조 둘 다 지원합니다.
// GitHub 웹에서 업로드하면 폴더가 사라지는 경우가 있어서입니다.
const NESTED = fs.existsSync(path.join(__dirname, 'src', 'site.json'));
const SRC = NESTED ? path.join(__dirname, 'src') : __dirname;
const NOT_POSTS = ['readme.md', 'about.md'];
const P = {
  site: path.join(SRC, 'site.json'),
  about: path.join(SRC, 'about.md'),
  postsDir: NESTED ? path.join(SRC, 'posts') : SRC,
  issuesDir: NESTED ? path.join(SRC, 'issues') : SRC,
  imagesDir: path.join(SRC, 'images'),
};

// ---------- 유틸 ----------
const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (rel, content) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const copyDir = (from, to) => {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const a = path.join(from, name), b = path.join(to, name);
    if (fs.statSync(a).isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
};
const splitList = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

// ---------- 프런트매터 ----------
function parsePost(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`프런트매터(--- ---)가 없습니다: ${file}`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 1 || line.trim().startsWith('#')) continue;
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  for (const key of ['title', 'slug', 'issue', 'type', 'category']) {
    if (!meta[key]) throw new Error(`'${key}' 항목이 필요합니다: ${path.basename(file)}`);
  }
  meta.tags = splitList(meta.tags);
  meta.keywords = splitList(meta.keywords);
  meta.stats = meta.stats
    ? meta.stats.split(';;').map((s) => { const [v, l] = s.split('|'); return { value: (v || '').trim(), label: (l || '').trim() }; })
    : [];
  meta.read = meta.read || '';
  meta.body = m[2];
  return meta;
}

// ---------- 마크다운 (필요한 만큼만) ----------
function inline(text) {
  let s = esc(text);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|[^)\s]+)\)/g, (_, t, u) => {
    const ext = /^https?:/.test(u);
    return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
  });
  return s;
}

function listHTML(lines, ordered) {
  const tag = ordered ? 'ol' : 'ul';
  const items = lines.map((l) => `<li>${inline(l.replace(/^(\d+\.|-)\s+/, ''))}</li>`).join('');
  return `<${tag}>${items}</${tag}>`;
}

function blockHTML(block) {
  const lines = block.split('\n');
  const first = lines[0];
  if (/^###\s/.test(first)) return `<h3>${inline(first.replace(/^###\s+/, ''))}</h3>`;
  if (/^##\s/.test(first)) {
    const t = first.replace(/^##\s+/, '');
    const n = t.match(/^(\d{2})\s+(.*)$/);
    return n ? `<h2><span class="num">${n[1]}</span>${inline(n[2])}</h2>` : `<h2>${inline(t)}</h2>`;
  }
  if (lines.every((l) => /^>\s?/.test(l))) {
    return `<blockquote><p>${lines.map((l) => inline(l.replace(/^>\s?/, ''))).join('<br>')}</p></blockquote>`;
  }
  if (lines.every((l) => /^-\s/.test(l))) return listHTML(lines, false);
  if (lines.every((l) => /^\d+\.\s/.test(l))) return listHTML(lines, true);
  return `<p>${lines.map(inline).join('<br>')}</p>`;
}

function customBlock(kind, content) {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  if (kind === 'summary') {
    return `<div class="summary"><p class="eyebrow">3줄 요약</p>${listHTML(lines, true)}</div>`;
  }
  if (kind === 'stats') {
    const src = lines.find((l) => l.startsWith('source:'));
    const items = lines.filter((l) => !l.startsWith('source:')).map((l) => {
      const [v, t] = l.split('|');
      return `<div class="number"><b>${inline(v.trim())}</b><p>${inline((t || '').trim())}</p></div>`;
    }).join('');
    return `<figure class="stats">${items}${src ? `<figcaption>출처: ${inline(src.replace('source:', '').trim())}</figcaption>` : ''}</figure>`;
  }
  if (kind === 'checklist') {
    return `<div class="checklist"><p class="eyebrow">MARKETER CHECKLIST</p>${listHTML(lines, false)}</div>`;
  }
  if (kind === 'note') return `<p class="note">${lines.map(inline).join('<br>')}</p>`;
  if (kind === 'refs') return `<div class="refs"><b>참고 자료</b>${listHTML(lines, false)}</div>`;
  return `<div class="${esc(kind)}">${markdown(content)}</div>`;
}

function markdown(src) {
  const out = [];
  const parts = src.split(/^:::(\w+)\s*\n([\s\S]*?)^:::\s*$/m);
  // parts: [text, kind, content, text, kind, content, ...]
  for (let i = 0; i < parts.length; i += 3) {
    const text = parts[i] || '';
    for (const b of text.split(/\n\s*\n/)) if (b.trim()) out.push(blockHTML(b.trim()));
    if (parts[i + 1]) out.push(customBlock(parts[i + 1], parts[i + 2] || ''));
  }
  return out.join('\n');
}

// ---------- 데이터 읽기 ----------
const site = readJSON(P.site);
const catMap = Object.fromEntries(site.categories.map((c) => [c.id, c]));

const posts = fs.readdirSync(P.postsDir)
  .filter((f) => f.endsWith('.md') && !f.startsWith('_') && !NOT_POSTS.includes(f.toLowerCase()))
  .map((f) => parsePost(path.join(P.postsDir, f)))
  .sort((a, b) => (b.issue + (b.date || '')).localeCompare(a.issue + (a.date || '')));

const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
for (const p of posts) {
  if (!catMap[p.category]) throw new Error(`없는 카테고리 '${p.category}' (${p.slug}). site.json의 categories를 확인하세요.`);
}

const issues = fs.readdirSync(P.issuesDir)
  .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
  .map((f) => readJSON(path.join(P.issuesDir, f)))
  .sort((a, b) => b.id.localeCompare(a.id));
const issue = issues[0];
const pick = (slug) => {
  const p = bySlug[slug];
  if (!p) throw new Error(`issues/${issue.id}.json 에서 찾을 수 없는 글: '${slug}'`);
  return p;
};

const nextMonth = (id) => {
  let [y, m] = id.split('-').map(Number);
  m += 1; if (m > 12) { m = 1; y += 1; }
  return `${y}.${String(m).padStart(2, '0')}`;
};

// ---------- 심볼: 리본 말풍선 中 ----------
// 한 장의 리본이 접혀 말풍선(口)이 되고, 세로획(丨)이 그 위를 지나가며 中이 됩니다.
// color: 리본 색, shade: 접힌 부분 그림자 색 (지정하지 않으면 리본 색에 맞춰 자동)
const RIBBON_RING = 'M432 402 H818 A130 130 0 0 1 948 532 V655 A130 130 0 0 1 818 785 H458 L310 890 L352 772 A130 130 0 0 1 302 655 V532 A130 130 0 0 1 432 402 Z ' +
  'M443 507 A45 45 0 0 0 398 552 V718 Q430 680 488 680 H808 A45 45 0 0 0 853 635 V552 A45 45 0 0 0 808 507 Z';
const RIBBON_SHADE = { '#FFF4E6': ['#E39A8C', 1], '#C8102E': ['#5E0412', 0.8], '#F3F2EF': ['#9A8F86', 0.8] };
let symbolId = 0;
function symbol({ color = '#C8102E', shade, label = '', cls = '' } = {}) {
  const id = 'sym' + (++symbolId);
  const [sc, k] = shade ? [shade, 1] : (RIBBON_SHADE[color] || ['#000000', 0.25]);
  const a11y = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"';
  const lg = (g, x1, y1, x2, y2, stops) =>
    `<linearGradient id="${id}${g}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
    stops.map(([o, a]) => `<stop offset="${o}" stop-color="${sc}" stop-opacity="${(a * k).toFixed(2)}"/>`).join('') + '</linearGradient>';
  return `<svg class="symbol ${cls}" viewBox="280 200 700 780" ${a11y}><defs>` +
    lg('t', 380, 0, 860, 0, [[0, 0], [0.4, 0.7], [0.62, 0.6], [1, 0]]) +
    lg('b', 430, 0, 860, 0, [[0, 0], [0.32, 0.55], [0.55, 0.5], [0.78, 0.45], [1, 0]]) +
    lg('l', 395, 520, 330, 690, [[0, 0.7], [0.45, 0.25], [1, 0]]) +
    lg('r', 860, 660, 935, 520, [[0, 0.65], [0.5, 0.25], [1, 0]]) +
    lg('p', 0, 500, 0, 660, [[0, 0.1], [0.35, 0.45], [1, 0]]) +
    `<clipPath id="${id}c"><path d="${RIBBON_RING}" clip-rule="evenodd"/></clipPath></defs>` +
    `<path d="${RIBBON_RING}" fill="${color}" fill-rule="evenodd"/>` +
    `<g clip-path="url(#${id}c)"><rect x="300" y="400" width="650" height="108" fill="url(#${id}t)"/>` +
    `<rect x="300" y="679" width="650" height="110" fill="url(#${id}b)"/>` +
    `<rect x="300" y="505" width="100" height="215" fill="url(#${id}l)"/>` +
    `<rect x="852" y="505" width="98" height="180" fill="url(#${id}r)"/></g>` +
    `<rect x="577" y="222" width="97" height="740" rx="48.5" fill="${color}"/>` +
    `<rect x="577" y="500" width="97" height="160" fill="url(#${id}p)"/></svg>`;
}
const LOGO_MARK = () => `<span class="logo__mark">${symbol({ color: '#FFF4E6' })}</span>`;

// ---------- 공통 조각 ----------
const ICON_ARROW = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const ICON_SEARCH = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';

const postUrl = (p, root) => `${root}posts/${p.slug}.html`;
const tileStyle = (p) => {
  const bg = !p.coverBg || p.coverBg === 'accent' ? 'var(--accent)' : p.coverBg;
  const fg = p.coverFg || 'var(--cream)';
  return `--tile-bg:${esc(bg)};--tile-fg:${esc(fg)}`;
};
const tileImg = (p, root) => (p.image ? `<img class="tile__img" src="${root}images/${esc(p.image)}" alt="">` : '');
const tileClass = (p) => (p.image ? ' tile--has-img' : '');
const catLabel = (p) => catMap[p.category].name;

function layout({ title, description, root, active, body }) {
  const pageTitle = title ? `${title} — ${site.name}` : `${site.name} — ${site.tagline}`;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description || site.description)}">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(description || site.description)}">
<meta property="og:type" content="website">
${site.googleVerification ? `<meta name="google-site-verification" content="${esc(site.googleVerification)}">\n` : ''}${site.naverVerification ? `<meta name="naver-site-verification" content="${esc(site.naverVerification)}">\n` : ''}<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800;900&family=Noto+Sans+KR:wght@400;500;700;900&family=Noto+Serif+KR:wght@400;600;700;900&family=Noto+Serif+SC:wght@700;900&display=swap">
<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${root}assets/style.css">
</head>
<body>
<div class="ticker"><div class="wrap">
  <span class="ticker__badge">THIS MONTH</span>
  <a class="ticker__text" href="${postUrl(pick(issue.ticker.post), root)}">${esc(issue.ticker.text)}</a>
  <span class="ticker__vol">VOL.${String(issue.vol).padStart(2, '0')} · ${esc(issue.label)}</span>
</div></div>
<header class="site-header"><div class="wrap">
  <a class="logo" href="${root}index.html" aria-label="中SIGNAL 홈">${LOGO_MARK()}SIGNAL</a>
  <nav class="nav" aria-label="주요 메뉴">
    <a href="${postUrl(pick(issue.cover), root)}"${active === 'report' ? ' aria-current="page"' : ''}>월간 리포트</a>
    <a href="${root}archive.html#trend">트렌드</a>
    <a href="${root}index.html#case">K-브랜드 케이스</a>
    <a href="${root}archive.html"${active === 'archive' ? ' aria-current="page"' : ''}>아카이브</a>
    <a href="${root}brand.html"${active === 'brand' ? ' aria-current="page"' : ''}>브랜드 스토리</a>
    <a href="${root}about.html"${active === 'about' ? ' aria-current="page"' : ''}>About</a>
  </nav>
  <div class="header-actions">
    <button class="icon-btn" type="button" aria-label="검색" aria-expanded="false" aria-controls="search" data-search-toggle>${ICON_SEARCH}</button>
    <a class="btn" href="${root}index.html#subscribe">구독하기</a>
  </div>
</div>
<div class="wrap search-panel" id="search">
  <label class="sr-only" for="search-input">글 검색</label>
  <input id="search-input" type="search" placeholder="키워드로 검색 (예: 샤오홍슈, 뷰티)" autocomplete="off">
  <ul class="search-results" data-search-results></ul>
</div>
</header>
${body}
<footer class="site-footer"><div class="wrap" id="about">
  <div class="about">
    <a class="logo" href="${root}index.html" aria-label="中SIGNAL 홈">${LOGO_MARK()}SIGNAL</a>
    <p>${esc(site.author)} · ${esc(site.role)}. ${esc(site.bio)}</p>
  </div>
  <nav aria-label="연락처">
    <a href="${root}brand.html">브랜드 스토리</a>
    <a href="${root}about.html">About</a>
    ${site.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join('\n    ')}
    <span>${esc(site.email)}</span>
  </nav>
  <p class="copy">© ${new Date().getFullYear()} ${esc(site.author)}. 각 수치의 출처는 글마다 표기했습니다.</p>
</div></footer>
<script>window.SITE_ROOT = ${JSON.stringify(root)};</script>
<script src="${root}assets/search-index.js"></script>
<script src="${root}assets/main.js"></script>
</body>
</html>
`;
}

function card(p, root) {
  const thumb = p.coverStat
    ? `<div class="tile card__thumb${tileClass(p)}" style="${tileStyle(p)}" aria-hidden="true">${tileImg(p, root)}<span class="big">${esc(p.coverStat)}</span><span class="cap">${esc(p.coverStatCap || '')}</span></div>`
    : `<div class="tile card__thumb${tileClass(p)}" style="${tileStyle(p)}" aria-hidden="true">${tileImg(p, root)}<span class="tile__char">${esc(p.cover || '')}</span></div>`;
  return `<a class="card" href="${postUrl(p, root)}" data-cat="${esc(p.category)}">
  ${thumb}
  <div class="card__body">
    <span class="pill">${esc(catLabel(p))}</span>
    <h3>${esc(p.title)}</h3>
    <p>${esc(p.dek || '')}</p>
    ${p.source ? `<p class="source">출처: ${esc(p.source)}</p>` : ''}
  </div>
</a>`;
}

function rowCard(p, root, n) {
  return `<a class="card card--row" href="${postUrl(p, root)}" data-cat="${esc(p.category)}">
  <div class="tile card__thumb${tileClass(p)}" style="${tileStyle(p)}" aria-hidden="true">${tileImg(p, root)}<span class="tile__char">${esc(p.cover || '')}</span></div>
  <div class="card__body">
    <span class="pill">${esc(catLabel(p))}${n ? ` · CASE ${String(n).padStart(2, '0')}` : ''}</span>
    <h3>${esc(p.title)}</h3>
    <p>${esc(p.dek || '')}</p>
  </div>
</a>`;
}

function chips(root, { asButtons = false } = {}) {
  const counts = {};
  for (const p of posts) counts[p.category] = (counts[p.category] || 0) + 1;
  const all = asButtons
    ? `<button type="button" class="chip" data-filter="all"><span class="chip__dot" style="--chip-bg:var(--accent);color:#fff">全</span>전체 <span class="chip__count">${posts.length}</span></button>`
    : `<a class="chip chip--dark" href="${root}archive.html"><span class="chip__dot" style="--chip-bg:var(--accent);color:#fff">全</span>전체</a>`;
  const items = site.categories.map((c) => asButtons
    ? `<button type="button" class="chip" data-filter="${esc(c.id)}"><span class="chip__dot" style="--chip-bg:${esc(c.color)}" aria-hidden="true">${esc(c.han)}</span>${esc(c.name)} <span class="chip__count">${counts[c.id] || 0}</span></button>`
    : `<a class="chip" href="${root}archive.html#${esc(c.id)}"><span class="chip__dot" style="--chip-bg:${esc(c.color)}" aria-hidden="true">${esc(c.han)}</span>${esc(c.name)}</a>`);
  return `<nav class="chips" aria-label="카테고리">${all}${items.join('')}</nav>`;
}

function subscribe() {
  return `<section class="subscribe" id="subscribe">
  <span class="subscribe__char" aria-hidden="true">信号</span>
  <div>
    <p class="eyebrow">NEWSLETTER</p>
    <h2>매월 첫째 주, 중국 시장의 주요 트렌드와<br>인사이트를 전해드립니다.</h2>
  </div>
  <form data-subscribe${site.newsletterUrl ? ` data-url="${esc(site.newsletterUrl)}"` : ''}>
    <label class="sr-only" for="email">이메일 주소</label>
    <input id="email" name="email" type="email" placeholder="이메일 주소" required>
    <button class="btn" type="submit">구독하기</button>
    <p class="form-msg" role="status" aria-live="polite"></p>
  </form>
</section>`;
}

// ---------- 홈 ----------
function home() {
  const root = '';
  const cover = pick(issue.cover);
  const side = issue.heroSide.map(pick);
  const trending = issue.trending.map(pick);
  const fc = pick(issue.featureCase);
  const cases = issue.cases.map(pick);

  const body = `<main class="wrap">
  <section class="masthead">
    <h1>${symbol({ color: '#C8102E', label: '中', cls: 'masthead__symbol' })}SIGNAL</h1>
    <div class="masthead__intro">
      <p class="eyebrow">${esc(site.tagline)}</p>
      <p>${esc(site.description)}</p>
    </div>
  </section>

  <section class="hero" aria-label="이번 호 커버스토리">
    <a class="tile hero__main${tileClass(cover)}" style="${tileStyle(cover)}" href="${postUrl(cover, root)}">
      ${tileImg(cover, root)}
      <span class="tile__char" aria-hidden="true">${esc(cover.cover || '')}</span>
      <span class="hero__label">COVER STORY · VOL.${String(issue.vol).padStart(2, '0')}</span>
      <span class="pills">${cover.tags.map((t) => `<span class="pill">${esc(t)}</span>`).join('')}</span>
      <h2>${esc(cover.title)}</h2>
      <p>${esc(cover.dek || '')}</p>
      <span class="hero__cta">리포트 읽기 ${ICON_ARROW}</span>
    </a>
    <div class="hero__side">
      ${side.map((p) => `<a class="tile hero__sub${tileClass(p)}" style="${tileStyle(p)}" href="${postUrl(p, root)}">
        ${tileImg(p, root)}<span class="tile__char" aria-hidden="true">${esc(p.cover || '')}</span>
        <span class="meta">${esc(catLabel(p))}${p.tags[0] ? ` · ${esc(p.tags[0])}` : ''}</span>
        <h3>${esc(p.title)}</h3>
      </a>`).join('\n      ')}
    </div>
  </section>

  ${chips(root)}

  <section class="section" id="trend">
    <div class="section-bar">
      <h2><span class="en">TRENDING NOW</span><span class="ko">이번 달 놓치면 안 되는 신호</span></h2>
      <a class="more" href="archive.html">전체 보기 <span class="arrow">${ICON_ARROW}</span></a>
    </div>
    <div class="grid">
      ${trending.map((p) => card(p, root)).join('\n      ')}
    </div>
  </section>

  <section class="section" id="case">
    <div class="section-rule">
      <h2>K-BRAND CASE</h2>
      <p>한국 브랜드는 중국에서 어떻게 움직이고 있나</p>
    </div>
    <a class="feature-case" href="${postUrl(fc, root)}">
      <div class="tile feature-case__img${tileClass(fc)}" style="${tileStyle(fc)}" aria-hidden="true">
        ${tileImg(fc, root)}<span class="tile__char">${esc(fc.cover || '')}</span>
        <span class="label">CASE 01 · ${esc(catLabel(fc).toUpperCase())}</span>
      </div>
      <div class="feature-case__body">
        <span class="pills" style="margin:0">${[catLabel(fc), ...fc.tags].map((t) => `<span class="pill">${esc(t)}</span>`).join('')}</span>
        <h3>${esc(fc.title)}</h3>
        <p>${esc(fc.dek || '')}</p>
        ${fc.stats.length ? `<div class="stat-pair">${fc.stats.map((s) => `<div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('')}</div>` : ''}
        ${fc.insight ? `<div class="insight"><b>마케터의 시선</b><p>${esc(fc.insight)}</p></div>` : ''}
        ${fc.source ? `<p class="source">출처: ${esc(fc.source)}</p>` : ''}
      </div>
    </a>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
      ${cases.map((p, i) => rowCard(p, root, i + 2)).join('\n      ')}
    </div>
  </section>

  <section class="section split">
    <div class="split__main">
      <h2 style="margin:0 0 16px"><span class="h-en">NUMBERS OF THE MONTH</span> <span class="h-ko">이달의 숫자</span></h2>
      <div class="numbers">
        ${issue.numbers.map((n) => `<div class="number"><b>${esc(n.value)}</b><p>${esc(n.text)}</p><p class="source">출처: ${esc(n.source)}</p></div>`).join('\n        ')}
      </div>
    </div>
    <aside class="split__side" id="platform">
      <div class="box">
        <h2>PLATFORM GUIDE</h2>
        <ul class="list">
          ${site.platforms.map((pl) => `<li><a href="archive.html#platform">${esc(pl.name)} <span class="han">${esc(pl.han)}</span></a></li>`).join('\n          ')}
        </ul>
      </div>
      <div class="box">
        <h2>ARCHIVE</h2>
        <ul class="list">
          ${issues.map((is, i) => `<li><a class="${i === 0 ? 'current' : ''}" href="archive.html#issue-${esc(is.id)}">${esc(is.label)} · Vol.${String(is.vol).padStart(2, '0')} <span class="han">${esc(is.theme)}</span></a></li>`).join('\n          ')}
          <li><span class="row">${nextMonth(issue.id)} · Vol.${String(issue.vol + 1).padStart(2, '0')} <span style="font-size:13px">발행 예정</span></span></li>
        </ul>
      </div>
    </aside>
  </section>

  ${subscribe()}
</main>`;
  write('index.html', layout({ root, body }));
}

// ---------- 글 상세 ----------
function postPage(p) {
  const root = '../';
  const sameIssue = posts.filter((x) => x.issue === p.issue && x.slug !== p.slug).slice(0, 4);
  const iss = issues.find((i) => i.id === p.issue);
  const typeLabel = { report: 'COVER STORY', trend: 'TREND', case: 'K-BRAND CASE' }[p.type] || p.type.toUpperCase();
  const body = `<main class="wrap">
  <section class="post-head">
    <p class="crumbs"><a href="${root}index.html">홈</a> / <a href="${root}archive.html#${esc(p.category)}">${esc(catLabel(p))}</a> / ${esc(iss ? iss.label : p.issue)}</p>
    <div class="pills"><span class="pill">${typeLabel}</span>${p.tags.map((t) => `<span class="pill">${esc(t)}</span>`).join('')}</div>
    <h1>${esc(p.title)}</h1>
    ${p.dek ? `<p class="dek">${esc(p.dek)}</p>` : ''}
    <p class="byline">글 ${esc(site.author)} · ${esc((p.date || p.issue).replace(/-/g, '.'))}${p.read ? ` · ${esc(p.read)}분 읽기` : ''}</p>
  </section>
  <div class="tile post-cover${tileClass(p)}" style="${tileStyle(p)}" aria-hidden="true">
    ${tileImg(p, root)}
    ${p.coverStat ? `<span class="tile__char" style="font-family:var(--font-display);letter-spacing:-.04em">${esc(p.coverStat)}</span>` : `<span class="tile__char">${esc(p.cover || '')}</span>`}
    ${p.coverLabel ? `<span class="label">${esc(p.coverLabel)}</span>` : ''}
  </div>
  <div class="post-layout">
    <article class="prose">
${markdown(p.body)}
    </article>
    <aside class="post-side">
      ${p.keywords.length ? `<div class="box"><h2>KEYWORDS</h2><div class="keywords">${p.keywords.map((k) => `<span>${esc(k)}</span>`).join('')}</div></div>` : ''}
      ${sameIssue.length ? `<div class="box related"><h2>이번 호 다른 글</h2>${sameIssue.map((x) => `<a href="${x.slug}.html">${esc(x.title)}</a>`).join('')}</div>` : ''}
      <a class="dark-link" href="${root}archive.html">아카이브 전체 보기 <span class="arrow arrow--accent">${ICON_ARROW}</span></a>
    </aside>
  </div>
  ${subscribe()}
</main>`;
  write(`posts/${p.slug}.html`, layout({ title: p.title, description: p.dek, root, active: p.type === 'report' ? 'report' : '', body }));
}

// ---------- 아카이브 ----------
function archive() {
  const root = '';
  const groups = issues.map((is) => {
    const list = posts.filter((p) => p.issue === is.id);
    if (!list.length) return '';
    return `<section class="issue-group" id="issue-${esc(is.id)}" data-issue>
    <h2><span class="h-en">${esc(is.label)}</span><span class="h-ko">Vol.${String(is.vol).padStart(2, '0')} · <span class="han">${esc(is.theme)}</span></span></h2>
    <div class="grid">
      ${list.map((p) => card(p, root)).join('\n      ')}
    </div>
  </section>`;
  }).join('\n  ');
  const body = `<main class="wrap">
  <section class="page-title">
    <h1>ARCHIVE</h1>
    <p>지금까지 발행한 리포트, 트렌드, K-브랜드 케이스를 모두 모았습니다. 카테고리를 눌러 골라 보세요.</p>
  </section>
  ${chips(root, { asButtons: true })}
  ${groups}
  <p class="empty" data-empty hidden>이 카테고리의 글은 준비 중입니다.</p>
</main>`;
  write('archive.html', layout({ title: '아카이브', root, active: 'archive', body }));
}

// ---------- About ----------
function about() {
  const root = '';
  const body = `<main class="wrap">
  <section class="page-title">
    <h1>ABOUT</h1>
    <p>${esc(site.description)}</p>
  </section>
  <div class="about-body">
    <article class="prose">
${markdown(fs.readFileSync(P.about, 'utf8'))}
    </article>
    <aside class="post-side">
      <div class="box">
        <h2>CONTACT</h2>
        <ul class="list">
          <li><span class="row" style="color:var(--ink)">이메일 <span>${esc(site.email)}</span></span></li>
          ${site.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)} <span aria-hidden="true">↗</span></a></li>`).join('\n          ')}
        </ul>
      </div>
    </aside>
  </div>
</main>`;
  write('about.html', layout({ title: 'About', root, active: 'about', body }));
}

// ---------- 브랜드 스토리 ----------
function brand() {
  const root = '';
  const meanings = [
    ['zhōng', '중국', '우리가 바라보는 시장', '중국 소비자와 플랫폼에서 일어나는 변화를 매달 기록해요.'],
    ['zhōng', '가운데', '우리가 서 있는 자리', '한국 본사와 중국 현지 사이, 그 한가운데에서 양쪽의 말을 잇는 사람이에요.'],
    ['zhòng', '적중하다', '우리가 일하는 방식', '中에는 “맞히다”, “적중하다”라는 뜻도 있어요. 시장의 변화를 정확히 포착하고 핵심을 짚어낸다는 의미를 담았습니다.'],
  ];
  const colors = [
    ['Signal Red', '#C8102E', '중국 시장이 보내는 신호. 가장 먼저 눈에 띄어야 하는 정보에 써요.', '#FFFFFF'],
    ['Ink', '#141414', '기록의 색. 본문과 데이터는 단단하고 차분하게.', '#FFFFFF'],
    ['Paper', '#F3F2EF', '아카이브의 바탕. 오래 읽어도 편한 종이 같은 배경이에요.', '#141414'],
    ['Cream', '#FFF4E6', '빨강 위에 올라가는 심볼과 글자의 색이에요.', '#141414'],
  ];
  const body = `<main class="wrap">
  <section class="brand-hero">
    <div class="brand-hero__mark">${symbol({ color: '#FFF4E6', label: '中SIGNAL 심볼, 리본 말풍선 中' })}</div>
    <div class="brand-hero__text">
      <p class="eyebrow">BRAND STORY</p>
      <h1><span class="han">中</span>SIGNAL</h1>
      <p class="brand-hero__tag">중국 시장의 신호를 읽고,<br>그 중심에서 변화의 의미를 정확히 짚어냅니다.</p>
      <p class="brand-hero__en">Read China First.</p>
    </div>
  </section>

  <section class="brand-sec">
    <div class="brand-sec__head"><span class="num">01</span><h2>이름 · 中 한 글자에 담긴 세 가지 의미</h2></div>
    <div class="meaning-grid">
      ${meanings.map(([py, ko, role, text]) => `<article class="meaning">
        <span class="meaning__han">中</span>
        <p class="meaning__py">${py} · ${ko}</p>
        <h3>${role}</h3>
        <p>${text}</p>
      </article>`).join('\n      ')}
    </div>
    <p class="brand-quote">여기에 SIGNAL을 붙이면 이렇게 읽혀요.<br><b>"중국 시장의 신호를, 한가운데에서 읽고, 정확히 맞힌다."</b></p>
  </section>

  <section class="brand-sec">
    <div class="brand-sec__head"><span class="num">02</span><h2>	심볼 · 목소리와 신호가 만나는 中</h2></div>
    <div class="formula" aria-label="말풍선과 세로획이 만나 中이 되는 과정">
      <div class="formula__item"><svg viewBox="280 200 700 780" aria-hidden="true"><path d="${RIBBON_RING}" fill="#141414" fill-rule="evenodd"/></svg><span>말풍선 · 口</span><small>중국 소비자의 목소리</small></div>
      <span class="formula__op">+</span>
      <div class="formula__item"><svg viewBox="280 200 700 780" aria-hidden="true"><rect x="577" y="222" width="97" height="740" rx="48.5" fill="#141414"/></svg><span>세로획 · 丨</span><small>그 목소리를 꿰뚫는 신호</small></div>
      <span class="formula__op">=</span>
      <div class="formula__item formula__item--result">${symbol({ color: '#C8102E' })}<span>中</span><small>중국 시장의 목소리가 신호가 되는 순간</small></div>
    </div>
    <p class="brand-text">한 장의 리본이 부드럽게 접혀 말풍선(口)이 되고, 세로획(丨)이 그 위를 곧게 지나가며 中이 완성돼요. 리본은 끊기지 않고 이어지는 대화를, 세로획은 그 대화를 꿰뚫는 신호를 뜻해요. 중국 시장이 하는 말을 가장 먼저 듣고, 그 안에서 핵심을 찾아낸다는 의미를 담았습니다.</p>
  </section>

  <section class="brand-sec">
    <div class="brand-sec__head"><span class="num">03</span><h2>컬러</h2></div>
    <div class="color-grid">
      ${colors.map(([name, hex, text, fg]) => `<div class="color">
        <div class="color__chip" style="background:${hex};color:${fg}"><b>${name}</b><span>${hex}</span></div>
        <p>${text}</p>
      </div>`).join('\n      ')}
    </div>
  </section>

  <section class="brand-sec">
    <div class="brand-sec__head"><span class="num">04</span><h2>로고 사용</h2></div>
    <div class="usage-grid">
      <div class="usage" style="background:#C8102E;color:#FFF4E6">${symbol({ color: '#FFF4E6' })}<span class="usage__word"><span class="han">中</span>SIGNAL</span><small>기본 · 빨강 바탕</small></div>
      <div class="usage" style="background:#FFFFFF">${symbol({ color: '#C8102E' })}<span class="usage__word"><span class="han" style="color:#C8102E">中</span>SIGNAL</span><small>밝은 바탕</small></div>
      <div class="usage" style="background:#141414;color:#F3F2EF">${symbol({ color: '#F3F2EF' })}<span class="usage__word"><span class="han" style="color:#FF5A6A">中</span>SIGNAL</span><small>어두운 바탕</small></div>
    </div>
  </section>

  <section class="brand-sec brand-mission">
    <div class="brand-sec__head"><span class="num">05</span><h2>왜 만들었나</h2></div>
    <p>본사의 메시지가 중국 소비자에게 제대로 닿게, 중국 소비자의 목소리가 본사에 제대로 들리게.<br>그 사이에서 매달 신호를 읽고 기록하는 일, 그게 中SIGNAL이에요.</p>
    <a class="btn" href="${root}archive.html">아카이브 보러 가기</a>
  </section>
</main>`;
  write('brand.html', layout({ title: '브랜드 스토리', description: '中SIGNAL의 이름, 심볼, 컬러에 담긴 이야기', root, active: 'brand', body }));
}

// ---------- 파비콘 ----------
function favicon() {
  const mark = symbol({ color: '#FFF4E6' }).replace(/class="symbol [^"]*" /, '').replace('aria-hidden="true"', 'x="22" y="22" width="156" height="156"');
  write('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="44" fill="#C8102E"/>${mark}</svg>\n`);
}

// ---------- 검색 색인 ----------
function searchIndex() {
  const idx = posts.map((p) => ({
    t: p.title, d: p.dek || '', c: catLabel(p), k: [...p.tags, ...p.keywords].join(' '),
    u: `posts/${p.slug}.html`, i: p.issue.replace('-', '.'),
  }));
  write('assets/search-index.js', `window.SEARCH_INDEX = ${JSON.stringify(idx)};\n`);
}

// ---------- 사이트맵 (검색엔진 등록용) ----------
function sitemap() {
  if (!site.url) return;
  const base = site.url.endsWith('/') ? site.url : site.url + '/';
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: base, lastmod: today },
    { loc: base + 'archive.html', lastmod: today },
    { loc: base + 'about.html', lastmod: today },
    { loc: base + 'brand.html', lastmod: today },
    ...posts.map((p) => ({ loc: `${base}posts/${p.slug}.html`, lastmod: p.date || today })),
  ];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${esc(u.lastmod)}</lastmod></url>`).join('\n')}
</urlset>
`);
}

// ---------- 실행 ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
if (NESTED) {
  copyDir(path.join(SRC, 'assets'), path.join(OUT, 'assets'));
} else {
  fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
  for (const f of ['style.css', 'main.js']) fs.copyFileSync(path.join(SRC, f), path.join(OUT, 'assets', f));
}
copyDir(P.imagesDir, path.join(OUT, 'images'));
home();
archive();
about();
brand();
favicon();
posts.forEach(postPage);
searchIndex();
sitemap();
write('.nojekyll', '');
console.log(`✓ 빌드 완료: 글 ${posts.length}개, 호 ${issues.length}개 → dist/`);
