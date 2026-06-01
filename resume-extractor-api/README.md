# Resume Extractor API

Standalone service that extracts **raw plain text** from uploaded resume files (PDF, DOCX, RTF). No cleaning, structuring, AI, ATS, or database logic.

Runs on port **4002** by default. Chain with the root-level resume rebuilder on port **3001**.

## Install

```bash
cd resume-extractor-api
npm install
```

## Run

```bash
npm start
# or
npm run dev
```

Copy `.env.example` to `.env` if you need to override `PORT` or `MAX_FILE_SIZE`.

## Endpoints

### `GET /health`

```json
{ "status": "ok", "timestamp": "2026-06-01T12:00:00.000Z" }
```

### `POST /extract`

Multipart upload only. Field name: **`file`**.

**Success (200):**

```json
{ "resume": "<raw extracted text>" }
```

**Errors:** `{ "error": "...", "code": "..." }`

| Code | Status | Meaning |
|------|--------|---------|
| `MISSING_FILE` | 400 | No file in multipart request |
| `UNSUPPORTED_FORMAT` | 400 | Not `.pdf`, `.docx`, or `.rtf` |
| `FILE_TOO_LARGE` | 413 | Exceeds max upload size |
| `EXTRACTION_FAILED` | 500 | Parser error |

## Supported formats

| Format | Extension |
|--------|-----------|
| PDF | `.pdf` |
| Word | `.docx` |
| RTF | `.rtf` |

Legacy `.doc` is not supported.

## Examples

### Upload a file

```bash
curl -X POST http://localhost:4002/extract \
  -F "file=@/path/to/resume.pdf"
```

### Chain with resume rebuilder (port 3001)

```bash
# 1) Extract text
RESUME=$(curl -s -F "file=@resume.docx" http://localhost:4002/extract | jq -r .resume)

# 2) Rebuild (root service)
curl -X POST http://localhost:3001/build-resume \
  -H "Content-Type: application/json" \
  -d "{\"resume\":$(jq -Rs . <<< "$RESUME"),\"jobDescription\":\"Your job description here\"}"
```

The rebuilder expects JSON: `{ "resume": "<plain text>", "jobDescription": "..." }`.

## Deployment

This folder is self-contained (`package.json`, `server.js`, `services/`). You can move it to another repository or host and deploy it independently from the rebuilder.
