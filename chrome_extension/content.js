// Prevent double injection
if (window.toastmasterInitialized) {
  console.log('Toastmaster: Already loaded, skipping');
} else {
window.toastmasterInitialized = true;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let sidebar = null;
let currentSpeakerName = null;
let fullTranscript = '';
let speakerTranscripts = {};
let wordOfDay = null;
let speechType = 'table_topics';
let meetingStartTime = null;
let speakerStartTime = null;
let silenceTimer = null;
let chunkInterval = null;
const SILENCE_THRESHOLD = 5000;
const CHUNK_INTERVAL = 10000;

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function injectSidebar() {
  if (document.getElementById('toastmaster-sidebar-container')) return;

  const container = document.createElement('div');
  container.id = 'toastmaster-sidebar-container';
  container.style.cssText = `
    position: fixed; top: 0; right: 0;
    width: 380px; height: 100vh;
    z-index: 999999;
    border-left: 3px solid #e94560;
    box-shadow: -4px 0 20px rgba(0,0,0,0.3);
  `;

  const iframe = document.createElement('iframe');
  iframe.id = 'toastmaster-sidebar';
  iframe.src = chrome.runtime.getURL('sidebar.html');
  iframe.style.cssText = 'width:100%;height:100%;border:none;';

  container.appendChild(iframe);
  document.body.appendChild(container);
  sidebar = iframe;
  console.log('Toastmaster: Sidebar injected');
}

function removeSidebar() {
  const container = document.getElementById('toastmaster-sidebar-container');
  if (container) container.remove();
  sidebar = null;
}

function sendToSidebar(message) {
  if (sidebar && sidebar.contentWindow) {
    sidebar.contentWindow.postMessage(message, '*');
  }
}

// ─── Audio Capture ────────────────────────────────────────────────────────────

async function startCapture() {
  try {
    // Get stream ID from background service worker
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getStreamId' }, (res) => {
        resolve(res);
      });
    });

    if (response && response.streamId) {
      // Capture tab audio
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: response.streamId
          }
        },
        video: false
      });
      startRecording(stream);
      sendToSidebar({ action: 'recognitionStarted' });
      console.log('Toastmaster: Tab audio capture started');
    } else {
      // Fallback to microphone
      await startMicrophoneCapture();
    }
  } catch (error) {
    console.error('Toastmaster capture error:', error);
    await startMicrophoneCapture();
  }
}

async function startMicrophoneCapture() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    startRecording(stream);
    sendToSidebar({ action: 'recognitionStarted' });
    console.log('Toastmaster: Microphone capture started');
  } catch (error) {
    console.error('Toastmaster mic error:', error);
    sendToSidebar({
      action: 'error',
      message: 'Could not access audio. Please allow microphone permission.'
    });
  }
}

function startRecording(stream) {
  isRecording = true;
  audioChunks = [];

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  mediaRecorder = new MediaRecorder(stream, { mimeType });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    if (audioChunks.length > 0) {
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      audioChunks = [];
      await transcribeChunk(audioBlob);
    }
  };

  mediaRecorder.start();

  // Process audio every 10 seconds
  chunkInterval = setInterval(() => {
    if (!isRecording) {
      clearInterval(chunkInterval);
      return;
    }
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setTimeout(() => {
        if (isRecording && mediaRecorder) {
          try { mediaRecorder.start(); } catch(e) {}
        }
      }, 200);
    }
  }, CHUNK_INTERVAL);
}

async function transcribeChunk(audioBlob) {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    if (currentSpeakerName) formData.append('speaker', currentSpeakerName);

    const response = await fetch('http://localhost:3001/transcribe', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) return;

    const data = await response.json();
    const text = data.transcript ? data.transcript.trim() : '';

    if (!text) return;

    console.log('Toastmaster transcript:', text);

    fullTranscript += ' ' + text;

    if (currentSpeakerName) {
      if (!speakerTranscripts[currentSpeakerName]) speakerTranscripts[currentSpeakerName] = '';
      speakerTranscripts[currentSpeakerName] += ' ' + text;
    }

    if (!wordOfDay) detectWordOfDay(text);
    detectSpeechType(text);

    sendToSidebar({
      action: 'liveTranscript',
      final: text,
      interim: '',
      speaker: currentSpeakerName
    });

    resetSilenceTimer();

  } catch (error) {
    console.error('Toastmaster transcription error:', error);
  }
}

function stopCapture() {
  isRecording = false;
  clearInterval(chunkInterval);
  clearTimeout(silenceTimer);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch(e) {}
  }
  mediaRecorder = null;
}

// ─── Detection ────────────────────────────────────────────────────────────────

function detectWordOfDay(text) {
  const patterns = [
    /word of (?:the )?day is ["]?(\w+)["]?/i,
    /today'?s? word is ["]?(\w+)["]?/i,
    /our word (?:of the day )?is ["]?(\w+)["]?/i,
    /word for today is ["]?(\w+)["]?/i,
    /word of the day[,:]? ["]?(\w+)["]?/i,
    /the word is ["]?(\w+)["]?/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      wordOfDay = match[1];
      console.log('Toastmaster: Word of Day detected:', wordOfDay);
      sendToSidebar({ action: 'wordOfDayDetected', word: wordOfDay });
      chrome.runtime.sendMessage({ action: 'wordOfDayDetected', word: wordOfDay });
      break;
    }
  }
}

function detectSpeechType(text) {
  if (/table topics/i.test(text) || /impromptu/i.test(text)) {
    speechType = 'table_topics';
    sendToSidebar({ action: 'speechTypeDetected', speechType: 'table_topics' });
    chrome.runtime.sendMessage({ action: 'speechTypeDetected', speechType: 'table_topics' });
  } else if (/prepared speech/i.test(text) || /prepared speaker/i.test(text)) {
    speechType = 'prepared_speech';
    sendToSidebar({ action: 'speechTypeDetected', speechType: 'prepared_speech' });
    chrome.runtime.sendMessage({ action: 'speechTypeDetected', speechType: 'prepared_speech' });
  }
}

function resetSilenceTimer() {
  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(() => {
    if (currentSpeakerName) {
      sendToSidebar({
        action: 'silenceDetected',
        speakerName: currentSpeakerName,
        duration: Math.round((Date.now() - speakerStartTime) / 1000)
      });
    }
  }, SILENCE_THRESHOLD);
}

// ─── Speaker Management ───────────────────────────────────────────────────────

function handleNextSpeaker(speakerName) {
  if (currentSpeakerName && speakerTranscripts[currentSpeakerName]) {
    triggerEvaluation(currentSpeakerName);
  }

  currentSpeakerName = speakerName;
  speakerStartTime = Date.now();
  speakerTranscripts[speakerName] = '';

  sendToSidebar({
    action: 'speakerChanged',
    speakerName,
    timestamp: new Date().toLocaleTimeString()
  });

  console.log('Toastmaster: Speaker changed to:', speakerName);
}

function handleEndSpeaker() {
  if (!currentSpeakerName) return;
  triggerEvaluation(currentSpeakerName);
  currentSpeakerName = null;
}

function triggerEvaluation(speakerName) {
  const duration = Math.round((Date.now() - speakerStartTime) / 1000);
  const transcript = speakerTranscripts[speakerName] || '';

  console.log('Toastmaster: Evaluating:', speakerName, 'Duration:', duration, 'Transcript:', transcript.substring(0, 100));

  sendToSidebar({ action: 'speakerEnding', speakerName, duration });

  chrome.runtime.sendMessage({
    action: 'evaluateSpeaker',
    speakerName,
    transcript,
    duration,
    wordOfDay,
    speechType
  });
}

// ─── Message Listeners ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startMeeting') {
    meetingStartTime = Date.now();
    injectSidebar();
    setTimeout(() => startCapture(), 1500);
    sendResponse({ success: true });
  }

  if (message.action === 'stopMeeting') {
    stopCapture();
    setTimeout(() => removeSidebar(), 500);
    sendResponse({ success: true });
  }

  if (message.action === 'nextSpeaker') {
    handleNextSpeaker(message.speakerName);
    sendResponse({ success: true });
  }

  if (message.action === 'endSpeaker') {
    handleEndSpeaker();
    sendResponse({ success: true });
  }

  if (message.action === 'evaluationComplete') {
    sendToSidebar({
      action: 'evaluationComplete',
      speakerName: message.speakerName,
      data: message.data
    });
    sendResponse({ success: true });
  }

  if (message.action === 'evaluationError') {
    sendToSidebar({
      action: 'evaluationError',
      speakerName: message.speakerName,
      error: message.error
    });
    sendResponse({ success: true });
  }

  return true;
});

window.addEventListener('message', (event) => {
  if (!event.data || !event.data.action) return;
  if (event.data.action === 'nextSpeaker') handleNextSpeaker(event.data.speakerName);
  if (event.data.action === 'endSpeaker') handleEndSpeaker();
  if (event.data.action === 'setWordOfDay') wordOfDay = event.data.word;
});

console.log('Toastmaster: Content script loaded on', window.location.href);
}