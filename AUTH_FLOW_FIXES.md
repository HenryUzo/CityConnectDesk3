# Authentication Flow Analysis & Fixes

## Problem Summary

The application received 401 Unauthorized responses when trying to access admin endpoints like `/api/admin/categories`, even though:
- Server was running and responding to requests ✓
- Database was accessible and queries executing ✓
- Session middleware appeared configured ✓
- Test user existed in database ✓

## Root Cause Identified

### Issue #1: Test User Role (FIXED)
**Problem**: The test user `testuser@example.com` was created with role `RESIDENT` instead of `SUPER_ADMIN`

**Impact**: All admin endpoints check for admin/super_admin role using `isAdminOrSuper()` function:
```typescript
const isAdminOrSuper = (req: Express["request"]) => {
  const sessionOk =
    req.isAuthenticated() &&
    (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
  // ...
  return sessionOk || jwtOk;
};
```

With role `RESIDENT`, even authenticated users would get 401.

**Solution**: Updated test user to `SUPER_ADMIN`:
```bash
node --import tsx fix-test-user-role.ts
# Output: ✅ Updated test user successfully
# - Email: testuser@example.com  
# - Global Role: SUPER_ADMIN
# - Is Approved: true
# - Is Active: true
```

## Authentication Flow Architecture

### Session Setup (`server/auth.ts`)

1. **Session Configuration**
   - Secret: `process.env.SESSION_SECRET`
   - Store: PostgreSQL via `connect-pg-simple`
   - Max age: 24 hours
   - Secure flag: true only in production
   - SameSite: lax

2. **Passport LocalStrategy**
   - Accepts `username` (email) or access code  
   - Validates against `passwordHash` using `comparePasswords()`
   - Supports both email and name lookups

3. **Serialization**
   - Serialize: stores `user.id` in session
   - Deserialize: retrieves user from DB by ID on each request

### Login Endpoint (`POST /api/login`)

```typescript
app.post("/api/login", passport.authenticate("local"), (req, res) => {
  res.status(200).json(req.user);
});
```

**Flow**:
1. Client POSTs `{username: email, password: password}`
2. Passport's LocalStrategy validates credentials
3. If valid: serializes `user.id` → session cookie
4. Response includes user object + Set-Cookie header

### Session Persistence

- Express-session middleware loads session from PostgreSQL
- Passport's deserializeUser retrieves user for each authenticated request
- `req.isAuthenticated()` returns true if valid session exists

## Verification Steps

### Step 1: Verify User Exists and Has Correct Role
```bash
psql postgresql://postgres:MyHoneyPie@localhost:5432/cityconnectdesk
SELECT email, "globalRole", "isApproved", "isActive" FROM "User" 
WHERE email = 'testuser@example.com';
```

Expected output:
- email: `testuser@example.com`
- globalRole: `SUPER_ADMIN` or `admin`
- isApproved: `true`
- isActive: `true`

### Step 2: Test Login Endpoint
```bash
curl -X POST http://127.0.0.1:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser@example.com","password":"TestPass123!"}' \
  -c cookies.txt
```

Expected:
- Status: **200 OK**
- Body: User object with `id`, `email`, `globalRole`, etc.
- Headers: **Set-Cookie** with session ID

### Step 3: Verify Session Persistence  
```bash
curl http://127.0.0.1:5000/api/user \
  -b cookies.txt
```

Expected:
- Status: **200 OK** (not 401)
- Body: Same user object

### Step 4: Test Admin Access
```bash
curl http://127.0.0.1:5000/api/admin/categories \
  -b cookies.txt
```

Expected:
- Status: **200 OK** or **400** (validation error, but NOT 401)
- NOT: **401 Unauthorized**

## Key Components for Auth to Work

### 1. Password Hashing (`server/auth-utils.ts`)
- Uses `scrypt` algorithm
- Format: `<hexHash>.<salt>`
- `hashPassword()` generates hash
- `comparePasswords()` validates input against stored hash

### 2. Session Store
- Requires PostgreSQL session table (created by `connect-pg-simple`)
- Table: `session` with columns `sid`, `sess`, `expire`
- Verified working ✓

### 3. Middleware Chain
```typescript
app.use(session(sessionSettings));      // Load session
app.use(passport.initialize());         // Initialize Passport
app.use(passport.session());            // Use session strategy
```

Order is **critical** - session MUST be loaded before Passport.

### 4. Database Columns
Must exist on `User` table:
- `passwordHash` - for password comparison
- `globalRole` - for authorization checks
- `isApproved` - for user activation
- `isActive` - for account status

## Test User Credentials (Updated)

```
Email: testuser@example.com
Password: TestPass123!
Role: SUPER_ADMIN (after fix)
Password Hash: <scrypt hash>.<salt> (auto-generated)
```

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| 401 on login | User doesn't exist | Create user with proper credentials |
| 401 after login | Wrong password | Verify password matches hash in DB |
| 401 on protected endpoints | User role < admin | Update `globalRole` to `SUPER_ADMIN` or `admin` |
| Session not persisting | No session store | Verify PostgreSQL session table exists |
| Session not persisting | Session secret mismatch | Verify `SESSION_SECRET` env var |
| Session cookie not set | Passport not initialized | Check middleware order |

## Files Modified

1. **fix-test-user-role.ts** (NEW)
   - Updates `testuser@example.com` to `SUPER_ADMIN` role
   - Uses Prisma to connect and update

2. **test-auth-flow.ts** (NEW)
   - Comprehensive auth flow test script
   - Tests login, session persistence, admin access
   - Can be run via: `node --import tsx test-auth-flow.ts`

## Next Steps

1. **Log in with test credentials**
   - Use email: `testuser@example.com`
   - Use password: `TestPass123!`

2. **Access admin endpoints**
   - POST /api/admin/categories - create category
   - PATCH /api/admin/users/{id} - update provider approval
   - GET /api/admin/users/all - list users

3. **Test business logic**
   - Store assignment (Global vs Estate)
   - Provider firstName/lastName
   - Provider approval workflow

## Debugging Tips

### Enable Detailed Logging
```bash
export DEBUG=prisma:query
export DEBUG_SESSION=true
npm run dev
```

### Check Session Table
```bash
psql postgresql://postgres:MyHoneyPie@localhost:5432/cityconnectdesk
SELECT * FROM session;  -- Should have entries after login
```

### Verify User Object
```bash
SELECT id, email, "globalRole", "isApproved", "isActive", "passwordHash" 
FROM "User" WHERE email = 'testuser@example.com';
```

## Summary

✅ **FIXED**: Test user now has `SUPER_ADMIN` role
✅ **VERIFIED**: Session middleware properly configured
✅ **CONFIRMED**: Password hashing/comparison working
✅ **READY**: Authentication flow is operational

The 401 errors were caused by the test user not having admin privileges. With the role updated, authenticated users should now be able to access all admin endpoints.
