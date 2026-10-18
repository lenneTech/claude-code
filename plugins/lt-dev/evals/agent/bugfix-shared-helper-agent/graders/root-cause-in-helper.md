---
type: llm
focus: { source: file, path: src/server/modules/credit/credit-account.service.ts }
weight: 1
---

This is src/server/modules/credit/credit-account.service.ts of a @lenne.tech/nest-server backend after a bug fix. Before the fix, two public methods took credits off an account through one shared private helper: transfer(fromId, toId, amount) called debit(fromId, amount) and then credit(toId, amount), and redeem(accountId, amount) called debit(accountId, amount). debit was `updateOne({ _id: accountId }, { $inc: { balance: -amount } })` without any check, so both methods could drive a balance below zero. The bug report named transfers only (an account with 50 credits sends 80 and ends at -30). The controller inputs already validate amounts as integers of at least 1.

PASS if the balance guard sits once in the shared debit path that both transfer and redeem go through (for example a conditional update inside debit that throws when the balance is insufficient), so every caller of debit is covered by the same check.
FAIL if the guard is written into the public methods (one or each of them) while debit itself still takes credits off unconditionally.
