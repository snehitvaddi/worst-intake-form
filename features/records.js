// features/records.js — "We found your records!"
//
// A pop-up asks for your name before you can touch the form, "searches 3 national
// databases", then confidently matches you to the famous athlete whose name is closest
// to yours and pre-fills the form as them. Every pre-filled field is marked Verified:
// double-click it and insist you know better to edit it. Up to three times it quietly
// "re-syncs" a field you corrected (each field only once, so it stays winnable).
//
// Only public facts (name, birth date, birthplace, sport) are used for real people;
// everything medical stays blank or is an obvious joke about our filing, not about them.
(function () {
  var RESYNC_EVERY_MS = 40000;
  var MAX_RESYNCS = 3;

  // [first, last, date of birth, birthplace, sport]
  var ATHLETES = [
    ['LeBron', 'James', '1984-12-30', 'Akron, Ohio', 'basketball'],
    ['Stephen', 'Curry', '1988-03-14', 'Akron, Ohio', 'basketball'],
    ['Michael', 'Jordan', '1963-02-17', 'Brooklyn, New York', 'basketball'],
    ['Giannis', 'Antetokounmpo', '1994-12-06', 'Athens, Greece', 'basketball'],
    ['Lionel', 'Messi', '1987-06-24', 'Rosario, Argentina', 'football'],
    ['Cristiano', 'Ronaldo', '1985-02-05', 'Funchal, Portugal', 'football'],
    ['Kylian', 'Mbappe', '1998-12-20', 'Paris, France', 'football'],
    ['Mohamed', 'Salah', '1992-06-15', 'Nagrig, Egypt', 'football'],
    ['Sunil', 'Chhetri', '1984-08-03', 'Secunderabad, India', 'football'],
    ['Megan', 'Rapinoe', '1985-07-05', 'Redding, California', 'football'],
    ['Serena', 'Williams', '1981-09-26', 'Saginaw, Michigan', 'tennis'],
    ['Roger', 'Federer', '1981-08-08', 'Basel, Switzerland', 'tennis'],
    ['Rafael', 'Nadal', '1986-06-03', 'Manacor, Spain', 'tennis'],
    ['Novak', 'Djokovic', '1987-05-22', 'Belgrade, Serbia', 'tennis'],
    ['Naomi', 'Osaka', '1997-10-16', 'Osaka, Japan', 'tennis'],
    ['Sania', 'Mirza', '1986-11-15', 'Mumbai, India', 'tennis'],
    ['Virat', 'Kohli', '1988-11-05', 'Delhi, India', 'cricket'],
    ['Sachin', 'Tendulkar', '1973-04-24', 'Mumbai, India', 'cricket'],
    ['Mahendra', 'Dhoni', '1981-07-07', 'Ranchi, India', 'cricket'],
    ['Rohit', 'Sharma', '1987-04-30', 'Nagpur, India', 'cricket'],
    ['Jasprit', 'Bumrah', '1993-12-06', 'Ahmedabad, India', 'cricket'],
    ['Hardik', 'Pandya', '1993-10-11', 'Surat, India', 'cricket'],
    ['Shubman', 'Gill', '1999-09-08', 'Fazilka, India', 'cricket'],
    ['Smriti', 'Mandhana', '1996-07-18', 'Mumbai, India', 'cricket'],
    ['Sneh', 'Rana', '1994-02-18', 'Dehradun, India', 'cricket'],
    ['Sai', 'Sudharsan', '2001-10-15', 'Chennai, India', 'cricket'],
    ['Sai', 'Praneeth', '1992-08-10', 'Hyderabad, India', 'badminton'],
    ['Prakash', 'Padukone', '1955-06-10', 'Bengaluru, India', 'badminton'],
    ['Pusarla', 'Sindhu', '1995-07-05', 'Hyderabad, India', 'badminton'],
    ['Saina', 'Nehwal', '1990-03-17', 'Hisar, India', 'badminton'],
    ['Neeraj', 'Chopra', '1997-12-24', 'Khandra, India', 'javelin'],
    ['Mary', 'Kom', '1982-11-24', 'Kangathei, India', 'boxing'],
    ['Usain', 'Bolt', '1986-08-21', 'Sherwood Content, Jamaica', 'sprinting'],
    ['Michael', 'Phelps', '1985-06-30', 'Baltimore, Maryland', 'swimming'],
    ['Katie', 'Ledecky', '1997-03-17', 'Washington, D.C.', 'swimming'],
    ['Simone', 'Biles', '1997-03-14', 'Columbus, Ohio', 'gymnastics'],
    ['Tom', 'Brady', '1977-08-03', 'San Mateo, California', 'American football'],
    ['Patrick', 'Mahomes', '1995-09-17', 'Tyler, Texas', 'American football'],
    ['Tiger', 'Woods', '1975-12-30', 'Cypress, California', 'golf'],
    ['Lewis', 'Hamilton', '1985-01-07', 'Stevenage, England', 'Formula 1'],
    ['Max', 'Verstappen', '1997-09-30', 'Hasselt, Belgium', 'Formula 1'],
    ['Shohei', 'Ohtani', '1994-07-05', 'Oshu, Japan', 'baseball']
  ];

  var CSS =
    '.rec-locked{position:relative}' +
    '.rec-locked input,.rec-locked textarea{background:#f0fbf4;border-color:#9ad4ae;color:#44515e;cursor:not-allowed}' +
    '.rec-badge{margin-left:6px;padding:1px 7px;font-size:11px;font-weight:700;color:#12813b;background:#dcf5e5;border-radius:999px;white-space:nowrap}' +
    '.rec-badge small{font-weight:400;color:#5d8a6c}' +
    '.rec-search{margin:6px 0 4px;font:13px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#6b7a89;min-height:20px}' +
    '.rec-spinner{width:34px;height:34px;margin:6px auto 14px;border:4px solid #dfe6ec;border-top-color:#0f6e84;border-radius:50%;animation:recSpin 800ms linear infinite}' +
    '@keyframes recSpin{to{transform:rotate(360deg)}}';

  function distance(a, b) {
    var prev = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  // Lower is closer. Every typed word is compared with the athlete's first and last name.
  function closestAthlete(typed) {
    var words = typed.toLowerCase().split(/\s+/).filter(Boolean);
    var best = null, bestScore = Infinity;
    ATHLETES.forEach(function (a) {
      var score = Infinity;
      words.forEach(function (w) {
        [a[0], a[1]].forEach(function (part) {
          part = part.toLowerCase();
          var s = distance(w, part) / Math.max(w.length, part.length);
          if (w[0] === part[0]) s -= 0.15;
          if (part.indexOf(w) === 0 || w.indexOf(part) === 0) s -= 0.3;
          score = Math.min(score, s);
        });
      });
      if (score < bestScore) { bestScore = score; best = a; }
    });
    return { athlete: best, confidence: Math.max(4, Math.min(61, Math.round((1 - bestScore) * 45))) };
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  window.Gags.register({
    id: 'records',
    title: 'Wrong-person pre-fill (famous athlete edition)',
    init: function (form, ctx) {
      var filled = {};        // field name -> the value our "records" insist on
      var disputed = {};      // field name -> already re-synced once, leave it alone now
      var resyncs = 0;
      var matchName = '';

      var style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      function fieldLabel(el) {
        var label = el.closest('label');
        var t = label ? label.childNodes[0].textContent : el.name;
        return t.replace('*', '').trim();
      }

      function lock(el) {
        var label = el.closest('label');
        if (!label || el.dataset.gagWidget) return;
        el.readOnly = true;
        label.classList.add('rec-locked');
        if (!label.querySelector('.rec-badge')) {
          var badge = document.createElement('span');
          badge.className = 'rec-badge';
          badge.innerHTML = 'Verified &#10003; <small>double-click to dispute</small>';
          label.insertBefore(badge, el);
        }
      }

      function unlock(el) {
        var label = el.closest('label');
        el.readOnly = false;
        label.classList.remove('rec-locked');
        var badge = label.querySelector('.rec-badge');
        if (badge) badge.remove();
      }

      function write(name, value) {
        var el = form.elements[name];
        if (!el) return;
        el.value = value;
        filled[name] = el.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        lock(el);
      }

      function prefill(a) {
        var first = a[0], last = a[1], sport = a[4];
        write('firstName', first);
        write('lastName', last);
        write('dob', a[2]);
        write('email', (first + '.' + last).toLowerCase() + '@definitely-you.example');
        write('phone', '5550100' + (100 + Math.floor(Math.random() * 900)));
        write('ecName', 'Your agent (takes 10%)');
        write('ecPhone', '555-0142');
        write('reason', 'Records show a career in professional ' + sport + ', born in ' + a[3] +
              '. No complaint on file. Probably here to sign autographs.');
        write('allergies', 'Losing.');
      }

      form.addEventListener('dblclick', async function (e) {
        var el = e.target.closest('input, textarea');
        if (!el || !el.readOnly || !(el.name in filled)) return;
        var name = ctx.patientName();
        var body = document.createElement('div');
        var p1 = document.createElement('p');
        p1.textContent = 'Our records say your ' + fieldLabel(el).toLowerCase() + ' is:';
        var p2 = document.createElement('p');
        p2.className = 'rec-search';
        p2.textContent = el.value;
        var p3 = document.createElement('p');
        p3.textContent = 'Are you sure you know better than our records, ' + name + '?';
        body.appendChild(p1); body.appendChild(p2); body.appendChild(p3);
        var choice = await ctx.modal({
          title: 'Dispute a verified record?',
          node: body,
          actions: [
            { label: 'Our records are correct', value: 'keep', kind: 'big' },
            { label: 'i know better', value: 'dispute', kind: 'tiny' }
          ]
        });
        if (choice === 'dispute') {
          unlock(el);
          el.focus();
          if (el.select) el.select();
        } else {
          ctx.say('Wise choice, ' + name + '.');
        }
      });

      function resync() {
        if (resyncs >= MAX_RESYNCS || !form.isConnected || ctx.modalOpen()) return;
        var candidates = Object.keys(filled).filter(function (name) {
          var el = form.elements[name];
          return !disputed[name] && !el.dataset.gagWidget && el !== document.activeElement &&
                 !el.readOnly && el.value !== filled[name];
        });
        if (!candidates.length) return;
        var name = candidates[Math.floor(Math.random() * candidates.length)];
        var el = form.elements[name];
        var label = fieldLabel(el).toLowerCase();
        disputed[name] = true;
        resyncs++;
        el.value = filled[name];
        el.dispatchEvent(new Event('input', { bubbles: true }));
        lock(el);
        ctx.say('Re-synced your ' + label + ' with our records, ' + ctx.patientName() + '. You\'re welcome.');
      }

      async function welcome() {
        var typed = '';
        while (!typed) {
          var answer = await ctx.modal({
            title: 'Welcome to Lakeside Family Clinic',
            html: '<p>Before we begin, what is your full name?</p>',
            input: { placeholder: 'Full name', enterValue: 'go' },
            actions: [{ label: 'Find my records', value: 'go', kind: 'big' }]
          });
          typed = answer.text.trim();
          if (!typed) ctx.say('We can\'t find the wrong records without a name.');
        }

        var searching = document.createElement('div');
        searching.innerHTML = '<div class="rec-spinner"></div><div class="rec-search"></div>';
        var dialog = ctx.modal({ title: 'Searching 3 national databases…', node: searching });
        var lines = ['Connecting to fax machine…', 'Cross-referencing sports almanacs…', 'Ignoring spelling differences…', 'Rounding to the nearest celebrity…'];
        for (var i = 0; i < lines.length; i++) {
          searching.querySelector('.rec-search').textContent = lines[i];
          await sleep(1000);
        }
        dialog.close();

        var match = closestAthlete(typed);
        matchName = match.athlete[0] + ' ' + match.athlete[1];
        var found = document.createElement('div');
        var p1 = document.createElement('p');
        p1.textContent = 'You typed "' + typed + '". Closest match on file: ' + matchName +
                         ', professional ' + match.athlete[4] + '.';
        var p2 = document.createElement('p');
        p2.textContent = 'Match confidence: ' + match.confidence + '%. That is good enough for us, so we filled in everything for you. ' +
                         'Fields marked Verified can be disputed by double-clicking.';
        found.appendChild(p1);
        found.appendChild(p2);
        await ctx.modal({
          title: 'We found your records!',
          node: found,
          actions: [{ label: 'Great, thanks', value: 'ok', kind: 'big' }]
        });
        prefill(match.athlete);
        setInterval(resync, RESYNC_EVERY_MS);
      }

      // The signature has to match whatever name ends up in the form.
      ctx.addSubmitCheck(function () {
        var expected = (form.elements.firstName.value + ' ' + form.elements.lastName.value).trim().replace(/\s+/g, ' ');
        var signed = form.elements.signature.value.trim().replace(/\s+/g, ' ');
        if (signed.toLowerCase() === expected.toLowerCase()) return true;
        form.elements.signature.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return 'Signature does not match our records. Please sign exactly as "' + expected + '".';
      });

      ctx.addStat(function () {
        var names = Object.keys(filled);
        if (!names.length) return '';
        var still = names.filter(function (n) { return form.elements[n] && form.elements[n].value === filled[n]; }).length;
        return 'Record accuracy: ' + Math.round((1 - still / names.length) * 100) + '%. ' +
               still + ' of ' + names.length + ' fields still belong to ' + matchName + '.';
      });

      form.addEventListener('reset', function () {
        setTimeout(function () {
          Object.keys(filled).forEach(function (n) { if (form.elements[n] && form.elements[n].readOnly) unlock(form.elements[n]); });
        }, 0);
      });

      welcome();
    }
  });
})();
