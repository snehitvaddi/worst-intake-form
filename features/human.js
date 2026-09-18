// features/human.js — "Are you human?" Prove it on camera by posing as an elephant.
//
// Interrupts you once, mid-form (first time you touch section 3); if you dodge it, it
// comes back at submit. It asks for the camera, names a pose, counts down, takes one
// frame and POSTs it to /api/pose-check, where server.mjs asks Claude to judge it.
//
// Always winnable: if the judge is unreachable a fake judge fails you once and then
// passes you; after 3 failed poses you are waved through; with no camera you can type
// a sworn statement instead.
(function () {
  var MAX_ATTEMPTS = 3;
  var POSES = [
    { id: 'elephant', hint: 'one arm out in front as a trunk' },
    { id: 'giraffe', hint: 'stretch your neck, both arms straight up' },
    { id: 'flamingo', hint: 'one leg up, arms out for balance' },
    { id: 't-rex', hint: 'tiny arms tucked in, and roar' },
    { id: 'teapot', hint: 'one hand on your hip, the other arm is the spout' }
  ];
  var FAKE_FAILS = [
    'That reads more as "confused heron". Try again.',
    'Our judge saw a person standing normally, which is exactly what a robot would do.'
  ];

  var CSS =
    '.hum-video{display:block;width:100%;max-width:360px;margin:0 auto 10px;border-radius:8px;background:#10202b;transform:scaleX(-1)}' +
    '.hum-pose{margin:0 0 4px;font-size:22px;font-weight:800;letter-spacing:.04em;color:#0f6e84;text-transform:uppercase}' +
    '.hum-count{min-height:40px;font:700 34px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#c62828}' +
    '.hum-fine{margin:8px 0 0;font-size:11px;color:#9aa6b2}';

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  window.Gags.register({
    id: 'human',
    title: 'Camera pose CAPTCHA judged by an LLM',
    init: function (form, ctx) {
      var passed = false;
      var running = false;
      var verdictLine = '';
      var stream = null;

      var style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      function stopCamera() {
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        stream = null;
      }

      async function notice(title, text, ms) {
        var d = ctx.modal({ title: title, html: '<p></p>' });
        d.body.querySelector('p').textContent = text;
        await sleep(ms);
        d.close();
      }

      async function judge(pose, image, attempt) {
        try {
          var res = await fetch('/api/pose-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pose: pose.id, image: image })
          });
          if (!res.ok) throw new Error('judge status ' + res.status);
          return await res.json();
        } catch (err) {
          // No backend / no credentials: fail once for the drama, then pass.
          if (attempt === 1) return { pass: false, comment: FAKE_FAILS[Math.floor(Math.random() * FAKE_FAILS.length)], judge: 'fake' };
          return { pass: true, comment: 'Convincing enough. No robot would agree to do that.', judge: 'fake' };
        }
      }

      async function swornStatement(pose) {
        var phrase = 'I am a human pretending to be a ' + pose.id;
        for (;;) {
          var body = document.createElement('div');
          var p1 = document.createElement('p');
          p1.textContent = 'No camera, no problem. Type exactly:';
          var p2 = document.createElement('p');
          var strong = document.createElement('strong');
          strong.textContent = phrase;
          p2.appendChild(strong);
          body.appendChild(p1);
          body.appendChild(p2);
          var a = await ctx.modal({
            title: 'Sworn statement',
            node: body,
            input: { placeholder: 'your statement', noPaste: true, enterValue: 'swear' },
            actions: [{ label: 'I swear', value: 'swear', kind: 'big' }]
          });
          if (a.text.trim().toLowerCase() === phrase.toLowerCase()) return;
          ctx.say('That is not what a human pretending to be a ' + pose.id + ' would type, ' + ctx.patientName() + '.');
        }
      }

      async function poseRound(pose, attempt) {
        var body = document.createElement('div');
        body.innerHTML =
          '<video class="hum-video" autoplay playsinline muted></video>' +
          '<p>Strike the pose:</p><div class="hum-pose"></div><p class="hum-hint"></p>' +
          '<div class="hum-count"></div>' +
          '<p class="hum-fine">One photo is sent to an AI judge (Claude, by Anthropic) for this check. It is not saved.</p>';
        body.querySelector('.hum-pose').textContent = pose.id;
        body.querySelector('.hum-hint').textContent = '(' + pose.hint + ')';
        var video = body.querySelector('video');
        var count = body.querySelector('.hum-count');
        video.srcObject = stream;

        var dialog = ctx.modal({
          title: 'Attempt ' + attempt + ' of ' + MAX_ATTEMPTS,
          node: body,
          actions: [{ label: 'I am posing. Judge me.', value: 'go', kind: 'big' }]
        });
        await dialog;

        // The dialog is gone; keep the feed alive in a fresh one for the countdown.
        var shot = document.createElement('div');
        shot.innerHTML = '<video class="hum-video" autoplay playsinline muted></video><div class="hum-count"></div>';
        var v2 = shot.querySelector('video');
        v2.srcObject = stream;
        var holding = ctx.modal({ title: 'Hold it. ' + pose.id.toUpperCase() + '.', node: shot });
        for (var n = 3; n >= 1; n--) {
          shot.querySelector('.hum-count').textContent = n;
          await sleep(900);
        }
        var canvas = document.createElement('canvas');
        var w = 512, h = Math.round(512 * (v2.videoHeight || 3) / (v2.videoWidth || 4));
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(v2, 0, 0, w, h);
        var image = canvas.toDataURL('image/jpeg', 0.7);
        shot.querySelector('.hum-count').textContent = 'Judging…';
        var verdict = await judge(pose, image, attempt);
        holding.close();
        return verdict;
      }

      async function run() {
        if (passed || running) return passed;
        running = true;
        var who = ctx.patientName();
        try {
          var first = await ctx.modal({
            title: 'Quick security check',
            html: '<p>Are you human?</p>',
            actions: [
              { label: 'No', value: 'no', kind: 'big' },
              { label: 'yes', value: 'yes', kind: 'tiny' }
            ]
          });
          if (first === 'no') ctx.say('Thank you for your honesty, ' + who + '. Robots must also complete the check.');

          var pose = POSES[Math.floor(Math.random() * POSES.length)];
          var cam = await ctx.modal({
            title: 'Prove it',
            html: '<p>Please turn on your camera and show us you are a human.</p>' +
                  '<p class="hum-fine">One photo per attempt is sent to an AI judge (Claude, by Anthropic). Nothing is saved.</p>',
            actions: [
              { label: 'Enable camera', value: 'camera', kind: 'big' },
              { label: 'i do not have a camera', value: 'none', kind: 'tiny' }
            ]
          });

          if (cam === 'camera') {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            } catch (err) {
              ctx.say('We could not see you, ' + who + '. Camera access was not granted.');
            }
          }
          if (!stream) {
            await swornStatement(pose);
            passed = true;
            verdictLine = 'Humanity sworn in writing (as a ' + pose.id + ').';
            return true;
          }

          for (var attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            var verdict = await poseRound(pose, attempt);
            await notice(verdict.pass ? 'Human confirmed' : 'Not convincing', verdict.comment || '', 3200);
            if (verdict.pass) {
              passed = true;
              verdictLine = 'Proved humanity as a ' + pose.id + ' on attempt ' + attempt +
                            (verdict.judge === 'claude' ? ', judged by Claude.' : ', judged by a very tired intern.');
              ctx.timer.reward(20);
              return true;
            }
          }
          await notice('Fine.', 'The judge is tired. I will let you pass this time, ' + who + '.', 2400);
          passed = true;
          verdictLine = 'Failed to resemble a ' + pose.id + ' ' + MAX_ATTEMPTS + ' times. Waved through.';
          return true;
        } finally {
          stopCamera();
          running = false;
        }
      }

      // Mid-form interruption: the first time section 3 is touched.
      var section = form.querySelectorAll('fieldset')[2];
      function interrupt() {
        if (passed || running || ctx.modalOpen()) return;
        section.removeEventListener('pointerdown', interrupt, true);
        section.removeEventListener('focusin', interrupt, true);
        run();
      }
      if (section) {
        section.addEventListener('pointerdown', interrupt, true);
        section.addEventListener('focusin', interrupt, true);
      }

      ctx.addSubmitCheck(function () { return passed ? true : run(); });
      ctx.addStat(function () { return verdictLine; });
      form.addEventListener('reset', function () { passed = false; });
      window.addEventListener('pagehide', stopCamera);
    }
  });
})();
