// features/pencil.js — every checkbox/radio is a Scantron bubble you shade by hand.
//
// - Pick up the pencil from the tray (bottom-left). No pencil, no marks.
// - A bubble only counts at >= 95% shaded. Stray marks (10-95%) block submit.
// - The pencil goes blunt after 3 bubbles; use the sharpener. Eraser un-marks.
// - You can't type while holding a tool. Shading outside the bubble costs 5s;
//   a clean bubble earns 10s back.
(function () {
  var SIZE = 44;               // canvas pixels (also CSS px)
  var R = 15;                  // bubble radius
  var FILL_TARGET = 0.95;
  var STRAY_ABOVE = 0.10;
  var SHARP_WIDTH = 10;
  var BLUNT_WIDTH = 2;
  var ERASER_WIDTH = 14;
  var BUBBLES_PER_SHARPEN = 3;
  var OUTSIDE_PENALTY = 5;
  var NEAT_REWARD = 10;

  var PENCIL_CURSOR = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cpath d='M3 29l3-9L22 4l6 6L12 26z' fill='%23f6c343' stroke='%23222' stroke-width='1.5'/%3E%3Cpath d='M3 29l3-9 6 6z' fill='%23f3d9b1' stroke='%23222' stroke-width='1.5'/%3E%3Cpath d='M3 29l1.5-4.5 3 3z' fill='%23222'/%3E%3C/svg%3E\") 3 29, crosshair";
  var ERASER_CURSOR = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect x='6' y='10' width='20' height='14' rx='3' fill='%23f7a8b8' stroke='%23222' stroke-width='1.5'/%3E%3C/svg%3E\") 16 17, cell";

  var CSS =
    '.bubble{position:relative;flex:none;width:' + SIZE + 'px;height:' + SIZE + 'px;display:inline-block}' +
    '.bubble::before{content:"";position:absolute;left:50%;top:50%;width:' + (R * 2) + 'px;height:' + (R * 2) + 'px;margin:-' + R + 'px 0 0 -' + R + 'px;border:1.5px solid #c0392b;border-radius:50%;box-sizing:border-box;pointer-events:none}' +
    '.bubble.is-shaded::before{border-color:#16a34a}' +
    '.bubble canvas{position:absolute;inset:0;touch-action:none}' +
    '.bubble input{position:absolute;left:50%;top:70%;width:1px;height:1px;opacity:0;pointer-events:none}' +
    '.pencil-tray{position:fixed;left:16px;bottom:16px;z-index:8;width:230px;padding:10px 12px;font-size:13px;color:#fff;background:#10202b;border-radius:10px;box-shadow:0 8px 22px rgba(0,0,0,.3)}' +
    '.pencil-tray h3{margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.7}' +
    '.pencil-tools{display:flex;gap:6px}' +
    '.pencil-tools button{flex:1;padding:7px 4px;font-family:inherit;font-size:12px;color:#fff;background:#1b3342;border:1px solid #3d5666;border-radius:6px;cursor:pointer}' +
    '.pencil-tools button.held{background:#f6c343;color:#222;border-color:#f6c343;font-weight:700}' +
    '.pencil-tools button:disabled{opacity:.5}' +
    '.pencil-status{margin-top:8px;min-height:32px;line-height:1.25;color:#cfe8ee}' +
    'body.tool-pencil, body.tool-pencil *{cursor:' + PENCIL_CURSOR + ' !important}' +
    'body.tool-eraser, body.tool-eraser *{cursor:' + ERASER_CURSOR + ' !important}' +
    '@media (max-width:600px){.pencil-tray{left:8px;bottom:8px;width:190px}}';

  // Pixel indexes (alpha channel) that sit inside the bubble, computed once.
  var inside = [];
  (function () {
    var c = SIZE / 2;
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        var dx = x + 0.5 - c, dy = y + 0.5 - c;
        if (dx * dx + dy * dy <= (R - 1) * (R - 1)) inside.push((y * SIZE + x) * 4 + 3);
      }
    }
  })();

  window.Gags.register({
    id: 'pencil',
    title: 'Shade the bubble completely',
    init: function (form, ctx) {
      var tool = null;         // null | 'pencil' | 'eraser'
      var wear = 0;            // bubbles finished since last sharpen
      var sharpening = false;
      var handShaded = 0;
      var penalties = 0;
      var lastNag = 0;
      var bubbles = [];

      var style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      var tray = document.createElement('div');
      tray.className = 'pencil-tray';
      tray.innerHTML =
        '<h3>Pencil tray</h3>' +
        '<div class="pencil-tools">' +
        '<button type="button" data-tool="pencil">Pencil</button>' +
        '<button type="button" data-tool="eraser">Eraser</button>' +
        '<button type="button" data-tool="sharpen">Sharpen</button>' +
        '</div>' +
        '<div class="pencil-status">Bubbles must be shaded completely. Pick up the pencil.</div>';
      document.body.appendChild(tray);
      var status = tray.querySelector('.pencil-status');
      var buttons = tray.querySelectorAll('button');

      function blunt() { return wear >= BUBBLES_PER_SHARPEN; }

      function setTool(next) {
        tool = next;
        document.body.classList.toggle('tool-pencil', tool === 'pencil');
        document.body.classList.toggle('tool-eraser', tool === 'eraser');
        buttons.forEach(function (b) {
          b.classList.toggle('held', b.dataset.tool === tool);
          if (b.dataset.tool === 'pencil') b.textContent = tool === 'pencil' ? 'Put down' : (blunt() ? 'Pencil (blunt)' : 'Pencil');
          if (b.dataset.tool === 'eraser') b.textContent = tool === 'eraser' ? 'Put down' : 'Eraser';
        });
        if (tool && form.contains(document.activeElement)) document.activeElement.blur();
      }

      tray.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b || sharpening) return;
        if (b.dataset.tool === 'sharpen') {
          sharpening = true;
          setTool(null);
          buttons.forEach(function (x) { x.disabled = true; });
          status.textContent = 'bzzzzzzzzzzzzzzz';
          setTimeout(function () {
            wear = 0;
            sharpening = false;
            buttons.forEach(function (x) { x.disabled = false; });
            setTool(null);
            status.textContent = 'Sharp. Pick it up again, ' + ctx.patientName() + '.';
          }, 2500);
          return;
        }
        setTool(tool === b.dataset.tool ? null : b.dataset.tool);
        status.textContent = tool ? 'Holding the ' + tool + '. You cannot type while holding it.' : 'Hands free. You may type.';
      });

      // No typing with a pencil in your hand.
      form.addEventListener('focusin', function (e) {
        if (!tool || !e.target.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select')) return;
        e.target.blur();
        ctx.say('Put the ' + tool + ' down before typing, ' + ctx.patientName() + '. Safety first.');
      });

      function labelText(input) {
        var label = input.closest('label');
        return label ? label.textContent.replace('*', '').trim() : input.name;
      }

      function heckle(pct, name) {
        if (pct >= 95) return 'Accepted. Was that so hard, ' + name + '?';
        if (pct >= 85) return pct + '%. So close, ' + name + '. Not close enough.';
        if (pct >= 60) return pct + '%. The machine cannot read that, ' + name + '.';
        if (pct >= 30) return pct + '%. Stay inside the lines, ' + name + '.';
        return pct + '%. Bold start, ' + name + '.';
      }

      function makeBubble(input) {
        var wrap = document.createElement('span');
        wrap.className = 'bubble';
        var canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(canvas);
        wrap.appendChild(input);
        var g = canvas.getContext('2d', { willReadFrequently: true });
        g.lineCap = 'round';
        g.lineJoin = 'round';

        var bubble = {
          input: input,
          wrap: wrap,
          wentOutside: false,
          fraction: function () {
            var data = g.getImageData(0, 0, SIZE, SIZE).data;
            var n = 0;
            for (var i = 0; i < inside.length; i++) if (data[inside[i]] > 80) n++;
            return n / inside.length;
          },
          clear: function () {
            g.clearRect(0, 0, SIZE, SIZE);
            wrap.classList.remove('is-shaded');
          },
          machineFill: function () {
            g.globalCompositeOperation = 'source-over';
            g.fillStyle = '#2b2b2b';
            g.beginPath();
            g.arc(SIZE / 2, SIZE / 2, R, 0, Math.PI * 2);
            g.fill();
            wrap.classList.add('is-shaded');
          }
        };

        var drawing = false, last = null;
        function point(e) {
          var r = canvas.getBoundingClientRect();
          return { x: (e.clientX - r.left) * SIZE / r.width, y: (e.clientY - r.top) * SIZE / r.height };
        }
        function stroke(a, b) {
          g.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
          g.strokeStyle = '#2b2b2b';
          g.lineWidth = tool === 'eraser' ? ERASER_WIDTH : (blunt() ? BLUNT_WIDTH : SHARP_WIDTH);
          g.beginPath();
          g.moveTo(a.x, a.y);
          g.lineTo(b.x + 0.01, b.y + 0.01);
          g.stroke();
        }

        canvas.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          if (!tool) {
            ctx.say('You need a pencil for that, ' + ctx.patientName() + '. The tray is bottom-left.');
            return;
          }
          drawing = true;
          bubble.wentOutside = false;
          canvas.setPointerCapture(e.pointerId);
          last = point(e);
          stroke(last, last);
        });
        canvas.addEventListener('pointermove', function (e) {
          if (!drawing) return;
          var p = point(e);
          stroke(last, p);
          last = p;
          var dx = p.x - SIZE / 2, dy = p.y - SIZE / 2;
          if (tool === 'pencil' && Math.sqrt(dx * dx + dy * dy) > R + 4) bubble.wentOutside = true;
          status.textContent = labelText(input).slice(0, 28) + ': ' + heckle(Math.floor(bubble.fraction() * 100), ctx.patientName());
        });
        function finish() {
          if (!drawing) return;
          drawing = false;
          var f = bubble.fraction();
          if (tool === 'pencil' && bubble.wentOutside) {
            penalties++;
            ctx.timer.penalize(OUTSIDE_PENALTY);
            ctx.say('Outside the lines, ' + ctx.patientName() + '. -' + OUTSIDE_PENALTY + 's.');
          }
          if (f >= FILL_TARGET && !input.checked) {
            input.checked = true;
            wrap.classList.add('is-shaded');
            handShaded++;
            wear++;
            if (!bubble.wentOutside) {
              ctx.timer.reward(NEAT_REWARD);
              ctx.say('Neat shading bonus, ' + ctx.patientName() + '. +' + NEAT_REWARD + 's.');
            }
            if (blunt()) {
              ctx.say('Your pencil is now blunt, ' + ctx.patientName() + '. Please sharpen it.');
              setTool(tool);
            }
            announce(input);
          } else if (f < FILL_TARGET && input.checked) {
            input.checked = false;
            wrap.classList.remove('is-shaded');
            announce(input);
          }
          status.textContent = labelText(input).slice(0, 28) + ': ' + heckle(Math.floor(f * 100), ctx.patientName());
        }
        canvas.addEventListener('pointerup', finish);
        canvas.addEventListener('pointercancel', finish);

        // Clicking the label text must not tick the box for you.
        var label = input.closest('label');
        if (label) {
          label.addEventListener('click', function (e) {
            e.preventDefault();
            if (wrap.contains(e.target)) return;
            if (Date.now() - lastNag > 3000) {
              lastNag = Date.now();
              ctx.say('Nice try, ' + ctx.patientName() + '. Marks must be made in pencil.');
            }
          });
        }
        return bubble;
      }

      var selfChange = false;
      function announce(input) {
        selfChange = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        selfChange = false;
        syncAll();
      }

      // Keep the graphite in step with the real inputs (radio siblings, autofill, reset).
      function syncAll() {
        bubbles.forEach(function (b) {
          var f = b.fraction();
          if (b.input.checked && f < FILL_TARGET) b.machineFill();
          if (!b.input.checked && f >= FILL_TARGET) b.clear();
        });
      }

      form.querySelectorAll('input[type=checkbox], input[type=radio]').forEach(function (input) {
        bubbles.push(makeBubble(input));
      });

      form.addEventListener('change', function (e) {
        if (!selfChange && e.target.matches('input[type=checkbox], input[type=radio]')) syncAll();
      });
      form.addEventListener('reset', function () {
        setTimeout(function () { bubbles.forEach(function (b) { b.clear(); }); }, 0);
      });

      ctx.addSubmitCheck(function () {
        for (var i = 0; i < bubbles.length; i++) {
          var f = bubbles[i].fraction();
          if (f > STRAY_ABOVE && f < FILL_TARGET) {
            bubbles[i].wrap.scrollIntoView({ block: 'center', behavior: 'smooth' });
            return 'The bubble for "' + labelText(bubbles[i].input).slice(0, 40) + '" is ' + Math.floor(f * 100) +
                   '% shaded. Stray marks cannot be read, ' + ctx.patientName() + '. Finish it or erase it.';
          }
        }
        return true;
      });

      ctx.addStat(function () {
        return 'Bubbles shaded by hand: ' + handShaded + '. Outside-the-lines penalties: ' + penalties + '.';
      });

      document.addEventListener('intake:submitted', function () {
        setTool(null);
        tray.remove();
      });
    }
  });
})();
