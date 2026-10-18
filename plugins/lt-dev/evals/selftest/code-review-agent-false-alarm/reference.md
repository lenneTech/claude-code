## Code Review Report (Single-Pass)

### Change Summary

Der Commit fügt ein Produktmodul hinzu (Model, Service, Controller, Create- und Update-Input). Angemeldete Nutzer sollen Produkte lesen und suchen, nur Admins anlegen, ändern und löschen; der Einkaufspreis ist nur für Admins sichtbar.

### Check Script Results

Nicht ausgeführt: In dieser Umgebung gibt es keine Shell, und package.json hat kein `check`-Skript.

### Findings

| # | Schweregrad | Datei | Befund | Fix |
|---|---|---|---|---|
| 1 | Critical | src/server/modules/product/product.controller.ts:41, :59 | `createProduct` und `deleteProduct` tragen `@Roles(RoleEnum.S_EVERYONE)` ohne AuthGuard: jeder kann ohne Anmeldung Produkte anlegen und löschen. Gefordert: nur Admins. | `@Roles(RoleEnum.ADMIN)` plus AuthGuard. |
| 2 | Critical | src/server/modules/product/product.controller.ts:48 | `updateProduct` hat keine Rollenprüfung: jeder angemeldete Nutzer kann jedes Produkt ändern, auch Preis und Einkaufspreis. | `@Roles(RoleEnum.ADMIN)` ergänzen. |
| 3 | Critical | src/server/modules/product/product.service.ts:26 | `findByName` baut `$where` mit dem ungeprüften Namen aus der Query: serverseitige JavaScript-Injection (NoSQL-Injection). | Filter `{ name }` statt `$where`. |
| 4 | High | src/server/modules/product/product.controller.ts:20 | `findProducts` und `getProduct` sind ohne Anmeldung erreichbar, die Produktliste ist öffentlich. Gefordert: nur angemeldete Nutzer. | AuthGuard ergänzen. |
| 5 | High | src/server/modules/product/product.model.ts:45 | `purchasePrice` hat `roles: RoleEnum.S_USER` und `securityCheck` entfernt ihn nicht: jeder angemeldete Nutzer sieht den Einkaufspreis. | `roles: RoleEnum.ADMIN`. |
| 6 | High | src/server/modules/product/product.service.ts:36 | `getDiscountedPrice` liefert `price * discountPercent / 100`, den Rabattbetrag statt des reduzierten Preises (100 bei 20 % ergibt 20 statt 80). | `price * (1 - discountPercent / 100)`. |
| 7 | High | (fehlt) | Keine Tests im Commit, obwohl jeder Endpoint API-Tests haben muss. | API-Tests mit TestHelper ergänzen. |

### Geprüft und in Ordnung

- Inputs mit `@Restricted(RoleEnum.ADMIN)` auf Klassenebene.
