/* ─────────────────────────────────────────────
   Sandbox onboarding — motion prototype
   No dependencies. The landing page is static;
   all motion lives in the onboarding modal.
   JS beats read the same --speed the CSS does.
───────────────────────────────────────────── */

(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPEED = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--speed')
  ) || 1;
  const ms = n => (reduced ? 0 : n * SPEED);

  /* ── Ripple ────────────────────────────── */

  function ripple(btn, e) {
    if (reduced) return;
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    const el = document.createElement('span');
    el.className = 'ripple';
    el.style.width = el.style.height = `${size}px`;
    el.style.left = `${e.clientX - r.left - size / 2}px`;
    el.style.top  = `${e.clientY - r.top  - size / 2}px`;
    btn.appendChild(el);
    setTimeout(() => el.remove(), ms(700) + 50);
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn');
    if (btn) ripple(btn, e);
  });

  /* ── Routing ───────────────────────────── */

  // Hash-based so browser back/forward walks the flow.
  const ROUTES = {
    '': 'home',
    '#home': 'home',
    '#connect': 'connect',
    '#connected': 'connected',
    '#account': 'account',
    '#payment': 'payment'
  };
  const IN_CONNECT = v =>
    v === 'connect' || v === 'connected' || v === 'account' || v === 'payment';

  const navHome      = $('#navHome');
  const navConnect   = $('#navConnect');
  const navOverview  = $('#navOverview');
  const navConnected = $('#navConnected');
  const subnav       = $('#connectSubnav');

  const cadNavActivity = $('#cadNavActivity');
  const cadNavPayments = $('#cadNavPayments');

  const guide = $('#guide');

  // Disclosure state is independent of the route: expanding Connect reveals
  // its pages without selecting or navigating anywhere.
  let expanded = false;
  let lastView = null;

  function render() {
    const view = ROUTES[location.hash] || 'home';
    document.body.dataset.view = view;

    if (IN_CONNECT(view)) {
      expanded = true;                          // landing on the page reveals its nav
      // The guide rides along collapsed, then stays expanded on whichever page
      // just had a task completed on it (Figma 304:97049 / 306:58864).
      const done = document.body.classList;
      const stayExpanded =
        (view === 'connect'   && done.contains('model-saved')) ||
        (view === 'connected' && done.contains('account-created')) ||
        (view === 'account'   && done.contains('charge-created')) ||
        (view === 'payment'   && done.contains('charge-created'));
      if (lastView !== view && !stayExpanded) guide.classList.add('is-collapsed');
    }
    lastView = view;

    navHome.classList.toggle('is-current', view === 'home');
    navOverview.classList.toggle('is-current', view === 'connect');
    // The account pages both live under Connected accounts
    navConnected.classList.toggle('is-current',
      view === 'connected' || view === 'account' || view === 'payment');

    // Inside the account, the rail tracks which of its pages you're on
    cadNavActivity.classList.toggle('is-current', view === 'account');
    cadNavPayments.classList.toggle('is-current', view === 'payment');
    navConnect.classList.toggle('is-expanded', expanded);
    subnav.classList.toggle('is-open', expanded);
  }

  $('#guideToggle').addEventListener('click', () =>
    guide.classList.toggle('is-collapsed'));

  // Setup-guide groups are an accordion: opening one closes the others.
  const guideGroups = $$('.guide__group[data-group]');
  const openGroup = group =>
    guideGroups.forEach(g => g.classList.toggle('guide__group--open', g === group));

  guideGroups.forEach(group => {
    group.querySelector('.guide__row').addEventListener('click', () =>
      openGroup(group.classList.contains('guide__group--open') ? null : group));
  });

  function go(hash) {
    if (location.hash === hash) return;
    location.hash = hash;
  }

  window.addEventListener('hashchange', render);

  // Going Home closes the Connect disclosure — back to the nav's resting state.
  // render() runs directly too, so it collapses even when the hash is unchanged.
  navHome.addEventListener('click', () => {
    expanded = false;
    go('#home');
    render();
  });

  navOverview.addEventListener('click', () => go('#connect'));
  navConnected.addEventListener('click', () => go('#connected'));
  navConnect.addEventListener('click', () => { expanded = !expanded; render(); });

  /* ── Overlays ──────────────────────────── */

  // One backdrop serves every dialog; `current` is whichever is showing.
  const backdrop = $('#backdrop');
  const dialog   = $('#dialog');
  const nameIn   = $('#bizName');
  const siteIn   = $('#bizSite');
  let current    = null;
  let stagedExit = false;   // set only by the Go-to-Dashboard handover

  function openLayer(el, after) {
    if (current) return;
    current = el;
    backdrop.classList.add('is-on');
    el.classList.remove('is-leaving');
    el.classList.add('is-on');
    after?.();
  }

  function closeLayer() {
    const el = current;
    if (!el) return;
    current = null;
    el.classList.remove('is-on');
    el.classList.add('is-leaving');
    backdrop.classList.remove('is-on');
    // Dismissing any other way (Esc, backdrop, close) brings the guide straight
    // back. Only the staged Go-to-Dashboard exit holds it for its own beat.
    if (!stagedExit) document.body.classList.remove('is-onboarding');
    stagedExit = false;
    setTimeout(() => el.classList.remove('is-leaving'), ms(500) + 50);
  }

  // The commit beat. Every CTA that commits something — the business model,
  // the test account, the test charge, the dashboard handover — works under a
  // spinner first, so they all land the same way. If the layer is dismissed
  // while the spinner runs (Esc, backdrop), the commit is abandoned.
  function runCta(btn, done) {
    if (btn.classList.contains('is-busy')) return;
    const layer = current;
    btn.classList.add('is-busy');
    setTimeout(() => {
      btn.classList.remove('is-busy');
      if (current !== layer) return;
      done();
    }, ms(850));
  }

  // Committing from a modal blanks the page while the modal leaves, so the
  // state you were just looking at never reads through behind it. The new
  // state fades up from white once it's in place.
  function commitToPage(complete) {
    document.body.classList.add('is-swapping');
    closeLayer();
    // 240ms is enough for the modal to clear on `--ease`, which front-loads
    // most of its fade — so the white hold stays short.
    setTimeout(() => {
      complete();
      document.body.classList.remove('is-swapping');
      document.body.classList.add('is-arriving');
      setTimeout(() => document.body.classList.remove('is-arriving'), ms(420) + 60);
    }, ms(240));
  }

  // Always reopens on step one
  const openDialog = () =>
    openLayer(dialog, () => {
      document.body.classList.add('is-onboarding');
      dialog.classList.remove('is-step2');
      setTimeout(() => nameIn.focus(), ms(340));
    });

  // Setup-guide tasks navigate to their page; the banner opens the onboarding dialog.
  $('#taskBusinessModel').addEventListener('click', () => go('#connect'));
  $('#taskTestAccount').addEventListener('click', () => go('#connected'));
  $('#taskTestCharge').addEventListener('click', () => go('#account'));
  $('#taskIntegrationGuide').addEventListener('click', completeIntegrationGuide);

  // The account row and the back arrow walk into and out of the detail page
  $('#accountRow').addEventListener('click', () => go('#account'));
  $('#cadBack').addEventListener('click', () => go('#connected'));

  // Collapsed guide: the next-up label routes to that task's page.
  const guideNext = $('#guideNext');
  guideNext.addEventListener('click', () => {
    if (guideNext.dataset.route) go(guideNext.dataset.route);
  });
  $('#verifyBtn').addEventListener('click', openDialog);

  /* ── Business model modal ──────────────── */

  const modal   = $('#modelModal');
  const saveBtn = $('#modelSave');
  const models  = $$('.model');

  // `saved` only commits on Save; `chosen` is the working selection. Reopening
  // rewinds to `saved`, so an abandoned choice is discarded.
  let savedModel  = null;
  let chosenModel = null;

  function paintModels() {
    models.forEach(c => {
      const on = c.dataset.model === chosenModel;
      c.classList.toggle('is-selected', on);
      c.setAttribute('aria-checked', String(on));
    });
    saveBtn.disabled = !chosenModel;
  }

  function openModal() {
    chosenModel = savedModel;      // discard any unsaved choice from last time
    paintModels();
    openLayer(modal);
  }

  $('#getStartedBtn').addEventListener('click', openModal);
  $('#changeModelBtn').addEventListener('click', openModal);
  $('#modelClose').addEventListener('click', closeLayer);

  models.forEach(card => {
    card.addEventListener('click', () => {
      chosenModel = card.dataset.model;
      paintModels();
    });
  });

  // Saving commits the choice and completes the setup-guide task.
  saveBtn.addEventListener('click', () => {
    if (!chosenModel) return;
    runCta(saveBtn, () => {
      savedModel = chosenModel;
      commitToPage(completeBusinessModel);
    });
  });

  /* ── Test connected account modal ──────── */

  const accountModal = $('#accountModal');
  const openAccount  = () => openLayer(accountModal);

  $('#createTestAccountBtn').addEventListener('click', openAccount);
  $('#newAccountBtn').addEventListener('click', openAccount);
  const accountContinue = $('#accountContinue');

  $('#accountClose').addEventListener('click', closeLayer);
  accountContinue.addEventListener('click', () => {
    runCta(accountContinue, () => commitToPage(completeTestAccount));
  });

  /* ── Test charge modal ─────────────────── */

  const chargeModal = $('#chargeModal');

  $('#testChargeBtn').addEventListener('click', () => openLayer(chargeModal));
  const chargeCreate = $('#chargeCreate');

  $('#chargeClose').addEventListener('click', closeLayer);
  chargeCreate.addEventListener('click', () => {
    runCta(chargeCreate, () => commitToPage(completeTestCharge));
  });

  /* ── Identity verification modal ───────── */

  // Opens over whichever page you're on, on the shared backdrop.
  const identityModal = $('#identityModal');

  $('#taskVerifyIdentity').addEventListener('click', () => openLayer(identityModal));
  $('#identityClose').addEventListener('click', closeLayer);
  $('#identityDecline').addEventListener('click', closeLayer);
  $('#identityAgree').addEventListener('click', closeLayer);

  // The account's own rail, and the breadcrumb back up out of the payment
  cadNavActivity.addEventListener('click', () => go('#account'));
  cadNavPayments.addEventListener('click', () => go('#payment'));
  $('#crumbPayments').addEventListener('click', () => go('#account'));

  // The charge row drills into its payment page
  $('#paymentRow').addEventListener('click', () => go('#payment'));

  /* ── Escape / backdrop ─────────────────── */

  backdrop.addEventListener('click', closeLayer);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLayer();
  });

  /* ── Live card preview ─────────────────── */

  const preview     = $('#preview');
  const previewName = $('#previewName');
  const previewLogo = $('#previewLogo');
  const previewChip = $('#previewChip');

  const previewChipText = $('span', previewChip);
  const dialogRight     = $('#dialogRight');

  function syncPreview() {
    const name = nameIn.value.trim();
    const site = siteIn.value.trim();
    const colored = preview.classList.contains('is-color');

    previewName.textContent = name || 'Business name';
    previewName.classList.toggle('is-filled', !!name);

    // The printed card carries two initials; the plain one keeps its single letter
    previewLogo.textContent = name ? name.slice(0, colored ? 2 : 1).toUpperCase() : '';
    previewLogo.classList.toggle('is-filled', !!name);

    previewChipText.textContent = site || 'www.example.com';
    previewChip.classList.toggle('is-filled', !!site);

    preview.classList.toggle('is-filled', !!name);
  }

  // Colour lands once the website is committed — on blur, not on keystroke.
  function colorPreview() {
    if (!siteIn.value.trim()) return;
    preview.classList.add('is-color');
    dialogRight.classList.add('is-color');
    syncPreview();
  }

  // Re-trigger the chip's bump on each keystroke without fighting the transition.
  function bumpChip() {
    previewChip.classList.remove('is-bump');
    void previewChip.offsetWidth;
    previewChip.classList.add('is-bump');
  }

  nameIn.addEventListener('input', syncPreview);
  siteIn.addEventListener('input', () => { syncPreview(); bumpChip(); });
  siteIn.addEventListener('blur', colorPreview);

  /* ── Setup guide progress ──────────────── */

  // Every task in the guide, in order. The first four are the ones the
  // prototype can actually drive; the last two round out the six the
  // progress bar measures against.
  const TASKS = [
    { el: $('#taskBusinessModel'),   label: 'Choose your business model',  route: '#connect'   },
    { el: $('#taskTestAccount'),     label: 'Create a test account',       route: '#connected' },
    { el: $('#taskTestCharge'),      label: 'Create a test charge',        route: '#account'   },
    { el: $('#taskIntegrationGuide'),label: 'View your integration guide', route: '#account'   },
    { label: 'Verify your identity' },
    { label: 'Verify your business' }
  ];

  const progress = $('#guideProgress');
  const TRACK = 264;                 // the bar's full width, inside the 12px inset

  // Completing a task implies every task before it, so the guide stays
  // coherent however the user got there.
  function completeThrough(index) {
    TASKS.forEach(({ el }, i) => {
      if (!el) return;
      el.classList.remove('is-next');
      if (i <= index) {
        el.classList.remove('is-locked');
        el.classList.add('is-done');
      } else if (i === index + 1) {
        el.classList.remove('is-locked');
        el.classList.add('is-unlocked');
      }
    });

    // The next-up line tracks the first incomplete task; the verify steps
    // have nowhere to route to, so it just names them.
    const next = TASKS[index + 1];
    if (next) {
      guideNext.textContent = next.label;
      guideNext.dataset.route = next.route || '';
    }

    // Six steps across the track; the resting 10px is the design's floor.
    const done = index + 1;
    progress.style.width = `${Math.max(10, Math.round((done / TASKS.length) * TRACK))}px`;

    guide.classList.remove('is-collapsed');
  }

  function completeBusinessModel() {
    completeThrough(0);

    // Swaps the hero CTAs on the Connect overview (Figma 304:97049).
    document.body.classList.add('model-saved');

    // The page itself fades up from white via `page-in`; the guide trails it.
    fadeIn(guide, 120);
  }

  function completeTestAccount() {
    completeThrough(1);

    // The empty state gives way to the account table (Figma 306:58864).
    document.body.classList.add('model-saved', 'account-created');

    fadeIn(guide, 120);
  }

  // The last Connect task sends you to the real docs, then checks itself off
  // and hands the guide over to the verification group.
  const INTEGRATION_DOCS = 'https://docs.stripe.com/connect/interactive-platform-guide';

  function completeIntegrationGuide() {
    window.open(INTEGRATION_DOCS, '_blank', 'noopener,noreferrer');
    completeThrough(3);
    openGroup(guideGroups[1]);
    fadeIn(guide);
  }

  /* ── API log ───────────────────────────── */

  // Decorative, but it should read as if the charge just moved through it —
  // so the rows are rewritten rather than left on their placeholder values.
  const LOG_PATHS = [
    '/v1/payment_intents',
    '/v1/payment_intents/confirm',
    '/v1/charges',
    '/v1/application_fees',
    '/v1/balance_transactions',
    '/v1/accounts',
    '/v1/events'
  ];

  const pick = list => list[Math.floor(Math.random() * list.length)];
  const token = n =>
    Array.from({ length: n }, () =>
      'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');

  function refreshLogs() {
    const pad = n => String(n).padStart(2, '0');
    // Walk backwards from a recent moment so the entries read newest-first
    let secs = 3 * 3600 + Math.floor(Math.random() * 60) * 60 + Math.floor(Math.random() * 60);

    $$('.log').forEach(row => {
      row.querySelector('.badge').textContent = pick(['200 OK', '200 OK', '200 OK', '201 Created']);
      row.querySelector('.log__verb').textContent = pick(['POST', 'POST', 'GET']);
      row.querySelector('.log__path').textContent = `${pick(LOG_PATHS)}/${token(24)}`;
      row.querySelector('.log__time').textContent =
        `${Math.floor(secs / 3600)}:${pad(Math.floor(secs / 60) % 60)}:${pad(secs % 60)} AM`;
      secs -= 1 + Math.floor(Math.random() * 90);
    });
  }

  function completeTestCharge() {
    completeThrough(2);
    refreshLogs();

    // The charge fills in the account's own money-movement section, in place
    // (Figma 314:100161); the payment page is a click away from its row.
    document.body.classList.add('model-saved', 'account-created', 'charge-created');
    go('#account');

    fadeIn($('#moneyMovement'));
    fadeIn(guide, 120);
  }

  // Restart the animation from scratch so repeat saves replay it.
  function fadeIn(el, delay = 0) {
    el.classList.remove('fade-in');
    el.style.animationDelay = '';
    void el.offsetWidth;
    el.style.animationDelay = `${ms(delay)}ms`;
    el.classList.add('fade-in');
  }

  /* ── Onboarding dialog steps ───────────── */

  // Continue moves to "How do you want to start?"; the card on the right keeps
  // whatever was entered on step one (Figma 295:51892).
  const startBoxes  = $$('.startcard input');
  const goDashboard = $('#goDashboardBtn');

  const platformBox = $('#startPlatform');   // `preview` is declared above

  const syncStartOptions = () => {
    goDashboard.disabled = !startBoxes.some(b => b.checked);
    // Picking the platform option brands the card with the Connect mark
    preview.classList.toggle('is-platform', platformBox.checked);
  };
  startBoxes.forEach(b => b.addEventListener('change', syncStartOptions));

  $('#continueBtn').addEventListener('click', () => dialog.classList.add('is-step2'));
  $('#dialogBack').addEventListener('click', () => dialog.classList.remove('is-step2'));

  // Landing on the dashboard is where the setup guide takes over. The handover
  // is staged: the CTA works for a beat, the dialog leaves, then the dashboard
  // arrives behind it — so the three moments read separately.
  goDashboard.addEventListener('click', () => {
    runCta(goDashboard, () => {
      stagedExit = true;
      closeLayer();

      // Landing in the sandbox is what brands the account tile
      document.body.classList.add('is-onboarded');

      // The page rises as one — nav, sidebar and content together — while the
      // scrim clears, so the handover reads as a single move.
      document.body.classList.add('is-arriving');

      // The guide follows a beat later, on its own transition
      setTimeout(() => document.body.classList.remove('is-onboarding'), ms(240));
      setTimeout(() => document.body.classList.remove('is-arriving'), ms(420) + 60);
    });
  });

  /* ── Boot ──────────────────────────────── */

  render();
  syncPreview();

  // The demo opens on the onboarding dialog. Deep links skip it, so the later
  // pages stay reachable directly. Two frames so the entrance transition has
  // an initial state to animate from.
  if (!location.hash || location.hash === '#home') {
    // Set before the first paint, so the guide never flashes under the scrim
    document.body.classList.add('is-onboarding');
    requestAnimationFrame(() => requestAnimationFrame(openDialog));
  } else {
    // Deep links skip onboarding, so they start already inside the sandbox
    document.body.classList.add('is-onboarded');
  }
})();
