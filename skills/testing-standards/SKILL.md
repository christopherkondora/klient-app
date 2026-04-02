---
name: testing-standards
description: Testing standards for Klient - test framework usage, file naming conventions, unit vs integration testing approach, how to run tests, minimum coverage expectations. Essential for QA work.
---

# Klient Testing Standards

## Test Framework

**Primary Framework:** Vitest 3.x
- Fast, Vite-native test runner
- Compatible with Jest API
- Built-in coverage via v8

**UI Testing:** React Testing Library
- User-centric testing approach
- Query by accessibility roles and labels
- Avoid implementation details

## File Structure & Naming

### Unit Tests
```
src/
  components/
    Button.tsx
    Button.test.tsx    ← unit test alongside component
  utils/
    formatCurrency.ts
    formatCurrency.test.ts
```

### Integration Tests
```
src/
  features/
    invoicing/
      __tests__/
        invoice-creation.integration.test.ts
```

### E2E Tests (Future)
```
tests/
  e2e/
    user-workflows/
      create-invoice.spec.ts
```

## Naming Conventions

- **Unit tests:** `*.test.ts` or `*.test.tsx`
- **Integration tests:** `*.integration.test.ts`
- **E2E tests:** `*.spec.ts`
- **Test suites:** `describe('ComponentName', () => {})`
- **Test cases:** `it('should do something specific', () => {})`

## What to Test

### Unit Tests (Priority: High)
- **Pure functions** (formatters, validators, calculators)
- **Component logic** (state changes, event handlers)
- **Hooks** (custom React hooks)
- **Utilities** (date, currency, business logic)

Example:
```typescript
describe('formatCurrency', () => {
  it('should format HUF amounts with proper grouping', () => {
    expect(formatCurrency(1000000, 'HUF')).toBe('1 000 000 Ft')
  })
})
```

### Integration Tests (Priority: Medium)
- **Feature workflows** (creating an invoice end-to-end in memory)
- **API integrations** (Billingo, Stripe - use test mode)
- **Database operations** (SQL.js queries, Supabase interactions)
- **State management** (Zustand store interactions)

Example:
```typescript
describe('Invoice Creation Workflow', () => {
  it('should create invoice, calculate totals, and save to local DB', async () => {
    // Test full feature without UI
  })
})
```

### What NOT to Test
- Third-party library internals
- Simple prop passing with no logic
- Trivial getters/setters
- Auto-generated code

## Running Tests

### All Tests
```bash
npm run test
```

### Watch Mode (Development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Single File
```bash
npm run test src/utils/formatCurrency.test.ts
```

## Coverage Expectations

**Minimum Coverage Targets:**
- **Statements:** 70%
- **Branches:** 65%
- **Functions:** 70%
- **Lines:** 70%

**Critical Areas (90%+ coverage):**
- Financial calculations (invoicing, tax, currency)
- Authentication & authorization logic
- Data validation & sanitization
- Billingo/Stripe integration handlers

**Lower Priority (<50% acceptable):**
- UI styling logic
- Simple component wrappers
- Development/debug utilities

## Test Organization

### Arrange-Act-Assert Pattern
```typescript
it('should calculate invoice total with VAT', () => {
  // Arrange
  const lineItems = [
    { netPrice: 10000, vatRate: 0.27 },
    { netPrice: 5000, vatRate: 0.27 }
  ]

  // Act
  const total = calculateInvoiceTotal(lineItems)

  // Assert
  expect(total.gross).toBe(19050)
  expect(total.vat).toBe(4050)
})
```

### Group Related Tests
```typescript
describe('Invoice', () => {
  describe('creation', () => {
    it('should validate required fields', () => {})
    it('should auto-generate invoice number', () => {})
  })

  describe('calculation', () => {
    it('should calculate VAT correctly', () => {})
    it('should handle multiple currencies', () => {})
  })
})
```

## Mocking Strategy

### API Calls
- **Billingo/Stripe:** Use test mode endpoints when possible
- **Supabase:** Mock responses for unit tests, use test project for integration
- **External APIs:** Use MSW (Mock Service Worker) or vitest mocks

### Local Database
- **Unit tests:** Mock SQL.js queries
- **Integration tests:** Use in-memory SQL.js instance (fast, isolated)

### Example Mock
```typescript
import { vi } from 'vitest'

vi.mock('../api/billingo', () => ({
  createInvoice: vi.fn().mockResolvedValue({ id: 'test-123' })
}))
```

## Common Patterns

### Testing Async Operations
```typescript
it('should fetch client data', async () => {
  const client = await fetchClient('client-id')
  expect(client).toEqual({ name: 'Test Client' })
})
```

### Testing React Components
```typescript
import { render, screen, fireEvent } from '@testing-library/react'

it('should show error on invalid input', () => {
  render(<InvoiceForm />)

  const input = screen.getByLabelText('Összeg')
  fireEvent.change(input, { target: { value: '-100' } })

  expect(screen.getByText('Érvénytelen összeg')).toBeInTheDocument()
})
```

### Testing Zustand Stores
```typescript
import { useInvoiceStore } from '../stores/invoice'

it('should add invoice to store', () => {
  const { addInvoice, invoices } = useInvoiceStore.getState()

  addInvoice({ id: '1', amount: 1000 })

  expect(invoices).toHaveLength(1)
  expect(invoices[0].amount).toBe(1000)
})
```

## CI/CD Integration (Future)

When CI is set up:
- All tests must pass before merge
- Coverage must meet minimums
- No regressions in coverage (enforce with `--coverage-reporter=json-summary`)

## When to Skip Tests

Use `it.skip()` or `describe.skip()` only when:
- Test is flaky and requires investigation
- Feature is experimental and not shipped
- External dependency is temporarily unavailable

Always add a comment explaining why:
```typescript
it.skip('should sync with Billingo', () => {
  // TODO: Billingo test API is down, re-enable when fixed
})
```

---

**Note for QA Agent:** These standards balance thoroughness with pragmatism. Focus test effort on business-critical paths (financial calculations, integrations, data integrity). Use test mode APIs where available. When in doubt, write the test.
