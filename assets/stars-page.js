/* 「我的收藏」页：从 data.js 里挑出被收藏的题目并按卡片渲染。
   渲染完成后自己调 KaTeX（本页列表是运行时生成的，math.js 扫描时它还不存在）。 */
(function () {
  "use strict";
  var list = document.getElementById("stars-list");
  var empty = document.getElementById("stars-empty");
  var counter = document.getElementById("stars-count");
  if (!list) return;

  var stars = window.KYStars;
  var data = window.KY_DATA;
  function refresh() {
    if (counter) counter.textContent = stars.count();
  }

  function render() {
    var ids = stars.all();
    var byId = {};
    (data && data.questions ? data.questions : []).forEach(function (q) { byId[q.qid] = q; });
    var items = ids.map(function (id) { return byId[id]; }).filter(Boolean);

    list.textContent = "";
    if (empty) empty.hidden = items.length > 0;
    if (counter) counter.textContent = items.length;
    if (!items.length) return;

    var frag = document.createDocumentFragment();
    items.forEach(function (q) {
      var card = document.createElement("article");
      card.className = "qcard";

      var meta = document.createElement("div");
      meta.className = "qmeta";
      var no = document.createElement("span");
      no.className = "no";
      no.textContent = q.year + " · " + q.section + q.number;
      meta.appendChild(no);
      var subj = document.createElement("span");
      subj.className = "t";
      subj.textContent = q.subject;
      meta.appendChild(subj);
      card.appendChild(meta);

      var stem = document.createElement("div");
      stem.className = "stem";
      stem.innerHTML = q.stem_display;
      card.appendChild(stem);

      var foot = document.createElement("div");
      foot.className = "foot";
      var tag = document.createElement("span");
      tag.className = "chip accent";
      tag.textContent = q.l1;
      foot.appendChild(tag);
      var open = document.createElement("a");
      open.href = "q/" + q.qid + ".html";
      open.className = "small";
      open.style.marginLeft = "auto";
      open.textContent = "查看详情 →";
      foot.appendChild(open);
      var unstar = document.createElement("button");
      unstar.type = "button";
      unstar.className = "btn small star-btn on";
      unstar.setAttribute("aria-label", "取消收藏");
      unstar.textContent = "★ 已收藏";
      unstar.addEventListener("click", function () {
        stars.toggle(q.qid);
        render();
      });
      foot.appendChild(unstar);
      card.appendChild(foot);
      frag.appendChild(card);
    });
    list.appendChild(frag);
    if (window.renderMathInElement) {
      window.renderMathInElement(list, {
        delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
        throwOnError: false,
        ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"]
      });
    }
  }

  var copyBtn = document.getElementById("copy-stars");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var byId = {};
      (data && data.questions ? data.questions : []).forEach(function (q) { byId[q.qid] = q; });
      var text = stars.all().map(function (id) {
        var q = byId[id];
        return q ? ("[" + q.year + " " + q.subject + " " + q.section + q.number + "] " + q.stem_display.replace(/<[^>]+>/g, " ")) : id;
      }).join("\n\n");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { copyBtn.textContent = "已复制 ✓"; },
          function () { copyBtn.textContent = "复制失败"; });
      } else {
        copyBtn.textContent = "当前浏览器不支持复制";
      }
      setTimeout(function () { copyBtn.textContent = "复制收藏清单"; }, 1500);
    });
  }

  var clearBtn = document.getElementById("clear-stars");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (!window.confirm("清空全部收藏？此操作不可撤销。")) return;
      stars.clear();
      render();
    });
  }

  render();
})();
