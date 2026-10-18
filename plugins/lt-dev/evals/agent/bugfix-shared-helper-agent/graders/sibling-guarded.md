---
type: llm
focus: { source: file, path: src/server/modules/credit/credit-account.service.ts }
weight: 2
---

This is src/server/modules/credit/credit-account.service.ts of a @lenne.tech/nest-server backend after a bug fix. Before the fix, two public methods took credits off an account through one shared private helper: transfer(fromId, toId, amount) called debit(fromId, amount) and then credit(toId, amount), and redeem(accountId, amount) called debit(accountId, amount). debit was `updateOne({ _id: accountId }, { $inc: { balance: -amount } })` without any check, so both methods could drive a balance below zero. The bug report named transfers only (an account with 50 credits sends 80 and ends at -30). The controller inputs already validate amounts as integers of at least 1.

PASS if redeem can no longer take an account below zero either: redeeming more credits than the balance is rejected, whether by a guard in the shared debit helper or by a check in redeem itself.
FAIL if redeem still debits without any balance check, for example because only transfer was guarded.
