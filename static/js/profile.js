/* ═══════════════════════════════════════════════════════════════════════════
   CareerMentor AI — profile.js
   ═══════════════════════════════════════════════════════════════════════════ */

"use strict";

// ── Profile Completeness Bar ──────────────────────────────────────────────
const TRACKED_FIELDS = [
  "name","age","location","education","major","gpa",
  "skills","interests","goals","experience","certifications","constraints"
];

function updateCompleteness() {
  const bar  = document.getElementById("completenessBar");
  const text = document.getElementById("completenessText");
  if (!bar || !text) return;

  let filled = 0;
  TRACKED_FIELDS.forEach((name) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (el && el.value.trim()) filled++;
  });

  const pct = Math.round((filled / TRACKED_FIELDS.length) * 100);
  bar.style.width = pct + "%";
  bar.setAttribute("aria-valuenow", pct);

  let label = "";
  if (pct === 0)       label = "Start filling in your profile";
  else if (pct < 33)   label = `${pct}% — Good start! Keep going…`;
  else if (pct < 66)   label = `${pct}% — Looking good! Almost there…`;
  else if (pct < 100)  label = `${pct}% — Great profile! Nearly complete.`;
  else                 label = "100% — Perfect profile! Maximum AI personalization.";

  text.textContent = label;

  // Color the bar
  bar.className = "progress-bar";
  if (pct < 33)       bar.classList.add("bg-danger");
  else if (pct < 66)  bar.classList.add("bg-warning");
  else if (pct < 100) bar.classList.add("bg-info");
  else                bar.classList.add("bg-success");
}

// Attach listeners
TRACKED_FIELDS.forEach((name) => {
  const el = document.querySelector(`[name="${name}"]`);
  if (el) el.addEventListener("input", updateCompleteness);
});

// Initial update
updateCompleteness();

// ── Quick-add skill tags ──────────────────────────────────────────────────
document.querySelectorAll(".cm-skill-tag").forEach((btn) => {
  btn.addEventListener("click", function () {
    const skillInput = document.querySelector('[name="skills"]');
    if (!skillInput) return;

    const skill    = this.dataset.skill;
    const current  = skillInput.value.trim();
    const existing = current.split(",").map((s) => s.trim().toLowerCase());

    if (!existing.includes(skill.toLowerCase())) {
      skillInput.value = current ? `${current}, ${skill}` : skill;
      skillInput.dispatchEvent(new Event("input"));
      this.classList.add("btn-success");
      this.classList.remove("btn-outline-secondary");
      this.innerHTML = `✓ ${skill}`;
      this.disabled = true;
    }
  });
});

// ── Pre-fill skill tags from existing profile ─────────────────────────────
(function preselectSkills() {
  const skillInput = document.querySelector('[name="skills"]');
  if (!skillInput || !skillInput.value) return;

  const existing = skillInput.value.split(",").map((s) => s.trim().toLowerCase());
  document.querySelectorAll(".cm-skill-tag").forEach((btn) => {
    if (existing.includes(btn.dataset.skill.toLowerCase())) {
      btn.classList.add("btn-success");
      btn.classList.remove("btn-outline-secondary");
      btn.innerHTML = `✓ ${btn.dataset.skill}`;
      btn.disabled = true;
    }
  });
})();
