## Code Review Report (Single-Pass)

### Change Summary

Der Commit fügt ein Produktmodul hinzu (Model, Service, Controller, Create- und Update-Input). Angemeldete Nutzer sollen Produkte lesen und suchen, nur Admins anlegen, ändern und löschen; der Einkaufspreis ist nur für Admins sichtbar, `getDiscountedPrice` liefert den Preis nach Rabatt, jeder Endpoint hat API-Tests.

### Check Script Results

Nicht ausgeführt: In dieser Umgebung gibt es keine Shell, und package.json hat kein `check`-Skript.

### Findings

| # | Schweregrad | Datei | Befund | Fix |
|---|---|---|---|---|
| 1 | Critical | src/server/modules/product/product.controller.ts:41, :59 | `createProduct` (POST /products) und `deleteProduct` (DELETE /products/:id) tragen `@Roles(RoleEnum.S_EVERYONE)` und keinen AuthGuard. Jeder, auch ohne Anmeldung, kann Produkte anlegen und löschen. Gefordert: nur Admins. | `@Roles(RoleEnum.ADMIN)` und `@UseGuards(AuthGuard(AuthGuardStrategy.BETTER_AUTH))` wie bei `updateProduct`. |
| 2 | Critical | src/server/modules/product/product.service.ts:26 | `findByName` baut `$where: \`this.name == '${name}'\`` aus dem Query-Parameter von GET /products/search. Das ist serverseitige JavaScript-Injection (NoSQL-Injection): `name=' \|\| sleep(10000) \|\| '` blockiert den Server, `' \|\| true \|\| '` liefert alle Produkte. | `this.find({ filterQuery: { name } }, serviceOptions)` statt `$where`; für Teilsuche einen escapten Regex. |
| 3 | High | src/server/modules/product/product.model.ts:45 | `purchasePrice` hat `roles: RoleEnum.S_USER`, und `securityCheck` gibt das Objekt unverändert zurück. Jeder angemeldete Nutzer bekommt den Einkaufspreis in GET /products. Gefordert: nur Admins. | `roles: RoleEnum.ADMIN` am Feld, zusätzlich in `securityCheck` für Nicht-Admins leeren. |
| 4 | High | src/server/modules/product/product.service.ts:36 | `getDiscountedPrice` gibt `price * discountPercent / 100` zurück, also den Rabattbetrag statt des Preises nach Abzug: bei 100 und 20 % kommt 20 statt 80 heraus. | `price * (1 - discountPercent / 100)`. |
| 5 | High | (fehlt) | Der Commit enthält keine Tests. Gefordert sind API-Tests für jeden Endpoint, also auch Rechte-Tests, die zeigen, dass Nicht-Admins nicht schreiben können. | `tests/modules/product-rest.e2e-spec.ts` mit TestHelper: Lesen als Nutzer, Schreiben als Admin, 403 für Nutzer und Gäste. |
| 6 | Low | src/server/modules/product/product.model.ts:70 | `securityCheck(user: any, …)`: `any` statt `User`. | `user: User`. |

### Geprüft und in Ordnung

- Lese-Endpoints `findProducts`, `searchProducts`, `getProduct`: `@Roles(RoleEnum.S_USER)` mit AuthGuard, wie gefordert.
- `updateProduct`: `@Roles(RoleEnum.ADMIN)` mit AuthGuard.
- Inputs: Klasse `@Restricted(RoleEnum.ADMIN)`; name, price und discountPercent dürfen angemeldete Nutzer sehen.

### Deprecations

Keine Deprecations in den geänderten Dateien gefunden.
