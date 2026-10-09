# Anime Local

[License: MIT](LICENSE)

[Open the hosted app](https://anime-local-nine.vercel.app).

A local anime and manga catalog with personal libraries, browser profiles, and direct YourUpload/MEGA playback. Available on the web, as a Node.js CLI, and as a downloadable Windows app. The interface is in Spanish.

## Windows app

[Download the installer](https://github.com/DiegoLopez0208/anime-local/releases/latest/download/Anime-Local-Windows-Setup.exe) or [download the portable ZIP](https://github.com/DiegoLopez0208/anime-local/releases/latest/download/Anime-Local-Windows-x64.zip). For the portable version, extract the entire ZIP and open `Anime Local.exe`.

Windows x64. Node.js is bundled; no separate installation is needed. Catalog browsing and playback still require internet. The binaries are not digitally signed. SHA-256 checksums are provided with each release.

The desktop app stores its own profiles and library. Export your list from the web and import it in the app through **Mi lista**. Automatic synchronization and automatic updates are not implemented.

The desktop window uses Electron with context isolation, sandboxing, and Node integration disabled. Its bundled server listens on loopback port 5198. External navigation is restricted to canonical MyAnimeList entries and this project's release pages. Opening another instance focuses the existing window; closing the app stops its server.

## Run

Requires Node.js 22 or newer.

```sh
npx @diegolopez02081/anime-local
```

Open http://127.0.0.1:5189. The CLI attempts to open your default browser. Use `--no-open` to keep it in the terminal. Stop it with Ctrl+C.

For direct VLC playback:

```sh
npx @diegolopez02081/anime-local --cli "https://tioanime.com/ver/YOUR-EPISODE" --server YourUpload
npx @diegolopez02081/anime-local --cli "https://tioanime.com/ver/YOUR-EPISODE" --server Mega
```

VLC must be installed in its standard Windows location, or set `VLC_PATH` to the VLC executable. Keep the process running while playing MEGA: it provides a local decryption bridge.

## Features

- Sidebar navigation on desktop and bottom navigation on mobile, with a shared anime/reading search and a keyboard shortcut (`/`) to focus it.
- Library search, favorites, status/type filters, personal-score ordering, and summaries of ongoing, favorite, and completed works.
- Saved preferences for compact/comfortable cards, reader width, and reading mode.
- Sticky reader controls, page progress, focus mode, arrow-key navigation, and Escape to leave focus mode.
- Loading placeholders and a retry action when a route cannot load.
- A desktop download page at `#/app`, also accessible from settings on mobile.
- Recent episodes, recent anime, search, genres, status filters, and paginated catalog.
- Series pages with synopsis, cover, genres, and ordered episodes.
- Browser playback, provider switching, previous/next episodes, and local VLC launching.
- MyAnimeList community scores on anime and reading detail pages, with separate anime/manga ranking pages. Public title metadata is cached for six hours; ambiguous anime titles require selecting the matching entry. No MyAnimeList login or account synchronization is used.
- Personal scores from 1 to 10, saved per browser profile and included in library export/import.
- A compact home page with Continue watching/reading, library type filters, and ordering by personal score or title.
- Muted hover previews of up to five seconds on compatible anime cards. A 750 ms delay avoids playback during quick pointer movements. Only one preview can play; leaving the card or page releases it. Previews are disabled on touch devices, data-saving connections and reduced-motion preferences, and can be switched off manually. They use YourUpload only; MEGA is never opened for previews.
- Neutral interface labels for playback choices and reading, without third-party catalog/provider branding.
- Watch-list states: watching, planned, completed, paused, and dropped.
- Last episode and playback position saved per browser profile.
- Local registration/login and guest mode.
- JSON library export/import; exports contain no password hashes.
- Optional visual crop of the top 6% of the video. This hides a burned-in corner watermark at the cost of removing part of the picture. It does not alter the source file or reconstruct hidden image pixels.
- Manual source inspector/player at `/reproductor`, supporting TioAnime and JKAnime episode links. JKAnime currently rejects Vercel datacenter requests with HTTP 403; use the local app for that source. Its published MEGA links were validated locally.
- MangaDex manga, manhwa and manhua search with Japanese/Korean/Chinese origin filters, combined Spanish/Latin American Spanish and English chapter filters, pagination and cover art.
- Search checks actual readable chapter feeds before displaying a work: historical translation metadata can refer to chapters that are no longer available. Spanish and Latin American Spanish are queried together; the selected language is preserved when opening a detail page. A detail page with no readable chapters offers another supported language only when chapters are actually available. Upstream metadata requests are spaced 260 ms apart, chapter availability is cached for five minutes, and at most three search availability lookups run concurrently.
- Chapter reader opens five consecutive pages by default, preparing the current page and four following pages with at most two concurrent image downloads. Overlapping pages are reused from the chapter cache, including in single-page mode. Moving to another chapter or leaving the reader cancels pending work and releases image object URLs. Single-page and vertical reading modes remain available; reading position and last chapter saved in the same local library. Only publicly available chapters classified as safe are included. External publisher chapters are labeled rather than embedded.
- AnimeFLV was investigated but returned HTTP 522 during verification; no working adapter is claimed.

## Local profiles are not server authentication

Profile data and salted PBKDF2-SHA256 password hashes (600,000 iterations) are stored in localStorage; the active profile identifier is stored in sessionStorage.

This is a browser convenience feature, not a security boundary. Someone who controls the browser or runs JavaScript on the same origin can read/alter the data and bypass the local login. Do not reuse an important password. There is no password recovery, email verification, cloud account, or automatic cross-device synchronization.

Each browser and origin has a separate library. Export/import your list to move it between the local app and a hosted deployment. Clearing browser storage deletes local profiles and lists.

See [OWASP's guidance on browser storage](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html).

## How playback works

The scraper requests only the pages you browse and extracts data without executing third-party JavaScript. TioAnime covers are proxied; MangaDex covers are proxied through the app to avoid its hotlink placeholder images. Chapter pages are retrieved on demand, bounded to 4 MiB, with image health reports and one retry using refreshed delivery metadata. MangaDex metadata has a short bounded cache; catalog cache lifetimes are 2 minutes for the home page, 5 minutes for directory pages, 10 minutes for series, and 1 minute for episodes.

YourUpload playback uses a fresh MP4 URL and the required Referer. MEGAJS decrypts the shared video while serving byte ranges. Provider availability and transfer quotas still apply. Unsupported providers are shown as unavailable; the app does not bypass DRM, accounts, or provider quotas. It does not remove advertisements burned into a media file.

Preview byte-range responses are bounded to 512 KiB each on both local and hosted versions. Five seconds describes the playback duration, not an exact download limit: the browser also needs media metadata, seeks and buffering, so previews still consume bandwidth.

The npm app listens on 127.0.0.1 only. Its local video sessions expire after two hours. Navigating away or switching providers closes the previous local session, including any VLC stream using it.

## Vercel adapter

`api/index.mjs` and `vercel.json` implement stateless catalog and video endpoints for Vercel. Media responses are bounded to 4 MiB per request (512 KiB for previews); the browser requests subsequent ranges as needed. The Vercel version does not launch VLC. Deployment and upstream playback must be checked live after deployment; providers may respond differently to datacenter IPs.

```sh
npx vercel login
npx vercel --prod
```

No account database is required for local profiles. The hosted endpoints are public, not protected by those profiles.

## Development

```sh
npm ci
npm test
npm run web
```

There are 29 automated tests covering parsing, provider links, byte ranges, errors, local profile isolation, invalid passwords, import validation, frontend syntax, MAL scores/rankings, season matching, personal-score and favorite persistence, desktop navigation restrictions, and reader-cache reuse, concurrency, cancellation and retry. Tests use synthetic fixtures and do not download episodes.

Build the desktop app on Windows:

```sh
npm ci
node node_modules/electron/install.js
npm run desktop
npm run desktop:smoke
npm run desktop:build
```

The build outputs an NSIS installer and a portable ZIP in `dist-desktop/`. The smoke check opens an isolated, hidden desktop window, verifies the library and license route, checks renderer isolation, and exits. It also works on a packaged executable with `--smoke`. The optional `ANIME_LOCAL_SMOKE_REPORT` environment variable selects a JSON report path.

Production dependencies have a clean audit at v0.4.0. The current development-only Electron download/build dependency chain has moderate `sprintf-js` advisories; no patched upstream version was available at release time. Development build tools are excluded from the desktop bundle.

See [the roadmap](ROADMAP.md) for planned improvements and their boundaries.

Optional live checks against an episode of your choice:

```sh
TIOANIME_EPISODE="https://tioanime.com/ver/YOUR-EPISODE" npm run smoke
```

On PowerShell, set `$env:TIOANIME_EPISODE` before running `npm run smoke`.

Windows source-checkout launchers: `abrir-web.cmd` and `abrir-vlc.cmd`. The web launcher reuses an existing server or starts one hidden. Development logs are not part of the package or repository.

Source files: `catalog.mjs` (scraper), `catalog.html` (UI), `profiles.mjs` (browser profiles), `lib.mjs` (providers), `sources.mjs` (additional source inspector), `manga.mjs` (MangaDex adapter), `manga-ui.mjs` (reader UI), `local-server.mjs` (local API), `api/index.mjs` (Vercel adapter).

The code is licensed under the [MIT License](LICENSE), copyright 2026 Diego Lopez. The hosted app also exposes the license at [/license](https://anime-local-nine.vercel.app/license). Third-party names and media remain their respective owners' property. No video files or cover images are distributed in the package.

Ratings modules: ratings.mjs / ratings-ui.mjs (community and personal scores), previews.mjs (hover preview lifecycle). Experience modules: experience.mjs (preferences, favorites, reader controls, desktop download page), desktop/main.cjs (native app lifecycle), desktop/policy.cjs (external navigation policy).
