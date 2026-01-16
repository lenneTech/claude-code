---
name: nest-server-generator-security-rules
description: Critical security and test coverage rules for NestJS development
---

#  CRITICAL SECURITY RULES

## Table of Contents
- [NEVER Do This](#-never-do-this)
- [ALWAYS Do This](#-always-do-this)
- [Permission Hierarchy (Specific Overrides General)](#-permission-hierarchy-specific-overrides-general)
- [Rule 1: NEVER Weaken Security for Test Convenience](#rule-1-never-weaken-security-for-test-convenience)
- [Rule 2: Understanding Permission Hierarchy](#rule-2-understanding-permission-hierarchy)
- [Rule 3: Adapt Tests to Security, Not Vice Versa](#rule-3-adapt-tests-to-security-not-vice-versa)
- [Rule 4: Test with Least Privileged User](#rule-4-test-with-least-privileged-user)
- [Rule 5: Create Appropriate Test Users](#rule-5-create-appropriate-test-users)
- [Rule 6: Comprehensive Test Coverage](#rule-6-comprehensive-test-coverage)
- [Quick Security Checklist](#quick-security-checklist)
- [Security Decision Protocol](#security-decision-protocol)

**Before you start ANY work, understand these NON-NEGOTIABLE rules.**

---

##  NEVER Do This

1. **NEVER remove or weaken `@Restricted()` decorators** to make tests pass
2. **NEVER change `@Roles()` decorators** to more permissive roles for test convenience
3. **NEVER modify `securityCheck()` logic** to bypass security in tests
4. **NEVER remove class-level `@Restricted(RoleEnum.ADMIN)`** - it's a security fallback

---

##  ALWAYS Do This

1. **ALWAYS analyze permissions BEFORE writing tests** (Controller, Model, Service layers)
2. **ALWAYS test with the LEAST privileged user** who is authorized
3. **ALWAYS create appropriate test users** for each permission level
4. **ALWAYS adapt tests to security requirements**, never the other way around
5. **ALWAYS ask developer for approval** before changing ANY security decorator
6. **ALWAYS aim for maximum test coverage** (80-100% depending on criticality)

---

## 🔑 Permission Hierarchy (Specific Overrides General)

```typescript
@Restricted(RoleEnum.ADMIN)  // ← FALLBACK: DO NOT REMOVE
export class ProductController {
  @Roles(RoleEnum.S_USER)    // ← SPECIFIC: This method is more open
  async createProduct() { }   // ← S_USER can access (specific wins)

  async secretMethod() { }    // ← ADMIN only (fallback applies)
}
```

**Why class-level `@Restricted(ADMIN)` MUST stay:**
- If someone forgets `@Roles()` on a new method -> it's secure by default
- Shows the class is security-sensitive
- Fail-safe protection

---

## Rule 1: NEVER Weaken Security for Test Convenience

###  ABSOLUTELY FORBIDDEN

```typescript
// BEFORE (secure):
@Restricted(RoleEnum.ADMIN)
export class ProductController {
  @Roles(RoleEnum.S_USER)
  async createProduct() { ... }
}

// AFTER (FORBIDDEN - security weakened!):
// @Restricted(RoleEnum.ADMIN)  ← NEVER remove this!
export class ProductController {
  @Roles(RoleEnum.S_USER)
  async createProduct() { ... }
}
```

###  CRITICAL RULE

- **NEVER remove or weaken `@Restricted()` decorators** on Controllers, Resolvers, Models, or Objects
- **NEVER change `@Roles()` decorators** to more permissive roles just to make tests pass
- **NEVER modify `securityCheck()` logic** to bypass security for testing

### If tests fail due to permissions

1.  **CORRECT**: Adjust the test to use the appropriate user/token
2.  **CORRECT**: Create test users with the required roles
3.  **WRONG**: Weaken security to make tests pass

### Any security changes MUST

- Be discussed with the developer FIRST
- Have a solid business justification
- Be explicitly approved by the developer
- Be documented with the reason

---

## Rule 2: Understanding Permission Hierarchy

### ⭐ Key Concept: Specific Overrides General

The `@Restricted()` decorator on a class acts as a **security fallback** - if a method/property doesn't specify permissions, it inherits the class-level restriction. This is a **security-by-default** pattern.

### Example - Controller/Resolver

```typescript
@Restricted(RoleEnum.ADMIN)  // ← FALLBACK: Protects everything by default
export class ProductController {

  @Roles(RoleEnum.S_EVERYONE)  // ← SPECIFIC: This method is MORE open
  async getPublicProducts() {
    // Anyone can access this (specific @Roles wins)
  }

  @Roles(RoleEnum.S_USER)  // ← SPECIFIC: Logged-in users
  async createProduct() {
    // S_USER can access (specific wins over fallback)
  }

  async deleteProduct() {
    // ADMIN ONLY (no specific decorator, fallback applies)
  }
}
```

### Example - Model

```typescript
@Restricted(RoleEnum.ADMIN)  // ← FALLBACK
export class Product {

  @Roles(RoleEnum.S_EVERYONE)  // ← SPECIFIC
  @UnifiedField({ description: 'Product name' })
  name: string;  // Everyone can read this

  @UnifiedField({ description: 'Internal cost' })
  cost: number;  // ADMIN ONLY (fallback applies)
}
```

---

## Rule 3: Adapt Tests to Security, Not Vice Versa

###  WRONG Approach

```typescript
// Test fails because user isn't admin
it('should create product', async () => {
  const result = await request(app)
    .post('/products')
    .set('Authorization', regularUserToken)  // Not an admin!
    .send(productData);

  expect(result.status).toBe(201);  // Fails with 403
});

//  WRONG FIX: Removing @Restricted from controller
// @Restricted(RoleEnum.ADMIN)  ← NEVER DO THIS!
```

###  CORRECT Approach

```typescript
// Analyze first: Who is allowed to create products?
// Answer: ADMIN only (based on @Restricted on controller)

// Create admin test user
let adminToken: string;

beforeAll(async () => {
  const admin = await createTestUser({ roles: [RoleEnum.ADMIN] });
  adminToken = admin.token;
});

it('should create product as admin', async () => {
  const result = await request(app)
    .post('/products')
    .set('Authorization', adminToken)  //  Use admin token
    .send(productData);

  expect(result.status).toBe(201);  //  Passes
});

it('should reject product creation for regular user', async () => {
  const result = await request(app)
    .post('/products')
    .set('Authorization', regularUserToken)
    .send(productData);

  expect(result.status).toBe(403);  //  Test security works!
});
```

---

## Rule 4: Test with Least Privileged User

**Always test with the LEAST privileged user who is authorized to perform the action.**

###  WRONG

```typescript
// Method allows S_USER, but testing with ADMIN
@Roles(RoleEnum.S_USER)
async getProducts() { }

it('should get products', async () => {
  const result = await request(app)
    .get('/products')
    .set('Authorization', adminToken);  //  Over-privileged!
});
```

###  CORRECT

```typescript
@Roles(RoleEnum.S_USER)
async getProducts() { }

it('should get products as regular user', async () => {
  const result = await request(app)
    .get('/products')
    .set('Authorization', regularUserToken);  //  Least privilege
});
```

**Why this matters:**
- Tests might pass with ADMIN but fail with S_USER
- You won't catch permission bugs
- False confidence in security

---

## Rule 5: Create Appropriate Test Users

**Create test users for EACH permission level you need to test.**

### Example Test Setup

```typescript
describe('ProductController', () => {
  let adminToken: string;
  let userToken: string;
  let everyoneToken: string;

  beforeAll(async () => {
    // Create admin user
    const admin = await createTestUser({
      roles: [RoleEnum.ADMIN]
    });
    adminToken = admin.token;

    // Create regular user
    const user = await createTestUser({
      roles: [RoleEnum.S_USER]
    });
    userToken = user.token;

    // Create unauthenticated scenario
    const guest = await createTestUser({
      roles: [RoleEnum.S_EVERYONE]
    });
    everyoneToken = guest.token;
  });

  it('admin can delete products', async () => {
    // Use adminToken
  });

  it('regular user can create products', async () => {
    // Use userToken
  });

  it('everyone can view products', async () => {
    // Use everyoneToken or no token
  });

  it('regular user cannot delete products', async () => {
    // Use userToken, expect 403
  });
});
```

---

## Rule 6: Comprehensive Test Coverage

**Aim for 80-100% test coverage depending on criticality:**

- **High criticality** (payments, user data, admin functions): 95-100%
- **Medium criticality** (business logic, CRUD): 80-90%
- **Low criticality** (utilities, formatters): 70-80%

### What to Test

**For each endpoint/method:**

1.  Happy path (authorized user, valid data)
2.  Permission denied (unauthorized user)
3.  Validation errors (invalid input)
4.  Edge cases (empty data, boundaries)
5.  Error handling (server errors, missing resources)

### Example Comprehensive Tests

```typescript
describe('createProduct', () => {
  it('should create product with admin user', async () => {
    // Happy path
  });

  it('should reject creation by regular user', async () => {
    // Permission test
  });

  it('should reject invalid product data', async () => {
    // Validation test
  });

  it('should reject duplicate product name', async () => {
    // Business rule test
  });

  it('should handle missing required fields', async () => {
    // Edge case
  });
});
```

---

## Rule 7: Input Sanitization & XSS Prevention

###  Always Sanitize User Input

```typescript
//  WRONG: Direct HTML rendering without sanitization
@UnifiedField({ description: 'User bio (supports HTML)' })
bio: string;  // Could contain <script> tags!

//  CORRECT: Sanitize HTML input
import * as sanitizeHtml from 'sanitize-html';

@UnifiedField({
  description: 'User bio',
  transform: (value: string) => sanitizeHtml(value, {
    allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
    allowedAttributes: {}
  })
})
bio: string;
```

### URL Parameter Validation

```typescript
//  WRONG: Using URL parameters directly
@Get(':id')
async findOne(@Param('id') id: string) {
  return this.service.findById(id);  // No validation!
}

//  CORRECT: Validate with ParseUUIDPipe or custom validation
@Get(':id')
async findOne(@Param('id', ParseUUIDPipe) id: string) {
  return this.service.findById(id);
}

// Or custom validation
@Get(':id')
async findOne(@Param('id') id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestException('Invalid ID format');
  }
  return this.service.findById(id);
}
```

### Query Parameter Limits

```typescript
//  WRONG: No limits on pagination
@Get()
async findAll(@Query('limit') limit: number) {
  return this.service.find({}, { limit });  // User could request limit=1000000
}

//  CORRECT: Enforce limits
@Get()
async findAll(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
  const safeLimit = Math.min(Math.max(1, limit), 100);  // Clamp to 1-100
  return this.service.find({}, { limit: safeLimit });
}
```

---

## Rule 8: File Upload Security

###  Validate File Types (Magic Bytes, not just extension)

```typescript
import * as fileType from 'file-type';

//  WRONG: Trust file extension
async uploadFile(file: Express.Multer.File) {
  if (!file.originalname.endsWith('.pdf')) {
    throw new BadRequestException('Only PDF allowed');
  }
  // Attacker can rename malware.exe to malware.pdf!
}

//  CORRECT: Validate magic bytes
async uploadFile(file: Express.Multer.File) {
  const type = await fileType.fromBuffer(file.buffer);

  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!type || !ALLOWED_TYPES.includes(type.mime)) {
    throw new BadRequestException('Invalid file type');
  }

  // Also check file size
  const MAX_SIZE = 5 * 1024 * 1024;  // 5MB
  if (file.size > MAX_SIZE) {
    throw new BadRequestException('File too large (max 5MB)');
  }
}
```

### Prevent Path Traversal

```typescript
import * as path from 'path';

//  WRONG: Use user-provided filename directly
async saveFile(file: Express.Multer.File) {
  const filePath = path.join('/uploads', file.originalname);
  // Attacker could use: ../../../etc/passwd
}

//  CORRECT: Sanitize filename and use random names
async saveFile(file: Express.Multer.File) {
  // Option 1: Use only base name
  const safeName = path.basename(file.originalname);

  // Option 2: Generate random filename (recommended)
  const ext = path.extname(file.originalname);
  const randomName = `${randomUUID()}${ext}`;

  const uploadDir = '/uploads';
  const filePath = path.join(uploadDir, randomName);

  // Verify path is within upload directory
  if (!filePath.startsWith(uploadDir)) {
    throw new BadRequestException('Invalid file path');
  }
}
```

### Serve Files Securely

```typescript
//  WRONG: Execute files or expose directory
app.use('/uploads', express.static('uploads'));  // Could serve malicious HTML

//  CORRECT: Set proper headers
app.use('/uploads', express.static('uploads', {
  setHeaders: (res, filePath) => {
    res.setHeader('Content-Disposition', 'attachment');  // Force download
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/octet-stream');
  }
}));
```

---

## Rule 9: Communication Security

### HTTPS & TLS Enforcement

```typescript
// main.ts - Production configuration
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Redirect HTTP to HTTPS (via reverse proxy or middleware)
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}
```

### Helmet Security Headers

```typescript
import helmet from 'helmet';

// main.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,  // 1 year
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
```

### CORS Configuration

```typescript
//  WRONG: Allow all origins
app.enableCors();  // Allows any origin!

//  CORRECT: Restrict origins
app.enableCors({
  origin: [
    'https://app.example.com',
    'https://admin.example.com',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,  // Cache preflight for 24 hours
});

// Or dynamic origin validation
app.enableCors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
});
```

### Rate Limiting

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,      // Time window in seconds
      limit: 100,   // Max requests per window
    }),
  ],
})
export class AppModule {}

// Apply globally
@UseGuards(ThrottlerGuard)
@Controller('api')
export class ApiController {}

// Or per-endpoint with different limits
@Throttle(5, 60)  // 5 requests per 60 seconds
@Post('auth/login')
async login() {}

@Throttle(3, 3600)  // 3 requests per hour
@Post('auth/forgot-password')
async forgotPassword() {}
```

---

## Quick Security Checklist

Before completing ANY task:

**Authorization & Access Control:**
- [ ] **All @Restricted decorators preserved**
- [ ] **@Roles decorators NOT made more permissive**
- [ ] **Tests use appropriate user roles**
- [ ] **Test users created for each permission level**
- [ ] **Least privileged user tested**
- [ ] **Permission denial tested (403 responses)**
- [ ] **No securityCheck() logic bypassed**

**Input & Validation:**
- [ ] **All inputs validated and sanitized**
- [ ] **URL parameters validated (UUIDs, ObjectIds)**
- [ ] **Query limits enforced (pagination)**
- [ ] **HTML content sanitized**

**File Uploads:**
- [ ] **File types validated via magic bytes**
- [ ] **File size limits enforced**
- [ ] **Filenames sanitized (no path traversal)**
- [ ] **Files served with safe headers**

**Communication:**
- [ ] **HTTPS enforced in production**
- [ ] **Helmet security headers configured**
- [ ] **CORS restricted to allowed origins**
- [ ] **Rate limiting on sensitive endpoints**

**Testing:**
- [ ] **Test coverage ≥ 80%**
- [ ] **All edge cases covered**

---

## Security Decision Protocol

**When you encounter a security-related decision:**

1. **STOP** - Don't make the change immediately
2. **ANALYZE** - Why does the current security exist?
3. **ASK** - Consult the developer before changing
4. **DOCUMENT** - If approved, document the reason
5. **TEST** - Ensure security still works after change

**Remember:**
- **Security > Convenience**
- **Better to over-restrict than under-restrict**
- **Always preserve existing security mechanisms**
- **When in doubt, ask the developer**
