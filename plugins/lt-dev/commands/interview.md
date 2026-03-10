---
description: Deep-dive interview about an architecture plan or specification to uncover gaps and refine details
argument-hint: <plan-file-path>
model: opus
allowed-tools: Read, Grep, Glob, Bash(ls:*), AskUserQuestion, Write, Edit
---

# Plan Interview

Read the plan file at `$ARGUMENTS` and conduct a thorough interview about it.

## Goal

Uncover gaps, ambiguities, and hidden assumptions in the plan through structured questioning. Refine the specification until it's complete enough for direct implementation by `backend-dev` and `frontend-dev` agents.

## Interview Protocol

### Phase 1: Understanding

Read the plan file thoroughly. Identify:
- Unstated assumptions
- Missing edge cases
- Ambiguous requirements
- Implicit dependencies
- Security considerations not addressed
- UX decisions left open

### Phase 2: Deep-Dive Questions

Ask questions using AskUserQuestion — one topic at a time, grouped by category:

**Technical Implementation:**
- Data model decisions (embedding vs referencing, index strategy)
- API contract specifics (error codes, pagination, filtering)
- Permission model edge cases (who sees what, ownership rules)
- State management (what's shared, what's local, cache invalidation)

**UI & UX:**
- User flows and interaction patterns
- Error states and empty states
- Loading behavior and optimistic updates
- Mobile responsiveness considerations
- Accessibility requirements

**Business Logic:**
- Validation rules and constraints
- Edge cases (empty data, max limits, concurrent access)
- Ordering and sorting defaults
- Deletion behavior (soft delete, cascade, orphan handling)

**Security & Permissions:**
- Role-based access for each operation
- Data visibility rules per role
- Input validation boundaries
- File upload constraints (types, sizes)

**Infrastructure:**
- Environment-specific behavior
- Migration strategy for existing data
- Performance expectations (data volume, concurrent users)

### Phase 3: Refinement

After each answer, follow up with deeper questions if the answer reveals new ambiguities. Continue until all critical aspects are covered.

**Rules:**
- Ask non-obvious questions — skip anything clearly answered in the plan
- One focused question per AskUserQuestion call
- Group related follow-ups together
- Challenge assumptions: "What happens if X is empty/null/very large?"
- Explore failure modes: "What should happen when Y fails?"

### Phase 4: Specification Update

Once the interview is complete, update the plan file with all gathered details:
- Add clarified requirements inline
- Add a "Decisions" section with interview outcomes
- Add edge cases and error handling specifications
- Mark any remaining open questions

Inform the user that the spec has been updated and is ready for implementation.
