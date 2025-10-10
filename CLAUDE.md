# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development

- `npm run dev` - Start development server (Vite on port 3000)
- `npm run build` - Build production bundle
- `npm run serve` - Preview production build locally
- `npm run deploy` - Deploy to Cloudflare Workers

### Testing

- `npm test` - Run all tests with Vitest

### Code Quality & Linting

- `npm run lint` - Run ESLint on entire codebase
- `npm run format` - Run Prettier formatter
- `npm run check` - Format and fix lint errors (Prettier + ESLint --fix)
- `npx eslint <file-path>` - Run ESLint on specific file
- `npx eslint <file-path> --fix` - Auto-fix ESLint errors where possible

### Database Operations

- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:migrate:local` - Apply migrations to local D1 database
- `npm run db:migrate:prod` - Apply migrations to production D1 database
- `npm run db:studio` - Open Drizzle Studio for local database inspection
- `npm run db:studio:prod` - Open Drizzle Studio for production database

## Architecture Overview

### TanStack Start v1.132+ Architecture

This project uses **TanStack Start v1.132** which has significant differences from v1.120:

**Key Changes:**
- Uses **Vite** instead of Vinxi as build tool
- Different routing patterns (simpler, more consistent)
- New file structure conventions
- Improved TypeScript support
- Better Cloudflare Workers integration

**Critical Files:**
- `vite.config.ts` - Vite + TanStack Router + Cloudflare plugin configuration
- `src/routes/__root.tsx` - Root shell component (not just a route)
- `app.config.ts` - TanStack Start application config (if present)

### Routing in v1.132

**File-Based Routing:**
- `src/routes/index.tsx` → `/`
- `src/routes/about.tsx` → `/about`
- `src/routes/posts/[id].tsx` → `/posts/:id`
- `src/routes/__root.tsx` → Shell component (wraps all routes)

**Route Export Pattern:**
```typescript
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return <div>About</div>
}
```

**API Routes:**
```typescript
import { createAPIFileRoute } from '@tanstack/react-router'

export const APIRoute = createAPIFileRoute('/api/upload')({
  GET: async ({ request }) => {
    return Response.json({ message: 'Hello' })
  },
  POST: async ({ request }) => {
    // Handle POST
  },
})
```

### Root Component Pattern (v1.132)

The `__root.tsx` file uses `shell

Component` instead of regular component:

```typescript
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'hilm.ai' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

### Cloudflare Workers Integration

**Vite Config with Cloudflare:**
```typescript
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    cloudflare({
      // Cloudflare-specific config
    }),
  ],
})
```

**Accessing Cloudflare Bindings:**
```typescript
// In API routes
export const APIRoute = createAPIFileRoute('/api/data')({
  GET: async ({ request, context }) => {
    // Access D1 database
    const db = context.cloudflare.env.DB

    // Use bindings
    return Response.json({ success: true })
  },
})
```

## Key Development Patterns

### Database Access Pattern

**Always use Cloudflare context to access D1:**

```typescript
// ✅ Correct - Access via context
export const APIRoute = createAPIFileRoute('/api/data')({
  GET: async ({ context }) => {
    const db = context.cloudflare.env.DB
    const drizzle = createDB(db)
    return drizzle.select().from(users)
  },
})

// ❌ Wrong - No static connections
const staticDB = createDB(someGlobal)
```

### Component Patterns

**Page Components:**
```typescript
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
})

function Dashboard() {
  return <div>Dashboard</div>
}
```

**Layout Components:**
```typescript
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout')({
  component: Layout,
})

function Layout() {
  return (
    <div>
      <nav>Navigation</nav>
      <Outlet />
    </div>
  )
}
```

### Links and Navigation

**Use TanStack Router Link:**
```typescript
import { Link } from '@tanstack/react-router'

<Link to="/dashboard">Dashboard</Link>
<Link to="/posts/$id" params={{ id: '123' }}>Post</Link>
```

## API Route Patterns

**CRITICAL**: Always use `APIRoute` (not `Route`) for API routes:

```typescript
// ✅ Correct
export const APIRoute = createAPIFileRoute('/api/upload')({
  POST: async ({ request }) => {
    // Implementation
  },
})

// ❌ Wrong - Will cause 404 errors
export const Route = createAPIFileRoute('/api/upload')({
  // This won't work!
})
```

### API Route Structure

```typescript
import { createAPIFileRoute } from '@tanstack/react-router'

export const APIRoute = createAPIFileRoute('/api/statements')({
  // GET handler
  GET: async ({ request, context }) => {
    const db = context.cloudflare.env.DB
    // Fetch statements
    return Response.json({ statements })
  },

  // POST handler
  POST: async ({ request, context }) => {
    const body = await request.json()
    // Create statement
    return Response.json({ success: true })
  },
})
```

## Testing Strategy

- **Unit Tests**: Vitest with React Testing Library
- **Test Location**: `src/__tests__/` or co-located `.test.tsx` files
- **Run Tests**: `npm test`

## Environment Configuration

### Environment Variables

**Frontend (Vite - VITE\_ prefix):**
```typescript
// Exposed to client
import.meta.env.VITE_APP_URL
import.meta.env.VITE_STRIPE_KEY
```

**Backend (Cloudflare Workers):**
```typescript
// Accessed via context
context.cloudflare.env.BETTER_AUTH_SECRET
context.cloudflare.env.DATABASE_URL
```

## Code Quality Standards

### ESLint Requirements

**After ANY code changes, MUST run:**

1. `npm run check` - Auto-format and fix lint errors
2. OR manually: `npx eslint <file> --fix`
3. Verify: `npm run lint`
4. Run tests: `npm test`

**Common Issues:**
- Unused variables → Remove or prefix with `_`
- Missing types → Add TypeScript interfaces
- Non-null assertions → Use optional chaining `?.`

### TypeScript Standards

- Use proper interfaces for props
- Avoid `any` types
- Use optional chaining (`?.`) not non-null assertions (`!`)
- Import types: `import { type MyType } from './types'`

## Tailwind CSS (v4.0+)

This project uses **Tailwind CSS v4** with:
- New Vite plugin: `@tailwindcss/vite`
- CSS imports in `src/styles.css`
- No separate config file needed (CSS-first configuration)

```css
/* src/styles.css */
@import "tailwindcss";

@theme {
  /* Custom theme values */
}
```

## DaisyUI Integration (When Added)

**Install DaisyUI:**
```bash
npm install daisyui
```

**Configure in tailwind.config.js:**
```javascript
export default {
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['light', 'dark'],
  },
}
```

**Common Components:**
```tsx
<button className="btn btn-primary">Button</button>
<div className="card">Card</div>
<div className="alert alert-success">Alert</div>
```

## n8n Integration Pattern

For MVP, **ALL AI features are handled by n8n webhooks**:

❌ **DO NOT add these to dependencies:**
- `openai` SDK
- `pdf-parse`
- `papaparse`
- `langchain`
- Vector database libraries

✅ **DO use simple fetch calls:**
```typescript
const response = await fetch(N8N_WEBHOOK_URL, {
  method: 'POST',
  body: formData,
})
```

## File Structure Best Practices

```
src/
├── routes/              # File-based routing
│   ├── __root.tsx       # Shell component
│   ├── index.tsx        # Homepage (/)
│   ├── sign-in.tsx      # Auth page
│   └── api/             # API routes
│       └── upload.ts    # API endpoints
├── components/          # Reusable components
├── lib/                 # Utilities & helpers
├── db/                  # Database schema
├── styles.css           # Tailwind imports
└── utils/               # Helper functions
```

## Common Mistakes to Avoid

### Version-Specific Issues

1. ❌ **Never** use Vinxi patterns (v1.120) - Use Vite patterns (v1.132)
2. ❌ **Never** use old `createRouteRoot()` - Use `createRootRoute()`
3. ❌ **Never** use `Route` for API routes - Use `APIRoute`
4. ❌ **Never** use `component` in root route - Use `shellComponent`

### General Issues

5. ❌ **Never** create static database connections
6. ❌ **Never** add AI/RAG libraries during MVP
7. ❌ **Never** expose backend secrets to frontend
8. ❌ **Never** commit without running lint + tests
9. ❌ **Never** use non-null assertions - use optional chaining
10. ❌ **Never** commit unless explicitly asked by user

## Best Practices to Follow

1. ✅ **Always** use latest TanStack Router v1.132 patterns
2. ✅ **Always** use `shellComponent` in root route
3. ✅ **Always** use `APIRoute` for API endpoints
4. ✅ **Always** access Cloudflare bindings via context
5. ✅ **Always** use Tailwind utility classes
6. ✅ **Always** add `data-testid` for testing
7. ✅ **Always** handle errors gracefully
8. ✅ **Always** show loading states
9. ✅ **Always** use TypeScript interfaces
10. ✅ **Always** run `npm run check` before committing

## Migration Notes (v1.120 → v1.132)

If migrating from older TanStack Start:

### Build Tool
- **Old**: Vinxi (`vinxi dev`, `vinxi.config.ts`)
- **New**: Vite (`vite dev`, `vite.config.ts`)

### Root Route
- **Old**: `component: Root`
- **New**: `shellComponent: RootDocument`

### Scripts
- **Old**: `npm run dev` (Vinxi)
- **New**: `npm run dev` (Vite on port 3000)

### Configuration
- **Old**: `app.config.ts` with complex Vinxi setup
- **New**: `vite.config.ts` with Cloudflare plugin

## Path Aliases

TypeScript path alias `@/*` maps to `./src/*`:

```typescript
// ✅ Good - Use path alias
import { Button } from '@/components/Button'

// ❌ Avoid - Relative paths
import { Button } from '../../../components/Button'
```

## Deployment

### Cloudflare Workers Deployment

```bash
# Build
npm run build

# Deploy
npm run deploy

# Or with wrangler directly
wrangler deploy
```

### Environment Variables

Set production secrets via Wrangler:
```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put DATABASE_URL
```

## Resources

- [TanStack Start Docs](https://tanstack.com/start)
- [TanStack Router v1.132](https://tanstack.com/router)
- [Vite Documentation](https://vitejs.dev)
- [Cloudflare Workers](https://developers.cloudflare.com/workers)
- [Tailwind CSS v4](https://tailwindcss.com)

---

**Key Takeaway**: TanStack Start v1.132 uses **Vite**, **simpler routing**, and **context-based Cloudflare bindings**. Always use the latest patterns and avoid v1.120 conventions.
