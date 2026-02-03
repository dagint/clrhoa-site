# Testing Guide

This directory contains tests for the Crooked Lake Reserve HOA website.

## Test Setup

The project uses [Vitest](https://vitest.dev/) for testing, which is fast and compatible with modern JavaScript/TypeScript.

## Running Tests

```bash
# Run tests in watch mode (recommended for development)
npm test

# Run tests once
npm test -- --run

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

```
tests/
├── setup.ts           # Test configuration and setup
├── utils.test.ts      # Utility function tests
└── README.md          # This file
```

## Writing Tests

### Example Test

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

## Testing Astro Components

For testing Astro components, you can use:

1. **Component rendering tests** - Test component output
2. **Integration tests** - Test component behavior
3. **E2E tests** - Test full user flows (consider Playwright or Cypress)

### Example Component Test

```typescript
import { describe, it, expect } from 'vitest';
// Import your component or test its rendered output

describe('ContactForm', () => {
  it('should render form fields', () => {
    // Test implementation
  });
});
```

## Testing Best Practices

1. **Test behavior, not implementation** - Focus on what the code does, not how
2. **Keep tests simple** - One assertion per test when possible
3. **Use descriptive test names** - "should validate email format" not "test1"
4. **Test edge cases** - Empty inputs, invalid data, etc.
5. **Mock external dependencies** - Don't make real API calls in tests

## Coverage Goals

- Aim for 80%+ coverage on critical paths
- Focus on user-facing functionality
- Don't obsess over 100% coverage (it's often not worth it)

## Future Test Additions

Consider adding:

- **Component tests** for form validation
- **Integration tests** for navigation
- **E2E tests** for critical user flows (contact form submission, etc.)
- **Accessibility tests** using tools like axe-core
- **Visual regression tests** for UI consistency

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Astro Testing Guide](https://docs.astro.build/en/guides/testing/)
