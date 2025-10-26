# Bug Report: @mastra/langfuse - Missing compiled JS files in @mastra/core

## Title
[BUG] @mastra/langfuse integration broken - Missing compiled JS files in @mastra/core/dist/ai-tracing/exporters/

---

## Describe the Bug

When trying to use `@mastra/langfuse` for observability tracing, the application fails to start with a module not found error. The `@mastra/langfuse` package attempts to import from `@mastra/core/dist/ai-tracing/exporters/index.js`, but this file does not exist in the published package.

**Error Message:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/path/to/node_modules/@mastra/core/dist/ai-tracing/exporters/index.js' imported from /path/to/node_modules/@mastra/langfuse/dist/index.js
    at finalizeResolution (node:internal/modules/esm/resolve:275:11)
    at moduleResolve (node:internal/modules/esm/resolve:932:10)
    at defaultResolve (node:internal/modules/esm/resolve:1056:11)
```

---

## Steps To Reproduce

1. Create a new project with `npx create-mastra@latest`
2. Install Langfuse integration:
   ```bash
   yarn add @mastra/core@0.23.1 @mastra/langfuse@0.2.1
   ```
3. Add the following code to `src/mastra/index.ts`:
   ```typescript
   import { Mastra } from '@mastra/core/mastra';
   import { LangfuseExporter } from '@mastra/langfuse';

   export const mastra = new Mastra({
     observability: {
       default: { enabled: true },
       configs: {
         myApp: {
           serviceName: 'my-app',
           exporters: [
             new LangfuseExporter({
               publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
               secretKey: process.env.LANGFUSE_SECRET_KEY!,
             })
           ],
         },
       },
     },
   });
   ```
4. Run `npm run dev`
5. See error immediately on startup

---

## Expected Behavior

The `@mastra/langfuse` package should successfully import from `@mastra/core` and initialize the Langfuse exporter without errors. The application should start normally and send telemetry data to Langfuse.

---

## Environment

- **@mastra/core version:** 0.23.1 (also tested: 0.22.2, 0.21.0)
- **@mastra/langfuse version:** 0.2.1 (also tested: 0.1.1, 0.1.0)
- **Node.js version:** 22.13.0
- **Package manager:** yarn 1.22.22 / npm 10.x
- **OS:** macOS 14.6 (Darwin 24.6.0)
- **TypeScript version:** 5.9.3

---

## Root Cause Analysis

The `@mastra/core` package is missing compiled JavaScript files in the `dist/ai-tracing/exporters/` directory. Only TypeScript declaration files (`.d.ts`) are present in the published package.

**Current directory contents:**
```bash
$ ls node_modules/@mastra/core/dist/ai-tracing/exporters/
base.d.ts          base.d.ts.map
cloud.d.ts         cloud.d.ts.map
console.d.ts       console.d.ts.map
default.d.ts       default.d.ts.map
index.d.ts         index.d.ts.map

# ❌ Missing files:
# index.js, index.cjs, base.js, base.cjs, etc.
```

**Source files exist:**
```bash
$ ls packages/core/src/ai-tracing/exporters/
base.ts  cloud.ts  console.ts  default.ts  index.ts  ✅ (all present)
```

**package.json exports declaration:**
```json
{
  "exports": {
    "./*": {
      "import": {
        "types": "./dist/*/index.d.ts",
        "default": "./dist/*/index.js"  // ← This file doesn't exist!
      }
    }
  }
}
```

---

## Technical Details

The issue is in `packages/core/tsup.config.ts`. The `entry` configuration only matches one level deep:

```typescript
entry: [
  'src/index.ts',
  'src/base.ts',
  'src/*/index.ts',  // ⚠️ Only matches: src/agent/index.ts ✅
                      //                  src/ai-tracing/index.ts ✅
                      //                  src/ai-tracing/exporters/index.ts ❌
  // ...
]
```

**Directories affected:**
- `src/ai-tracing/exporters/` (depth: 2) - ❌ Not compiled
- Any other nested subdirectories at depth 2+ - ❌ Not compiled

---

## Suggested Fix

Add `'src/*/*/index.ts'` to the entry array in `packages/core/tsup.config.ts`:

```typescript
export default defineConfig({
  entry: [
    'src/index.ts',
    'src/base.ts',
    'src/utils.ts',
    '!src/action/index.ts',
    'src/*/index.ts',
    'src/*/*/index.ts',  // ← ADD THIS LINE
    // ... rest of entries
  ],
  // ... rest of config
});
```

This will ensure nested subdirectories are compiled and the JavaScript files are included in the published package.

---

## Impact

- **Severity:** High - Langfuse integration is completely broken
- **Scope:** Affects all users trying to use `@mastra/langfuse` for observability
- **Workaround:** No workaround available except disabling Langfuse integration
- **Versions affected:** All recent versions (tested: 0.21.0, 0.22.2, 0.23.1)

---

## Additional Context

This appears to be a **build configuration issue** rather than a code issue. The source TypeScript files are correct, but the tsup bundler is not configured to compile nested subdirectories.

**Tested version combinations:**
- ❌ `@mastra/core@0.23.1` + `@mastra/langfuse@0.2.1`
- ❌ `@mastra/core@0.22.2` + `@mastra/langfuse@0.1.1`
- ❌ `@mastra/core@0.21.0` + `@mastra/langfuse@0.1.0`

All combinations fail with the same error.

---

## Willing to Contribute

I'm willing to submit a PR to fix this issue if the team is open to contributions. The fix is straightforward (one line change in `tsup.config.ts`).

---

## Related

- Package: `@mastra/core`
- Package: `@mastra/langfuse`
- Documentation: https://mastra.ai/docs/observability/overview
