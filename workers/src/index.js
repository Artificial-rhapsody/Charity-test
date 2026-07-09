/**
 * CyberShield API — Cloudflare Workers
 * 
 * Endpoints:
 *   POST /api/register  — Register a new user (volunteer application)
 *   POST /api/login     — Login, returns JWT
 *   GET  /api/me        — Get current user info (requires JWT)
 * 
 * Data: stored in KV (USERS_KV binding) as JSON
 * Auth: JWT with HMAC-SHA256
 */

// ─── Helpers ────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function handleCORS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ─── Crypto: HMAC-SHA256 JWT ────────────────────────────────

function base64UrlEncode(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getSigningKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function createJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await getSigningKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const enc = new TextEncoder();
    const key = await getSigningKey(secret);
    const signingInput = `${headerB64}.${payloadB64}`;
    const sig = base64UrlDecode(sigB64);
    const valid = await crypto.subtle.verify('HMAC', key, sig, enc.encode(signingInput));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Password hashing (PBKDF2) ─────────────────────────────

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return base64UrlEncode(hash);
}

async function generateSalt() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

// ─── KV-based user store ────────────────────────────────────
// Key: `user:{email}`  Value: JSON { name, email, passwordHash, salt, role, phone, age, volunteerRole, message, createdAt }

async function getUser(kv, email) {
  const raw = await kv.get(`user:${email}`);
  return raw ? JSON.parse(raw) : null;
}

async function saveUser(kv, user) {
  await kv.put(`user:${user.email}`, JSON.stringify(user));
}

// ─── Route handlers ─────────────────────────────────────────

async function handleRegister(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const { name, email, password, phone, age, role: volunteerRole, message } = body;

  // Validate required fields
  if (!name || !email || !password) {
    return jsonResponse({ ok: false, error: 'Name, email and password are required' }, 400);
  }
  if (password.length < 6) {
    return jsonResponse({ ok: false, error: 'Password must be at least 6 characters' }, 400);
  }
  // Simple email check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: 'Invalid email format' }, 400);
  }

  // Check if user already exists
  const existing = await getUser(env.USERS_KV, email);
  if (existing) {
    return jsonResponse({ ok: false, error: 'This email is already registered' }, 409);
  }

  // Hash password
  const salt = await generateSalt();
  const passwordHash = await hashPassword(password, salt);

  // Save user — default role is 'user', admin must be set manually in KV
  const user = {
    name,
    email,
    passwordHash,
    salt,
    role: 'user',          // 'user' | 'admin'
    phone: phone || '',
    age: age || null,
    volunteerRole: volunteerRole || '',
    message: message || '',
    createdAt: new Date().toISOString(),
  };

  await saveUser(env.USERS_KV, user);

  return jsonResponse({ ok: true, message: 'Registration successful' }, 201);
}

async function handleLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const { email, password } = body;
  if (!email || !password) {
    return jsonResponse({ ok: false, error: 'Email and password are required' }, 400);
  }

  const user = await getUser(env.USERS_KV, email);
  if (!user) {
    return jsonResponse({ ok: false, error: 'Invalid email or password' }, 401);
  }

  // Verify password
  const attemptHash = await hashPassword(password, user.salt);
  if (attemptHash !== user.passwordHash) {
    return jsonResponse({ ok: false, error: 'Invalid email or password' }, 401);
  }

  // Issue JWT — 7 day expiry
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.email,
    name: user.name,
    role: user.role,
    iat: now,
    exp: now + 7 * 24 * 60 * 60,
  };

  const token = await createJWT(payload, env.JWT_SECRET);

  return jsonResponse({
    ok: true,
    token,
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}

async function handleMe(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return jsonResponse({ ok: false, error: 'Authorization header required' }, 401);
  }

  const token = auth.slice(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return jsonResponse({ ok: false, error: 'Invalid or expired token' }, 401);
  }

  // Fetch fresh user data from KV
  const user = await getUser(env.USERS_KV, payload.sub);
  if (!user) {
    return jsonResponse({ ok: false, error: 'User not found' }, 404);
  }

  return jsonResponse({
    ok: true,
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
      volunteerRole: user.volunteerRole,
      createdAt: user.createdAt,
    },
  });
}

// ─── Main router ────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return handleCORS();
    }

    // API routes
    if (pathname === '/api/register' && method === 'POST') {
      return handleRegister(request, env);
    }
    if (pathname === '/api/login' && method === 'POST') {
      return handleLogin(request, env);
    }
    if (pathname === '/api/me' && method === 'GET') {
      return handleMe(request, env);
    }

    // Health check
    if (pathname === '/' || pathname === '/api') {
      return jsonResponse({ ok: true, service: 'CyberShield API', version: '1.0.0' });
    }

    // 404
    return jsonResponse({ ok: false, error: 'Not found' }, 404);
  },
};
