(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function simpleMarkdown(text) {
    return escHtml(text)
      .replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([\s\S]*?)\*/g,     '<em>$1</em>')
      .replace(/`([^`]*)`/g,          '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      var s = document.createElement('script');
      s.src = src; s.onload = resolve;
      s.onerror = function () { reject(new Error('Failed to load: ' + src)); };
      document.head.appendChild(s);
    });
  }

  // ---------------------------------------------------------------------------
  // Pyodide bootstrap  (reuse coatless instance if present)
  // ---------------------------------------------------------------------------

  async function ensurePyodide() {
    if (typeof qpyodideInstance !== 'undefined') {
      window.mainPyodide = await qpyodideInstance; return;
    }
    if (typeof mainPyodide !== 'undefined') return;
    var cdn = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/';
    await loadScript(cdn + 'pyodide.js');
    window.mainPyodide = await loadPyodide({ indexURL: cdn });
  }

  // ---------------------------------------------------------------------------
  // KaTeX  (legend rendering – loaded independently of page math)
  // ---------------------------------------------------------------------------

  var katexReady = false;
  var KATEX = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/';

  async function ensureKatex() {
    if (katexReady) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = KATEX + 'katex.min.css';
    document.head.appendChild(link);
    await loadScript(KATEX + 'katex.min.js');
    katexReady = true;
  }

  // ---------------------------------------------------------------------------
  // SymPy  (lazy – first Check click)
  // ---------------------------------------------------------------------------

  var sympyReady = false;

  async function ensureSympy() {
    if (sympyReady) return;
    await mainPyodide.loadPackage('sympy');
    await mainPyodide.runPythonAsync([
      'from sympy import *',
      'from sympy.parsing.sympy_parser import (',
      '    parse_expr, standard_transformations,',
      '    implicit_multiplication_application, convert_xor',
      ')',
      '_math_tf = standard_transformations + (',
      '    implicit_multiplication_application, convert_xor,',
      ')',
    ].join('\n'));
    sympyReady = true;
  }

  // ---------------------------------------------------------------------------
  // Legend
  // ---------------------------------------------------------------------------

  var LEGEND = [
    ['x^2',            'x^2 \\text{ oder } x{**}2', 'Potenz'],
    ['\\sqrt{x}',      'sqrt(x)',                    'Quadratwurzel'],
    ['\\sqrt[n]{x}',   'root(x, n)',                 'n-te Wurzel'],
    ['\\dfrac{a}{b}',  'a/b',                        'Bruch'],
    ['\\pi',           'pi',                         'Kreiszahl π'],
    ['e',              'E',                          'Eulersche Zahl e'],
    ['\\sin(x)',        'sin(x)',                    'Sinus'],
    ['\\cos(x)',        'cos(x)',                    'Kosinus'],
    ['\\tan(x)',        'tan(x)',                    'Tangens'],
    ['\\ln(x)',         'ln(x)',                     'Nat. Logarithmus'],
    ['\\log_a(x)',      'log(x, a)',                 'Log. zur Basis a'],
    ['|x|',             'Abs(x)',                    'Betrag'],
    ['\\infty',         'inf &nbsp;oder&nbsp; oo',   'Unendlich'],
    ['\\int f\\,dx',    'integrate(f, x)',           'Integral'],
    ['\\dfrac{d}{dx}f', 'diff(f, x)',                'Ableitung'],
  ];

  async function buildLegend(container) {
    await ensureKatex();
    var rows = LEGEND.map(function (item) {
      var math;
      try { math = katex.renderToString(item[0], { throwOnError: false }); }
      catch (e) { math = escHtml(item[0]); }
      return '<tr>'
        + '<td class="math-legend-math">'  + math + '</td>'
        + '<td><code class="math-legend-code">' + item[1] + '</code></td>'
        + '<td class="math-legend-desc">'  + item[2] + '</td>'
        + '</tr>';
    }).join('');
    container.innerHTML =
      '<div class="math-legend-inner">'
      + '<p class="math-legend-ops">'
      + 'Grundrechenzeichen:&nbsp;<code>+</code>&nbsp;<code>-</code>&nbsp;<code>*</code>&nbsp;<code>/</code>'
      + '&nbsp;&nbsp;|&nbsp;&nbsp;Klammern:&nbsp;<code>(</code>&nbsp;<code>)</code>'
      + '&nbsp;&nbsp;|&nbsp;&nbsp;Potenz:&nbsp;<code>^</code>&nbsp;oder&nbsp;<code>**</code>'
      + '</p>'
      + '<table class="math-legend-table"><thead><tr>'
      + '<th>Ausdruck</th><th>Eingabe</th><th>Bedeutung</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table>'
      + '</div>';
  }

  // ---------------------------------------------------------------------------
  // Error → human-readable German
  // ---------------------------------------------------------------------------

  function friendlyError(raw) {
    var msg = String(raw || '');
    if (/SyntaxError/i.test(msg))
      return 'Syntax-Fehler: Prüfe ob alle Klammern geschlossen sind und kein Operatorzeichen fehlt.';
    var nm = msg.match(/name ['"]([\w]+)['"] is not defined/);
    if (nm)
      return 'Unbekannte Bezeichnung &bdquo;' + nm[1] + '&ldquo; – nutze die Eingabe-Hilfe (z.&nbsp;B. <code>pi</code> statt <code>π</code>).';
    if (/NameError/i.test(msg))
      return 'Unbekannte Bezeichnung – nutze die Eingabe-Hilfe für korrekte Schreibweisen.';
    if (/ZeroDivisionError/i.test(msg) || /\bzoo\b/.test(msg))
      return 'Division durch Null: der Ausdruck ist an dieser Stelle nicht definiert.';
    if (/TypeError/i.test(msg))
      return 'Typ-Fehler: Stelle sicher, dass Zahlen und Variablen korrekt kombiniert sind.';
    return 'Die Eingabe konnte nicht verarbeitet werden – nutze die Eingabe-Hilfe für korrekte Schreibweisen.';
  }

  // ---------------------------------------------------------------------------
  // Task-text renderer  (used by pool mode: parses _[answer] markers in JS)
  // ---------------------------------------------------------------------------

  function renderTaskText(text, exerciseId, vars) {
    var count = 0, fieldIds = [];
    var html = text.replace(/(_+)\[([^\]]*)\]/g, function (_, underscores, answer) {
      count++;
      var fid  = exerciseId + '-f' + count;
      fieldIds.push(fid);
      var n    = underscores.length;
      var base = ' id="' + fid + '"'
               + ' data-answer="' + escHtml(answer) + '"'
               + ' data-vars="'   + escHtml(vars)   + '"'
               + ' autocomplete="off" autocorrect="off" spellcheck="false"';
      if (n >= 3) return '<textarea' + base + ' class="math-input math-input-large" rows="2"></textarea>';
      if (n >= 2) return '<input type="text"' + base + ' class="math-input math-input-medium">';
      return '<input type="text"' + base + ' class="math-input math-input-small">';
    });
    return { html: html.replace(/\n/g, '<br>\n'), fieldIds: fieldIds };
  }

  // ---------------------------------------------------------------------------
  // SymPy checker
  // ---------------------------------------------------------------------------

  var CHECK_PY = [
    'import json as _mj',
    '_local = {}',
    'if _math_vars.strip():',
    '    for _v in _math_vars.replace(",", " ").split():',
    '        _v = _v.strip()',
    '        if _v: _local[_v] = symbols(_v)',
    '_local.setdefault("inf", oo)',
    'try:',
    '    _ms = parse_expr(_math_student, local_dict=_local, transformations=_math_tf)',
    '    _mc = parse_expr(_math_correct,  local_dict=_local, transformations=_math_tf)',
    '    _d  = simplify(_ms - _mc)',
    '    _eq = (_d == 0) or (_d.is_number and abs(float(_d.evalf())) < 1e-10)',
    '    if not _eq:',
    '        _mres = {"status": "wrong"}',
    '    elif _math_mode == "exact":',
    '        _mres = {"status": "correct"} if str(_ms) == str(_mc) else {"status": "not_exact"}',
    '    elif _math_reject.strip():',
    '        _mr  = parse_expr(_math_reject, local_dict=_local, transformations=_math_tf)',
    '        _rej = (str(_ms) == str(_mr))',
    '        _mres = {"status": "rejected"} if _rej else {"status": "correct"}',
    '    else:',
    '        _mres = {"status": "correct"}',
    'except Exception as _me:',
    '    _mres = {"status": "error", "message": str(_me)}',
    '_mj.dumps(_mres)',
  ].join('\n');

  async function checkField(el, mode, reject) {
    var val = el.value.trim();
    if (!val) return { status: 'empty' };
    mainPyodide.globals.set('_math_student', val);
    mainPyodide.globals.set('_math_correct', el.dataset.answer || '');
    mainPyodide.globals.set('_math_vars',    el.dataset.vars   || '');
    mainPyodide.globals.set('_math_mode',    mode   || 'equivalent');
    mainPyodide.globals.set('_math_reject',  reject || '');
    return JSON.parse(await mainPyodide.runPythonAsync(CHECK_PY));
  }

  // ---------------------------------------------------------------------------
  // LLM / AI-Feedback  (OpenAI-compatible API, config stored in localStorage)
  // ---------------------------------------------------------------------------

  var LLM_CFG_KEY  = 'math-exercise-llm-config';
  var LLM_CNT_NS   = 'math-fb-cnt';

  function loadCfg()        { try { return JSON.parse(localStorage.getItem(LLM_CFG_KEY) || 'null'); } catch(e) { return null; } }
  function saveCfg(cfg)     { try { localStorage.setItem(LLM_CFG_KEY, JSON.stringify(cfg)); } catch(e) {} }
  function getCnt(lbl)      { try { return parseInt(localStorage.getItem(LLM_CNT_NS+'|'+location.pathname+'|'+lbl)||'0'); } catch(e) { return 0; } }
  function incCnt(lbl)      { var n = getCnt(lbl)+1; try { localStorage.setItem(LLM_CNT_NS+'|'+location.pathname+'|'+lbl, String(n)); } catch(e) {} return n; }

  // Config modal (singleton)
  var _modal = null;
  function getModal() {
    if (_modal) return _modal;
    var el = document.createElement('div');
    el.className = 'math-modal-backdrop';
    el.style.display = 'none';
    el.innerHTML =
      '<div class="math-modal" role="dialog">'
      + '<div class="math-modal-header"><strong>KI-Feedback einrichten</strong>'
      +   '<button class="math-modal-close" type="button" aria-label="Schließen">&times;</button></div>'
      + '<div class="math-modal-body">'
      +   '<p class="math-modal-hint">Die Zugangsdaten werden nur lokal in Ihrem Browser gespeichert.</p>'
      +   '<label class="math-modal-label">Base URL<input id="math-cfg-url"   class="math-modal-input" type="url"      placeholder="https://api.cerebras.ai/v1"></label>'
      +   '<label class="math-modal-label">API Key <input id="math-cfg-key"   class="math-modal-input" type="password" placeholder="csk-..."></label>'
      +   '<label class="math-modal-label">Modell  <input id="math-cfg-model" class="math-modal-input" type="text"     placeholder="llama-3.3-70b"></label>'
      + '</div>'
      + '<div class="math-modal-footer">'
      +   '<button class="btn btn-primary  math-modal-save"   type="button">Speichern &amp; Feedback laden</button>'
      +   '<button class="btn btn-light    math-modal-cancel" type="button">Abbrechen</button>'
      + '</div></div>';
    document.body.appendChild(el);

    function close() { el.style.display = 'none'; el._cb = null; }
    el.querySelector('.math-modal-close').onclick   = close;
    el.querySelector('.math-modal-cancel').onclick  = close;
    el.addEventListener('click', function(e) { if (e.target === el) close(); });
    el.querySelector('.math-modal-save').onclick = function () {
      var cfg = {
        baseUrl: el.querySelector('#math-cfg-url').value.trim(),
        apiKey:  el.querySelector('#math-cfg-key').value.trim(),
        model:   el.querySelector('#math-cfg-model').value.trim(),
      };
      var hint = el.querySelector('.math-modal-hint');
      if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) {
        hint.textContent = 'Bitte alle drei Felder ausfüllen.';
        hint.style.color = '#dc3545'; return;
      }
      saveCfg(cfg); close();
      if (el._cb) el._cb(cfg);
    };
    _modal = el;
    return el;
  }

  function showModal(cb) {
    var m = getModal(), cfg = loadCfg();
    if (cfg) {
      m.querySelector('#math-cfg-url').value   = cfg.baseUrl || '';
      m.querySelector('#math-cfg-key').value   = cfg.apiKey  || '';
      m.querySelector('#math-cfg-model').value = cfg.model   || '';
    }
    m._cb = cb; m.style.display = 'flex';
  }

  // System prompt – level increases with attempt count
  function sysPrompt(n) {
    if (n <= 1) return 'Du bist ein freundlicher Mathematik-Tutor. Der Schüler hat eine Aufgabe bearbeitet. Weise sanft auf den möglichen Fehler hin, ohne die Lösung zu verraten. Gib nur einen kleinen Denkanstoß. Antworte auf Deutsch in maximal 3 kurzen Sätzen.';
    if (n <= 2) return 'Du bist ein freundlicher Mathematik-Tutor. Der Schüler fragt zum zweiten Mal nach Hilfe. Gib einen konkreten Hinweis auf den Lösungsansatz, ohne die vollständige Lösung zu zeigen. Antworte auf Deutsch in maximal 4 Sätzen.';
    return 'Du bist ein freundlicher Mathematik-Tutor. Der Schüler hat bereits mehrfach um Hilfe gebeten. Erkläre den vollständigen Lösungsweg jetzt Schritt für Schritt, klar und verständlich. Antworte auf Deutsch.';
  }

  async function callLLM(question, answer, n, cfg) {
    var resp = await fetch(cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + cfg.apiKey,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: sysPrompt(n) },
          { role: 'user',   content: 'Aufgabe:\n' + question + '\n\nMeine Antwort:\n' + answer },
        ],
        max_tokens: 400,
      }),
    });
    if (!resp.ok) { var t = await resp.text(); throw new Error('API ' + resp.status + ': ' + t.slice(0, 200)); }
    return (await resp.json()).choices[0].message.content;
  }

  // ---------------------------------------------------------------------------
  // Exercise cell setup
  // ---------------------------------------------------------------------------

  function setupCell(cell) {
    var vars   = cell.dataset.vars   || '';
    var mode   = cell.dataset.mode   || 'equivalent';
    var reject = cell.dataset.reject || '';
    var label  = cell.dataset.label  || cell.id;

    // Pool: pick random task and render it
    var poolRaw = cell.dataset.pool;
    if (poolRaw) {
      var tasks  = JSON.parse(poolRaw);
      var pkey   = 'math-pool|' + location.pathname + '|' + label;
      var idx;
      try { idx = parseInt(sessionStorage.getItem(pkey)); } catch(e) {}
      if (isNaN(idx) || idx < 0 || idx >= tasks.length) {
        idx = Math.floor(Math.random() * tasks.length);
        try { sessionStorage.setItem(pkey, String(idx)); } catch(e) {}
      }
      var r = renderTaskText(tasks[idx], cell.id, vars);
      cell.querySelector('.math-exercise-question').innerHTML = r.html;
      cell.dataset.fields = JSON.stringify(r.fieldIds);
    }

    // Collapsible (only when caption toggle exists)
    var toggleEl = cell.querySelector('.math-exercise-toggle');
    var bodyEl   = cell.querySelector('.math-exercise-body');
    if (toggleEl && bodyEl) {
      function toggleOpen() {
        var open = cell.classList.toggle('math-exercise-open');
        bodyEl.style.display = open ? '' : 'none';
      }
      toggleEl.addEventListener('click', toggleOpen);
      toggleEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleOpen(); }
      });
    }

    var fieldIds    = JSON.parse(cell.dataset.fields || '[]');
    var checkBtn    = cell.querySelector('.math-check-btn');
    var legendBtn   = cell.querySelector('.math-legend-btn');
    var feedbackBtn  = cell.querySelector('.math-feedback-btn');
    var reconfigBtn  = cell.querySelector('.math-reconfig-btn');
    var reloadBtn    = cell.querySelector('.math-pool-reload');
    var legendPanel = cell.querySelector('.math-legend-panel');
    var fbDiv       = cell.querySelector('.math-feedback-area');
    var legendBuilt = false;

    // ---- Legend toggle ----
    legendBtn.addEventListener('click', async function () {
      if (legendPanel.style.display === 'none') {
        legendPanel.style.display = '';
        legendBtn.classList.add('active');
        if (!legendBuilt) {
          legendPanel.innerHTML = '<div class="math-fb-checking">&#9203; Lade Hilfe&hellip;</div>';
          await buildLegend(legendPanel);
          legendBuilt = true;
        }
      } else {
        legendPanel.style.display = 'none';
        legendBtn.classList.remove('active');
      }
    });

    // ---- Check ----
    async function runCheck() {
      checkBtn.disabled = true;
      fbDiv.innerHTML = '<div class="math-fb-checking">&#9203; Überprüfe&hellip;</div>';
      try {
        await ensureSympy();
        var parts = [];
        for (var i = 0; i < fieldIds.length; i++) {
          var el     = document.getElementById(fieldIds[i]);
          if (!el) continue;
          var prefix = fieldIds.length > 1 ? 'Feld&nbsp;' + (i+1) + ': ' : '';
          var res    = await checkField(el, mode, reject);
          el.classList.remove('math-input-ok', 'math-input-wrong', 'math-input-err');
          if      (res.status === 'empty')    { parts.push('<div class="math-fb-empty">'  + prefix + 'Bitte eine Antwort eingeben.</div>'); }
          else if (res.status === 'correct')  { el.classList.add('math-input-ok');    parts.push('<div class="math-fb-ok">&#10003;&nbsp;'  + prefix + 'Richtig!</div>'); }
          else if (res.status === 'wrong')    { el.classList.add('math-input-wrong'); parts.push('<div class="math-fb-wrong">&#10007;&nbsp;' + prefix + 'Nicht korrekt – versuche es noch einmal.</div>'); }
          else if (res.status === 'rejected') { el.classList.add('math-input-wrong'); parts.push('<div class="math-fb-wrong">&#10007;&nbsp;' + prefix + 'Mathematisch korrekt, aber noch nicht vereinfacht. Forme den Ausdruck weiter um.</div>'); }
          else if (res.status === 'not_exact'){ el.classList.add('math-input-wrong'); parts.push('<div class="math-fb-wrong">&#10007;&nbsp;' + prefix + 'Mathematisch korrekt, aber nicht in der gesuchten Form. Schreibe den Ausdruck genau so um, wie gefordert.</div>'); }
          else                                { el.classList.add('math-input-err');   parts.push('<div class="math-fb-err">&#9888;&nbsp;'    + prefix + friendlyError(res.message) + '</div>'); }
        }
        fbDiv.innerHTML = parts.join('');
      } catch (err) {
        fbDiv.innerHTML = '<div class="math-fb-err">&#9888;&nbsp;' + friendlyError(String(err)) + '</div>';
      } finally { checkBtn.disabled = false; }
    }

    function attachKeyListeners() {
      fieldIds.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.tagName === 'INPUT')
          el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); runCheck(); } });
      });
    }

    checkBtn.addEventListener('click', runCheck);
    attachKeyListeners();

    // ---- Pool reload ----
    if (reloadBtn && poolRaw) {
      var poolTasks = JSON.parse(poolRaw);
      var pkey = 'math-pool|' + location.pathname + '|' + label;
      reloadBtn.addEventListener('click', function () {
        var cur;
        try { cur = parseInt(sessionStorage.getItem(pkey)); } catch(e) {}
        var next = cur;
        if (poolTasks.length > 1) {
          while (next === cur) { next = Math.floor(Math.random() * poolTasks.length); }
        }
        try { sessionStorage.setItem(pkey, String(next)); } catch(e) {}

        var r = renderTaskText(poolTasks[next], cell.id, vars);
        cell.querySelector('.math-exercise-question').innerHTML = r.html;
        cell.dataset.fields = JSON.stringify(r.fieldIds);
        fieldIds = r.fieldIds;

        attachKeyListeners();
        fbDiv.innerHTML = '';
        // Clear input state classes (old elements gone, new ones are fresh)
      });
    }

    // ---- AI Feedback ----
    if (feedbackBtn) {
      feedbackBtn.addEventListener('click', function () {
        // Collect student answers
        var answers = fieldIds.map(function (id) {
          var el = document.getElementById(id); return el ? el.value.trim() : '';
        }).filter(Boolean).join(' | ');
        if (!answers) {
          fbDiv.innerHTML = '<div class="math-fb-empty">Bitte zuerst eine Antwort eingeben, dann Feedback anfordern.</div>';
          return;
        }
        // Build question text (caption + question area, inputs shown as their values)
        var qDiv   = cell.querySelector('.math-exercise-question');
        var capEl  = cell.querySelector('.math-exercise-caption');
        var clone  = qDiv.cloneNode(true);
        clone.querySelectorAll('input, textarea').forEach(function (el) {
          var s = document.createElement('span');
          s.textContent = '[' + (el.value || '?') + ']';
          el.parentNode.replaceChild(s, el);
        });
        var question = (capEl ? capEl.textContent + '\n' : '') + clone.textContent.replace(/\s+/g, ' ').trim();

        async function doFeedback(cfg) {
          var n = incCnt(label);
          feedbackBtn.disabled = true;
          fbDiv.innerHTML = '<div class="math-fb-checking">&#9203; Hole Feedback&hellip;</div>';
          try {
            var reply = await callLLM(question, answers, n, cfg);
            fbDiv.innerHTML =
              '<div class="math-fb-llm">'
              + '<div class="math-fb-llm-header">&#128161;&nbsp;Feedback'
              + (n > 1 ? ' <span class="math-fb-llm-cnt">(Versuch&nbsp;' + n + ')</span>' : '')
              + '</div>'
              + '<div class="math-fb-llm-body">' + simpleMarkdown(reply) + '</div>'
              + '</div>';
          } catch (err) {
            fbDiv.innerHTML =
              '<div class="math-fb-err">&#9888;&nbsp;Fehler: ' + escHtml(String(err))
              + '&nbsp;&nbsp;<button type="button" class="btn btn-sm btn-light math-fb-reconfig">&#9881;&nbsp;Konfiguration ändern</button>'
              + '</div>';
            var fbRecfg = fbDiv.querySelector('.math-fb-reconfig');
            if (fbRecfg) fbRecfg.addEventListener('click', function () { showModal(function (c) { doFeedback(c); }); });
          } finally { feedbackBtn.disabled = false; }
        }

        var cfg = loadCfg();
        if (cfg) { doFeedback(cfg); }
        else      { showModal(function (c) { doFeedback(c); }); }
      });
    }

    if (reconfigBtn) {
      reconfigBtn.addEventListener('click', function () { showModal(function () {}); });
    }
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', async function () {
    await ensurePyodide();
    document.querySelectorAll('.math-exercise-cell').forEach(setupCell);
  });

})();
