// features/ads.js — 1990s banner ads, targeted at whatever symptoms you admit to.
//
// - Small banner bars appear between sections. Clicking the X starts a "closing in 5…"
//   countdown; a fresh ad grows back in the same spot half a minute later.
// - Every 10-18 clicks a full pop-up ad appears. "Skip ad" unlocks after 5 seconds.
//   Skipping brings misfortune (your condition "increases by N%"); watching to the end
//   brings good luck and +20s.
// - The "WATCH AD +45s" tab on the right edge is an honest way to earn time.
(function () {
  var CLOSE_WAIT = 5;
  var SKIP_WAIT = 5;
  var FULL_WATCH = 10;
  var GOOD_LUCK_REWARD = 20;
  var REWARDED_AD_SECONDS = 8;
  var REWARDED_AD_REWARD = 45;

  var GENERIC = [
    'CONGRATULATIONS!!! You are the 1,000,000th patient! Click to claim your FREE stethoscope!',
    'Doctors HATE this one weird intake form. (It is this one.)',
    'Download more RAM for your pacemaker. 100% FREE*',
    'Punch the germ and WIN a copay!',
    'Local forms in your area want to be filled out TONIGHT.',
    'Hot deals on lukewarm compresses. While supplies last!',
    'Is your doctor cheating on you? Find out with one weird click.',
    'You have (1) new prescription. It is for someone else.'
  ];
  var TARGETED = {
    fever: ['Is your FEVER hot enough? Rate it now!', 'FeverCoin: invest in your temperature.'],
    cough: ['Cough? Try CoughDrop.exe, now with 40% more exe.', 'Your cough could be a ringtone. Click here.'],
    headache: ['HEADACHE? Apply this banner directly to the forehead.', 'Headaches in your area want to meet you.'],
    dizzy: ['Dizzy? This ad is spinning too. You are not alone.', 'Win a FREE spin! (You are already spinning.)'],
    fatigue: ['Tired? So is this ad. Click to let it rest.', 'Energy crystals. Almost legal.'],
    rash: ['Rash decisions? BUY NOW!', 'One weird cream. Dermatologists are furious.']
  };
  var LABELS = { fever: 'fever', cough: 'cough', headache: 'headache', dizzy: 'dizziness', fatigue: 'fatigue', rash: 'rash' };
  var PALETTES = [['#ffff00', '#0000cc'], ['#00ffff', '#cc0066'], ['#ff66cc', '#000080'], ['#00ff66', '#660099'], ['#ff9900', '#000000']];

  var CSS =
    '.ad-slot{margin:0 0 18px}' +
    '.ad-bar{display:flex;align-items:center;gap:10px;padding:8px 10px;font:700 14px "Comic Sans MS","Comic Sans",cursive;border:3px ridge #c0c0c0;overflow:hidden}' +
    '.ad-bar .ad-tag{flex:none;padding:1px 5px;font:700 9px Arial,sans-serif;color:#fff;background:#c00;letter-spacing:.06em}' +
    '.ad-bar .ad-text{flex:1;white-space:nowrap;overflow:hidden}' +
    '.ad-bar .ad-text span{display:inline-block;padding-left:100%;animation:adMarquee 14s linear infinite}' +
    '.ad-bar .ad-blink{animation:adBlink 900ms steps(2,start) infinite}' +
    '.ad-bar button{flex:none;min-width:26px;padding:2px 6px;font:700 12px Arial,sans-serif;color:#000;background:#c0c0c0;border:2px outset #fff;cursor:pointer}' +
    '@keyframes adMarquee{to{transform:translateX(-100%)}}' +
    '@keyframes adBlink{to{visibility:hidden}}' +
    '.ad-pop{padding:18px 12px;font:700 20px "Comic Sans MS","Comic Sans",cursive;border:4px ridge #c0c0c0;margin-bottom:12px}' +
    '.ad-pop small{display:block;margin-top:8px;font:400 12px Arial,sans-serif}' +
    '.ad-chain{margin:0 0 12px;font-size:13px;color:#44515e}' +
    '.ad-skip{padding:6px 12px;font:700 12px Arial,sans-serif;color:#fff;background:#333;border:0;border-radius:2px;cursor:pointer}' +
    '.ad-skip:disabled{opacity:.55;cursor:default}' +
    '.ad-watch{position:fixed;right:0;top:42%;z-index:8;padding:10px 8px;writing-mode:vertical-rl;font:700 12px Arial,sans-serif;letter-spacing:.06em;color:#000;background:#ffff00;border:3px ridge #c0c0c0;border-right:0;cursor:pointer}' +
    '@media (prefers-reduced-motion:reduce){.ad-bar .ad-text span,.ad-bar .ad-blink{animation:none;padding-left:0}}';

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  window.Gags.register({
    id: 'ads',
    title: '1990s banner ads with consequences',
    init: function (form, ctx) {
      var skipped = 0, watched = 0;
      var clicks = 0, nextPopAt = 10 + Math.floor(Math.random() * 9);
      var popQueued = false;
      var live = true;

      var style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      function conditions() {
        return Array.prototype.filter.call(form.querySelectorAll('input[name=symptoms]'), function (i) { return i.checked; })
          .map(function (i) { return i.value; });
      }
      function conditionName() {
        var c = conditions();
        return c.length ? LABELS[pick(c)] : 'general malaise';
      }
      function adCopy() {
        var c = conditions();
        if (c.length && Math.random() < 0.75) return pick(TARGETED[pick(c)]);
        return pick(GENERIC);
      }
      function percent() { return 12 + Math.floor(Math.random() * 77); }

      // ---- Banner bars between sections ----
      function fillSlot(slot) {
        if (!live) return;
        var colors = pick(PALETTES);
        var bar = document.createElement('div');
        bar.className = 'ad-bar';
        bar.style.background = colors[0];
        bar.style.color = colors[1];
        bar.innerHTML = '<span class="ad-tag ad-blink">AD</span><div class="ad-text"><span></span></div><button type="button" aria-label="Close ad">X</button>';
        bar.querySelector('.ad-text span').textContent = adCopy();
        var close = bar.querySelector('button');
        close.addEventListener('click', function () {
          if (close.disabled) return;
          close.disabled = true;
          var left = CLOSE_WAIT;
          close.textContent = 'closing in ' + left;
          var t = setInterval(function () {
            left--;
            close.textContent = 'closing in ' + left;
            if (left > 0) return;
            clearInterval(t);
            bar.remove();
            setTimeout(function () { fillSlot(slot); }, 20000 + Math.random() * 15000);
          }, 1000);
        });
        slot.appendChild(bar);
      }

      form.querySelectorAll('fieldset').forEach(function (fs, i) {
        var slot = document.createElement('div');
        slot.className = 'ad-slot';
        fs.insertAdjacentElement('afterend', slot);
        setTimeout(function () { fillSlot(slot); }, 3000 + i * 6000);   // they arrive late and shove the page down
      });

      // ---- Pop-up ads ----
      // rewarded: no skipping, pays out time at the end.
      async function popUp(rewarded) {
        var colors = pick(PALETTES);
        var body = document.createElement('div');
        var ad = document.createElement('div');
        ad.className = 'ad-pop';
        ad.style.background = colors[0];
        ad.style.color = colors[1];
        ad.textContent = adCopy();
        var fine = document.createElement('small');
        fine.textContent = 'Sponsored. Selected for you based on the symptoms you just entered.';
        ad.appendChild(fine);
        var chain = document.createElement('p');
        chain.className = 'ad-chain';
        chain.textContent = rewarded
          ? 'Watch all ' + REWARDED_AD_SECONDS + ' seconds to earn +' + REWARDED_AD_REWARD + 's.'
          : 'Patients who watch this ad to the end receive GOOD LUCK. Patients who skip it receive misfortune.';
        var skip = document.createElement('button');
        skip.type = 'button';
        skip.className = 'ad-skip';
        skip.disabled = true;
        body.appendChild(ad);
        body.appendChild(chain);
        body.appendChild(skip);

        var dialog = ctx.modal({ title: '', node: body });
        var elapsed = 0;
        var total = rewarded ? REWARDED_AD_SECONDS : FULL_WATCH;
        function label() {
          if (rewarded) skip.textContent = 'Reward in ' + (total - elapsed);
          else if (elapsed < SKIP_WAIT) skip.textContent = 'Skip ad in ' + (SKIP_WAIT - elapsed);
          else skip.textContent = 'Skip ad  (good luck in ' + (total - elapsed) + ')';
        }
        label();
        var t = setInterval(function () {
          elapsed++;
          if (!rewarded && elapsed >= SKIP_WAIT) skip.disabled = false;
          if (elapsed >= total) { clearInterval(t); dialog.close('watched'); return; }
          label();
        }, 1000);
        skip.addEventListener('click', function () { clearInterval(t); dialog.close('skipped'); });

        var outcome = await dialog;
        var who = ctx.patientName();
        if (rewarded) {
          ctx.timer.reward(REWARDED_AD_REWARD);
          ctx.say('Thank you for your attention, ' + who + '. +' + REWARDED_AD_REWARD + 's.');
        } else if (outcome === 'watched') {
          watched++;
          ctx.timer.reward(GOOD_LUCK_REWARD);
          ctx.say('You watched the whole ad, ' + who + '. Good luck is yours: your ' + conditionName() +
                  ' will decrease by ' + percent() + '%. +' + GOOD_LUCK_REWARD + 's.');
        } else {
          skipped++;
          ctx.say('You skipped the ad, ' + who + '. Misfortune follows: your ' + conditionName() +
                  ' will increase by ' + percent() + '%.');
        }
      }

      document.addEventListener('click', function (e) {
        if (!live || e.target.closest('.gag-overlay')) return;
        clicks++;
        if (clicks >= nextPopAt) popQueued = true;
        if (popQueued && !ctx.modalOpen()) {
          popQueued = false;
          clicks = 0;
          nextPopAt = 10 + Math.floor(Math.random() * 9);
          popUp(false);
        }
      });

      var watch = document.createElement('button');
      watch.type = 'button';
      watch.className = 'ad-watch';
      watch.textContent = 'WATCH AD +' + REWARDED_AD_REWARD + 's';
      watch.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!ctx.modalOpen()) popUp(true);
      });
      document.body.appendChild(watch);

      ctx.addStat(function () {
        return 'Ads skipped: ' + skipped + ' (misfortune pending). Ads watched to the end: ' + watched + '.';
      });

      document.addEventListener('intake:submitted', function () {
        live = false;
        watch.remove();
      });
    }
  });
})();
