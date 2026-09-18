# The World's Worst Patient Intake Form

A deliberately terrible, but always winnable, patient intake form. Bad on purpose.

**Demo:** [demo/demo.mov](demo/demo.mov)

- A 5:00 timer that drops by random amounts, then reloads the page and saves nothing.
- **Clear Form** is the giant green button. `submit` is a tiny underlined link that runs away.
- Checkboxes must be shaded in by hand with a pencil. Pain level is reported by screaming.
- Your records are pre-filled as the famous athlete whose name is closest to yours.
- 1990s ads targeted at your symptoms, a 5-second OTP, a camera "pose as an elephant" CAPTCHA
  judged by Claude, and three rounds of "are you sure?".
- The visit ends with a prescription for anxiety medication.

## Run it

```
npm install
node server.mjs
```

Open http://localhost:4173. Set `ANTHROPIC_API_KEY` first if you want the real AI pose judge;
without it a fake judge steps in.

`?off=timer,ads` disables gags by id. `?t=25` starts the clock at 25 seconds.

Every gag is one file in `features/`. See [PROMPT.md](PROMPT.md) for the full list and how to add one.
