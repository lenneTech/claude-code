## Code Review Report (Single-Pass)

### Change Summary

Der Commit fügt ein Produktmodul mit Suche und Lagerreservierung hinzu.

### Check Script Results

Nicht ausgeführt: In dieser Umgebung gibt es keine Shell, und package.json hat kein `check`-Skript.

### Findings

| # | Schweregrad | Datei | Befund | Fix |
|---|---|---|---|---|
| 1 | Critical | src/server/modules/product/product.controller.ts:21 | `search` und `getProduct` haben keinen AuthGuard: die Produktsuche ist ohne Anmeldung erreichbar und liefert Daten an Gäste. | `@UseGuards(AuthGuard(...))` an jedem Endpoint. |
| 2 | Critical | src/server/modules/product/product.service.ts:29-37 | `reserveStock`: Lesen, Prüfen, Schreiben ohne Atomarität; parallele Bestellungen überbuchen den Bestand (Race Condition). | Bedingtes `findOneAndUpdate` mit `$inc` und `stock: { $gte: quantity }`. |
| 3 | High | src/server/modules/product/product.controller.ts:26 | `limit` ist nicht begrenzt; `limit=1000000` lädt die ganze Collection (DoS). | `limit` begrenzen. |
| 4 | High | src/server/modules/product/inputs/product.input.ts:11 | `createdBy` ist für Nutzer schreibbar; ein Nutzer übernimmt so fremde Produkte über `S_CREATOR`. | `roles: RoleEnum.ADMIN`. |
| 5 | High | src/server/modules/product/product.service.ts:18 | `new RegExp(name, 'i')` aus Nutzereingabe: Regex-Injection und ReDoS. | Eingabe escapen. |
| 6 | High | src/server/modules/product/product.model.ts:58 | `this.createdBy !== user?.id` vergleicht ObjectId mit String und ist immer ungleich; der Ersteller sieht seinen Einkaufspreis nie. | `equalIds(...)`. |
| 7 | High | src/server/modules/product/product.service.ts:20 | `skip(page * limit)` mit Seiten ab 1 überspringt die erste Seite. | `(page - 1) * limit`. |
| 8 | High | (fehlt) | Keine Tests im Commit. | API-Tests ergänzen. |

### Geprüft und in Ordnung

- Update auf Admins und Ersteller beschränkt.
