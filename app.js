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

  // Motion collapses under reduced motion; feedback does not. A beat that
  // exists to say "this is working" has to survive, or the commit teleports
  // with nothing to explain it.
  const beat = n => n * SPEED;

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
      // Arriving in the section reveals its pages — but only on arrival. Every
      // render used to reassert this, which meant the Connect toggle could
      // never close while one of its own pages was open: the click flipped the
      // flag and the render that followed flipped it straight back.
      if (!IN_CONNECT(lastView)) expanded = true;
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

    // Collapsed, Connect has to answer for the page itself — the child that
    // was carrying the selected state has just been folded away, and a section
    // holding the current page with nothing marked reads as nowhere. Open, it
    // stays neutral and lets Overview or Connected accounts hold it.
    navConnect.classList.toggle('is-current', IN_CONNECT(view) && !expanded);
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
  const continueIn = $('#continueBtn');
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
    }, beat(850));
  }

  // Committing from a modal blanks the page while the modal leaves, so the
  // state you were just looking at never reads through behind it. The new
  // state fades up from white once it's in place.
  function commitToPage(complete) {
    document.body.classList.add('is-swapping');
    closeLayer();
    // `--ease` front-loads the modal's fade — it is ~85% gone by 120ms — so
    // the white hold can stay this short without the old state showing.
    setTimeout(() => {
      complete();
      document.body.classList.remove('is-swapping');
      document.body.classList.add('is-arriving');
      setTimeout(() => document.body.classList.remove('is-arriving'), ms(420) + 60);
    }, ms(120));
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
  // The banner's button says "Verify your business", so it goes where the
  // guide's step of that name goes. Referenced lazily — the modal is declared
  // further down, and only the click needs it to exist.
  $('#verifyBtn').addEventListener('click', () => openLayer(identityModal));

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

  // Both verification steps open the same sheet — identity is what the
  // business is verified through, so they are one journey from here.
  $('#taskVerifyIdentity').addEventListener('click', () => openLayer(identityModal));
  $('#taskVerifyBusiness').addEventListener('click', () => openLayer(identityModal));
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

  const initials = (str, max) =>
    str.split(/\s+/).filter(Boolean).slice(0, max)
       .map(word => word[0]).join('').toUpperCase();

  function syncPreview() {
    const name = nameIn.value.trim();
    const site = siteIn.value.trim();
    const colored = preview.classList.contains('is-color');

    // Nothing to continue with until the business is named.
    continueIn.disabled = !name;

    // The gradient behind the card comes up on the first keystroke and fades
    // back out if the field is emptied. It's a transition, not a keyframe, so
    // typing and deleting retarget it rather than restarting it.
    dialogRight.classList.toggle('is-named', !!name);

    previewName.textContent = name || 'Business name';
    previewName.classList.toggle('is-filled', !!name);

    // The mark is the last thing to land. It waits for the website to be
    // entered and committed, so the card fills in one field at a time rather
    // than the name bringing the branding with it.
    // Initials come from the start of each word, not the first N characters —
    // "Furever" is one word, so it stays "F". The printed card will carry a
    // second letter only when there is a second word to take it from.
    const branded = !!name && colored;
    previewLogo.textContent = branded ? initials(name, 2) : '';
    previewLogo.classList.toggle('is-filled', branded);

    previewChipText.textContent = site || 'www.example.com';
    previewChip.classList.toggle('is-filled', !!site);

    preview.classList.toggle('is-filled', !!name);
  }

  // Colour lands once the website is committed — on blur, not on keystroke.
  function colorPreview() {
    if (!siteIn.value.trim()) return;
    preview.classList.add('is-color');
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
        unlock(el);
        el.classList.add('is-done');
      } else if (i === index + 1) {
        unlock(el);
        el.classList.add('is-unlocked');
      }
    });

    // A step that unlocks under the pointer would otherwise keep the tooltip
    // that was explaining why it couldn't be used.
    hideTip();

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

  /* ── Locked steps ──────────────────────── */

  // A locked step is inert, but it still has to answer for itself, so it stays
  // a hover target and explains what would unlock it. The obvious way to make
  // it inert — the `disabled` attribute — is the one that cannot work here:
  // disabled buttons fire no pointer events, so the tooltip would never open.
  // Hence aria-disabled, and a click swallowed before it reaches the row's own
  // handler. Capture on the guide gets there first without every handler
  // having to check for itself.
  guide.addEventListener('click', e => {
    if (e.target.closest('.task.is-locked')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  const unlock = el => {
    el.classList.remove('is-locked');
    el.removeAttribute('aria-disabled');
  };

  /* ── Tooltip ───────────────────────────── */

  const tooltip = $('#tooltip');
  const TIP_GAP   = 8;       // clearance from the trigger, and from the viewport
  const TIP_DELAY = 300;     // a pointer crossing the guide shouldn't summon it
  const TIP_GRACE = 300;     // ...but one just dismissed is still mid-thought

  let tipFor = null;         // the step it is for, pending or shown
  let tipTimer = null;
  let tipClosedAt = -Infinity;

  // The guide unlocks in order, so every locked step — however far down — is
  // waiting on the same one thing: the step at the front of the queue. They
  // all name it rather than each naming the row above it, because pointing at
  // another locked step would only move the question along.
  function tipText() {
    const next = TASKS.find(t => t.el && !t.el.classList.contains('is-done'));
    return next ? `${next.label} first` : '';
  }

  function showTip(el) {
    if (tipFor === el) return;
    const text = tipText();
    if (!text) return;

    // Warm: one is already up, or one closed a moment ago. The question has
    // been answered once, so asking it again of the step below shouldn't cost
    // another wait — the tooltip moves without replaying. Sweeping three
    // locked steps should read as one answer following the pointer, not three.
    const warm = tooltip.classList.contains('is-on') ||
                 performance.now() - tipClosedAt < TIP_GRACE;

    clearTimeout(tipTimer);
    if (tipFor) tipFor.removeAttribute('aria-describedby');
    tipFor = el;

    if (warm) placeTip(el, text, true);
    else tipTimer = setTimeout(() => placeTip(el, text, false), TIP_DELAY);
  }

  function placeTip(el, text, instant) {
    tooltip.textContent = text;
    tooltip.setAttribute('aria-hidden', 'false');
    el.setAttribute('aria-describedby', 'tooltip');

    // Measured after the text lands: the tooltip sizes to its content, so its
    // width isn't known until the string is in it.
    const r = el.getBoundingClientRect();
    const w = tooltip.offsetWidth;
    const h = tooltip.offsetHeight;

    // Centred over the step, then held inside the viewport — the guide sits
    // 24px off the right edge and is narrower than the tooltip, so centring
    // alone would hang it off the screen.
    const mid  = r.left + r.width / 2 - w / 2;
    const left = Math.min(Math.max(TIP_GAP, mid), innerWidth - w - TIP_GAP);

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top  = `${Math.round(r.top - h - TIP_GAP)}px`;

    // The scale grows from where the tooltip is pinned — the step's centre,
    // along the bottom edge — which the clamp above has usually moved off the
    // tooltip's own middle.
    const anchor = Math.round(r.left + r.width / 2 - left);
    tooltip.style.setProperty('--tip-origin', `${anchor}px 100%`);

    tooltip.classList.toggle('is-instant', instant);
    tooltip.classList.add('is-on');
  }

  function hideTip() {
    clearTimeout(tipTimer);
    if (!tipFor) return;
    tipFor.removeAttribute('aria-describedby');
    tipFor = null;
    if (tooltip.classList.contains('is-on')) tipClosedAt = performance.now();
    tooltip.classList.remove('is-on', 'is-instant');
    tooltip.setAttribute('aria-hidden', 'true');
  }

  // Pointer and keyboard both open it, per the component's own guidance.
  // Delegated on the guide via mouseover/focusin rather than mouseenter/focus,
  // which don't bubble and so can't be delegated at all.
  // The pointer half is gated on real hover: a tap fires mouseover with no
  // mouseleave behind it, which would strand the tooltip on screen.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    guide.addEventListener('mouseover', e => {
      const locked = e.target.closest('.task.is-locked');
      locked ? showTip(locked) : hideTip();
    });
    guide.addEventListener('mouseleave', hideTip);
  }
  guide.addEventListener('focusin', e => {
    const locked = e.target.closest('.task.is-locked');
    locked ? showTip(locked) : hideTip();
  });
  guide.addEventListener('focusout', hideTip);

  // The guide can move out from under a live tooltip — collapsing, or the page
  // scrolling behind it — and a tooltip left behind points at nothing.
  window.addEventListener('scroll', hideTip, true);
  window.addEventListener('resize', hideTip);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(); });

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

    // A fresh account has no history, so its row sits at zero until this
    // charge lands. Balance is the charge less the $1.82 processing fee the
    // payment detail itemises, so the two pages agree.
    $('#acctVolume').textContent  = '$500.00';
    $('#acctBalance').textContent = '$498.18';

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

  const startMarks = $$('.preview__mark');   // `preview` is declared above

  const syncStartOptions = () => {
    goDashboard.disabled = !startBoxes.some(b => b.checked);
    // Each product picked adds its mark to the card, in the order they're
    // listed. A mark's slot is how many picked marks sit ahead of it, so a
    // product ticked from the middle of the list slides the ones after it
    // along instead of appearing on top of them. Marks not picked take the
    // slot they would have had, and so fade up in place when their turn comes.
    let slot = 0;
    startMarks.forEach(mark => {
      const box = startBoxes.find(b => b.dataset.product === mark.dataset.product);
      const on  = !!box && box.checked;
      mark.style.setProperty('--slot', slot);
      mark.classList.toggle('is-on', on);
      if (on) slot++;
    });
  };
  startBoxes.forEach(b => b.addEventListener('change', syncStartOptions));

  continueIn.addEventListener('click', () => dialog.classList.add('is-step2'));
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
      setTimeout(() => document.body.classList.remove('is-onboarding'), ms(120));
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
