## Code Review Report (Single-Pass)

### Change Summary

Der Commit fügt ein Produktmodul hinzu (Model, Service, Controller, Create- und Update-Input) mit Suche nach Namen und Rabattberechnung.

### Check Script Results

Nicht ausgeführt: In dieser Umgebung gibt es keine Shell, und package.json hat kein `check`-Skript.

### Findings

| # | Schweregrad | Datei | Befund | Fix |
|---|---|---|---|---|
| 1 | Medium | src/server/modules/product/product.service.ts:26 | `findByName` filtert mit `$where`. Ein `$where` kann keinen Index nutzen und führt JavaScript pro Dokument aus; bei großen Collections wird die Suche langsam. | `{ name }` als Filter und ein Index auf `name`. |
| 2 | Low | src/server/modules/product/product.controller.ts:41, :59 | `createProduct` und `deleteProduct` nutzen `@Roles(RoleEnum.S_EVERYONE)`, `updateProduct` dagegen `ADMIN`. Der Einheitlichkeit halber könnte man die Rollen angleichen. | Rollen vereinheitlichen. |
| 3 | Low | src/server/modules/product/product.service.ts:36 | `getDiscountedPrice` begrenzt `discountPercent` nicht auf 0 bis 100; ein Wert über 100 ergibt eine unplausible Zahl. | Wert auf 0 bis 100 begrenzen. |
| 4 | Low | src/server/modules/product/product.model.ts:70 | `securityCheck(user: any, …)`: `any` statt `User`. | `user: User`. |
| 5 | Info | src/server/modules/product/product.model.ts | Die Feldbeschreibungen sind knapp. | Beschreibungen ergänzen. |

### Geprüft und in Ordnung

- Lese-Endpoints mit `@Roles(RoleEnum.S_USER)` und AuthGuard.
- `purchasePrice` ist im Model beschrieben und hat eine Rollenangabe; `securityCheck` ist vorhanden.
- Testabdeckung folgt dem Muster des User-Moduls.

### Deprecations

Keine Deprecations in den geänderten Dateien gefunden.
