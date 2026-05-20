let speakers = {};

let wordOfDay = null;

let speechType = "table_topics";

// ─────────────────────────────────────────────
// MESSAGE LISTENER
// ─────────────────────────────────────────────

window.addEventListener("message", (event) => {
  const msg = event.data;

  if (!msg || !msg.action) return;

  // ─────────────────────────────────────────────
  // RECOGNITION STARTED
  // ─────────────────────────────────────────────

  if (msg.action === "recognitionStarted") {
    document.getElementById("header-status").textContent = "🟢 Listening...";

    const emptyState = document.getElementById("empty-state");

    if (emptyState) {
      emptyState.style.display = "none";
    }
  }

  // ─────────────────────────────────────────────
  // WORD OF DAY
  // ─────────────────────────────────────────────

  if (msg.action === "wordOfDayDetected") {
    wordOfDay = msg.word;

    document.getElementById("word-of-day").textContent = msg.word;
  }

  // ─────────────────────────────────────────────
  // SPEECH TYPE
  // ─────────────────────────────────────────────

  if (msg.action === "speechTypeDetected") {
    speechType = msg.speechType;

    document.getElementById("speech-type").textContent =
      msg.speechType === "prepared_speech" ? "Prepared" : "Table Topics";
  }

  // ─────────────────────────────────────────────
  // LIVE TRANSCRIPT
  // ─────────────────────────────────────────────

  if (msg.action === "liveTranscript") {
    updateLiveTranscript(msg.final, msg.interim, msg.speaker);
  }

  // ─────────────────────────────────────────────
  // SPEAKER CHANGED
  // ─────────────────────────────────────────────
  if (msg.action === "speakerChanged") {
    // clear previous speaker transcript
    document.getElementById("live-transcript-text").innerHTML = "";

    handleSpeakerChanged(msg.speakerName, msg.timestamp);
  }
  // ─────────────────────────────────────────────
  // SPEAKER ENDING
  // ─────────────────────────────────────────────

  if (msg.action === "speakerEnding") {
    updateSpeakerStatus(msg.speakerName, "evaluating");

    document.getElementById("header-status").textContent =
      `⏳ Evaluating ${msg.speakerName}...`;
  }

  // ─────────────────────────────────────────────
  // SILENCE DETECTED
  // ─────────────────────────────────────────────

  if (msg.action === "silenceDetected") {
    const warning = document.getElementById("silence-warning");

    if (warning) {
      warning.style.display = "block";

      setTimeout(() => {
        warning.style.display = "none";
      }, 5000);
    }
  }

  // ─────────────────────────────────────────────
  // EVALUATION COMPLETE
  // ─────────────────────────────────────────────

  if (msg.action === "evaluationComplete") {
    if (speakers[msg.speakerName]) {
      speakers[msg.speakerName].status = "done";

      speakers[msg.speakerName].report = msg.data;

      updateSpeakerCard(msg.speakerName);
    }

    document.getElementById("header-status").textContent =
      `✅ ${msg.speakerName} evaluated!`;
  }

  // ─────────────────────────────────────────────
  // EVALUATION ERROR
  // ─────────────────────────────────────────────

  if (msg.action === "evaluationError") {
    if (speakers[msg.speakerName]) {
      speakers[msg.speakerName].status = "error";

      updateSpeakerCard(msg.speakerName);
    }

    document.getElementById("header-status").textContent =
      `❌ Error: ${msg.error}`;
  }

  // ─────────────────────────────────────────────
  // GENERAL ERROR
  // ─────────────────────────────────────────────

  if (msg.action === "error") {
    document.getElementById("header-status").textContent = `❌ ${msg.message}`;
  }
});

// ─────────────────────────────────────────────
// LIVE TRANSCRIPT
// ─────────────────────────────────────────────

function updateLiveTranscript(finalText, interimText, speaker) {
  const transcriptElement = document.getElementById("live-transcript-text");

  if (!transcriptElement) return;

  // APPEND TRANSCRIPT INSTEAD OF REPLACING

  transcriptElement.innerHTML += `
    <div style="margin-bottom:8px;">
      <span style="
        color:#ff4d6d;
        font-weight:bold;
      ">
        ${speaker || "Speaker"}:
      </span>

      <span style="color:white;">
        ${finalText || ""}
      </span>
    </div>
  `;

  // AUTO SCROLL

  transcriptElement.scrollTop = transcriptElement.scrollHeight;
}

// ─────────────────────────────────────────────
// SPEAKER CHANGED
// ─────────────────────────────────────────────

function handleSpeakerChanged(speakerName, timestamp) {
  Object.keys(speakers).forEach((name) => {
    if (speakers[name].status === "speaking") {
      speakers[name].status = "waiting";
    }
  });

  speakers[speakerName] = {
    name: speakerName,
    status: "speaking",
    startTime: timestamp,
    report: null,
  };

  renderSpeakerCard(speakerName);

  document.getElementById("header-status").textContent =
    `🔴 ${speakerName} is speaking...`;
}

// ─────────────────────────────────────────────
// RENDER SPEAKER CARD
// ─────────────────────────────────────────────

function renderSpeakerCard(speakerName) {
  const section = document.getElementById("speakers-section");

  const emptyState = document.getElementById("empty-state");

  if (emptyState) {
    emptyState.style.display = "none";
  }

  if (document.getElementById(`speaker-${speakerName}`)) return;

  const card = document.createElement("div");

  card.className = "speaker-card active";

  card.id = `speaker-${speakerName}`;

  card.innerHTML = `
    <div class="speaker-header">

      <div class="speaker-name">
        🎙️ ${speakerName}
      </div>

      <span
        class="speaker-badge badge-speaking"
        id="badge-${speakerName}"
      >
        Speaking
      </span>

    </div>

    <div id="content-${speakerName}">

      <div style="
        color:#aaa;
        font-size:12px;
        text-align:center;
        padding:10px
      ">
        Listening to speech...
      </div>

    </div>
  `;

  section.insertBefore(card, section.firstChild);
}

// ─────────────────────────────────────────────
// UPDATE SPEAKER STATUS
// ─────────────────────────────────────────────

function updateSpeakerStatus(speakerName, status) {
  const card = document.getElementById(`speaker-${speakerName}`);

  const badge = document.getElementById(`badge-${speakerName}`);

  if (!card || !badge) return;

  if (status === "evaluating") {
    card.className = "speaker-card";

    badge.className = "speaker-badge badge-evaluating";

    badge.textContent = "⏳ Evaluating";

    document.getElementById(`content-${speakerName}`).innerHTML = `
      <div style="
        color:#2196f3;
        font-size:12px;
        text-align:center;
        padding:10px
      ">
        🤖 AI agents analyzing speech...
      </div>
    `;
  }

  if (status === "error") {
    badge.className = "speaker-badge";

    badge.style.background = "#3a1a1a";

    badge.style.color = "#e94560";

    badge.textContent = "❌ Error";

    document.getElementById(`content-${speakerName}`).innerHTML = `
      <div style="
        color:#e94560;
        font-size:12px;
        padding:10px
      ">
        Could not evaluate.
        Transcript may be too short.
      </div>
    `;
  }
}

// ─────────────────────────────────────────────
// UPDATE SPEAKER CARD
// ─────────────────────────────────────────────

function updateSpeakerCard(speakerName) {
  const speaker = speakers[speakerName];

  if (!speaker) return;

  const card = document.getElementById(`speaker-${speakerName}`);

  const badge = document.getElementById(`badge-${speakerName}`);

  if (!card) return;

  if (speaker.status === "done" && speaker.report) {
    card.className = "speaker-card evaluated";

    if (badge) {
      badge.className = "speaker-badge badge-done";

      badge.textContent = "✅ Evaluated";
    }

    //renderReport(speakerName, speaker.report);
  } else if (speaker.status === "error") {
    updateSpeakerStatus(speakerName, "error");
  }
}
