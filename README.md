# `redirect()`, `notFound()` and thrown errors never commit on a client navigation to a blocking route when `cacheComponents` is on

With `cacheComponents: true`, click a `<Link>` to a page that reads request-time data and then calls `redirect()`, with no `<Suspense>` or `loading.js` above it. The URL stays, nothing paints, and the tab's main thread sits at 100% until you click something else. `notFound()` and any thrown server error do the same. With `cacheComponents: false` the same app is fine, and so is a full page load of the same URL with the flag on.

```jsx
// app/layout.jsx
export const instant = false; // no <Suspense> or loading.js anywhere above the page

// app/page.jsx
<Link href="/throws-redirect">go</Link>

// app/throws-redirect/page.jsx
export default async function Page() {
  await cookies();
  redirect("/target");
}
```

Every piece is a documented pattern. `instant = false` is the opt-out the "Migrating to Cache Components" guide gives for routes that aren't ready yet, and the `cache-components-instant-false` codemod adds it to every page and layout.

Same symptom as [vercel/next.js#97898](https://github.com/vercel/next.js/issues/97898).

## Run it

Needs Node 20.9 or newer.

```sh
git clone --depth 1 --single-branch --branch repro/blocking-route-redirect-stuck https://github.com/controversial/next.js.git repro
cd repro
npm install
npx playwright install chromium   # or set CHROMIUM_PATH to an existing Chromium or Chrome
npm run repro
```

`npm run repro` makes a production build with the flag on, starts it, drives it in headless Chromium, then does the same with the flag off. `npm run repro on` or `npm run repro off` runs one half.

To look by hand: `npm run build && npm start`, open `/` and click `/throws-redirect`.

`instant` is only accepted as an export with the flag on, so the root layout comes in two files, `app/layout.flag-on.jsx` and `app/layout.flag-off.jsx`, picked through `pageExtensions` in `next.config.mjs`. That export is the only difference between them. Everything else is shared.

## What it drives

Each case gets a fresh browser context. The driver loads the start page, waits for the prefetches to finish, clicks one link and waits two seconds. It then prints the URL, the `<h1>`, and how much of the next second the main thread spent busy.

| Case | Click | Should end on |
| --- | --- | --- |
| `redirect()` | `/` to `/throws-redirect` | `/target` |
| `notFound()` | `/` to `/throws-not-found` | `not-found.jsx` |
| `throw new Error()` | `/` to `/throws-error` | `error.jsx` |
| `redirect()`, same dynamic route, `prefetch={false}` | `/same-route/1` to `/same-route/moved` | `/target` |
| control: nothing thrown | `/` to `/control-no-throw` | the page |
| control: `redirect()` under `<Suspense>` | `/` to `/control-suspense/redirect` | `/target` |
| control: `redirect()` under `loading.jsx` | `/` to `/control-loading/redirect` | `/target` |
| control: `redirect()`, other route, `prefetch={false}` | `/` to `/control-no-prefetch` | `/target` |

## Results

Production build, `next start`, headless Chromium, Linux x64, Node 22.22.0. Full output for each version is in `results/`.

| Next | `cacheComponents: true` | `cacheComponents: false` |
| --- | --- | --- |
| 16.3.8 (`latest` on 2026-10-01) | 4 of 8 clicks went nowhere | 0 of 8 |
| 16.4.0-canary.54 (`canary` on 2026-10-01) | 4 of 8 clicks went nowhere | 0 of 8 |

Flag on, 16.4.0-canary.54:

| Case | URL after | `<h1>` after | Main thread | Result |
| --- | --- | --- | --- | --- |
| `redirect()` | `/` | home | 100% busy | stuck |
| `notFound()` | `/` | home | 100% busy | stuck |
| `throw new Error()` | `/` | home | 100% busy | stuck |
| `redirect()`, same dynamic route, prefetch off | `/same-route/1` | item 1 | 100% busy | stuck |
| control: nothing thrown | `/control-no-throw` | no throw | 0% busy | ok |
| control: `redirect()` under `<Suspense>` | `/target` | target | 0% busy | ok |
| control: `redirect()` under `loading.jsx` | `/target` | target | 0% busy | ok |
| control: `redirect()`, other route, prefetch off | `/target` | target | 0% busy | ok |

## What it takes

All three must be true:

1. **`cacheComponents` is on.**
2. **No Suspense boundary or `loading.js` above the component that throws.**
3. **The browser already holds a static shell for that page.** It gets one from a default `<Link>` prefetch, or from a full page load of any URL of the same dynamic route. That is why `/same-route/moved` gets stuck with prefetch off and `/control-no-prefetch` doesn't.

Also checked by hand on canary.54 with the flag on:

- A full page load of each of the four URLs ends where it should.
- While the tab is stuck, clicking another link works and stops the loop.

## Cause

Read from the published 16.4.0-canary.54 package, which bundles `react-dom` 19.3.0-canary-8b0da1c6-20260922. App Router pages run that React, not the one in `package.json`.

With the flag on, Next renders a navigation in two passes: first the prefetched static shell, then the real server response. It does that with `useDeferredValue(real, shell)`.

1. **The click's render gets the shell.** The shell has a hole where the request-time part goes. With no Suspense above, React can't finish that render, so its lane stays pending.
2. **A deferred render gets the real response.** It reaches `redirect()`, which is a thrown error, and the redirect boundary catches it. The boundary navigates from an effect, so it needs this render to commit.
3. **React doesn't commit a caught error straight away.** It retries once, synchronously, over every pending lane, and that includes the click's lane.
4. **Because the click's lane is in the retry, `useDeferredValue` hands back the shell again.** The retry hits the hole and suspends with nothing to show.
5. **React drops both attempts**, the caught redirect included. Step 4 also asked for a new deferred lane, so it starts again at step 2. No render ever commits, so the effect never runs.

With the flag off there is no shell for a request-time page, so both arguments are the real response. The retry throws the same redirect, React accepts the error as real and commits, and the effect navigates.

With a new Suspense boundary above, the click's render commits with the fallback. Its lane is no longer pending when the error arrives, so the retry throws again and commits.

| What | Where (under `node_modules/next/dist`) |
| --- | --- |
| Shell first, real response second | `client/components/layout-router.js:218-222` |
| A shell with holes becomes `prefetchRsc` | `client/components/render-tree.js:758-767` |
| The redirect only happens in an effect | `client/components/redirect-boundary.js:30-41` |
| `useDeferredValue` returns the initial value when an update lane is in the render | `compiled/react-dom/cjs/react-dom-client.development.js:9215-9227`, `mountDeferredValueImpl` |
| The retry takes every pending lane | same file, `:18063-18074` |
| A retry that suspends at the shell skips the branch that turns the retry off | same file, `:18099-18102` |

That last condition came in with [facebook/react#36911](https://github.com/facebook/react/pull/36911), "Treat incomplete tree as an error during recovery". In `react-dom@19.2.4` the check is only `errorRetryLanes !== RootErrored` (`react-dom-client.development.js:16588`). There, a retry that suspended on a promise set `errorRecoveryDisabledLanes` for the lane, so a later attempt on that lane committed the error without a retry. The change fixed a real bug, committing a half-built tree, but it left this case with no way out.

### Watch the loop

```sh
npm run trace                                   # flag on, / -> /throws-redirect
npm run trace off                               # flag off, same click
npm run trace on / /control-suspense/redirect   # any other click
```

`trace.mjs` adds log lines to the bundled React's work loop, builds, clicks, prints the log and puts the file back. The added lines only log. Output for both versions is in `results/`. Each `useDeferredValue` line belongs to the render or retry printed under it. Flag on, from the click:

```
    useDeferredValue(real, shell) returns the shell
render       [transition2] -> SUSPENDED AT THE SHELL   (pending [transition2 deferred3])
    useDeferredValue(real, shell) returns the real response
render       [deferred3] -> SUSPENDED AT THE SHELL   (pending [transition2 deferred3])
    useDeferredValue(real, shell) returns the real response
render       [deferred3] -> ERRORED   (pending [transition2 deferred3])
    useDeferredValue(real, shell) returns the shell
  sync retry [transition2 deferred3] -> SUSPENDED AT THE SHELL
    useDeferredValue(real, shell) returns the real response
render       [deferred4] -> ERRORED   (pending [transition2 deferred3 deferred4])
    useDeferredValue(real, shell) returns the shell
  sync retry [transition2 deferred3 deferred4] -> SUSPENDED AT THE SHELL
```

It carries on like that at about 2,200 log lines a second, with no commit. Flag off:

```
render       [transition2] -> SUSPENDED AT THE SHELL   (pending [transition2 deferred2])
render       [deferred2] -> SUSPENDED AT THE SHELL   (pending [transition2 deferred2])
render       [transition2] -> ERRORED   (pending [transition2 deferred2])
  sync retry [transition2 deferred2] -> ERRORED
COMMIT       [transition2 deferred2]
```

## Run it against another Next

```sh
npm run use-next 16.3.8                              # a published version
npm run use-next canary                              # a dist-tag
npm run use-next /path/to/next.js/packages/next      # a locally built Next
npm run use-next /path/to/next-x.y.z.tgz             # a tarball from `npm pack`
npm run repro
```

`use-next` installs with `--no-save`, so `package.json` stays as it is. `npm run repro` prints the Next version it ran. To go back, run `npm run use-next` with the version in `package.json`.

For a local checkout, build it first (`pnpm install && pnpm build` at the root of the Next.js repository). `use-next` packs the folder into a tarball and installs that. It does not symlink, because a symlinked `next` fails to start with `Cannot find module 'next/dist/compiled/commander'`. The tarball still takes `@next/env` and the `@next/swc-*` binary from npm at the version in its `package.json`, so a change to the JavaScript only needs the checkout to sit on a published version.

This path was checked by unpacking the published 16.4.0-canary.54 package, editing its `dist`, and installing the folder with `use-next`. The edit, in `client/components/layout-router.js` and its `esm` twin, stops passing the shell as the initial value once the real response has arrived:

```diff
-const resolvedPrefetchRsc = renderTree.data.prefetchRsc !== null ? renderTree.data.prefetchRsc : renderTree.data.rsc;
+const resolvedPrefetchRsc = renderTree.data.prefetchRsc !== null && !(renderTree.data.rsc !== null && typeof renderTree.data.rsc === "object" && renderTree.data.rsc.status === "fulfilled") ? renderTree.data.prefetchRsc : renderTree.data.rsc;
```

With it the driver reports 0 of 8 (`results/16.4.0-canary.54-hand-edit.txt`). It is an experiment on built files that shows the switch works and backs up step 4. It has not been run against Next's test suite.
