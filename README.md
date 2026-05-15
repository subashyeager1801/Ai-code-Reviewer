# AI Code Reviewer

A simple AI-powered code review app. Users paste code, optionally select a language, and receive structured feedback for bugs, improvements, security risks, performance tips, and style issues.

## Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Python FastAPI
- AI: Groq API with `llama-3.3-70b-versatile` by default

## Architecture

```text
Frontend served by FastAPI
        |
POST /analyze
        |
FastAPI Backend
        |
Groq API
        |
Structured JSON Response
        |
Highlighted Frontend Result Cards
```

## Easy Local Setup

Run these commands from the project root:

```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r backend\requirements.txt
copy backend\.env.example backend\.env
```

Edit `backend\.env` and add your Groq API key:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

Start the full app with one simple command:

```powershell
python manage.py runserver
```

Open this URL:

```text
http://127.0.0.1:8000
```

The frontend and backend now run from the same FastAPI server.

## Deploy on Vercel

This project includes a root `app.py` file so Vercel can detect the FastAPI
application.

1. Import the GitHub repository in Vercel.
2. Keep the framework preset as Other / Python.
3. Leave the build and output settings empty unless Vercel asks for them.
4. Add these environment variables:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

Vercel will install dependencies from the root `requirements.txt`, which points
to `backend/requirements.txt`.

## API

### POST `/analyze`

Request:

```json
{
  "code": "print('hello')",
  "language": "Python"
}
```

Response:

```json
{
  "bug": [],
  "improvement": [],
  "security": [],
  "performance": [],
  "style": [],
  "language": "Python"
}
```

## Prompt Strategy

The backend sends a strict system prompt to Groq:

```text
You are an expert code reviewer.

Analyze the code and return ONLY valid JSON:

{
  "bug": [],
  "improvement": [],
  "security": [],
  "performance": [],
  "style": []
}

Rules:
- Be precise and actionable
- No vague suggestions
- Put vulnerabilities, unsafe input handling, secrets, auth, injection, dependency, and data exposure issues in security
- Put algorithmic, memory, network, database, rendering, and resource usage tips in performance
- If no issues, return empty arrays
- DO NOT include explanations or markdown
```

The user prompt includes the detected or selected language, the submitted code, and a request to consider every supported feedback category.

## Handling Incorrect or Misleading AI Output

- The backend requests JSON output using Groq's `response_format`.
- The response is parsed with a safety layer.
- If the AI returns markdown, extra text, or invalid JSON, the backend tries to extract the JSON object.
- If parsing still fails, the API returns empty arrays instead of crashing.
- The frontend validates each section as an array before rendering.

## AI Tools and Models Used

- Groq chat completions API
- Default model: `llama-3.3-70b-versatile`
- The model can be changed with the `GROQ_MODEL` environment variable.


## Features

- Paste code in any programming language
- Optional language selection
- Simple frontend and backend language detection heuristics
- Detected language returned in the API response
- Syntax highlighting for the code editor
- Syntax highlighting for backticked code fragments in review output
- Structured feedback categories: bugs, improvements, security, performance, style
- CORS enabled for frontend-backend communication
- Safe fallback for invalid AI JSON
- Frontend served directly by FastAPI

## Limitations

- The app depends on Groq API availability and a valid API key.
- Language detection is intentionally simple and may be wrong for short snippets.
- Syntax highlighting is lightweight and local, not a full parser.
- AI feedback can still be incomplete, so important production changes should be reviewed by humans.
- No authentication, database, or review history is included.

## Future Improvements

- Add file upload support.
- Save review history.
- Add severity levels for each finding.
- Add unit tests and frontend integration tests.
