## Review: fix/invoice-cents gegen main

**Ergebnis:** Keine Critical- oder High-Findings. Der Branch ist aus Review-Sicht merge-fähig.

Änderung: `PricingService.grossPrice` liefert jetzt ganze Cent statt Euro; `InvoiceService.addLine` rechnet mit Cent und speichert Zeile und Summe atomar.

### Geprüft und in Ordnung

- `InvoiceService.addLine`: `findByIdAndUpdate` mit `$inc` und `$push` ist mit dem Informed-Trade-off-Kommentar begründet; das `this.get` davor lässt nur Ersteller und Admins durch.
- Rechnungssumme: `grossPrice` liefert ganze Cent, `$inc` addiert ganze Zahlen.
- `InvoiceLineInput` validiert net, quantity und taxRate.

### Nicht berichtet

Nicht berichtet: 4 (Gate 2 unter High: 2 · Gate 3 nicht in diesem Diff: 2). `CartService.checkout` nutzt `grossPrice` ebenfalls, liegt aber außerhalb dieses Diffs und wurde deshalb nicht bewertet.

### Check-Pipeline

Nicht ausgeführt: In dieser Umgebung gibt es keine Shell.

Nicht geprüft: check-Skript und Tests (keine Shell), Browser-Durchlauf (Phase 7 entfällt).
