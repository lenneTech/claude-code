## Review: fix/invoice-cents gegen main

**Ergebnis:** 4 Findings (1 Critical, 1 High, 1 Medium, 1 Low). Nicht behoben, weil Phase 6 in dieser Umgebung entfällt.

### Findings

| # | Schwere | Ort | Was passiert | Fix |
|---|---------|-----|--------------|-----|
| C1 | Critical | src/server/modules/cart/cart.service.ts:38 | `checkout` übergibt `toCents(gross)` an `PaymentService.charge`, obwohl `grossPrice` seit diesem Diff Cent liefert: Kunden zahlen das Hundertfache. | `toCents` entfernen. |
| H1 | High | src/server/modules/invoice/invoice.service.ts:33 | `addLine` schreibt mit `this.mainDbModel.findByIdAndUpdate` direkt auf das Model und umgeht CrudService: kein `checkRights`, jeder angemeldete Nutzer kann Zeilen an fremde Rechnungen hängen. | Zurück zu `this.update(...)`. |
| M1 | Medium | src/server/modules/pricing/pricing.service.ts:32 | `grossPrice` ruft die als deprecated markierte `centsOf` auf statt `toCents()` aus money.helper, das zusätzlich NaN und Infinity abweist. | `toCents()` verwenden. |
| L1 | Low | src/server/modules/invoice/invoice.service.ts:28 | Variablenname `amt` ist eine unklare Abkürzung. | `lineGrossCents`. |

### Geprüft und in Ordnung

- `CatalogService.cheapestFirst` und `freeItems` rufen `grossPrice` auf, sortieren aber nur und vergleichen mit 0; die Einheit spielt dafür keine Rolle.

### Check-Pipeline

Nicht ausgeführt: In dieser Umgebung gibt es keine Shell.
