import 'tsconfig-paths/register';
import { afterEach } from 'vitest';
import { rateLimitStore } from 'src/middleware/rateLimiter';

// Reset the in-memory rate-limit store after every test so feature-specific
// limiters (account-linking 10/hr, privacy 20/hr) don't bleed across test cases.
afterEach(() => {
    rateLimitStore.clear();
});
