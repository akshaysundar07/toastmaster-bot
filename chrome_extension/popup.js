let isMeetingActive = false;
let currentSpeaker = null;
let speakersList = {};
let timerInterval = null;
let speakerStartTime = null;
let wordOfDay = null;
let speechType = 'table_topics';

async function checkMeetingPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const meetingUrls = ['meet.google.com', 'teams.microsoft.com', 'zoom.us'];
  const isMeetingPage = meetingUrls.some(url => tab.url && tab.url.includes(url));

  if (!isMeetingPage) {
    document.getElementById('not-meeting-page').classList.remove('hidden');
    document.getElementById('main-content').classList.add('hidden');
  }

  return { isMeetingPage, tab };
}

async function startMeeting() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const meetingUrls = ['meet.google.com', 'teams.microsoft.com', 'zoom.us'];
  const isMeetingPage = meetingUrls.some(url => tab.url && tab.url.includes(url));

  if (!isMeetingPage) {
    document.getElementById('not-meeting-page').classList.remove('hidden');
    document.getElementById('main-content').classList.add('hidden');
    return;
  }

  // Wait for content script to be ready
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'startMeeting' });

    isMeetingActive = true;
    speakersList = {};
    wordOfDay = null;

    document.getElementById('status-dot').classList.add('active');
    document.getElementById('status-text').textContent = 'Meeting active — listening...';
    document.getElementById('start-section').classList.add('hidden');
    document.getElementById('meeting-section').classList.remove('hidden');
    document.getElementById('speakers-list-box').style.display = 'block';

    chrome.storage.local.set({ isMeetingActive: true });

  } catch (error) {
    document.getElementById('status-text').textContent = 'Error: ' + error.message;
  }
}
async function stopMeeting() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'stopMeeting' });
  } catch (e) {
    // Ignore connection errors when stopping
    console.log('Stop note:', e.message);
  }

  isMeetingActive = false;
  currentSpeaker = null;
  stopTimer();

  document.getElementById('status-dot').classList.remove('active');
  document.getElementById('status-dot').classList.add('stopped');
  document.getElementById('status-text').textContent = 'Meeting stopped';
  document.getElementById('start-section').classList.remove('hidden');
  document.getElementById('meeting-section').classList.add('hidden');
  document.getElementById('timer').textContent = '00:00';
  document.getElementById('timer').className = 'timer';

  chrome.storage.local.set({ isMeetingActive: false });
}

async function setNextSpeaker() {
  const nameInput = document.getElementById('speaker-name-input');
  const speakerName = nameInput.value.trim();

  if (!speakerName) {
    alert('Please enter speaker name!');
    return;
  }

  if (!isMeetingActive) {
    alert('Please start the meeting first!');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: 'nextSpeaker',
      speakerName
    });

    currentSpeaker = speakerName;
    speakerStartTime = Date.now();

    speakersList[speakerName] = {
      name: speakerName,
      status: 'speaking',
      startTime: speakerStartTime
    };

    startTimer();

    document.getElementById('status-text').textContent = `🎙️ ${speakerName} is speaking...`;
    updateSpeakersList();
    nameInput.value = '';
  } catch (error) {
    console.error('Error setting next speaker:', error);
  }
}

async function endCurrentSpeaker() {
  if (!currentSpeaker) {
    alert('No active speaker!');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const duration = Math.round((Date.now() - speakerStartTime) / 1000);

  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: 'endSpeaker',
      speakerName: currentSpeaker,
      duration
    });

    if (speakersList[currentSpeaker]) {
      speakersList[currentSpeaker].status = 'evaluating';
      speakersList[currentSpeaker].duration = duration;
    }

    stopTimer();
    document.getElementById('status-text').textContent = `Evaluating ${currentSpeaker}...`;
    document.getElementById('timer').textContent = '00:00';
    document.getElementById('timer').className = 'timer';

    updateSpeakersList();
    currentSpeaker = null;
  } catch (error) {
    console.error('Error ending speaker:', error);
  }
}

function startTimer() {
  stopTimer();
  speakerStartTime = Date.now();

  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - speakerStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const timerEl = document.getElementById('timer');
    timerEl.textContent = timeStr;

    if (speechType === 'prepared_speech') {
      if (elapsed < 300) timerEl.className = 'timer red';
      else if (elapsed <= 360) timerEl.className = 'timer';
      else if (elapsed <= 420) timerEl.className = 'timer yellow';
      else timerEl.className = 'timer red';
    } else {
      if (elapsed <= 60) timerEl.className = 'timer';
      else if (elapsed <= 120) timerEl.className = 'timer yellow';
      else timerEl.className = 'timer red';
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateSpeakersList() {
  const listEl = document.getElementById('speakers-list');
  listEl.innerHTML = '';

  if (Object.keys(speakersList).length === 0) {
    listEl.innerHTML = '<div style="color:#aaa;font-size:13px">No speakers yet</div>';
    return;
  }

  Object.values(speakersList).forEach(speaker => {
    const item = document.createElement('div');
    item.className = 'speaker-item';
    const duration = speaker.duration
      ? `${Math.floor(speaker.duration / 60)}m ${speaker.duration % 60}s`
      : '';
    item.innerHTML = `
      <span style="color:#fff">${speaker.name} ${duration ? '(' + duration + ')' : ''}</span>
      <span class="speaker-status ${speaker.status}">${
        speaker.status === 'speaking' ? '🔴 Speaking' :
        speaker.status === 'evaluating' ? '⏳ Evaluating' :
        '✅ Done'
      }</span>
    `;
    listEl.appendChild(item);
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'wordOfDayDetected') {
    wordOfDay = message.word;
    const el = document.getElementById('word-display');
    el.className = 'word';
    el.textContent = message.word;
  }

  if (message.action === 'speechTypeDetected') {
    speechType = message.speechType;
  }

  if (message.action === 'speakerEvaluated') {
    if (speakersList[message.speakerName]) {
      speakersList[message.speakerName].status = 'done';
      updateSpeakersList();
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  checkMeetingPage();

  document.getElementById('start-btn')
    .addEventListener('click', startMeeting);

  document.getElementById('next-speaker-btn')
    .addEventListener('click', setNextSpeaker);

  document.getElementById('end-speaker-btn')
    .addEventListener('click', endCurrentSpeaker);

  document.getElementById('stop-btn')
    .addEventListener('click', stopMeeting);

  document.getElementById('speaker-name-input')
    .addEventListener('keypress', (e) => {
      if (e.key === 'Enter') setNextSpeaker();
    });

  chrome.storage.local.get(['isMeetingActive'], (result) => {
    if (result.isMeetingActive) {
      isMeetingActive = true;
      document.getElementById('status-dot').classList.add('active');
      document.getElementById('status-text').textContent = 'Meeting active — listening...';
      document.getElementById('start-section').classList.add('hidden');
      document.getElementById('meeting-section').classList.remove('hidden');
      document.getElementById('speakers-list-box').style.display = 'block';
    }
  });
});