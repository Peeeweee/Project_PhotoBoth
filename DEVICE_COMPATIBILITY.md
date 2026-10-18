# Mixed phone and laptop rooms

PhotoDate runs in a browser; no native application installation is required. The intended browser matrix is Safari on iOS/macOS, Chrome on Android/macOS/Windows, Edge on Windows, and Firefox on desktop. Actual devices still need acceptance testing; this is a support target, not a certification.

## Device adaptations

- Responsive capture, approval, review, filter, decoration, and export panels; touch controls, safe-area padding, dynamic viewport sizing, and readable mobile form inputs.
- Inline camera preview, front/rear camera switching where hardware permits, actual camera-facing mirroring, and permission/disconnection recovery messages. Camera access requires HTTPS or localhost.
- Backgrounding, muted camera tracks, and overdue timers cannot silently upload an old shot. Keep every participant's capture tab in the foreground. Mobile operating systems can suspend cameras and timers.
- The host can restart an interrupted round. This clears that round's photos and approvals; everyone must enable their camera and approve again.
- Network status and reconnect attempts help when switching networks. Reconnection cannot guarantee recovery after the operating system kills a tab or after a membership lease expires.
- Export canvas dimensions and pixel budgets are bounded for phones. Prepared files offer native file sharing when the browser supports it, with download/open-file fallbacks. Available share destinations depend on the device. JPEG uses a white background for transparent edges.

## Before calling device support verified

Run one phone plus one laptop, then up to four mixed devices, against the same deployed frontend/backend version. Use fresh rooms after deployment.

1. Check 360×800, 390×844, 768×1024, 1366×768, and phone landscape layouts, including keyboard-open chat and title controls.
2. Join by code/link; approve on every device; switch front/rear cameras before starting; rotate the phone and verify preview framing matches the saved shot.
3. Background one device during countdown, return, and restart the round as host. Verify fresh approvals and complete uploads without duplicate frames.
4. Toggle Wi-Fi/mobile data and airplane mode. Confirm offline feedback, reconnect behavior, upload retry, and clear recovery if membership has expired.
5. Check touch dragging/resizing, photo voting, portrait/landscape group framing, and PNG/JPEG/PDF exports. Try both native sharing and fallback open/download paths.
6. Close the room as host and save the remaining local keepsake as a guest.

Automated checks cover capture identity/background rejection, restart authorization/reset, export size limits, file bytes/MIME, and sharing fallbacks. Real iOS/Android/macOS camera, download, rotation, and visual checks have not been executed here: the browser automation runtime cannot initialize on this machine.
