# Audit remediation status

Completed implementation pass 2026-10-17. This file records remediation against `AUDIT_REPORT.md`; the original report remains the baseline. “Addressed” means code/configuration was changed and reviewed; device, hosting, and browser download limits are listed below.

## Workstreams

- Backend: private room session credentials, REST/socket authorization, validation and exception handling, migrated capture rounds, persistence/retention, authoritative snapshots, regression tests.
- Frontend: authenticated requests, reconnect hydration, capture composition, shared editing/navigation, invitations, lifecycle cleanup, bounded persistence, recovery states.
- UI: component build errors, custom image rendering, camera readiness/cancellation, keyboard interactions, pointer handling, responsive styling.
- Integration: production build/lint gates, same-origin development proxy, configuration examples, deployment and operating instructions, final regression verification.

## Verification

| Check | Result |
| --- | --- |
| Server typecheck and production build | Pass |
| Server regression tests | 16 passing tests including focused room-entry concurrency, reservation expiry, presence and process-restart recovery |
| Client room-code tests | 2 passing tests for normalization and invalid/truncated input |
| Actual Vite API/socket proxy | Pass: WebSocket host + polling guest, normalized code, authenticated room entry, idempotent retry, leave/revocation |
| Client production build | Pass; routes split into asynchronous chunks; no oversized-chunk warning |
| Client strict source lint | Pass, warnings fail the command |
| npm audit, both complete dependency trees | Zero advisories at verification time |
| Browser: create, canonical invite prefill, two-user lobby, host setup | Pass |
| Browser: synthetic captures → slot assignment → filter → decoration → export → completion | Pass |
| Browser: PNG/JPEG raster generation | Valid generated images; JPEG verified at 1379 × 3200 pixels for classic strip |
| Browser: PDF generation | Generated application/pdf download link |
| Existing database | Not opened or modified by remediation tests |

Backend regression coverage includes missing credentials, host impersonation, malformed socket payloads with and without callbacks, readiness barriers, two participants uploading the same frame index, retries, cross-participant attribution, shared editor authorization, reconnect snapshots, retakes, stale rounds, explicit leave/revocation across sockets, foreign keys, SQLite online backup restoration, legacy slot migration, and unsafe design CSS rejection. The initial regression coverage comprised four top-level tests; the expanded room-entry coverage is recorded below.

## Focused room-entry follow-up — 2026-10-17

The code/lobby/API simulation identified and repaired additional issues:

- Padded lowercase room codes now normalize consistently; invalid extra letters are not silently truncated into another room code.
- An authenticated REST join retry resumes the same participant, even if a room is full or has already started. The frontend does not leave/revoke that same membership afterward. Switching to another room omits credentials from the previous room.
- Rapid repeated form submissions share a synchronous guard, preventing duplicate create/join operations from Enter/click races.
- REST joins no longer prematurely advance the host's setup phase. An identical socket rejoin preserves camera readiness and multi-device presence.
- Schema version 2 adds persistent participant leases. Initial reservations, disconnected guests, and departed hosts expire without requiring another HTTP request. Restart recovery preserves credentials and lease deadlines, clears stale readiness, and returns interrupted capture to readiness.
- The lobby waits for an authenticated room acknowledgement, offers connection recovery, accurately distinguishes online/reserved places, and ignores stale callbacks from a previous room.
- Expired rooms notify and evict connected clients before retention cleanup deletes records.

The expanded suite simulated six concurrent guest requests against three free slots and asserted exactly three successful entries with unique slots. It also covered invalid/unknown/full/started/closed rooms, same-member retries, two devices for one member, explicit leave, capacity reclamation, timed cleanup, host expiry, reconnect, and credentials/deadlines surviving three separate Node processes. The server reports 16 passing tests (including grouped subtests); the client reports two room-code tests. A separate same-process integration probe loaded the actual Vite configuration and confirmed API rewriting plus both socket transports.

Fresh browser click-through verification could not run during this follow-up because the browser tool failed to initialize. Cross-process localhost probing also timed out in this environment; a self-contained Vite/backend probe succeeded. These are testing limitations, not evidence of a deployed network failure. Test databases were temporary/in-memory; the existing application database was untouched.

## Findings addressed

| Audit # | Implementation |
| --- | --- |
| 1 | Random private session tokens stored hashed server-side; bound socket identity and host checks; shared IDs grant no authority. |
| 2 | Room/photo reads require bearer membership; expired/closed rooms reject access. |
| 3 | Runtime payload validation, safe optional acknowledgements, caught handler failures, connection/event limits. |
| 4 | All frontend compiler failures repaired; actual layout picker exercised in browser. |
| 5 | Broken bot mutation removed; demo bots disabled and controls removed. |
| 6 | Sample remote footage removed; each participant contributes their own real captures; group frames compose from uploaded participant images. |
| 7 | Capture uniqueness includes room, round, participant, and frame; retries upsert the same identity. |
| 8 | New rounds clear old captures and rotate round identity; stale uploads reject; reshoot first reopens camera readiness. |
| 9 | Upload identity derives from credential; matching room/participant foreign key and attribution validation. |
| 10 | Validated authoritative editor document and shared stage snapshots synchronize guests; guest controls are read-only. |
| 11 | Join/reconnect restores snapshots, editor, selections, timer, and captured frame progress. |
| 12 | Camera readiness, server deadlines adjusted to local clock, acknowledged uploads, completion barrier, visible retries. |
| 13 | Explicit leave revokes membership; online presence is separate; bounded reconnect grace removes guests/closes departed-host rooms. |
| 14 | HTTP/socket limits, quotas, image bounds, room cap, and automatic expiry. SQLite remains intentional for the bounded single-process deployment. |
| 15 | Validated durable inline PNG custom assets, shared design snapshot, overlay rendering; no unrecoverable object URLs. |
| 16 | Canonical /?join=CODE invitations; initial query preserved; completion invitation copy explains next-round use. |
| 17 | Compact persisted preferences/identity; large image/editor data restored from server; browser storage failures caught. |
| 18 | Central leave/reset/disconnect with authenticated REST leave; old room events ignored; fresh round editor cleanup. |
| 19 | Boundary validation for IDs, images, frames, timers, editor fields and CSS; meaningful 400/401/403/409/413/429 responses. |
| 20 | Bundled schema; database/schema resolved independently of working directory. |
| 21 | Versioned transactional migration, legacy two-slot migration test, safe readonly online backup command and restore instructions. |
| 22 | Room/participant creation and joining use transactions; relational capture integrity enforced. |
| 23 | Image readiness before export, visible export errors, generated-file feedback/download fallback, one strip renderer, bounded raster dimensions and PDF compression. |
| 24 | Camera cancellation stops late streams; timers cleaned up; pointer capture handles drawing/gesture cancellation. |
| 25 | Associated/named fields, semantic palette/design/filter controls, keyboard slots/stickers, focus/reduced-motion improvements, host-only editing. |
| 26 | Same-origin Vite API/socket proxy, environment examples, HTTPS/reverse-proxy/SPA deployment instructions. |
| 27 | Shared wire contracts, consolidated editor state, obsolete render/store/socket contracts removed, repaired source formatted. |
| 28 | Assertion-based bounded integration tests and CI build/lint/test gates; compatible dependency patches; vulnerable watcher replaced with native Node watch. |

## Verification limits and deployment decisions

- Real two-device camera permissions, hardware interruption, mobile browsers, clock skew/network delay, and large real-photo exports still need a manual device acceptance check. The browser editor/export check used disposable synthetic photos; the server test separately exercised the real two-client upload barrier.
- PNG/JPEG generation and a PDF payload were verified in the browser. The in-app browser did not emit a download event for the automatic save; a visible generated-file link now provides a user-driven fallback. File saving through a normal browser/device still needs its own check.
- A requested mobile viewport override did not change the in-app browser's measured viewport. Responsive styles were reviewed, but this is not evidence of successful mobile visual testing.
- A completion-screen screenshot is saved as `ui-verification.png`; white frames are the intentionally plain synthetic test images.
- Camera media is captured independently and combined after upload; this implementation does not offer live WebRTC video calls. Deadlines coordinate best-effort capture timing, not hardware-synchronized photography.
- Production hosting, HTTPS certificates, backups at the deployment destination, load testing, and multi-replica scaling were not executed. The supplied reverse-proxy configuration is a deployment example, not an installed service.
- Use one backend process. Presence, rate limits, timers, and room broadcasts are process-local. Image storage is bounded SQLite text for this deployment; object storage can be introduced if capacity demands it.
- The first startup on an existing database runs the tested migration and retention cleanup. Back up the existing database before upgrading; legacy records older than the configured retention will expire. Existing legacy memberships have no private session token and cannot be resumed as authenticated sessions.


## Capture feedback, titles, and group approval

- Each successful camera shot triggers a preview-only white shutter flash. Reduced-motion users get a brief border cue instead. The effect is outside the captured image.
- The host can edit the shared photo title in Decorate and move it using horizontal and vertical sliders. Position is validated by the server, restored in snapshots, and used by all previews and exports. Hiding the PhotoDate watermark leaves the user title visible; clearing the title removes it.
- Capture start requires separate approval from every current participant, in addition to camera readiness and online presence. Participants can withdraw approval. Countdown changes, disconnects, new rounds, and server recovery clear votes; roster changes require fresh approval. The server rejects attempts to bypass the vote.
- Primary capture buttons, selected Stickers/Draw modes, and the landing page group mode have stronger visual states and explicit labels.
- Validation: 16 server tests and 2 client tests pass, with added lifecycle assertions for unanimous approval, withdrawal, countdown resets, retake approval, and title position round trips/rejection. Client production build and lint pass. Browser visual verification could not run because the browser automation runtime failed to initialize (kernel assets path error).


## Sticker gesture responsiveness

- Replaced animated sticker translation with pointer capture and frame-limited local transforms. Screen movement is converted using the actual preview scale, so stickers follow the pointer correctly even in narrow four-photo previews.
- Move, resize, and rotate commit once when released, avoiding shared editor updates during movement. Cancellation restores the saved position and releases gesture listeners. Sticker centers stay within the photo canvas.
- Resize/rotate/delete handles retain 44-pixel screen targets as the preview shrinks. Keyboard movement, resizing, rotation, and deletion remain available; guest stickers remain read-only.
- Verified client build/typecheck and lint, plus six client tests including four gesture regression tests for scaled motion, cancellation, pointer ownership, bounds, guest permissions, resize, and rotate. Browser automation remains unavailable because its kernel assets cannot initialize; actual mouse/touch feel still needs a browser check.


## Small-launch traffic preparation

Target: 10–25 rooms / up to 100 members. Added constant-time capture quotas (schema v3), metadata-only routine photo checks, bounded request admission, shared-Wi-Fi limits, transient upload retries, and proxy cache/compression settings. The isolated 25-room simulation passes for both 16- and 64-worker bursts, including all-member photo downloads and editor publication. See [TRAFFIC_PLAN.md](TRAFFIC_PLAN.md) for measurements, bandwidth math, reproduction commands, deployment requirements, and remaining limits. Regression coverage now passes 17 server tests and nine client tests. Existing user data remains untouched by the tests; back up before applying the migration in normal startup.


## Strip catalog and studio UI refresh

- Eight unique live layouts: Classic Strip, Group Grid, Short Strip, Duo, Long Roll, Wide Grid, Little Polaroid, and Contact Sheet. New layout IDs have matching server allowlists and capture counts.
- Five frame finishes: Classic, Soft, Arch, Ticket, and Postage. Finish is part of the validated design document and survives selections, rounds, snapshots, and export rendering. Rounded/arched finishes also soften photo corners. PNG keeps transparent cutouts; JPEG flattens cutouts onto white without changing the frame color.
- Forty curated designs across five collections, including ten additional colors and twelve picnic/floral/cloud/journal/neon/cosmic prints. Patterns use CSS rather than downloaded image assets. Title contrast adapts to dark frames; automatic title placement follows each layout footer, with manual controls retained.
- Capture has a responsive camera/crew layout, approval progress, member status cards, segmented countdown controls, a consistent host start action, and a shot timeline. Selecting the already-active countdown does not send a reset request.
- Photo review has a bounded preview, separate camera-roll panel, used-photo markers, fill/clear actions, and a clear completion footer. Branding controls are anchored inside the preview card. Mobile layouts stack without shrinking everything into the desktop arrangement.
- Verified client production build/lint, 13 client tests, and 17 server tests. Catalog tests validate every design/edge combination and all layout geometry; the authenticated lifecycle verifies a new layout and edge survive capture start. Browser visual QA and actual decorative-edge export pixels remain unverified because the browser automation runtime fails to initialize (kernel assets path error).


## Visible design selections

The design picker now includes a live strip preview using the actual StripCanvas renderer, plus the chosen design/collection, layout, photo count, and edge name. The preview stays alongside collections on desktop and becomes a compact summary above them on mobile. Each selected collection also shows the exact design name and swatch while collapsed, with that swatch first in the mini-preview row. Unselected previews remain clearly labeled as a prompt rather than silently selecting a design. No camera permission or image downloads are needed for this preview.


## Deployment preparation

Added a root multi-stage Dockerfile, a build-context exclusion list for local secrets/data/dependencies, and optional single-origin static hosting with `/api/rooms` aliases. The deployment regression verifies SPA fallback, immutable asset caching, JSON API/asset misses, and authenticated room access. All 18 server and 13 client tests, frontend build, and lint pass. See DEPLOYMENT.md for account/service/volume/environment setup. No live service or paid resources have been created. The Docker image build remains unverified because the local Docker daemon is not running; local application checks pass independently.


## Live-session follow-up: captures, collaboration, orientation, and closure

- Camera timers carry immutable round/frame identities and consume each scheduled frame once. CaptureRoom independently rejects duplicate/stale/out-of-range callbacks, advances using the scheduled index, and counts unique uploaded frames. Regression coverage reproduces an old timer firing after callback refs point at a newer render.
- Camera preview/capture ratios now follow the chosen frame and participant grid. Group composition uses the chosen output ratio and fits each complete participant image into its tile. Final strip photos use contain sizing so old landscape composites are not cropped again into portrait/square frames. Mismatched legacy photos may have letterboxing rather than missing people.
- Added Landscape Duo, Panorama Trio, Portrait Studio, and Whole Crew, bringing the catalog to 12 layouts. Orientation filters and photo-orientation/group-size guidance distinguish number of shots from number of people; rooms still support at most four cameras.
- Added authenticated room chat in lobby/review and per-photo favorites/preferred-position votes for all members. The host explicitly applies crew order. Messages are plain text, 500 characters each, capped at the latest 50 per room and 20 sends/member/minute; votes validate member identity, photo existence, current round, and slot bounds. One vote per member/photo is stored, reset on new rounds, and removed when a member leaves. Collaboration uses a small dedicated socket event so messages do not rebroadcast photo documents.
- Closed sessions render a dedicated keepsake screen instead of connection-error banners and stale invitations. Members with an in-memory strip can save it locally before returning home; existing browser state is required after the room closes. Normal transient reconnect errors remain separate.
- Validation: 18 server tests and 16 client tests, production builds and lint. Browser/camera/manual visual verification remains unavailable because the browser tool fails to initialize. No production rooms were created or load-tested, and no existing user database was edited during verification.

## Mixed-device compatibility

Added touch/safe-area/viewport layouts, front/rear camera selection, camera and foreground recovery, offline feedback and extended reconnect attempts, host round restart with fresh approval enforcement, bounded export canvases, and feature-detected native file sharing with download/open fallbacks. See DEVICE_COMPATIBILITY.md for the intended browser matrix and outstanding real-device acceptance checks. Frontend and backend must deploy together for round restart support. Validation targets 18 server and 20 client tests, production builds, and lint; device hardware/visual verification remains outstanding.

## Storybook capture and crew review

- Sixteen layouts now include Pocket Portraits, Cinema Club, Storybook, and Weekend Postcard. Mixed layouts use actual spanned portrait/landscape slots. Camera capture preserves source orientation for mixed layouts; group composition fits complete member images into the current slot ratio. Reordered images remain contained, with possible letterboxing.
- Capture foregrounds the selected strip, sharing the existing camera stream into the next highlighted slot with a countdown and short frame-to-frame transition. Local photos fill their slots immediately; group composites are assembled after uploads. A separate camera preview retains permission/recovery and camera switching controls. Local strip previews reset on round restart.
- Review has a dedicated chat panel, photo favorites/position suggestions, host reorder arrows, and per-member approval of the current photo order. Server-generated revisions reject stale approvals; changing order/layout resets approvals, while unrelated title changes preserve them. Continuing to editing requires every remaining room member's approval. Chat and votes remain authenticated and bounded.
- Small entry/button/frame transitions respect CSS reduced-motion preferences, and Framer Motion uses the user's reduced-motion setting. No additional image assets or camera streams are opened for the strip preview.
- Validation: frontend build/lint and 20 client tests plus 18 server tests. Coverage includes catalog geometry/non-overlap and mixed ratios, source-orientation preservation, stale/background capture rejection, and authenticated review revision/reset/continuation checks. Actual camera, mobile sharing, and visual/animation acceptance testing remains outstanding because browser automation cannot initialize on this machine. Deploy frontend and backend together, refresh both devices, and create a fresh room.

## Capture workspace redesign

Replaced the vertically stacked capture presentation with a larger camera stage, a narrow live keepsake rail, a compact shot timeline, and a separate crew control panel. Desktop uses the available page width; tablets place crew controls below the camera/strip pair, and phones keep a full-width camera with a compact horizontal keepsake card. Added a three-step session indicator, shorter instructions, clearer headings, and consistent controls while retaining existing theme colors, live frame transitions, approval behavior, and exact capture ratios. Removed the camera's hard minimum height so narrow previews do not overflow their allocated frame. Frontend build/lint and all 20 client tests pass. Actual viewport/camera visual acceptance checks remain outstanding; browser automation is unavailable in this environment.
