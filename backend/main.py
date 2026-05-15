import json
import os
import re
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

load_dotenv(BASE_DIR / "backend" / ".env")

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

SYSTEM_PROMPT = """You are an expert code reviewer.

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
- DO NOT include explanations or markdown"""


class AnalyzeRequest(BaseModel):
    code: str = Field(..., min_length=1)
    language: str | None = None


class AnalyzeResponse(BaseModel):
    bug: list[str]
    improvement: list[str]
    security: list[str]
    performance: list[str]
    style: list[str]
    language: str


app = FastAPI(title="AI Code Reviewer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


def detect_language(code: str) -> str:
    """Small heuristic used only to add context for the AI prompt."""
    lowered = code.lower()

    if re.search(r"\binterface\s+\w+|\btype\s+\w+\s*=|:\s*(string|number|boolean)\b", code):
        return "TypeScript"
    if re.search(r"\b(def|import|from|print)\b", code) or "__name__" in code:
        return "Python"
    if re.search(r"\b(function|const|let|var|console\.log|=>)\b", code):
        return "JavaScript"
    if re.search(r"\b(public\s+class|system\.out\.println|static\s+void\s+main)\b", lowered):
        return "Java"
    if re.search(r"\busing\s+System\b|\bnamespace\s+\w+|\bConsole\.WriteLine\b", code):
        return "C#"
    if re.search(r"#include\s*<|std::|cout\s*<<", code):
        return "C++"
    if re.search(r"\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bFROM\b", code, re.IGNORECASE):
        return "SQL"
    if "<?php" in code or re.search(r"\becho\s+['\"]", code):
        return "PHP"
    if re.search(r"\bfunc\s+\w+\(|\bpackage\s+main\b|\bfmt\.Print", code):
        return "Go"
    if re.search(r"^\s*[\w.-]+\s*:\s*[^;{}]+;", code, re.MULTILINE):
        return "CSS"
    if re.search(r"<[a-z][\s\S]*>", code, re.IGNORECASE):
        return "HTML"

    return "Unknown"


def empty_review() -> dict[str, list[str]]:
    return {"bug": [], "improvement": [], "security": [], "performance": [], "style": []}


def normalize_review(value: Any) -> dict[str, list[str]]:
    review = empty_review()
    if not isinstance(value, dict):
        return review

    for key in review:
        items = value.get(key, [])
        if isinstance(items, list):
            review[key] = [str(item).strip() for item in items if str(item).strip()]

    return review


def parse_ai_response(content: str) -> dict[str, list[str]]:
    try:
        return normalize_review(json.loads(content))
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", content)
    if not match:
        return empty_review()

    try:
        return normalize_review(json.loads(match.group(0)))
    except json.JSONDecodeError:
        return empty_review()


async def call_groq(code: str, language: str) -> dict[str, list[str]]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is not configured. Add it to your environment or .env file.",
        )

    user_prompt = (
        f"Language: {language}\n\n"
        "Review this code. Always consider bugs, improvements, security risks, performance tips, and style. "
        "Return an empty array for categories with no useful findings.\n\n"
        f"{code}"
    )

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(GROQ_API_URL, headers=headers, json=payload)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Groq API returned an error: {exc.response.text}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach Groq API: {exc}",
        ) from exc

    data = response.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return parse_ai_response(content)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def serve_frontend() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    language = request.language.strip() if request.language else detect_language(request.code)
    review = await call_groq(request.code, language)
    return {**review, "language": language}
