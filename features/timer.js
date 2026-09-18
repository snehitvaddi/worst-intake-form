// features/timer.js — the session timer that hates you.
//
// Starts at 5:00 and drops a random amount every real second: usually 1s, sometimes a
// lot more. At 0:00 the page reloads and nothing is saved.
//
// It is beatable: "Need more time?" is a trap (-30s), but the tiny "beg" link gives
// time back if you type "pretty please" (one more "pretty" every time you ask), and
// other gags can call ctx.timer.reward().
//
// Debug: ?t=20 starts the clock at 20 seconds.
(function () {
  var START_SECONDS = 5 * 60;
  var CHANCE_NORMAL_TICK = 0.85;  // probability a tick costs exactly 1s
  var MAX_JUMP = 20;              // otherwise it costs a random 2..MAX_JUMP seconds
  var MORE_TIME_COST = 30;
  var BEG_REWARD = 60;

  var TAUNTS = [
    { at: 120, text: function (n) { return 'Two minutes left, ' + n + '. Most patients are on section 6 by now.'; } },
    { at: 60,  text: function (n) { return 'One minute, ' + n + '. Progress is still not being saved. Have you tried begging?'; } },
    { at: 30,  text: function (n) { return 'Deep breaths, ' + n + '. Stress can affect your answers.'; } }
  ];

  var CSS =
    '.timer-bar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:center;gap:14px;padding:10px 16px;background:#10202b;color:#fff;border-bottom:3px solid #0f6e84}' +
    '.timer-label{font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.75}' +
    '.timer-clock{font:700 34px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;min-width:4.2ch;text-align:center}' +
    '.timer-delta{font:600 14px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#ff8a80;min-width:5ch;opacity:0}' +
    '.timer-delta.gain{color:#86efac}' +
    '.timer-delta.show{animation:timerDelta 900ms ease-out}' +
    '@keyframes timerDelta{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-10px)}}' +
    '.timer-more{padding:5px 10px;font-family:inherit;font-size:12px;color:#cfe8ee;background:transparent;border:1px solid #3d5666;border-radius:999px;cursor:pointer}' +
    '.timer-more:hover{background:#1b3342}' +
    '.timer-more:disabled{opacity:.5;cursor:default}' +
    '.timer-beg{padding:0;font-family:inherit;font-size:10px;color:#6f8797;text-decoration:underline;background:none;border:0;cursor:pointer}' +
    '.timer-bar.warn{border-bottom-color:#f59e0b}' +
    '.timer-bar.warn .timer-clock{color:#fbbf24}' +
    '.timer-bar.panic{background:#4a0d0d;border-bottom-color:#c62828}' +
    '.timer-bar.panic .timer-clock{color:#ff6b6b;animation:timerPulse 500ms infinite alternate}' +
    '@keyframes timerPulse{to{opacity:.45}}' +
    '@media (max-width:600px){.timer-clock{font-size:28px}.timer-label{display:none}}';

  function fmt(s) {
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function nextDrop() {
    if (Math.random() < CHANCE_NORMAL_TICK) return 1;
    return 2 + Math.floor(Math.random() * (MAX_JUMP - 1));
  }

  window.Gags.register({
    id: 'timer',
    title: 'Random-drop session timer',
    init: function (form, ctx) {
      var override = parseInt(ctx.params.get('t'), 10);
      var remaining = override > 0 ? override : START_SECONDS;
      var baseTitle = document.title;
      var pendingTaunts = TAUNTS.filter(function (t) { return t.at < remaining; });
      var ticker = null;
      var stopped = false;
      var begs = 0;
      var begging = false;

      var style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      var bar = document.createElement('div');
      bar.className = 'timer-bar';
      bar.setAttribute('role', 'timer');
      bar.innerHTML =
        '<span class="timer-label">Session expires in</span>' +
        '<span class="timer-clock"></span>' +
        '<span class="timer-delta"></span>' +
        '<button type="button" class="timer-more">Need more time?</button>' +
        '<button type="button" class="timer-beg">beg</button>';
      document.body.insertBefore(bar, document.body.firstChild);

      var clock = bar.querySelector('.timer-clock');
      var delta = bar.querySelector('.timer-delta');
      var more = bar.querySelector('.timer-more');
      var beg = bar.querySelector('.timer-beg');

      function render(change) {
        clock.textContent = fmt(remaining);
        document.title = fmt(remaining) + ' · ' + baseTitle;
        bar.classList.toggle('warn', remaining <= 120 && remaining > 45);
        bar.classList.toggle('panic', remaining <= 45);
        if (Math.abs(change) > 1) {
          delta.textContent = (change > 0 ? '-' : '+') + Math.abs(change) + 's';
          delta.classList.toggle('gain', change < 0);
          delta.classList.remove('show');
          void delta.offsetWidth; // restart the animation
          delta.classList.add('show');
        }
      }

      function stop() {
        stopped = true;
        clearInterval(ticker);
      }

      function expire() {
        stop();
        if (form.isConnected) form.reset();   // make sure nothing survives the reload
        location.reload();
      }

      // Positive seconds take time away, negative seconds give it back.
      function take(seconds) {
        if (stopped) return;
        remaining = Math.max(0, remaining - seconds);
        ctx.timer.remaining = remaining;
        render(seconds);
        while (pendingTaunts.length && remaining <= pendingTaunts[0].at) {
          ctx.say(pendingTaunts.shift().text(ctx.patientName()));
        }
        ctx.timer._emit(seconds);
        if (remaining === 0) expire();
      }

      ctx.timer.remaining = remaining;
      ctx.timer.penalize = function (seconds) { take(Math.max(1, Math.round(seconds) || 0)); };
      ctx.timer.reward = function (seconds) { take(-Math.max(1, Math.round(seconds) || 0)); };

      more.addEventListener('click', function () {
        more.disabled = true;
        more.textContent = 'Request processed';
        ctx.say('Extension request processed, ' + ctx.patientName() + '. A ' + MORE_TIME_COST + 's handling fee applies. To appeal, beg.');
        take(MORE_TIME_COST);
        setTimeout(function () {
          more.disabled = false;
          more.textContent = 'Need more time?';
        }, 8000);
      });

      beg.addEventListener('click', async function () {
        if (begging || stopped) return;
        begging = true;
        var phrase = new Array(begs + 2).join('pretty ') + 'please';
        var answer = await ctx.modal({
          title: 'Appeal for more time',
          html: '<p>To be granted ' + BEG_REWARD + ' seconds, type <strong>' + phrase + '</strong> below. ' +
                'Pasting is considered insincere.</p>',
          input: { placeholder: 'say it like you mean it', noPaste: true, enterValue: 'beg' },
          actions: [
            { label: 'Never mind, I have plenty of time', value: 'cancel', kind: 'big' },
            { label: 'submit appeal', value: 'beg', kind: 'tiny' }
          ]
        });
        begging = false;
        if (answer.value !== 'beg') return;
        if (answer.text.trim().toLowerCase() === phrase) {
          begs++;
          take(-BEG_REWARD);
          ctx.say('Appeal granted, ' + ctx.patientName() + '. Next time, one more "pretty".');
        } else {
          take(5);
          ctx.say('That did not sound sincere, ' + ctx.patientName() + '. -5s.');
        }
      });

      ctx.addStat(function () {
        return begs ? 'Begged for more time: ' + begs + (begs === 1 ? ' time.' : ' times.') : 'Never begged. Noted in your file as "proud".';
      });

      document.addEventListener('intake:submitted', function () {
        stop();
        document.title = baseTitle;
        bar.hidden = true;
      });

      render(0);
      ticker = setInterval(function () { take(nextDrop()); }, 1000);
    }
  });
})();
