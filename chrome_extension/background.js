chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ─────────────────────────────────────────────
  // Get Stream ID for Tab Audio Capture
  // ─────────────────────────────────────────────

  if (message.action === 'getStreamId') {

    chrome.tabCapture.getMediaStreamId(
      {
        consumerTabId: sender.tab.id
      },

      (streamId) => {

        if (chrome.runtime.lastError) {

          console.error(
            'Stream ID Error:',
            chrome.runtime.lastError.message
          );

          sendResponse({
            streamId: null,
            error: chrome.runtime.lastError.message
          });

        } else {

          console.log(
            'Stream ID generated:',
            streamId
          );

          sendResponse({
            streamId
          });
        }
      }
    );

    return true;
  }


  // ─────────────────────────────────────────────
  // Evaluate Speaker
  // ─────────────────────────────────────────────

  if (message.action === 'evaluateSpeaker') {

    evaluateSpeaker(
      message,
      sender.tab.id
    );

    sendResponse({
      success: true
    });

    return true;
  }


  // ─────────────────────────────────────────────
  // Word of Day
  // ─────────────────────────────────────────────

  if (message.action === 'wordOfDayDetected') {

    chrome.runtime.sendMessage({
      action: 'wordOfDayDetected',
      word: message.word
    }).catch(() => {});

    sendResponse({
      success: true
    });

    return true;
  }


  // ─────────────────────────────────────────────
  // Speech Type
  // ─────────────────────────────────────────────

  if (message.action === 'speechTypeDetected') {

    chrome.runtime.sendMessage({
      action: 'speechTypeDetected',
      speechType: message.speechType
    }).catch(() => {});

    sendResponse({
      success: true
    });

    return true;
  }

  return true;
});


// ─────────────────────────────────────────────
// Evaluate Speaker Function
// ─────────────────────────────────────────────

async function evaluateSpeaker(message, tabId) {

  const {
    speakerName,
    transcript,
    duration,
    wordOfDay,
    speechType
  } = message;


  // Transcript validation

  if (
    !transcript ||
    transcript.trim().length < 20
  ) {

    chrome.tabs.sendMessage(tabId, {
      action: 'evaluationError',
      speakerName,
      error:
        'Transcript too short for evaluation. Please speak longer.'
    }).catch(() => {});

    return;
  }


  try {

    console.log(
      'Sending transcript for evaluation...'
    );

    const response =
      await fetch(
        'http://localhost:3001/analyze',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            transcript: transcript.trim(),
            speakerName,
            wordOfDay:
              wordOfDay || 'unknown',
            durationSeconds: duration,
            speechType:
              speechType || 'table_topics'
          })
        }
      );


    const data =
      await response.json();


    if (data.success) {

      console.log(
        'Evaluation completed'
      );

      chrome.tabs.sendMessage(tabId, {
        action: 'evaluationComplete',
        speakerName,
        data
      }).catch(() => {});


      chrome.runtime.sendMessage({
        action: 'speakerEvaluated',
        speakerName
      }).catch(() => {});
    }

  } catch (error) {

    console.error(
      'Backend Error:',
      error
    );

    chrome.tabs.sendMessage(tabId, {
      action: 'evaluationError',
      speakerName,
      error:
        'Backend server not running. Please start with: node index.js'
    }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.action === 'getStreamId') {
    chrome.tabCapture.getMediaStreamId(
      { targetTabId: sender.tab.id },
      (streamId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ streamId: null });
        } else {
          sendResponse({ streamId });
        }
      }
    );
    return true;
  }

  if (message.action === 'transcribeAudio') {
    transcribeAudio(message.audioBase64, message.mimeType)
      .then(transcript => sendResponse({ transcript }))
      .catch(err => sendResponse({ transcript: '', error: err.message }));
    return true;
  }

  if (message.action === 'evaluateSpeaker') {
    evaluateSpeaker(message, sender.tab.id);
    sendResponse({ success: true });
  }

  if (message.action === 'wordOfDayDetected') {
    chrome.runtime.sendMessage({ action: 'wordOfDayDetected', word: message.word }).catch(() => {});
    sendResponse({ success: true });
  }

  if (message.action === 'speechTypeDetected') {
    chrome.runtime.sendMessage({ action: 'speechTypeDetected', speechType: message.speechType }).catch(() => {});
    sendResponse({ success: true });
  }

  return true;
});

async function transcribeAudio(audioBase64, mimeType) {
  try {
    // Convert base64 back to blob
    const byteCharacters = atob(audioBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    const formData = new FormData();
    formData.append('audio', blob, 'audio.webm');

    const response = await fetch('http://localhost:3001/transcribe', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) return '';
    const data = await response.json();
    return data.transcript || '';
  } catch (error) {
    console.error('Background transcription error:', error);
    return '';
  }
}

async function evaluateSpeaker(message, tabId) {
  const { speakerName, transcript, duration, wordOfDay, speechType } = message;

  if (!transcript || transcript.trim().length < 20) {
    chrome.tabs.sendMessage(tabId, {
      action: 'evaluationError',
      speakerName,
      error: 'Transcript too short. Please speak longer!'
    }).catch(() => {});
    return;
  }

  try {
    const response = await fetch('http://localhost:3001/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: transcript.trim(),
        speakerName,
        wordOfDay: wordOfDay || 'unknown',
        durationSeconds: duration,
        speechType: speechType || 'table_topics'
      })
    });

    const data = await response.json();
    if (data.success) {
      chrome.tabs.sendMessage(tabId, {
        action: 'evaluationComplete',
        speakerName,
        data
      }).catch(() => {});

      chrome.runtime.sendMessage({
        action: 'speakerEvaluated',
        speakerName
      }).catch(() => {});
    }
  } catch (error) {
    chrome.tabs.sendMessage(tabId, {
      action: 'evaluationError',
      speakerName,
      error: 'Backend not running. Start with: node index.js'
    }).catch(() => {});
  }
}

console.log(
  'Toastmaster background service worker loaded'
);