(function () {
  "use strict";

  var STORAGE_KEY = "trakk-hidden-commit-types";
  var INIT_FLAG = "data-trakk-log-init";

  function parseCommitType(taskText) {
    var t = taskText.trim();
    var m = t.match(/^([a-z]+)\s*:/i);
    if (m) return m[1].toLowerCase();
    if (/\bbug fixes?\b/i.test(t)) return "fix";
    return "other";
  }

  function loadHiddenTypes() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return new Set();
      return new Set(arr.map(String));
    } catch (e) {
      return new Set();
    }
  }

  function saveHiddenTypes(hidden) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(hidden)));
  }

  function parseHours(text) {
    var n = parseFloat(String(text).trim());
    return Number.isFinite(n) ? n : 0;
  }

  function isLogTable(table) {
    var header = table.querySelector("thead tr") || table.querySelector("tr");
    if (!header) return false;
    var cells = header.querySelectorAll("th, td");
    if (cells.length < 3) return false;
    var labels = Array.from(cells).map(function (c) {
      return c.textContent.trim().toLowerCase();
    });
    return labels[0] === "date" && labels[1] === "task" && labels[2] === "hours";
  }

  function getBodyRows(table) {
    var tbody = table.querySelector("tbody");
    if (tbody) return Array.from(tbody.querySelectorAll("tr"));
    var all = Array.from(table.querySelectorAll("tr"));
    return all.slice(1);
  }

  function findTotalParagraph(article, table) {
    var root = article || document;
    var nodes = Array.from(root.querySelectorAll("p"));
    var after = false;
    for (var i = 0; i < nodes.length; i++) {
      var p = nodes[i];
      if (p.contains(table)) after = true;
      else if (after && /total hours/i.test(p.textContent)) return p;
    }
    for (var j = 0; j < nodes.length; j++) {
      if (/total hours/i.test(nodes[j].textContent)) return nodes[j];
    }
    return null;
  }

  function formatHours(n) {
    var rounded = Math.round(n * 100) / 100;
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2);
  }

  var state = {
    hiddenTypes: loadHiddenTypes(),
    tables: [],
    totalParagraph: null,
    fullTotal: 0,
    typesOnPage: [],
  };

  function sumAllRows() {
    var sum = 0;
    state.tables.forEach(function (entry) {
      entry.rows.forEach(function (row) {
        var cells = row.querySelectorAll("td");
        if (cells.length >= 3) sum += parseHours(cells[2].textContent);
      });
    });
    return sum;
  }

  function sumVisibleRows() {
    var sum = 0;
    state.tables.forEach(function (entry) {
      entry.rows.forEach(function (row) {
        if (row.classList.contains("trakk-row-hidden")) return;
        var cells = row.querySelectorAll("td");
        if (cells.length >= 3) sum += parseHours(cells[2].textContent);
      });
    });
    return sum;
  }

  function applyVisibility() {
    state.tables.forEach(function (entry) {
      entry.rows.forEach(function (row) {
        var type = row.getAttribute("data-commit-type") || "other";
        var hide = state.hiddenTypes.has(type);
        row.classList.toggle("trakk-row-hidden", hide);
      });
    });
    updateTotals();
    updatePdfButton();
    syncCheckboxes();
  }

  function updateTotals() {
    if (!state.totalParagraph) return;
    var filtered = sumVisibleRows();
    var full = state.fullTotal || sumAllRows();
    var strong = state.totalParagraph.querySelector("strong");
    if (!strong) {
      state.totalParagraph.innerHTML =
        "<strong>Total Hours:</strong> " + formatHours(filtered);
      strong = state.totalParagraph.querySelector("strong");
    }
    var filteredText = formatHours(filtered);
    var fullText = formatHours(full);
    var isFiltered = Math.abs(filtered - full) > 0.001;
    if (isFiltered) {
      state.totalParagraph.innerHTML =
        "<strong>Total Hours:</strong> " +
        filteredText +
        ' <span class="trakk-total-secondary">(' +
        fullText +
        " all entries)</span>";
    } else {
      state.totalParagraph.innerHTML =
        "<strong>Total Hours:</strong> " + filteredText;
    }
  }

  function typesVisibleOnPage() {
    var set = new Set();
    state.tables.forEach(function (entry) {
      entry.types.forEach(function (t) {
        set.add(t);
      });
    });
    return Array.from(set).sort();
  }

  function includedTypesLabel() {
    var all = typesVisibleOnPage();
    if (!all.length) return "All commit types";
    var included = all.filter(function (t) {
      return !state.hiddenTypes.has(t);
    });
    if (included.length === all.length) return "All commit types";
    if (!included.length) return "None";
    return included.join(", ");
  }

  function updatePdfButton() {
    var btn = document.querySelector(".trakk-download-pdf");
    if (!btn) return;
    var visibleCount = 0;
    state.tables.forEach(function (entry) {
      entry.rows.forEach(function (row) {
        if (!row.classList.contains("trakk-row-hidden")) visibleCount++;
      });
    });
    btn.disabled = visibleCount === 0;
  }

  function syncCheckboxes() {
    var fieldset = document.querySelector(".trakk-log-toolbar fieldset");
    if (!fieldset) return;
    fieldset.querySelectorAll('input[type="checkbox"][data-commit-type]').forEach(function (input) {
      var type = input.getAttribute("data-commit-type");
      input.checked = !state.hiddenTypes.has(type);
    });
  }

  function setTypeHidden(type, hidden) {
    if (hidden) state.hiddenTypes.add(type);
    else state.hiddenTypes.delete(type);
    saveHiddenTypes(state.hiddenTypes);
    applyVisibility();
  }

  function buildToolbar(types) {
    var bar = document.createElement("div");
    bar.className = "trakk-log-toolbar";

    var fieldset = document.createElement("fieldset");
    fieldset.className = "trakk-log-types";

    var legend = document.createElement("legend");
    legend.textContent = "Show commit types:";
    fieldset.appendChild(legend);

    var typeRow = document.createElement("div");
    typeRow.className = "trakk-log-type-row";

    types.forEach(function (type) {
      var label = document.createElement("label");
      label.className = "trakk-type-label";

      var input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("data-commit-type", type);
      input.checked = !state.hiddenTypes.has(type);
      input.addEventListener("change", function () {
        setTypeHidden(type, !input.checked);
      });

      label.appendChild(input);
      label.appendChild(document.createTextNode(" " + type));
      typeRow.appendChild(label);
    });

    fieldset.appendChild(typeRow);

    var actions = document.createElement("div");
    actions.className = "trakk-log-actions";

    var allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "trakk-log-link-btn";
    allBtn.textContent = "All";
    allBtn.addEventListener("click", function () {
      types.forEach(function (t) {
        state.hiddenTypes.delete(t);
      });
      saveHiddenTypes(state.hiddenTypes);
      applyVisibility();
    });

    var noneBtn = document.createElement("button");
    noneBtn.type = "button";
    noneBtn.className = "trakk-log-link-btn";
    noneBtn.textContent = "None";
    noneBtn.addEventListener("click", function () {
      types.forEach(function (t) {
        state.hiddenTypes.add(t);
      });
      saveHiddenTypes(state.hiddenTypes);
      applyVisibility();
    });

    var pdfBtn = document.createElement("button");
    pdfBtn.type = "button";
    pdfBtn.className = "trakk-download-pdf md-button";
    pdfBtn.textContent = "Download PDF";
    pdfBtn.addEventListener("click", function () {
      if (window.trakkLog && window.trakkLog.downloadPdf) {
        window.trakkLog.downloadPdf();
      }
    });

    actions.appendChild(allBtn);
    actions.appendChild(document.createTextNode(" · "));
    actions.appendChild(noneBtn);
    actions.appendChild(pdfBtn);

    bar.appendChild(fieldset);
    bar.appendChild(actions);
    return bar;
  }

  function teardown() {
    document.querySelectorAll(".trakk-log-toolbar").forEach(function (el) {
      el.remove();
    });
    document.querySelectorAll("table[" + INIT_FLAG + "]").forEach(function (table) {
      table.removeAttribute(INIT_FLAG);
      getBodyRows(table).forEach(function (row) {
        row.classList.remove("trakk-row-hidden");
        row.removeAttribute("data-commit-type");
      });
    });
    state.tables = [];
    state.totalParagraph = null;
  }

  function init() {
    teardown();
    state.hiddenTypes = loadHiddenTypes();

    var article = document.querySelector(".md-content__inner") || document.querySelector("article");
    if (!article) return;

    var tables = Array.from(article.querySelectorAll("table")).filter(isLogTable);
    if (!tables.length) return;

    var primary = tables[0];
    if (primary.getAttribute(INIT_FLAG)) return;
    primary.setAttribute(INIT_FLAG, "true");

    var typeSet = new Set();
    var rows = getBodyRows(primary);
    rows.forEach(function (row) {
      var cells = row.querySelectorAll("td");
      if (cells.length < 2) return;
      var type = parseCommitType(cells[1].textContent);
      row.setAttribute("data-commit-type", type);
      typeSet.add(type);
    });

    var types = Array.from(typeSet).sort();
    state.tables.push({ table: primary, rows: rows, types: types });

    state.totalParagraph = findTotalParagraph(article, primary);
    if (state.totalParagraph) {
      var match = state.totalParagraph.textContent.match(/[\d.]+/);
      if (match) state.fullTotal = parseHours(match[0]);
      else state.fullTotal = sumAllRows();
    } else {
      state.fullTotal = sumAllRows();
    }

    var toolbar = buildToolbar(types);
    primary.parentNode.insertBefore(toolbar, primary);

    applyVisibility();
  }

  window.trakkLog = window.trakkLog || {};
  window.trakkLog.parseCommitType = parseCommitType;
  window.trakkLog.getExportData = function () {
    var article = document.querySelector(".md-content__inner") || document.querySelector("article");
    var h1 = article ? article.querySelector("h1") : null;
    var title = h1 ? h1.textContent.trim() : document.title;

    var rows = [];
    state.tables.forEach(function (entry) {
      entry.rows.forEach(function (row) {
        if (row.classList.contains("trakk-row-hidden")) return;
        var cells = row.querySelectorAll("td");
        if (cells.length < 3) return;
        rows.push({
          date: cells[0].textContent.trim(),
          task: cells[1].textContent.trim(),
          hours: cells[2].textContent.trim(),
        });
      });
    });

    return {
      title: title,
      typesLabel: includedTypesLabel(),
      rows: rows,
      filteredTotal: formatHours(sumVisibleRows()),
      fullTotal: formatHours(state.fullTotal || sumAllRows()),
      isFiltered: state.hiddenTypes.size > 0,
      filename: deriveFilename(),
    };
  };

  function deriveFilename() {
    var path = window.location.pathname.replace(/\/$/, "");
    var parts = path.split("/").filter(Boolean);
    var slug = parts.slice(-2).join("-") || "trakk-log";
    return slug.replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").toLowerCase() + ".pdf";
  }

  window.trakkLog.deriveFilename = deriveFilename;

  function boot() {
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  if (typeof document$ !== "undefined" && document$.subscribe) {
    document$.subscribe(boot);
  }
})();
