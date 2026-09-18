// gags.js — tiny registry shared by every feature file.
//
//   window.Gags.register({ id, title, init(form, ctx) })
//
// ctx.patientName()         first name currently in the form, else "patient"
// ctx.say(text)             toast aimed at the patient
// ctx.modal(opts)           in-page dialog -> Promise (timer keeps running, unlike confirm())
//                           opts: { title, html | node, input: {placeholder, noPaste, enterValue},
//                                   actions: [{ label, value, kind: 'big' | 'tiny' }] }
//                           the promise also has .close(value) and .body
// ctx.modalOpen()           true while any dialog is showing
// ctx.addSubmitCheck(fn)    fn() -> true to pass; false or a message string to block (may be async)
// ctx.addStat(fn)           fn() -> one line for the final scorecard (or '' to skip)
// ctx.timer.remaining       seconds left (Infinity when the timer gag is off)
// ctx.timer.onTick(fn)      fn(remaining, change) after every change
// ctx.timer.penalize(sec)   take time away
// ctx.timer.reward(sec)     give time back — this is what keeps the form winnable
// document 'intake:submitted' fires once the stub submit succeeds.
//
// Disable gags with ?off=id1,id2
(function () {
  var params = new URLSearchParams(location.search);
  var off = (params.get('off') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var form = document.getElementById('intake');
  var queue = [];
  var booted = false;
  var tickListeners = [];
  var submitChecks = [];
  var stats = [];
  var startedAt = Date.now();

  var timer = {
    remaining: Infinity,
    onTick: function (fn) { tickListeners.push(fn); },
    penalize: function () {},          // implemented by features/timer.js
    reward: function () {},            // implemented by features/timer.js
    _emit: function (change) {
      tickListeners.forEach(function (fn) {
        try { fn(timer.remaining, change); } catch (err) { console.error(err); }
      });
    }
  };

  var style = document.createElement('style');
  style.textContent =
    '.gag-toasts{position:fixed;right:16px;bottom:16px;z-index:50;display:flex;flex-direction:column;gap:8px;max-width:320px;pointer-events:none}' +
    '.gag-toast{padding:10px 14px;font-size:14px;color:#fff;background:#10202b;border-left:4px solid #f59e0b;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.25);animation:gagToast 5s forwards}' +
    '@keyframes gagToast{0%{opacity:0;transform:translateY(8px)}6%,88%{opacity:1;transform:none}100%{opacity:0}}' +
    '.gag-overlay{position:fixed;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;padding:70px 16px 16px;background:rgba(16,32,43,.72)}' +
    '.gag-modal{width:100%;max-width:440px;max-height:100%;overflow:auto;padding:24px;background:#fff;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.4);text-align:center}' +
    '.gag-modal h2{margin:0 0 10px;font-size:20px}' +
    '.gag-modal p{margin:0 0 12px;color:#44515e}' +
    '.gag-modal-input{display:block;width:100%;margin:4px 0 14px;padding:10px 12px;font:inherit;border:1px solid #b9c4cf;border-radius:6px}' +
    '.gag-modal-actions{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:6px}' +
    '.gag-btn-big{width:100%;padding:14px 18px;font-family:inherit;font-size:17px;font-weight:700;color:#fff;background:#16a34a;border:0;border-radius:8px;cursor:pointer}' +
    '.gag-btn-big:hover{background:#12813b}' +
    '.gag-btn-tiny{padding:0;font-family:inherit;font-size:11px;color:#9aa6b2;text-decoration:underline;background:none;border:0;cursor:pointer}';
  document.head.appendChild(style);

  var toasts = document.createElement('div');
  toasts.className = 'gag-toasts';
  toasts.setAttribute('aria-live', 'polite');
  document.body.appendChild(toasts);

  function modal(opts) {
    var overlay = document.createElement('div');
    overlay.className = 'gag-overlay';
    var box = document.createElement('div');
    box.className = 'gag-modal';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    overlay.appendChild(box);

    if (opts.title) {
      var h = document.createElement('h2');
      h.textContent = opts.title;
      box.appendChild(h);
    }
    var body = document.createElement('div');
    if (opts.html) body.innerHTML = opts.html;
    if (opts.node) body.appendChild(opts.node);
    box.appendChild(body);

    var input = null;
    if (opts.input) {
      input = document.createElement('input');
      input.className = 'gag-modal-input';
      input.type = 'text';
      input.autocomplete = 'off';
      input.placeholder = opts.input.placeholder || '';
      if (opts.input.noPaste) input.addEventListener('paste', function (e) { e.preventDefault(); });
      box.appendChild(input);
    }

    var settle;
    var promise = new Promise(function (resolve) { settle = resolve; });
    function close(value) {
      overlay.remove();
      settle(input ? { value: value, text: input.value } : value);
    }

    var actions = opts.actions || [];
    if (actions.length) {
      var row = document.createElement('div');
      row.className = 'gag-modal-actions';
      actions.forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = a.kind === 'tiny' ? 'gag-btn-tiny' : 'gag-btn-big';
        b.textContent = a.label;
        b.addEventListener('click', function () { close(a.value); });
        row.appendChild(b);
      });
      box.appendChild(row);
      if (input) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); close(opts.input.enterValue !== undefined ? opts.input.enterValue : actions[0].value); }
        });
      }
    }

    document.body.appendChild(overlay);
    if (input) input.focus();
    promise.close = close;
    promise.body = body;
    return promise;
  }

  var ctx = {
    params: params,
    timer: timer,
    modal: modal,
    modalOpen: function () { return !!document.querySelector('.gag-overlay'); },
    patientName: function () {
      var field = form && form.elements.firstName;
      return (field && field.value.trim()) || 'patient';
    },
    say: function (text) {
      var el = document.createElement('div');
      el.className = 'gag-toast';
      el.textContent = text;
      toasts.appendChild(el);
      while (toasts.children.length > 4) toasts.firstChild.remove();
      setTimeout(function () { el.remove(); }, 5000);
    },
    addSubmitCheck: function (fn) { submitChecks.push(fn); },
    addStat: function (fn) { stats.push(fn); }
  };

  function start(gag) {
    if (off.indexOf(gag.id) !== -1) {
      console.log('[gags] off: ' + gag.id);
      return;
    }
    try {
      gag.init(form, ctx);
      console.log('[gags] on: ' + gag.id);
    } catch (err) {
      console.error('[gags] ' + gag.id + ' failed to init', err);
    }
  }

  function boot() {
    booted = true;
    queue.forEach(start);
  }

  window.Gags = {
    ctx: ctx,
    register: function (gag) {
      if (booted) start(gag);
      else queue.push(gag);
    },
    // Runs every gag's submit check in order; stops at the first one that objects.
    runSubmitChecks: async function () {
      for (var i = 0; i < submitChecks.length; i++) {
        var verdict;
        try { verdict = await submitChecks[i](); } catch (err) { console.error(err); verdict = true; }
        if (verdict === true || verdict === undefined) continue;
        if (typeof verdict === 'string') ctx.say(verdict);
        return false;
      }
      return true;
    },
    stats: function () {
      var secs = Math.round((Date.now() - startedAt) / 1000);
      var lines = ['Completed in ' + Math.floor(secs / 60) + 'm ' + (secs % 60) + 's of your actual life.'];
      stats.forEach(function (fn) {
        try { var line = fn(); if (line) lines.push(line); } catch (err) { console.error(err); }
      });
      return lines;
    }
  };

  // Wait for every feature script to register before starting any of them.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
