/* 题库检索核心：查询归一化 + 相关性打分。
   同时供浏览器（window.KYSearch）与 Node（module.exports）使用，便于在回归检查里跑单测。

   要解决的三个真实痛点：
   1. 用户按 LaTeX 输入（\int、\alpha、\frac），而题库里存的是 Unicode（∫、α）；
   2. 中文词组被空格断开（"拉格朗日 乘数" 搜不到 "拉格朗日乘数法"）；
   3. 上下标写法不同（x^2、x2、x² 应视为同一个东西）。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KYSearch = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var LATEX_CMD = {
    "\\int": "∫", "\\iint": "∬", "\\iiint": "∭", "\\oint": "∮",
    "\\sum": "∑", "\\prod": "∏", "\\infty": "∞", "\\to": "→", "\\rightarrow": "→",
    "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ", "\\Delta": "Δ",
    "\\epsilon": "ε", "\\varepsilon": "ε", "\\theta": "θ", "\\lambda": "λ", "\\mu": "μ",
    "\\nu": "ν", "\\pi": "π", "\\rho": "ρ", "\\sigma": "σ", "\\Sigma": "Σ", "\\tau": "τ",
    "\\phi": "φ", "\\varphi": "φ", "\\chi": "χ", "\\psi": "ψ", "\\omega": "ω", "\\Omega": "Ω",
    "\\le": "≤", "\\leq": "≤", "\\ge": "≥", "\\geq": "≥", "\\neq": "≠", "\\approx": "≈",
    "\\times": "×", "\\cdot": "·", "\\pm": "±", "\\partial": "∂", "\\nabla": "∇",
    "\\in": "∈", "\\notin": "∉", "\\subset": "⊂", "\\subseteq": "⊆", "\\cup": "∪", "\\cap": "∩",
    "\\forall": "∀", "\\exists": "∃", "\\sqrt": "√", "\\frac": "", "\\dfrac": "", "\\tfrac": "",
    "\\lim": "lim", "\\log": "log", "\\ln": "ln", "\\sin": "sin", "\\cos": "cos", "\\tan": "tan",
    "\\left": "", "\\right": "", "\\quad": "", "\\qquad": "", "\\,": "", "\\;": "", "\\!": ""
  };

  // 没有反斜杠时也认（用户手打 alpha、sqrt 这类写法）
  var WORD_ALIAS = {
    alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ",
    lambda: "λ", sigma: "σ", phi: "φ", omega: "ω", pi: "π", mu: "μ", rho: "ρ",
    sqrt: "√", infty: "∞", infinity: "∞", leq: "≤", geq: "≥", neq: "≠"
  };

  /* 中英译名统一：题库里写的是 "Lagrange 乘数法"，学生搜的是"拉格朗日乘数法"。
     两侧都映射到同一个拉丁键，检索才对得上。左列是中文写法，右列是规范键。 */
  var SYNONYM = {
    "拉格朗日": "lagrange", "泰勒": "taylor", "洛必达": "lhospital", "洛比达": "lhospital",
    "雅可比": "jacobi", "格林": "green", "高斯": "gauss", "斯托克斯": "stokes",
    "柯西": "cauchy", "施瓦茨": "schwarz", "施瓦兹": "schwarz", "狄利克雷": "dirichlet",
    "阿贝尔": "abel", "黎曼": "riemann", "麦克劳林": "maclaurin", "斯特林": "stirling",
    "欧拉": "euler", "范德蒙德": "vandermonde", "范德蒙": "vandermonde",
    "施密特": "schmidt", "格拉姆": "gram", "若尔当": "jordan", "乔丹": "jordan",
    "魏尔斯特拉斯": "weierstrass", "牛顿": "newton", "莱布尼茨": "leibniz",
    "克莱姆": "cramer", "海涅": "heine", "伯努利": "bernoulli", "傅里叶": "fourier",
    "傅立叶": "fourier"
  };
  // 英文/异体写法也归到同一个键
  var SYNONYM_LATIN = {
    lhopital: "lhospital", "l'hospital": "lhospital", "l'hôpital": "lhospital",
    lagranges: "lagrange", fouriers: "fourier", jordans: "jordan"
  };

  var SUPER_SUB = {
    "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6",
    "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "-", "ⁿ": "n",
    "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6",
    "₇": "7", "₈": "8", "₉": "9", "ₙ": "n", "ᵢ": "i", "ⱼ": "j", "ₖ": "k", "ₘ": "m"
  };

  var PUNCT = /[\s，。；：、（）()\[\]【】{}<>.,;:!?‘’“”"'`·—\-−–_^$\\|/+=*&%#@~]/g;

  function normalize(input) {
    if (input === null || input === undefined) return "";
    var s = String(input);
    // 0) 先剥掉富文本标签：题干是 HTML（<br>、<sup>、KaTeX 片段），标签残留会污染索引
    s = s.replace(/<[^>]*>/g, " ");
    // 1) LaTeX 命令（含 \frac{a}{b} 的斜杠会一并去掉，与用户输入 "a/b" 对齐）
    s = s.replace(/\\[a-zA-Z]+\*?/g, function (cmd) {
      return LATEX_CMD[cmd] !== undefined ? LATEX_CMD[cmd] : cmd.slice(1);
    });
    // 2) 上下标折叠
    s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ₀₁₂₃₄₅₆₇₈₉ₙᵢⱼₖₘ]/g, function (ch) {
      return SUPER_SUB[ch] !== undefined ? SUPER_SUB[ch] : ch;
    });
    // 3) 全角 → 半角
    if (typeof s.normalize === "function") s = s.normalize("NFKC");
    s = s.toLowerCase();
    // 4) 单词别名（放在去标点之前，避免 "sqrt(" 之类被切碎）
    s = s.replace(/[a-z]{2,}/g, function (w) {
      return WORD_ALIAS[w] !== undefined ? WORD_ALIAS[w] : w;
    });
    // 4.5) 中英译名统一（中文侧先做，避免被后面的去标点打散）
    s = s.replace(new RegExp(Object.keys(SYNONYM).join("|"), "g"), function (w) {
      return SYNONYM[w];
    });
    s = s.replace(/[a-z]{2,}/g, function (w) {
      return SYNONYM_LATIN[w] !== undefined ? SYNONYM_LATIN[w] : w;
    });
    // 5) 去标点与空白
    return s.replace(PUNCT, "");
  }

  /* 严格模式：同样做 LaTeX / 上下标 / 全角 / 同义词归一，但**保留标点与空格**。
     用途：数字类查询（\frac{1}{2}、1/2、2022）在宽松模式下去掉标点后，
     "12" 会匹配到 "0 1 ( 2" 这类相邻数字，产生大量假命中。严格索引保精度，
     宽松索引保召回，两者分层打分。 */
  function normalizeStrict(input) {
    if (input === null || input === undefined) return "";
    var s = String(input);
    s = s.replace(/<[^>]*>/g, " ");
    // 分数保留斜杠，让严格层能区分 "1/2" 与 "0 1 ( 2"
    s = s.replace(/\\(?:d|t)?frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2");
    s = s.replace(/\\[a-zA-Z]+\*?/g, function (cmd) {
      return LATEX_CMD[cmd] !== undefined ? LATEX_CMD[cmd] : cmd.slice(1);
    });
    s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ₀₁₂₃₄₅₆₇₈₉ₙᵢⱼₖₘ]/g, function (ch) {
      return SUPER_SUB[ch] !== undefined ? SUPER_SUB[ch] : ch;
    });
    if (typeof s.normalize === "function") s = s.normalize("NFKC");
    s = s.toLowerCase();
    s = s.replace(new RegExp(Object.keys(SYNONYM).join("|"), "g"), function (w) { return SYNONYM[w]; });
    s = s.replace(/[a-z]{2,}/g, function (w) {
      if (WORD_ALIAS[w] !== undefined) return WORD_ALIAS[w];
      if (SYNONYM_LATIN[w] !== undefined) return SYNONYM_LATIN[w];
      return w;
    });
    return s.replace(/\s+/g, " ").trim();
  }

  function prepare(question, textOf) {
    var raw = textOf ? textOf(question.stem_display) : question.stem_display;
    return {
      stem: normalize(raw),
      stemStrict: normalizeStrict(raw),
      tags: normalize([question.l1, question.l2, question.subject, question.form].join(" ")),
      meta: normalize([question.year, question.section, question.number, question.note].join(" "))
    };
  }

  /** 返回 { score, field }：score 越大越相关；field 说明命中在哪个字段（用于给用户提示）。
   *  三层打分：严格匹配（原文含查询）> 宽松匹配（去标点后含查询）> 标签/备注命中。 */
  function match(question, query, strictQuery) {
    var q = question._search || prepare(question, question.__textOf);
    if (!query) return { score: 0, field: null };
    if (strictQuery && q.stemStrict) {
      var sp = q.stemStrict.indexOf(strictQuery);
      if (sp >= 0) return { score: 120 - Math.min(40, sp), field: "stem" };
    }
    var pos = q.stem.indexOf(query);
    if (pos >= 0) return { score: 90 - Math.min(50, pos), field: "stem" };
    if (q.tags.indexOf(query) >= 0) return { score: 60, field: "tag" };
    if (q.meta.indexOf(query) >= 0) return { score: 20, field: "meta" };
    return { score: 0, field: null };
  }

  return { normalize: normalize, normalizeStrict: normalizeStrict, prepare: prepare, match: match };
});
