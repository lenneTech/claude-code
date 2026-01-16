---
name: story-tdd-security-review
description: Security review checklist for Test-Driven Development - ensures no vulnerabilities are introduced
---

#  Security Review Checklist

## Table of Contents
- [Security Checklist](#security-checklist)
- [Security Decision Tree](#security-decision-tree)
- [Red Flags - STOP and Review](#red-flags---stop-and-review)
- [If ANY Red Flag Found](#if-any-red-flag-found)
- [Remember](#remember)
- [Quick Security Checklist](#quick-security-checklist)

**CRITICAL: Perform security review before final testing!**

**ALWAYS review all code changes for security vulnerabilities before marking complete.**

Security issues can be introduced during implementation without realizing it. A systematic review prevents:
- Unauthorized access to data
- Privilege escalation
- Data leaks
- Injection attacks
- Authentication bypasses

---

## Security Checklist

### 1. Authentication & Authorization

 **Check decorators are NOT weakened:**

```typescript
//  WRONG: Removing security to make tests pass
// OLD:
@Restricted(RoleEnum.ADMIN)
async deleteUser(id: string) { ... }

// NEW (DANGEROUS):
async deleteUser(id: string) { ... }  //  No restriction!

//  CORRECT: Keep or strengthen security
@Restricted(RoleEnum.ADMIN)
async deleteUser(id: string) { ... }
```

 **Verify @Roles decorators:**

```typescript
//  WRONG: Making endpoint too permissive
@Roles(RoleEnum.S_USER)  // Everyone can delete!
async deleteOrder(id: string) { ... }

//  CORRECT: Proper role restriction
@Roles(RoleEnum.ADMIN)  // Only admins can delete
async deleteOrder(id: string) { ... }
```

 **Check ownership verification:**

```typescript
//  WRONG: No ownership check
async updateProfile(userId: string, data: UpdateProfileInput, currentUser: User) {
  return this.userService.update(userId, data);  // Any user can update any profile!
}

//  CORRECT: Verify ownership or admin role
async updateProfile(userId: string, data: UpdateProfileInput, currentUser: User) {
  // Check if user is updating their own profile or is admin
  if (userId !== currentUser.id && !currentUser.roles.includes(RoleEnum.ADMIN)) {
    throw new ForbiddenException('Cannot update other users');
  }
  return this.userService.update(userId, data);
}
```

### 2. Input Validation

 **Verify all inputs are validated:**

```typescript
//  WRONG: No validation
async createProduct(input: any) {
  return this.productService.create(input);  // Dangerous!
}

//  CORRECT: Proper DTO with validation
export class CreateProductInput {
  @UnifiedField({
    description: 'Product name',
    isOptional: false,
    mongoose: { type: String, required: true, minlength: 1, maxlength: 100 }
  })
  name: string;

  @UnifiedField({
    description: 'Price',
    isOptional: false,
    mongoose: { type: Number, required: true, min: 0 }
  })
  price: number;
}
```

 **Check for injection vulnerabilities:**

```typescript
//  WRONG: Direct string interpolation in queries
async findByName(name: string) {
  return this.productModel.find({ $where: `this.name === '${name}'` });  // SQL Injection!
}

//  CORRECT: Parameterized queries
async findByName(name: string) {
  return this.productModel.find({ name });  // Safe
}
```

### 3. Data Exposure

 **Verify sensitive data is protected:**

```typescript
//  WRONG: Exposing passwords
export class User {
  @UnifiedField({ description: 'Email' })
  email: string;

  @UnifiedField({ description: 'Password' })
  password: string;  //  Will be exposed in API!
}

//  CORRECT: Hide sensitive fields
export class User {
  @UnifiedField({ description: 'Email' })
  email: string;

  @UnifiedField({
    description: 'Password hash',
    hideField: true,  //  Never expose in API
    mongoose: { type: String, required: true }
  })
  password: string;
}
```

 **Check error messages don't leak data:**

```typescript
//  WRONG: Exposing sensitive info in errors
catch (error) {
  throw new BadRequestException(`Query failed: ${error.message}, SQL: ${query}`);
}

//  CORRECT: Generic error messages
catch (error) {
  this.logger.error(`Query failed: ${error.message}`, error.stack);
  throw new BadRequestException('Invalid request');
}
```

### 4. Authorization in Services

 **Verify service methods check permissions:**

```typescript
//  WRONG: Service doesn't check who can access
async getOrder(orderId: string) {
  return this.orderModel.findById(orderId);  // Anyone can see any order!
}

//  CORRECT: Service checks ownership or role
async getOrder(orderId: string, currentUser: User) {
  const order = await this.orderModel.findById(orderId);

  // Check if user owns the order or is admin
  if (order.customerId !== currentUser.id && !currentUser.roles.includes(RoleEnum.ADMIN)) {
    throw new ForbiddenException('Access denied');
  }

  return order;
}
```

### 5. Security Model Checks

 **Verify checkSecurity methods:**

```typescript
// In model file
async checkSecurity(user: User, mode: SecurityMode): Promise<void> {
  //  WRONG: No security check
  return;

  //  CORRECT: Proper security implementation
  if (mode === SecurityMode.CREATE && !user.roles.includes(RoleEnum.ADMIN)) {
    throw new ForbiddenException('Only admins can create');
  }

  if (mode === SecurityMode.UPDATE && this.createdBy !== user.id && !user.roles.includes(RoleEnum.ADMIN)) {
    throw new ForbiddenException('Can only update own items');
  }
}
```

### 6. Cross-Cutting Concerns

 **Rate limiting for sensitive endpoints:**
- Password reset endpoints
- Authentication endpoints
- Payment processing
- Email sending

 **HTTPS/TLS enforcement (production)**

 **Proper CORS configuration**

 **No hardcoded secrets or API keys**

---

## Security Decision Tree

```
Code changes made?
    │
    ├─► Modified @Restricted or @Roles?
    │   └─►  CRITICAL: Verify this was intentional and justified
    │
    ├─► New endpoint added?
    │   └─►  Ensure proper authentication + authorization decorators
    │
    ├─► Service method modified?
    │   └─►  Verify ownership checks still in place
    │
    ├─► New input/query parameters?
    │   └─►  Ensure validation and sanitization
    │
    └─► Sensitive data accessed?
        └─►  Verify access control and data hiding
```

---

## Red Flags - STOP and Review

🚩 **Authentication/Authorization:**
- @Restricted decorator removed or changed
- @Roles changed to more permissive role
- Endpoints without authentication
- Missing ownership checks

🚩 **Data Security:**
- Sensitive fields not marked with hideField
- Password or token fields exposed
- User data accessible without permission check
- Error messages revealing internal details

🚩 **Input Validation:**
- Missing validation decorators
- Any type used instead of DTO
- Direct use of user input in queries
- No sanitization of string inputs

🚩 **Business Logic:**
- Bypassing security checks "for convenience"
- Commented out authorization code
- Admin-only actions available to regular users
- Price/amount manipulation possible

---

## If ANY Red Flag Found

1. **STOP implementation**
2. **Fix the security issue immediately**
3. **Review surrounding code for similar issues**
4. **Re-run security checklist**
5. **Update tests to verify security works**

---

## Remember

- **Security > Convenience**
- **Better to over-restrict than under-restrict**
- **Always preserve existing security mechanisms**
- **When in doubt, ask the developer**

---

### 7. Error Handling & Logging

 **Secure Error Responses:**

```typescript
//  WRONG: Exposing stack traces and internal details
catch (error) {
  throw new InternalServerErrorException({
    message: error.message,
    stack: error.stack,
    query: queryString,
    dbConnection: this.connectionString
  });
}

//  CORRECT: Generic errors with internal logging
catch (error) {
  this.logger.error('Database query failed', {
    error: error.message,
    stack: error.stack,
    userId: currentUser?.id,
    operation: 'findUser'
  });
  throw new InternalServerErrorException('An error occurred processing your request');
}
```

 **Logging Best Practices:**

```typescript
// DO: Log security-relevant events
this.logger.warn('Failed login attempt', { email, ip, userAgent });
this.logger.info('User role changed', { userId, oldRole, newRole, changedBy });
this.logger.error('Unauthorized access attempt', { userId, resource, ip });

// DON'T: Log sensitive data
this.logger.info('User login', { email, password }); //  NEVER log passwords!
this.logger.debug('Request data', { creditCard, ssn }); //  NEVER log PII!
```

 **Checklist:**
- [ ] No stack traces in production responses
- [ ] Security events logged (login, logout, role changes, access denied)
- [ ] No passwords, tokens, or PII in logs
- [ ] Log levels appropriate (error for failures, warn for suspicious activity)

---

### 8. Cryptographic Practices

 **Password Hashing (bcrypt):**

```typescript
//  WRONG: Plain text or weak hashing
user.password = password;  // Plain text!
user.password = crypto.createHash('md5').update(password).digest('hex');  // MD5 is broken!

//  CORRECT: bcrypt with proper cost factor
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;  // Minimum 10, recommended 12+

async hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

 **Secure Random Generation:**

```typescript
//  WRONG: Math.random() for security purposes
const resetToken = Math.random().toString(36);  // Predictable!

//  CORRECT: Cryptographically secure random
import { randomBytes, randomUUID } from 'crypto';

const resetToken = randomBytes(32).toString('hex');  // 256-bit token
const apiKey = randomUUID();  // UUID v4
```

 **Key Management:**

```typescript
//  WRONG: Hardcoded secrets
const JWT_SECRET = 'my-super-secret-key';

//  CORRECT: Environment variables
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}
```

 **Checklist:**
- [ ] Passwords hashed with bcrypt (cost factor ≥ 10)
- [ ] Cryptographic randomness used for tokens/keys
- [ ] No secrets hardcoded (use environment variables)
- [ ] JWT secrets sufficiently long (≥ 256 bits)

---

### 9. Session & Token Management

 **JWT Best Practices:**

```typescript
//  WRONG: Long-lived access tokens, no refresh
const token = this.jwtService.sign(payload, { expiresIn: '30d' });  // Too long!

//  CORRECT: Short access tokens + refresh tokens
const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
const refreshToken = this.jwtService.sign(
  { userId: user.id, tokenType: 'refresh' },
  { expiresIn: '7d' }
);

// Store refresh token hash in DB for revocation
await this.refreshTokenService.create({
  userId: user.id,
  tokenHash: await bcrypt.hash(refreshToken, 10),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
});
```

 **Token Revocation:**

```typescript
// Implement token blacklist or family rotation
async logout(userId: string): Promise<void> {
  // Invalidate all refresh tokens for user
  await this.refreshTokenService.revokeAllForUser(userId);
}

async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
  const payload = this.jwtService.verify(refreshToken);

  // Check if token is revoked
  const isValid = await this.refreshTokenService.validate(refreshToken);
  if (!isValid) {
    throw new UnauthorizedException('Token has been revoked');
  }

  // Rotate refresh token (issue new one, revoke old)
  return this.issueTokenPair(payload.userId);
}
```

 **Cookie Security (if using cookies):**

```typescript
//  CORRECT: Secure cookie settings
response.cookie('refreshToken', token, {
  httpOnly: true,      // Prevents XSS access
  secure: true,        // HTTPS only
  sameSite: 'strict',  // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
  path: '/auth/refresh'  // Limit scope
});
```

 **Checklist:**
- [ ] Access tokens short-lived (≤ 15 minutes)
- [ ] Refresh token rotation implemented
- [ ] Token revocation mechanism exists (logout, password change)
- [ ] Cookies use httpOnly, secure, sameSite flags
- [ ] No tokens in URL parameters

---

## Quick Security Checklist

Before marking complete:

**Authentication & Authorization:**
- [ ] **@Restricted/@Roles decorators NOT removed or weakened**
- [ ] **Ownership checks in place (users can only access own data)**
- [ ] **checkSecurity methods implemented in models**
- [ ] **Authorization tests pass**

**Input & Data:**
- [ ] **All inputs validated with proper DTOs**
- [ ] **Sensitive fields marked with hideField: true**
- [ ] **No SQL/NoSQL injection vulnerabilities**
- [ ] **No hardcoded secrets or credentials**

**Error Handling & Logging:**
- [ ] **Error messages don't expose sensitive data**
- [ ] **No stack traces in production responses**
- [ ] **Security events logged appropriately**
- [ ] **No passwords/tokens/PII in logs**

**Cryptography & Tokens:**
- [ ] **Passwords hashed with bcrypt (cost ≥ 10)**
- [ ] **Cryptographically secure random for tokens**
- [ ] **JWT access tokens short-lived (≤ 15 min)**
- [ ] **Token revocation mechanism implemented**
