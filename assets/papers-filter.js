/* papers.html 年份筛选：点年份条只显示该年份试卷；支持 ?year=2025 深链 */
(function () {
  "use strict";
  function run() {
    var bar = document.getElementById("yearbar");
    if (!bar) return;
    var chips = [].slice.call(bar.querySelectorAll(".ychip"));
    var sections = [].slice.call(document.querySelectorAll("section.section[data-school]"));

    function apply(year) {
      var total = 0;
      chips.forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-year") === year);
      });
      sections.forEach(function (sec) {
        var shown = 0;
        [].slice.call(sec.querySelectorAll(".chip")).forEach(function (c) {
          var ys = (c.getAttribute("data-year") || "").split("/");
          var ok = !year || ys.indexOf(year) >= 0;
          c.style.display = ok ? "" : "none";
          if (ok) shown++;
        });
        sec.style.display = shown ? "" : "none";
        var meta = sec.querySelector(".section-head p");
        if (meta) {
          if (!meta.getAttribute("data-orig")) meta.setAttribute("data-orig", meta.textContent);
          if (year) {
            meta.textContent = shown ? shown + " 套 · " + year + " 年" : meta.getAttribute("data-orig");
          } else {
            meta.textContent = meta.getAttribute("data-orig");
          }
        }
        total += shown;
      });
      var hint = document.getElementById("yearhint");
      if (hint) hint.textContent = year ? (total ? "" : "没有 " + year + " 年的试卷") : "";
      try {
        var u = new URL(location.href);
        if (year) u.searchParams.set("year", year); else u.searchParams.delete("year");
        history.replaceState(null, "", u);
      } catch (e) { /* file:// 下忽略 */ }
    }

    bar.addEventListener("click", function (e) {
      var b = e.target.closest(".ychip");
      if (b) apply(b.getAttribute("data-year"));
    });

    var m = /[?&]year=(\d{4})/.exec(location.search);
    if (m) apply(m[1]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
