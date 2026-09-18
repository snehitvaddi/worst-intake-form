// features/captcha.js — "Select all squares containing your symptoms."
// The first answer is always wrong. The second answer is always right.
(function () {
  var TILES = ['🤒', '🚲', '🦴', '🌮', '🤧', '🪑', '😵', '🚦', '🫀'];

  var CSS =
    '.cap-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:0 auto 14px;max-width:240px}' +
    '.cap-grid button{aspect-ratio:1;font-size:34px;background:#eef2f5;border:3px solid transparent;border-radius:6px;cursor:pointer}' +
    '.cap-grid button.on{border-color:#0f6e84;background:#d8eef3}';

  window.Gags.register({
    id: 'captcha',
    title: 'Symptom CAPTCHA',
    init: function (form, ctx) {
      var passed = false;
      var attempts = 0;

      var style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      function ask() {
        var body = document.createElement('div');
        body.innerHTML = '<p>Select all squares containing <strong>your symptoms</strong>.</p><div class="cap-grid"></div>';
        var grid = body.querySelector('.cap-grid');
        TILES.forEach(function (t) {
          var b = document.createElement('button');
          b.type = 'button';
          b.textContent = t;
          b.addEventListener('click', function () { b.classList.toggle('on'); });
          grid.appendChild(b);
        });
        return ctx.modal({
          title: 'One more security check',
          node: body,
          actions: [
            { label: 'Verify', value: 'verify', kind: 'big' },
            { label: 'skip', value: 'skip', kind: 'tiny' }
          ]
        }).then(function (value) {
          return { value: value, picked: grid.querySelectorAll('.on').length };
        });
      }

      ctx.addSubmitCheck(async function () {
        if (passed) return true;
        for (;;) {
          var answer = await ask();
          var who = ctx.patientName();
          if (answer.value === 'skip') { ctx.say('Skipping is not available in your region, ' + who + '.'); continue; }
          if (!answer.picked) { ctx.say('You must have at least one symptom, ' + who + '. This is a clinic.'); continue; }
          attempts++;
          if (attempts < 2) { ctx.say('Incorrect. Those are someone else\'s symptoms, ' + who + '. Try again.'); continue; }
          passed = true;
          return true;
        }
      });

      form.addEventListener('reset', function () { passed = false; attempts = 0; });
    }
  });
})();
