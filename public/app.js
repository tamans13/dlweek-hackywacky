let activeSessionId = null;
let debugVisible = false;

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function formToObject(form) {
  const fd = new FormData(form);
  return Object.fromEntries(fd.entries());
}

function modulesFromText(t) {
  return t
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function refreshState() {
  const data = await api('/api/state');
  document.getElementById('stateView').textContent = JSON.stringify(data, null, 2);
  const aiEnabled = !!data.aiEnabled;
  const badge = document.getElementById('aiBadge');
  if (aiEnabled) {
    badge.textContent = 'AI: enabled (OpenAI key loaded)';
    badge.className = 'badge ok';
  } else {
    badge.textContent = 'AI: fallback mode (set OPENAI_API_KEY)';
    badge.className = 'badge off';
  }
}

function askYouTubeIntent(url) {
  const lower = (url || '').toLowerCase();
  if (!lower.includes('youtube.com') && !lower.includes('instagram.com') && !lower.includes('tiktok.com')) {
    return null;
  }
  const intent = window.prompt('Is this tab educational or entertainment? Type: educational or entertainment');
  if (!intent) return null;
  if (intent.toLowerCase().startsWith('edu')) return 'learning';
  return 'distraction';
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = formToObject(e.target);
  await api('/api/profile', {
    method: 'POST',
    body: JSON.stringify({
      university: raw.university,
      yearOfStudy: raw.yearOfStudy,
      courseOfStudy: raw.courseOfStudy,
      modules: modulesFromText(raw.modules),
    }),
  });
  await refreshState();
});

document.getElementById('startSession').addEventListener('click', async () => {
  const form = document.getElementById('sessionForm');
  const raw = formToObject(form);
  const res = await api('/api/study-session/start', {
    method: 'POST',
    body: JSON.stringify(raw),
  });
  activeSessionId = res.session.id;
  alert(`Session started: ${activeSessionId}`);
  await refreshState();
});

document.getElementById('stopSession').addEventListener('click', async () => {
  if (!activeSessionId) {
    alert('No active session ID found. Start a session first.');
    return;
  }
  await api('/api/study-session/stop', {
    method: 'POST',
    body: JSON.stringify({ sessionId: activeSessionId }),
  });
  alert('Study session stopped.');
  activeSessionId = null;
  await refreshState();
});

document.getElementById('eventForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = formToObject(e.target);
  const forcedType = askYouTubeIntent(raw.url);

  await api('/api/tab-event', {
    method: 'POST',
    body: JSON.stringify({
      ...raw,
      eventType: forcedType || undefined,
    }),
  });
  await refreshState();
});

document.getElementById('quizForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = formToObject(e.target);
  const payload = {
    moduleName: raw.moduleName,
    topicName: raw.topicName,
    preScore: Number(raw.preScore),
    postScore: Number(raw.postScore),
    confidence: Number(raw.confidence),
    aiUsed: Boolean(e.target.aiUsed.checked),
  };

  const res = await api('/api/quiz/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  document.getElementById('quizResult').textContent =
    `Mastery ${res.masteryUpdate.oldMastery.toFixed(2)} -> ${res.masteryUpdate.newMastery.toFixed(2)} | Suggested next quiz: ${res.attempt.nextQuizType} (${res.attempt.difficultySuggestion})`;

  await refreshState();
});

document.getElementById('examForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = formToObject(e.target);
  const res = await api('/api/exam-plan', {
    method: 'POST',
    body: JSON.stringify({
      moduleName: raw.moduleName,
      examDate: raw.examDate,
      totalTopics: Number(raw.totalTopics),
      topicsCovered: Number(raw.topicsCovered),
    }),
  });

  document.getElementById('readinessResult').textContent =
    `Readiness ${res.readiness.score}/100: ${res.readiness.reason}`;
  await refreshState();
});

document.getElementById('insightForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = formToObject(e.target);
  const out = await api('/api/insights/generate', {
    method: 'POST',
    body: JSON.stringify(raw),
  });

  const root = document.getElementById('insights');
  root.innerHTML = '';

  const summary = document.createElement('p');
  summary.textContent = out.insights.summary;
  root.appendChild(summary);

  const ul = document.createElement('ul');
  out.insights.actions.forEach((action) => {
    const li = document.createElement('li');
    li.textContent = action;
    ul.appendChild(li);
  });
  root.appendChild(ul);

  await refreshState();
});

document.getElementById('refresh').addEventListener('click', refreshState);
document.getElementById('toggleState').addEventListener('click', () => {
  debugVisible = !debugVisible;
  const stateView = document.getElementById('stateView');
  const btn = document.getElementById('toggleState');
  stateView.hidden = !debugVisible;
  btn.textContent = debugVisible ? 'Hide Debug JSON' : 'Show Debug JSON';
});

refreshState().catch((err) => {
  document.getElementById('stateView').textContent = `Failed loading state: ${err.message}`;
});
