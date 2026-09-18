// features/dodge.js — the tiny submit link runs away from the cursor.
// It gets tired after 5 dodges and holds still, so the form can still be finished.
(function () {
  var MAX_DODGES = 5;

  window.Gags.register({
    id: 'dodge',
    title: 'Submit link dodges the cursor',
    init: function (form, ctx) {
      var link = form.querySelector('.btn-submit');
      if (!link) return;
      var dodges = 0;
      link.style.transition = 'transform 160ms ease-out';
      link.style.position = 'relative';

      link.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch' || dodges >= MAX_DODGES) return;
        dodges++;
        if (dodges === MAX_DODGES) {
          link.style.transform = 'none';
          link.textContent = 'fine. submit';
          ctx.say('The submit link is tired of running, ' + ctx.patientName() + '.');
          return;
        }
        var x = (Math.random() < 0.5 ? -1 : 1) * (70 + Math.random() * 110);
        var y = -(10 + Math.random() * 50);
        link.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
      });

      form.addEventListener('reset', function () {
        dodges = 0;
        link.style.transform = 'none';
        link.textContent = 'submit';
      });
      ctx.addStat(function () { return dodges ? 'The submit link dodged you ' + Math.min(dodges, MAX_DODGES - 1) + ' times.' : ''; });
    }
  });
})();
