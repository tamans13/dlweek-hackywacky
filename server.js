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

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'study-files';
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'app-data.json');
const LOCAL_UPLOAD_DIR = path.join(DATA_DIR, 'topic-files');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DIST_DIR = path.join(__dirname, 'dist');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
};

const TEXT_FILE_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.tsv',
  '.json',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.go',
  '.rs',
  '.rb',
  '.php',
  '.html',
  '.css',
  '.xml',
  '.yaml',
  '.yml',
]);

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;}
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const seed = {
      profile: {
        fullName: '',
        email: '',
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

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function daysBetween(isoA, isoB) {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.max(0, (b - a) / (1000 * 60 * 60 * 24));
}

function sanitizeSegment(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function safeFileName(name) {
  const trimmed = String(name || 'file').trim() || 'file';
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file';
}

function staticDir() {
  return fs.existsSync(DIST_DIR) ? DIST_DIR : PUBLIC_DIR;
}

function emptyState() {
  return {
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
    topicDocuments: [],
    generatedQuizzes: [],
    generatedQuizAttempts: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function normalizeData(data) {
  const base = data && typeof data === 'object' ? data : {};
  const state = {
    ...emptyState(),
    ...base,
    profile: {
      ...emptyState().profile,
      ...(base.profile || {}),
      modules: Array.isArray(base?.profile?.modules)
        ? Array.from(
            new Set(
              base.profile.modules
                .map((x) => String(x || '').trim())
                .filter(Boolean),
            ),
          )
        : [],
    },
    modules: base.modules && typeof base.modules === 'object' ? base.modules : {},
    studySessions: Array.isArray(base.studySessions) ? base.studySessions : [],
    tabEvents: Array.isArray(base.tabEvents) ? base.tabEvents : [],
    quizAttempts: Array.isArray(base.quizAttempts) ? base.quizAttempts : [],
    examPlans: base.examPlans && typeof base.examPlans === 'object' ? base.examPlans : {},
    topicDocuments: Array.isArray(base.topicDocuments) ? base.topicDocuments : [],
    generatedQuizzes: Array.isArray(base.generatedQuizzes) ? base.generatedQuizzes : [],
    generatedQuizAttempts: Array.isArray(base.generatedQuizAttempts) ? base.generatedQuizAttempts : [],
  };

  for (const moduleName of state.profile.modules) {
    moduleState(state, moduleName);
  }

  return state;
}

function ensureLocalDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(emptyState(), null, 2));
  }
}

function loadLocalData() {
  ensureLocalDataFile();
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  return normalizeData(raw);
}

function saveLocalData(data) {
  ensureLocalDataFile();
  const next = normalizeData(data);
  next.updatedAt = nowIso();
  fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2));
}

function supabaseBase(pathname) {
  return `${SUPABASE_URL}${pathname}`;
}

async function supabaseRequest(pathname, options = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    useServiceRole = true,
    bearerToken = '',
    rawBody = false,
  } = options;

  if (!SUPABASE_ENABLED) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.');
  }

  const key = useServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
  const mergedHeaders = {
    apikey: key,
    Authorization: bearerToken ? `Bearer ${bearerToken}` : `Bearer ${key}`,
    ...headers,
  };

  const init = {
    method,
    headers: mergedHeaders,
  };

  if (body !== undefined) {
    if (rawBody) {
      init.body = body;
    } else {
      if (!init.headers['Content-Type'] && !init.headers['content-type']) {
        init.headers['Content-Type'] = 'application/json';
      }
      init.body = JSON.stringify(body);
    }
  }

  return fetch(supabaseBase(pathname), init);
}

function supabaseErrorText(status, text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return `Supabase request failed (${status})`;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed.error_description || parsed.msg || parsed.error || trimmed;
  } catch {
    return trimmed;
  }
}

async function loadSupabaseState(userId) {
  const params = new URLSearchParams({
    select: 'state',
    user_id: `eq.${userId}`,
    limit: '1',
  });

  const getRes = await supabaseRequest(`/rest/v1/user_app_state?${params.toString()}`, {
    useServiceRole: true,
  });

  if (!getRes.ok) {
    const text = await getRes.text();
    throw new Error(supabaseErrorText(getRes.status, text));
  }

  const rows = await getRes.json();
  if (Array.isArray(rows) && rows.length && rows[0].state) {
    return normalizeData(rows[0].state);
  }

  const seed = normalizeData(emptyState());
  const createRes = await supabaseRequest('/rest/v1/user_app_state?on_conflict=user_id', {
    method: 'POST',
    useServiceRole: true,
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: [
      {
        user_id: userId,
        state: seed,
        updated_at: nowIso(),
      },
    ],
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(supabaseErrorText(createRes.status, text));
  }

  return seed;
}

async function saveSupabaseState(userId, data) {
  const next = normalizeData(data);
  next.updatedAt = nowIso();

  const res = await supabaseRequest('/rest/v1/user_app_state?on_conflict=user_id', {
    method: 'POST',
    useServiceRole: true,
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: [
      {
        user_id: userId,
        state: next,
        updated_at: nowIso(),
      },
    ],
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(supabaseErrorText(res.status, text));
  }
}

async function loadDataForUser(userId) {
  if (!SUPABASE_ENABLED) return loadLocalData();
  return loadSupabaseState(userId);
}

async function saveDataForUser(userId, data) {
  if (!SUPABASE_ENABLED) {
    saveLocalData(data);
    return;
  }
  await saveSupabaseState(userId, data);
}

function authTokenFromRequest(req) {
  const header = String(req.headers.authorization || '');
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
}

async function resolveSupabaseUserFromToken(accessToken) {
  const res = await supabaseRequest('/auth/v1/user', {
    method: 'GET',
    useServiceRole: false,
    bearerToken: accessToken,
  });

  if (!res.ok) return null;
  const user = await res.json();
  if (!user || !user.id) return null;

  return {
    id: String(user.id),
    email: user.email ? String(user.email) : '',
  };
}

async function resolveRequestUser(req) {
  if (!SUPABASE_ENABLED) {
    return {
      id: 'local-user',
      email: 'local@brainosaur.dev',
    };
  }

  const accessToken = authTokenFromRequest(req);
  if (!accessToken) return null;
  return resolveSupabaseUserFromToken(accessToken);
}

function normalizeSupabaseAuthPayload(raw, fallbackEmail = '') {
  if (!raw || typeof raw !== 'object') return null;

  const userRaw = raw.user && typeof raw.user === 'object' ? raw.user : null;
  if (!userRaw || !userRaw.id) return null;

  const sessionRaw = raw.session && typeof raw.session === 'object' ? raw.session : raw;
  const accessToken = String(sessionRaw.access_token || '');
  const refreshToken = String(sessionRaw.refresh_token || '');
  const tokenType = String(sessionRaw.token_type || 'bearer');
  const expiresIn = Number(sessionRaw.expires_in || 0);

  if (!accessToken || !refreshToken || !expiresIn) return null;

  return {
    user: {
      id: String(userRaw.id),
      email: String(userRaw.email || fallbackEmail),
    },
    session: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      token_type: tokenType,
    },
  };
}

async function signInWithSupabase(email, password) {
  if (!SUPABASE_ENABLED) {
    return {
      user: { id: 'local-user', email },
      session: {
        access_token: 'local-dev-token',
        refresh_token: 'local-dev-refresh',
        expires_in: 60 * 60 * 24 * 30,
        token_type: 'bearer',
      },
    };
  }

  const signinRes = await supabaseRequest('/auth/v1/token?grant_type=password', {
    method: 'POST',
    useServiceRole: false,
    body: { email, password },
  });

  if (!signinRes.ok) {
    const text = await signinRes.text();
    throw new Error(`Sign-in failed: ${supabaseErrorText(signinRes.status, text)}`);
  }

  const signinData = await signinRes.json();
  const normalizedSignin = normalizeSupabaseAuthPayload(signinData, email);
  if (normalizedSignin) return normalizedSignin;

  throw new Error('Sign-in response did not include a valid session. Check Supabase Auth settings.');
}

async function signUpWithSupabase(email, password) {
  if (!SUPABASE_ENABLED) {
    return {
      user: { id: 'local-user', email },
      session: {
        access_token: 'local-dev-token',
        refresh_token: 'local-dev-refresh',
        expires_in: 60 * 60 * 24 * 30,
        token_type: 'bearer',
      },
    };
  }

  const signupRes = await supabaseRequest('/auth/v1/signup', {
    method: 'POST',
    useServiceRole: false,
    body: { email, password },
  });

  if (!signupRes.ok) {
    const text = await signupRes.text();
    throw new Error(`Sign-up failed: ${supabaseErrorText(signupRes.status, text)}`);
  }

  const signupData = await signupRes.json();
  const normalizedSignup = normalizeSupabaseAuthPayload(signupData, email);
  if (normalizedSignup) return normalizedSignup;

  if (signupData && signupData.user && signupData.user.id) {
    throw new Error('Account created, but email confirmation is required before first login. Check your email, confirm the account, then sign in again.');
  }

  throw new Error('Sign-up succeeded but no usable session was returned by Supabase.');
}

function learningGain(preScore, postScore) {
  const denom = Math.max(1, 100 - preScore);
  return clamp((postScore - preScore) / denom, -1, 1);
}

function masteryToPercent(mastery) {
  return clamp(Number(mastery || 0) * 10, 0, 100);
}

function percentToMastery(percent) {
  return clamp(Number(percent || 0) / 10, 1, 10);
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
      lastDecayAppliedAt: nowIso(),
      nextReviewAt: nowIso(),
      history: [],
      documents: [],
    };
  }
  if (!Array.isArray(mod.topics[topicName].documents)) mod.topics[topicName].documents = [];
  if (!mod.topics[topicName].lastDecayAppliedAt) {
    mod.topics[topicName].lastDecayAppliedAt = mod.topics[topicName].lastInteractionAt || nowIso();
  }
  return mod.topics[topicName];
}

function aiRetentionDecayRatePercent(topic, moduleName, data, currentTimeIso) {
  const last = topic.lastInteractionAt || topic.createdAt || currentTimeIso;
  const daysIdle = daysBetween(last, currentTimeIso);
  const masteryPct = masteryToPercent(topic.mastery || 5);

  const moduleEvents = data.tabEvents.filter((e) => e.moduleName === moduleName).slice(-300);
  const distraction = moduleEvents.filter((e) => e.eventType === 'distraction').length;
  const focused = moduleEvents.filter((e) => e.eventType === 'learning').length;
  const help = moduleEvents.filter((e) => e.eventType === 'help').length;
  const distractionRatio = distraction / Math.max(1, focused + distraction + help);

  const topicAttempts = data.quizAttempts
    .filter((q) => q.moduleName === moduleName && q.topicName === topic.topicName)
    .slice(-8);
  const meanAccuracy = topicAttempts.length
    ? topicAttempts.reduce((sum, item) => sum + Number(item.postScore || 0), 0) / topicAttempts.length
    : masteryPct;
  const consistency = topicAttempts.length > 1
    ? 1 - clamp(stdDev(topicAttempts.map((x) => Number(x.postScore || 0))) / 40, 0, 0.6)
    : 0.7;

  const moduleFocusEfficiency = clamp(Number(moduleState(data, moduleName).focusEfficiency || 0) / 100, 0, 1);
  const memoryStrengthDays = clamp(
    1.5
      + masteryPct / 14
      + meanAccuracy / 35
      + consistency * 2
      + moduleFocusEfficiency * 2
      - distractionRatio * 4
      - Math.min(daysIdle / 10, 2),
    1,
    18,
  );

  // Ebbinghaus-style forgetting curve, converted to percentage points/day.
  const retentionAfterOneDay = Math.exp(-1 / memoryStrengthDays);
  const baseDecayPerDayPct = (1 - retentionAfterOneDay) * 100 * 0.22;
  const inactivityAmplifier = 1 + clamp(daysIdle / 12, 0, 1.2);
  return clamp(baseDecayPerDayPct * inactivityAmplifier, 0.3, 12);
}

function retentionDecay(topic, moduleName, data, currentTimeIso, daysOverride) {
  const anchor = topic.lastDecayAppliedAt || topic.lastInteractionAt || topic.createdAt || currentTimeIso;
  const days = Number.isFinite(daysOverride) ? Number(daysOverride) : daysBetween(anchor, currentTimeIso);
  const dailyPct = aiRetentionDecayRatePercent(topic, moduleName, data, currentTimeIso);
  return (dailyPct * Math.max(0, days)) / 10;
}

function applyDailyMasteryDecay(topic, moduleName, data, currentTimeIso) {
  const anchor = topic.lastDecayAppliedAt || topic.lastInteractionAt || topic.createdAt || currentTimeIso;
  const fullDays = Math.floor(daysBetween(anchor, currentTimeIso));
  if (fullDays <= 0) return { daysApplied: 0, decayPct: 0 };

  const decayPoints = retentionDecay(topic, moduleName, data, currentTimeIso, fullDays);
  const oldPct = masteryToPercent(topic.mastery);
  const decayPct = decayPoints * 10;
  const newPct = clamp(oldPct - decayPct, 0, 100);
  topic.mastery = percentToMastery(newPct);
  topic.lastDecayAppliedAt = new Date(new Date(anchor).getTime() + fullDays * 86400000).toISOString();
  return { daysApplied: fullDays, decayPct };
}

function buildAdaptiveDifficultyPlan(currentMasteryPct, preScore, decayRatePct) {
  const current = clamp(Number(currentMasteryPct || 0), 0, 100);
  const baselinePre = clamp(Number(preScore || 0), 0, 100);
  const targetMasteryPct = clamp(current < 80 ? current + 20 : current + 10, 0, 100);
  const requiredGainPct = Math.max(0, targetMasteryPct - current + clamp(Number(decayRatePct || 0), 0, 20));
  const requiredGainRatio = requiredGainPct / 100;
  const targetPostScore = clamp(
    baselinePre + requiredGainRatio * Math.max(1, 100 - baselinePre),
    0,
    100,
  );

  let difficulty = 'medium';
  if (current < 40) difficulty = 'easy';
  else if (current >= 70) difficulty = 'hard';

  return {
    currentMasteryPct: Math.round(current),
    targetMasteryPct: Math.round(targetMasteryPct),
    targetPostScore: Math.round(targetPostScore),
    requiredGainPct: Math.round(requiredGainPct),
    difficulty,
  };
}

function applyMasteryUpdateFromQuiz(data, moduleName, topicName, preScore, postScore, options = {}) {
  const boundedPre = clamp(Number(preScore || 0), 0, 100);
  const boundedPost = clamp(Number(postScore || 0), 0, 100);
  const boundedConfidence = Number.isFinite(options.confidence) ? clamp(Number(options.confidence), 1, 5) : 3;
  const aiUsed = Boolean(options.aiUsed);
  const source = String(options.source || 'quiz_submit');
  const now = options.at || nowIso();

  const mod = moduleState(data, moduleName);
  const topic = topicState(mod, topicName);
  applyDailyMasteryDecay(topic, moduleName, data, now);

  const oldMastery = topic.mastery;
  const oldMasteryPct = masteryToPercent(oldMastery);
  const gain = learningGain(boundedPre, boundedPost);
  const gainPct = gain * 100;
  const decayRatePct = aiRetentionDecayRatePercent(topic, moduleName, data, now);

  // Requested formula in percentage space:
  // New mastery = old mastery + learning gain - retention decay rate
  const newMasteryPct = clamp(oldMasteryPct + gainPct - decayRatePct, 0, 100);
  topic.mastery = percentToMastery(newMasteryPct);
  topic.lastInteractionAt = now;
  topic.lastQuizAt = now;
  topic.lastDecayAppliedAt = now;
  topic.nextReviewAt = new Date(new Date(now).getTime() + reviewDaysForTopic(topic, moduleName, data, now) * 86400000).toISOString();

  const decay = decayRatePct / 10;
  const difficultyPlan = buildAdaptiveDifficultyPlan(oldMasteryPct, boundedPre, decayRatePct);
  topic.history.push({
    at: now,
    oldMastery,
    newMastery: topic.mastery,
    oldMasteryPct,
    newMasteryPct,
    preScore: boundedPre,
    postScore: boundedPost,
    confidence: boundedConfidence,
    aiUsed,
    source,
    decay,
    decayRatePct,
    gain,
    gainPct,
    difficultyTarget: difficultyPlan,
  });

  return {
    topic,
    boundedPre,
    boundedPost,
    boundedConfidence,
    aiUsed,
    oldMastery,
    newMastery: topic.mastery,
    oldMasteryPct,
    newMasteryPct,
    gain,
    gainPct,
    decay,
    decayRatePct,
    difficultyPlan,
  };
}

function reviewDays(mastery) {
  if (mastery < 4) return 2;
  if (mastery < 6) return 4;
  if (mastery < 8) return 7;
  return 12;
}

function learnerAbilityForTopic(topic, moduleName, data) {
  const masteryPct = masteryToPercent(topic.estimatedMasteryNow ?? topic.mastery ?? 5);
  const moduleFocus = clamp(Number(moduleState(data, moduleName).focusEfficiency || 0) / 100, 0, 1);
  const attempts = data.quizAttempts
    .filter((q) => q.moduleName === moduleName && q.topicName === topic.topicName)
    .slice(-8);
  const meanScore = attempts.length
    ? attempts.reduce((sum, item) => sum + clamp(Number(item.postScore || 0), 0, 100), 0) / attempts.length
    : masteryPct;
  const consistency = attempts.length > 1
    ? 1 - clamp(stdDev(attempts.map((x) => clamp(Number(x.postScore || 0), 0, 100))) / 35, 0, 0.7)
    : 0.55;

  return clamp(
    0.45 * (masteryPct / 100)
      + 0.25 * moduleFocus
      + 0.2 * (meanScore / 100)
      + 0.1 * consistency,
    0,
    1,
  );
}

function reviewDaysForTopic(topic, moduleName, data, currentTimeIso) {
  const at = currentTimeIso || nowIso();
  const ability = learnerAbilityForTopic(topic, moduleName, data);
  const decayRatePct = aiRetentionDecayRatePercent(topic, moduleName, data, at);
  const masteryPct = masteryToPercent(topic.estimatedMasteryNow ?? topic.mastery ?? 5);
  const historyCount = Array.isArray(topic.history) ? topic.history.length : 0;
  const daysIdle = daysBetween(topic.lastInteractionAt || topic.createdAt || at, at);

  const memoryStrengthDays = clamp(
    1.6
      + masteryPct / 18
      + ability * 6
      - decayRatePct / 8,
    1.2,
    36,
  );

  // Higher-ability learners can keep longer intervals before the same retention threshold.
  const targetRetention = clamp(0.82 - ability * 0.12, 0.68, 0.82);
  const baseGapDays = clamp(Math.round(-memoryStrengthDays * Math.log(targetRetention)), 1, 18);

  // Successful repeated reviews gradually widen spacing; long neglect pulls spacing tighter.
  const maturityStretch = 1 + clamp(historyCount / 12, 0, 1.2) * 0.55;
  const abilityStretch = 1 + ability * 0.35;
  const neglectPenalty = 1 - clamp(daysIdle / 60, 0, 0.35);

  const adaptiveGap = Math.round(baseGapDays * maturityStretch * abilityStretch * neglectPenalty);
  return clamp(adaptiveGap, 1, 45);
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

function classifyBehaviorType(metrics) {
  if (metrics.distractionRatio > 0.32) return 'Distractible Explorer';
  if (metrics.sessionIntensity > 0.78 && metrics.overworkLoad > 0.45) return 'Sprint-and-Crash';
  if (metrics.stabilityRisk > 0.55 && metrics.accuracyDropRisk > 0.4) return 'Overloaded Striver';
  if (metrics.focusRatio >= 0.65 && metrics.stabilityRisk < 0.35) return 'Steady Deep Learner';
  return 'Adaptive Mixed Learner';
}

function buildRecoveryPlan(behaviorType, burnoutRisk, weakestTopics) {
  const lightReviewLine = weakestTopics.length
    ? `Do a light 20-minute note skim on ${weakestTopics.slice(0, 2).join(' and ')} (no timed quiz).`
    : 'Do a light 20-minute note skim on your weakest topic (no timed quiz).';

  if (burnoutRisk >= 71) {
    if (behaviorType === 'Sprint-and-Crash') {
      return [
        lightReviewLine,
        'Switch to 25/10 blocks for the next 2 days and cap total study time at 2.5 hours/day.',
        'Insert one 24-hour recovery gap before the next hard quiz set.',
      ];
    }
    if (behaviorType === 'Distractible Explorer') {
      return [
        lightReviewLine,
        'Use 20/5 focus blocks with site blocking and limit to 3 blocks today.',
        'Take a 30-minute walk/off-screen break before any further studying.',
      ];
    }
    return [
      lightReviewLine,
      'Reduce quiz intensity for 48 hours: concept checks only, no full mocks.',
      'Increase rest interval between sessions to at least 90 minutes.',
    ];
  }

  if (burnoutRisk >= 41) {
    if (behaviorType === 'Steady Deep Learner') {
      return [
        lightReviewLine,
        'Keep regular pace but add one extra 15-minute recovery break every 90 minutes.',
        'Use one medium-difficulty quiz only after a full review block.',
      ];
    }
    return [
      lightReviewLine,
      'Use 40/10 blocks and avoid back-to-back hard quizzes in the same day.',
      'Schedule one short recovery activity after each two study blocks.',
    ];
  }

  return [
    lightReviewLine,
    'Maintain current pace with one short break every 60-75 minutes.',
    'Keep one mixed-difficulty quiz daily to sustain momentum.',
  ];
}

function computeBurnoutSignals(moduleName, data, moduleSessions, recentAttempts, tabEvents) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const recentSessions = moduleSessions.filter((s) => new Date(s.startAt) >= sevenDaysAgo);
  const recentAttempts7d = recentAttempts.filter((a) => new Date(a.submittedAt) >= sevenDaysAgo);

  let recentMinutes = 0;
  for (const s of recentSessions) {
    const mins = Math.max(0, (new Date(s.endAt).getTime() - new Date(s.startAt).getTime()) / 60000);
    recentMinutes += mins;
  }

  const avgSessionMinutes = recentSessions.length ? recentMinutes / recentSessions.length : 0;
  const dailyMinutes = recentMinutes / 7;

  const scores = recentAttempts.map((x) => Number(x.postScore || 0));
  const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
  const secondHalf = scores.slice(Math.floor(scores.length / 2));
  const firstAvg = firstHalf.length ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
  const secondAvg = secondHalf.length ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
  const accuracyDrop = Math.max(0, firstAvg - secondAvg);
  const volatility = stdDev(scores);

  const distraction = tabEvents.filter((e) => e.eventType === 'distraction').length;
  const focused = tabEvents.filter((e) => e.eventType === 'learning').length;
  const help = tabEvents.filter((e) => e.eventType === 'help').length;
  const totalSignalEvents = Math.max(1, focused + distraction + help);
  const distractionRatio = distraction / totalSignalEvents;
  const focusRatio = focused / totalSignalEvents;

  const sessionsPerDay = recentSessions.length / 7;
  const quizDensity = recentAttempts7d.length / 7;

  const accuracyDropRisk = clamp(accuracyDrop / 18, 0, 1);
  const stabilityRisk = clamp(volatility / 22, 0, 1);
  const overworkLoad = clamp((dailyMinutes - 120) / 180, 0, 1) * 0.7 + clamp((sessionsPerDay - 2) / 2, 0, 1) * 0.3;
  const distractionRisk = clamp(distractionRatio / 0.42, 0, 1);
  const intensityRisk = clamp((quizDensity - 2.5) / 2.5, 0, 1);
  const sessionIntensity = clamp(avgSessionMinutes / 140, 0, 1);

  const score = clamp(
    (
      accuracyDropRisk * 0.24 +
      stabilityRisk * 0.18 +
      overworkLoad * 0.2 +
      distractionRisk * 0.14 +
      intensityRisk * 0.14 +
      sessionIntensity * 0.1
    ) * 100,
    0,
    100,
  );

  const behaviorType = classifyBehaviorType({
    distractionRatio,
    sessionIntensity,
    overworkLoad,
    stabilityRisk,
    accuracyDropRisk,
    focusRatio,
  });

  const reasons = [];
  if (accuracyDropRisk > 0.35) reasons.push('accuracy trend is falling');
  if (stabilityRisk > 0.35) reasons.push('quiz performance is unstable');
  if (overworkLoad > 0.35) reasons.push('study load is high');
  if (intensityRisk > 0.35) reasons.push('quiz frequency is high');
  if (distractionRisk > 0.35) reasons.push('distraction ratio is elevated');

  return {
    score: Math.round(score),
    behaviorType,
    reasons,
    metrics: {
      accuracyDrop,
      volatility,
      distractionRatio,
      focusRatio,
      dailyMinutes: Math.round(dailyMinutes),
      sessionsPerDay: Number(sessionsPerDay.toFixed(2)),
      quizDensityPerDay: Number(quizDensity.toFixed(2)),
    },
  };
}

function recomputeModuleScores(data, moduleName) {
  const mod = moduleState(data, moduleName);
  const now = nowIso();

  const moduleSessions = data.studySessions.filter((s) => s.moduleName === moduleName && s.endAt);
  const moduleAttempts = data.quizAttempts.filter((q) => q.moduleName === moduleName);
  const recentAttempts = moduleAttempts.slice(-12);
  const tabEvents = data.tabEvents.filter((e) => e.moduleName === moduleName).slice(-500);

  let totalSessionMinutes = 0;
  for (const s of moduleSessions) {
    const minutes = (new Date(s.endAt).getTime() - new Date(s.startAt).getTime()) / 60000;
    if (minutes > 0) totalSessionMinutes += minutes;
  }

  const avgSession = moduleSessions.length ? totalSessionMinutes / moduleSessions.length : 0;
  const burnout = computeBurnoutSignals(moduleName, data, moduleSessions, recentAttempts, tabEvents);
  const weakestTopics = Object.values(mod.topics)
    .slice()
    .sort((a, b) => (a.estimatedMasteryNow ?? a.mastery) - (b.estimatedMasteryNow ?? b.mastery))
    .slice(0, 3)
    .map((t) => t.topicName);

  mod.burnoutRisk = burnout.score;
  mod.behaviorType = burnout.behaviorType;
  mod.burnoutSignals = burnout;
  mod.recoveryPlan = buildRecoveryPlan(burnout.behaviorType, burnout.score, weakestTopics);

  const distraction = tabEvents.filter((e) => e.eventType === 'distraction').length;
  const focused = tabEvents.filter((e) => e.eventType === 'learning').length;
  const help = tabEvents.filter((e) => e.eventType === 'help').length;

  const attempts = recentAttempts.length;
  const meanAccuracy = attempts ? recentAttempts.reduce((a, b) => a + b.postScore, 0) / attempts : 0;
  const questionVolume = recentAttempts.reduce((sum, item) => sum + Math.max(1, Number(item.total || 1)), 0);
  const focusRatio = focused / Math.max(1, focused + distraction + help);
  const distractionPenalty = distraction / Math.max(1, focused + distraction);
  const attemptCoverage = clamp(questionVolume / 60, 0, 1);
  const consistencyScore = 1 - clamp(stdDev(recentAttempts.map((x) => x.postScore)) / 35, 0, 1);
  const sessionFocusScore = clamp(avgSession / 90, 0, 1);

  // "AI" focus efficiency blend from extension + quiz + effort features.
  mod.focusEfficiency = clamp(
    (
      focusRatio * 0.34
      + (meanAccuracy / 100) * 0.28
      + attemptCoverage * 0.14
      + consistencyScore * 0.12
      + sessionFocusScore * 0.12
      - distractionPenalty * 0.2
    ) * 100,
    0,
    100,
  );

  let masterySumPct = 0;
  let topicCount = 0;
  for (const topic of Object.values(mod.topics)) {
    applyDailyMasteryDecay(topic, moduleName, data, now);
    const decay = retentionDecay(topic, moduleName, data, now);
    topic.estimatedMasteryNow = clamp(topic.mastery - decay, 1, 10);
    topic.nextReviewAt = new Date(
      new Date(topic.lastInteractionAt).getTime() + reviewDaysForTopic(topic, moduleName, data, now) * 86400000,
    ).toISOString();
    masterySumPct += masteryToPercent(topic.estimatedMasteryNow);
    topicCount += 1;
  }

  mod.masteryPercent = topicCount ? Math.round(masterySumPct / topicCount) : 0;

  mod.updatedAt = now;
}

function readinessScore(moduleName, data) {
  const exam = data.examPlans[moduleName];
  if (!exam || !exam.examDate) return { score: 0, reason: 'No data yet' };

  const testedNames = Array.isArray(exam.topicsTested) ? exam.topicsTested : [];
  if (!testedNames.length) return { score: 0, reason: 'No data yet' };

  const mod = moduleState(data, moduleName);
  const topicStates = testedNames
    .map((name) => mod.topics[name])
    .filter(Boolean);
  if (!topicStates.length) return { score: 0, reason: 'No data yet' };

  const masteryPct = topicStates.reduce((sum, topic) => sum + masteryToPercent(topic.estimatedMasteryNow ?? topic.mastery), 0) / topicStates.length;
  const testedSet = new Set(testedNames);
  const testedAttempts = data.quizAttempts.filter((q) => q.moduleName === moduleName && testedSet.has(q.topicName));
  const meanQuizScore = testedAttempts.length
    ? testedAttempts.reduce((sum, q) => sum + clamp(Number(q.postScore || 0), 0, 100), 0) / testedAttempts.length
    : masteryPct;

  const daysLeft = Math.max(0, daysBetween(nowIso(), exam.examDate));
  const coverageRatio = clamp((exam.topicsCovered || 0) / Math.max(1, testedNames.length), 0, 1);
  const urgency = 1 - clamp(daysLeft / 45, 0, 1); // approaches 1 as exam nears
  const focusTerm = clamp(Number(mod.focusEfficiency || 0), 0, 100);
  const stabilityPenalty = testedAttempts.length > 1
    ? clamp(stdDev(testedAttempts.map((q) => clamp(Number(q.postScore || 0), 0, 100))) / 2.5, 0, 18)
    : 0;

  // AI-style readiness: mastery-led, adjusted by exam proximity.
  const baseReadiness = masteryPct * 0.62 + meanQuizScore * 0.16 + focusTerm * 0.12 + coverageRatio * 100 * 0.10;
  const proximityBoost = urgency * (masteryPct - 50) * 0.22;
  const score = clamp(baseReadiness + proximityBoost - stabilityPenalty, 0, 100);

  return {
    score: Math.round(score),
    reason: `Mastery ${Math.round(masteryPct)}%, quiz ${Math.round(meanQuizScore)}%, focus ${Math.round(focusTerm)}%, coverage ${Math.round(coverageRatio * 100)}%, ${Math.ceil(daysLeft)} days to exam.`,
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
  const behaviorType = moduleName
    ? (moduleState(data, moduleName).behaviorType || 'Adaptive Mixed Learner')
    : (() => {
        const byType = {};
        for (const name of targetModules) {
          const t = moduleState(data, name).behaviorType || 'Adaptive Mixed Learner';
          byType[t] = (byType[t] || 0) + 1;
        }
        return Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Adaptive Mixed Learner';
      })();
  const recoveryActions = moduleName
    ? (moduleState(data, moduleName).recoveryPlan || buildRecoveryPlan(behaviorType, burnoutRisk, weakest))
    : buildRecoveryPlan(behaviorType, burnoutRisk, weakest);
  const burnoutReasons = moduleName
    ? (moduleState(data, moduleName).burnoutSignals?.reasons || [])
    : [];

  return {
    moduleName: label,
    summary: `Burnout risk is ${burnoutRisk}% (${burnoutRisk <= 40 ? 'green' : burnoutRisk <= 70 ? 'yellow' : 'red'} zone). Behavior type: ${behaviorType}.${burnoutReasons.length ? ` Signals: ${burnoutReasons.join(', ')}.` : ''}`,
    actions: [
      `Spend your next 30 minutes on: ${weakest.join(', ') || 'set up topic tags first'}.`,
      due.length ? `Due for review now: ${due.join(', ')}.` : 'No overdue spaced-repetition reviews today.',
      ...recoveryActions,
      `Focus efficiency is ${focusEfficiency}%. Keep distraction events under 15% of tab events.`,
      `Exam readiness: ${readiness.score}/100. ${readiness.reason}`,
    ].slice(0, 5),
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

function extractJsonObject(text) {
  if (!text) return null;
  const trimmed = String(text).trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue.
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue.
    }
  }

  return null;
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

    if (!response.ok) return buildOnboardingPersonaHeuristic(payload);

    const result = await response.json();
    const text = readResponseText(result);
    const parsed = extractJsonObject(text);

    if (!parsed || !parsed.learningStyle || !parsed.rationale || !Array.isArray(parsed.studyTechniques)) {
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
  const parsed = extractJsonObject(text);

  if (!parsed || !parsed.summary || !Array.isArray(parsed.actions)) {
    return buildInsightsHeuristic(data, moduleName);
  }

  return {
    moduleName: moduleName || 'overall',
    summary: String(parsed.summary),
    actions: parsed.actions.slice(0, 5).map((x) => String(x)),
  };
}

function isTextLikeFile(fileName, mimeType) {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  const mime = String(mimeType || '').toLowerCase();
  if (mime.startsWith('text/')) return true;
  if (mime.includes('json') || mime.includes('javascript') || mime.includes('xml') || mime.includes('yaml')) return true;
  return TEXT_FILE_EXTENSIONS.has(ext);
}

function extractTextFromFile(fileName, mimeType, buffer) {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  if (!isTextLikeFile(fileName, mimeType)) {
    if (ext === '.pdf') {
      return 'PDF uploaded. Text extraction is not enabled in this build; convert key sections to .txt/.md for quiz generation quality.';
    }
    return '';
  }
  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) return '';
  try {
    return buffer.toString('utf8', 0, MAX_EXTRACTED_TEXT_CHARS);
  } catch {
    return '';
  }
}

function safePathPart(value) {
  const text = String(value || '').trim();
  const cleaned = text.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return cleaned || 'unknown';
}

function parseMultipartContentDisposition(headerLine) {
  const nameMatch = /name="([^"]+)"/i.exec(headerLine);
  const fileMatch = /filename="([^"]*)"/i.exec(headerLine);
  return {
    fieldName: nameMatch ? nameMatch[1] : '',
    filename: fileMatch ? fileMatch[1] : '',
  };
}

function parseMultipartBody(buffer, boundary) {
  const raw = buffer.toString('latin1');
  const delim = `--${boundary}`;
  const parts = raw.split(delim).slice(1, -1);
  const fields = {};
  const files = [];

  for (const partRaw of parts) {
    let part = partRaw;
    if (part.startsWith('\r\n')) part = part.slice(2);
    if (part.endsWith('\r\n')) part = part.slice(0, -2);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headersText = part.slice(0, headerEnd);
    const bodyText = part.slice(headerEnd + 4);
    const headerLines = headersText.split('\r\n');
    const disposition = headerLines.find((line) => line.toLowerCase().startsWith('content-disposition:'));
    if (!disposition) continue;
    const { fieldName, filename } = parseMultipartContentDisposition(disposition);
    if (!fieldName) continue;

    const contentTypeLine = headerLines.find((line) => line.toLowerCase().startsWith('content-type:'));
    const contentType = contentTypeLine ? contentTypeLine.split(':')[1].trim() : 'application/octet-stream';
    const valueBuffer = Buffer.from(bodyText, 'latin1');

    if (filename) {
      files.push({
        fieldName,
        filename: path.basename(filename),
        contentType,
        buffer: valueBuffer,
      });
    } else {
      fields[fieldName] = valueBuffer.toString('utf8');
    }
  }

  return { fields, files };
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '');
    const boundaryMatch = /boundary=([^;]+)/i.exec(contentType);
    if (!boundaryMatch) {
      reject(new Error('Missing multipart boundary'));
      return;
    }
    const boundary = boundaryMatch[1];
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > 25_000_000) {
        reject(new Error('Upload too large'));
        req.destroy();
        return;
      }
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      try {
        const full = Buffer.concat(chunks);
        resolve(parseMultipartBody(full, boundary));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function uploadToSupabaseStorage(userId, moduleName, topicName, fileName, mimeType, buffer) {
  const objectPath = [
    sanitizeSegment(userId),
    sanitizeSegment(moduleName),
    sanitizeSegment(topicName),
    `${Date.now()}_${safeFileName(fileName)}`,
  ].join('/');

  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
  const uploadRes = await supabaseRequest(`/storage/v1/object/${encodeURIComponent(SUPABASE_STORAGE_BUCKET)}/${encodedPath}`, {
    method: 'POST',
    useServiceRole: true,
    rawBody: true,
    headers: {
      'Content-Type': mimeType || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Storage upload failed: ${supabaseErrorText(uploadRes.status, text)}`);
  }

  return objectPath;
}

function uploadToLocalStorage(userId, moduleName, topicName, fileName, buffer) {
  const dir = path.join(
    LOCAL_UPLOAD_DIR,
    sanitizeSegment(userId),
    sanitizeSegment(moduleName),
    sanitizeSegment(topicName),
  );
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const storedName = `${Date.now()}_${safeFileName(fileName)}`;
  const fullPath = path.join(dir, storedName);
  fs.writeFileSync(fullPath, buffer);

  return path.relative(DATA_DIR, fullPath).replace(/\\/g, '/');
}

async function insertTopicDocument(userId, record, data) {
  if (!SUPABASE_ENABLED) {
    const row = {
      id: randomId('doc'),
      userId,
      moduleName: record.moduleName,
      topicName: record.topicName,
      fileName: record.fileName,
      mimeType: record.mimeType,
      storagePath: record.storagePath,
      extractedText: record.extractedText,
      uploadedAt: nowIso(),
    };
    data.topicDocuments.push(row);
    return row;
  }

  const res = await supabaseRequest('/rest/v1/topic_documents', {
    method: 'POST',
    useServiceRole: true,
    headers: {
      Prefer: 'return=representation',
    },
    body: [
      {
        user_id: userId,
        module_name: record.moduleName,
        topic_name: record.topicName,
        file_name: record.fileName,
        mime_type: record.mimeType,
        storage_path: record.storagePath,
        extracted_text: record.extractedText,
      },
    ],
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to save topic document metadata: ${supabaseErrorText(res.status, text)}`);
  }

  const rows = await res.json();
  const row = rows[0];

  return {
    id: row.id,
    moduleName: row.module_name,
    topicName: row.topic_name,
    fileName: row.file_name,
    mimeType: row.mime_type,
    storagePath: row.storage_path,
    extractedText: row.extracted_text || '',
    uploadedAt: row.uploaded_at,
  };
}

async function listTopicDocuments(userId, moduleName, topicName, data) {
  if (!SUPABASE_ENABLED) {
    return data.topicDocuments
      .filter((x) => x.moduleName === moduleName && x.topicName === topicName)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  const params = new URLSearchParams({
    select: 'id,module_name,topic_name,file_name,mime_type,storage_path,extracted_text,uploaded_at',
    user_id: `eq.${userId}`,
    module_name: `eq.${moduleName}`,
    topic_name: `eq.${topicName}`,
    order: 'uploaded_at.desc',
  });

  const res = await supabaseRequest(`/rest/v1/topic_documents?${params.toString()}`, {
    useServiceRole: true,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list topic documents: ${supabaseErrorText(res.status, text)}`);
  }

  const rows = await res.json();
  return rows.map((row) => ({
    id: row.id,
    moduleName: row.module_name,
    topicName: row.topic_name,
    fileName: row.file_name,
    mimeType: row.mime_type,
    storagePath: row.storage_path,
    extractedText: row.extracted_text || '',
    uploadedAt: row.uploaded_at,
  }));
}

function toLegacyTopicDocumentSummary(doc) {
  return {
    id: String(doc.id),
    name: String(doc.fileName || ''),
    path: '',
    uploadedAt: doc.uploadedAt || nowIso(),
  };
}

async function syncTopicDocumentSummaries(userId, data, moduleNameFilter = null, topicNameFilter = null) {
  const modules = moduleNameFilter ? [moduleNameFilter] : Object.keys(data.modules || {});
  for (const moduleName of modules) {
    const mod = data.modules[moduleName];
    if (!mod || !mod.topics) continue;
    const topicNames = topicNameFilter ? [topicNameFilter] : Object.keys(mod.topics);
    for (const topicName of topicNames) {
      if (!mod.topics[topicName]) continue;
      const docs = await listTopicDocuments(userId, moduleName, topicName, data);
      mod.topics[topicName].documents = docs.map(toLegacyTopicDocumentSummary);
    }
  }
}

async function deleteTopicDocuments(userId, moduleName, topicName, data) {
  if (!SUPABASE_ENABLED) {
    data.topicDocuments = data.topicDocuments.filter((x) => !(x.moduleName === moduleName && x.topicName === topicName));
    return;
  }

  const docs = await listTopicDocuments(userId, moduleName, topicName, data);
  for (const doc of docs) {
    if (doc.storagePath) {
      const encodedPath = doc.storagePath.split('/').map(encodeURIComponent).join('/');
      const res = await supabaseRequest(`/storage/v1/object/${encodeURIComponent(SUPABASE_STORAGE_BUCKET)}/${encodedPath}`, {
        method: 'DELETE',
        useServiceRole: true,
      });
      if (!res.ok && res.status !== 404) {
        const text = await res.text();
        console.warn('Failed to delete storage object', doc.storagePath, supabaseErrorText(res.status, text));
      }
    }
  }

  const params = new URLSearchParams({
    user_id: `eq.${userId}`,
    module_name: `eq.${moduleName}`,
    topic_name: `eq.${topicName}`,
  });

  const res = await supabaseRequest(`/rest/v1/topic_documents?${params.toString()}`, {
    method: 'DELETE',
    useServiceRole: true,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete topic documents: ${supabaseErrorText(res.status, text)}`);
  }
}

function sampleFromArray(arr, count) {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < count) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

function shuffle(arr) {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function normalizeQuestions(rawQuestions, questionCount) {
  const out = [];
  const list = Array.isArray(rawQuestions) ? rawQuestions : [];

  for (const item of list) {
    if (out.length >= questionCount) break;
    if (!item || typeof item !== 'object') continue;

    const question = String(item.question || item.prompt || '').trim();
    let options = Array.isArray(item.options)
      ? item.options.map((x) => String(x || '').trim()).filter(Boolean)
      : [];

    if (!question || options.length < 2) continue;

    options = Array.from(new Set(options)).slice(0, 4);
    while (options.length < 4) {
      options.push(`Option ${options.length + 1}`);
    }

    let answerIndex = Number.isInteger(item.answerIndex) ? Number(item.answerIndex) : -1;
    if (answerIndex < 0 || answerIndex >= options.length) {
      const asText = String(item.correctAnswer || '').trim();
      if (asText) {
        const found = options.findIndex((opt) => opt.toLowerCase() === asText.toLowerCase());
        answerIndex = found >= 0 ? found : 0;
      } else {
        answerIndex = 0;
      }
    }

    out.push({
      id: `q${out.length + 1}`,
      question,
      options,
      answerIndex,
      explanation: String(item.explanation || '').trim(),
    });
  }

  return out;
}

function buildHeuristicQuiz(moduleName, topicName, documents, questionCount, difficultyPlan = null) {
  const fullText = documents
    .map((doc) => String(doc.extractedText || ''))
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();

  const sentences = fullText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 30)
    .slice(0, 120);

  const keywords = Array.from(
    new Set(
      (fullText.match(/[A-Za-z][A-Za-z0-9_-]{4,}/g) || [])
        .map((x) => x.toLowerCase())
        .filter((x) => x.length > 4),
    ),
  ).slice(0, 120);

  const questions = [];

  for (let i = 0; i < questionCount; i += 1) {
    if (sentences.length >= 4) {
      const answerSentence = sentences[i % sentences.length].slice(0, 140);
      const distractors = sampleFromArray(
        sentences.filter((_, idx) => idx !== i % sentences.length).map((s) => s.slice(0, 140)),
        3,
      );
      while (distractors.length < 3) distractors.push('Not stated in the uploaded materials.');

      const options = shuffle([answerSentence, ...distractors]);
      questions.push({
        id: `q${i + 1}`,
        question: `Which statement is most supported by your uploaded materials for ${topicName}?`,
        options,
        answerIndex: options.indexOf(answerSentence),
        explanation: 'Based on the uploaded document excerpts used for this heuristic quiz.',
      });
      continue;
    }

    const answerKeyword = keywords[i % Math.max(1, keywords.length)] || `concept_${i + 1}`;
    const distractorKeywords = sampleFromArray(keywords.filter((x) => x !== answerKeyword), 3);
    while (distractorKeywords.length < 3) distractorKeywords.push(`distractor_${distractorKeywords.length + 1}`);

    const options = shuffle([answerKeyword, ...distractorKeywords]);
    questions.push({
      id: `q${i + 1}`,
      question: `Which keyword appears in your uploaded notes for ${moduleName} / ${topicName}?`,
      options,
      answerIndex: options.indexOf(answerKeyword),
      explanation: 'Generated from uploaded document vocabulary due limited extractable sentence context.',
    });
  }

  return {
    title: `${topicName} Quiz (${documents.length} source file${documents.length === 1 ? '' : 's'})`,
    questions,
    generator: 'heuristic',
    difficultyPlan,
  };
}

async function buildAiQuiz(moduleName, topicName, documents, questionCount, difficultyPlan = null) {
  if (!OPENAI_API_KEY) {
    return buildHeuristicQuiz(moduleName, topicName, documents, questionCount, difficultyPlan);
  }

  const context = documents
    .map((doc, idx) => {
      const snippet = String(doc.extractedText || '').slice(0, 4500);
      return `Document ${idx + 1}: ${doc.fileName}\n${snippet}`;
    })
    .join('\n\n')
    .slice(0, 28000);

  if (!context.trim()) {
    return buildHeuristicQuiz(moduleName, topicName, documents, questionCount, difficultyPlan);
  }

  const difficultyLine = difficultyPlan
    ? `Difficulty target: ${difficultyPlan.difficulty}. Current mastery ${difficultyPlan.currentMasteryPct}%, target mastery ${difficultyPlan.targetMasteryPct}%, target quiz score ${difficultyPlan.targetPostScore}%.`
    : 'Difficulty target: medium.';

  const prompt = [
    'You are a strict quiz generator for students.',
    'Return JSON only. No markdown.',
    'Expected JSON shape:',
    '{ "title": string, "questions": [{ "question": string, "options": [string,string,string,string], "answerIndex": number, "explanation": string }] }',
    `Create exactly ${questionCount} multiple-choice questions with 4 options each.`,
    `Module: ${moduleName}`,
    `Topic: ${topicName}`,
    difficultyLine,
    'Rules:',
    '- Use only the provided documents.',
    '- Keep options plausible and avoid trick ambiguity.',
    '- answerIndex must be 0..3 and match the correct option.',
    'Documents:',
    context,
  ].join('\n');

  try {
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
      const text = await response.text();
      console.warn('Quiz generation OpenAI request failed', response.status, text);
      return buildHeuristicQuiz(moduleName, topicName, documents, questionCount, difficultyPlan);
    }

    const result = await response.json();
    const text = readResponseText(result);
    const parsed = extractJsonObject(text);

    if (!parsed || !Array.isArray(parsed.questions)) {
      return buildHeuristicQuiz(moduleName, topicName, documents, questionCount, difficultyPlan);
    }

    const questions = normalizeQuestions(parsed.questions, questionCount);
    if (!questions.length) {
      return buildHeuristicQuiz(moduleName, topicName, documents, questionCount, difficultyPlan);
    }

    return {
      title: String(parsed.title || `${topicName} AI Quiz`).trim() || `${topicName} AI Quiz`,
      questions,
      generator: 'openai',
      difficultyPlan,
    };
  } catch (err) {
    console.warn('Quiz generation error', err);
    return buildHeuristicQuiz(moduleName, topicName, documents, questionCount, difficultyPlan);
  }
}

function serializeQuizForClient(quiz, includeAnswers = false) {
  const questions = quiz.questions.map((q) => {
    const base = {
      id: q.id,
      question: q.question,
      options: q.options,
      explanation: q.explanation || '',
    };
    if (includeAnswers) {
      return {
        ...base,
        answerIndex: q.answerIndex,
      };
    }
    return base;
  });

  return {
    id: quiz.id,
    moduleName: quiz.moduleName,
    topicName: quiz.topicName,
    title: quiz.title,
    questions,
    createdAt: quiz.createdAt,
    sourceDocumentIds: quiz.sourceDocumentIds,
    attempts: quiz.attempts || [],
    attemptCount: quiz.attemptCount || 0,
    lastAttempt: quiz.lastAttempt || null,
    difficultyPlan: quiz.difficultyPlan || null,
  };
}

async function createTopicQuiz(userId, quizRecord, data) {
  if (!SUPABASE_ENABLED) {
    const row = {
      id: randomId('aiquiz'),
      userId,
      moduleName: quizRecord.moduleName,
      topicName: quizRecord.topicName,
      title: quizRecord.title,
      questions: quizRecord.questions,
      sourceDocumentIds: quizRecord.sourceDocumentIds || [],
      difficultyPlan: quizRecord.difficultyPlan || null,
      createdAt: nowIso(),
    };
    data.generatedQuizzes.push(row);
    return {
      ...row,
      attempts: [],
      attemptCount: 0,
      lastAttempt: null,
    };
  }

  const res = await supabaseRequest('/rest/v1/topic_quizzes', {
    method: 'POST',
    useServiceRole: true,
    headers: {
      Prefer: 'return=representation',
    },
    body: [
      {
        user_id: userId,
        module_name: quizRecord.moduleName,
        topic_name: quizRecord.topicName,
        title: quizRecord.title,
        questions: quizRecord.questions,
        source_document_ids: quizRecord.sourceDocumentIds || [],
      },
    ],
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create quiz: ${supabaseErrorText(res.status, text)}`);
  }

  const rows = await res.json();
  const row = rows[0];

  return {
    id: row.id,
    moduleName: row.module_name,
    topicName: row.topic_name,
    title: row.title,
    questions: Array.isArray(row.questions) ? row.questions : [],
    sourceDocumentIds: Array.isArray(row.source_document_ids) ? row.source_document_ids : [],
    createdAt: row.created_at,
    attempts: [],
    attemptCount: 0,
    lastAttempt: null,
  };
}

async function getQuizById(userId, quizId, data) {
  if (!SUPABASE_ENABLED) {
    return data.generatedQuizzes.find((x) => x.id === quizId) || null;
  }

  const params = new URLSearchParams({
    select: 'id,module_name,topic_name,title,questions,source_document_ids,created_at',
    user_id: `eq.${userId}`,
    id: `eq.${quizId}`,
    limit: '1',
  });

  const res = await supabaseRequest(`/rest/v1/topic_quizzes?${params.toString()}`, {
    useServiceRole: true,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load quiz: ${supabaseErrorText(res.status, text)}`);
  }

  const rows = await res.json();
  if (!rows.length) return null;

  const row = rows[0];
  return {
    id: row.id,
    moduleName: row.module_name,
    topicName: row.topic_name,
    title: row.title,
    questions: Array.isArray(row.questions) ? row.questions : [],
    sourceDocumentIds: Array.isArray(row.source_document_ids) ? row.source_document_ids : [],
    createdAt: row.created_at,
  };
}

async function saveQuizAttempt(userId, payload, data) {
  if (!SUPABASE_ENABLED) {
    const row = {
      id: randomId('attempt'),
      userId,
      quizId: payload.quizId,
      moduleName: payload.moduleName,
      topicName: payload.topicName,
      score: payload.score,
      total: payload.total,
      answers: payload.answers,
      resultBreakdown: payload.resultBreakdown,
      submittedAt: nowIso(),
    };
    data.generatedQuizAttempts.push(row);
    return row;
  }

  const res = await supabaseRequest('/rest/v1/topic_quiz_attempts', {
    method: 'POST',
    useServiceRole: true,
    headers: {
      Prefer: 'return=representation',
    },
    body: [
      {
        user_id: userId,
        quiz_id: payload.quizId,
        module_name: payload.moduleName,
        topic_name: payload.topicName,
        score: payload.score,
        total: payload.total,
        answers: payload.answers,
        result_breakdown: payload.resultBreakdown,
      },
    ],
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to save quiz attempt: ${supabaseErrorText(res.status, text)}`);
  }

  const rows = await res.json();
  const row = rows[0];

  return {
    id: row.id,
    quizId: row.quiz_id,
    moduleName: row.module_name,
    topicName: row.topic_name,
    score: row.score,
    total: row.total,
    answers: row.answers,
    resultBreakdown: row.result_breakdown,
    submittedAt: row.submitted_at,
  };
}

async function listTopicQuizzes(userId, moduleName, topicName, data) {
  if (!SUPABASE_ENABLED) {
    const attemptsByQuiz = new Map();

    for (const attempt of data.generatedQuizAttempts) {
      if (attempt.moduleName !== moduleName || attempt.topicName !== topicName) continue;
      const list = attemptsByQuiz.get(attempt.quizId) || [];
      list.push(attempt);
      attemptsByQuiz.set(attempt.quizId, list);
    }

    return data.generatedQuizzes
      .filter((x) => x.moduleName === moduleName && x.topicName === topicName)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((quiz) => {
        const attempts = (attemptsByQuiz.get(quiz.id) || [])
          .slice()
          .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        return {
          ...quiz,
          attempts,
          attemptCount: attempts.length,
          lastAttempt: attempts[0] || null,
        };
      });
  }

  const quizParams = new URLSearchParams({
    select: 'id,module_name,topic_name,title,questions,source_document_ids,created_at',
    user_id: `eq.${userId}`,
    module_name: `eq.${moduleName}`,
    topic_name: `eq.${topicName}`,
    order: 'created_at.desc',
  });

  const attemptsParams = new URLSearchParams({
    select: 'id,quiz_id,module_name,topic_name,score,total,answers,result_breakdown,submitted_at',
    user_id: `eq.${userId}`,
    module_name: `eq.${moduleName}`,
    topic_name: `eq.${topicName}`,
    order: 'submitted_at.desc',
  });

  const [quizRes, attemptRes] = await Promise.all([
    supabaseRequest(`/rest/v1/topic_quizzes?${quizParams.toString()}`, { useServiceRole: true }),
    supabaseRequest(`/rest/v1/topic_quiz_attempts?${attemptsParams.toString()}`, { useServiceRole: true }),
  ]);

  if (!quizRes.ok) {
    const text = await quizRes.text();
    throw new Error(`Failed to list quizzes: ${supabaseErrorText(quizRes.status, text)}`);
  }

  if (!attemptRes.ok) {
    const text = await attemptRes.text();
    throw new Error(`Failed to list quiz attempts: ${supabaseErrorText(attemptRes.status, text)}`);
  }

  const quizzes = await quizRes.json();
  const attempts = await attemptRes.json();

  const attemptsByQuiz = new Map();
  for (const row of attempts) {
    const quizId = row.quiz_id;
    if (!quizId) continue;
    const list = attemptsByQuiz.get(quizId) || [];
    list.push({
      id: row.id,
      quizId: row.quiz_id,
      moduleName: row.module_name,
      topicName: row.topic_name,
      score: row.score,
      total: row.total,
      answers: row.answers,
      resultBreakdown: row.result_breakdown,
      submittedAt: row.submitted_at,
    });
    attemptsByQuiz.set(quizId, list);
  }

  return quizzes.map((row) => {
    const quizAttempts = attemptsByQuiz.get(row.id) || [];
    return {
      id: row.id,
      moduleName: row.module_name,
      topicName: row.topic_name,
      title: row.title,
      questions: Array.isArray(row.questions) ? row.questions : [],
      sourceDocumentIds: Array.isArray(row.source_document_ids) ? row.source_document_ids : [],
      createdAt: row.created_at,
      attempts: quizAttempts,
      attemptCount: quizAttempts.length,
      lastAttempt: quizAttempts[0] || null,
    };
  });
}

async function deleteTopicQuizzes(userId, moduleName, topicName, data) {
  if (!SUPABASE_ENABLED) {
    const ids = new Set(
      data.generatedQuizzes
        .filter((x) => x.moduleName === moduleName && x.topicName === topicName)
        .map((x) => x.id),
    );

    data.generatedQuizzes = data.generatedQuizzes.filter((x) => !(x.moduleName === moduleName && x.topicName === topicName));
    data.generatedQuizAttempts = data.generatedQuizAttempts.filter((x) => !ids.has(x.quizId));
    return;
  }

  const attemptParams = new URLSearchParams({
    user_id: `eq.${userId}`,
    module_name: `eq.${moduleName}`,
    topic_name: `eq.${topicName}`,
  });
  const deleteAttempts = await supabaseRequest(`/rest/v1/topic_quiz_attempts?${attemptParams.toString()}`, {
    method: 'DELETE',
    useServiceRole: true,
  });
  if (!deleteAttempts.ok) {
    const text = await deleteAttempts.text();
    throw new Error(`Failed to delete topic quiz attempts: ${supabaseErrorText(deleteAttempts.status, text)}`);
  }

  const quizParams = new URLSearchParams({
    user_id: `eq.${userId}`,
    module_name: `eq.${moduleName}`,
    topic_name: `eq.${topicName}`,
  });
  const deleteQuizzes = await supabaseRequest(`/rest/v1/topic_quizzes?${quizParams.toString()}`, {
    method: 'DELETE',
    useServiceRole: true,
  });
  if (!deleteQuizzes.ok) {
    const text = await deleteQuizzes.text();
    throw new Error(`Failed to delete topic quizzes: ${supabaseErrorText(deleteQuizzes.status, text)}`);
  }
}

async function deleteModuleResources(userId, moduleName, data) {
  const topicNames = Object.keys(data.modules[moduleName]?.topics || {});
  for (const topicName of topicNames) {
    await deleteTopicDocuments(userId, moduleName, topicName, data);
    await deleteTopicQuizzes(userId, moduleName, topicName, data);
  }

  if (SUPABASE_ENABLED) {
    const docParams = new URLSearchParams({
      user_id: `eq.${userId}`,
      module_name: `eq.${moduleName}`,
    });
    const deleteDocs = await supabaseRequest(`/rest/v1/topic_documents?${docParams.toString()}`, {
      method: 'DELETE',
      useServiceRole: true,
    });
    if (!deleteDocs.ok) {
      const text = await deleteDocs.text();
      throw new Error(`Failed to delete module documents: ${supabaseErrorText(deleteDocs.status, text)}`);
    }

    const attemptParams = new URLSearchParams({
      user_id: `eq.${userId}`,
      module_name: `eq.${moduleName}`,
    });
    const deleteAttempts = await supabaseRequest(`/rest/v1/topic_quiz_attempts?${attemptParams.toString()}`, {
      method: 'DELETE',
      useServiceRole: true,
    });
    if (!deleteAttempts.ok) {
      const text = await deleteAttempts.text();
      throw new Error(`Failed to delete module quiz attempts: ${supabaseErrorText(deleteAttempts.status, text)}`);
    }

    const quizParams = new URLSearchParams({
      user_id: `eq.${userId}`,
      module_name: `eq.${moduleName}`,
    });
    const deleteQuizzes = await supabaseRequest(`/rest/v1/topic_quizzes?${quizParams.toString()}`, {
      method: 'DELETE',
      useServiceRole: true,
    });
    if (!deleteQuizzes.ok) {
      const text = await deleteQuizzes.text();
      throw new Error(`Failed to delete module quizzes: ${supabaseErrorText(deleteQuizzes.status, text)}`);
    }
    return;
  }

  data.topicDocuments = data.topicDocuments.filter((x) => x.moduleName !== moduleName);
  data.generatedQuizAttempts = data.generatedQuizAttempts.filter((x) => x.moduleName !== moduleName);
  data.generatedQuizzes = data.generatedQuizzes.filter((x) => x.moduleName !== moduleName);
}

function evaluateQuiz(quiz, answersInput) {
  const answers = Array.isArray(answersInput) ? answersInput : [];
  const results = [];

  for (let i = 0; i < quiz.questions.length; i += 1) {
    const q = quiz.questions[i];
    const selectedIndex = Number.isInteger(answers[i]) ? answers[i] : null;
    const isCorrect = selectedIndex === q.answerIndex;
    results.push({
      questionId: q.id,
      selectedIndex,
      correctIndex: q.answerIndex,
      isCorrect,
      explanation: q.explanation || '',
    });
  }

  const score = results.filter((x) => x.isCorrect).length;
  const total = results.length;
  return { score, total, results };
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
      if (body.length > 12_000_000) {
        req.destroy();
      }
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

async function ensureAuthenticatedUser(req, res) {
  const user = await resolveRequestUser(req);
  if (!user) {
    send(res, 401, { error: 'Unauthorized. Please sign in.' });
    return null;
  }
  return user;
}

async function apiHandler(req, res, parsedUrl) {
  const pathname = parsedUrl.pathname;

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const body = await parseBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return send(res, 400, { error: 'email and password are required' });
    }

    if (password.length < 6) {
      return send(res, 400, { error: 'password must be at least 6 characters' });
    }

    try {
      const authResult = await signInWithSupabase(email, password);
      if (!authResult?.user?.id || !authResult?.session?.access_token) {
        throw new Error('Authentication response was incomplete. Please try again.');
      }
      return send(res, 200, {
        ok: true,
        user: {
          id: authResult.user.id,
          email: authResult.user.email || email,
        },
        session: {
          accessToken: authResult.session.access_token,
          refreshToken: authResult.session.refresh_token,
          expiresIn: authResult.session.expires_in,
          tokenType: authResult.session.token_type,
        },
        supabaseEnabled: SUPABASE_ENABLED,
      });
    } catch (err) {
      return send(res, 401, { error: err instanceof Error ? err.message : 'Authentication failed' });
    }
  }

  if (req.method === 'POST' && pathname === '/api/auth/signup') {
    const body = await parseBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return send(res, 400, { error: 'email and password are required' });
    }

    if (password.length < 6) {
      return send(res, 400, { error: 'password must be at least 6 characters' });
    }

    try {
      const authResult = await signUpWithSupabase(email, password);
      if (!authResult?.user?.id || !authResult?.session?.access_token) {
        throw new Error('Sign-up response was incomplete. Please try again.');
      }
      return send(res, 200, {
        ok: true,
        user: {
          id: authResult.user.id,
          email: authResult.user.email || email,
        },
        session: {
          accessToken: authResult.session.access_token,
          refreshToken: authResult.session.refresh_token,
          expiresIn: authResult.session.expires_in,
          tokenType: authResult.session.token_type,
        },
        supabaseEnabled: SUPABASE_ENABLED,
      });
    } catch (err) {
      return send(res, 401, { error: err instanceof Error ? err.message : 'Sign-up failed' });
    }
  }

  if (req.method === 'GET' && pathname === '/api/auth/session') {
    if (!SUPABASE_ENABLED) {
      return send(res, 200, {
        ok: true,
        user: { id: 'local-user', email: 'local@brainosaur.dev' },
        supabaseEnabled: false,
      });
    }

    const user = await resolveRequestUser(req);
    if (!user) return send(res, 401, { error: 'Invalid or expired session token' });
    return send(res, 200, { ok: true, user, supabaseEnabled: true });
  }

  if (req.method === 'POST' && pathname === '/api/onboarding/persona') {
    const body = await parseBody(req);
    const payload = normalizeOnboardingPayload(body);
    const analysis = await buildOnboardingPersonaWithOpenAI(payload);
    return send(res, 200, { ok: true, analysis, aiEnabled: Boolean(OPENAI_API_KEY) });
  }

  const user = await ensureAuthenticatedUser(req, res);
  if (!user) return;

  const data = await loadDataForUser(user.id);

  if (req.method === 'GET' && pathname === '/api/state') {
    await syncTopicDocumentSummaries(user.id, data);
    for (const moduleName of Object.keys(data.modules)) recomputeModuleScores(data, moduleName);
    await saveDataForUser(user.id, data);
    return send(res, 200, { ...data, aiEnabled: Boolean(OPENAI_API_KEY), supabaseEnabled: SUPABASE_ENABLED });
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

    const previousModules = new Set(Object.keys(data.modules));

    data.profile = {
      fullName: body.fullName !== undefined ? String(body.fullName || '') : String(data.profile.fullName || ''),
      email: body.email !== undefined ? String(body.email || '') : String(data.profile.email || ''),
      university: body.university || '',
      yearOfStudy: body.yearOfStudy || '',
      courseOfStudy: body.courseOfStudy || '',
      modules: normalizedModules,
    };

    const allowed = new Set(normalizedModules);

    const removedModules = [...previousModules].filter((moduleName) => !allowed.has(moduleName));
    for (const removed of removedModules) {
      await deleteModuleResources(user.id, removed, data);
    }

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
    await saveDataForUser(user.id, data);
    return send(res, 200, { ok: true, profile: data.profile });
  }

  if (req.method === 'POST' && pathname === '/api/study-session/start') {
    const body = await parseBody(req);
    if (!body.moduleName) return send(res, 400, { error: 'moduleName is required' });

    const session = {
      id: randomId('sess'),
      moduleName: body.moduleName,
      topicName: body.topicName || 'General',
      startAt: nowIso(),
      endAt: null,
    };
    data.studySessions.push(session);
    moduleState(data, body.moduleName);
    await saveDataForUser(user.id, data);
    return send(res, 200, { ok: true, session });
  }

  if (req.method === 'POST' && pathname === '/api/study-session/stop') {
    const body = await parseBody(req);
    const sess = data.studySessions.find((x) => x.id === body.sessionId && !x.endAt);
    if (!sess) return send(res, 404, { error: 'Active session not found' });
    sess.endAt = nowIso();
    recomputeModuleScores(data, sess.moduleName);
    await saveDataForUser(user.id, data);
    return send(res, 200, { ok: true, session: sess });
  }

  if (req.method === 'POST' && pathname === '/api/tab-event') {
    const body = await parseBody(req);
    if (!body.moduleName || !body.url) return send(res, 400, { error: 'moduleName and url are required' });

    const eventType = body.eventType || classifyUrl(body.url);
    const event = {
      id: randomId('evt'),
      moduleName: body.moduleName,
      topicName: body.topicName || 'General',
      url: body.url,
      eventType,
      userLabel: body.userLabel || null,
      createdAt: nowIso(),
    };
    data.tabEvents.push(event);
    recomputeModuleScores(data, body.moduleName);
    await saveDataForUser(user.id, data);
    return send(res, 200, { ok: true, event });
  }

  if (req.method === 'POST' && pathname === '/api/topic/add') {
    const body = await parseBody(req);
    if (!body.moduleName || !body.topicName) return send(res, 400, { error: 'moduleName and topicName are required' });
    const mod = moduleState(data, body.moduleName);
    const topic = topicState(mod, body.topicName);
    topic.lastInteractionAt = nowIso();
    recomputeModuleScores(data, body.moduleName);
    await saveDataForUser(user.id, data);
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

    await deleteTopicDocuments(user.id, body.moduleName, body.topicName, data);
    await deleteTopicQuizzes(user.id, body.moduleName, body.topicName, data);

    recomputeModuleScores(data, body.moduleName);
    await saveDataForUser(user.id, data);
    return send(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/topic/files/upload') {
    const body = await parseBody(req);
    const moduleName = String(body.moduleName || '').trim();
    const topicName = String(body.topicName || '').trim();
    const files = Array.isArray(body.files) ? body.files : [];

    if (!moduleName || !topicName) return send(res, 400, { error: 'moduleName and topicName are required' });
    if (!files.length) return send(res, 400, { error: 'files are required' });

    const mod = moduleState(data, moduleName);
    topicState(mod, topicName);

    const existingDocuments = await listTopicDocuments(user.id, moduleName, topicName, data);
    const existingNames = new Set(existingDocuments.map((doc) => String(doc.fileName || '').trim().toLowerCase()).filter(Boolean));

    const uploaded = [];
    const skipped = [];

    for (const rawFile of files.slice(0, 8)) {
      const fileName = String(rawFile.name || rawFile.fileName || '').trim();
      const mimeType = String(rawFile.type || rawFile.mimeType || 'application/octet-stream').trim() || 'application/octet-stream';
      const dataBase64 = String(rawFile.dataBase64 || rawFile.base64 || '').trim();

      if (!fileName || !dataBase64) continue;
      const normalizedName = fileName.toLowerCase();
      if (existingNames.has(normalizedName)) {
        skipped.push(fileName);
        continue;
      }

      const buffer = Buffer.from(dataBase64, 'base64');
      if (!buffer.length) continue;
      if (buffer.length > 7 * 1024 * 1024) {
        return send(res, 400, { error: `File ${fileName} exceeds 7MB limit` });
      }

      const extractedText = extractTextFromFile(fileName, mimeType, buffer);
      const storagePath = SUPABASE_ENABLED
        ? await uploadToSupabaseStorage(user.id, moduleName, topicName, fileName, mimeType, buffer)
        : uploadToLocalStorage(user.id, moduleName, topicName, fileName, buffer);

      const record = await insertTopicDocument(
        user.id,
        {
          moduleName,
          topicName,
          fileName,
          mimeType,
          storagePath,
          extractedText,
        },
        data,
      );
      uploaded.push(record);
      existingNames.add(normalizedName);
    }

    if (!SUPABASE_ENABLED) {
      await saveDataForUser(user.id, data);
    }

    const documents = await listTopicDocuments(user.id, moduleName, topicName, data);
    topicState(mod, topicName).documents = documents.map(toLegacyTopicDocumentSummary);

    if (!uploaded.length && skipped.length) {
      await saveDataForUser(user.id, data);
      return send(res, 200, {
        ok: true,
        uploaded: [],
        skipped,
        documents: documents.map((doc) => ({
          id: doc.id,
          moduleName: doc.moduleName,
          topicName: doc.topicName,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          uploadedAt: doc.uploadedAt,
          textExtracted: Boolean(doc.extractedText),
        })),
      });
    }

    if (!uploaded.length) {
      return send(res, 400, { error: 'No valid files were uploaded.' });
    }

    await saveDataForUser(user.id, data);
    return send(res, 200, {
      ok: true,
      uploaded: uploaded.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        uploadedAt: doc.uploadedAt,
      })),
      skipped,
      documents: documents.map((doc) => ({
        id: doc.id,
        moduleName: doc.moduleName,
        topicName: doc.topicName,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        uploadedAt: doc.uploadedAt,
        textExtracted: Boolean(doc.extractedText),
      })),
    });
  }

  if (req.method === 'GET' && pathname === '/api/topic/files') {
    const moduleName = String(parsedUrl.searchParams.get('moduleName') || '').trim();
    const topicName = String(parsedUrl.searchParams.get('topicName') || '').trim();
    if (!moduleName || !topicName) return send(res, 400, { error: 'moduleName and topicName query params are required' });

    const documents = await listTopicDocuments(user.id, moduleName, topicName, data);
    return send(res, 200, {
      documents: documents.map((doc) => ({
        id: doc.id,
        moduleName: doc.moduleName,
        topicName: doc.topicName,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        uploadedAt: doc.uploadedAt,
        textExtracted: Boolean(doc.extractedText),
      })),
    });
  }

  if (req.method === 'POST' && pathname === '/api/topic/quiz/generate') {
    const body = await parseBody(req);
    const moduleName = String(body.moduleName || '').trim();
    const topicName = String(body.topicName || '').trim();
    const questionCount = clamp(Number(body.questionCount || 5), 3, 10);

    if (!moduleName || !topicName) return send(res, 400, { error: 'moduleName and topicName are required' });

    const documents = await listTopicDocuments(user.id, moduleName, topicName, data);
    if (!documents.length) {
      return send(res, 400, {
        error: 'Upload at least one document for this topic before generating a quiz.',
      });
    }

    const docsWithText = documents.filter((doc) => String(doc.extractedText || '').trim().length > 0);
    if (!docsWithText.length) {
      return send(res, 400, {
        error: 'No extractable text found in uploaded files. Upload text-like files (.txt, .md, .csv, code, etc.) for quiz generation.',
      });
    }

    const mod = moduleState(data, moduleName);
    const topic = topicState(mod, topicName);
    applyDailyMasteryDecay(topic, moduleName, data, nowIso());
    const masteryPct = masteryToPercent(topic.estimatedMasteryNow ?? topic.mastery);
    const decayRatePct = aiRetentionDecayRatePercent(topic, moduleName, data, nowIso());
    const difficultyPlan = buildAdaptiveDifficultyPlan(masteryPct, masteryPct, decayRatePct);

    const built = await buildAiQuiz(moduleName, topicName, docsWithText, questionCount, difficultyPlan);

    const quiz = await createTopicQuiz(
      user.id,
      {
        moduleName,
        topicName,
        title: built.title,
        questions: built.questions,
        sourceDocumentIds: docsWithText.map((doc) => doc.id),
        difficultyPlan: built.difficultyPlan || difficultyPlan,
      },
      data,
    );

    if (!SUPABASE_ENABLED) {
      await saveDataForUser(user.id, data);
    }

    return send(res, 200, {
      ok: true,
      quiz: serializeQuizForClient(quiz, false),
      generator: built.generator,
      sourceDocumentCount: docsWithText.length,
      aiEnabled: Boolean(OPENAI_API_KEY),
      difficultyPlan: built.difficultyPlan || difficultyPlan,
    });
  }

  if (req.method === 'POST' && pathname === '/api/topic/quiz/submit') {
    const body = await parseBody(req);
    const quizId = String(body.quizId || '').trim();
    const answers = Array.isArray(body.answers) ? body.answers.map((x) => Number(x)) : [];

    if (!quizId) return send(res, 400, { error: 'quizId is required' });

    const quiz = await getQuizById(user.id, quizId, data);
    if (!quiz) return send(res, 404, { error: 'Quiz not found' });

    const evaluated = evaluateQuiz(quiz, answers);
    const percent = evaluated.total ? Math.round((evaluated.score / evaluated.total) * 100) : 0;

    const relatedAttempts = data.quizAttempts
      .filter((x) => x.moduleName === quiz.moduleName && x.topicName === quiz.topicName)
      .slice(-5);
    const inferredPreScore = relatedAttempts.length
      ? relatedAttempts.reduce((sum, item) => sum + Number(item.postScore || 0), 0) / relatedAttempts.length
      : masteryToPercent(topicState(moduleState(data, quiz.moduleName), quiz.topicName).mastery);

    const masteryResult = applyMasteryUpdateFromQuiz(
      data,
      quiz.moduleName,
      quiz.topicName,
      inferredPreScore,
      percent,
      {
        source: 'topic_quiz_submit',
        confidence: 4,
        aiUsed: Boolean(OPENAI_API_KEY),
      },
    );

    data.quizAttempts.push({
      id: randomId('quiz'),
      moduleName: quiz.moduleName,
      topicName: quiz.topicName,
      preScore: masteryResult.boundedPre,
      postScore: masteryResult.boundedPost,
      confidence: masteryResult.boundedConfidence,
      aiUsed: masteryResult.aiUsed,
      submittedAt: nowIso(),
      difficultySuggestion: masteryResult.difficultyPlan.difficulty,
      nextQuizType: masteryResult.newMasteryPct < 65 ? 'targeted-remediation' : 'spaced-repetition',
      targetMasteryPct: masteryResult.difficultyPlan.targetMasteryPct,
      targetPostScore: masteryResult.difficultyPlan.targetPostScore,
      gainPct: masteryResult.gainPct,
      decayRatePct: masteryResult.decayRatePct,
    });

    recomputeModuleScores(data, quiz.moduleName);

    const attempt = await saveQuizAttempt(
      user.id,
      {
        quizId,
        moduleName: quiz.moduleName,
        topicName: quiz.topicName,
        score: evaluated.score,
        total: evaluated.total,
        answers,
        resultBreakdown: evaluated.results,
      },
      data,
    );

    await saveDataForUser(user.id, data);

    return send(res, 200, {
      ok: true,
      attempt: {
        id: attempt.id,
        quizId,
        score: evaluated.score,
        total: evaluated.total,
        percent,
        submittedAt: attempt.submittedAt,
      },
      review: evaluated.results,
      masteryUpdate: {
        oldMastery: masteryResult.oldMastery,
        newMastery: masteryResult.newMastery,
        oldMasteryPct: masteryResult.oldMasteryPct,
        newMasteryPct: masteryResult.newMasteryPct,
        gain: masteryResult.gain,
        gainPct: masteryResult.gainPct,
        decay: masteryResult.decay,
        decayRatePct: masteryResult.decayRatePct,
        difficultyPlan: masteryResult.difficultyPlan,
      },
    });
  }

  if (req.method === 'GET' && pathname === '/api/topic/quizzes') {
    const moduleName = String(parsedUrl.searchParams.get('moduleName') || '').trim();
    const topicName = String(parsedUrl.searchParams.get('topicName') || '').trim();
    if (!moduleName || !topicName) return send(res, 400, { error: 'moduleName and topicName query params are required' });

    const quizzes = await listTopicQuizzes(user.id, moduleName, topicName, data);
    return send(res, 200, {
      quizzes: quizzes.map((quiz) => serializeQuizForClient(quiz, false)),
    });
  }

  if (req.method === 'POST' && pathname === '/api/quiz/submit') {
    const body = await parseBody(req);
    const { moduleName, topicName, preScore, postScore } = body;
    if (!moduleName || !topicName) return send(res, 400, { error: 'moduleName and topicName are required' });

    const pre = Number(preScore);
    const post = Number(postScore);
    if (!Number.isFinite(pre) || !Number.isFinite(post)) {
      return send(res, 400, { error: 'preScore and postScore are required numbers' });
    }
    const boundedPre = clamp(pre, 0, 100);
    const boundedPost = clamp(post, 0, 100);
    const boundedConfidence = 3;
    const aiUsed = false;

    const masteryResult = applyMasteryUpdateFromQuiz(
      data,
      moduleName,
      topicName,
      boundedPre,
      boundedPost,
      {
        confidence: boundedConfidence,
        aiUsed,
        source: 'quiz_submit',
      },
    );

    const attempt = {
      id: randomId('quiz'),
      moduleName,
      topicName,
      preScore: masteryResult.boundedPre,
      postScore: masteryResult.boundedPost,
      confidence: boundedConfidence,
      aiUsed: Boolean(aiUsed),
      submittedAt: nowIso(),
      difficultySuggestion: masteryResult.difficultyPlan.difficulty,
      targetMasteryPct: masteryResult.difficultyPlan.targetMasteryPct,
      targetPostScore: masteryResult.difficultyPlan.targetPostScore,
      nextQuizType: masteryResult.newMasteryPct < 65 ? 'targeted-remediation' : 'spaced-repetition',
      gainPct: masteryResult.gainPct,
      decayRatePct: masteryResult.decayRatePct,
    };

    data.quizAttempts.push(attempt);
    recomputeModuleScores(data, moduleName);
    await saveDataForUser(user.id, data);

    return send(res, 200, {
      ok: true,
      attempt,
      masteryUpdate: {
        oldMastery: masteryResult.oldMastery,
        newMastery: masteryResult.newMastery,
        oldMasteryPct: masteryResult.oldMasteryPct,
        newMasteryPct: masteryResult.newMasteryPct,
        gain: masteryResult.gain,
        gainPct: masteryResult.gainPct,
        decay: masteryResult.decay,
        decayRatePct: masteryResult.decayRatePct,
        difficultyPlan: masteryResult.difficultyPlan,
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
      totalTopics: topicsTested.length,
      topicsCovered: topicsTested.length,
      topicsTested,
      updatedAt: nowIso(),
    };
    data.examPlans[body.moduleName].topicsCovered = clamp(
      data.examPlans[body.moduleName].topicsCovered,
      0,
      Math.max(0, data.examPlans[body.moduleName].totalTopics),
    );
    await saveDataForUser(user.id, data);
    return send(res, 200, { ok: true, readiness: readinessScore(body.moduleName, data) });
  }

  if (req.method === 'POST' && pathname === '/api/topic/upload') {
    const multipart = await parseMultipart(req);
    const moduleName = String(multipart.fields.moduleName || '').trim();
    const topicName = String(multipart.fields.topicName || '').trim();
    if (!moduleName || !topicName) return send(res, 400, { error: 'moduleName and topicName are required' });
    const mod = moduleState(data, moduleName);
    const topic = topicState(mod, topicName);
    const uploadFiles = multipart.files.filter((f) => f.fieldName === 'files' && f.filename);
    if (!uploadFiles.length) return send(res, 400, { error: 'No files received' });

    const moduleDir = safePathPart(moduleName);
    const topicDir = safePathPart(topicName);
    const targetDir = path.join(UPLOADS_DIR, moduleDir, topicDir);
    fs.mkdirSync(targetDir, { recursive: true });

    const uploadedAt = nowIso();
    const docs = uploadFiles.map((file, idx) => {
      const uniqueId = `doc_${Date.now()}_${idx}`;
      const safeName = file.filename.replace(/[^\w.\-() ]/g, '_');
      const storedName = `${uniqueId}_${safeName}`;
      const diskPath = path.join(targetDir, storedName);
      fs.writeFileSync(diskPath, file.buffer);
      return {
        id: uniqueId,
        name: file.filename,
        path: `/uploads/${moduleDir}/${topicDir}/${storedName}`,
        uploadedAt,
      };
    });

    topic.documents = Array.isArray(topic.documents) ? topic.documents.concat(docs) : docs;
    topic.lastInteractionAt = uploadedAt;
    recomputeModuleScores(data, moduleName);
    await saveDataForUser(user.id, data);
    return send(res, 200, { ok: true, documents: docs });
  }

  if (req.method === 'GET' && pathname === '/api/readiness') {
    for (const moduleName of Object.keys(data.modules)) recomputeModuleScores(data, moduleName);
    await saveDataForUser(user.id, data);
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
  if (pathname.startsWith('/uploads/')) {
    const uploadPath = path.normalize(path.join(UPLOADS_DIR, pathname.slice('/uploads/'.length)));
    const uploadRoot = path.normalize(UPLOADS_DIR);
    if (!uploadPath.startsWith(uploadRoot)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(uploadPath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(uploadPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(content);
    });
    return;
  }

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
      return await apiHandler(req, res, parsed);
    }

    return staticHandler(req, res, pathname);
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err instanceof Error ? err.message : 'Internal server error' });
  }
});

server.listen(PORT, HOST, () => {
  ensureLocalDataFile();
  if (SUPABASE_ENABLED) {
    console.log('Supabase mode enabled. State and quiz/file persistence use Postgres + Storage.');
  } else {
    console.log('Supabase mode disabled. Using local file storage only.');
  }
  console.log(`Server running at http://${HOST}:${PORT}`);
});
