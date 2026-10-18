## Code Review Report (Single-Pass)

### Change Summary

Der Commit fügt ein Produktmodul mit Suche und Lagerreservierung hinzu.

### Check Script Results

Nicht ausgeführt: In dieser Umgebung gibt es keine Shell, und package.json hat kein `check`-Skript.

### Findings

| # | Schweregrad | Datei | Befund | Fix |
|---|---|---|---|---|
| 1 | Medium | src/server/modules/product/product.service.ts:29-37 | `reserveStock` prüft den Bestand korrekt vor dem Abzug; die Menge wird aber nicht auf positive Werte geprüft, eine negative Menge erhöht den Bestand. | `Min(1)` am Parameter. |
| 2 | Medium | src/server/modules/product/product.service.ts:18 | `search` sucht per `RegExp` ohne Index; bei vielen Produkten wird das langsam. | Textindex auf `name`. |
| 3 | Low | src/server/modules/product/product.service.ts:20 | `page` wird nicht auf Werte ab 1 geprüft; `page=0` oder negativ liefert unerwartete Ergebnisse. | `Min(1)` für `page`. |
| 4 | Low | src/server/modules/product/inputs/product.input.ts:11 | `createdBy` hat keinen ObjectId-Validator. | `IsMongoId()` ergänzen. |
| 5 | Low | src/server/modules/product/product.model.ts:58 | `securityCheck` könnte für bessere Lesbarkeit früh zurückkehren. | Umstellen. |
| 6 | Info | src/server/modules/product/product.controller.ts | Swagger-Beschreibungen fehlen an den Endpoints. | `@ApiOperation` ergänzen. |

### Geprüft und in Ordnung

- Controller-weiter AuthGuard; Rollen der Endpoints wie gefordert.
- Der Einkaufspreis wird in `securityCheck` für Nicht-Ersteller entfernt.
- Die Suche ist case-insensitive, wie für eine Namenssuche üblich.
