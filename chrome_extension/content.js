// Prevent double injection
if (window.toastmasterInitialized) {

  console.log('Toastmaster: Already loaded');

} else {

window.toastmasterInitialized = true;


// ─────────────────────────────────────────────
// Global Variables
// ─────────────────────────────────────────────

let sidebar = null;

let currentSpeakerName = null;

let fullTranscript = '';

let speakerTranscripts = {};

let wordOfDay = null;

let speechType = 'table_topics';

let meetingStartTime = null;

let speakerStartTime = null;

let silenceTimer = null;

let captionInterval = null;

let timerInterval = null;

let elapsedSeconds = 0;

const SILENCE_THRESHOLD = 5000;


// ─────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────

function injectSidebar() {

  if (
    document.getElementById(
      'toastmaster-sidebar-container'
    )
  ) return;


  const container =
    document.createElement('div');

  container.id =
    'toastmaster-sidebar-container';

  container.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 380px;
    height: 100vh;
    z-index: 999999;
    border-left: 3px solid #e94560;
    box-shadow: -4px 0 20px rgba(0,0,0,0.3);
  `;


  const iframe =
    document.createElement('iframe');

  iframe.id = 'toastmaster-sidebar';

  iframe.src =
    chrome.runtime.getURL('sidebar.html');

  iframe.style.cssText =
    'width:100%;height:100%;border:none;';


  container.appendChild(iframe);

  document.body.appendChild(container);

  sidebar = iframe;

  console.log(
    'Toastmaster: Sidebar injected'
  );
}


function removeSidebar() {

  const container =
    document.getElementById(
      'toastmaster-sidebar-container'
    );

  if (container) {

    container.remove();
  }

  sidebar = null;
}


function sendToSidebar(message) {

  if (
    sidebar &&
    sidebar.contentWindow
  ) {

    sidebar.contentWindow.postMessage(
      message,
      '*'
    );
  }
}


// ─────────────────────────────────────────────
// Caption Capture
// ─────────────────────────────────────────────

function startCaptionCapture() {

  if (captionInterval) {
    clearInterval(captionInterval);
  }

  captionInterval = setInterval(() => {

    const possibleCaptions = [];

    // Search all visible spans/divs
    document.querySelectorAll('span, div').forEach((el) => {

      const text = el.innerText?.trim();

      if (
        text &&
        text.length > 5 &&
        text.length < 300
      ) {

        const rect = el.getBoundingClientRect();

        // Captions usually appear near bottom-center
        const nearBottom =
          rect.top > window.innerHeight * 0.55;

        const visible =
          rect.width > 0 &&
          rect.height > 0;

        if (nearBottom && visible) {

          possibleCaptions.push(text);
        }
      }
    });

    possibleCaptions.forEach((text) => {

      if (!fullTranscript.includes(text)) {
        if (
  currentSpeakerName &&
  !speakerStartTime
) {

  speakerStartTime = Date.now();

  console.log(
    'Speech started'
  );

  startTimer();

  sendToSidebar({
    action: 'speechStarted',
    speakerName: currentSpeakerName
  });
}

        fullTranscript += ' ' + text;

        if (currentSpeakerName) {

          if (!speakerTranscripts[currentSpeakerName]) {
            speakerTranscripts[currentSpeakerName] = '';
          }

          speakerTranscripts[currentSpeakerName] += ' ' + text;
        }

        console.log(
          'Toastmaster caption:',
          text
        );

        sendToSidebar({
          action: 'liveTranscript',
          final: text,
          interim: '',
          speaker: currentSpeakerName
        });

        detectWordOfDay(text);

        detectSpeechType(text);

        resetSilenceTimer();
      }
    });

  }, 2000);

  console.log(
    'Toastmaster: Caption capture started'
  );
}


function stopCaptionCapture() {

  if (captionInterval) {

    clearInterval(captionInterval);

    captionInterval = null;
  }
}


// ─────────────────────────────────────────────
// Detection
// ─────────────────────────────────────────────

function detectWordOfDay(text) {

  const lower = text.toLowerCase();

  const patterns = [

    /word of the day is (\w+)/i,

    /today'?s word is (\w+)/i,

    /our word of the day is (\w+)/i,

    /the word of the day today is (\w+)/i,

    /word for today is (\w+)/i,

    /today we have the word (\w+)/i,

    /the word is (\w+)/i
  ];

  for (const pattern of patterns) {

    const match = text.match(pattern);

    if (match && match[1]) {

      let detectedWord = match[1]
        .replace(/[^a-zA-Z]/g, '')
        .trim();

      if (
        detectedWord.length > 1 &&
        detectedWord.length < 25
      ) {

        wordOfDay = detectedWord;

        console.log(
          'Toastmaster: Word of Day detected:',
          wordOfDay
        );

        sendToSidebar({
          action: 'wordOfDayDetected',
          word: wordOfDay
        });

        chrome.runtime.sendMessage({
          action: 'wordOfDayDetected',
          word: wordOfDay
        });

        break;
      }
    }
  }
}

function detectSpeechType(text) {

  const lower = text.toLowerCase();

  // Table Topics
  if (
    lower.includes('table topic') ||
    lower.includes('table topics') ||
    lower.includes('impromptu')
  ) {

    speechType = 'table_topics';

    console.log(
      'Speech Type:',
      speechType
    );

    sendToSidebar({
      action: 'speechTypeDetected',
      speechType
    });

    return;
  }

  // Prepared Speech
  if (
    lower.includes('prepared speech') ||
    lower.includes('project speech') ||
    lower.includes('ice breaker') ||
    lower.includes('pathways')
  ) {

    speechType = 'prepared_speech';

    console.log(
      'Speech Type:',
      speechType
    );

    sendToSidebar({
      action: 'speechTypeDetected',
      speechType
    });

    return;
  }

  // Evaluation
  if (
    lower.includes('evaluation') ||
    lower.includes('evaluator')
  ) {

    speechType = 'evaluation';

    console.log(
      'Speech Type:',
      speechType
    );

    sendToSidebar({
      action: 'speechTypeDetected',
      speechType
    });

    return;
  }
}
function startTimer() {

  clearInterval(timerInterval);

  elapsedSeconds = 0;

  timerInterval = setInterval(() => {

    elapsedSeconds++;

    sendToSidebar({
      action: 'timerUpdate',
      seconds: elapsedSeconds
    });

  }, 1000);
}


function stopTimer() {

  clearInterval(timerInterval);
}

function resetSilenceTimer() {

  clearTimeout(silenceTimer);

  silenceTimer = setTimeout(() => {

  if (currentSpeakerName) {

    console.log(
      'Speech ended'
    );

    stopTimer();

    sendToSidebar({
      action: 'speechEnded',
      speakerName: currentSpeakerName,
      duration: elapsedSeconds
    });

    triggerEvaluation(
      currentSpeakerName
    );
  }

}, 5000);
}


// ─────────────────────────────────────────────
// Speaker Management
// ─────────────────────────────────────────────

function handleNextSpeaker(speakerName) {

  if (
    currentSpeakerName &&
    speakerTranscripts[currentSpeakerName]
  ) {

    triggerEvaluation(
      currentSpeakerName
    );
  }

  currentSpeakerName = speakerName;

  speakerStartTime = null;

  speakerTranscripts[speakerName] = '';

  sendToSidebar({
    action: 'speakerChanged',
    speakerName,
    timestamp:
      new Date().toLocaleTimeString()
  });

  console.log(
    'Toastmaster: Speaker changed to:',
    speakerName
  );
}


function handleEndSpeaker() {

  if (!currentSpeakerName) return;
  stopTimer();

  triggerEvaluation(
    currentSpeakerName
  );

  currentSpeakerName = null;
}


function triggerEvaluation(speakerName) {

  const duration =
    Math.round(
      (Date.now() - speakerStartTime)
      / 1000
    );

  const transcript =
    speakerTranscripts[speakerName]
    || '';

  console.log(
    'Toastmaster: Evaluating:',
    speakerName
  );

  console.log(
    'Transcript:',
    transcript
  );

  sendToSidebar({
    action: 'speakerEnding',
    speakerName,
    duration
  });

  chrome.runtime.sendMessage({

    action: 'evaluateSpeaker',

    speakerName,

    transcript,

    duration,

    wordOfDay,

    speechType
  });
}


// ─────────────────────────────────────────────
// Message Listeners
// ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message,
    sender,
    sendResponse
  ) => {

    if (
      message.action ===
      'startMeeting'
    ) {

      meetingStartTime = Date.now();

      injectSidebar();

      startCaptionCapture();

      sendResponse({
        success: true
      });
    }


    if (
      message.action ===
      'stopMeeting'
    ) {

      stopCaptionCapture();

      setTimeout(() => {

        removeSidebar();

      }, 500);

      sendResponse({
        success: true
      });
    }


    if (
      message.action ===
      'nextSpeaker'
    ) {

      handleNextSpeaker(
        message.speakerName
      );

      sendResponse({
        success: true
      });
    }


    if (
      message.action ===
      'endSpeaker'
    ) {

      handleEndSpeaker();

      sendResponse({
        success: true
      });
    }


    if (
      message.action ===
      'evaluationComplete'
    ) {

      sendToSidebar({
        action: 'evaluationComplete',
        speakerName:
          message.speakerName,
        data: message.data
      });

      sendResponse({
        success: true
      });
    }


    if (
      message.action ===
      'evaluationError'
    ) {

      sendToSidebar({
        action: 'evaluationError',
        speakerName:
          message.speakerName,
        error: message.error
      });

      sendResponse({
        success: true
      });
    }

    return true;
  }
);


// ─────────────────────────────────────────────
// Window Message Listener
// ─────────────────────────────────────────────

window.addEventListener(
  'message',
  (event) => {

    if (
      !event.data ||
      !event.data.action
    ) return;


    if (
      event.data.action ===
      'nextSpeaker'
    ) {

      handleNextSpeaker(
        event.data.speakerName
      );
    }


    if (
      event.data.action ===
      'endSpeaker'
    ) {

      handleEndSpeaker();
    }


    if (
      event.data.action ===
      'setWordOfDay'
    ) {

      wordOfDay =
        event.data.word;
    }
  }
);


console.log(
  'Toastmaster: Content script loaded on',
  window.location.href
);

}