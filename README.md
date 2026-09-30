# `use(params)` in a client page suspends on every `history.replaceState` / `pushState` when `cacheComponents` is on

With `cacheComponents: true`, a `'use client'` page or layout that reads `use(params)` or `use(searchParams)` suspends each time the URL is written with the native History API. The nearest `<Suspense>` fallback replaces the content, so a focused input loses focus and drops keystrokes. With `cacheComponents: false` the same app is fine.

Both halves are documented patterns: `use(params)` and `use(searchParams)` in client pages and layouts (`page`, `layout` and `dynamic-routes` API reference), and `window.history.pushState` / `replaceState` for URL updates.

## Run it

Needs Node 20.9 or newer.

```sh
git clone --depth 1 --single-branch --branch repro/client-params-shallow-url-write https://github.com/controversial/next.js.git repro
cd repro
npm install
npx playwright install chromium   # or set CHROMIUM_PATH to an existing Chromium or Chrome
npm run repro
```

`npm run repro` makes a production build with the flag on, starts it, drives it in headless Chromium, then does the same with the flag off. `npm run repro on` or `npm run repro off` runs one half.

To look by hand: `npm run build && npm start`, open `/client-page-params/1` and type in the input.

## What it drives

On each route the driver does a bare `history.replaceState`, a bare `history.pushState` and a `replaceState` from a click handler, and prints how long `#content` was off screen after each. It then types "abc" into an input that writes `?q=` on each keystroke, and prints what the input holds and whether it still has focus.

**The typed text and the focus are the signal to trust.** The length of the blank depends on what else the app renders while the fallback is up, so read the durations as measurements of this app, not as part of the bug.

| Route | Pattern |
| --- | --- |
| `/client-page-params/[id]` | client page, `use(params)`, `<Suspense>` in its layout |
| `/client-page-search-params` | client page on a static route, `use(searchParams)` |
| `/client-layout-params/[id]` | client layout, `use(params)` |
| `/control-use-params-hook/[id]` | client page, `useParams()` |
| `/control-server-page/[id]` | server page awaits `params`, passes the value down |
| `/control-passed-promise/[id]` | server page passes its own `params` promise to a client child that calls `use()` |
| `/plain-react` | no Next API: a fresh resolved promise per render, updated in and out of a transition |

## Results

Production build, `next start`, headless Chromium, Linux x64, Node 22.22.0, React 19.2.4. Full output for each version is in `results/`.

| Next | `cacheComponents: true` | `cacheComponents: false` |
| --- | --- | --- |
| 16.3.6 | 3 of 6 routes affected | 0 of 6 |
| 16.3.8 (`latest` on 2026-09-30) | 3 of 6 routes affected | 0 of 6 |
| 16.4.0-canary.53 (`canary` on 2026-09-30) | 3 of 6 routes affected | 0 of 6 |

Flag on, 16.4.0-canary.53:

| Route | `replaceState` | `pushState` | click handler | typed "abc" | input focused |
| --- | --- | --- | --- | --- | --- |
| client page, `use(params)` | 301 ms | 301 ms | 300 ms | "a" | no |
| client page, `use(searchParams)` | 300 ms | 300 ms | 300 ms | "a" | no |
| client layout, `use(params)` | 301 ms | 301 ms | 300 ms | "a" | no |
| `useParams()` | none | none | none | "abc" | yes |
| server page awaits `params` | none | none | none | "abc" | yes |
| server page passes its promise | none | none | none | "abc" | yes |

## Run it against another Next

```sh
npm run use-next 16.3.8                              # a published version
npm run use-next canary                              # a dist-tag
npm run use-next /path/to/next.js/packages/next      # a locally built Next
npm run use-next /path/to/next-x.y.z.tgz             # a tarball from `npm pack`
npm run repro
```

`use-next` installs with `--no-save`, so `package.json` stays as it is and `npm install` puts the pinned version back. `npm run repro` prints the Next version it ran.

For a local checkout, build it first (`pnpm install && pnpm build` at the root of the Next.js repository). `use-next` packs the folder into a tarball and installs that. It does not symlink, because a symlinked `next` fails to start here with `Cannot find module 'next/dist/compiled/commander'`. The tarball still takes `@next/env` and the `@next/swc-*` binary from npm at the version in its `package.json`, so a change to the JavaScript only needs the checkout to sit on a published version.

This path was checked by unpacking the published 16.4.0-canary.53 package, editing its `dist`, and installing the folder with `use-next`. The edit marked the promises made in `client/request/params.browser.prod.js` and `search-params.browser.prod.js` as already fulfilled. It was a stand-in to prove the switch works and the driver can go green, not a proposed fix. With it the driver reports 0 of 6 (`results/16.4.0-canary.53-stand-in-edit.txt`).

## Cause

Read from the published 16.4.0-canary.53 package. Paths are under `next/dist/client/components/` unless noted.

1. **The page gets a new promise on every router render.** With the flag on, `ClientPageRoot` (`client-page.js`) and `ClientSegmentRoot` (`client-segment.js`) receive `serverProvidedParams === null` and read `layoutRouterContext.parentParams`. `OuterLayoutRouter` (`layout-router.js`) builds `{ ...parentParams, [paramName]: paramValue }` on each render at a dynamic segment. `makeUntrackedParams` (`next/dist/client/request/params.browser.prod.js`) caches its promise in a `WeakMap` keyed on that object, so a new object means a new promise. `searchParams` is rebuilt on each render too, by `urlSearchParamsToParsedUrlQuery`.
2. **The URL write does not render as a transition.** The patched `pushState` / `replaceState` call `restore()` (`sequential-router-queue.js`), which dispatches `ACTION_RESTORE` inside `startTransition`. But the queue's `action` is `async (state, action) => reducer(state, action)` (`app-router-instance.js`), so `runAction` always takes the `actionResult.then(handleResult)` branch. For a restore, `action.resolve` is the raw `setState`, and it runs in a microtask after the `startTransition` scope has closed. React renders it as an ordinary update, an ordinary update cannot wait for an untracked promise, and the fallback commits.

Two checks for part 2:

- `/plain-react` gives a child a fresh `Promise.resolve()` on each render. Updated inside `startTransition` it shows no fallback. Updated with a plain `setState` it shows the fallback for 300 ms. The driver prints both.
- `npm run dev`, then `node drive-render-stack.mjs`. The first render after the write has `renderRootSync` on its stack (`results/16.4.0-canary.53-render-stack-dev.txt`).
