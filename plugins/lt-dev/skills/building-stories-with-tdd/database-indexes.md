---
name: story-tdd-database-indexes
description: Database index guidelines for @UnifiedField decorator - keep indexes visible with properties
---

#  Database Indexes with @UnifiedField

## Table of Contents
- [When to Add Indexes](#when-to-add-indexes)
- [Example Patterns](#example-patterns)
- [Framework-Managed Indexes — Do Not Set Manually](#framework-managed-indexes--do-not-set-manually)
- [Compound Indexes — Use `Schema.index()`](#compound-indexes--use-schemaindex)
- [DON'T Create Indexes Separately!](#-dont-create-indexes-separately)
- [Benefits of Decorator-Based Indexes](#benefits-of-decorator-based-indexes)
- [Index Verification Checklist](#index-verification-checklist)
- [Red Flags - Missing Indexes](#red-flags---missing-indexes)
- [Quick Index Checklist](#quick-index-checklist)

**IMPORTANT: Always define single-field indexes directly in the @UnifiedField / @Prop decorator!**

This keeps indexes visible right where properties are defined, making them easy to spot during code reviews. Schema-level `Schema.index()` is reserved for **compound (multi-field) indexes only**.

**Golden Rule:**

> Single-field indexes that are not already set by the framework (e.g. `tenantId`) belong on the property — this keeps all info about the property compact. Only combined/compound indexes belong in `ModelSchema.index()`.

---

## When to Add Indexes

-  Fields used in queries (find, filter, search)
-  Foreign keys (references to other collections)
-  Fields used in sorting operations
-  Unique constraints (email, username, etc.)
-  Fields frequently accessed together (compound indexes)

---

## Example Patterns

### Single Field Index

```typescript
@UnifiedField({
  description: 'User email address',
  mongoose: { index: true, unique: true, type: String }  //  Simple index + unique constraint
})
email: string;
```

### Compound Index

```typescript
@UnifiedField({
  description: 'Product category',
  mongoose: { index: true, type: String }  //  Part of compound index
})
category: string;

@UnifiedField({
  description: 'Product status',
  mongoose: { index: true, type: String }  //  Part of compound index
})
status: string;

// Both fields indexed individually for flexible querying
```

### Text Index for Search

```typescript
@UnifiedField({
  description: 'Product name',
  mongoose: { type: String, text: true }  //  Full-text search index
})
name: string;
```

### Foreign Key Index

```typescript
@UnifiedField({
  description: 'Reference to user who created this',
  mongoose: { index: true, type: String }  //  Index for JOIN operations
})
createdBy: string;
```

### TTL Index (inline on the property)

```typescript
/**
 * Expiration timestamp (5 minutes TTL)
 */
@Prop({ required: true, index: { expireAfterSeconds: 3600 } })  //  TTL on the property
@UnifiedField({
  description: 'Expiration timestamp',
  roles: RoleEnum.S_EVERYONE,
  type: () => Date,
})
expiresAt: Date = undefined;
```

**Do NOT** add a separate `Schema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 })` — it duplicates the TTL index.

### Unique Index (inline on the property)

```typescript
@Prop({ required: true, unique: true })  //  unique auto-creates an index
slug: string = undefined;
```

**Do NOT** additionally write `Schema.index({ slug: 1 }, { unique: true })` — Mongoose already created the unique index via `@Prop({ unique: true })`.

---

## Framework-Managed Indexes — Do Not Set Manually

Some fields are automatically indexed by framework plugins. Adding `index: true` on these fields triggers Mongoose `"Duplicate schema index"` warnings.

**Known framework-managed fields:**

| Field      | Plugin                           | Source |
|------------|----------------------------------|--------|
| `tenantId` | `mongooseTenantPlugin`           | `@lenne.tech/nest-server` → `src/core/common/plugins/mongoose-tenant.plugin.ts` |

```typescript
//  WRONG — duplicate index
@Prop({ type: String, index: true })
@Restricted(RoleEnum.S_EVERYONE)
tenantId: string = undefined;

//  CORRECT — add a short comment so future edits don't reintroduce the duplicate
// Index is auto-created by the nest-server mongooseTenantPlugin — do NOT add `index: true`.
@Prop({ type: String })
@Restricted(RoleEnum.S_EVERYONE)
tenantId: string = undefined;
```

**Before adding an index to any field, grep the framework source (`node_modules/@lenne.tech/nest-server/src/core/common/plugins/`) for `schema.index(` to see if the plugin already handles it.**

---

## Compound Indexes — Use `Schema.index()`

**The only valid use of `Schema.index()` is for compound (multi-field) indexes.**

```typescript
@Schema()
export class Order {
  @Prop({ type: String })  //  no single-field index here
  customerId: string = undefined;

  @Prop({ type: String })  //  no single-field index here
  status: string = undefined;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

//  Compound index — belongs here
OrderSchema.index({ customerId: 1, status: 1, createdAt: -1 });
```

Why compound indexes stay in `Schema.index()`:
- They cover queries across multiple fields — they aren't "about" one property
- Order of fields matters (prefix rule) — this belongs at the schema level
- They're usually paired with sort/range queries spanning multiple columns

---

##  DON'T Create Indexes Separately!

```typescript
//  WRONG: Separate schema index definition
@Schema()
export class Product {
  @UnifiedField({
    description: 'Category',
    mongoose: { type: String }
  })
  category: string;
}

ProductSchema.index({ category: 1 }); //  Index hidden away from property

//  CORRECT: Index in decorator mongoose option
@Schema()
export class Product {
  @UnifiedField({
    description: 'Category',
    mongoose: { index: true, type: String }  //  Immediately visible
  })
  category: string;
}
```

---

## Benefits of Decorator-Based Indexes

-  Indexes visible when reviewing properties
-  No need to search schema files
-  Clear documentation of query patterns
-  Easier to maintain and update
-  Self-documenting code

---

## Index Verification Checklist

**Look for fields that should have indexes:**
- Fields used in find/filter operations
- Foreign keys (userId, productId, etc.)
- Fields used in sorting (createdAt, updatedAt, name)
- Unique fields (email, username, slug)

**Example check:**

```typescript
// Service has this query:
const orders = await this.orderService.find({
  where: { customerId: userId, status: 'pending' }
});

//  Model should have indexes:
export class Order {
  @UnifiedField({
    description: 'Customer reference',
    mongoose: { index: true, type: String }  //  Used in queries
  })
  customerId: string;

  @UnifiedField({
    description: 'Order status',
    mongoose: { index: true, type: String }  //  Used in filtering
  })
  status: string;
}
```

---

## Red Flags - Missing Indexes

🚩 **Check for these issues:**
- Service queries a field but model has no index
- Foreign key fields without index
- Unique constraints not marked in decorator
- Fields used in sorting without index

**If indexes are missing:**
1. Add them to the @UnifiedField decorator immediately
2. Re-run tests to ensure everything still works
3. Document why the index is needed (query pattern)

---

## Quick Index Checklist

Before marking complete:

- [ ] **Fields used in find() queries have indexes**
- [ ] **Foreign keys (userId, productId, etc.) have indexes**
- [ ] **Unique fields (email, username) marked with unique: true** (no separate `Schema.index()`)
- [ ] **Fields used in sorting have indexes**
- [ ] **Single-field indexes on the property** (`@Prop` / `@UnifiedField`), NOT in `Schema.index()`
- [ ] **TTL indexes inline** (`@Prop({ index: { expireAfterSeconds: N } })`), NOT via `Schema.index()`
- [ ] **`tenantId` has NO `index: true`** — framework plugin sets it automatically
- [ ] **`Schema.index()` only used for compound (multi-field) indexes**
- [ ] **Indexes match query patterns in services**
- [ ] **No Mongoose `"Duplicate schema index"` warnings on server start** (run `pnpm start` and grep for them)
