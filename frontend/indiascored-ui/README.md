# IndiaScored — Frontend

React 19 + TypeScript + Vite. Two audiences in one app: the applicant journey
and the underwriter's console. Built by Akshat Sarkar.

## Layout

```
src/
  app/            Clerk auth, query/tooltip/toast providers, routes
  features/
    landing/      public landing page
    auth/         sign in, sign up, post-sign-in fork, underwriter login
    onboarding/   profile form, Aadhaar OCR + face check
    psychometric/ the timed behavioural assessment
    applications/ the four-step apply flow and application history
    dashboard/    the applicant's score, loans and notifications
    underwriting/ the review console and the per-applicant credit report
    support/      help screens
  shared/         shadcn/radix primitives, hooks, shared chrome
  lib/
    api.ts        the single typed client for every backend call
    types.ts      contracts mirroring the backend's pydantic schemas
    format.ts     rupee, percent, date and score formatting
```

Every backend call goes through `lib/api.ts`. The base URL, JSON handling and
error shape are defined once there rather than at each call site, so pointing
the app at a different backend is one environment variable.

## Running

```bash
npm install
cp .env.example .env    # VITE_CLERK_PUBLISHABLE_KEY and VITE_API_BASE_URL
npm run dev             # http://localhost:5173
```

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```
