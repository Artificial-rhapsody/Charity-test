var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}
__name(jsonResponse, "jsonResponse");
function handleCORS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
__name(handleCORS, "handleCORS");
function base64UrlEncode(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
__name(base64UrlDecode, "base64UrlDecode");
async function getSigningKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
__name(getSigningKey, "getSigningKey");
async function createJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await getSigningKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(sig)}`;
}
__name(createJWT, "createJWT");
async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const enc = new TextEncoder();
    const key = await getSigningKey(secret);
    const signingInput = `${headerB64}.${payloadB64}`;
    const sig = base64UrlDecode(sigB64);
    const valid = await crypto.subtle.verify("HMAC", key, sig, enc.encode(signingInput));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) return null;
    return payload;
  } catch {
    return null;
  }
}
__name(verifyJWT, "verifyJWT");
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 1e5, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return base64UrlEncode(hash);
}
__name(hashPassword, "hashPassword");
async function generateSalt() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}
__name(generateSalt, "generateSalt");
async function getUser(kv, email) {
  const raw = await kv.get(`user:${email}`);
  return raw ? JSON.parse(raw) : null;
}
__name(getUser, "getUser");
async function saveUser(kv, user) {
  await kv.put(`user:${user.email}`, JSON.stringify(user));
}
__name(saveUser, "saveUser");
async function handleRegister(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }
  const { name, email, password, phone, age, role: volunteerRole, message } = body;
  if (!name || !email || !password) {
    return jsonResponse({ ok: false, error: "Name, email and password are required" }, 400);
  }
  if (password.length < 6) {
    return jsonResponse({ ok: false, error: "Password must be at least 6 characters" }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: "Invalid email format" }, 400);
  }
  const existing = await getUser(env.USERS_KV, email);
  if (existing) {
    return jsonResponse({ ok: false, error: "This email is already registered" }, 409);
  }
  const salt = await generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const user = {
    name,
    email,
    passwordHash,
    salt,
    role: "user",
    // 'user' | 'admin'
    phone: phone || "",
    age: age || null,
    volunteerRole: volunteerRole || "",
    message: message || "",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await saveUser(env.USERS_KV, user);
  return jsonResponse({ ok: true, message: "Registration successful" }, 201);
}
__name(handleRegister, "handleRegister");
async function handleLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }
  const { email, password } = body;
  if (!email || !password) {
    return jsonResponse({ ok: false, error: "Email and password are required" }, 400);
  }
  const user = await getUser(env.USERS_KV, email);
  if (!user) {
    return jsonResponse({ ok: false, error: "Invalid email or password" }, 401);
  }
  const attemptHash = await hashPassword(password, user.salt);
  if (attemptHash !== user.passwordHash) {
    return jsonResponse({ ok: false, error: "Invalid email or password" }, 401);
  }
  const now = Math.floor(Date.now() / 1e3);
  const payload = {
    sub: user.email,
    name: user.name,
    role: user.role,
    iat: now,
    exp: now + 7 * 24 * 60 * 60
  };
  const token = await createJWT(payload, env.JWT_SECRET);
  return jsonResponse({
    ok: true,
    token,
    user: {
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
}
__name(handleLogin, "handleLogin");
async function handleMe(request, env) {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "Authorization header required" }, 401);
  }
  const token = auth.slice(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return jsonResponse({ ok: false, error: "Invalid or expired token" }, 401);
  }
  const user = await getUser(env.USERS_KV, payload.sub);
  if (!user) {
    return jsonResponse({ ok: false, error: "User not found" }, 404);
  }
  return jsonResponse({
    ok: true,
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
      volunteerRole: user.volunteerRole,
      createdAt: user.createdAt
    }
  });
}
__name(handleMe, "handleMe");
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;
    if (method === "OPTIONS") {
      return handleCORS();
    }
    if (pathname === "/api/register" && method === "POST") {
      return handleRegister(request, env);
    }
    if (pathname === "/api/login" && method === "POST") {
      return handleLogin(request, env);
    }
    if (pathname === "/api/me" && method === "GET") {
      return handleMe(request, env);
    }
    if (pathname === "/" || pathname === "/api") {
      return jsonResponse({ ok: true, service: "CyberShield API", version: "1.0.0" });
    }
    return jsonResponse({ ok: false, error: "Not found" }, 404);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-PsZJBT/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-PsZJBT/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
