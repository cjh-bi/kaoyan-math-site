/* 收藏（错题本）：纯本地存储，不上传任何数据。
   键：kaoyan.stars.v1  →  { qid: 收藏时间戳 } */
(function (root) {
  "use strict";
  var KEY = "kaoyan.stars.v1";
  var data = {};
  try { data = JSON.parse(root.localStorage.getItem(KEY) || "{}") || {}; } catch (e) { data = {}; }

  function save() {
    try { root.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 隐私模式忽略 */ }
  }
  function has(qid) { return Object.prototype.hasOwnProperty.call(data, qid); }
  function toggle(qid) {
    if (has(qid)) delete data[qid]; else data[qid] = Date.now();
    save();
    return has(qid);
  }
  function all() {
    // 按收藏时间倒序
    return Object.keys(data).sort(function (a, b) { return (data[b] || 0) - (data[a] || 0); });
  }
  function count() { return Object.keys(data).length; }
  function clear() { data = {}; save(); }

  root.KYStars = { key: KEY, has: has, toggle: toggle, all: all, count: count, clear: clear };
})(typeof self !== "undefined" ? self : this);
