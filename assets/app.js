/* 题库浏览器：多维筛选 + 搜索 + 增量渲染 + KaTeX 公式渲染。
   数据由 assets/data.js 以 window.KY_DATA 形式提供（file:// 下也能用，不依赖 fetch）。 */
(function () {
  "use strict";

  var DATA = window.KY_DATA;
  if (!DATA || !Array.isArray(DATA.questions)) return;
  window.__KY_RENDER_MANAGED__ = true; /* 由本脚本负责列表公式渲染，math.js 不再全页扫描 */

  var ALL = DATA.questions;
  var KY = window.KYSearch;
  var STARS = window.KYStars;
  if (KY) {
    var textOf = function (html) { return String(html || "").replace(/<[^>]+>/g, " "); };
    ALL.forEach(function (q) { q._search = KY.prepare(q, textOf); });
  }
  var PAGE = 40;
  var KEYS = ["school", "answer_state", "subject", "year", "l1", "l2", "form"];
  /* 筛选键 → 记录字段：院校的筛选值用中文校名，记录里同时有 slug(school) 与校名(school_name) */
  var FIELD = { school: "school_name" };
  var state = { q: "", sort: "year-desc", onlyStars: false };
  KEYS.forEach(function (k) { state[k] = {}; });

  var params = new URLSearchParams(window.location.search);
  KEYS.forEach(function (k) {
    params.getAll(k).forEach(function (v) { state[k][v] = true; });
    var single = params.get(k);
    if (single) state[k][single] = true;
  });
  if (params.get("q")) state.q = params.get("q");
  if (params.get("sort")) state.sort = params.get("sort");
  if (params.get("stars") === "1") state.onlyStars = true;

  var el = {
    list: document.getElementById("qlist"),
    count: document.getElementById("count"),
    more: document.getElementById("more"),
    empty: document.getElementById("empty"),
    q: document.getElementById("q"),
    sort: document.getElementById("sort"),
    reset: document.getElementById("reset"),
    l2wrap: document.getElementById("l2opts")
  };
  var shown = PAGE;

  /* ---------- 筛选控件 ---------- */
  document.querySelectorAll(".facet").forEach(function (facet) {
    var key = facet.dataset.facet;
    facet.querySelectorAll(".opt").forEach(function (opt) {
      var val = opt.dataset.value;
      if (state[key][val]) opt.classList.add("on");
      opt.addEventListener("click", function (event) {
        event.preventDefault();
        if (state[key][val]) { delete state[key][val]; opt.classList.remove("on"); }
        else { state[key][val] = true; opt.classList.add("on"); }
        shown = PAGE;
        syncL2();
        update();
      });
    });
  });

  /* 选了「一级」之后，二级只显示对应细目 */
  function syncL2() {
    var picked = Object.keys(state.l1);
    if (!el.l2wrap) return;
    el.l2wrap.querySelectorAll(".opt").forEach(function (opt) {
      var parent = opt.dataset.l1;
      var visible = picked.length === 0 || picked.indexOf(parent) >= 0;
      opt.style.display = visible ? "" : "none";
      if (!visible && state.l2[opt.dataset.value]) {
        delete state.l2[opt.dataset.value];
        opt.classList.remove("on");
      }
    });
  }

  if (el.q) {
    el.q.value = state.q;
    var timer = null;
    el.q.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        state.q = el.q.value.trim();
        shown = PAGE;
        update();
      }, 180);
    });
  }
  if (el.sort) {
    el.sort.value = state.sort;
    el.sort.addEventListener("change", function () { state.sort = el.sort.value; shown = PAGE; update(); });
  }
  if (el.reset) {
    el.reset.addEventListener("click", function () {
      KEYS.forEach(function (k) { state[k] = {}; });
      state.q = "";
      state.onlyStars = false;
      if (el.q) el.q.value = "";
      document.querySelectorAll(".opt.on").forEach(function (o) { o.classList.remove("on"); });
      shown = PAGE;
      syncL2();
      paintStars();
      update();
    });
  }
  var starToggle = document.getElementById("only-stars");
  function paintStars() {
    var n = STARS ? STARS.count() : 0;
    var inline = document.getElementById("stars-inline");
    if (inline) inline.textContent = n;
    if (starToggle) {
      starToggle.setAttribute("aria-pressed", state.onlyStars ? "true" : "false");
      starToggle.classList.toggle("primary", state.onlyStars);
    }
  }
  if (starToggle) {
    starToggle.addEventListener("click", function () {
      state.onlyStars = !state.onlyStars;
      shown = PAGE;
      paintStars();
      update();
    });
  }
  if (el.more) {
    el.more.addEventListener("click", function () { shown += PAGE; render(); });
  }

  /* ---------- 组卷打印：把当前筛选结果整理成一份练习卷 ---------- */
  var printBtn = document.getElementById("print-filtered");
  var printHead = document.getElementById("print-head");

  function filterSummary() {
    var parts = [];
    KEYS.forEach(function (k) {
      var picked = Object.keys(state[k]);
      if (picked.length) parts.push(picked.join("、"));
    });
    if (state.q) parts.push("关键词「" + state.q + "」");
    if (state.onlyStars) parts.push("仅收藏");
    return parts.length ? parts.join(" · ") : "全部题目";
  }

  function updatePrintHead() {
    if (!printHead) return;
    printHead.innerHTML = "";
    var t = document.createElement("div");
    t.className = "t";
    t.textContent = "练习卷 · " + filterSummary();
    var s = document.createElement("div");
    s.className = "s";
    s.textContent = "共 " + filtered.length + " 题 · 打印时间 " + new Date().toLocaleString("zh-CN");
    printHead.appendChild(t);
    printHead.appendChild(s);
  }

  if (printBtn) {
    printBtn.addEventListener("click", function () {
      var prevShown = shown;
      var restored = false;
      function restore() {
        if (restored) return;
        restored = true;
        shown = prevShown;
        render();
      }
      shown = filtered.length; /* 打印必须包含全部筛选结果，而不是当前这一屏 */
      render();
      updatePrintHead();
      /* 恢复时机要小心：Chrome 的 print() 阻塞到对话框关闭，Safari/Firefox 立即返回。
         若在 print() 返回后立刻恢复，非阻塞浏览器会把打印内容截回一屏（40 条）。
         浏览器在打开打印预览时已抓取 DOM 快照，所以延迟恢复是安全的。 */
      window.addEventListener("afterprint", restore, { once: true });
      window.print();
      setTimeout(restore, 15000); /* 兜底：个别浏览器不派发 afterprint */
    });
  }

  /* ---------- 过滤与排序 ---------- */
  function yearOf(y) { var m = String(y).match(/\d{4}/); return m ? parseInt(m[0], 10) : 0; }

  function match(q) {
    if (state.onlyStars && !(STARS && STARS.has(q.qid))) return false;
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i];
      var picked = Object.keys(state[k]);
      if (picked.length && picked.indexOf(String(q[FIELD[k] || k])) < 0) return false;
    }
    q._hit = null;
    if (state.q) {
      if (!KY) return false;
      var hit = KY.match(q, KY.normalize(state.q), KY.normalizeStrict(state.q));
      if (hit.score <= 0) return false;
      q._hit = hit.field;
    }
    return true;
  }

  function sortFn(a, b) {
    /* 有搜索词且用户没显式改排序时，先按相关度 */
    if (state.q && state.sort === "year-desc" && (b._score || 0) !== (a._score || 0)) {
      return (b._score || 0) - (a._score || 0);
    }
    switch (state.sort) {
      case "year-asc": return yearOf(a.year) - yearOf(b.year) || a.source_row - b.source_row;
      case "l1": return a.l1.localeCompare(b.l1, "zh") || yearOf(b.year) - yearOf(a.year);
      case "form": return a.form.localeCompare(b.form, "zh") || yearOf(b.year) - yearOf(a.year);
      default: return yearOf(b.year) - yearOf(a.year) || a.source_row - b.source_row;
    }
  }

  var filtered = [];

  function chip(text, cls) {
    var s = document.createElement("span");
    s.className = "chip " + (cls || "");
    s.textContent = text;
    return s;
  }

  function card(q) {
    var art = document.createElement("article");
    art.className = "qcard";

    var meta = document.createElement("div");
    meta.className = "qmeta";
    var no = document.createElement("span");
    no.className = "no";
    no.textContent = q.year + " · " + q.section + q.number;
    meta.appendChild(no);
    var sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = "|";
    meta.appendChild(sep);
    var subj = document.createElement("span");
    subj.className = "t";
    subj.textContent = q.subject;
    meta.appendChild(subj);
    /* 多校时在元信息里显示院校；单校不显示，避免每张卡都重复同一个校名 */
    if (DATA.meta && DATA.meta.multi_school && q.school_name) {
      var sc = document.createElement("span");
      sc.className = "t school";
      sc.textContent = "· " + q.school_name;
      meta.appendChild(sc);
    }
    art.appendChild(meta);

    var stem = document.createElement("div");
    stem.className = "stem";
    stem.innerHTML = q.stem_display;
    art.appendChild(stem);

    var foot = document.createElement("div");
    foot.className = "foot";
    var a1 = document.createElement("a");
    a1.href = "q/" + q.qid + ".html";
    a1.appendChild(chip(q.l1, "accent"));
    foot.appendChild(a1);
    if (q.l2) foot.appendChild(chip(q.l2));
    foot.appendChild(chip(q.form, "ghost"));
    if (q.has_answer) foot.appendChild(chip("含解析", "accent"));
    if (q._hit === "tag") foot.appendChild(chip("命中知识点", "accent"));
    else if (q._hit === "meta") foot.appendChild(chip("命中备注/年份", "accent"));
    if (STARS) {
      var starred = STARS.has(q.qid);
      var star = document.createElement("button");
      star.type = "button";
      star.className = "btn small star-btn" + (starred ? " on" : "");
      star.setAttribute("aria-label", starred ? "取消收藏" : "收藏此题");
      star.textContent = starred ? "★" : "☆";
      star.addEventListener("click", function () {
        var now = STARS.toggle(q.qid);
        star.textContent = now ? "★" : "☆";
        star.classList.toggle("on", now);
        star.setAttribute("aria-label", now ? "取消收藏" : "收藏此题");
        paintStars();
        if (state.onlyStars) update();
      });
      foot.appendChild(star);
    }
    var link = document.createElement("a");
    link.href = "q/" + q.qid + ".html";
    link.className = "small";
    link.style.marginLeft = "auto";
    link.textContent = "查看详情 →";
    foot.appendChild(link);
    art.appendChild(foot);
    return art;
  }

  function render() {
    var slice = filtered.slice(0, shown);
    var frag = document.createDocumentFragment();
    slice.forEach(function (q) { frag.appendChild(card(q)); });
    el.list.textContent = "";
    el.list.appendChild(frag);

    if (window.renderMathInElement) {
      /* 注意：fragment 追加后已被清空，必须对真实容器调用渲染 */
      window.renderMathInElement(el.list, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false }
        ],
        throwOnError: false,
        ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"]
      });
    }
    el.more.hidden = filtered.length <= shown;
    el.empty.hidden = filtered.length !== 0;
    if (filtered.length === 0) {
      var active = [];
      KEYS.forEach(function (k) {
        var picked = Object.keys(state[k]);
        if (picked.length) active.push(picked.join("、"));
      });
      if (state.q) active.push('搜索"' + state.q + '"');
      el.empty.innerHTML = active.length
        ? "没有匹配的题目。当前条件：" + active.join(" ／ ") + "<br><br><button class=\"btn small\" id=\"empty-reset\">清空条件</button>"
        : "没有匹配的题目，试试放宽筛选条件。";
      var btn = document.getElementById("empty-reset");
      if (btn) btn.addEventListener("click", function () { if (el.reset) el.reset.click(); });
    }
  }

  function update() {
    filtered = ALL.filter(match).sort(sortFn);
    if (state.q && KY) {
      filtered.forEach(function (q) {
        q._score = KY.match(q, KY.normalize(state.q), KY.normalizeStrict(state.q)).score;
      });
      filtered.sort(sortFn);
    }
    el.count.textContent = filtered.length + " / " + ALL.length + " 题";
    syncUrl();
    render();
  }

  function syncUrl() {
    var p = new URLSearchParams();
    KEYS.forEach(function (k) {
      Object.keys(state[k]).forEach(function (v) { p.append(k, v); });
    });
    if (state.q) p.set("q", state.q);
    if (state.sort !== "year-desc") p.set("sort", state.sort);
    if (state.onlyStars) p.set("stars", "1");
    var qs = p.toString();
    history.replaceState(null, "", qs ? "?" + qs : location.pathname);
  }

  syncL2();
  paintStars();
  update();
})();
