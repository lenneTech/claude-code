## Review: fix/invoice-cents gegen main

**Ergebnis:** 1 Finding (1 Critical). Nicht behoben, weil Phase 6 in dieser Umgebung entfällt.

Änderung: `PricingService.grossPrice` liefert jetzt ganze Cent statt Euro; `InvoiceService.addLine` rechnet mit Cent und speichert Zeile und Summe atomar.

### Findings

| # | Schwere | Ort | Was passiert | Fix |
|---|---------|-----|--------------|-----|
| C1 | Critical | src/server/modules/cart/cart.service.ts:38 | Unberührter Aufrufer, durch diese Änderung gebrochen: `checkout` summiert `grossPrice(...)`, das seit diesem Diff schon Cent liefert, und übergibt `toCents(gross)` an `PaymentService.charge`, das Cent erwartet. Ein Warenkorb über 11,90 EUR wird mit 1190,00 EUR belastet, dem Hundertfachen. Gebrochen durch die Einheitenänderung von `grossPrice` in pricing.service.ts. | `this.paymentService.charge(cart.customer, gross)` ohne `toCents`; Regressionstest für den belasteten Betrag. |

### Geprüft und in Ordnung

- `CatalogService.cheapestFirst` und `freeItems` (catalog.service.ts) rufen `grossPrice` ebenfalls auf, sortieren aber nur und vergleichen mit 0; beides hängt nicht von der Einheit ab.
- `InvoiceService.addLine`: `findByIdAndUpdate` mit `$inc` und `$push` ist mit dem Informed-Trade-off-Kommentar begründet; das `this.get` davor lässt nur Ersteller und Admins durch, das `this.get` danach liefert das Ergebnis über `securityCheck`.
- Rechnungssumme: `grossPrice` liefert ganze Cent, `$inc` addiert ganze Zahlen; `totalCents` war vorher schon in Cent gespeichert, bestehende Rechnungen bleiben richtig.
- `InvoiceLineInput` validiert net, quantity und taxRate; der gepushte Eintrag wird von Mongoose gegen das Schema gecastet.

### Nicht berichtet

Nicht berichtet: 3 (Gate 1 nicht belegt: 1 · Gate 2 unter High: 2)

### Check-Pipeline

Nicht ausgeführt: In dieser Umgebung gibt es keine Shell.

Nicht geprüft: check-Skript und Tests (keine Shell), Browser-Durchlauf (Phase 7 entfällt).
