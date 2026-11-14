/* 中 SIGNAL — 검색, 카테고리 필터, 구독 폼 */
(function () {
  var root = window.SITE_ROOT || '';

  // ---------- 검색 ----------
  var toggle = document.querySelector('[data-search-toggle]');
  var panel = document.getElementById('search');
  var input = document.getElementById('search-input');
  var results = document.querySelector('[data-search-results]');
  var index = window.SEARCH_INDEX || [];

  function escapeHTML(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function render(q) {
    q = q.trim().toLowerCase();
    if (!q) { results.innerHTML = ''; return; }
    var hits = index.filter(function (p) {
      return (p.t + ' ' + p.d + ' ' + p.c + ' ' + p.k).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 8);
    results.innerHTML = hits.length
      ? hits.map(function (p) {
          return '<li><a href="' + root + p.u + '">' + escapeHTML(p.t) + '<small>' + escapeHTML(p.c) + ' · ' + escapeHTML(p.i) + '</small></a></li>';
        }).join('')
      : '<li><a>검색 결과가 없습니다.</a></li>';
  }

  if (toggle && panel) {
    toggle.addEventListener('click', function () {
      var open = panel.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) input.focus();
    });
    input.addEventListener('input', function () { render(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { panel.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
    });
  }

  // ---------- 아카이브 카테고리 필터 (#beauty 같은 주소로 바로 열림) ----------
  var filters = document.querySelectorAll('[data-filter]');
  if (filters.length) {
    var empty = document.querySelector('[data-empty]');
    var apply = function (id) {
      var valid = Array.prototype.some.call(filters, function (b) { return b.dataset.filter === id; });
      if (!valid) id = 'all';
      filters.forEach(function (b) {
        var on = b.dataset.filter === id;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var shown = 0;
      document.querySelectorAll('[data-issue]').forEach(function (group) {
        var n = 0;
        group.querySelectorAll('[data-cat]').forEach(function (card) {
          var show = id === 'all' || card.dataset.cat === id;
          card.hidden = !show;
          if (show) n++;
        });
        group.hidden = n === 0;
        shown += n;
      });
      if (empty) empty.hidden = shown !== 0;
    };
    filters.forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.dataset.filter;
        try { history.replaceState(null, '', id === 'all' ? location.pathname : '#' + id); } catch (e) {}
        apply(id);
      });
    });
    var fromHash = function () {
      var h = location.hash.replace('#', '');
      if (h.indexOf('issue-') === 0) { apply('all'); return; }
      apply(h || 'all');
    };
    window.addEventListener('hashchange', fromHash);
    fromHash();
  }

  // ---------- 구독 폼 ----------
  document.querySelectorAll('[data-subscribe]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = form.querySelector('.form-msg');
      var url = form.dataset.url;
      if (url) {
        window.location.href = url;
        return;
      }
      msg.textContent = '뉴스레터는 준비 중입니다. 오픈하면 이 자리에서 바로 신청할 수 있어요.';
    });
  });
})();
