# 🎓 CareerMentor AI — Agentic Career Counseling Companion

> **IBM Watsonx.ai (Granite) · Flask · Bootstrap 5 · Dark Mode**  
> Personalized AI-powered career guidance for every student.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **AI Career Chat** | Real-time conversations powered by IBM Granite LLM |
| 👤 **Profile Builder** | Comprehensive student profile for hyper-personalized guidance |
| 📊 **Skill Assessment** | Gap analysis with prioritized upskilling plans |
| 🎯 **Career Recommendations** | Top 3 career matches with fit scores & rationale |
| 🗺️ **Learning Roadmap** | Month-by-month plans with courses, certs & milestones |
| 📄 **Resume Analyzer** | ATS scoring, keyword suggestions, rewrite assistance |
| 🎤 **Interview Prep** | STAR method coaching, role-specific Q&A, salary tips |
| 📈 **Progress Dashboard** | Career journey tracker with insights & market trends |

---

## 🏗️ Project Structure

```
career-companion/
├── app.py                   # Flask backend + Watsonx.ai integration
├── requirements.txt         # Python dependencies
├── .env.example             # Environment variable template
├── .env                     # Your credentials (DO NOT commit)
├── templates/
│   ├── base.html            # Base layout (navbar, footer)
│   ├── index.html           # Landing page
│   ├── profile.html         # Student profile builder
│   ├── chat.html            # AI advisor chat interface
│   └── dashboard.html       # Progress dashboard
└── static/
    ├── css/
    │   └── style.css        # Dark mode, animations, custom components
    └── js/
        ├── main.js          # Global utilities & scroll animations
        ├── chat.js          # Chat interface, modals, tool interactions
        ├── profile.js       # Profile form completeness tracking
        └── dashboard.js     # Dashboard tip carousel & animations
```

---

## 🚀 Quick Start

### 1. Clone / Navigate to the Project

```bash
cd career-companion
```

### 2. Create a Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate        # Linux / macOS
# venv\Scripts\activate         # Windows
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in your credentials:

```env
WATSONX_API_KEY=your_ibm_cloud_api_key
WATSONX_PROJECT_ID=your_watsonx_project_id
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-3-3-8b-instruct
FLASK_SECRET_KEY=your-random-secret-key-here
```

### 5. Run the Application

```bash
python app.py
```

Visit **http://localhost:5000** in your browser.

> **Demo Mode:** If no valid Watsonx credentials are provided, the app runs  
> in demo mode with pre-built responses — perfect for testing the UI.

---

## 🔑 Getting IBM Watsonx.ai Credentials

1. **Create an IBM Cloud account** at [cloud.ibm.com](https://cloud.ibm.com)
2. **Create a Watsonx.ai project** at [dataplatform.cloud.ibm.com](https://dataplatform.cloud.ibm.com)
3. **Get your API key**: IBM Cloud → Manage → Access (IAM) → API Keys → Create
4. **Get your Project ID**: Watsonx.ai project → Manage tab → General → Project ID
5. **Choose your model**: Default is `ibm/granite-3-3-8b-instruct`

### Available Granite Models

| Model ID | Description |
|---|---|
| `ibm/granite-3-3-8b-instruct` | Best balance of speed & quality (default) |
| `ibm/granite-3-0-2b-instruct` | Fastest, lightweight |
| `ibm/granite-3-1-8b-instruct` | High accuracy |
| `ibm/granite-20b-multilingual` | Multilingual support |

---

## 🤖 Customizing AGENT_INSTRUCTIONS

The agent's behavior is fully customizable in [`app.py`](app.py) via the `AGENT_INSTRUCTIONS` constant.

```python
AGENT_INSTRUCTIONS = """
You are CareerMentor AI...

## PERSONA & TONE
# Customize the agent's voice and counseling style

## CAREER DOMAINS COVERED
# Add or remove career domains

## SAFETY & ETHICAL RULES
# Define boundaries and safety guardrails
"""
```

**Things you can customize:**
- Agent name, persona, and tone
- Supported career domains
- Response structure and format
- Safety rules and topic restrictions
- Analysis framework for student profiles

---

## 🌐 Deployment

### Option A: Heroku

```bash
# Install Heroku CLI, then:
heroku create career-mentor-ai
heroku config:set WATSONX_API_KEY=your_key
heroku config:set WATSONX_PROJECT_ID=your_id
heroku config:set FLASK_SECRET_KEY=your_secret
git push heroku main
```

Create a `Procfile`:
```
web: gunicorn app:app --bind 0.0.0.0:$PORT
```

### Option B: IBM Code Engine

```bash
ibmcloud ce application create \
  --name career-mentor-ai \
  --image your-registry/career-mentor-ai:latest \
  --env WATSONX_API_KEY=your_key \
  --env WATSONX_PROJECT_ID=your_id
```

### Option C: Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:5000", "--workers", "4"]
```

```bash
docker build -t career-mentor-ai .
docker run -p 5000:5000 --env-file .env career-mentor-ai
```

### Option D: Production with Gunicorn

```bash
gunicorn app:app --bind 0.0.0.0:5000 --workers 4 --timeout 120
```

---

## 🔧 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Landing page |
| `GET/POST` | `/profile` | Student profile management |
| `GET` | `/chat` | Chat interface |
| `GET` | `/dashboard` | Progress dashboard |
| `POST` | `/api/chat` | Send message to AI advisor |
| `POST` | `/api/analyze-resume` | Resume analysis (file or text) |
| `POST` | `/api/skill-assessment` | Skill gap analysis |
| `POST` | `/api/career-recommendations` | Career match recommendations |
| `POST` | `/api/generate-roadmap` | Learning roadmap generation |
| `POST` | `/api/interview-prep` | Interview preparation guide |
| `POST` | `/api/clear-history` | Clear chat history |
| `GET` | `/api/status` | API & model health check |

---

## 🛡️ Security Notes

- **Never commit `.env`** — it's in `.gitignore`
- Rotate your IBM Cloud API key regularly
- Use `FLASK_DEBUG=False` in production
- Set a strong random `FLASK_SECRET_KEY`
- Consider adding Flask-Login for multi-user deployments

---

## 🧩 Tech Stack

| Layer | Technology |
|---|---|
| **LLM** | IBM Watsonx.ai · Granite 3.3 8B Instruct |
| **Backend** | Python 3.11 · Flask 3.0 |
| **Frontend** | Bootstrap 5.3 · Vanilla JS · Marked.js |
| **Styling** | Custom CSS · Dark Mode · CSS Animations |
| **Document Parsing** | PyPDF2 · python-docx |
| **Deployment** | Gunicorn · Docker · Heroku / IBM Code Engine |

---

## 📝 License

MIT License — Free to use, modify, and deploy.

---

<div align="center">
  <strong>Built with ❤️ using IBM Watsonx.ai Granite</strong><br>
  <em>Empowering every student to find their perfect career path</em>
</div>
