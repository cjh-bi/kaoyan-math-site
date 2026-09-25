/* 复习计划：完成状态与掌握度存在 localStorage，纯本地不上传。 */
(function () {
  "use strict";
  var KEY = "kaoyan.plan.v1";
  var rows = Array.prototype.slice.call(document.querySelectorAll(".plan-row"));
  if (!rows.length) return;

  var state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { state = {}; }

  var doneEl = document.getElementById("done-count");
  var avgEl = document.getElementById("avg-level");
  var barEl = document.getElementById("progress-bar");

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式忽略 */ }
  }

  function paint(row, rec) {
    row.classList.toggle("done", !!rec.done);
    row.querySelector(".done").checked = !!rec.done;
    row.querySelectorAll(".level").forEach(function (btn) {
      var on = rec.level !== undefined && rec.level !== null && Number(btn.dataset.v) === Number(rec.level);
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function summary() {
    var done = 0, sum = 0, scored = 0;
    rows.forEach(function (row) {
      var rec = state[row.dataset.id] || {};
      if (rec.done) done++;
      if (rec.level !== undefined && rec.level !== null) { sum += Number(rec.level); scored++; }
    });
    if (doneEl) doneEl.textContent = done;
    if (avgEl) avgEl.textContent = (scored ? (sum / scored) : 0).toFixed(1);
    if (barEl) barEl.style.width = Math.round((done / rows.length) * 100) + "%";
  }

  rows.forEach(function (row) {
    var id = row.dataset.id;
    state[id] = state[id] || {};
    paint(row, state[id]);

    row.querySelector(".done").addEventListener("change", function (event) {
      state[id].done = event.target.checked;
      save(); paint(row, state[id]); summary();
    });
    row.querySelectorAll(".level").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var v = Number(btn.dataset.v);
        state[id].level = (state[id].level === v) ? null : v;
        save(); paint(row, state[id]); summary();
      });
    });
  });

  var reset = document.getElementById("reset-plan");
  if (reset) {
    reset.addEventListener("click", function () {
      if (!window.confirm("清空所有完成状态与掌握度记录？此操作不可撤销。")) return;
      state = {};
      rows.forEach(function (row) { state[row.dataset.id] = {}; paint(row, state[row.dataset.id]); });
      save(); summary();
    });
  }

  summary();
})();
