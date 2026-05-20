// Prevent duplicate injection
if (window.toastmasterInitialized) {
  console.log("Toastmaster already initialized");
} else {
  window.toastmasterInitialized = true;

  // ─────────────────────────────────────────────
  // GLOBAL VARIABLES
  // ─────────────────────────────────────────────

  let sidebar = null;

  let captionInterval = null;
  let silenceTimer = null;
  let timerInterval = null;

  let meetingStartTime = null;
  let speakerStartTime = null;

  let elapsedSeconds = 0;

  let currentSpeakerName = null;

  let currentTranscript = "";

  let wordOfDay = "unknown";

  let speechType = "table_topics";

  let completedSpeakers = [];

  // NEW STABLE TRANSCRIPT VARIABLES
  let stableTranscript = "";
  let liveCaptionBuffer = "";
  let unchangedCaptionCount = 0;
let lastProcessedCaption = "";
  let lastSentTranscript = "";

  const SILENCE_THRESHOLD = 5000;

  // ─────────────────────────────────────────────
  // SIDEBAR
  // ─────────────────────────────────────────────

  function injectSidebar() {
    if (document.getElementById("toastmaster-sidebar-container")) return;

    const container = document.createElement("div");

    container.id = "toastmaster-sidebar-container";

    container.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 420px;
      height: 100vh;
      z-index: 999999;
      background: #0b1020;
      border-left: 3px solid #ff4d6d;
      box-shadow: -4px 0 20px rgba(0,0,0,0.4);
      overflow: hidden;
    `;

    // IFRAME
    const iframe = document.createElement("iframe");

    iframe.src = chrome.runtime.getURL("sidebar.html");

    iframe.id = "toastmaster-sidebar";

    iframe.style.cssText = `
      width:100%;
      height:100%;
      border:none;
      background:#0b1020;
      position:relative;
      z-index:1;
    `;

    container.appendChild(iframe);

    // CLOSE BUTTON
    const closeBtn = document.createElement("button");

    closeBtn.innerHTML = "✖";

    closeBtn.style.cssText = `
      position:fixed;
      top:12px;
      right:12px;
      z-index:2147483647;
      background:#ff4d6d;
      color:white;
      border:none;
      border-radius:50%;
      width:36px;
      height:36px;
      cursor:pointer;
      font-size:18px;
      font-weight:bold;
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
    `;

    closeBtn.onclick = () => {
      stopCaptionCapture();
      stopTimer();
      removeSidebar();

      console.log("Toastmaster sidebar closed");
    };

    document.body.appendChild(container);

    container.appendChild(closeBtn);

    sidebar = iframe;

    console.log("Toastmaster: Sidebar injected");
  }

  function removeSidebar() {
    const container = document.getElementById("toastmaster-sidebar-container");

    if (container) {
      container.remove();
    }

    sidebar = null;
  }

  // ─────────────────────────────────────────────
  // SEND TO SIDEBAR
  // ─────────────────────────────────────────────

  function sendToSidebar(data) {
    const iframe = document.getElementById("toastmaster-sidebar");

    if (!iframe) {
      console.log("Sidebar iframe not found");
      return;
    }

    iframe.contentWindow.postMessage(data, "*");
  }

  // ─────────────────────────────────────────────
  // TIMER
  // ─────────────────────────────────────────────

  function startTimer() {
    clearInterval(timerInterval);

    elapsedSeconds = 0;

    timerInterval = setInterval(() => {
      elapsedSeconds++;

      sendToSidebar({
        action: "timerUpdate",
        seconds: elapsedSeconds,
      });
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  // ─────────────────────────────────────────────
  // WORD OF DAY
  // ─────────────────────────────────────────────

  function detectWordOfDay(text) {
    const patterns = [
      /word of the day is (\w+)/i,
      /today'?s word is (\w+)/i,
      /our word of the day is (\w+)/i,
      /the word is (\w+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);

      if (match && match[1]) {
        wordOfDay = match[1].replace(/[^a-zA-Z]/g, "").trim();

        console.log("Word of Day:", wordOfDay);

        sendToSidebar({
          action: "wordOfDayDetected",
          word: wordOfDay,
        });

        break;
      }
    }
  }

  // ─────────────────────────────────────────────
  // SPEECH TYPE
  // ─────────────────────────────────────────────

  function detectSpeechType(text) {
    const lower = text.toLowerCase();

    if (lower.includes("table topic") || lower.includes("table topics")) {
      speechType = "table_topics";
    } else if (
      lower.includes("prepared speech") ||
      lower.includes("ice breaker")
    ) {
      speechType = "prepared_speech";
    }

    sendToSidebar({
      action: "speechTypeDetected",
      speechType,
    });
  }

  // ─────────────────────────────────────────────
  // SILENCE DETECTION
  // ─────────────────────────────────────────────

  function resetSilenceTimer() {
    clearTimeout(silenceTimer);

    silenceTimer = setTimeout(() => {
      console.log("Silence detected");
    }, SILENCE_THRESHOLD);
  }

  // ─────────────────────────────────────────────
  // STOP CAPTURE
  // ─────────────────────────────────────────────

  function stopCaptionCapture() {
    clearInterval(captionInterval);
  }

  // ─────────────────────────────────────────────
  // CAPTION CAPTURE
  // ─────────────────────────────────────────────

  function startCaptionCapture() {
    if (captionInterval) {
      clearInterval(captionInterval);
    }

    captionInterval = setInterval(() => {
      // GET LIVE CAPTIONS
      const captionElements = document.querySelectorAll(".ygicle.VbkSUe");

      if (!captionElements.length) {
        return;
      }

      // TAKE ONLY LATEST
      // MERGE ALL VISIBLE CAPTIONS
      let captionText = Array.from(captionElements)
        .map((el) => el.innerText)
        .join(" ")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!captionText) {
        return;
      }
      // SKIP SAME CAPTION
if (captionText === lastProcessedCaption) {
  return;
}

lastProcessedCaption = captionText;

      // IGNORE SHORT GARBAGE
      if (captionText.split(" ").length < 3) {
        return;
      }

      // NO ACTIVE SPEAKER
      if (!currentSpeakerName) {
        return;
      }

      // START TIMER
      if (currentSpeakerName && !speakerStartTime) {
        speakerStartTime = Date.now();

        startTimer();

        sendToSidebar({
          action: "speechStarted",
          speakerName: currentSpeakerName,
        });
      }

      console.log("LIVE CAPTION:", captionText);

      // ─────────────────────────────
      // STABLE CAPTION SYSTEM
      // ─────────────────────────────

      // CAPTION CHANGED
      if (captionText !== liveCaptionBuffer) {
        liveCaptionBuffer = captionText;

        unchangedCaptionCount = 0;

        sendToSidebar({
          action: "liveTranscript",
          final: stableTranscript,
          interim: liveCaptionBuffer,
          speaker: currentSpeakerName,
        });
      } else {
        unchangedCaptionCount++;
      }

      // FINALIZE ONLY WHEN STABLE
      const sentenceCompleted =
        captionText.endsWith(".") ||
        captionText.endsWith("?") ||
        captionText.endsWith("!");

      if (
        liveCaptionBuffer &&
        (sentenceCompleted || unchangedCaptionCount >= 3)
      ) {
        // AVOID DUPLICATES
        // REPLACE TRANSCRIPT WITH LATEST STABLE VERSION
        stableTranscript = liveCaptionBuffer.trim();

        currentTranscript = stableTranscript;

        console.log("FINAL TRANSCRIPT:", currentTranscript);

        // CLEAR BUFFER
        // CLEAR BUFFER
        liveCaptionBuffer = "";

        unchangedCaptionCount = 0;

        // SEND ONLY IF TRANSCRIPT CHANGED
        if (currentTranscript !== lastSentTranscript) {
          lastSentTranscript = currentTranscript;

          sendToSidebar({
            action: "liveTranscript",
            final: currentTranscript,
            interim: "",
            speaker: currentSpeakerName,
          });

          // DETECTORS
          detectWordOfDay(currentTranscript);

          detectSpeechType(currentTranscript);
        }
      }
      // RESET SILENCE TIMER
      resetSilenceTimer();
    }, 1000);

    console.log("Toastmaster: Stable caption capture started");
  }

  // ─────────────────────────────────────────────
  // SPEAKER HANDLER
  // ─────────────────────────────────────────────

  function handleNextSpeaker(speakerName) {
    currentSpeakerName = speakerName.trim().toLowerCase();

    currentTranscript = "";

    stableTranscript = "";

    liveCaptionBuffer = "";

    unchangedCaptionCount = 0;
    lastSentTranscript = "";
    lastProcessedCaption = "";

    speakerStartTime = null;

    elapsedSeconds = 0;

    sendToSidebar({
      action: "speakerChanged",
      speakerName,
      timestamp: new Date().toLocaleTimeString(),
    });

    console.log("Speaker changed to:", speakerName);
  }

  // ─────────────────────────────────────────────
  // MESSAGE LISTENER
  // ─────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // START MEETING
    if (message.action === "startMeeting") {
      meetingStartTime = Date.now();

      injectSidebar();

      startCaptionCapture();

      sendResponse({
        success: true,
      });

      return true;
    }

    // STOP MEETING
    if (message.action === "stopMeeting") {
      stopCaptionCapture();

      stopTimer();

      setTimeout(() => {
        removeSidebar();
      }, 500);

      sendResponse({
        success: true,
      });

      return true;
    }

    // NEXT SPEAKER
    if (message.action === "nextSpeaker") {
      handleNextSpeaker(message.speakerName);

      sendResponse({
        success: true,
      });

      return true;
    }

    // END SPEAKER
    if (message.action === "endSpeaker") {
      console.log("Ending speaker:", currentSpeakerName);

      if (!currentTranscript.trim()) {
        console.log("No transcript captured");
        return true;
      }

      stopTimer();

      const speakerData = {
        speakerName: currentSpeakerName,
        transcript: currentTranscript.trim(),
        duration: elapsedSeconds,
        wordOfDay,
        speechType,
      };

      completedSpeakers.push(speakerData);

      console.log("Speaker saved:", speakerData);

      // SEND FOR AI EVALUATION
      chrome.runtime.sendMessage({
        action: "evaluateSpeaker",
        ...speakerData,
      });

      // RESET
      currentTranscript = "";
      currentSpeakerName = null;
      speakerStartTime = null;
      elapsedSeconds = 0;

      stableTranscript = "";
      liveCaptionBuffer = "";
      unchangedCaptionCount = 0;
      lastSentTranscript = "";
      lastProcessedCaption = "";

      sendToSidebar({
        action: "speakerEnded",
        speakerName: speakerData.speakerName,
      });

      sendResponse({
        success: true,
      });

      return true;
    }

    // STORE REPORT
    if (message.action === "storeCompletedReport") {
      const speaker = completedSpeakers.find(
        (s) => s.speakerName === message.speakerName,
      );

      if (speaker) {
        speaker.report = message.report;

        speaker.generalEvaluation = message.generalEvaluation;

        console.log("Final report stored:", speaker);
      }

      return true;
    }

    // SEND OTHER EVENTS TO SIDEBAR
    sendToSidebar(message);

    return true;
  });
}
