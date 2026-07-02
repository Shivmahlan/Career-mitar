/* ═══════════════════════════════════════════════════════════════════════════
   CareerMentor AI — dashboard.js
   ═══════════════════════════════════════════════════════════════════════════ */

"use strict";

// ── Tip Carousel ──────────────────────────────────────────────────────────
(function initTipCarousel() {
  const tips    = document.querySelectorAll(".cm-tip");
  const counter = document.getElementById("tipCounter");
  const prevBtn = document.getElementById("prevTip");
  const nextBtn = document.getElementById("nextTip");
  if (!tips.length) return;

  let current = 0;
  const total = tips.length;

  function showTip(idx) {
    tips.forEach((t) => t.classList.add("d-none"));
    tips[idx].classList.remove("d-none");
    if (counter) counter.textContent = `${idx + 1} / ${total}`;
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      current = (current - 1 + total) % total;
      showTip(current);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      current = (current + 1) % total;
      showTip(current);
    });
  }

  // Auto-cycle every 8 seconds
  setInterval(() => {
    current = (current + 1) % total;
    showTip(current);
  }, 8000);
})();

// ── Clear History ─────────────────────────────────────────────────────────
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", async () => {
    if (!confirm("Clear all conversation history? This cannot be undone.")) return;
    try {
      await fetch("/api/clear-history", { method: "POST" });
      location.reload();
    } catch {
      alert("Failed to clear history. Please try again.");
    }
  });
}

// ── Animate progress bars on scroll ──────────────────────────────────────
(function animateProgressBars() {
  const bars = document.querySelectorAll(".cm-progress-sm .progress-bar");
  if (!bars.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const bar = entry.target;
          const target = bar.style.width;
          bar.style.width = "0%";
          requestAnimationFrame(() => {
            setTimeout(() => { bar.style.width = target; }, 50);
          });
          observer.unobserve(bar);
        }
      });
    },
    { threshold: 0.5 }
  );

  bars.forEach((bar) => observer.observe(bar));
})();
