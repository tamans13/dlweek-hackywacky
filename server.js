import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'app-data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function nowIso() {
  return new Date().toISOString();
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const seed = {
      profile: {
        university: '',
        yearOfStudy: '',
        courseOfStudy: '',
        modules: [],
      },
      modules: {},
      studySessions: [],
      tabEvents: [],
      quizAttempts: [],
      examPlans: {},
      onboardingPersona: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
  }
}

function loadData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  data.updatedAt = nowIso();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function staticDir() {
  return fs.existsSync(DIST_DIR) ? DIST_DIR : PUBLIC_DIR;
}

function daysBetween(isoA, isoB) {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.max(0, (b - a) / (1000 * 60 * 60 * 24));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function retentionDecay(topic, currentTimeIso) {
  const last = topic.lastInteractionAt || topic.createdAt || currentTimeIso;
  const days = daysBetween(last, currentTimeIso);
  const masteryFactor = (11 - (topic.mastery || 5)) / 10;
  const baseDecayPerDay = 0.04;
  return clamp(days * baseDecayPerDay * masteryFactor, 0, 2.5);
}

function learningGain(preScore, postScore) {
  const denom = Math.max(1, 100 - preScore);
  return (postScore - preScore) / denom;
}

function classifyUrl(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('youtube.com') || u.includes('netflix.com') || u.includes('tiktok.com') || u.includes('instagram.com')) return 'distraction';
  if (u.includes('chat.openai.com') || u.includes('claude.ai') || u.includes('gemini.google.com') || u.includes('copilot.microsoft.com')) return 'help';
  if (u.includes('blackboard') || u.includes('canvas') || u.includes('coursera') || u.includes('edx') || u.includes('khanacademy')) return 'learning';
  return 'neutral';
}

function moduleState(data, moduleName) {
  if (!data.modules[moduleName]) {
    data.modules[moduleName] = {
      topics: {},
      burnoutRisk: 0,
      focusEfficiency: 0,
      updatedAt: nowIso(),
    };
  }
  return data.modules[moduleName];
}

function topicState(mod, topicName) {
  if (!mod.topics[topicName]) {
    mod.topics[topicName] = {
      topicName,
      mastery: 5,
      createdAt: nowIso(),
      lastInteractionAt: nowIso(),
      lastQuizAt: null,
      nextReviewAt: nowIso(),
      history: [],
    };
  }
  return mod.topics[topicName];
}

function recomputeModuleScores(data, moduleName) {
  const mod = moduleState(data, moduleName);
  const now = nowIso();

  const moduleSessions = data.studySessions.filter((s) => s.moduleName === moduleName && s.endAt);
  const recentAttempts = data.quizAttempts.filter((q) => q.moduleName === moduleName).slice(-12);
  const tabEvents = data.tabEvents.filter((e) => e.moduleName === moduleName).slice(-500);

  let totalSessionMinutes = 0;
  for (const s of moduleSessions) {
    const minutes = (new Date(s.endAt).getTime() - new Date(s.startAt).getTime()) / 60000;
    if (minutes > 0) totalSessionMinutes += minutes;
  }

  const avgSession = moduleSessions.length ? totalSessionMinutes / moduleSessions.length : 0;
  const unstablePerformance = recentAttempts.length > 4
    ? stdDev(recentAttempts.map((x) => x.postScore)) / 25
    : 0;

  const accuracySlope = scoreSlope(recentAttempts.map((x) => x.postScore));
  const downtrendPenalty = accuracySlope < 0 ? Math.abs(accuracySlope) / 8 : 0;
  const overworkPenalty = avgSession > 90 ? (avgSession - 90) / 60 : 0;
  mod.burnoutRisk = clamp((overworkPenalty + unstablePerformance + downtrendPenalty) * 35, 0, 100);

  const distraction = tabEvents.filter((e) => e.eventType === 'distraction').length;
  const focused = tabEvents.filter((e) => e.eventType === 'learning').length;
  const help = tabEvents.filter((e) => e.eventType === 'help').length;

  const attempts = recentAttempts.length;
  const meanAccuracy = attempts ? recentAttempts.reduce((a, b) => a + b.postScore, 0) / attempts : 0;
  const focusPart = focused / Math.max(1, focused + distraction + help * 0.4);
  const accuracyPart = meanAccuracy / 100;
  mod.focusEfficiency = clamp((focusPart * 0.6 + accuracyPart * 0.4) * 100, 0, 100);

  for (const topic of Object.values(mod.topics)) {
    const decay = retentionDecay(topic, now);
    topic.estimatedMasteryNow = clamp(topic.mastery - decay, 1, 10);
    topic.nextReviewAt = new Date(new Date(topic.lastInteractionAt).getTime() + reviewDays(topic.mastery) * 86400000).toISOString();
  }

  mod.updatedAt = now;
}

function reviewDays(mastery) {
  if (mastery < 4) return 2;
  if (mastery < 6) return 4;
  if (mastery < 8) return 7;
  return 12;
}

function stdDev(arr) {
  if (!arr.length) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function scoreSlope(arr) {
  if (arr.length < 2) return 0;
  const first = arr.slice(0, Math.floor(arr.length / 2));
  const second = arr.slice(Math.floor(arr.length / 2));
  const a = first.reduce((x, y) => x + y, 0) / first.length;
  const b = second.reduce((x, y) => x + y, 0) / second.length;
  return b - a;
}

function readinessScore(moduleName, data) {
  const mod = moduleState(data, moduleName);
  const exam = data.examPlans[moduleName];
  if (!exam || !exam.examDate) return { score: 0, reason: 'Add exam date and topic coverage data to estimate readiness.' };

  const testedNames = Array.isArray(exam.topicsTested) ? exam.topicsTested : [];
  const topics = testedNames
    .map((name) => mod.topics[name])
    .filter(Boolean);
  if (!topics.length) return { score: 0, reason: 'No topics tested selected yet.' };

  const masteryMean = topics.reduce((a, t) => a + (t.estimatedMasteryNow || t.mastery), 0) / topics.length;
  const daysLeft = Math.max(0, daysBetween(nowIso(), exam.examDate));
  const coverageRatio = clamp((exam.topicsCovered || 0) / Math.max(1, exam.totalTopics || topics.length), 0, 1);

  const timePressure = daysLeft < 7 ? 0.65 : daysLeft < 14 ? 0.8 : 1;
  const score = clamp((masteryMean / 10) * 55 + coverageRatio * 35 + timePressure * 10, 0, 100);

  return {
    score: Math.round(score),
    reason: `Mastery ${masteryMean.toFixed(1)}/10, coverage ${(coverageRatio * 100).toFixed(0)}%, ${Math.ceil(daysLeft)} days to exam.`,
  };
}

function buildInsightsHeuristic(data, moduleName) {
  const allModules = Object.keys(data.modules);
  const targetModules = moduleName ? [moduleName] : allModules;
  const metrics = targetModules.map((name) => {
    const mod = moduleState(data, name);
    return {
      moduleName: name,
      burnoutRisk: mod.burnoutRisk || 0,
      focusEfficiency: mod.focusEfficiency || 0,
      readiness: readinessScore(name, data),
      topics: Object.values(mod.topics).map((topic) => ({ ...topic, moduleName: name })),
    };
  });

  const allTopics = metrics.flatMap((m) => m.topics);
  const weakest = allTopics
    .slice()
    .sort((a, b) => (a.estimatedMasteryNow || a.mastery) - (b.estimatedMasteryNow || b.mastery))
    .slice(0, 3)
    .map((x) => (moduleName ? x.topicName : `${x.moduleName}: ${x.topicName}`));
  const due = allTopics
    .filter((t) => new Date(t.nextReviewAt) <= new Date())
    .slice(0, 5)
    .map((t) => (moduleName ? t.topicName : `${t.moduleName}: ${t.topicName}`));

  const burnoutRisk = metrics.length
    ? Math.round(metrics.reduce((sum, item) => sum + item.burnoutRisk, 0) / metrics.length)
    : 0;
  const focusEfficiency = metrics.length
    ? Math.round(metrics.reduce((sum, item) => sum + item.focusEfficiency, 0) / metrics.length)
    : 0;
  const readiness = metrics.length
    ? {
        score: Math.round(metrics.reduce((sum, item) => sum + item.readiness.score, 0) / metrics.length),
        reason: moduleName
          ? metrics[0].readiness.reason
          : `Average readiness across ${metrics.length} modules.`,
      }
    : { score: 0, reason: 'No modules available yet.' };
  const label = moduleName || 'overall';

  return {
    moduleName: label,
    summary: `Prioritize weak topics first and move to spaced reviews. Burnout risk is ${burnoutRisk}%.`,
    actions: [
      `Spend your next 30 minutes on: ${weakest.join(', ') || 'set up topic tags first'}.`,
      due.length ? `Due for review now: ${due.join(', ')}.` : 'No overdue spaced-repetition reviews today.',
      burnoutRisk > 65 ? 'Take 10-minute breaks every 40 minutes and reduce quiz volume temporarily.' : 'Keep your current pace; add one mixed-difficulty quiz per day.',
      `Focus efficiency is ${focusEfficiency}%. Keep distraction events under 15% of tab events.`,
      `Exam readiness: ${readiness.score}/100. ${readiness.reason}`,
    ],
  };
}

const ONBOARDING_QUESTION_LABELS = {
  'mental-sharp': 'When do you feel most mentally sharp?',
  'focus-duration': 'How long can you focus deeply before mental fatigue?',
  'after-2hr': 'After a 2-hour study session, you usually feel',
  'study-method': 'When you study, you mostly',
  'performance-drop': 'When performance drops during a session, you',
  'phone-check': 'How often do you check your phone?',
  'study-hours-trend': 'In the past 2 weeks, study hours',
  'performance-trend': 'In the past 2 weeks, performance',
  guilt: 'You feel guilty when not studying',
  'mental-tired': 'You feel mentally tired before studying',
};

function normalizeOnboardingPayload(raw) {
  const welcome = raw && typeof raw.welcome === 'object' ? raw.welcome : {};
  const prefs = raw && typeof raw.prefs === 'object' ? raw.prefs : {};
  const answers = prefs.answers && typeof prefs.answers === 'object' ? prefs.answers : {};
  const normalizedAnswers = Object.fromEntries(
    Object.entries(answers).map(([k, v]) => [String(k), String(v)]),
  );
  return {
    profile: {
      university: String(welcome.university || ''),
      course: String(welcome.course || ''),
      year: String(welcome.year || ''),
    },
    preferences: {
      studyLimit: String(prefs.studyLimit || ''),
      sleep: String(prefs.sleep || ''),
      answers: normalizedAnswers,
      answersHumanized: Object.entries(normalizedAnswers).map(([key, value]) => ({
        key,
        question: ONBOARDING_QUESTION_LABELS[key] || key,
        answer: value,
      })),
    },
  };
}

function buildOnboardingPersonaHeuristic(payload) {
  const answers = payload.preferences.answers || {};
  const method = answers['study-method'] || 'mix';
  const peak = answers['mental-sharp'] || '2-6pm';
  const focus = answers['focus-duration'] || '20-40';
  const phoneCheck = answers['phone-check'] || 'occasionally';
  const performanceTrend = answers['performance-trend'] || 'stable';

  const focusBlockMap = {
    '<20': '15-20 minute',
    '20-40': '25-35 minute',
    '40-60': '40-50 minute',
    '60-90': '50-70 minute',
    '90+': '75-90 minute',
  };
  const focusBlock = focusBlockMap[focus] || '30-45 minute';

  let learningStyle = 'Balanced Adaptive Learner';
  if (method === 'practice' || method === 'teach') learningStyle = 'Active Recall Performer';
  if (method === 'reread') learningStyle = 'Structured Review Learner';
  if (method === 'summarise') learningStyle = 'Synthesis Learner';

  const rationale = `Your responses indicate best results with ${focusBlock} focused sessions and high-value work during ${peak}.`;

  const techniques = [
    {
      title: 'Time-box around your natural focus window',
      description: `Place the hardest topics in your peak period (${peak}) and use easier reviews outside that window.`,
    },
    {
      title: `Use ${focusBlock} study blocks`,
      description: 'Run a timer per block and take 5-10 minute breaks to prevent performance drop.',
    },
    {
      title: 'Use active recall before rereading',
      description: 'Attempt 3-5 practice questions first, then review notes only for errors.',
    },
    {
      title: 'End each session with a mini-check',
      description: 'Write a 3-point summary and one “still unclear” item for the next session.',
    },
  ];

  if (phoneCheck === '20-30min' || phoneCheck === 'frequently') {
    techniques.push({
      title: 'Apply distraction guardrails',
      description: 'Keep phone away and batch non-study checks into break windows only.',
    });
  }

  if (performanceTrend === 'slight-decline' || performanceTrend === 'dropped') {
    techniques.push({
      title: 'Reduce load and rebuild consistency',
      description: 'Use shorter blocks for 1 week and prioritize weakest topics before volume.',
    });
  }

  return {
    learningStyle,
    rationale,
    studyTechniques: techniques.slice(0, 5),
  };
}

function readResponseText(result) {
  return result.output_text ||
    (result.output || [])
      .flatMap((o) => o.content || [])
      .map((c) => c.text || '')
      .join('\n');
}

async function buildOnboardingPersonaWithOpenAI(payload) {
  if (!OPENAI_API_KEY) return buildOnboardingPersonaHeuristic(payload);

  try {
    const prompt = [
      'You are an educational coach. Return strict JSON only.',
      'Required JSON shape: { "learningStyle": string, "rationale": string, "studyTechniques": [{ "title": string, "description": string }] }',
      'Return exactly 4 to 5 studyTechniques.',
      'Techniques must be specific, actionable, and directly grounded in the questionnaire.',
      'Avoid generic advice.',
      JSON.stringify(payload),
    ].join('\n');

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: prompt,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      return buildOnboardingPersonaHeuristic(payload);
    }

    const result = await response.json();
    const text = readResponseText(result);
    const parsed = JSON.parse(text);
    if (!parsed.learningStyle || !parsed.rationale || !Array.isArray(parsed.studyTechniques)) {
      return buildOnboardingPersonaHeuristic(payload);
    }

    const normalizedTechniques = parsed.studyTechniques
      .filter((x) => x && typeof x === 'object')
      .slice(0, 5)
      .map((x) => ({
        title: String(x.title || '').trim(),
        description: String(x.description || '').trim(),
      }))
      .filter((x) => x.title && x.description);

    if (!normalizedTechniques.length) return buildOnboardingPersonaHeuristic(payload);

    return {
      learningStyle: String(parsed.learningStyle),
      rationale: String(parsed.rationale),
      studyTechniques: normalizedTechniques,
    };
  } catch {
    return buildOnboardingPersonaHeuristic(payload);
  }
}

async function buildInsightsWithOpenAI(data, moduleName) {
  if (!OPENAI_API_KEY) return buildInsightsHeuristic(data, moduleName);
  const allModuleNames = Object.keys(data.modules);
  const targetModules = moduleName ? [moduleName] : allModuleNames;
  for (const name of targetModules) recomputeModuleScores(data, name);

  const modulePayload = targetModules.map((name) => {
    const mod = moduleState(data, name);
    return {
      moduleName: name,
      burnoutRisk: mod.burnoutRisk,
      focusEfficiency: mod.focusEfficiency,
      topics: Object.values(mod.topics).map((t) => ({
        topicName: t.topicName,
        mastery: t.mastery,
        estimatedMasteryNow: t.estimatedMasteryNow,
        nextReviewAt: t.nextReviewAt,
        recentHistory: t.history.slice(-4),
      })),
      readiness: readinessScore(name, data),
    };
  });

  const allTopics = modulePayload.flatMap((m) =>
    m.topics.map((topic) => ({
      moduleName: m.moduleName,
      topicName: topic.topicName,
      estimatedMasteryNow: topic.estimatedMasteryNow ?? topic.mastery,
      mastery: topic.mastery,
      nextReviewAt: topic.nextReviewAt,
    })),
  );

  const atRiskTopics = allTopics
    .slice()
    .sort((a, b) => (a.estimatedMasteryNow || a.mastery) - (b.estimatedMasteryNow || b.mastery))
    .slice(0, 6);

  const recentQuizAttempts = moduleName
    ? data.quizAttempts.filter((x) => x.moduleName === moduleName).slice(-10)
    : data.quizAttempts.slice(-20);
  const recentTabEvents = moduleName
    ? data.tabEvents.filter((x) => x.moduleName === moduleName).slice(-40)
    : data.tabEvents.slice(-80);

  const meanBurnoutRisk = modulePayload.length
    ? Math.round(modulePayload.reduce((sum, item) => sum + (item.burnoutRisk || 0), 0) / modulePayload.length)
    : 0;
  const meanFocusEfficiency = modulePayload.length
    ? Math.round(modulePayload.reduce((sum, item) => sum + (item.focusEfficiency || 0), 0) / modulePayload.length)
    : 0;

  const payload = {
    scope: moduleName || 'overall',
    moduleCount: targetModules.length,
    meanBurnoutRisk,
    meanFocusEfficiency,
    modules: modulePayload,
    recentQuizAttempts,
    recentTabEvents,
    atRiskTopics,
  };

  const prompt = [
    'You are an academic coach producing strict JSON only.',
    'Return an object with keys: summary (string), actions (array of 5 concise strings).',
    'Actions must be personalized, include time-bound tasks, and explain weak-vs-careless mistake patterns.',
    'Avoid generic advice.',
    JSON.stringify(payload),
  ].join('\n');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: prompt,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${text}`);
  }

  const result = await response.json();
  const text = readResponseText(result);

  try {
    const parsed = JSON.parse(text);
    if (!parsed.summary || !Array.isArray(parsed.actions)) {
      return buildInsightsHeuristic(data, moduleName);
    }
    return {
      moduleName: moduleName || 'overall',
      summary: String(parsed.summary),
      actions: parsed.actions.slice(0, 5).map((x) => String(x)),
    };
  } catch {
    return buildInsightsHeuristic(data, moduleName);
  }
}

function send(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function apiHandler(req, res, pathname) {
  const data = loadData();

  if (req.method === 'GET' && pathname === '/api/state') {
    for (const moduleName of Object.keys(data.modules)) recomputeModuleScores(data, moduleName);
    saveData(data);
    return send(res, 200, { ...data, aiEnabled: Boolean(OPENAI_API_KEY) });
  }

  if (req.method === 'POST' && pathname === '/api/onboarding/persona') {
    const body = await parseBody(req);
    const payload = normalizeOnboardingPayload(body);
    const analysis = await buildOnboardingPersonaWithOpenAI(payload);
    data.onboardingPersona = {
      ...analysis,
      generatedAt: nowIso(),
    };
    saveData(data);
    return send(res, 200, { ok: true, analysis, aiEnabled: Boolean(OPENAI_API_KEY) });
  }

  if (req.method === 'POST' && pathname === '/api/profile') {
    const body = await parseBody(req);
    const normalizedModules = Array.isArray(body.modules)
      ? Array.from(
          new Set(
            body.modules
              .map((x) => String(x || '').trim())
              .filter(Boolean),
          ),
        )
      : [];

    data.profile = {
      university: body.university || '',
      yearOfStudy: body.yearOfStudy || '',
      courseOfStudy: body.courseOfStudy || '',
      modules: normalizedModules,
    };

    // Keep backend data consistent with current profile module list.
    const allowed = new Set(normalizedModules);
    data.modules = Object.fromEntries(
      Object.entries(data.modules).filter(([moduleName]) => allowed.has(moduleName)),
    );
    data.examPlans = Object.fromEntries(
      Object.entries(data.examPlans).filter(([moduleName]) => allowed.has(moduleName)),
    );
    data.studySessions = data.studySessions.filter((x) => allowed.has(x.moduleName));
    data.tabEvents = data.tabEvents.filter((x) => allowed.has(x.moduleName));
    data.quizAttempts = data.quizAttempts.filter((x) => allowed.has(x.moduleName));

    for (const moduleName of normalizedModules) moduleState(data, moduleName);
    saveData(data);
    return send(res, 200, { ok: true, profile: data.profile });
  }

  if (req.method === 'POST' && pathname === '/api/study-session/start') {
    const body = await parseBody(req);
    if (!body.moduleName) return send(res, 400, { error: 'moduleName is required' });

    const session = {
      id: `sess_${Date.now()}`,
      moduleName: body.moduleName,
      topicName: body.topicName || 'General',
      startAt: nowIso(),
      endAt: null,
    };
    data.studySessions.push(session);
    moduleState(data, body.moduleName);
    saveData(data);
    return send(res, 200, { ok: true, session });
  }

  if (req.method === 'POST' && pathname === '/api/study-session/stop') {
    const body = await parseBody(req);
    const sess = data.studySessions.find((x) => x.id === body.sessionId && !x.endAt);
    if (!sess) return send(res, 404, { error: 'Active session not found' });
    sess.endAt = nowIso();
    recomputeModuleScores(data, sess.moduleName);
    saveData(data);
    return send(res, 200, { ok: true, session: sess });
  }

  if (req.method === 'POST' && pathname === '/api/tab-event') {
    const body = await parseBody(req);
    if (!body.moduleName || !body.url) return send(res, 400, { error: 'moduleName and url are required' });

    const eventType = body.eventType || classifyUrl(body.url);
    const event = {
      id: `evt_${Date.now()}`,
      moduleName: body.moduleName,
      topicName: body.topicName || 'General',
      url: body.url,
      eventType,
      userLabel: body.userLabel || null,
      createdAt: nowIso(),
    };
    data.tabEvents.push(event);
    recomputeModuleScores(data, body.moduleName);
    saveData(data);
    return send(res, 200, { ok: true, event });
  }

  if (req.method === 'POST' && pathname === '/api/topic/add') {
    const body = await parseBody(req);
    if (!body.moduleName || !body.topicName) return send(res, 400, { error: 'moduleName and topicName are required' });
    const mod = moduleState(data, body.moduleName);
    const topic = topicState(mod, body.topicName);
    topic.lastInteractionAt = nowIso();
    recomputeModuleScores(data, body.moduleName);
    saveData(data);
    return send(res, 200, { ok: true, topic });
  }

  if (req.method === 'POST' && pathname === '/api/topic/delete') {
    const body = await parseBody(req);
    if (!body.moduleName || !body.topicName) return send(res, 400, { error: 'moduleName and topicName are required' });
    const mod = data.modules[body.moduleName];
    if (!mod || !mod.topics || !mod.topics[body.topicName]) return send(res, 404, { error: 'Topic not found' });

    delete mod.topics[body.topicName];
    data.quizAttempts = data.quizAttempts.filter((x) => !(x.moduleName === body.moduleName && x.topicName === body.topicName));
    data.studySessions = data.studySessions.filter((x) => !(x.moduleName === body.moduleName && x.topicName === body.topicName));
    data.tabEvents = data.tabEvents.filter((x) => !(x.moduleName === body.moduleName && x.topicName === body.topicName));

    const plan = data.examPlans[body.moduleName];
    if (plan && Array.isArray(plan.topicsTested)) {
      plan.topicsTested = plan.topicsTested.filter((name) => name !== body.topicName);
      plan.totalTopics = plan.topicsTested.length;
      plan.topicsCovered = clamp(Number(plan.topicsCovered || 0), 0, plan.totalTopics);
      plan.updatedAt = nowIso();
    }

    recomputeModuleScores(data, body.moduleName);
    saveData(data);
    return send(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/quiz/submit') {
    const body = await parseBody(req);
    const { moduleName, topicName, preScore, postScore, confidence, aiUsed } = body;
    if (!moduleName || !topicName) return send(res, 400, { error: 'moduleName and topicName are required' });

    const mod = moduleState(data, moduleName);
    const topic = topicState(mod, topicName);
    const now = nowIso();
    const decay = retentionDecay(topic, now);
    const gain = learningGain(Number(preScore || 0), Number(postScore || 0));
    const confidenceAdj = Number(confidence || 3) >= 4 ? 0.2 : 0;
    const aiAdj = aiUsed ? -0.1 : 0.1;

    const oldMastery = topic.mastery;
    topic.mastery = clamp(oldMastery + gain * 2.5 + confidenceAdj + aiAdj - decay, 1, 10);
    topic.lastInteractionAt = now;
    topic.lastQuizAt = now;
    topic.history.push({
      at: now,
      oldMastery,
      newMastery: topic.mastery,
      preScore,
      postScore,
      confidence,
      aiUsed,
      decay,
      gain,
    });
    topic.nextReviewAt = new Date(new Date(now).getTime() + reviewDays(topic.mastery) * 86400000).toISOString();

    const attempt = {
      id: `quiz_${Date.now()}`,
      moduleName,
      topicName,
      preScore: Number(preScore || 0),
      postScore: Number(postScore || 0),
      confidence: Number(confidence || 3),
      aiUsed: Boolean(aiUsed),
      submittedAt: now,
      difficultySuggestion: oldMastery < 4 ? 'easy' : oldMastery < 7 ? 'medium' : 'hard',
      nextQuizType: topic.mastery < 5 ? 'targeted-remediation' : 'spaced-repetition',
    };

    data.quizAttempts.push(attempt);
    recomputeModuleScores(data, moduleName);
    saveData(data);

    return send(res, 200, {
      ok: true,
      attempt,
      masteryUpdate: {
        oldMastery,
        newMastery: topic.mastery,
        gain,
        decay,
      },
    });
  }

  if (req.method === 'GET' && pathname === '/api/quizzes/due') {
    const due = [];
    const now = new Date();
    for (const [moduleName, mod] of Object.entries(data.modules)) {
      for (const topic of Object.values(mod.topics)) {
        if (new Date(topic.nextReviewAt) <= now) {
          due.push({ moduleName, topicName: topic.topicName, type: 'spaced-repetition' });
        }
      }
    }
    return send(res, 200, { due });
  }

  if (req.method === 'POST' && pathname === '/api/exam-plan') {
    const body = await parseBody(req);
    if (!body.moduleName || !body.examDate) return send(res, 400, { error: 'moduleName and examDate required' });
    const topicsTested = Array.isArray(body.topicsTested)
      ? Array.from(new Set(body.topicsTested.map((x) => String(x || '').trim()).filter(Boolean)))
      : [];
    data.examPlans[body.moduleName] = {
      examDate: body.examDate,
      totalTopics: topicsTested.length || Number(body.totalTopics || 0),
      topicsCovered: Number(body.topicsCovered || 0),
      topicsTested,
      updatedAt: nowIso(),
    };
    data.examPlans[body.moduleName].topicsCovered = clamp(
      data.examPlans[body.moduleName].topicsCovered,
      0,
      Math.max(0, data.examPlans[body.moduleName].totalTopics),
    );
    saveData(data);
    return send(res, 200, { ok: true, readiness: readinessScore(body.moduleName, data) });
  }

  if (req.method === 'GET' && pathname === '/api/readiness') {
    for (const moduleName of Object.keys(data.modules)) recomputeModuleScores(data, moduleName);
    saveData(data);
    const readiness = Object.keys(data.modules).map((moduleName) => ({
      moduleName,
      ...readinessScore(moduleName, data),
      examPlan: data.examPlans[moduleName] || null,
    }));
    return send(res, 200, { readiness });
  }

  if (req.method === 'POST' && pathname === '/api/insights/generate') {
    const body = await parseBody(req);
    if (body.moduleName) recomputeModuleScores(data, body.moduleName);
    else for (const moduleName of Object.keys(data.modules)) recomputeModuleScores(data, moduleName);
    const insights = await buildInsightsWithOpenAI(data, body.moduleName || '');
    return send(res, 200, { ok: true, insights, aiEnabled: Boolean(OPENAI_API_KEY) });
  }

  return send(res, 404, { error: 'Not found' });
}

function staticHandler(req, res, pathname) {
  const root = staticDir();
  const filePath = pathname === '/' ? path.join(root, 'index.html') : path.join(root, pathname);
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(normalized, (err, content) => {
    if (err) {
      if (!path.extname(pathname)) {
        const indexPath = path.join(root, 'index.html');
        fs.readFile(indexPath, (indexErr, indexContent) => {
          if (indexErr) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(indexContent);
        });
        return;
      }
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(normalized);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsed.pathname;

    if (pathname.startsWith('/api/')) {
      return await apiHandler(req, res, pathname);
    }

    return staticHandler(req, res, pathname);
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message || 'Internal server error' });
  }
});

server.listen(PORT, HOST, () => {
  ensureDataFile();
  console.log(`Server running at http://${HOST}:${PORT}`);
});
