---
type: llm
focus: { source: file, path: src/server/modules/credit/credit-account.service.ts }
weight: 1
---

This is src/server/modules/credit/credit-account.service.ts of a @lenne.tech/nest-server backend after a bug fix. Before the fix, two public methods took credits off an account through one shared private helper: transfer(fromId, toId, amount) called debit(fromId, amount) and then credit(toId, amount), and redeem(accountId, amount) called debit(accountId, amount). debit was `updateOne({ _id: accountId }, { $inc: { balance: -amount } })` without any check, so both methods could drive a balance below zero. The bug report named transfers only (an account with 50 credits sends 80 and ends at -30). The controller inputs already validate amounts as integers of at least 1.

PASS if a transfer whose amount exceeds the sender's balance is now rejected with an exception before any credits move: the sender's balance cannot go below zero and the receiving account is not credited. An atomic conditional update (for example a filter `balance: { $gte: amount }` plus a check that the update matched a document) and a check of the loaded balance before the debit both count.
FAIL if a transfer can still overdraw the sender, or if the receiver can be credited although the debit was refused.
