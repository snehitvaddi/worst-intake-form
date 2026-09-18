// features/nag.js — Clear never asks "are you sure?". Submit asks three times, and the
// big green button is always the one that does NOT submit. Pressing Enter in a field
// politely offers to clear the form instead.
//
// Register this one last so its questions come after every other submit check.
(function () {
  window.Gags.register({
    id: 'nag',
    title: 'Are you sure you are sure?',
    init: function (form, ctx) {
      var asked = 0;

      function clearForm() {
        form.reset();
        window.scrollTo({ top: 0 });
      }

      ctx.addSubmitCheck(async function () {
        var who = ctx.patientName();
        asked++;
        var a = await ctx.modal({
          title: 'Are you sure you want to submit?',
          html: '<p>Submitting is permanent. Clearing is always available.</p>',
          actions: [
            { label: 'Cancel submission', value: 'no', kind: 'big' },
            { label: 'yes, submit', value: 'yes', kind: 'tiny' }
          ]
        });
        if (a !== 'yes') return 'Submission cancelled. Good call, ' + who + '.';

        var b = await ctx.modal({
          title: 'Are you sure you are sure?',
          html: '<p>Most patients like to double-check section 1 at this point.</p>',
          actions: [
            { label: 'Go back and double-check', value: 'no', kind: 'big' },
            { label: 'i am sure i am sure', value: 'yes', kind: 'tiny' }
          ]
        });
        if (b !== 'yes') return 'Take your time, ' + who + '. (You do not have much.)';

        var c = await ctx.modal({
          title: 'Last chance',
          html: '<p>Would you rather clear the form instead?</p>',
          actions: [
            { label: 'Clear Form', value: 'clear', kind: 'big' },
            { label: 'submit anyway', value: 'yes', kind: 'tiny' }
          ]
        });
        if (c === 'clear') {
          clearForm();
          return 'Form cleared, as requested.';
        }
        return true;
      });

      // Enter in a text field would normally submit. Here it suggests the primary action.
      form.addEventListener('keydown', async function (e) {
        if (e.key !== 'Enter' || !e.target.matches('input') || ctx.modalOpen()) return;
        e.preventDefault();
        var choice = await ctx.modal({
          title: 'Did you mean: Clear Form?',
          html: '<p>You pressed Enter. Our most popular action is Clear Form.</p>',
          actions: [
            { label: 'Yes, clear it', value: 'clear', kind: 'big' },
            { label: 'no', value: 'no', kind: 'tiny' }
          ]
        });
        if (choice === 'clear') clearForm();
      });

      ctx.addStat(function () { return asked > 1 ? 'Talked out of submitting ' + (asked - 1) + (asked === 2 ? ' time.' : ' times.') : ''; });
    }
  });
})();
