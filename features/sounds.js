// features/sounds.js — every keystroke and click makes a noise, and it gets more
// frantic as the timer runs down. The mute button works, as a 20-second free trial.
// (With the scream gag on, these noises leak into the microphone. That is a feature.)
(function () {
  var MUTE_TRIAL_MS = 20000;

  var CSS =
    '.snd-mute{position:fixed;right:16px;top:64px;z-index:8;padding:6px 10px;font-family:inherit;font-size:12px;color:#10202b;background:#fff;border:1px solid #b9c4cf;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.15);cursor:pointer}';

  window.Gags.register({
    id: 'sounds',
    title: 'Obnoxious soundboard',
    init: function (form, ctx) {
      var audio = null;
      var muted = false;
      var muteTimer = null;
      var live = true;

      var style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      function blip(freq, ms, type) {
        if (muted || !live) return;
        try {
          if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
          if (audio.state === 'suspended') audio.resume();
          var osc = audio.createOscillator();
          var gain = audio.createGain();
          osc.type = type || 'square';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.05, audio.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + ms / 1000);
          osc.connect(gain).connect(audio.destination);
          osc.start();
          osc.stop(audio.currentTime + ms / 1000);
        } catch (err) { /* no audio, no problem */ }
      }

      // Higher and faster as time runs out.
      function urgency() {
        var r = ctx.timer.remaining;
        return r === Infinity ? 1 : 1 + Math.max(0, (120 - r) / 60);
      }

      document.addEventListener('keydown', function (e) {
        if (e.key.length === 1) blip((300 + (e.key.charCodeAt(0) % 24) * 35) * urgency(), 70);
        else blip(160, 120, 'sawtooth');
      });
      document.addEventListener('click', function () { blip(520 * urgency(), 90, 'triangle'); });
      ctx.timer.onTick(function (remaining, change) {
        if (change > 1) blip(110, 260, 'sawtooth');          // big drop: sad trombone-ish
        else if (remaining <= 45) blip(880, 60);             // panic: metronome of doom
      });

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'snd-mute';
      btn.textContent = 'Mute sounds';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (muted) return;
        muted = true;
        btn.textContent = 'Muted (free trial)';
        clearTimeout(muteTimer);
        muteTimer = setTimeout(function () {
          muted = false;
          btn.textContent = 'Mute sounds';
          ctx.say('Your free trial of silence has ended, ' + ctx.patientName() + '.');
          blip(660, 300, 'square');
        }, MUTE_TRIAL_MS);
      });
      document.body.appendChild(btn);

      document.addEventListener('intake:submitted', function () {
        live = false;
        btn.remove();
      });
    }
  });
})();
