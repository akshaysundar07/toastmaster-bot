require("dotenv").config();
const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const Groq = require("groq-sdk");



const { analyzeGrammar } = require("./agents/grammarian");

const { analyzeTimer } = require("./agents/timer");

const { generateReport, formatReportAsText } = require("./report");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Allow Chrome extension to call backend
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Transcription Endpoint ───────────────────────────────────────────────────
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No audio received", transcript: "" });
    }

    // Save to temp file
    const tempPath = path.join(os.tmpdir(), `toastmaster_${Date.now()}.webm`);
    fs.writeFileSync(tempPath, req.file.buffer);

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-large-v3",
      language: "en",
      response_format: "json",
    });

    // Clean up temp file
    try {
      fs.unlinkSync(tempPath);
    } catch (e) {}

    console.log("📝 Transcribed:", transcription.text.substring(0, 100));
    res.json({ transcript: transcription.text });
  } catch (error) {
    console.error("Transcription error:", error.message);
    res.status(500).json({ error: error.message, transcript: "" });
  }
});

// ─── Analysis Endpoint ────────────────────────────────────────────────────────
app.post("/analyze", async (req, res) => {
  const { transcript, speakerName, wordOfDay, durationSeconds, speechType } =
    req.body;

  if (!transcript || !speakerName) {
    return res.status(400).json({
      error: "Missing transcript or speakerName",
    });
  }

  try {
    console.log(`🚀 Analyzing speech for ${speakerName}...`);

    // SINGLE MASTER EVALUATION
    const masterEvaluation = await analyzeGrammar(
      transcript,

      speakerName,

      wordOfDay,

      speechType,

      durationSeconds,
    );

    // TIMER STILL LOCAL
    const timerResult = analyzeTimer(
      transcript,

      durationSeconds,

      speechType,
    );

    console.log("✅ Analysis complete for", speakerName);

    // GENERATE REPORT
    const report = generateReport(
      masterEvaluation.grammarian,

      masterEvaluation.ahCounter,

      timerResult,

      masterEvaluation.wordOfDay,

      speakerName,

      speechType,

      masterEvaluation.structure,
    );

    // ATTACH GENERAL EVALUATION
    report.generalEvaluation = masterEvaluation.generalEvaluation;

    // PRINT REPORT
    const reportText = formatReportAsText(report);

    console.log(reportText);

    // RESPONSE
    res.json({
      success: true,

      report,

      generalEvaluation: masterEvaluation.generalEvaluation,
    });
  } catch (error) {
    console.error("Analysis error:", error.message);

    res.status(500).json({
      error: error.message,
    });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║     TOASTMASTER BOT SERVER STARTED    ║
╚════════════════════════════════════════╝
🌐 Open http://localhost:3001 in your browser
🎤 Chrome extension backend ready
  `);
});
