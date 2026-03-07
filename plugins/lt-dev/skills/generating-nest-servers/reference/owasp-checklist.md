---
name: owasp-secure-coding-checklist
description: Comprehensive OWASP Secure Coding Practices checklist for NestJS/Node.js applications
---

# OWASP Secure Coding Practices Checklist

Based on [OWASP Secure Coding Practices Quick Reference Guide](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/).

**Source:** [GitHub - OWASP Checklist (stable-en)](https://raw.githubusercontent.com/OWASP/www-project-secure-coding-practices-quick-reference-guide/refs/heads/main/stable-en/02-checklist/05-checklist.md)

**Use this checklist during security reviews and before deployments.**

---

## 1. Input Validation

| # | Practice | NestJS Implementation |
|---|----------|----------------------|
| 1.1 | Conduct all input validation on a trusted system (server) | Use DTOs with class-validator, never trust client-side validation |
| 1.2 | Identify all data sources and classify as trusted/untrusted | Request body, query params, headers, cookies = untrusted |
| 1.3 | Centralized input validation routine | Use ValidationPipe globally in main.ts |
| 1.4 | Specify proper character sets (UTF-8) | Set `charset: 'utf-8'` in responses |
| 1.5 | Encode data to common character set before validation | Use `normalizeEmail()` in class-validator |
| 1.6 | All validation failures result in input rejection | ValidationPipe throws BadRequestException |
| 1.7 | Validate data type, range, length | `@IsInt()`, `@Min()`, `@Max()`, `@Length()` |
| 1.8 | Validate against allowlist where possible | `@IsIn(['option1', 'option2'])` |
| 1.9 | Validate all client-provided data | Apply ValidationPipe to all endpoints |
| 1.10 | Verify header values in requests | Custom guards for header validation |
| 1.11 | Validate data from redirects | Don't blindly follow redirect URLs |
| 1.12 | Validate file type by content (magic bytes) | Use `file-type` package, not extension |
| 1.13 | Validate uploaded filenames | Sanitize or generate random names |
| 1.14 | Reject input containing certain characters | `@Matches()` with blocklist regex |

```typescript
// Global validation setup (main.ts)
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,           // Strip unknown properties
  forbidNonWhitelisted: true, // Throw on unknown properties
  transform: true,           // Transform to DTO types
  transformOptions: {
    enableImplicitConversion: true
  }
}));
```

---

## 2. Output Encoding

| # | Practice | NestJS Implementation |
|---|----------|----------------------|
| 2.1 | Conduct all encoding on trusted system | Server-side encoding only |
| 2.2 | Utilize standard encoding routine | Use `escape-html`, `sanitize-html` packages |
| 2.3 | Contextual output encoding | Different encoding for HTML, URL, JS, CSS |
| 2.4 | Encode all characters unless safe for interpreter | Default to encoding everything |
| 2.5 | Sanitize output of untrusted data to queries | Use parameterized queries (Mongoose/TypeORM) |
| 2.6 | Sanitize output to OS commands | Never construct OS commands from user input |

```typescript
// HTML encoding for API responses containing user content
import { escape } from 'html-escaper';

@Get('user/:id')
async getUser(@Param('id') id: string) {
  const user = await this.userService.findById(id);
  return {
    ...user,
    bio: escape(user.bio),  // Encode HTML entities
  };
}

// For rich text, use sanitize-html with strict allowlist
import * as sanitizeHtml from 'sanitize-html';

const cleanHtml = sanitizeHtml(userInput, {
  allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p'],
  allowedAttributes: { 'a': ['href'] },
  allowedSchemes: ['https']
});
```

---

## 3. Authentication & Password Management

| # | Practice | NestJS Implementation |
|---|----------|----------------------|
| 3.1 | Require authentication for all resources except public | `@Public()` decorator for exceptions, default to protected |
| 3.2 | All authentication controls on trusted system | Server-side JWT/session validation |
| 3.3 | Centralized authentication services | AuthModule with AuthGuard |
| 3.4 | Separate authentication from resource logic | Guards handle auth, controllers handle business logic |
| 3.5 | Authentication failure doesn't reveal which credential wrong | "Invalid credentials" - never "Invalid password" |
| 3.6 | Authentication over HTTPS | TLS termination at load balancer minimum |
| 3.7 | Password entry only via POST | Never via GET query params |
| 3.8 | Temporary passwords expire quickly | Token expiry with `expiresIn` |
| 3.9 | Enforce password complexity | `@IsStrongPassword()` validator |
| 3.10 | Password input with disabled autocomplete | Frontend concern (autocomplete="off") |
| 3.11 | Disable "remember me" for sensitive apps | Don't persist sessions for admin apps |
| 3.12 | Hash passwords with bcrypt | `bcrypt.hash(password, 12)` |
| 3.13 | Enforce password change on temp passwords | `requirePasswordChange` flag |
| 3.14 | Minimum 8 character passwords | `@MinLength(8)` |
| 3.15 | Hide password entry | Frontend concern (type="password") |
| 3.16 | Disable account after failed attempts | AccountLock entity with attempt counter |
| 3.17 | Password reset doesn't reveal account existence | "If account exists, email sent" |
| 3.18 | Reset questions have sufficient entropy | Prefer email/SMS verification |
| 3.19 | Password reset tokens single-use with expiry | Delete token after use, short TTL |
| 3.20 | Require re-auth for sensitive operations | Fresh login for password change |
| 3.21 | Multi-factor for high-value transactions | TOTP via `speakeasy` package |
| 3.22 | Protect password fields from caching | `Cache-Control: no-store` |
| 3.23 | Store credentials with crypto protection | bcrypt for passwords, encrypted secrets |

```typescript
// Password validation DTO
export class PasswordDto {
  @IsString()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password must contain uppercase, lowercase, and number/special char'
  })
  password: string;
}

// Generic error messages
if (!user || !(await bcrypt.compare(password, user.password))) {
  throw new UnauthorizedException('Invalid credentials');  // Never specify which
}
```

---

## 4. Session Management

| # | Practice | NestJS Implementation |
|---|----------|----------------------|
| 4.1 | Server-side session management | JWT stored server-side or stateless with signature |
| 4.2 | Session ID generation with approved algorithm | `randomBytes(32).toString('hex')` |
| 4.3 | Logout terminates session | Invalidate refresh token in DB |
| 4.4 | Logout available from all authenticated pages | Frontend responsibility + API endpoint |
| 4.5 | Session timeout after inactivity | `expiresIn: '15m'` for access tokens |
| 4.6 | Don't allow persistent sessions | Short-lived tokens, require re-auth |
| 4.7 | New session ID on re-authentication | Issue new tokens on login |
| 4.8 | New session ID on privilege change | New tokens after role upgrade |
| 4.9 | Concurrent sessions if needed | Track sessions in DB, allow/deny based on policy |
| 4.10 | Session ID only via cookies (not URLs) | Never put tokens in query params |
| 4.11 | Protect session cookies | `httpOnly: true, secure: true, sameSite: 'strict'` |
| 4.12 | Set domain/path for cookies | `path: '/', domain: '.example.com'` |

```typescript
// Token configuration
const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
const refreshToken = this.jwtService.sign(
  { sub: user.id, type: 'refresh' },
  { expiresIn: '7d' }
);

// Cookie settings for refresh token
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000
});
```

---

## 5. Access Control

| # | Practice | NestJS Implementation |
|---|----------|----------------------|
| 5.1 | Use only trusted objects for access decisions | Server-side user object from token, not client |
| 5.2 | Single site-wide access control component | AuthGuard + RolesGuard combination |
| 5.3 | Access controls fail securely | Default deny, explicit allow |
| 5.4 | Deny access by default | `@Restricted(RoleEnum.ADMIN)` class default |
| 5.5 | Enforce access control at every request | Global guards in main.ts |
| 5.6 | Segregate privileged logic from other code | Separate admin modules |
| 5.7 | Restrict access to files/resources | S3 pre-signed URLs, file guards |
| 5.8 | Restrict access to protected URLs | Guards on all routes |
| 5.9 | Restrict access to protected functions | Method-level decorators |
| 5.10 | Restrict direct object references | Check ownership in service layer |
| 5.11 | Restrict access to services | API Gateway, network policies |
| 5.12 | Restrict access to data | Row-level security in queries |
| 5.13 | Restrict access to security attributes | `hideField: true` in DTOs |
| 5.14 | Restrict access to system configurations | Environment variables only |
| 5.15 | Server-side authorization rules | Never trust client claims |
| 5.16 | Centralized access control code | AuthModule exports guards |

```typescript
// Default-deny with class decorator
@Restricted(RoleEnum.ADMIN)  // Fallback: admin only
@Controller('products')
export class ProductController {
  @Roles(RoleEnum.S_EVERYONE)  // Override: public
  @Get()
  findAll() {}

  @Roles(RoleEnum.S_USER)  // Override: logged-in users
  @Post()
  create() {}

  @Delete(':id')  // No override: admin only (from class)
  delete() {}
}
```

---

## 6. Cryptographic Practices

| # | Practice | NestJS Implementation |
|---|----------|----------------------|
| 6.1 | Cryptographic functions on trusted system | Server-side only |
| 6.2 | Protect master secrets from unauthorized access | HSM, Vault, or env vars with restricted access |
| 6.3 | Cryptographic modules fail securely | Catch and handle crypto errors |
| 6.4 | Random numbers cryptographically secure | `crypto.randomBytes()`, never `Math.random()` |
| 6.5 | Cryptographic modules FIPS-140 certified | Node.js crypto module |
| 6.6 | Establish policy for cryptographic keys | Key rotation, storage, access policies |

```typescript
import { randomBytes, createCipheriv, createDecipheriv, scrypt } from 'crypto';

// Secure random token generation
const token = randomBytes(32).toString('hex');

// Encryption for sensitive data at rest
async function encrypt(text: string, password: string): Promise<string> {
  const iv = randomBytes(16);
  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, 'salt', 32, (err, derivedKey) => {
      if (err) reject(err);
      resolve(derivedKey);
    });
  });
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  // ... encryption logic
}
```

---

## 7. Error Handling & Logging

| # | Practice | NestJS Implementation |
|---|----------|----------------------|
| 7.1 | Don't disclose sensitive info in errors | ExceptionFilter sanitizes responses |
| 7.2 | Implement generic error messages | "An error occurred" in production |
| 7.3 | Handle errors without stack traces | `NODE_ENV=production` hides stack |
| 7.4 | Free allocated memory on error | Node.js garbage collection handles this |
| 7.5 | Security-related errors logged | Logger service for security events |
| 7.6 | Logging controls support audit success/failure | Structured logging with levels |
| 7.7 | Log all input validation failures | Warn-level logs in ValidationPipe |
| 7.8 | Log all authentication attempts | Login success/failure events |
| 7.9 | Log all access control failures | 403 responses logged with context |
| 7.10 | Log all exceptions | ExceptionFilter logs all |
| 7.11 | Don't log sensitive data | Never log passwords, tokens, PII |
| 7.12 | Timestamps in consistent format | ISO 8601 UTC |
| 7.13 | Log entries support forensic analysis | Include userId, IP, userAgent, requestId |

```typescript
// Global exception filter with secure logging
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Log full details internally
    this.logger.error('Request failed', {
      status,
      path: request.url,
      method: request.method,
      userId: request.user?.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      error: exception instanceof Error ? exception.message : 'Unknown error',
      stack: exception instanceof Error ? exception.stack : undefined
    });

    // Return generic error to client
    response.status(status).json({
      statusCode: status,
      message: status >= 500 ? 'Internal server error' : (exception as any).message,
      timestamp: new Date().toISOString()
    });
  }
}
```

---

## 8. Data Protection

| # | Practice | NestJS Implementation |
|---|----------|----------------------|
| 8.1 | Implement least privilege | Minimal data in JWT, minimal DB fields returned |
| 8.2 | Protect cached sensitive data on server | Encrypted cache, Redis AUTH |
| 8.3 | Encrypt sensitive stored data | Field-level encryption for PII |
| 8.4 | Protect server-side code from download | Don't serve `/src` or `.env` |
| 8.5 | Don't store passwords, connection strings in plain text | Environment variables, secrets manager |
| 8.6 | Don't include sensitive info in GET params | POST for sensitive data |
| 8.7 | Disable autocomplete on sensitive form fields | Frontend concern |
| 8.8 | Disable caching for sensitive pages | `Cache-Control: no-store` header |
| 8.9 | Remove unnecessary application data | Clear temp files, logs rotation |
| 8.10 | Appropriate access controls on sensitive data | DB roles, row-level security |
| 8.11 | Store sensitive data in non-web-accessible location | Outside public folder |
| 8.12 | Use secure data collection channels | HTTPS only |

```typescript
// Hide sensitive fields in responses
@UnifiedField({
  description: 'Password hash',
  hideField: true  // Never returned in API
})
password: string;

// Encrypt sensitive fields at rest
@UnifiedField({
  description: 'Social Security Number',
  transform: (value) => encrypt(value, process.env.ENCRYPTION_KEY)
})
ssn: string;

// Disable caching for sensitive responses
@Get('me')
@Header('Cache-Control', 'no-store, no-cache, must-revalidate')
async getCurrentUser() {}
```

---

## 9. Communication Security

| # | Practice | NestJS Implementation |
|---|----------|----------------------|
| 9.1 | Use encryption for all sensitive data transmission | TLS 1.3 minimum |
| 9.2 | TLS certificates from trusted CA | Let's Encrypt or commercial CA |
| 9.3 | Implement HSTS | Helmet middleware |
| 9.4 | Protect connection strings and credentials | Environment variables |
| 9.5 | Remove comments from production code | Build process strips comments |

```typescript
// Helmet configuration with HSTS
import helmet from 'helmet';

app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

---

## 10. System Configuration

| # | Practice | NestJS Implementation |
|---|----------|----------------------|
| 10.1 | Servers/frameworks configured securely | Follow NestJS security guide |
| 10.2 | Third-party components up to date | Regular `npm audit`, `npm update` |
| 10.3 | Non-essential features disabled | Disable GraphQL playground in prod |
| 10.4 | Appropriate access controls for server files | chmod 640 for configs |
| 10.5 | Separate environments (dev/staging/prod) | NODE_ENV based configuration |
| 10.6 | Remove default/demo code | No sample data in production |
| 10.7 | Don't expose system info in errors | Production error filter |

```typescript
// Environment-specific configuration
const isDev = process.env.NODE_ENV !== 'production';

// Disable introspection in production
GraphQLModule.forRoot({
  playground: isDev,
  introspection: isDev,
  debug: isDev
});
```

---

## 11. Database Security

| # | Practice | NestJS Implementation |
|---|----------|----------------------|
| 11.1 | Use parameterized queries | Mongoose/TypeORM built-in |
| 11.2 | Utilize input validation | class-validator before DB operations |
| 11.3 | Strongly typed queries | TypeScript interfaces |
| 11.4 | Validate response type and count | Check query results before use |
| 11.5 | Use only approved database accounts | Connection string in env vars |
| 11.6 | Close connections properly | Connection pooling, graceful shutdown |
| 11.7 | Remove default accounts/passwords | No admin/admin credentials |
| 11.8 | Application minimal privileges | Read-only replicas where possible |
| 11.9 | Remove unnecessary stored procedures | Minimize database logic |
| 11.10 | Remove test/sample data | Migration scripts clean data |
| 11.11 | Database account cannot access config | Separate DB user from admin |

```typescript
// Parameterized query (Mongoose)
const user = await this.userModel.findOne({ email });  // Safe

// NEVER do this
const user = await this.userModel.findOne({ $where: `this.email === '${email}'` });  // Injection!

// Validate ObjectId before query
if (!Types.ObjectId.isValid(id)) {
  throw new BadRequestException('Invalid ID');
}
```

---

## 12. File Management

| # | Practice | NestJS Implementation |
|---|----------|----------------------|
| 12.1 | Don't pass user input to dynamic include | Never `require(userInput)` |
| 12.2 | Require authentication for file downloads | FileGuard on download endpoints |
| 12.3 | Restrict file types to business need | Allowlist MIME types |
| 12.4 | Validate file type by content | Magic byte validation |
| 12.5 | Don't save files in web context | S3 or separate file server |
| 12.6 | Block execution of user-uploaded files | No execute permissions, nosniff header |
| 12.7 | Implement secure upload progress | Chunked uploads with validation |
| 12.8 | Prevent path traversal in uploads | `path.basename()` and random filenames |
| 12.9 | Scan uploaded files for malware | ClamAV integration |
| 12.10 | Protect file permissions | `chmod 644` for uploads |

```typescript
// Secure file upload handling
@Post('upload')
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: 5 * 1024 * 1024 },  // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new BadRequestException('Invalid file type'), false);
    }
    cb(null, true);
  }
}))
async uploadFile(@UploadedFile() file: Express.Multer.File) {
  // Additional magic byte validation
  const type = await fileType.fromBuffer(file.buffer);
  if (!type || !['image/jpeg', 'image/png', 'application/pdf'].includes(type.mime)) {
    throw new BadRequestException('Invalid file content');
  }

  // Generate secure filename
  const filename = `${randomUUID()}${path.extname(file.originalname)}`;
  // Upload to S3 or secure storage
}
```

---

## 13. Memory Management

| # | Practice | NestJS Implementation |
|---|----------|----------------------|
| 13.1 | Use input/output control for untrusted data | Streams with limits |
| 13.2 | Check buffer boundaries | Node.js handles automatically |
| 13.3 | Truncate input to buffer length | String slicing before assignment |
| 13.4 | Use safe functions (strncpy vs strcpy) | Not applicable to Node.js |
| 13.5 | Free resources properly | `finally` blocks, try-with-resources pattern |
| 13.6 | Bounds checking on stack variables | Not applicable to Node.js |
| 13.7 | Avoid unsafe functions | No `eval()`, no `Function()` constructor |
| 13.8 | Format strings from trusted sources | No template injection |
| 13.9 | Clear sensitive data from memory | `buffer.fill(0)` for sensitive buffers |

```typescript
// Avoid eval and similar
const userInput = req.body.code;
// NEVER: eval(userInput)
// NEVER: new Function(userInput)
// NEVER: vm.runInContext(userInput)

// Clear sensitive data
function processPassword(password: string): void {
  const passwordBuffer = Buffer.from(password);
  try {
    // Process password...
  } finally {
    passwordBuffer.fill(0);  // Clear from memory
  }
}
```

---

## 14. General Coding Practices

| # | Practice | NestJS Implementation |
|---|----------|----------------------|
| 14.1 | Tested and approved managed code | `npm audit`, code review |
| 14.2 | Use task-specific tested libraries | Well-maintained packages only |
| 14.3 | Don't use client-side code for security | Server-side validation always |
| 14.4 | Use checksums for integrity | Package lock files, SRI |
| 14.5 | Don't allow non-essential URLs | Validate redirect URLs |
| 14.6 | Prevent frame embedding | `X-Frame-Options: DENY` via Helmet |
| 14.7 | Use safe redirect functions | Allowlist valid redirect targets |
| 14.8 | Remove test code from production | Build process excludes tests |
| 14.9 | Don't implement custom crypto | Use Node.js crypto module |
| 14.10 | Use complete error checking | Validate all function returns |

```typescript
// Safe redirect validation
const ALLOWED_REDIRECTS = ['/', '/dashboard', '/profile'];

@Get('redirect')
redirect(@Query('to') to: string, @Res() res: Response) {
  if (!ALLOWED_REDIRECTS.includes(to)) {
    throw new BadRequestException('Invalid redirect target');
  }
  return res.redirect(to);
}

// Or validate against origin
const url = new URL(to, 'https://example.com');
if (url.hostname !== 'example.com') {
  throw new BadRequestException('Cannot redirect to external sites');
}
```

---

## Quick Reference Card

### Pre-Deployment Checklist

**Input/Output:**
- [ ] ValidationPipe global mit whitelist
- [ ] Alle DTOs mit class-validator Decorators
- [ ] HTML-Sanitization für User-Content
- [ ] Parameterized Queries (kein String-Building)

**Authentication:**
- [ ] bcrypt für Passwords (cost ≥ 10)
- [ ] JWT Access Tokens ≤ 15 min
- [ ] Refresh Token Rotation
- [ ] Generic Error Messages

**Authorization:**
- [ ] Default-Deny auf Class-Level
- [ ] Ownership-Checks in Services
- [ ] Rate Limiting auf Auth-Endpoints

**Communication:**
- [ ] HTTPS enforced
- [ ] Helmet Security Headers
- [ ] CORS auf allowed origins beschränkt
- [ ] Sensitive Cookies: httpOnly, secure, sameSite

**Data Protection:**
- [ ] Sensitive Fields hidden (hideField: true)
- [ ] No secrets in code (env vars only)
- [ ] PII encrypted at rest
- [ ] Logs contain no passwords/tokens

**Files:**
- [ ] Magic Byte Validation
- [ ] Size Limits
- [ ] Random Filenames
- [ ] External Storage (S3)

**Dependencies:**
- [ ] `npm audit` clean
- [ ] No deprecated packages
- [ ] Lock file committed
