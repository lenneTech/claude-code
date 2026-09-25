---
type: llm
weight: 1
---

The reviewed commit adds a @lenne.tech/nest-server product module (model, service, controller, inputs). Its requirements: logged-in users may read and search products; only admins may create, update and delete them; the purchase price is visible to admins only; getDiscountedPrice returns the price after deducting discountPercent percent; every endpoint has API tests. You are judging a code review report of that commit.

Seeded defect: the commit adds no tests at all, while the requirement demands API tests for every endpoint.

PASS if the report states that tests for the new module or its endpoints are missing.
FAIL if the report does not mention missing tests.
