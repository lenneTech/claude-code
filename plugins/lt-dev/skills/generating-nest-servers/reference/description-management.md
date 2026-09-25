---
name: nest-server-generator-description-management
description: Guidelines for consistent description management across all generated components
---

# Description Management

## Table of Contents
- [Step 1: Extract Descriptions from User Input](#step-1-extract-descriptions-from-user-input)
- [Step 2: Format Descriptions Correctly](#step-2-format-descriptions-correctly)
- [Step 3: Apply Descriptions to Every Location](#step-3-apply-descriptions-to-every-location)
- [Common Mistakes](#common-mistakes)
- [Verification Checklist](#verification-checklist)
- [If You Forget](#if-you-forget)
- [Quick Reference](#quick-reference)

Follow this process for every component, so each property carries one description, applied completely and identically in every file that declares it.

---

## Step 1: Extract Descriptions from User Input

**Before generating any code, scan the user's specification for description hints:**

1. **Look for comments after `//`**:
   ```
   Module: Product
   - name: string // Product name
   - price: number // Produktpreis
   - stock?: number // Current stock level
   ```

2. **Extract all comments** and store them for each property
3. **Identify language** (English or German)

---

## Step 2: Format Descriptions Correctly

**Rule**: `"ENGLISH_DESCRIPTION (DEUTSCHE_BESCHREIBUNG)"`

### Processing Logic

| User Input | Language | Formatted Description |
|------------|----------|----------------------|
| `// Product name` | English | `'Product name'` |
| `// Produktname` | German | `'Product name (Produktname)'` |
| `// Straße` | German | `'Street (Straße)'` |
| `// Postleizahl` (typo) | German | `'Postal code (Postleitzahl)'` |
| (no comment) | - | Create meaningful English description |

### Preserving Original Text

**1. Fix spelling errors only:**
-  Correct typos: `Postleizahl` -> `Postleitzahl` (missing 't')
-  Fix character errors: `Starße` -> `Straße` (wrong character)
-  Correct English typos: `Prodcut name` -> `Product name`

**2. Keep the wording unchanged:**
-  No rephrasing: `Straße` -> `Straßenname`
-  No expanding: `Produkt` -> `Produktbezeichnung`
-  No improving: `Name` -> `Full name`
-  No different translation: `Name` -> `Title`

**3. Why:**
- User comments may be **predefined terms** from requirements
- External systems may **reference these exact terms**
- Changing wording breaks **external integrations**

### Examples

```
 CORRECT:
// Straße -> 'Street (Straße)'  (only translated)
// Starße -> 'Street (Straße)'  (typo fixed, then translated)
// Produkt -> 'Product (Produkt)'  (keep original word)
// Strasse -> 'Street (Straße)'  (ss ->ß corrected, then translated)

 WRONG:
// Straße -> 'Street name (Straßenname)'  (changed wording!)
// Produkt -> 'Product name (Produktname)'  (added word!)
// Name -> 'Full name (Vollständiger Name)'  (rephrased!)
```

**Rule Summary**: Fix typos, preserve wording, translate accurately.

---

## Step 3: Apply Descriptions to Every Location

**Apply the same description to each of these locations:**

### For Module Properties

**1. Model file** (`<module>.model.ts`):
```typescript
@UnifiedField({ description: 'Product name (Produktname)' })
name: string;
```

**2. Create Input** (`<module>-create.input.ts`):
```typescript
@UnifiedField({ description: 'Product name (Produktname)' })
name: string;
```

**3. Update Input** (`<module>.input.ts`):
```typescript
@UnifiedField({ description: 'Product name (Produktname)' })
name?: string;
```

### For SubObject Properties

**1. Object file** (`<object>.object.ts`):
```typescript
@UnifiedField({ description: 'Street (Straße)' })
street: string;
```

**2. Object Create Input** (`<object>-create.input.ts`):
```typescript
@UnifiedField({ description: 'Street (Straße)' })
street: string;
```

**3. Object Update Input** (`<object>.input.ts`):
```typescript
@UnifiedField({ description: 'Street (Straße)' })
street?: string;
```

### For Object/Module Type Decorators

Apply descriptions to the class decorators as well:

```typescript
@ObjectType({ description: 'Address information (Adressinformationen)' })
export class Address { ... }

@InputType({ description: 'Address information (Adressinformationen)' })
export class AddressInput { ... }

@ObjectType({ description: 'Product entity (Produkt-Entität)' })
export class Product extends PersistenceModel { ... }
```

---

## Common Mistakes

1.  **Partial application**: Descriptions only in Models, not in Inputs
2.  **Inconsistent format**: German-only in some places, English-only in others
3.  **Missing descriptions**: No descriptions when user provided comments
4.  **Ignoring Object inputs**: Forgetting to add descriptions to SubObject Input files
5.  **Wrong format**: Using `(ENGLISH)` instead of `ENGLISH (DEUTSCH)`
6.  **Changing wording**: Rephrasing user's original terms
7.  **Adding words**: Expanding user's terminology

---

## Verification Checklist

After generating code, verify:

- [ ] All user comments/descriptions extracted from specification
- [ ] All descriptions follow format: `"ENGLISH (DEUTSCH)"` or `"ENGLISH"`
- [ ] Model properties have descriptions
- [ ] Create Input properties have SAME descriptions
- [ ] Update Input properties have SAME descriptions
- [ ] Object properties have descriptions
- [ ] Object Input properties have SAME descriptions
- [ ] Class-level `@ObjectType()` and `@InputType()` have descriptions
- [ ] NO German-only descriptions (must be translated)
- [ ] NO inconsistencies between files
- [ ] Original wording preserved (only typos fixed)

---

## If You Forget

**If you generate code and realize descriptions are missing or inconsistent:**

1. **Pause** the other phases
2. **Go back** and add/fix all descriptions
3. **Verify** using the checklist above
4. **Then continue** with remaining phases

Descriptions are required, not optional, because they feed:
- API documentation (Swagger/GraphQL)
- Code maintainability
- Developer experience
- Bilingual projects (German/English teams)

---

## Quick Reference

### Format Rules

```
English input    -> 'Product name'
German input     -> 'Product name (Produktname)'
No input         -> Create meaningful description
Typo input       -> Fix typo, then translate
Mixed input      -> Standardize to 'ENGLISH (DEUTSCH)'
```

### Application Checklist

For **each property**:
- [ ] Model file
- [ ] Create Input file
- [ ] Update Input file

For **each class**:
- [ ] @ObjectType() decorator
- [ ] @InputType() decorator (if applicable)

### Remember

- **Consistency** - Same description everywhere
- **Preserve wording** - Only fix typos, never rephrase
- **Bilingual format** - Always use "ENGLISH (DEUTSCH)" for German terms
- **Verification** - Check all files before proceeding
