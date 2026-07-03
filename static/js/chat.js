/* ═══════════════════════════════════════════════════════════════════════════
   Career Mitar — chat.js
   ═══════════════════════════════════════════════════════════════════════════ */

"use strict";

// ── DOM refs ─────────────────────────────────────────────────────────────
const chatInput       = document.getElementById("chatInput");
const sendBtn         = document.getElementById("sendBtn");
const chatMessages    = document.getElementById("chatMessages");
const typingIndicator = document.getElementById("typingIndicator");
const clearChatBtn    = document.getElementById("clearChatBtn");
const modelBadge      = document.getElementById("modelBadge");

// ── Fetch API status on load ──────────────────────────────────────────────
fetch("/api/status")
  .then((r) => r.json())
  .then((d) => {
    if (modelBadge) {
      if (d.model_ready) {
        modelBadge.textContent = d.model_id.split("/").pop() || "Granite";
        modelBadge.style.background = "rgba(22,163,74,.15)";
        modelBadge.style.color = "#4ade80";
        modelBadge.style.borderColor = "rgba(22,163,74,.25)";
      } else {
        modelBadge.textContent = "Demo Mode";
        modelBadge.style.background = "rgba(234,179,8,.12)";
        modelBadge.style.color = "#facc15";
        modelBadge.style.borderColor = "rgba(234,179,8,.2)";
      }
    }
  })
  .catch(() => {
    if (modelBadge) modelBadge.textContent = "Offline";
  });

// ── Textarea auto-resize ──────────────────────────────────────────────────
chatInput.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 180) + "px";
  const len = this.value.length;
  sendBtn.disabled = len === 0 || len > 2000;
});

// ── Send on Enter, newline on Shift+Enter ─────────────────────────────────
chatInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

sendBtn.addEventListener("click", sendMessage);

// ── Render markdown safely using marked.js ─────────────────────────────────
function renderMarkdown(text) {
  if (typeof marked !== "undefined") {
    return marked.parse(text, { breaks: true, gfm: true });
  }
  // Fallback: escape HTML then convert line breaks
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

// ── Append a message bubble (Gemini style) ────────────────────────────────
function appendMessage(role, content, timestamp, tokenUsage) {
  const isBot = role === "assistant" || role === "bot";

  // Hide welcome screen once the first message is sent
  const welcome = document.getElementById("welcomeMsg");
  if (welcome) welcome.remove();

  const wrapper = document.createElement("div");
  wrapper.className = `gm-msg ${isBot ? "gm-msg--bot" : "gm-msg--user"} animate-fade-up`;

  const botIcon = isBot
    ? `<div class="gm-bot-icon"><i class="bi bi-mortarboard-fill"></i></div>`
    : "";

  const bodyClass = isBot ? "gm-msg-body" : "gm-msg-body gm-msg-body--user";
  const renderedContent = isBot ? renderMarkdown(content) : escapeHtml(content);

  wrapper.innerHTML = `
    ${botIcon}
    <div class="${bodyClass}">${renderedContent}</div>
  `;

  chatMessages.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function scrollToBottom() {
  chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: "smooth" });
}

// ── Main send function ────────────────────────────────────────────────────
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  appendMessage("user", text, now);

  chatInput.value = "";
  chatInput.style.height = "auto";
  sendBtn.disabled = true;

  typingIndicator.classList.remove("d-none");
  scrollToBottom();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const data = await res.json();
    typingIndicator.classList.add("d-none");

    if (res.ok) {
      appendMessage("assistant", data.response, data.timestamp, data.token_usage);
    } else {
      appendMessage("assistant", `⚠️ Error: ${data.error || "Unknown error occurred."}`, now);
    }
  } catch (err) {
    typingIndicator.classList.add("d-none");
    appendMessage("assistant", "⚠️ Network error. Please check your connection and try again.", now);
  } finally {
    chatInput.focus();
  }
}

// ── Quick prompt helper ───────────────────────────────────────────────────
function sendQuickPrompt(prompt) {
  chatInput.value = prompt;
  chatInput.dispatchEvent(new Event("input"));
  sendMessage();
}

// ── Clear history ─────────────────────────────────────────────────────────
if (clearChatBtn) {
  clearChatBtn.addEventListener("click", async () => {
    if (!confirm("Clear conversation history?")) return;
    await fetch("/api/clear-history", { method: "POST" });
    // Remove all messages and restore welcome screen
    chatMessages.querySelectorAll(".gm-msg").forEach((m) => m.remove());
    const existing = document.getElementById("welcomeMsg");
    if (!existing) {
      const welcome = document.createElement("div");
      welcome.id = "welcomeMsg";
      welcome.className = "gm-welcome";
      welcome.innerHTML = `
        <div class="gm-welcome-icon"><i class="bi bi-mortarboard-fill"></i></div>
        <h1 class="gm-welcome-heading">Hello there</h1>
        <p class="gm-welcome-sub">How can Career Mitar help you today?</p>
      `;
      chatMessages.prepend(welcome);
    }
  });
}

// ── Resume Analyzer ───────────────────────────────────────────────────────
const resumeFileInput     = document.getElementById("resumeFile");
const dropZone            = document.getElementById("dropZone");
const dropZoneIdle        = document.getElementById("dropZoneIdle");
const dropZoneReady       = document.getElementById("dropZoneReady");
const fileNameSpan        = document.getElementById("fileName");
const fileSizeSpan        = document.getElementById("fileSize");
const clearFileBtn        = document.getElementById("clearFileBtn");
const analyzeResumeBtn    = document.getElementById("analyzeResumeBtn");
const resumeResult        = document.getElementById("resumeResult");
const resumeResultContent = document.getElementById("resumeResultContent");
const resumeTextArea      = document.getElementById("resumeText");

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function showFileReady(file) {
  fileNameSpan.textContent = file.name;
  fileSizeSpan.textContent = formatBytes(file.size);
  dropZoneIdle.classList.add("d-none");
  dropZoneReady.classList.remove("d-none");
  dropZone.classList.add("cm-drop-zone--ready");
}

function clearFile() {
  resumeFileInput.value = "";
  fileNameSpan.textContent = "";
  fileSizeSpan.textContent = "";
  dropZoneReady.classList.add("d-none");
  dropZoneIdle.classList.remove("d-none");
  dropZone.classList.remove("cm-drop-zone--ready");
}

if (resumeFileInput) {
  resumeFileInput.addEventListener("change", function () {
    if (this.files[0]) showFileReady(this.files[0]);
  });
}

if (clearFileBtn) {
  clearFileBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // prevent dropZone click from re-opening picker
    clearFile();
  });
}

// Drag & drop
if (dropZone) {
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    if (e.dataTransfer.files[0]) {
      resumeFileInput.files = e.dataTransfer.files;
      showFileReady(e.dataTransfer.files[0]);
    }
  });
  dropZone.addEventListener("click", () => resumeFileInput.click());
}

if (analyzeResumeBtn) {
  analyzeResumeBtn.addEventListener("click", async () => {
    setLoading(analyzeResumeBtn, true, "Analyzing…");
    const formData = new FormData();

    if (resumeFileInput && resumeFileInput.files[0]) {
      formData.append("resume_file", resumeFileInput.files[0]);
    } else if (resumeTextArea && resumeTextArea.value.trim()) {
      formData.append("resume_text", resumeTextArea.value.trim());
    } else {
      showAlert("Please upload a file or paste resume text first.", "warning");
      setLoading(analyzeResumeBtn, false, '<i class="bi bi-stars me-1"></i>Analyze with AI');
      return;
    }

    try {
      const res = await fetch("/api/analyze-resume", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        resumeResultContent.innerHTML = renderMarkdown(data.analysis);
        resumeResult.classList.remove("d-none");
      } else {
        showAlert(data.error || "Analysis failed.", "danger");
      }
    } catch {
      showAlert("Network error during resume analysis.", "danger");
    } finally {
      setLoading(analyzeResumeBtn, false, '<i class="bi bi-stars me-1"></i>Analyze with AI');
    }
  });
}

// Reset modal to idle state whenever it is opened
const resumeModalEl = document.getElementById("resumeModal");
if (resumeModalEl) {
  resumeModalEl.addEventListener("show.bs.modal", () => {
    clearFile();
    if (resumeResult) resumeResult.classList.add("d-none");
    if (resumeResultContent) resumeResultContent.innerHTML = "";
    if (resumeTextArea) resumeTextArea.value = "";
  });
}

// ── Roadmap Generator ─────────────────────────────────────────────────────
const generateRoadmapBtn    = document.getElementById("generateRoadmapBtn");
const roadmapResult         = document.getElementById("roadmapResult");
const roadmapResultContent  = document.getElementById("roadmapResultContent");

if (generateRoadmapBtn) {
  generateRoadmapBtn.addEventListener("click", async () => {
    const role     = document.getElementById("roadmapRole").value.trim();
    const timeline = document.getElementById("roadmapTimeline").value;
    if (!role) { showAlert("Please enter a target role.", "warning"); return; }
    setLoading(generateRoadmapBtn, true, "Generating…");
    try {
      const res = await fetch("/api/generate-roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_role: role, timeline }),
      });
      const data = await res.json();
      if (res.ok) {
        roadmapResultContent.innerHTML = renderMarkdown(data.roadmap);
        roadmapResult.classList.remove("d-none");
      } else {
        showAlert(data.error || "Failed to generate roadmap.", "danger");
      }
    } catch {
      showAlert("Network error.", "danger");
    } finally {
      setLoading(generateRoadmapBtn, false, '<i class="bi bi-map me-1"></i>Generate Roadmap');
    }
  });
}

// ── Interview Prep ────────────────────────────────────────────────────────
const generateInterviewBtn   = document.getElementById("generateInterviewBtn");
const interviewResult        = document.getElementById("interviewResult");
const interviewResultContent = document.getElementById("interviewResultContent");

if (generateInterviewBtn) {
  generateInterviewBtn.addEventListener("click", async () => {
    const role = document.getElementById("interviewRole").value.trim();
    const type = document.getElementById("interviewType").value;
    if (!role) { showAlert("Please enter a target role.", "warning"); return; }
    setLoading(generateInterviewBtn, true, "Generating…");
    try {
      const res = await fetch("/api/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, interview_type: type }),
      });
      const data = await res.json();
      if (res.ok) {
        interviewResultContent.innerHTML = renderMarkdown(data.prep);
        interviewResult.classList.remove("d-none");
      } else {
        showAlert(data.error || "Failed to generate interview guide.", "danger");
      }
    } catch {
      showAlert("Network error.", "danger");
    } finally {
      setLoading(generateInterviewBtn, false, '<i class="bi bi-mic me-1"></i>Generate Prep Guide');
    }
  });
}

// ── Skill Assessment ──────────────────────────────────────────────────────
const assessSkillBtn      = document.getElementById("assessSkillBtn");
const skillResult         = document.getElementById("skillResult");
const skillResultContent  = document.getElementById("skillResultContent");

if (assessSkillBtn) {
  assessSkillBtn.addEventListener("click", async () => {
    const skills = document.getElementById("currentSkills").value.trim();
    const target = document.getElementById("targetRole").value.trim();
    if (!skills || !target) {
      showAlert("Please fill in both current skills and target role.", "warning");
      return;
    }
    setLoading(assessSkillBtn, true, "Assessing…");
    try {
      const res = await fetch("/api/skill-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills, target_role: target }),
      });
      const data = await res.json();
      if (res.ok) {
        skillResultContent.innerHTML = renderMarkdown(data.assessment);
        skillResult.classList.remove("d-none");
      } else {
        showAlert(data.error || "Assessment failed.", "danger");
      }
    } catch {
      showAlert("Network error.", "danger");
    } finally {
      setLoading(assessSkillBtn, false, '<i class="bi bi-bar-chart me-1"></i>Assess My Skills');
    }
  });
}

// ── Utility helpers ───────────────────────────────────────────────────────
function setLoading(btn, loading, originalHtml) {
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="cm-spinner me-2"></span>`;
  } else {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function showAlert(msg, type = "warning") {
  const div = document.createElement("div");
  div.className = `alert alert-${type} alert-dismissible fade show position-fixed bottom-0 start-50 translate-middle-x mb-4`;
  div.style.zIndex = "9999";
  div.style.minWidth = "300px";
  div.innerHTML = `${msg}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

// ── Scroll to bottom on load ──────────────────────────────────────────────
scrollToBottom();
