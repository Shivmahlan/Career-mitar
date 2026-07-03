"""
Career Counseling Companion — Flask backend
IBM Watsonx.ai (Granite) powered agentic career advisor
Run:  python app.py          → http://localhost:8080
      PORT=9000 python app.py → http://localhost:9000
"""

import os
import json
import re
from datetime import datetime
from flask import (
    Flask, render_template, request, jsonify,
    session, redirect, url_for, flash
)
from dotenv import load_dotenv

# ── Optional PDF / DOCX parsing ────────────────────────────────────────────
try:
    import PyPDF2
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

try:
    from docx import Document
    DOCX_SUPPORT = True
except ImportError:
    DOCX_SUPPORT = False

# ── Watsonx SDK ─────────────────────────────────────────────────────────────
try:
    from ibm_watsonx_ai import Credentials
    from ibm_watsonx_ai.foundation_models import ModelInference
    from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams
    WATSONX_SDK = True
except ImportError:
    WATSONX_SDK = False

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-me")

# ───────────────────────────────────────────────────────────────────────────
#  AGENT INSTRUCTIONS
#  Customize the agent's persona, counseling style, domains, and safety rules
# ───────────────────────────────────────────────────────────────────────────
AGENT_INSTRUCTIONS = """
You are CareerMentor AI — a warm, encouraging, and highly knowledgeable career
counseling companion powered by IBM Granite. Your mission is to guide students
from confusion to clarity about their professional futures.

## PERSONA & TONE
- Address students by their first name when provided.
- Be empathetic, patient, and motivating. Never belittle uncertainty.
- Balance honesty about challenges with optimism about possibilities.
- Use clear, jargon-free language unless the student shows technical fluency.
- Respond concisely (3–6 paragraphs max) unless asked for detailed breakdowns.

## CORE CAPABILITIES
1. CAREER EXPLORATION — Explore career paths across technology, healthcare,
   business, creative arts, social sciences, law, engineering, and trades.
2. SKILL ASSESSMENT — Identify current skills, gaps, and development priorities
   based on the student's stated background and aspirations.
3. PERSONALIZED ROADMAPS — Generate step-by-step learning roadmaps with
   timelines, milestones, and resource recommendations.
4. COURSE & CERTIFICATION GUIDANCE — Recommend specific courses, certifications
   (e.g., AWS, Google, IBM, PMP, CFA), bootcamps, and MOOCs.
5. RESUME ANALYSIS — Critique resumes, suggest improvements, highlight ATS
   keywords, and propose stronger action verbs and quantifiable achievements.
6. INTERVIEW PREPARATION — Provide behavioral (STAR method) and technical
   interview questions, tips, and mock Q&A for targeted roles.
7. INTERNSHIP & PROJECT GUIDANCE — Suggest relevant projects, open-source
   contributions, and internship strategies to build a portfolio.
8. TREND AWARENESS — Incorporate awareness of emerging fields: AI/ML, quantum
   computing, green tech, biotech, cybersecurity, and the creator economy.

## CAREER DOMAINS COVERED
Technology | Data Science & AI | Healthcare & Biomedical | Finance & FinTech |
Engineering | Creative & Design | Business & Management | Law & Policy |
Education & Research | Social Work & Psychology | Trades & Vocational |
Entrepreneurship | Media & Communications | Environmental Science

## ANALYSIS FRAMEWORK
When a student shares their profile, analyze:
- Academic background and GPA trajectory
- Technical and soft skill inventory
- Personal interests and intrinsic motivators
- Geographic and lifestyle constraints
- Short-term goals (1–2 yrs) vs long-term vision (5–10 yrs)
- Market demand and salary expectations vs student expectations
- Identify TOP 3 career paths with fit scores and rationale

## RESPONSE STRUCTURE
For career recommendations, always include:
1. 🎯 Career Match + Fit Score (e.g., 92% match)
2. 📋 Why This Fits You (based on provided data)
3. 🛣️ 90-Day Quick Start Plan
4. 📚 Top 3 Resources to Start Today
5. ⚠️ Honest Challenges to Prepare For
6. 💡 Pro Tip specific to their situation

## SAFETY & ETHICAL RULES
- Never make definitive predictions about specific salary figures without caveats.
- Do not discourage unconventional career choices; present balanced information.
- Redirect mental health concerns (e.g., extreme anxiety, burnout) to appropriate
  professional resources with compassion, not dismissal.
- Do not provide legal, financial investment, or medical advice.
- Respect diversity: avoid bias based on gender, ethnicity, or socioeconomic background.
- If asked about topics outside career counseling, politely redirect.

## CONTEXT AWARENESS
- Always reference the student's profile data when provided in the system context.
- Track conversation history to avoid repeating advice already given.
- If a student seems lost, ask 2–3 targeted clarifying questions before advising.
"""

# ── Watsonx model initialiser ───────────────────────────────────────────────
def get_watsonx_model():
    if not WATSONX_SDK:
        return None
    api_key    = os.getenv("WATSONX_API_KEY", "")
    project_id = os.getenv("WATSONX_PROJECT_ID", "")
    url        = os.getenv("WATSONX_URL", "https://au-syd.ml.cloud.ibm.com")
    model_id   = os.getenv("WATSONX_MODEL_ID", "ibm/granite-3-3-8b-instruct")
    if not api_key or not project_id:
        return None
    try:
        credentials = Credentials(url=url, api_key=api_key)
        params = {
            GenParams.MAX_NEW_TOKENS: int(os.getenv("MAX_TOKENS", 1500)),
            GenParams.TEMPERATURE:    float(os.getenv("TEMPERATURE", 0.7)),
            GenParams.TOP_P:          float(os.getenv("TOP_P", 0.9)),
            GenParams.REPETITION_PENALTY: 1.1,
        }
        return ModelInference(
            model_id=model_id,
            credentials=credentials,
            project_id=project_id,
            params=params,
        )
    except Exception as exc:
        app.logger.error("Watsonx init failed: %s", exc)
        return None


def build_system_context(profile: dict) -> str:
    """Inject student profile into the system prompt."""
    if not profile:
        return AGENT_INSTRUCTIONS
    lines = [AGENT_INSTRUCTIONS, "\n## CURRENT STUDENT PROFILE"]
    field_map = {
        "name":         "Name",
        "age":          "Age",
        "education":    "Education Level",
        "major":        "Field of Study / Major",
        "gpa":          "GPA",
        "skills":       "Skills",
        "interests":    "Interests & Passions",
        "goals":        "Career Goals",
        "experience":   "Work / Internship Experience",
        "certifications": "Certifications Held",
        "location":     "Location",
        "constraints":  "Constraints / Preferences",
    }
    for key, label in field_map.items():
        val = profile.get(key, "").strip()
        if val:
            lines.append(f"- {label}: {val}")
    return "\n".join(lines)


def chat_with_granite(user_message: str, history: list, profile: dict) -> tuple:
    """Send a message to Granite and return (response_text, token_usage dict)."""
    model = get_watsonx_model()
    if model is None:
        return demo_response(user_message, profile), None

    system_ctx = build_system_context(profile)

    # Build the prompt in Granite chat template format
    prompt_parts = [f"<|system|>\n{system_ctx}\n<|end_of_text|>\n"]
    for turn in history[-10:]:          # keep last 10 turns for context
        role = turn.get("role", "user")
        content = turn.get("content", "")
        prompt_parts.append(f"<|{role}|>\n{content}\n<|end_of_text|>\n")
    prompt_parts.append(f"<|user|>\n{user_message}\n<|end_of_text|>\n<|assistant|>\n")
    prompt = "".join(prompt_parts)

    try:
        raw = model.generate_text(prompt=prompt, raw_response=True)
        text = raw["results"][0]["generated_text"].strip()
        token_usage = {
            "input_tokens":     raw["results"][0].get("input_token_count", 0),
            "generated_tokens": raw["results"][0].get("generated_token_count", 0),
            "total_tokens":     raw["results"][0].get("input_token_count", 0)
                                + raw["results"][0].get("generated_token_count", 0),
        }
        # accumulate session-level totals
        session["total_tokens"] = session.get("total_tokens", 0) + token_usage["total_tokens"]
        session["total_input_tokens"] = session.get("total_input_tokens", 0) + token_usage["input_tokens"]
        session["total_generated_tokens"] = session.get("total_generated_tokens", 0) + token_usage["generated_tokens"]
        return text, token_usage
    except Exception as exc:
        app.logger.error("Granite generation error: %s", exc)
        return f"I encountered an error reaching the AI model. Please verify your API credentials. ({exc})", None


def demo_response(message: str, profile: dict) -> str:
    """Fallback demo when no valid Watsonx credentials are configured."""
    name = profile.get("name", "there")
    msg_lower = message.lower()

    if any(w in msg_lower for w in ["resume", "cv"]):
        return (
            f"Hi {name}! 📄 **Resume Feedback (Demo Mode)**\n\n"
            "Your resume looks like a solid starting point. Here are key improvements:\n"
            "1. **Add quantifiable achievements** — e.g., 'Increased efficiency by 30%'\n"
            "2. **Use strong action verbs** — Led, Built, Designed, Optimized\n"
            "3. **Include ATS keywords** matching the job description\n"
            "4. **Keep it to 1 page** for less than 5 years of experience\n\n"
            "💡 *Configure your IBM Watsonx credentials in `.env` for full AI-powered analysis.*"
        )
    if any(w in msg_lower for w in ["interview", "prepare"]):
        return (
            f"Great question, {name}! 🎤 **Interview Preparation (Demo Mode)**\n\n"
            "For behavioral interviews, master the **STAR Method**:\n"
            "- **S**ituation → Set the scene\n"
            "- **T**ask → Describe your responsibility\n"
            "- **A**ction → Explain what YOU did\n"
            "- **R**esult → Share the measurable outcome\n\n"
            "Common questions to prepare:\n"
            "1. Tell me about yourself\n"
            "2. Describe a challenge you overcame\n"
            "3. Where do you see yourself in 5 years?\n\n"
            "💡 *Add your Watsonx API key for role-specific mock interviews.*"
        )
    if any(w in msg_lower for w in ["career", "path", "job", "future"]):
        return (
            f"Hello {name}! 🎯 **Career Recommendations (Demo Mode)**\n\n"
            "Based on current market trends, here are high-growth career paths:\n\n"
            "**1. AI/ML Engineer** — 92% fit 🔥\n"
            "→ High demand, excellent salary, future-proof\n"
            "→ Start with: Python, TensorFlow, IBM Watsonx\n\n"
            "**2. Data Scientist** — 88% fit 📊\n"
            "→ Cross-industry demand, analytical + creative\n"
            "→ Start with: Python, SQL, Statistics\n\n"
            "**3. Cloud Architect** — 85% fit ☁️\n"
            "→ Explosive growth, certification-driven\n"
            "→ Start with: AWS/Azure/IBM Cloud certs\n\n"
            "💡 *Complete your profile and add Watsonx credentials for personalized guidance.*"
        )
    if any(w in msg_lower for w in ["skill", "learn", "course"]):
        return (
            f"Hi {name}! 📚 **Learning Roadmap (Demo Mode)**\n\n"
            "**Recommended Learning Path — Tech Careers:**\n\n"
            "**Month 1–2:** Foundations\n"
            "- Python Programming (freeCodeCamp / Coursera)\n"
            "- IBM SkillsBuild — AI Fundamentals\n\n"
            "**Month 3–4:** Core Skills\n"
            "- Data Analysis with Pandas & NumPy\n"
            "- SQL for Data Science (Kaggle)\n\n"
            "**Month 5–6:** Specialization\n"
            "- Machine Learning (Andrew Ng / Coursera)\n"
            "- Build 2 portfolio projects on GitHub\n\n"
            "💡 *Connect Watsonx for a roadmap tailored to your specific profile.*"
        )
    return (
        f"Hi {name}! 👋 Welcome to **CareerMentor AI** (Demo Mode)\n\n"
        "I'm your AI-powered career counseling companion. I can help you with:\n"
        "- 🎯 Career path exploration & recommendations\n"
        "- 📊 Skill gap analysis & learning roadmaps\n"
        "- 📄 Resume review & optimization\n"
        "- 🎤 Interview preparation & mock Q&A\n"
        "- 🗺️ Personalized career planning\n\n"
        "To unlock the full AI experience, add your IBM Watsonx credentials to `.env`.\n\n"
        "*Try asking: 'What careers match my interests?' or 'Review my resume'*"
    )


def extract_text_from_file(file) -> str:
    """Extract text from uploaded PDF or DOCX resume."""
    filename = file.filename.lower()
    content = ""
    if filename.endswith(".pdf") and PDF_SUPPORT:
        try:
            reader = PyPDF2.PdfReader(file)
            content = " ".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            content = "[PDF parsing failed — please paste resume text directly]"
    elif filename.endswith(".docx") and DOCX_SUPPORT:
        try:
            doc = Document(file)
            content = " ".join(p.text for p in doc.paragraphs)
        except Exception:
            content = "[DOCX parsing failed — please paste resume text directly]"
    elif filename.endswith(".txt"):
        try:
            content = file.read().decode("utf-8", errors="replace")
        except Exception:
            content = "[Text file read failed]"
    else:
        content = "[Unsupported file format — please use PDF, DOCX, or TXT]"
    return content[:8000]   # cap at 8k chars


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/profile", methods=["GET", "POST"])
def profile():
    if request.method == "POST":
        profile_data = {
            "name":           request.form.get("name", "").strip(),
            "age":            request.form.get("age", "").strip(),
            "education":      request.form.get("education", "").strip(),
            "major":          request.form.get("major", "").strip(),
            "gpa":            request.form.get("gpa", "").strip(),
            "skills":         request.form.get("skills", "").strip(),
            "interests":      request.form.get("interests", "").strip(),
            "goals":          request.form.get("goals", "").strip(),
            "experience":     request.form.get("experience", "").strip(),
            "certifications": request.form.get("certifications", "").strip(),
            "location":       request.form.get("location", "").strip(),
            "constraints":    request.form.get("constraints", "").strip(),
        }
        session["profile"]  = profile_data
        session["chat_history"] = []
        flash("Profile saved successfully! Your AI counselor is now personalised.", "success")
        return redirect(url_for("chat"))
    return render_template("profile.html", profile=session.get("profile", {}))


@app.route("/chat")
def chat():
    profile_data = session.get("profile", {})
    history      = session.get("chat_history", [])
    return render_template("chat.html", profile=profile_data, history=history)


@app.route("/api/chat", methods=["POST"])
def api_chat():
    data         = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    profile_data = session.get("profile", {})
    history      = session.get("chat_history", [])

    response, token_usage = chat_with_granite(user_message, history, profile_data)

    history.append({"role": "user",      "content": user_message})
    history.append({"role": "assistant", "content": response})
    session["chat_history"] = history[-40:]   # keep last 40 messages

    return jsonify({
        "response":    response,
        "timestamp":   datetime.now().strftime("%H:%M"),
        "token_usage": token_usage,
        "session_tokens": {
            "total":     session.get("total_tokens", 0),
            "input":     session.get("total_input_tokens", 0),
            "generated": session.get("total_generated_tokens", 0),
        },
    })


@app.route("/api/analyze-resume", methods=["POST"])
def analyze_resume():
    resume_text = ""
    if "resume_file" in request.files:
        f = request.files["resume_file"]
        if f and f.filename:
            resume_text = extract_text_from_file(f)
    if not resume_text:
        resume_text = request.form.get("resume_text", "").strip()
    if not resume_text:
        return jsonify({"error": "No resume content provided"}), 400

    profile_data = session.get("profile", {})
    history      = session.get("chat_history", [])

    prompt = (
        "Please perform a comprehensive resume analysis. Provide structured feedback covering:\n"
        "1. Overall Impression & ATS Score (out of 10)\n"
        "2. Key Strengths (bullet points)\n"
        "3. Critical Improvements needed\n"
        "4. Missing Keywords & Skills to add\n"
        "5. Formatting & Structure recommendations\n"
        "6. Tailored action verbs and achievement rewrites\n\n"
        f"RESUME CONTENT:\n{resume_text}"
    )
    response, token_usage = chat_with_granite(prompt, history, profile_data)
    return jsonify({"analysis": response, "timestamp": datetime.now().strftime("%H:%M"), "token_usage": token_usage})


@app.route("/api/skill-assessment", methods=["POST"])
def skill_assessment():
    data     = request.get_json(silent=True) or {}
    skills   = data.get("skills", "")
    target   = data.get("target_role", "")
    profile_data = session.get("profile", {})
    history      = session.get("chat_history", [])

    prompt = (
        f"Perform a detailed skill gap analysis for a student targeting: **{target}**\n\n"
        f"Current Skills: {skills}\n\n"
        "Provide:\n"
        "1. Skills Assessment Table (Has / Needs / Priority)\n"
        "2. Top 5 Critical Skill Gaps\n"
        "3. 6-Month Upskilling Plan with specific resources\n"
        "4. Quick wins (skills learnable in < 2 weeks)\n"
        "5. Estimated time to job-ready status"
    )
    response, token_usage = chat_with_granite(prompt, history, profile_data)
    return jsonify({"assessment": response, "timestamp": datetime.now().strftime("%H:%M"), "token_usage": token_usage})


@app.route("/api/career-recommendations", methods=["POST"])
def career_recommendations():
    profile_data = session.get("profile", {})
    history      = session.get("chat_history", [])
    data         = request.get_json(silent=True) or {}
    extra_info   = data.get("extra", "")

    prompt = (
        "Based on the student's profile, generate top 3 career recommendations.\n"
        "For each career provide:\n"
        "- Career title & industry\n"
        "- Fit score (percentage) with explanation\n"
        "- Typical salary range\n"
        "- Growth outlook (next 5 years)\n"
        "- Required skills they already have vs. need\n"
        "- Top 3 companies hiring for this role\n"
        "- 90-day action plan to get started\n\n"
        + (f"Additional context: {extra_info}" if extra_info else "")
    )
    response, token_usage = chat_with_granite(prompt, history, profile_data)
    return jsonify({"recommendations": response, "timestamp": datetime.now().strftime("%H:%M"), "token_usage": token_usage})


@app.route("/api/generate-roadmap", methods=["POST"])
def generate_roadmap():
    data         = request.get_json(silent=True) or {}
    target_role  = data.get("target_role", "")
    timeline     = data.get("timeline", "12 months")
    profile_data = session.get("profile", {})
    history      = session.get("chat_history", [])

    prompt = (
        f"Create a detailed learning roadmap to become a **{target_role}** in **{timeline}**.\n\n"
        "Structure the roadmap as:\n"
        "- Phase 1 (Months 1–2): Foundation building\n"
        "- Phase 2 (Months 3–5): Core skill development\n"
        "- Phase 3 (Months 6–9): Specialization & projects\n"
        "- Phase 4 (Months 10–12): Job readiness & networking\n\n"
        "For each phase include: specific courses, certifications, projects, and milestones.\n"
        "End with a list of top job boards and networking strategies."
    )
    response, token_usage = chat_with_granite(prompt, history, profile_data)
    return jsonify({"roadmap": response, "timestamp": datetime.now().strftime("%H:%M"), "token_usage": token_usage})


@app.route("/api/interview-prep", methods=["POST"])
def interview_prep():
    data         = request.get_json(silent=True) or {}
    role         = data.get("role", "Software Engineer")
    interview_type = data.get("interview_type", "behavioral")
    profile_data = session.get("profile", {})
    history      = session.get("chat_history", [])

    prompt = (
        f"Generate a comprehensive {interview_type} interview preparation guide for **{role}**.\n\n"
        "Include:\n"
        "1. Top 10 likely interview questions with model answers\n"
        "2. Technical questions with hints (if applicable)\n"
        "3. Questions to ask the interviewer\n"
        "4. Common mistakes to avoid\n"
        "5. Day-of preparation checklist\n"
        "6. Salary negotiation tips for this role"
    )
    response, token_usage = chat_with_granite(prompt, history, profile_data)
    return jsonify({"prep": response, "timestamp": datetime.now().strftime("%H:%M"), "token_usage": token_usage})


@app.route("/api/clear-history", methods=["POST"])
def clear_history():
    session["chat_history"] = []
    return jsonify({"status": "cleared"})


@app.route("/dashboard")
def dashboard():
    profile_data = session.get("profile", {})
    history      = session.get("chat_history", [])
    stats = {
        "total_messages": len(history),
        "sessions":       max(1, len(history) // 10),
        "profile_complete": sum(1 for v in profile_data.values() if v),
        "profile_fields":   12,
    }
    return render_template("dashboard.html", profile=profile_data, stats=stats, history=history)


@app.route("/api/status")
def api_status():
    model = get_watsonx_model()
    return jsonify({
        "watsonx_sdk":    WATSONX_SDK,
        "model_ready":    model is not None,
        "pdf_support":    PDF_SUPPORT,
        "docx_support":   DOCX_SUPPORT,
        "model_id":       os.getenv("WATSONX_MODEL_ID", "meta-llama/llama-3-3-70b-instruct"),
        "session_tokens": {
            "total":     session.get("total_tokens", 0),
            "input":     session.get("total_input_tokens", 0),
            "generated": session.get("total_generated_tokens", 0),
        },
    })


if __name__ == "__main__":
    port  = int(os.getenv("PORT", 8080))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
