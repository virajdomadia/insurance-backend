# Auth API Contract

## Overview

This document describes the authentication and authorization API for the Insurance/NGO backend. The system uses JWT access tokens (short-lived) and HttpOnly refresh token cookies for secure, stateless auth.

**Base URL**: `http://localhost:5000` (dev) or your production URL

---

## Key Concepts

### Access Token
- **Type**: JWT (Bearer token)
- **Lifetime**: 15 minutes (configurable via `ACCESS_TOKEN_EXPIRES` env)
- **Location**: Request header (`Authorization: Bearer <token>`)
- **Payload**: `{ sub: userId, role: userRole }`
- **Usage**: Include in every authenticated request

### Refresh Token
- **Type**: Random hex string (64 bytes)
- **Lifetime**: 14 days (configurable in seed)
- **Location**: HttpOnly, Secure cookie (automatic)
- **Security**: Cannot be accessed by JavaScript; only sent with credentials
- **Usage**: Used to get a new access token when current one expires

### User Roles
- **CITIZEN**: Default role for all public signups
- **NGO**: Assigned only by ADMIN via API
- **ADMIN**: Never public; seeded only

---

## Endpoints

### 1. Register
Create a new user account (always as CITIZEN role).

```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "MyPassword123!"
}
```

**Request Validation**:
- `email` must be valid email format
- `password` must be at least 8 characters
- `role` field is NOT accepted; will be stripped by validation

**Success Response** (201):
```json
{
  "id": "uuid-here",
  "email": "user@example.com",
  "role": "CITIZEN",
  "isActive": true,
  "createdAt": "2025-12-28T14:00:00Z"
}
```

**Error Responses**:
- `400 Bad Request`: Validation failed (invalid email, short password, unknown fields)
- `403 Forbidden`: Email already registered

**Frontend Usage**:
```typescript
const response = await fetch('/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'MyPassword123!'
  })
});
const user = await response.json();
console.log(user); // { id, email, role: 'CITIZEN', ... }
```

---

### 2. Login
Authenticate and receive an access token + refresh token.

```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "MyPassword123!"
}
```

**Request Validation**:
- `email` must be valid email format
- `password` must be at least 8 characters

**Success Response** (200):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Cookies Set**:
- `refreshToken`: HttpOnly, Secure, SameSite=Lax cookie (auto-managed by browser)

**Error Responses**:
- `400 Bad Request`: Validation failed
- `401 Unauthorized`: Invalid email or password
- `403 Forbidden`: User is deactivated

**Frontend Usage**:
```typescript
const response = await fetch('/auth/login', {
  method: 'POST',
  credentials: 'include', // CRITICAL: include cookies
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'MyPassword123!'
  })
});

const data = await response.json();
const accessToken = data.accessToken;

// Store access token in memory (NOT localStorage)
sessionStorage.setItem('accessToken', accessToken);
// Refresh token is automatically in HttpOnly cookie
```

**⚠️ IMPORTANT Security Notes**:
- Always use `credentials: 'include'` when making requests to enable cookie sending
- Store access token in **sessionStorage** or memory only (NOT localStorage)
- Never access the refresh token from JavaScript (it's HttpOnly)
- Never send tokens in query parameters

---

### 3. Refresh
Get a new access token using the refresh token cookie.

```
POST /auth/refresh
```

**Request**:
- No body required
- Refresh token is auto-sent via cookie (must use `credentials: 'include'`)

**Success Response** (200):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses**:
- `401 Unauthorized`: No refresh token, invalid, or expired
- `401 Unauthorized`: User not found or deactivated

**Frontend Usage** (Recommended: Auto-refresh on 401):
```typescript
// Helper: Make an authenticated request with auto-refresh
async function authenticatedFetch(url, options = {}) {
  let token = sessionStorage.getItem('accessToken');

  let response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });

  // If access token expired (401), refresh and retry
  if (response.status === 401) {
    const refreshResponse = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });

    if (refreshResponse.ok) {
      const data = await refreshResponse.json();
      token = data.accessToken;
      sessionStorage.setItem('accessToken', token);

      // Retry original request with new token
      response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`
        }
      });
    } else {
      // Refresh failed; redirect to login
      window.location.href = '/login';
      return null;
    }
  }

  return response;
}

// Usage
const response = await authenticatedFetch('/api/protected-route');
const data = await response.json();
```

---

### 4. Logout
Invalidate the refresh token and clear the cookie.

```
POST /auth/logout
Authorization: Bearer <access_token>
```

**Request**:
- Must be authenticated (access token required)
- No body

**Success Response** (200):
```json
{
  "ok": true
}
```

**Error Responses**:
- `401 Unauthorized`: No valid access token

**Frontend Usage**:
```typescript
async function logout() {
  const token = sessionStorage.getItem('accessToken');
  const response = await fetch('/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  // Clear local storage
  sessionStorage.removeItem('accessToken');

  // Redirect to login
  window.location.href = '/login';
}
```

---

## Protected Routes (Role-Based Access)

### Headers Required
All authenticated endpoints require:
```
Authorization: Bearer <access_token>
```

Example:
```typescript
const response = await fetch('/api/protected', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`
  }
});
```

### Role Examples (Admin APIs)

#### List All Users (ADMIN only)
```
GET /admin/users
Authorization: Bearer <admin_access_token>
```

**Success Response** (200):
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "role": "CITIZEN",
    "isActive": true,
    "createdAt": "2025-12-28T14:00:00Z"
  }
]
```

**Error Responses**:
- `401 Unauthorized`: No token or token expired
- `403 Forbidden`: User is not ADMIN

#### Assign NGO Role (ADMIN only)
```
POST /admin/assign-ngo
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "userId": "target-user-uuid"
}
```

**Success Response** (200):
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "NGO",
  "isActive": true,
  "createdAt": "2025-12-28T14:00:00Z"
}
```

**Error Responses**:
- `401 Unauthorized`: No token or expired
- `403 Forbidden`: Not ADMIN
- `404 Not Found`: User not found

#### Activate/Deactivate User (ADMIN only)
```
POST /admin/activate
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "userId": "target-user-uuid",
  "isActive": false
}
```

**Success Response** (200):
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "CITIZEN",
  "isActive": false,
  "createdAt": "2025-12-28T14:00:00Z"
}
```

---

## Error Handling

All errors follow this format:

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

or (validation errors):

```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "password must be longer than or equal to 8 characters"
  ],
  "error": "Bad Request"
}
```

**Common Status Codes**:
- `200`: Success
- `201`: Created (register)
- `400`: Validation or bad request
- `401`: Unauthorized (invalid creds, expired token, no token)
- `403`: Forbidden (insufficient role, deactivated user)
- `404`: Not found
- `500`: Server error

**Frontend Error Handling**:
```typescript
async function apiCall(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    // Handle validation errors
    if (response.status === 400 && Array.isArray(data.message)) {
      throw new Error(data.message.join(', '));
    }
    // Handle auth errors
    if (response.status === 401) {
      sessionStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    // Handle role/permission errors
    if (response.status === 403) {
      throw new Error(data.message || 'Access denied');
    }
    throw new Error(data.message || 'Unknown error');
  }

  return data;
}
```

---

## Security Guidelines

### DO
✅ Use `credentials: 'include'` on all requests (enables cookie sending)
✅ Store access token in **sessionStorage** or memory only
✅ Include `Authorization: Bearer <token>` header for protected routes
✅ Auto-refresh access token on 401 response
✅ Clear sessionStorage on logout
✅ Use HTTPS in production (required for Secure cookies)
✅ Implement password strength requirements frontend-side for UX

### DON'T
❌ Store refresh token in localStorage or sessionStorage (it's in HttpOnly cookie)
❌ Store access token in localStorage (vulnerable to XSS)
❌ Send tokens in query parameters
❌ Accept or send `role` from/to the frontend (backend assigns it)
❌ Trust role from JWT payload alone—verify server-side
❌ Log tokens or sensitive data in console
❌ Disable `credentials: 'include'` (breaks cookie-based refresh)

---

## Example Integration (React)

```typescript
import { useState, useEffect } from 'react';

// Authentication context
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('accessToken'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const register = async (email, password) => {
    setLoading(true);
    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) throw new Error('Registration failed');
      return await res.json();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        credentials: 'include', // CRITICAL
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) throw new Error('Login failed');
      const { accessToken } = await res.json();
      sessionStorage.setItem('accessToken', accessToken);
      setToken(accessToken);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).catch(() => {});
    sessionStorage.removeItem('accessToken');
    setToken(null);
  };

  const refresh = async () => {
    try {
      const res = await fetch('/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        const { accessToken } = await res.json();
        sessionStorage.setItem('accessToken', accessToken);
        setToken(accessToken);
      } else {
        throw new Error('Refresh failed');
      }
    } catch (err) {
      sessionStorage.removeItem('accessToken');
      setToken(null);
    }
  };

  // Setup token refresh interval (optional but recommended)
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => refresh(), 14 * 60 * 1000); // Refresh every 14 min
    return () => clearInterval(timer);
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Protected route component
export function ProtectedRoute({ children, requiredRole }) {
  const { token, user } = useAuth();

  if (!token) return <Navigate to="/login" />;
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
}
```

---

## Curl Examples

### Register
```bash
curl -X POST http://localhost:5000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "password": "Password123!"
  }'
```

### Login (save token and cookies)
```bash
curl -X POST http://localhost:5000/auth/login \
  -H 'Content-Type: application/json' \
  -c cookies.txt \
  -d '{
    "email": "user@example.com",
    "password": "Password123!"
  }'
# Copy the accessToken from response
export TOKEN="<token_from_response>"
```

### Refresh
```bash
curl -X POST http://localhost:5000/auth/refresh \
  -b cookies.txt
```

### Logout
```bash
curl -X POST http://localhost:5000/auth/logout \
  -H "Authorization: Bearer $TOKEN" \
  -b cookies.txt
```

### Access Protected Route (e.g., list users as admin)
```bash
curl -X GET http://localhost:5000/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -b cookies.txt
```

---

## Environment Variables (Backend)

Frontend developers should know these affect the API:

| Variable | Default | Effect |
|----------|---------|--------|
| `JWT_SECRET` | `'change_this_secret'` | Secret used to sign JWTs |
| `ACCESS_TOKEN_EXPIRES` | `'15m'` | Access token lifetime |
| `NODE_ENV` | `'development'` | If `'production'`, cookies use `Secure` flag |
| `DATABASE_URL` | (required) | PostgreSQL connection string |

---

## Support & Questions

- **Invalid token**: Access token expired → call `/auth/refresh` → retry
- **403 Forbidden**: Insufficient role → check user role from JWT payload (for UI only) but verify server-side; admin must assign roles via `/admin/assign-ngo`
- **CORS issues**: Ensure backend enables CORS with `credentials: 'include'` support
- **Cookies not persisting**: Check browser privacy settings; ensure domain matches; verify `credentials: 'include'` used

---

## Changelog

- **v1.0** (2025-12-28): Initial release
  - Email + password registration
  - JWT access tokens (15m)
  - HttpOnly refresh tokens (14d)
  - RBAC (CITIZEN, NGO, ADMIN)
  - Admin APIs for role assignment and user management
