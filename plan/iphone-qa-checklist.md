# Real-iPhone QA checklist

Run on the intended iPhone using the final HTTPS production or preview URL. Desktop emulation is not sufficient.

Record the iOS version, iPhone model, Safari version, deployment identifier, tester, date, and every failure.

## Installation and launch

- Safari shows the correct secure HTTPS origin.
- Add to Home Screen uses the dumbbell icon and “Workout” title.
- Home Screen launch opens standalone without Safari chrome.
- Top content and bottom navigation respect the notch and Home indicator.
- Portrait is polished; landscape remains usable without clipped controls.
- A new deployment updates without losing an active workout.

## Authentication and privacy

- Logged-out navigation redirects to Login.
- Password-manager autofill works.
- Closing and reopening preserves the authenticated session appropriately.
- Sign out clears device-local workout/cache data and returns to Login.
- Browser back cannot reveal private content after sign-out.

## Active workout

- Today reaches Start Workout without horizontal scrolling.
- Primary controls are comfortably reachable one-handed.
- Weight and rep inputs do not zoom the page.
- Numeric keyboards are appropriate and dismissible.
- Rapid Complete Set taps do not create duplicates.
- RIR confirmation is announced and operable with VoiceOver.
- Undo restores the correct set.
- Replacement selection remains usable with the keyboard open.
- Rest time is reconstructed correctly after backgrounding.

## Offline durability

1. Start online and complete a set.
2. Enable Airplane Mode.
3. Complete more sets, edit values, background, and reopen.
4. Confirm entries remain and show Pending.
5. Disable Airplane Mode and foreground the app.
6. Confirm Pending becomes Synced once and History matches.
7. Create a deliberate two-device revision conflict and test both resolution choices.

## Accessibility

- VoiceOver reads exercise, set, load semantics, reps, RIR, and button action.
- Icon-only controls have meaningful names.
- Focus order follows the visible workflow.
- Completed, pending, error, and conflict states do not rely only on color.
- Increased text size does not hide primary actions.
- Reduce Motion removes nonessential movement.
- Light and dark appearances maintain contrast.

## PWA and failures

- Offline launch reaches the offline workout shell.
- Authenticated API responses are absent from Cache Storage.
- Manifest and Apple touch icon load while signed out.
- Expired auth returns clearly to Login without erasing unsynced IndexedDB data.
- A temporary Supabase outage never reports an unsynced set as synchronized.
