// features/otp.js — phone verification with an OTP that expires in 5 seconds.
//
// The code "arrives" (as a toast) about a second before it expires. When it expires the
// form retries automatically and gives a reason. After two failures it says you are too
// slow, then lets you pass anyway. Type the code in time and it is merely suspicious.
(function () {
  var EXPIRES_IN = 5;
  var ARRIVES_AFTER_MS = 3800;
  var MAX_ROUNDS = 2;
  var REASONS = [
    'you blinked',
    'the code was shy',
    'the carrier pigeon unionized',
    'Mercury is in retrograde',
    'our clock runs on the same timer as this form'
  ];

  var CSS =
    '.otp-count{margin:0 0 10px;font:700 30px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#c62828}' +
    '.otp-note{min-height:20px;margin:0 0 8px;font-size:13px;color:#c62828}';

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  window.Gags.register({
    id: 'otp',
    title: 'OTP that expires in 5 seconds',
    init: function (form, ctx) {
      var passed = false;
      var outcome = '';

      var style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      async function notice(title, text, ms) {
        var d = ctx.modal({ title: title, html: '<p></p>' });
        d.body.querySelector('p').textContent = text;
        await sleep(ms);
        d.close();
      }

      async function round() {
        var code = String(100000 + Math.floor(Math.random() * 900000));
        var digits = (form.elements.phone.value || '').replace(/\D/g, '');
        var body = document.createElement('div');
        body.innerHTML = '<p></p><div class="otp-count"></div><div class="otp-note"></div>';
        body.querySelector('p').textContent = 'OTP code sent to the number ending ' + (digits.slice(-4) || '????') +
          ' for verification. OTP expires in ' + EXPIRES_IN + ' seconds.';
        var count = body.querySelector('.otp-count');
        var note = body.querySelector('.otp-note');

        var dialog = ctx.modal({
          title: 'Verify your phone',
          node: body,
          input: { placeholder: '6-digit code', enterValue: 'verify' },
          actions: [{ label: 'Verify', value: 'verify', kind: 'big' }]
        });

        var left = EXPIRES_IN;
        count.textContent = '0:0' + left;
        var tick = setInterval(function () {
          left--;
          count.textContent = '0:0' + Math.max(0, left);
          if (left <= 0) { clearInterval(tick); dialog.close('expired'); }
        }, 1000);
        var arrive = setTimeout(function () { ctx.say('Your Lakeside verification code is ' + code + '. Do not share it. Hurry.'); }, ARRIVES_AFTER_MS);

        var answer = await dialog;
        clearInterval(tick);
        clearTimeout(arrive);
        if (answer.value === 'verify' && answer.text.trim() === code) return 'correct';
        return answer.value === 'verify' ? 'wrong' : 'expired';
      }

      ctx.addSubmitCheck(async function () {
        if (passed) return true;
        var who = ctx.patientName();
        for (var r = 1; r <= MAX_ROUNDS; r++) {
          var result = await round();
          if (result === 'correct') {
            await notice('Verified', 'Correct. Suspiciously fast, ' + who + ', but correct.', 1600);
            passed = true;
            outcome = 'entered in time (suspicious)';
            return true;
          }
          var reason = result === 'wrong' ? 'that was not the code' : REASONS[Math.floor(Math.random() * REASONS.length)];
          if (r < MAX_ROUNDS) {
            await notice('OTP expired', 'Reason: ' + reason + '. Retrying automatically…', 2000);
          } else {
            await notice('OTP expired', 'Reason: ' + reason + '.', 1600);
          }
        }
        await notice('You are too slow.', 'Two codes, ' + who + '. Two.', 1900);
        await notice('Fine.', 'I will let you pass this time.', 1900);
        passed = true;
        outcome = 'too slow, waved through out of pity';
        return true;
      });

      form.addEventListener('reset', function () { passed = false; });
      ctx.addStat(function () { return outcome ? 'Phone verification: ' + outcome + '.' : ''; });
    }
  });
})();
