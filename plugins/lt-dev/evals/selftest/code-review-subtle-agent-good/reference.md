## Code Review Report (Single-Pass)

### Change Summary

Der Commit fügt ein Produktmodul mit Suche und Lagerreservierung hinzu. Angemeldete Nutzer legen Produkte an, Ersteller und Admins ändern sie, nur Admins dürfen den Ersteller ändern; der Einkaufspreis ist für Admins und den Ersteller sichtbar; die Suche ist paginiert (Seiten ab 1) und eine Klartextsuche; eine Reservierung darf den Bestand nie negativ machen, auch bei parallelen Bestellungen.

### Check Script Results

Nicht ausgeführt: In dieser Umgebung gibt es keine Shell, und package.json hat kein `check`-Skript.

### Findings

| # | Schweregrad | Datei | Befund | Fix |
|---|---|---|---|---|
| 1 | Critical | src/server/modules/product/product.service.ts:29-37 | `reserveStock` liest das Produkt, prüft `stock < quantity`, zieht im Speicher ab und speichert. Zwei gleichzeitige Bestellungen bestehen beide die Prüfung und überbuchen (Lost Update): bei Bestand 1 und zwei parallelen Reservierungen über 1 werden beide bestätigt. | Atomar: `findOneAndUpdate({ _id: id, stock: { $gte: quantity } }, { $inc: { stock: -quantity } }, { new: true })`, bei `null` ablehnen. |
| 2 | High | src/server/modules/product/inputs/product.input.ts:11 | `createdBy` steht mit `roles: RoleEnum.S_USER` im Input, Create und Update übernehmen es. Ein Nutzer setzt `createdBy` auf seine eigene ID und wird damit über `S_CREATOR` zum Ersteller fremder Produkte (Übernahme), oder legt Produkte unter fremdem Namen an. Gefordert: nur Admins ändern den Ersteller. | `roles: RoleEnum.ADMIN` für `createdBy` im Input. |
| 3 | High | src/server/modules/product/product.service.ts:18 | `search` baut `new RegExp(name, 'i')` aus dem Query-Parameter. Sonderzeichen ändern die Abfrage, ein Muster wie `(a+)+$` legt die Datenbank per katastrophalem Backtracking lahm (ReDoS). Gefordert: Klartextsuche. | Eingabe escapen (`name.replace(/[.*+?^${}()\|[\]\\]/g, '\\$&')`). |
| 4 | High | src/server/modules/product/product.model.ts:58 | `securityCheck` vergleicht `this.createdBy !== user?.id`: `createdBy` ist eine ObjectId, `user.id` ein String, der strikte Vergleich ist immer ungleich. Der Ersteller sieht seinen Einkaufspreis nie, entgegen der Anforderung. | `equalIds(this.createdBy, user)` oder `String(this.createdBy) === user?.id`. |
| 5 | High | src/server/modules/product/product.service.ts:20 | `skip(page * limit)` bei Seiten ab 1: Seite 1 überspringt die ersten `limit` Treffer, die erste Seite ist nie abrufbar. | `skip((page - 1) * limit)`. |
| 6 | High | (fehlt) | Keine Tests im Commit; jeder Endpoint braucht API-Tests, auch für die Nebenläufigkeit der Reservierung. | API-Tests mit TestHelper ergänzen. |
| 7 | Medium | src/server/modules/product/product.controller.ts:61 | `quantity` wird nur als Integer geprüft; eine negative Menge erhöht den Bestand. | `Min(1)` validieren. |

### Geprüft und in Ordnung

- Controller-weiter AuthGuard; Lesen und Anlegen mit `S_USER` wie gefordert.
- Update auf Admins und Ersteller beschränkt (`roles: [ADMIN, S_CREATOR]`).
- `stock` im Input nur für Admins schreibbar; `limit` auf 100 begrenzt.
