# Test Anti-Patterns

Four ways a test can be green and worthless. Each one costs twice: it fails to catch the bug it was written for, and it breaks during refactors that changed no behaviour, training everyone to distrust the suite.

The tell for all four is the same question: **would this test still pass if the implementation were rewritten, and still fail if the behaviour broke?**

---

## 1. Implementation-coupled

The test reaches past the interface: it mocks an internal collaborator, calls a private method, asserts on how often something was called, or verifies through a side channel.

In this stack the most common form is **verifying through the database instead of the API** — which is exactly what GOLDEN RULE 1 rules out, stated as an anti-pattern rather than a prohibition:

```typescript
// BAD: bypasses the interface to verify. The endpoint could return 500 and this still passes.
it('creates the item', async () => {
  await testHelper.rest('/items', { method: 'POST', payload: { name: 'A' }, token });
  const doc = await db.collection('items').findOne({ name: 'A' });
  expect(doc).toBeDefined();
});

// GOOD: verifies through the same interface the caller uses.
it('makes a created item retrievable', async () => {
  const created = await testHelper.rest('/items', { method: 'POST', payload: { name: 'A' }, token });
  const fetched = await testHelper.rest(`/items/${created.id}`, { token });
  expect(fetched.name).toBe('A');
});
```

The same shape in the frontend: asserting on a component's internal `ref` or on a store mutation instead of on what the user sees. Playwright asserts on the rendered page and the network the page produced, never on Vue internals.

**Red flags:** mocking your own service; `toHaveBeenCalledWith` on something you control; direct `db.collection(...)` reads in test *logic* (setup and cleanup remain fine); a test name that describes HOW (`calls MailService.send`) instead of WHAT (`sends a confirmation mail on signup`).

---

## 2. Tautological

The expected value is recomputed the way the code computes it, so the assertion can never disagree with the implementation. It passes by construction, including when the implementation is wrong.

```typescript
// BAD: expected value derived the same way the code derives it
it('sums the line items', () => {
  const items = [{ price: 10 }, { price: 5 }];
  const expected = items.reduce((sum, i) => sum + i.price, 0);
  expect(calculateTotal(items)).toBe(expected);
});

// GOOD: expected value is an independent literal
it('sums the line items', () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
});
```

The same trap in an API test: building the expected response by calling the same service the endpoint calls, or snapshotting a payload the code produced without ever reading whether it is correct. A snapshot recorded from a buggy run locks the bug in.

**Expected values come from an independent source of truth**: a known-good literal, a worked example, the acceptance criterion, the Figma spec.

---

## 3. Horizontal slicing

Writing all the tests first, then all the implementation. The tests then verify *imagined* behaviour: they describe the shape you expected rather than what users actually need, they go insensitive to real changes, and the test structure is committed to before anyone understands the implementation.

Work in **vertical slices** instead: one test, one implementation, repeat. Each test is a **tracer bullet** that responds to what the previous cycle taught you.

Note the difference from the Parallel Test Writing pattern in `SKILL.md`: that one parallelises backend and frontend test writing *within* a slice, against agreed contracts. It does not write a whole feature's worth of tests up front.

---

## 4. Mocking past the boundary

Mock at **system boundaries only** — things you do not own and cannot run in the test:

| Mock it | Do not mock it |
|---|---|
| Third-party APIs (payment, SMS, external CRM) | Your own services, controllers, resolvers |
| Outbound mail transport (or use MailHog) | Repositories and `CrudService` descendants |
| Time and randomness | The generated SDK against your own API |
| Rate-limited external endpoints | Anything a test DB or a running dev stack can serve for real |

The database is not a boundary here: this stack runs a real test DB per run, and `TestHelper` drives the real HTTP surface. A mocked repository proves that the mock behaves as configured, nothing more.

The frontend's generated `sdk.gen.ts` is already the boundary-friendly shape mocking wants — one typed function per operation, so a Playwright route interception replaces exactly one call with one fixed shape, and no conditional logic creeps into the test setup. Intercept at that level when you need to force an error path (a 500, a timeout, an empty list) that the real backend will not produce on demand.

---

## Where the tests go

Every test sits at a **seam**: the public boundary where behaviour is observable without reaching inside. In this stack the seams are already established, so the choice is which one, not where to invent one:

| Seam | Test type | Location |
|---|---|---|
| REST / GraphQL surface | API story test via `testHelper.rest()` / `testHelper.graphQl()` | `projects/api/tests/stories/` |
| Exported pure function or class | Unit test | beside the source, `*.spec.ts` |
| Rendered application, real backend | Playwright E2E | `projects/app/tests/` |

**Prefer the highest seam that can observe the behaviour**, and prefer an existing seam over a new one. Fewer seams means fewer places a refactor has to be re-taught. Where a behaviour is only observable through a seam that does not exist yet, that absence is itself a finding: it usually means the module is shaped so its behaviour cannot be verified from outside, and reshaping it beats testing past it.
