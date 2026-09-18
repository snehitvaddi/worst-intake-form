// features/scream.js — answers are given by making noise.
//
// 1. Pain level: the slider can't be dragged. Scream into the microphone; louder = more
//    pain. Hold your level steady (+/-1) for 3 seconds to lock it in. Squeal above 500 Hz
//    while locking for a soprano bonus.
// 2. Confirmation on submit: duck says YES, dog says NO. Quack (high) or bark (low).
//
// No microphone / permission denied: every noise can be typed instead ("AAAAAAH",
// "quack", "woof"), so the form is always completable.
(function () {
  var HOLD_MS = 3000;
  var QUACK_ABOVE_HZ = 300;      // a burst above this pitch is a duck, below is a dog
  var SOPRANO_HZ = 500;
  var SOPRANO_REWARD = 15;

  var CSS =
    '.scream{margin-top:10px;padding:12px 14px;background:#f6f9fb;border:1px dashed #b9c4cf;border-radius:8px;font-size:14px}' +
    '.scream-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px}' +
    '.scream-mic{padding:8px 12px;font-family:inherit;font-size:14px;font-weight:600;color:#fff;background:#0f6e84;border:0;border-radius:6px;cursor:pointer}' +
    '.scream-mic:disabled{opacity:.6;cursor:default}' +
    '.scream-meter{flex:1;min-width:140px;height:14px;background:#dfe6ec;border-radius:999px;overflow:hidden}' +
    '.scream-vol{height:100%;width:0;background:linear-gradient(90deg,#16a34a,#f59e0b,#c62828);transition:width 80ms linear}' +
    '.scream-read{font:12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#6b7a89;min-width:150px}' +
    '.scream-status{margin-top:8px;color:#44515e}' +
    '.scream-tiny{margin-top:6px;padding:0;font-family:inherit;font-size:11px;color:#9aa6b2;text-decoration:underline;background:none;border:0;cursor:pointer}' +
    '.scream-text{display:block;width:100%;margin-top:8px;padding:8px 10px;font:inherit;border:1px solid #b9c4cf;border-radius:6px}' +
    '.scream.locked{border-style:solid;border-color:#16a34a;background:#f0fbf4}' +
    '.noise-heard{margin:4px 0 12px;font:13px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#6b7a89}';

  function detectPitch(buf, sampleRate) {
    var best = 0, bestCorr = 0;
    var minLag = Math.floor(sampleRate / 1200), maxLag = Math.floor(sampleRate / 70);
    for (var lag = minLag; lag < maxLag; lag++) {
      var corr = 0;
      for (var i = 0; i + lag < buf.length; i += 2) corr += buf[i] * buf[i + lag];
      if (corr > bestCorr) { bestCorr = corr; best = lag; }
    }
    return best ? sampleRate / best : 0;
  }

  window.Gags.register({
    id: 'scream',
    title: 'Scream your pain level / quack to confirm',
    init: function (form, ctx) {
      var slider = form.elements.pain;
      var painOut = document.getElementById('painOut');
      var audio = null, analyser = null, stream = null, buf = null;
      var micState = 'idle';       // idle | on | denied
      var level = 0, smooth = 0, pitch = 0;
      var anchor = 0, since = Date.now();
      var locked = false, lockedVia = '';
      var loop = null;

      var style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      // The slider is decorative now.
      slider.style.pointerEvents = 'none';
      slider.tabIndex = -1;
      slider.addEventListener('keydown', function (e) { e.preventDefault(); });

      var panel = document.createElement('div');
      panel.className = 'scream';
      panel.innerHTML =
        '<div class="scream-row">' +
        '<button type="button" class="scream-mic">Enable microphone to report pain</button>' +
        '<div class="scream-meter"><div class="scream-vol"></div></div>' +
        '<span class="scream-read">vol 0 · pitch — Hz</span>' +
        '</div>' +
        '<div class="scream-status">Pain is measured by screaming. Louder means more pain. Hold your level steady for 3 seconds to lock it in.</div>' +
        '<button type="button" class="scream-tiny scream-type">can\'t scream right now? type it instead</button>' +
        '<input type="text" class="scream-text" placeholder="AAAAAAH  (one A per pain point, capitals only)" autocomplete="off" hidden>' +
        '<button type="button" class="scream-tiny scream-redo" hidden>re-scream</button>';
      slider.closest('.pain').insertAdjacentElement('afterend', panel);

      var micBtn = panel.querySelector('.scream-mic');
      var vol = panel.querySelector('.scream-vol');
      var read = panel.querySelector('.scream-read');
      var status = panel.querySelector('.scream-status');
      var typeBtn = panel.querySelector('.scream-type');
      var text = panel.querySelector('.scream-text');
      var redo = panel.querySelector('.scream-redo');

      function showPain(n) {
        slider.value = n;
        painOut.textContent = n;
      }

      async function ensureMic() {
        if (micState === 'on') return true;
        if (micState === 'denied') return false;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audio = new (window.AudioContext || window.webkitAudioContext)();
          analyser = audio.createAnalyser();
          analyser.fftSize = 2048;
          audio.createMediaStreamSource(stream).connect(analyser);
          buf = new Float32Array(analyser.fftSize);
          micState = 'on';
          micBtn.textContent = 'Microphone on. Scream.';
          micBtn.disabled = true;
          return true;
        } catch (err) {
          micState = 'denied';
          micBtn.textContent = 'Microphone unavailable';
          micBtn.disabled = true;
          status.textContent = 'We can\'t hear your pain, ' + ctx.patientName() + '. Please type your scream instead.';
          text.hidden = false;
          return false;
        }
      }

      function sample() {
        if (micState !== 'on') return { rms: 0, pitch: 0 };
        analyser.getFloatTimeDomainData(buf);
        var sum = 0;
        for (var i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        var rms = Math.sqrt(sum / buf.length);
        return { rms: rms, pitch: rms > 0.02 ? detectPitch(buf, audio.sampleRate) : 0 };
      }

      function lock(n, via) {
        locked = true;
        lockedVia = via;
        showPain(n);
        panel.classList.add('locked');
        redo.hidden = false;
        status.textContent = 'Pain level locked at ' + n + '. Thank you for your honesty, ' + ctx.patientName() + '.';
        if (pitch >= SOPRANO_HZ) {
          ctx.timer.reward(SOPRANO_REWARD);
          ctx.say('Soprano bonus, ' + ctx.patientName() + '. +' + SOPRANO_REWARD + 's.');
        }
      }

      function unlock() {
        locked = false;
        level = 0; smooth = 0; anchor = 0; since = Date.now();
        text.value = '';
        showPain(0);
        panel.classList.remove('locked');
        redo.hidden = true;
        status.textContent = 'Pain is measured by screaming. Hold your level steady for 3 seconds to lock it in.';
      }

      function evaluate() {
        if (micState === 'on') {
          var s = sample();
          pitch = s.pitch;
          if (!locked && text.hidden) {
            smooth = smooth * 0.7 + s.rms * 0.3;
            level = Math.max(0, Math.min(10, Math.round((smooth - 0.01) / 0.22 * 10)));
          }
          vol.style.width = Math.min(100, Math.round(s.rms / 0.25 * 100)) + '%';
          read.textContent = 'vol ' + Math.round(s.rms * 100) + ' · pitch ' + (pitch ? Math.round(pitch) : '—') + ' Hz';
        }
        if (locked) return;
        showPain(level);
        if (Math.abs(level - anchor) > 1) { anchor = level; since = Date.now(); }
        if (level === 0) { since = Date.now(); return; }
        var held = Date.now() - since;
        status.textContent = 'Holding at ' + anchor + '… ' + Math.max(0, (HOLD_MS - held) / 1000).toFixed(1) + 's. Do not waver.';
        if (held >= HOLD_MS) lock(anchor, text.hidden ? 'microphone' : 'typing');
      }

      micBtn.addEventListener('click', ensureMic);
      typeBtn.addEventListener('click', function () {
        text.hidden = !text.hidden;
        if (!text.hidden) text.focus();
      });
      text.addEventListener('input', function () {
        if (locked) return;
        var v = text.value;
        if (/[a-z]/.test(v)) {
          level = 0;
          status.textContent = 'We can\'t hear lowercase screams, ' + ctx.patientName() + '.';
        } else if (/^A+H*$/.test(v)) {
          level = Math.min(10, v.replace(/H/g, '').length);
        } else {
          level = 0;
          if (v) status.textContent = 'That is not a scream. Screams look like AAAAAAH.';
        }
      });
      redo.addEventListener('click', unlock);
      form.addEventListener('reset', function () { setTimeout(unlock, 0); });

      loop = setInterval(evaluate, 100);

      // ---- Submit check 1: the pain level has to be locked in. ----
      ctx.addSubmitCheck(function () {
        if (locked) return true;
        panel.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return 'We couldn\'t hear your pain level, ' + ctx.patientName() + '. Silence is not a number. Please scream (quietly, if you feel fine).';
      });

      // ---- Submit check 2: duck says yes, dog says no. ----
      function listenForAnimal(dialog, heard) {
        var burst = [], quiet = 0;
        var t = setInterval(function () {
          if (!document.body.contains(heard)) { clearInterval(t); return; }
          var s = sample();
          if (s.rms > 0.06 && s.pitch) {
            burst.push(s.pitch);
            quiet = 0;
          } else if (burst.length) {
            quiet++;
            if (quiet >= 3) {
              if (burst.length >= 2) {
                burst.sort(function (a, b) { return a - b; });
                var median = burst[Math.floor(burst.length / 2)];
                var animal = median >= QUACK_ABOVE_HZ ? 'duck' : 'dog';
                heard.textContent = 'Heard: ' + (animal === 'duck' ? 'QUACK' : 'WOOF') + ' (' + Math.round(median) + ' Hz)';
                clearInterval(t);
                setTimeout(function () { dialog.close(animal); }, 900);
              }
              burst = [];
            }
          }
        }, 60);
      }

      ctx.addSubmitCheck(async function () {
        for (;;) {
          var body = document.createElement('div');
          body.innerHTML =
            '<p>Are all of your details correct?</p>' +
            '<p><strong>Duck says YES. Dog says NO.</strong><br>Please make the appropriate noise.</p>' +
            '<div class="noise-heard">' + (micState === 'on' ? 'Listening…' : 'Microphone is off. Type your noise below.') + '</div>';
          var dialog = ctx.modal({
            title: 'Verbal confirmation required',
            node: body,
            input: { placeholder: 'or type it: quack / woof', enterValue: 'typed' },
            actions: [
              { label: 'I am a human', value: 'human', kind: 'big' },
              { label: 'that was my noise', value: 'typed', kind: 'tiny' }
            ]
          });
          if (micState === 'on') listenForAnimal(dialog, body.querySelector('.noise-heard'));
          var answer = await dialog;

          var noise = answer.value === 'typed' ? answer.text.trim().toLowerCase() : answer.value;
          if (noise === 'duck' || /^qu+a+ck/.test(noise)) return true;
          if (noise === 'dog' || /^(wo+f|bark|arf|ruff)/.test(noise)) {
            return 'The dog said NO, ' + ctx.patientName() + '. Please correct your details and try again.';
          }
          ctx.say('Humans do not get a vote here, ' + ctx.patientName() + '. Duck or dog.');
        }
      });

      ctx.addStat(function () {
        return locked ? 'Pain level ' + slider.value + ', reported by ' + lockedVia + '.' : '';
      });

      function shutDown() {
        clearInterval(loop);
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      }
      document.addEventListener('intake:submitted', shutDown);
      window.addEventListener('pagehide', shutDown);
    }
  });
})();
