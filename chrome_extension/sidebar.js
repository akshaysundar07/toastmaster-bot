
let speakers = {};
let wordOfDay = null;
let speechType = 'table_topics';

// Listen for messages from content script
window.addEventListener('message', (event) => {
const msg = event.data;

if (msg.action === 'recognitionStarted') {
    document.getElementById('header-status').textContent = '🟢 Listening...';
    document.getElementById('empty-state').style.display = 'none';
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

if (msg.action === 'silenceDetected') {
    document.getElementById('silence-warning').style.display = 'block';
    setTimeout(() => {
    document.getElementById('silence-warning').style.display = 'none';
    }, 5000);
}
});

function updateLiveTranscript(finalText, interimText, speaker) {
const el = document.getElementById('live-transcript-text');
const speakerLabel = speaker ? `<span style="color:#e94560;font-weight:700">${speaker}: </span>` : '';

el.innerHTML = `
    ${speakerLabel}
    <span class="final-text">${finalText || ''}</span>
    <span class="interim-text">${interimText || ''}</span>
`;
el.scrollTop = el.scrollHeight;
}

function handleSpeakerChanged(speakerName, timestamp) {
// Mark previous speaker as done
Object.keys(speakers).forEach(name => {
    if (speakers[name].status === 'speaking') {
    speakers[name].status = 'evaluating';
    updateSpeakerCard(name);
    }
});

// Create new speaker
speakers[speakerName] = {
    name: speakerName,
    status: 'speaking',
    startTime: timestamp,
    transcript: '',
    report: null
};

renderSpeakerCard(speakerName);
document.getElementById('header-status').textContent =
    `🔴 ${speakerName} is speaking...`;
}

function renderSpeakerCard(speakerName) {
const section = document.getElementById('speakers-section');
const emptyState = document.getElementById('empty-state');
if (emptyState) emptyState.style.display = 'none';

const existing = document.getElementById(`speaker-${speakerName}`);
if (existing) return;

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
        <span class="loading-dots">Listening</span>...
    </div>
    </div>
`;

section.insertBefore(card, section.firstChild);
}

function updateSpeakerCard(speakerName) {
const card = document.getElementById(`speaker-${speakerName}`);
const badge = document.getElementById(`badge-${speakerName}`);
if (!card || !badge) return;

const speaker = speakers[speakerName];

if (speaker.status === 'evaluating') {
    card.className = 'speaker-card';
    badge.className = 'speaker-badge badge-evaluating';
    badge.textContent = '⏳ Evaluating';
    document.getElementById(`content-${speakerName}`).innerHTML = `
    <div style="color:#2196f3;font-size:12px;text-align:center;padding:10px">
        🤖 AI agents analyzing speech...
    </div>
    `;
}

if (speaker.status === 'done' && speaker.report) {
    card.className = 'speaker-card evaluated';
    badge.className = 'speaker-badge badge-done';
    badge.textContent = '✅ Evaluated';
    renderReport(speakerName, speaker.report);
}
}

function renderReport(speakerName, data) {
const report = data.report;
const generalEval = data.generalEvaluation;
const content = document.getElementById(`content-${speakerName}`);

if (!report) return;

const t = report.details.timer;
const g = report.details.grammarian;
const ah = report.details.ahCounter;
const w = report.details.wordOfDay;

const signalClass = t.signal === 'GREEN' ? 'signal-green' :
    t.signal === 'YELLOW' ? 'signal-yellow' : 'signal-red';

// Summary grid
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

// Word of Day
html += `
    <div class="agent-result">
    <h4>💡 Word of Day</h4>
    <p>${w.used ? '✅ Used "' + w.wordOfDay + '" ' + w.occurrences + ' time(s)' : '❌ Word of day not used'}</p>
    </div>
`;

// Grammar mistakes
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
    html += `</div>`;
} else {
    html += `<div class="agent-result"><h4>📝 Grammar</h4><p>✅ No mistakes found!</p></div>`;
}

// Filler words
if (ah.totalFillerCount > 0) {
    html += `<div class="agent-result"><h4>🔊 Top Filler Words</h4><div class="filler-list">`;
    const allFillers = { ...ah.fillerSounds, ...ah.fillerWords };
    Object.entries(allFillers)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([word, count]) => {
        html += `<span class="filler-tag">"${word}" <span class="count">${count}x</span></span>`;
    });
    html += `</div></div>`;
}

// General Evaluation
if (generalEval) {
    html += `
    <div class="general-eval">
        <h3>🎤 General Evaluation</h3>
        <p>${generalEval.evaluationText}</p>
        <button class="play-btn" id="play-btn-${speakerName}">▶ Play</button>
        <button class="stop-btn" id="stop-btn-${speakerName}">⏹ Stop</button>
    </div>
    `;
}

content.innerHTML = html;
document.getElementById(`play-btn-${speakerName}`)
    .addEventListener('click', () => speakEval(speakerName));

document.getElementById(`stop-btn-${speakerName}`)
    .addEventListener('click', stopSpeaking);

// Store evaluation text for TTS
window[`eval_${speakerName}`] = generalEval ? generalEval.evaluationText : '';
}

function speakEval(speakerName) {
const text = window[`eval_${speakerName}`];
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

// Listen for evaluation results from backend
// This will be called when backend sends results back
window.addEventListener('message', (event) => {
if (event.data.action === 'evaluationComplete') {
    const { speakerName, data } = event.data;
    if (speakers[speakerName]) {
    speakers[speakerName].status = 'done';
    speakers[speakerName].report = data;
    updateSpeakerCard(speakerName);
    }
}
});
