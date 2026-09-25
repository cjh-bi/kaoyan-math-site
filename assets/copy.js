/* 复制题干：把原始 Markdown/LaTeX 文本写进剪贴板。
   优先用 navigator.clipboard（需要安全上下文）；file:// 下回退到 execCommand。 */
(function () {
  "use strict";
  var buttons = Array.prototype.slice.call(document.querySelectorAll(".copy-btn"));
  if (!buttons.length) return;

  function fallback(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.dataset.stem || "";
      var done = function (ok) {
        var old = btn.textContent;
        btn.textContent = ok ? "已复制 ✓" : "复制失败";
        btn.disabled = true;
        setTimeout(function () { btn.textContent = old; btn.disabled = false; }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); },
          function () { done(fallback(text)); });
      } else {
        done(fallback(text));
      }
    });
  });
})();
