# Build prompt — World's Worst Patient Intake Form

> Draft v1. Anything marked **ASSUMPTION** is a guess at what we meant — edit it, then paste the
> whole prompt into a Claude Code session opened in this folder.

---

You are extending a deliberately terrible patient intake form. It is a comedy / bad-UX showcase:
nothing is real, no data ever leaves the browser, and "worse is better" as long as the form is
still technically completable by a determined human.

## What already exists
- `index.html` — a short 4-section intake form (about you, emergency contact, reason for
  visit, consent). Giant green **Clear Form** button (instant wipe, no confirmation) as the
  obvious CTA; a tiny grey underlined `submit` beneath it. Submit is a stub: it runs every
  gag's submit check, logs the payload, fires `intake:submitted`, and shows a scorecard plus
  a prescription for anxiety medication.
- `gags.js` — the registry + `ctx` (toasts, in-page dialogs, submit checks, scorecard stats,
  timer penalize/reward). Read its header comment before writing a feature.
- `server.mjs` — static server + `POST /api/pose-check` (Claude judges the camera pose).

| Gag (`features/<id>.js`) | What it does | How it stays winnable |
|---|---|---|
| `timer` | 5:00, drops a random 1-20s per second, reload + wipe at 0:00. "Need more time?" costs 30s. | Tiny `beg` link: type "pretty please" for +60s (one more "pretty" each time). |
| `pencil` | Checkboxes are Scantron bubbles; pick up the pencil and shade >= 95%. Heckles by name, goes blunt, no typing while holding it. | Neat bubble = +10s. Eraser + sharpener provided. |
| `scream` | Pain level set by microphone volume, hold 3s to lock. On submit: duck says YES, dog says NO. | Everything can be typed instead (`AAAAAAH`, `quack`). |
| `slots` | Phone number on a 10-reel slot machine. | Reels are slow and sequential. |
| `records` | Auto pop-up asks your name, matches you to the closest-named famous athlete and pre-fills the form as them. Fields are "Verified": double-click to dispute. Re-syncs corrected fields. | Max 3 re-syncs, each field only once. Public facts only about real people. |
| `ads` | 1990s banner bars between sections (wait 5s to close, they grow back) and click-triggered pop-ups targeted at your symptoms. Skip = misfortune, "your cough will increase by 41%". | Watching to the end = good luck +20s. `WATCH AD +45s` tab. |
| `sounds` | Every key and click beeps, more frantic as time runs out. | Mute works (20-second free trial). |
| `dodge` | The submit link runs from the cursor. | Gets tired after 5 dodges. |
| `otp` | "OTP expires in 5 seconds", code arrives at second 4, auto-retries with a reason, then "You are too slow" / "I will let you pass this time". | Always passes after 2 rounds. |
| `human` | Mid-form "Are you human?": turn on the camera, pose as an elephant/giraffe/etc., Claude judges the photo. | Fake judge if no backend, waved through after 3 tries, sworn statement if no camera. |
| `captcha` | "Select all squares containing your symptoms." First answer is always wrong. | Second answer is always right. |
| `nag` | Submit asks "are you sure?" three times with the big button being the wrong one; Enter offers to clear the form. | Tiny links always proceed. |

## Running it
```
npm install
node server.mjs        # http://localhost:4173
```
Set `ANTHROPIC_API_KEY` (or `ant auth login`) before starting if you want the real AI pose
judge; without it the page quietly uses a fake judge.
- `?t=25` starts the clock at 25 seconds (test expiry without waiting).
- `?off=timer,ads` (any comma-separated ids) disables gags while you work on yours.

## Adding your feature
1. Create `features/<id>.js` (copy the shape of `features/dodge.js`, the smallest one). Inject
   your own CSS/markup from inside `init` so the file is fully self-contained.
2. Add one `<script src="features/<id>.js"></script>` line at the bottom of `index.html`,
   before `nag.js`. That single line is the only edit you make outside your own file.

## Architecture rules
- Stay vanilla HTML/CSS/JS. No frameworks, no bundler.
- One gag = one file: `features/<id>.js`, loaded by a `<script>` tag in `index.html`.
- Each file registers itself: `window.Gags.register({ id, title, init(form, ctx) })`.
- `ctx` exposes: `ctx.patientName()` (first name typed so far, else "patient"),
  `ctx.timer` (`remaining`, `onTick(fn)`, `penalize(seconds)`), and `ctx.say(text)` (a toast that
  speaks to the patient by name).
- Any gag can be switched off with `?off=id1,id2` so people can demo or debug one at a time.
- Never persist anything (no localStorage, cookies, or network calls).
- One person owns one feature file. Don't edit someone else's file — propose changes to them.

---

# Original brief (now implemented, kept for reference)

## Feature 1 — `pencil`: shade the bubble completely
- Every checkbox and radio is replaced by a Scantron-style bubble drawn on a small `<canvas>`.
- A pencil sits in a tray at the top of the form. Until you click to pick it up, bubbles ignore
  you. Once held, the cursor becomes the pencil.
- You shade by click-dragging. The option only counts as selected when >= 95% of the bubble's
  pixels are filled. Anything less reads as unanswered on submit.
- While you shade, `ctx.say()` heckles you by name with the live percentage
  ("Stay inside the lines, Priya — 71%", "So close, Priya. Not close enough.").
- The pencil goes blunt after ~3 bubbles; strokes get thin and useless until you drag it to the
  sharpener. Shading outside the bubble costs `ctx.timer.penalize(5)`.
- **ASSUMPTION:** applies to every checkbox/radio, not just one question.

## Feature 2 — `scream`: make noise until it's loud/high enough
- **ASSUMPTION (the original note was garbled):** a microphone-driven input.
- The pain-level slider cannot be dragged. It is driven by mic volume via the Web Audio API
  (`getUserMedia` + `AnalyserNode`): louder = higher pain. It falls back to 0 when you stop.
- To lock a value in, you must hold it within +/-1 for 3 continuous seconds.
- A live "noise board" meter shows volume and pitch. Consent can only be ticked while pitch is
  above a threshold (you have to squeal to agree).
- If mic permission is denied, the field stays locked and says
  "We can't hear your pain, {name}."
- Alternative reading to discuss: a soundboard where every click/keystroke plays obnoxious sounds
  that get more frantic as the timer drops.

## Feature 3 — `records`: "We found your records!"
- The form opens with only one question: patient name.
- After a fake 4-second "searching 3 national databases" spinner (the timer keeps running), it
  announces a match and autofills every field with confidently wrong details belonging to someone
  else (wrong DOB, 14 allergies, an emergency contact named "Gary (do not call)").
- Every autofilled field is marked "Verified" and needs a double-click plus a "Are you sure you
  know better than our records, {name}?" confirm before it becomes editable.
- Every ~40 seconds it "re-syncs" and overwrites one corrected field back to the wrong value.
- **ASSUMPTION:** the fights-back version; a tamer option is a plain "fill demo data" button.

## Acceptance
- Form is still completable end to end with all gags on (we time a volunteer).
- Each gag works alone with the others `?off=`'d.
- Timer expiry still hard-reloads and wipes everything, including canvas bubbles and mic state.
- Submit remains a stub: log the payload to the console and show the "Intake received" panel.

## Parking lot (vote before anyone builds these)
- Phone number entered with a single 0–9,999,999,999 slider.
- Date of birth via a "+1 day" button starting from 1 Jan 1900.
- CAPTCHA: "Select all squares containing your symptoms."
- The `submit` link drifts a few pixels away from the cursor each time you hover it.
- Terms of service that must be scrolled to the end; it is 40 screens and scrolls back up on tick.
