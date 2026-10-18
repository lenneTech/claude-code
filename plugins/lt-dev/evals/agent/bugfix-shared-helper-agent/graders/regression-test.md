---
type: llm
focus: { source: file, path: tests/modules/credit-account.e2e-spec.ts }
weight: 1
---

This is the API test file of the credit account module in a @lenne.tech/nest-server backend (REST tests through TestHelper). Before the fix it covered opening accounts, top-ups, a successful transfer, a refused transfer from another user's account and a successful redemption. The bug: a transfer of more credits than the sender held was accepted and drove the balance below zero (50 credits, transfer of 80, balance -30).

PASS if the file now contains a test that reproduces the reported bug: a transfer of more credits than the sending account holds is refused with an error status, and the test checks that the sender's balance did not change (or did not go below zero) after the refused request.
FAIL if there is no test of a transfer that exceeds the balance, or if such a test never checks the balance afterwards.
