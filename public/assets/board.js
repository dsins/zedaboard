/* Board — ortak etkileşim katmanı */

(function () {
  "use strict";

  const Board = (window.Board = window.Board || {});

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  /* Chart.js karanlık varsayılanları */
  function initChartDefaults() {
    if (!window.Chart) return;
    const css = getComputedStyle(document.documentElement);
    const text = css.getPropertyValue("--muted").trim() || "#8b96a8";
    const border = css.getPropertyValue("--border").trim() || "#262d3a";
    Chart.defaults.color = text;
    Chart.defaults.borderColor = border;
    Chart.defaults.font.family =
      'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.padding = 16;
    Chart.defaults.plugins.tooltip.backgroundColor = "rgba(20, 24, 32, 0.96)";
    Chart.defaults.plugins.tooltip.borderColor = border;
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.titleColor = "#e7ebf2";
    Chart.defaults.plugins.tooltip.bodyColor = "#c3cad6";
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
  }

  Board.chart = function (id, config) {
    const el = typeof id === "string" ? document.getElementById(id) : id;
    if (!el || !window.Chart) return null;
    initChartDefaults();
    return new Chart(el, config);
  };

  /* Kod kopyalama */
  function initCopyButtons() {
    document.querySelectorAll(".prose pre").forEach((pre) => {
      if (pre.querySelector(".copy-btn")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-btn";
      btn.textContent = "Kopyala";
      btn.addEventListener("click", async () => {
        const code = pre.querySelector("code");
        try {
          await navigator.clipboard.writeText(code ? code.innerText : pre.innerText);
          btn.textContent = "Kopyalandı";
        } catch {
          btn.textContent = "Hata";
        }
        setTimeout(() => (btn.textContent = "Kopyala"), 1400);
      });
      pre.appendChild(btn);
    });
  }

  /* Okuma ilerlemesi */
  function initProgress() {
    const bar = document.getElementById("progress");
    if (!bar) return;
    const update = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      bar.style.width = Math.min(100, Math.max(0, pct)) + "%";
    };
    document.addEventListener("scroll", update, { passive: true });
    update();
  }

  /* TOC aktif başlık */
  function initToc() {
    const links = [...document.querySelectorAll(".toc a[href^='#']")];
    if (!links.length) return;
    const map = new Map();
    links.forEach((a) => {
      const id = decodeURIComponent(a.getAttribute("href").slice(1));
      const target = document.getElementById(id);
      if (target) map.set(target, a);
    });
    if (!map.size || !("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((a) => a.classList.remove("active"));
          const a = map.get(entry.target);
          if (a) a.classList.add("active");
        });
      },
      { rootMargin: "-15% 0px -75% 0px", threshold: 0 },
    );
    map.forEach((_, target) => obs.observe(target));
  }

  /* Sekmeler */
  function initTabs() {
    document.querySelectorAll("[data-tabs]").forEach((root) => {
      const buttons = [...root.querySelectorAll("[data-tab]")];
      const panels = [...root.querySelectorAll("[data-panel]")];
      if (!buttons.length || !panels.length) return;
      const activate = (name) => {
        buttons.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
        panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === name));
      };
      buttons.forEach((b) => b.addEventListener("click", () => activate(b.dataset.tab)));
      activate(buttons[0].dataset.tab);
    });
  }

  /* Basit filtre */
  function initFilters() {
    document.querySelectorAll("[data-filter]").forEach((input) => {
      const target = input.dataset.filter;
      const items = [...document.querySelectorAll(`[data-filter-item="${target}"]`)];
      if (!items.length) return;
      input.addEventListener("input", () => {
        const q = input.value.trim().toLowerCase();
        items.forEach((item) => {
          item.style.display = item.textContent.toLowerCase().includes(q) ? "" : "none";
        });
      });
    });
  }

  function initPrint() {
    const btn = document.getElementById("print-btn");
    if (btn) btn.addEventListener("click", () => window.print());
  }

  ready(() => {
    initChartDefaults();
    initCopyButtons();
    initProgress();
    initToc();
    initTabs();
    initFilters();
    initPrint();
  });
})();
