/* 静态页面的公式渲染：题目详情、首页、知识点、统计页共用。
   题库浏览器（questions.html）由 app.js 自行管理渲染，用标志位避免重复渲染。 */
(function () {
  "use strict";
  var OPTIONS = {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false }
    ],
    throwOnError: false,
    ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"]
  };

  function run() {
    if (window.__KY_RENDER_MANAGED__) return;
    if (!window.renderMathInElement) return;
    window.renderMathInElement(document.body, OPTIONS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
