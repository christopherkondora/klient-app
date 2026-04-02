---
name: hungarian-localization
description: Use this skill when working with Hungarian-specific features - covers date/number formatting, NAV tax compliance, locale conventions, and Hungarian UI text. Essential for any feature that involves Hungarian business logic or user-facing text.
---

# Hungarian Localization & NAV Compliance

## Overview

Klient is designed specifically for the Hungarian market with deep integration into Hungarian business practices, tax regulations, and localization conventions.

**Target Market:** Hungary (HU)
**Language:** Hungarian only (no i18n yet)
**Currency:** HUF (Hungarian Forint)
**Tax Authority:** NAV (Nemzeti Adó- és Vámhivatal)

---

## Date & Time Formatting

### Hungarian Date Format

**Standard:** `YYYY. MM. DD.` (e.g., `2026. 03. 28.`)

**With day of week:** `YYYY. MMMM D., dddd` (e.g., `2026. március 28., péntek`)

**Library:** date-fns with Hungarian locale

**Usage:**
```typescript
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';

// Standard date
const date = format(new Date(), 'yyyy. MM. dd.', { locale: hu });
// Output: "2026. 03. 28."

// Long date with day of week
const longDate = format(new Date(), 'yyyy. MMMM d., EEEE', { locale: hu });
// Output: "2026. március 28., péntek"

// Short date
const shortDate = format(new Date(), 'MM. dd.', { locale: hu });
// Output: "03. 28."
```

### Time Format

**Standard:** 24-hour format (e.g., `14:30`)

**Usage:**
```typescript
const time = format(new Date(), 'HH:mm');
// Output: "14:30"
```

### Relative Time

**Hungarian phrases:**
- "ma" - today
- "tegnap" - yesterday
- "holnap" - tomorrow
- "2 napja" - 2 days ago
- "3 hét múlva" - in 3 weeks

**Implementation:** Custom function or date-fns `formatRelative`

---

## Number Formatting

### Hungarian Number Format

**Decimal separator:** `,` (comma)
**Thousands separator:** ` ` (space) or `.` (dot)

**Examples:**
- `1 000` or `1.000` (one thousand)
- `1 234 567,89` (one million two hundred thirty-four thousand five hundred sixty-seven point eighty-nine)

**Currency:**
- `3 990 Ft` (space before currency symbol)
- `39 900 Ft`

**Usage:**
```typescript
// Using Intl.NumberFormat
const formatter = new Intl.NumberFormat('hu-HU', {
  style: 'currency',
  currency: 'HUF',
  maximumFractionDigits: 0, // No decimals for HUF
});

const formatted = formatter.format(3990);
// Output: "3 990 Ft"
```

**Note:** HUF does not use decimal places (no fillér coins since 1999)

---

## Currency

### Hungarian Forint (HUF)

**Symbol:** Ft (placed after the number)

**Smallest unit:** 1 Ft (no subdivisions)

**Common amounts:**
- Small: 1 000 Ft
- Medium: 10 000 Ft
- Large: 100 000 Ft

**Rounding:** Amounts are rounded to the nearest 5 Ft for cash transactions (electronic transactions can be exact)

**Stripe Conversion:** Stripe uses smallest currency unit (cents), so 1 Ft = 1 in Stripe API (no conversion needed)

---

## NAV Tax Compliance

### What is NAV?

**NAV:** Nemzeti Adó- és Vámhivatal (Hungarian Tax and Customs Authority)

**Responsibilities:**
- Tax collection
- Invoice validation
- Online reporting system (Online Számla)

### Online Invoice Reporting

**Requirement:** All businesses must report invoices to NAV within 24 hours of issuance

**How Klient Handles This:** Billingo automatically reports invoices to NAV (we don't need to implement this ourselves)

**Important:** Ensure Billingo invoices meet NAV format requirements:
- Include VAT registration number (if B2B)
- Correct VAT rate (27%, 18%, 5%, or 0%)
- Hungarian language
- Electronic format (PDF with embedded data)

### VAT Rates (ÁFA)

**Standard Rate:** 27% (highest in EU)
**Reduced Rates:**
- 18% - Dairy products, flour, hotel accommodation
- 5% - Books, newspapers, medicines, internet access
- 0% - Export sales

**Klient Usage:** Currently only uses 27% (hardcoded in Billingo integration)

**Billingo Format:** `"vat": "27%"` (string, not number)

---

## Hungarian UI Text

### Common UI Strings

**Actions:**
- "Mentés" - Save
- "Mégse" - Cancel
- "Törlés" - Delete
- "Szerkesztés" - Edit
- "Hozzáadás" - Add
- "Bezárás" - Close
- "Vissza" - Back
- "Folytatás" - Continue

**Status:**
- "Aktív" - Active
- "Inaktív" - Inactive
- "Befejezett" - Completed
- "Folyamatban" - In progress
- "Szüneteltetve" - On hold
- "Törölve" - Cancelled
- "Lejárt" - Expired

**Time:**
- "ma" - today
- "tegnap" - yesterday
- "holnap" - tomorrow
- "hétfő" - Monday
- "kedd" - Tuesday
- "szerda" - Wednesday
- "csütörtök" - Thursday
- "péntek" - Friday
- "szombat" - Saturday
- "vasárnap" - Sunday

**Months:**
- "január", "február", "március", "április", "május", "június"
- "július", "augusztus", "szeptember", "október", "november", "december"

**Financial:**
- "Bevétel" - Revenue
- "Kiadás" - Expense
- "Számla" - Invoice
- "Átutalás" - Bank transfer
- "Készpénz" - Cash
- "Bankkártya" - Credit card

### Capitalization Rules

**Sentence case:** Hungarian uses lowercase for days, months, and most nouns

**Examples:**
- ✅ "2026. március 28., péntek"
- ❌ "2026. Március 28., Péntek"

**Exception:** First word of sentence, proper nouns

---

## Business Entity Types

### Common Hungarian Business Forms

**Egyéni vállalkozó (EV):** Sole proprietor
**Bt. (Betéti társaság):** General partnership
**Kft. (Korlátolt felelősségű társaság):** Limited liability company (most common)
**Zrt. (Zártkörűen működő részvénytársaság):** Private joint-stock company
**Nyrt. (Nyilvánosan működő részvénytársaság):** Public joint-stock company

**Klient Target:** EV and Kft. (freelancers and small agencies)

---

## Tax Identification Numbers

### Adószám (Tax Number)

**Format:** `XXXXXXXX-Y-ZZ`
- 8 digits - Company identifier
- 1 digit - Check digit
- 2 digits - Regional code

**Example:** `12345678-2-42`

**Validation:** Check digit algorithm (complex, not implemented)

**Storage:** Store as string with hyphens

### EU VAT Number (Közösségi Adószám)

**Format:** `HU` + 8 digits

**Example:** `HU12345678`

**Used for:** Intra-EU transactions

---

## Address Format

### Hungarian Address Format

**Format:**
```
{Street} {House Number}
{City}, {Postal Code}
{Country}
```

**Example:**
```
Andrássy út 42.
Budapest, 1061
Magyarország
```

**Postal Code:** 4 digits (e.g., `1061` for Budapest District VI)

**Important:** Postal code comes AFTER city name (opposite of many countries)

---

## Invoice Requirements

### Mandatory Fields (NAV)

**Seller Information:**
- Company name
- Tax number (adószám)
- Address
- VAT registration number (if applicable)

**Buyer Information:**
- Name (or company name)
- Address (if amount > 300,000 Ft)
- Tax number (if B2B)

**Invoice Details:**
- Invoice number (sequential)
- Issue date
- Performance date (teljesítés dátuma)
- Due date (fizetési határidő)
- Currency (HUF)
- Payment method

**Line Items:**
- Description
- Quantity
- Unit price (net)
- VAT rate
- VAT amount
- Total (gross)

**Totals:**
- Net total
- VAT amount (by rate)
- Gross total

**Note:** Billingo handles all these fields automatically

---

## Payment Methods

### Common in Hungary

**Átutalás (Bank transfer):** Most common for B2B
**Bankkártya (Credit/debit card):** Online payments
**Készpénz (Cash):** Less common, discouraged for large amounts
**Szép kártya (SZÉP card):** Employee benefit card (tourism, hospitality, food)

**Klient:** Currently supports bank transfer (via Stripe) and credit card (Stripe)

---

## Calendar & Holidays

### Hungarian Public Holidays

**Fixed:**
- January 1 - Újév (New Year)
- March 15 - Nemzeti ünnep (National Day)
- May 1 - Munka ünnepe (Labor Day)
- August 20 - Szent István napja (St. Stephen's Day)
- October 23 - Nemzeti ünnep (National Day)
- November 1 - Mindenszentek (All Saints' Day)
- December 25-26 - Karácsony (Christmas)

**Variable:**
- Easter Monday (Húsvéthétfő)
- Pentecost Monday (Pünkösdhétfő)

**Work Days:** Monday-Friday (business days)
**Weekend:** Saturday-Sunday

---

## Localization Best Practices

### String Externalization

**Current:** All strings hardcoded in components

**Recommendation for i18n (future):**
```typescript
// Instead of:
<button>Mentés</button>

// Use:
<button>{t('common.save')}</button>
```

**Library:** react-i18next (when/if adding i18n)

### Pluralization

**Hungarian plural rules:**
- Most nouns: add `-k` or `-ek`
- Count is after noun: "2 projekt" (not "projektek")

**Examples:**
- 1 projekt - one project
- 2 projekt - two projects
- 5 projekt - five projects

### Name Format

**Hungarian:** Family name comes FIRST

**Examples:**
- "Kovács János" (Kovács is family name)
- "Nagy Anna"

**Klient:** Stores as single `name` field (no first/last split)

---

## Error Messages (Hungarian)

**Examples:**
- "Hiba történt" - An error occurred
- "Nem sikerült betölteni" - Failed to load
- "Érvénytelen adat" - Invalid data
- "Kötelező mező" - Required field
- "Túl hosszú" - Too long
- "Túl rövid" - Too short
- "Már létezik" - Already exists
- "Nem található" - Not found

---

## Compliance Checklist

Before production launch:

- [ ] Verify Billingo invoice format meets NAV requirements
- [ ] Consult with Hungarian accountant on tax compliance
- [ ] Ensure VAT calculations are correct (27%)
- [ ] Verify address format matches Hungarian standard
- [ ] Test invoice generation for both EV and Kft. clients
- [ ] Confirm tax number (adószám) validation (if collecting)
- [ ] Check that dates are formatted correctly (YYYY. MM. DD.)
- [ ] Verify currency formatting (space before "Ft")
- [ ] Test with Hungarian special characters (ő, ű, á, é, etc.)

---

## Hungarian Character Set

**Special Characters:**
- á, é, í, ó, ö, ő, ú, ü, ű
- Á, É, Í, Ó, Ö, Ő, Ú, Ü, Ű

**Database:** UTF-8 encoding (SQLite + Supabase)

**Important:** Ensure all text inputs and displays support Hungarian characters

---

## Resources

**NAV Online Invoice System:**
https://onlineszamla.nav.gov.hu/

**Billingo:**
https://www.billingo.hu/

**Hungarian Locale (date-fns):**
https://date-fns.org/v4.1.0/docs/I18n

**Hungarian Tax Law:**
https://nav.gov.hu/

---

## Future Considerations

### Multi-Language Support

**Current:** Hungarian only

**Future:** If expanding to other countries:
- Extract all UI strings to i18n files
- Add language switcher in Settings
- Support multiple currencies (EUR, USD, etc.)
- Adapt tax calculations to local regulations

**Priority:** Low (Hungarian market is primary focus)

### Multi-Currency

**Current:** HUF only

**Future:** If working with international clients:
- Allow users to set client currency
- Convert amounts for reporting
- Display exchange rates

**Priority:** Low (most Hungarian freelancers work in HUF)

---

## Quick Reference

**Date Format:** `2026. 03. 28.`
**Time Format:** `14:30`
**Currency:** `3 990 Ft`
**VAT Rate:** `27%`
**Tax Number:** `12345678-2-42`
**Address:** `Andrássy út 42. Budapest, 1061`

**Common UI:**
- Save: Mentés
- Cancel: Mégse
- Delete: Törlés
- Error: Hiba történt
