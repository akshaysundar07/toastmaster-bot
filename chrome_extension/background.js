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


console.log(
  'Toastmaster background service worker loaded'
);