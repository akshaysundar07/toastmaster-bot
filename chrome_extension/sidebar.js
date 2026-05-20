let speakers = {};
let wordOfDay = null;
let speechType = 'table_topics';

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || !msg.action) return;

  if (msg.action === 'recognitionStarted') {
    document.getElementById('header-status').textContent = '🟢 Listening...';
    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.style.display = 'none';
  }

  if (msg.action === 'wordOfDayDetected') {
    wordOfDay = msg.word;
    document.getElementById('word-of-day').textContent = msg.word;
  }

  if (msg.action === 'speechTypeDetected') {
    speechType = msg.speechType;
    document.getElementById('speech-type').textContent =
      msg.speechType === 'prepared_speech' ? 'Prepared' : 'Table Topics';
  }

  if (msg.action === 'liveTranscript') {
    updateLiveTranscript(msg.final, msg.interim, msg.speaker);
  }

  if (msg.action === 'speakerChanged') {
    handleSpeakerChanged(msg.speakerName, msg.timestamp);
  }

  if (msg.action === 'speakerEnding') {
    updateSpeakerStatus(msg.speakerName, 'evaluating');
    document.getElementById('header-status').textContent = `⏳ Evaluating ${msg.speakerName}...`;
  }

  if (msg.action === 'silenceDetected') {
    const warning = document.getElementById('silence-warning');
    if (warning) {
      warning.style.display = 'block';
      setTimeout(() => { warning.style.display = 'none'; }, 5000);
    }
  }

  if (msg.action === 'evaluationComplete') {
    if (speakers[msg.speakerName]) {
      speakers[msg.speakerName].status = 'done';
      speakers[msg.speakerName].report = msg.data;
      updateSpeakerCard(msg.speakerName);
    }
    document.getElementById('header-status').textContent = `✅ ${msg.speakerName} evaluated!`;
  }

  if (msg.action === 'evaluationError') {
    if (speakers[msg.speakerName]) {
      speakers[msg.speakerName].status = 'error';
      updateSpeakerCard(msg.speakerName);
    }
    document.getElementById('header-status').textContent = `❌ Error: ${msg.error}`;
  }

  if (msg.action === 'error') {
    document.getElementById('header-status').textContent = `❌ ${msg.message}`;
  }
});

function updateLiveTranscript(finalText, interimText, speaker) {
  const el = document.getElementById('live-transcript-text');
  if (!el) return;
  const speakerLabel = speaker
    ? `<span style="color:#e94560;font-weight:700">${speaker}: </span>`
    : '';
  el.innerHTML = `
    ${speakerLabel}
    <span style="color:#fff">${finalText || ''}</span>
    <span style="color:#aaa;font-style:italic">${interimText || ''}</span>
  `;
  el.scrollTop = el.scrollHeight;
}

function handleSpeakerChanged(speakerName, timestamp) {
  Object.keys(speakers).forEach(name => {
    if (speakers[name].status === 'speaking') {
      speakers[name].status = 'waiting';
    }
  });

  speakers[speakerName] = {
    name: speakerName,
    status: 'speaking',
    startTime: timestamp,
    report: null
  };

  renderSpeakerCard(speakerName);
  document.getElementById('header-status').textContent = `🔴 ${speakerName} is speaking...`;
}

function renderSpeakerCard(speakerName) {
  const section = document.getElementById('speakers-section');
  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.style.display = 'none';

  if (document.getElementById(`speaker-${speakerName}`)) return;

  const card = document.createElement('div');
  card.className = 'speaker-card active';
  card.id = `speaker-${speakerName}`;
  card.innerHTML = `
    <div class="speaker-header">
      <div class="speaker-name">🎙️ ${speakerName}</div>
      <span class="speaker-badge badge-speaking" id="badge-${speakerName}">Speaking</span>
    </div>
    <div id="content-${speakerName}">
      <div style="color:#aaa;font-size:12px;text-align:center;padding:10px">
        Listening to speech...
      </div>
    </div>
  `;
  section.insertBefore(card, section.firstChild);
}

function updateSpeakerStatus(speakerName, status) {
  const card = document.getElementById(`speaker-${speakerName}`);
  const badge = document.getElementById(`badge-${speakerName}`);
  if (!card || !badge) return;

  if (status === 'evaluating') {
    card.className = 'speaker-card';
    badge.className = 'speaker-badge badge-evaluating';
    badge.textContent = '⏳ Evaluating';
    document.getElementById(`content-${speakerName}`).innerHTML = `
      <div style="color:#2196f3;font-size:12px;text-align:center;padding:10px">
        🤖 AI agents analyzing speech...
      </div>
    `;
  }

  if (status === 'error') {
    badge.className = 'speaker-badge';
    badge.style.background = '#3a1a1a';
    badge.style.color = '#e94560';
    badge.textContent = '❌ Error';
    document.getElementById(`content-${speakerName}`).innerHTML = `
      <div style="color:#e94560;font-size:12px;padding:10px">
        Could not evaluate. Transcript may be too short.
      </div>
    `;
  }
}

function updateSpeakerCard(speakerName) {
  const speaker = speakers[speakerName];
  if (!speaker) return;

  const card = document.getElementById(`speaker-${speakerName}`);
  const badge = document.getElementById(`badge-${speakerName}`);
  if (!card) return;

  if (speaker.status === 'done' && speaker.report) {
    card.className = 'speaker-card evaluated';
    if (badge) {
      badge.className = 'speaker-badge badge-done';
      badge.textContent = '✅ Evaluated';
    }
    renderReport(speakerName, speaker.report);
  } else if (speaker.status === 'error') {
    updateSpeakerStatus(speakerName, 'error');
  }
}

function renderReport(speakerName, data) {
  const report = data.report;
  const generalEval = data.generalEvaluation;
  const content = document.getElementById(`content-${speakerName}`);
  if (!content || !report) return;

  const t = report.details.timer;
  const g = report.details.grammarian;
  const ah = report.details.ahCounter;
  const w = report.details.wordOfDay;

  const signalClass = t.signal === 'GREEN' ? 'signal-green' :
    t.signal === 'YELLOW' ? 'signal-yellow' : 'signal-red';

  let html = `
    <div class="summary-grid">
      <div class="summary-item">
        <div class="s-value">${report.summary.grammarScore}/10</div>
        <div class="s-label">Grammar</div>
      </div>
      <div class="summary-item">
        <div class="s-value">${report.summary.totalFillers}</div>
        <div class="s-label">Fillers</div>
      </div>
      <div class="summary-item">
        <div class="s-value ${signalClass}">${t.signalEmoji} ${t.signal}</div>
        <div class="s-label">Timer</div>
      </div>
      <div class="summary-item">
        <div class="s-value">${t.timeFormatted}</div>
        <div class="s-label">Duration</div>
      </div>
    </div>
  `;

  html += `
    <div class="agent-result">
      <h4>💡 Word of Day — "${w.wordOfDay}"</h4>
      <p>${w.used
        ? `✅ Used ${w.occurrences} time(s)`
        : '❌ Word of day not used'}</p>
    </div>
  `;

  if (g.grammarMistakes && g.grammarMistakes.length > 0) {
    html += `<div class="agent-result"><h4>📝 Grammar Mistakes</h4>`;
    g.grammarMistakes.slice(0, 3).forEach(m => {
      html += `
        <div class="mistake-item">
          <div class="wrong">❌ "${m.mistake}"</div>
          <div class="correct">✅ "${m.correction}"</div>
        </div>
      `;
    });
    html += `<p style="color:#aaa;font-size:12px;margin-top:6px">${g.feedback}</p></div>`;
  } else {
    html += `<div class="agent-result"><h4>📝 Grammar</h4><p>✅ No mistakes found!</p></div>`;
  }

  if (ah.totalFillerCount > 0) {
    html += `<div class="agent-result"><h4>🔊 Filler Words</h4><div class="filler-list">`;
    const allFillers = { ...(ah.fillerSounds || {}), ...(ah.fillerWords || {}) };
    Object.entries(allFillers)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([word, count]) => {
        html += `<span class="filler-tag">"${word}" <span class="count">${count}x</span></span>`;
      });
    html += `</div><p style="color:#aaa;font-size:12px;margin-top:6px">${ah.feedback}</p></div>`;
  }

  if (generalEval) {
    const evalId = `eval_${speakerName.replace(/\s/g, '_')}`;
    window[evalId] = generalEval.evaluationText;
    html += `
      <div class="general-eval">
        <h3>🎤 General Evaluation</h3>
        <p>${generalEval.evaluationText}</p>
        <button class="play-btn" id="play-${evalId}">▶ Play</button>
        <button class="stop-btn" id="stop-${evalId}">⏹ Stop</button>
      </div>
    `;
  }

  content.innerHTML = html;

  if (generalEval) {
    const evalId = `eval_${speakerName.replace(/\s/g, '_')}`;
    const playBtn = document.getElementById(`play-${evalId}`);
    const stopBtn = document.getElementById(`stop-${evalId}`);
    if (playBtn) playBtn.addEventListener('click', () => speakEval(evalId));
    if (stopBtn) stopBtn.addEventListener('click', stopSpeaking);
  }
}

function speakEval(evalId) {
  const text = window[evalId];
  if (!text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.name.includes('Samantha') ||
    v.name.includes('Google US English') ||
    v.name.includes('Karen')
  );
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
  window.speechSynthesis.cancel();
}