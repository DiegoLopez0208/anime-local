# Product roadmap

The items below are proposals, not implemented features. The current release is v0.4.0.

## 1. One library across devices

Add real server authentication and opt-in synchronization for favorites, scores, status, and reading/watch progress. Preserve guest mode and import/export. Define conflict resolution, account deletion, and backup recovery before enabling sync. LocalStorage profiles remain a convenience feature until this is delivered.

## 2. Reliable desktop maintenance

Add release notifications first, followed by signed installers and verified updates. Keep portable installations supported. Show clear connectivity and server-start errors with actionable recovery options. Keep downloads and media storage opt-in; do not imply that streamed content is available offline.

## 3. Discovery that explains itself

Offer recommendations based on favorite genres, personal scores, and completed titles. Explain why each suggestion appears and allow hiding a work or resetting preferences. Start locally without requiring an account.

## 4. Better daily reading and watching

Add per-chapter bookmarks, a history view, and an optional release calendar. Improve keyboard and screen-reader journeys with live browser checks. Track provider failures separately from application failures so retry actions can give a useful explanation.

## Delivery criteria

Each feature needs a clear user flow, empty/loading/error states, desktop and mobile verification, and migration coverage when stored library data changes. Release notes must distinguish published behavior from future plans.
