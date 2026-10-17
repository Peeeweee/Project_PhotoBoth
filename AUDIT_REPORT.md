# PhotoDate project audit

Reviewed: 2026-10-16. Scope: application source, frontend routes and state, backend REST and Socket.IO handlers, SQLite schema and queries, package scripts, configuration, and documentation. No application source was changed. Build commands generated normal compiler output.

Remediation update 2026-10-17: this report preserves the original audit. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for the implemented fixes, passing checks, and remaining device/deployment verification limits.

## Assessment

The project is a prototype with substantial release blockers. The UI has a coherent component structure, but the central promise of a shared remote photobooth is incomplete. Both production builds fail, authorization is bypassable, and capture persistence and shared editing disagree with the user flow.

## Validation

- Client `npm run build`: failed with TypeScript errors, including missing icon imports, invalid model properties, nullable layout arguments, and unused symbols.
- Server `npm run typecheck` and `npm run build`: failed because `participantQueries.deleteById` does not exist.
- Client `npm run lint`: reported undefined JSX identifiers, unused code, and failure to read `public/debug.js` as UTF-8. The shell reported exit code zero, so the current lint invocation is not a dependable release gate for all diagnostics observed.
- Local integration probes ran against emitted server JavaScript with SQLite `:memory:` on port 3198. They confirmed public host-ID disclosure, host impersonation without joining a socket room, anonymous capture reads, acceptance of invalid image text with a participant from another room, and duplicate-frame HTTP 500 responses. The server compiler emitted JavaScript despite reporting a type error; successful probes do not mean the build passed.
- Existing database contents were not queried or modified. No browser visual/accessibility session, dependency vulnerability audit, production infrastructure inspection, or load test was performed. Findings below are source findings unless explicitly marked reproduced.
- Initial attempts to launch a separate test process were unsuccessful in this environment; the successful probe used one process and an in-memory database.

## P1 — release blockers and major defects

1. **Public IDs function as host credentials.** `photodate-server/src/routes/rooms.ts:84` returns the room's `host_id` and participant IDs. `src/socket/roomHandlers.ts:154`, `216`, `254`, and `294` authorize changes by comparing a caller-supplied ID with that public host ID. They do not require an authenticated socket identity or room membership. Reproduced: an unjoined socket changed a room from waiting to capturing with `{ ok: true }`. Issue private session credentials, bind socket identity server-side, and enforce authorization for every mutation. A login system is optional; unforgeable session authorization is essential.

2. **Photo retrieval has no participant authorization.** `photodate-server/src/routes/rooms.ts:234` returns all stored images to anyone with the five-letter room code, including after closure. No expiry or request throttling is present. Anonymous read returned HTTP 200. Require a room-scoped session credential and define photo retention and revocation.

3. **Socket input can throw out of event handlers.** `photodate-server/src/socket/roomHandlers.ts:47` destructures an unchecked payload, calls string methods on unchecked values, and assumes `ack` is callable. Registration at line 329 has no validation/error boundary. Null payloads, wrong field types, missing callbacks, and database exceptions can escape the event listener and terminate the process under ordinary uncaught-exception behavior. Validate incoming data, make acknowledgements optional at runtime, and catch handler failures. Process termination was not exercised by the successful integration probe.

4. **The frontend does not build, and layout selection can crash during development.** `photodate-client/src/pages/LayoutSelect.tsx:57` and `125` render `LayoutTemplate` and `ArrowRight` without importing them. These are runtime undefined identifiers as well as compiler failures. Other errors include `StripCanvas.tsx:220` reading nonexistent `DesignPreset.themeId`, the `ReactNode` import in `Layout.tsx`, and nullable layout/identity values throughout the pages. Restore a passing build before release.

5. **The backend does not build, and removing a bot calls an undefined method.** `photodate-server/src/socket/roomHandlers.ts:316` calls `participantQueries.deleteById`; the exported helper is `delete`. In development execution this path can throw from the socket callback. Fix the call and test bot removal with an actual bot present.

6. **Remote participants display sample videos rather than their cameras.** `photodate-client/src/components/capture/CameraView.tsx:197–253` assigns Wikimedia videos to every non-local participant, including real guests. There is no peer-media transport or signaling implementation. The resulting composite contains the local user's camera and sample footage. Implement real remote media or deliberately switch to a model that gathers individual captures and composes them on the server.

7. **Participants collide on the same capture indexes.** `photodate-client/src/pages/CaptureRoom.tsx:91` uploads each participant's frames as indexes starting at zero. `photodate-server/src/schema.sql:42` allows only one capture per `(room_id, frame_index)`. The first upload wins and subsequent participants get errors, potentially producing a strip assembled from inconsistent sources. A duplicate index returned HTTP 500 in the probe. Choose either a single authoritative composite uploader or per-participant, per-round capture records.

8. **Retakes and restarts cannot replace stored captures.** DoneRoom transitions back to capture/waiting, but no handler invokes `captureQueries.deleteByRoom`, and new shots restart at index zero. The uniqueness constraint rejects them, leaving old images in place. Add a capture-round identifier or clear the previous capture set transactionally when a retake is accepted; make retries idempotent.

9. **Uploads can be attributed to participants from other rooms.** `photodate-server/src/routes/rooms.ts:188–219` checks that the room exists but never verifies participant membership or identity. Separate foreign keys in `schema.sql:37–38` do not establish that participant and capture share a room. Reproduced: a different room's host ID and `not-an-image` were accepted with HTTP 201. Enforce membership and lifecycle in application logic and add a matching relational invariant where practical.

10. **Guests stop following the workflow after review.** `photodate-client/src/components/layout/Layout.tsx:45` navigates only for capturing and waiting. `EditorRoom.tsx:67` moves only the host to `/filter`; filter/decorate/export changes and photo assignments stay in the host's browser. The socket contract has no events for shared assigned photos, stickers, strokes, title, filter, or completion. Guests cannot view the same final strip through the advertised shared session. Define an authoritative editor document and broadcast both its state and workflow stage.

11. **Reconnect does not restore authoritative room state.** `photodate-server/src/socket/roomHandlers.ts:87–90` acknowledges and broadcasts participants only. `photodate-client/src/components/layout/Layout.tsx:34` does not fetch status, selections, timer, or captures on reconnect. JoinRoom's REST response contains selections/timer, but Landing applies only room metadata. Missed events therefore leave clients in stale phases or using the wrong layout/timer. Return and apply a complete snapshot on every join/reconnect, then consume versioned updates.

12. **Capture advances despite upload failures and without a readiness barrier.** `photodate-client/src/pages/CaptureRoom.tsx:87–116` logs failed uploads and proceeds. The host advances to review when its own sequence completes, regardless of guest uploads. Each client uses local countdowns rather than a shared shot deadline. Camera readiness is not a prerequisite, so slow or denied camera access can yield blank/placeholder captures. Track camera readiness, authoritative shot deadlines, acknowledged uploads, and a completion barrier.

13. **Participant slots never become available after leaving.** `photodate-server/src/socket/roomHandlers.ts:101–121` clears socket metadata without removing or marking the participant absent. Disconnect rebroadcasts the unchanged DB list at line 195. REST joins count these permanent rows, so abandoned rooms fill up and hosts who leave have no recovery policy. Separate membership from online presence, support explicit leave, and define reconnect grace periods and host departure behavior.

14. **Unbounded public storage and request work enable resource exhaustion.** `photodate-server/src/index.ts` allows 50 MB JSON bodies, while room creation, joining, capture upload, socket mutations, and image retrieval have no rate limits or quotas. Images are large text fields written through synchronous SQLite calls and returned together. There is no expiry/cleanup path. Limit encoded and decoded image size, dimensions, frame counts, timers, request rates, concurrent sessions, and retention; move image bytes to suitable managed file/object storage when needed.

## P2 — correctness, resilience, and maintainability

15. **Custom uploaded designs are ignored by the actual strip renderer.** `CustomUploadCard.tsx:27–38` creates a custom preset in the session store, but `StripCanvas.tsx:64` resolves only static `ALL_DESIGNS` and falls back to the first preset. Reconnect selection handling likewise searches only built-in packs. Pass the selected design explicitly or use one registry; upload/share the actual asset. Object URLs also become invalid after reload even though their strings are persisted, and are never revoked.

16. **Invitation links are inconsistent and broken for fresh visitors.** `CopyLinkButton.tsx:16` copies `/lobby?join=CODE`, but Lobby redirects visitors without stored identity to `/`, losing the query. `DoneRoom.tsx:26` uses `/join/CODE`, which has no route. Landing expects `/?join=CODE`. Use a single canonical invitation route and test it in a clean browser context.

17. **Large image state is synchronously persisted on every edit.** `useSessionStore.ts` persists its entire state to sessionStorage, including base64 assigned photos and drawing points. This risks quota failures and repeatedly serializes images while dragging or drawing. Persist compact references/metadata; use a suitable asynchronous store for image blobs and explicitly handle storage errors.

18. **Leaving and starting another session retains stale state.** `DoneRoom.tsx:64` resets only session state and navigates home; the room identity and socket membership remain. Lobby resets only room state. Landing creates/joins rooms without consistently resetting previous photo/editor state. Layout's effect joins when disconnected but does not generally move an already connected socket into a new room; Lobby currently masks parts of this with another join effect. Centralize join/leave/reset and socket lifecycle, including handling late events from the previous room.

19. **Runtime validation is much weaker than the TypeScript contracts.** Capture frame indexes need not be nonnegative integers or in range; image strings are not decoded or checked. Timer validation at `roomHandlers.ts:220` accepts fractions and has no upper bound. Layout and design IDs are unchecked. HTTP malformed JSON/body-limit errors are converted to generic 500s by the global error handler. Validate all boundaries and preserve meaningful 400/413/409 responses.

20. **Compiled deployment still depends on the source tree and working directory.** `photodate-server/src/db.ts:65` reads `process.cwd()/src/schema.sql`; the build only runs `tsc`. A distribution containing only `dist` cannot initialize, and starting from a different directory changes both schema and default DB resolution. Bundle the schema or migrations and resolve paths from explicit configuration or the installed module.

21. **There is no migration strategy.** `CREATE TABLE IF NOT EXISTS` cannot update existing constraints or columns. In particular, a previously created two-person participant table would keep its old slot constraint. Introduce schema versions and transactional migrations, plus a tested backup/restore procedure.

22. **Multi-record operations are not transactions.** Room creation inserts the room then the host; a failure can leave an orphaned room with a nonexistent host. Slot selection and insertion are separate statements. Single-process synchronous execution avoids JavaScript interleaving here, but additional processes can race against the same SQLite file. Use transactions and handle uniqueness conflicts deliberately. Host ownership itself is not enforced by a matching relational constraint.

23. **Export failures are invisible to users and image readiness is not coordinated.** `ExportRoom.tsx` catches errors with console logging only. FilteredImage performs asynchronous rasterization without a completion signal to export. Rapid filter changes followed by export can capture the prior image. Add readiness checks, visible failure/retry states, and snapshot validation. The separate `canvasExport.ts` implementation is unused by the actual export page and omits editor overlays; maintaining two render paths invites divergence.

24. **Camera acquisition can outlive unmount.** `CameraView.tsx:46–75` stores `activeStream` only after awaiting permission. Cleanup can run before that promise resolves, so a later stream is neither stopped by the already-finished cleanup nor protected from a stale state update. Guard async completion and immediately stop streams acquired after cancellation. Capture-sequence and flash timers also need lifecycle cleanup.

25. **Accessibility is incomplete in the primary workflow.** Landing uses span-based field labels and a clickable div for the group toggle; editor thumbnails/slots and sticker manipulation depend on pointer interaction. Add associated labels, semantic controls, keyboard selection/manipulation, focus indicators, and announced errors/status. Visual contrast and responsive layout still need browser verification.

26. **Networking defaults are local-development defaults.** Both client transports default to `http://localhost:3001`. A phone following the README's network URL will call its own localhost unless `VITE_SERVER_URL` is configured. The backend defaults to a localhost-only frontend origin. Provide an environment example and deployment instructions covering the public API URL, allowed origins, secure camera contexts, WebSocket proxying, and SPA fallback routes. No client environment example was found.

27. **State models and contracts are duplicated.** Socket event types are copied between packages; API lifecycle status is a plain string; multiple casts to `any` suppress checks. `useEditorStore` duplicates editor concepts already held in `useSessionStore`, while strip queries and tables are not connected to the final export flow. Consolidate shared contracts and remove or implement unused state/persistence paths. Existing SQLite prepared statements, WAL, foreign keys, and the room transition allowlist are useful foundations worth retaining.

28. **Testing and release controls are insufficient.** The smoke test has no bounded connection/ack waits and logs an unexpected authorization result without failing the run. There are no package test scripts or visible CI/deployment checks. Add assertions for authorization bypass attempts, malformed socket input, two-client capture, retake/restart, reconnect snapshots, invitations, custom assets, storage limits, and export. Require builds and meaningful checks to pass before release.

## Recommended order

1. Restore both builds and stop socket exceptions from escaping.
2. Introduce room-scoped credentials and authorization for all REST/socket operations.
3. Decide the remote capture model and implement it consistently with the capture schema.
4. Add capture rounds, idempotent uploads, readiness/completion coordination, and reconnect snapshots.
5. Synchronize the editor document and navigation, then repair invitations, custom designs, and cleanup.
6. Add bounded storage/retention, migrations, deployment configuration, and automated regression checks.

SQLite itself is not the core problem. The immediate issues are identity enforcement, inconsistent data ownership, missing synchronization, and unchecked failure paths. A larger database would preserve those defects unless the underlying contracts are corrected.
