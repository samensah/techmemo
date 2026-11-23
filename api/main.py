"""Optional local Hugging Face model backend for TechMemo's browser prototype.

Not a production server: no SSO, tenancy enforcement, durable storage, or accounting
standard licensing. Inputs must contain only approved evidence; the client filters it.
"""
from __future__ import annotations

import io
import os
import threading
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(title="TechMemo HF prototype", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # File-based demo; tighten this before deploying.
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_models_lock = threading.Lock()
_encoder = None
_tokenizer = None
_generator = None


class Evidence(BaseModel):
    id: str = Field(max_length=70)
    text: str = Field(max_length=16000)


class GenerationRequest(BaseModel):
    issue: str = Field(min_length=5, max_length=3000)
    standard: str = Field(max_length=100)
    evidence: list[Evidence] = Field(min_length=1, max_length=40)
    max_new_tokens: int = Field(default=75, ge=15, le=130)


def _load_models():
    global _encoder, _generator, _tokenizer
    with _models_lock:
        if _encoder is not None and _generator is not None:
            return
        try:
            from sentence_transformers import SentenceTransformer
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except ImportError as exc:
            raise RuntimeError(
                "Hugging Face dependencies missing. Run: pip install -r api/requirements.txt"
            ) from exc
        # Small, openly available Hugging Face checkpoints. Downloaded on first run.
        if _encoder is None:
            _encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2", device="cpu")
        if _tokenizer is None:
            _tokenizer = AutoTokenizer.from_pretrained("gpt2")
        if _generator is None:
            _generator = AutoModelForCausalLM.from_pretrained("gpt2")
            _generator.eval()


def _generate_sync(req: GenerationRequest) -> dict:
    _load_models()
    import torch

    docs = [e.text.strip() or "No extracted content." for e in req.evidence]
    embeddings = _encoder.encode([req.issue] + docs, normalize_embeddings=True)
    scores = embeddings[1:] @ embeddings[0]
    ranked = sorted(zip(req.evidence, scores.tolist()), key=lambda x: x[1], reverse=True)
    top = ranked[: min(6, len(ranked))]
    fact_text = "\n".join(f"- [{item.id}] {item.text[:230]}" for item, _ in top)
    # GPT-2 is a *continuation* model, not an instruction-following accounting model.
    # The UI keeps this output explicitly separate from the rule-based memo structure.
    prompt = (
        f"Technical accounting research notes.\n"
        f"Question: {req.issue[:260]}\n"
        f"Framework: {req.standard}\n"
        f"Evidence reviewed:\n{fact_text[:850]}\n"
        "Preliminary considerations: "
    )
    inputs = _tokenizer(prompt, return_tensors="pt", truncation=True, max_length=768)
    with torch.inference_mode():
        result = _generator.generate(
            **inputs,
            max_new_tokens=req.max_new_tokens,
            do_sample=True,
            temperature=0.78,
            top_p=0.90,
            repetition_penalty=1.15,
            pad_token_id=_tokenizer.eos_token_id,
        )
    continuation = _tokenizer.decode(result[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
    return {
        "model": "gpt2",
        "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
        "gpt2_continuation": continuation.strip()[:2200],
        "retrieval": [{"evidence_id": item.id, "similarity": round(float(score), 4)} for item, score in top],
        "disclaimer": "Experimental generation only. GPT-2 is not accounting-specialized; verify every claim.",
    }


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "models_loaded": _encoder is not None and _generator is not None,
        "generation_model": "gpt2",
        "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
    }


@app.post("/api/generate")
def generate(req: GenerationRequest):
    try:
        return _generate_sync(req)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Model inference failed: {exc}") from exc


@app.post("/api/extract")
async def extract(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    data = await file.read(12 * 1024 * 1024 + 1)
    if len(data) > 12 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 12 MB demo limit")
    extension = Path(file.filename).suffix.lower()
    try:
        if extension in (".txt", ".md", ".csv", ".json"):
            text = data.decode("utf-8", errors="replace")
        elif extension == ".pdf":
            from pypdf import PdfReader
            pdf = PdfReader(io.BytesIO(data))
            text = "\n".join(page.extract_text() or "" for page in pdf.pages[:70])
        elif extension == ".docx":
            from docx import Document
            doc = Document(io.BytesIO(data))
            text = "\n".join(p.text for p in doc.paragraphs)
            for t in doc.tables:
                text += "\n" + "\n".join(" | ".join(cell.text for cell in row.cells) for row in t.rows)
        elif extension == ".xlsx":
            from openpyxl import load_workbook
            wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
            rows = []
            for ws in wb.worksheets[:10]:
                rows.append(f"Sheet: {ws.title}")
                for row in ws.iter_rows(min_row=1, max_row=min(ws.max_row, 300), values_only=True):
                    rows.append(" | ".join(str(cell or "") for cell in row[:30]))
            text = "\n".join(rows)
            wb.close()
        else:
            raise HTTPException(status_code=415, detail="Unsupported file type")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not extract text: {exc}") from exc
    return {"filename": file.filename, "text": text[:16000], "truncated": len(text) > 16000}


app.mount("/assets", StaticFiles(directory=ROOT / "assets"), name="assets")


@app.get("/")
def index():
    return FileResponse(ROOT / "index.html")
