/* ═══════════════════════════════════════════════════════════════════════════
   CareerMentor AI — chat.js
   ═══════════════════════════════════════════════════════════════════════════ */

"use strict";

// ── DOM refs ─────────────────────────────────────────────────────────────
const chatInput      = document.getElementById("chatInput");
const sendBtn        = document.getElementById("sendBtn");
const chatMessages   = document.getElementById("chatMessages");
const typingIndicator= document.getElementById("typingIndicator");
const charCount      = document.getElementById("charCount");
const clearChatBtn   = document.getElementById("clearChatBtn");
const sidebarToggle  = document.getElementById("sidebarToggle");
const chatSidebar    = document.getElementById("chatSidebar");
const modelBadge     = document.getElementById("modelBadge");

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

// ── Textarea auto-resize + char count ────────────────────────────────────
chatInput.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 160) + "px";
  const len = this.value.length;
  charCount.textContent = `${len}/2000`;
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

// ── Sidebar toggle (mobile) ───────────────────────────────────────────────
if (sidebarToggle) {
  sidebarToggle.addEventListener("click", () =>
    chatSidebar.classList.toggle("open")
  );
}

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

// ── Append a message bubble ───────────────────────────────────────────────
function appendMessage(role, content, timestamp) {
  const isBot = role === "assistant" || role === "bot";
  const wrapper = document.createElement("div");
  wrapper.className = `chat-msg ${isBot ? "bot" : "user"} animate-fade-up`;

  const avatarHtml = isBot
    ? `<div class="cm-avatar bot-avatar"><i class="bi bi-robot"></i></div>`
    : `<div class="cm-avatar user-avatar"><i class="bi bi-person"></i></div>`;

  const bubbleClass = isBot ? "msg-bubble" : "msg-bubble user-bubble";
  const renderedContent = isBot ? renderMarkdown(content) : escapeHtml(content);

  wrapper.innerHTML = `
    ${isBot ? avatarHtml : ""}
    <div class="msg-content">
      <div class="${bubbleClass}">${renderedContent}</div>
      <div class="msg-meta">${isBot ? "CareerMentor AI" : "You"} · ${timestamp || "now"}</div>
    </div>
    ${!isBot ? avatarHtml : ""}
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

  // Append user message
  appendMessage("user", text, now);

  // Reset input
  chatInput.value = "";
  chatInput.style.height = "auto";
  charCount.textContent = "0/2000";
  sendBtn.disabled = true;

  // Show typing indicator
  typingIndicator.classList.remove("d-none");
  scrollToBottom();

  // Disable sidebar toggle during streaming
  if (sidebarToggle) sidebarToggle.disabled = true;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const data = await res.json();
    typingIndicator.classList.add("d-none");

    if (res.ok) {
      appendMessage("assistant", data.response, data.timestamp);
    } else {
      appendMessage("assistant", `⚠️ Error: ${data.error || "Unknown error occurred."}`, now);
    }
  } catch (err) {
    typingIndicator.classList.add("d-none");
    appendMessage("assistant", "⚠️ Network error. Please check your connection and try again.", now);
  } finally {
    if (sidebarToggle) sidebarToggle.disabled = false;
    chatInput.focus();
  }
}

// ── Quick prompt helper ───────────────────────────────────────────────────
function sendQuickPrompt(prompt) {
  chatInput.value = prompt;
  chatInput.dispatchEvent(new Event("input"));
  sendMessage();
  // Close sidebar on mobile
  if (chatSidebar) chatSidebar.classList.remove("open");
}

// ── Clear history ─────────────────────────────────────────────────────────
if (clearChatBtn) {
  clearChatBtn.addEventListener("click", async () => {
    if (!confirm("Clear conversation history?")) return;
    await fetch("/api/clear-history", { method: "POST" });
    // Remove all messages except the welcome message
    const msgs = chatMessages.querySelectorAll(".chat-msg:not(#welcomeMsg)");
    msgs.forEach((m) => m.remove());
  });
}

// ── Resume Analyzer ───────────────────────────────────────────────────────
const resumeFileInput   = document.getElementById("resumeFile");
const fileSelected      = document.getElementById("fileSelected");
const fileNameSpan      = document.getElementById("fileName");
const dropZone          = document.getElementById("dropZone");
const analyzeResumeBtn  = document.getElementById("analyzeResumeBtn");
const resumeResult      = document.getElementById("resumeResult");
const resumeResultContent = document.getElementById("resumeResultContent");
const resumeTextArea    = document.getElementById("resumeText");

if (resumeFileInput) {
  resumeFileInput.addEventListener("change", function () {
    if (this.files[0]) {
      fileNameSpan.textContent = this.files[0].name;
      fileSelected.classList.remove("d-none");
    }
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
      fileNameSpan.textContent = e.dataTransfer.files[0].name;
      fileSelected.classList.remove("d-none");
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
