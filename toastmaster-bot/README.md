# Toastmaster Bot

A local Toastmasters speech evaluation assistant with:

- Backend speech analysis powered by Groq audio transcription and custom evaluation agents
- Chrome extension support for meeting pages (Google Meet, Microsoft Teams, Zoom)
- Manual transcript analysis through a web UI

## What it does

This project currently implements:

- `index.js`: Express backend with a `/transcribe` endpoint for audio uploads and a `/analyze` endpoint for speech evaluation
- `report.js`: report generation and formatted text output for grammar, filler words, timing, word-of-day usage, and speech structure
- `public/index.html`: simple frontend for manual transcript submission and analysis
- `chrome_extension/`: extension files and manifest for capturing meeting captions, speaker control, and evaluation requests

## Features

- Transcribe audio to text using Groq `whisper-large-v3`
- Analyze transcripts for:
  - grammar feedback
  - filler word / sound counts
  - speech timing and pace
  - Word of the Day usage
  - prepared speech structure analysis
- Returns structured JSON evaluation data and a formatted report text

## Requirements

- Node.js
- A Groq API key stored in `.env` as `GROQ_API_KEY`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in `toastmaster-bot/`:

```env
GROQ_API_KEY=your_groq_api_key_here
```

## Run

Start the backend server:

```bash
npm run start
```

Then open the app UI via:

```text
http://localhost:3001
```

## API Endpoints

### POST `/transcribe`

Uploads an audio file and returns a transcript.

- Request: `multipart/form-data` with field `audio`
- Response: `{ transcript: string }`

### POST `/analyze`

Evaluates a speech transcript and returns JSON analysis.

- Request JSON body:
  - `transcript` (string)
  - `speakerName` (string)
  - `wordOfDay` (string)
  - `durationSeconds` (number)
  - `speechType` (`prepared_speech` or `table_topics`)
- Response JSON:
  - `success` (boolean)
  - `report` (object)
  - `generalEvaluation` (object)

## Chrome Extension

The extension is configured in `chrome_extension/manifest.json` and includes:

- `background.js`: handles evaluation requests and forwards transcripts to the backend
- `content.js`: injects overlay/sidebar, captures meeting captions, and detects speaker state
- `popup.js`: extension popup UI for starting/stopping meetings and managing speakers
- `sidebar.html` / `sidebar.js`: in-page display for live transcripts and evaluation status

Supported meeting hosts in the current implementation:

- Google Meet (`meet.google.com`)
- Microsoft Teams (`*.teams.microsoft.com`)
- Zoom (`zoom.us`)

> Note: the extension is currently built for local development and requires `http://localhost:3001` backend access.

## Project Structure

- `index.js` — main Express server
- `report.js` — speech report formatting and helper functions
- `agents/` — evaluation modules for grammar, filler words, timer, structure, and general feedback
- `chrome_extension/` — Chrome extension UI and background logic
- `public/` — simple hosted frontend

## Notes

- `nodemon` is referenced in `package.json` as `npm run dev`, but it is not installed as a local dependency. Install it globally if you want to use `npm run dev`.
- The backend currently listens on port `3001`.
- The project appears to include full Chrome extension integration, but actual speech capture and evaluation reliability will depend on meeting captions and browser permissions.

## Next Steps

- Add more detailed README sections for the extension installation workflow
- Add UI instructions and examples for the `public/index.html` page
- Add tests or sample audio to verify `/transcribe` and `/analyze`
