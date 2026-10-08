# Anime Local

[Open the hosted app](https://anime-local-nine.vercel.app).

A small local anime and manga catalog with watch lists, browser profiles, and direct YourUpload/MEGA playback. The interface is in Spanish.

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
- MangaDex manga, manhwa and manhua search with Japanese/Korean/Chinese origin filters, Spanish/Latin American Spanish/English chapter filters, pagination and cover art.
- Chapter reader with page controls and vertical mode; reading position and last chapter saved in the same local library. Only publicly available chapters classified as safe are included. External publisher chapters are labeled rather than embedded.
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

There are 23 automated tests covering parsing, provider links, byte ranges, errors, local profile isolation, invalid passwords, import validation, frontend syntax, MAL scores/rankings, season matching, and personal-score persistence. Tests use synthetic fixtures and do not download episodes.

Optional live checks against an episode of your choice:

```sh
TIOANIME_EPISODE="https://tioanime.com/ver/YOUR-EPISODE" npm run smoke
```

On PowerShell, set `$env:TIOANIME_EPISODE` before running `npm run smoke`.

Windows source-checkout launchers: `abrir-web.cmd` and `abrir-vlc.cmd`. The web launcher reuses an existing server or starts one hidden. Development logs are not part of the package or repository.

Source files: `catalog.mjs` (scraper), `catalog.html` (UI), `profiles.mjs` (browser profiles), `lib.mjs` (providers), `sources.mjs` (additional source inspector), `manga.mjs` (MangaDex adapter), `manga-ui.mjs` (reader UI), `local-server.mjs` (local API), `api/index.mjs` (Vercel adapter).

MIT applies to this application's code. Third-party names and media remain their respective owners' property. No video files or cover images are distributed in the package.

Ratings modules: ratings.mjs / ratings-ui.mjs (community and personal scores), previews.mjs (hover preview lifecycle).
