/* ═══════════════════════════════════════════════════════════════════════════
   CareerMentor AI — main.js  (global utilities)
   ═══════════════════════════════════════════════════════════════════════════ */

"use strict";

// ── Intersection Observer for scroll animations ──────────────────────────
(function initScrollAnimations() {
  const els = document.querySelectorAll(".animate-fade-up, .animate-fade-left");
  if (!els.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  els.forEach((el) => {
    el.style.opacity = "0";
    observer.observe(el);
  });
})();

// ── Auto-dismiss alerts ───────────────────────────────────────────────────
document.querySelectorAll(".alert").forEach((alert) => {
  setTimeout(() => {
    const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
    if (bsAlert) bsAlert.close();
  }, 5000);
});
