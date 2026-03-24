# Authentication System

> **Backend:** `backend/src/controllers/authController.js`, `backend/src/utils/jwt.js`, `backend/src/middlewares/auth.js`
> **Frontend:** `frontend/src/utils/authApi.js`, `frontend/src/utils/auth.js`

---

## Token Architecture

| Token | Type | Lifetime | Storage |
|-------|------|----------|---------|
| Access Token | JWT | 15 minutes (`JWT_EXPIRES_IN`) | HttpOnly cookie `access_token` |
| Refresh Token | Random 64-byte hex | 90 days (`JWT_REFRESH_EXPIRES_IN`) | HttpOnly cookie `refresh_token` |
| CSRF Token | Random string | Session | Cookie `csrf_token` + header `X-CSRF-Token` |

### Access Token Payload (JWT)

```json
{
  "sub": 3,           // user_id
  "org": 1,           // organization_id
  "role_id": 2,       // numeric role ID (FK to roles table)
  "role": "admin",    // role_key string ("owner", "admin", "moderator", "user")
  "name": "John",     // user name
  "email": "john@example.com",
  "iat": 1710576000,
  "exp": 1710576900   // 15 min later
}
```

---

## Login Flow

```
Frontend                              Backend
   │                                     │
   ├── POST /auth/login                  │
   │   { email, password }               │
   │──────────────────────────────────>  │
   │                                     ├── Find user by email
   │                                     ├── Verify password (bcrypt)
   │                                     ├── Check org membership + status
   │                                     ├── signAccessToken({ sub, org, role, name })
   │                                     ├── generateRefreshToken()
   │                                     ├── hashToken(refreshToken) → store in user_sessions
   │                                     ├── Log activity (IP, device, geo)
   │                                     ├── setAuthCookies(res, accessToken, refreshToken)
   │                                     │   ├── Set access_token cookie (HttpOnly, 15m)
   │                                     │   ├── Set refresh_token cookie (HttpOnly, 90d)
   │                                     │   └── Set csrf_token cookie
   │                                     └── Return user profile
   │  <──────────────────────────────────│
   │  { user: { id, name, email, ... } } │
   │                                     │
   ├── Store user in auth store          │
   ├── Navigate to /app                  │
   └── SocketContext auto-connects       │
       (reads access_token from cookie)  │
```

---

## Token Refresh Flow

```
Frontend (fetchWithAuth)                  Backend
   │                                        │
   ├── API call fails with 401              │
   │                                        │
   ├── POST /auth/refresh                   │
   │   (refresh_token sent via cookie)      │
   │──────────────────────────────────────> │
   │                                        ├── Read refresh_token from cookie
   │                                        ├── hashToken(refresh_token)
   │                                        ├── Find matching session in user_sessions
   │                                        ├── Check not expired
   │                                        ├── Grace period: REFRESH_REUSE_GRACE_SECONDS (5s)
   │                                        │   └── Allows reuse within 5s window
   │                                        ├── Generate new access + refresh tokens
   │                                        ├── Update session with new hash
   │                                        ├── setAuthCookies() with new tokens
   │                                        └── Return success
   │  <────────────────────────────────────│
   │                                        │
   ├── Retry original API call              │
   │   (new access_token in cookie)         │
   └── Continue normally                    │
```

### fetchWithAuth (Frontend)

```javascript
// frontend/src/utils/authApi.js
fetchWithAuth(url, options)
  ├── Add CSRF token to headers
  ├── Call fetch with credentials: "include"
  ├── If 401 response:
  │   ├── Call refreshAccessToken()
  │   │   └── POST /auth/refresh (cookie-based)
  │   └── Retry original request
  └── Return response
```

---

## Socket Authentication

```
Frontend connects socket:
  io(url, { auth: { token: accessToken }, withCredentials: true })

Backend authenticateSocket middleware:
  1. Try socket.handshake.auth.token
  2. Try socket.handshake.headers.authorization (Bearer)
  3. Try access_token cookie from socket.handshake.headers.cookie
  4. jwt.verify(token, JWT_SECRET)
  5. socket.user = payload  // { sub, org, email, role_id, role, name }
```

The `role` field is a string key (e.g. `"owner"`, `"admin"`) used for org control permission checks. The helper `getRoleKey()` handles both formats — if given a string it returns it directly, if given a numeric ID it maps it to the corresponding key.

---

## Registration Flow

```
1. POST /auth/register
   { name, email, password, organization_name }

2. Backend:
   ├── Validate input
   ├── Check email not taken
   ├── Hash password (bcrypt)
   ├── Create user record
   ├── Create organization
   ├── Create organization_member (role_id = 1, owner)
   ├── Generate OTP
   ├── Send OTP via email
   └── Return { message: "OTP sent" }

3. POST /auth/verify-otp
   { email, otp }

4. Backend:
   ├── Verify OTP matches + not expired
   ├── Activate user account
   ├── Generate tokens
   ├── Set auth cookies
   └── Return user profile
```

---

## Password Reset Flow

```
1. POST /auth/forgot-password
   { email }
   → Sends OTP via email

2. POST /auth/forgot-verify
   { email, otp }
   → Verifies OTP, returns temporary reset token

3. POST /auth/reset-password
   { email, otp, newPassword }
   → Updates password hash, invalidates all sessions
```

---

## Logout Flow

```
POST /auth/logout
   │
   ▼ Backend:
   ├── Read refresh_token from cookie
   ├── Delete session from user_sessions
   ├── clearAuthCookies(res)
   │   ├── Clear access_token cookie
   │   ├── Clear refresh_token cookie
   │   └── Clear csrf_token cookie
   └── disconnectUser(userId) via socket
       └── Force disconnect all socket tabs

POST /auth/logout-all
   └── Delete ALL sessions for user
       └── All devices/tabs get disconnected
```

---

## Middleware Chain

```
Request → auth.js → csrf.js → requireOwner/blockRole4 → Controller

auth.js:
  ├── Read token from Authorization header or access_token cookie
  ├── jwt.verify(token, JWT_SECRET)
  ├── req.user = payload  // { sub, org, role, name }
  └── next()

csrf.js:
  ├── Skip for safe methods (GET, HEAD, OPTIONS)
  ├── Skip for public routes (/auth/login, /auth/register, ...)
  ├── Skip for PUBLIC_MUTATION_ROUTES:
  │     /upload/chat-file, /upload/profile-picture
  │     (JWT Bearer auth is sufficient; no CSRF token needed)
  ├── Compare X-CSRF-Token header with csrf_token cookie
  └── 403 if mismatch

requireOwner.js:
  └── req.user.role === 1 ? next() : 403

blockRole4 (requireNotRoleId.js):
  └── req.user.role !== 4 ? next() : 403
```

---

## Cookie Configuration

```javascript
{
  httpOnly: true,           // Not accessible via JavaScript
  secure: auto,             // HTTPS in production (COOKIE_SECURE)
  sameSite: "lax",          // COOKIE_SAME_SITE
  domain: "",               // COOKIE_DOMAIN (empty = current host)
  path: "/",
  maxAge: 15 * 60 * 1000,  // access_token: 15 minutes
  // or
  maxAge: 90 * 24 * 60 * 60 * 1000  // refresh_token: 90 days
}
```

### Body Token Mode

When `AUTH_RETURN_TOKENS_IN_BODY=true`:
- Tokens returned in JSON response body instead of cookies
- Useful for mobile apps or non-browser clients

---

## Device/Session Tracking

```
user_sessions table:
  ├── session_id (PK)
  ├── user_id (FK)
  ├── organization_id
  ├── refresh_token_hash  (SHA256 of refresh token)
  ├── device_name
  ├── ip_address
  ├── user_agent
  ├── expires_at
  ├── last_used_at
  └── created_at

user_devices table:
  ├── device_id (PK)
  ├── user_id (FK)
  ├── device_name
  ├── hostname
  ├── os_name
  ├── ip_address
  ├── geo (country, city via geoip)
  ├── trusted (boolean)
  └── last_seen_at
```

### Trusted Devices

```
GET  /auth/trusted-devices        → List all devices
POST /auth/trusted-devices/:id/revoke → Revoke device access
```

---

## Security Measures

1. **Password hashing**: bcryptjs with default salt rounds
2. **Token rotation**: New refresh token on each refresh
3. **Session isolation**: Hashed refresh tokens, per-device sessions
4. **CSRF protection**: Double-submit cookie pattern
5. **Rate limiting**: OTP resend cooldown (`OTP_RESEND_COOLDOWN_SECONDS`)
6. **PIN lockout**: Max 5 OTP attempts, then lock (`OTP_LOCK_WINDOW_MINUTES`)
7. **Refresh grace period**: 5s reuse window to handle concurrent requests
8. **Force disconnect**: Socket disconnection on logout
