// features/slots.js — the mobile phone number is entered on a 10-reel slot machine.
//
// Every digit spins 0-9 at its own speed. Click a reel to stop it on the digit you want;
// click again to respin. The number only counts once all ten reels are stopped.
(function () {
  var CSS =
    '.slots{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}' +
    '.slots button{width:42px;height:54px;font:700 26px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#10202b;background:linear-gradient(#fff,#e6ecf1);border:2px solid #b9c4cf;border-radius:8px;cursor:pointer}' +
    '.slots button.spinning{color:#c62828;border-color:#f59e0b;background:linear-gradient(#fffbe9,#ffe9a8)}' +
    '.slots-sep{align-self:center;color:#9aa6b2}' +
    '.slots-host input[data-gag-widget]{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}' +
    '.slots-host{position:relative}' +
    '.slots-hint{display:block;margin-top:6px;font-size:13px;font-weight:400;color:#6b7a89}';

  window.Gags.register({
    id: 'slots',
    title: 'Slot-machine phone number',
    init: function (form, ctx) {
      var input = form.elements.phone;
      if (!input) return;
      var style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      var host = input.closest('label');
      host.classList.add('slots-host');
      input.dataset.gagWidget = 'slots';
      input.tabIndex = -1;

      var row = document.createElement('div');
      row.className = 'slots';
      var reels = [];
      var spins = 0;
      var writing = false;

      function commit() {
        var allStopped = reels.every(function (r) { return !r.spinning; });
        writing = true;
        input.value = allStopped ? reels.map(function (r) { return r.digit; }).join('') : '';
        input.setCustomValidity(allStopped ? '' : 'Please stop all 10 reels.');
        input.dispatchEvent(new Event('change', { bubbles: true }));
        writing = false;
        return allStopped;
      }

      function setSpinning(reel, on) {
        reel.spinning = on;
        reel.el.classList.toggle('spinning', on);
        clearInterval(reel.timer);
        if (on) {
          reel.timer = setInterval(function () {
            reel.digit = (reel.digit + 1) % 10;
            reel.el.textContent = reel.digit;
          }, reel.speed);
        }
      }

      for (var i = 0; i < 10; i++) {
        (function (i) {
          if (i === 3 || i === 6) {
            var sep = document.createElement('span');
            sep.className = 'slots-sep';
            sep.textContent = '-';
            row.appendChild(sep);
          }
          var el = document.createElement('button');
          el.type = 'button';
          var reel = { el: el, digit: Math.floor(Math.random() * 10), spinning: false, timer: null, speed: 300 + Math.floor(Math.random() * 260) };
          el.textContent = reel.digit;
          el.setAttribute('aria-label', 'Phone digit ' + (i + 1));
          // The label would otherwise forward this click to the hidden input.
          el.addEventListener('click', function (e) {
            e.preventDefault();
            setSpinning(reel, !reel.spinning);
            if (!reel.spinning) spins++;
            if (commit()) ctx.say('Is ' + input.value + ' right, ' + ctx.patientName() + '? Click any digit to respin it.');
          });
          reels.push(reel);
          row.appendChild(el);
        })(i);
      }
      host.appendChild(row);
      var hint = document.createElement('span');
      hint.className = 'slots-hint';
      hint.textContent = 'Click a reel to stop it on the right digit. Click again to respin.';
      host.appendChild(hint);

      function spinAll() {
        reels.forEach(function (r) { setSpinning(r, true); });
        commit();
      }

      // Outside writes (autofill): show that number, stopped.
      form.addEventListener('change', function (e) {
        if (writing || e.target !== input) return;
        var digits = input.value.replace(/\D/g, '');
        if (digits.length !== 10) return;
        reels.forEach(function (r, i) {
          setSpinning(r, false);
          r.digit = +digits[i];
          r.el.textContent = r.digit;
        });
        commit();
      });
      form.addEventListener('reset', function () { setTimeout(spinAll, 0); });
      document.addEventListener('intake:submitted', function () {
        reels.forEach(function (r) { clearInterval(r.timer); });
      });
      ctx.addStat(function () { return 'Phone number won on the slots after ' + spins + ' pulls.'; });

      spinAll();
    }
  });
})();
