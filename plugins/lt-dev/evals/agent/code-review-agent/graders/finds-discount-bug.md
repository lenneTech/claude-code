---
type: llm
weight: 1
---

The reviewed commit adds a @lenne.tech/nest-server product module (model, service, controller, inputs). Its requirements: logged-in users may read and search products; only admins may create, update and delete them; the purchase price is visible to admins only; getDiscountedPrice returns the price after deducting discountPercent percent; every endpoint has API tests. You are judging a code review report of that commit.

Seeded defect: getDiscountedPrice returns `price * discountPercent / 100`, which is the discount amount, not the price after the discount (that would be `price * (1 - discountPercent / 100)`). With price 100 and 20 percent it returns 20 instead of 80.

PASS if the report identifies that getDiscountedPrice computes the wrong value (returns the discount instead of the discounted price, or equivalent).
FAIL if the report does not mention it.
