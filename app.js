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
      resumeFloat();
      setTimeout(() => nameIn.focus(), ms(340));
    });

  // Setup-guide tasks navigate to their page; the banner opens the onboarding dialog.
  $('#taskBusinessModel').addEventListener('click', () => go('#connect'));
  $('#taskTestAccount').addEventListener('click', () => go('#connected'));
  $('#taskTestCharge').addEventListener('click', () => go('#account'));
  $('#taskInviteDevelopers').addEventListener('click', inviteDevelopers);

  // The account row and the back arrow walk into and out of the detail page
  $('#accountRow').addEventListener('click', () => go('#account'));
  $('#cadBack').addEventListener('click', () => go('#connected'));

  // Collapsed guide: the next-up label routes to that task's page.
  const guideNext = $('#guideNext');
  guideNext.addEventListener('click', () => {
    if (guideNext.dataset.action === 'workbench') inviteDevelopers();
    else if (guideNext.dataset.route) go(guideNext.dataset.route);
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

  // The printed card lands when there is nothing left to type onto it: either
  // the website is committed, or the user moves on without one. `mono` is that
  // second case — everything prints except the brand colour, which there is no
  // website to take it from, so the tile stays grey and the initials carry it.
  function printCard(mono) {
    preview.classList.toggle('is-mono', mono);
    if (!preview.classList.contains('is-color')) {
      preview.classList.add('is-color');
      startFloat(true);
    }
    syncPreview();
  }

  // Colour lands once the website is committed — on blur, not on keystroke.
  function colorPreview() {
    if (siteIn.value.trim()) printCard(false);
  }

  /* ── The card comes off the page ─────────

     Up to here the preview is a panel: it fills in a field at a time and it
     stays put. Once there is nothing left to fill in it stops being the form's
     output and becomes an object — held off the pane, turning under the
     cursor, never quite still.

     A spring rather than a transition. A transition re-aims on every pointer
     event and lands dead each time; a spring carries its velocity across them,
     so a fast sweep throws the card past the cursor and it settles back. That
     carried velocity is the whole difference between a tilt effect and
     something with weight.
  */

  const MAX_TILT = 9;      // degrees at full deflection
  const REACH    = 420;    // px from the card's centre that reads as full tilt
  const FADE     = 520;    // px beyond that over which the pointer hands back
  const K = 150, C = 17;   // ζ ≈ 0.7 — one soft overshoot, then still
  const HOVER    = 26;     // px toward the viewer once it is floating

  // One spring per axis. `v` survives between frames, which is what lets a
  // flick overshoot instead of stopping dead where the pointer stopped.
  const axes = { rx: { x: 0, v: 0 }, ry: { x: 0, v: 0 }, z: { x: 0, v: 0 } };
  let aimRX = 0, aimRY = 0, pull = 0;
  let floating = false, clock = 0, last = 0;
  let home = { x: 0, y: 0 };

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  // The card is centred in a pane that never moves, so the pane's centre is the
  // card's home. Measuring the card itself would read back the tilt we just
  // wrote to it and leave the thing chasing its own tail.
  function measureHome() {
    const r = dialogRight.getBoundingClientRect();
    home = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function aimAt(px, py) {
    const dx = (px - home.x) / REACH;
    const dy = (py - home.y) / REACH;
    // Full authority within a reach of the centre, handed back over the next
    // FADE px. A cursor parked across the screen shouldn't hold the card at an
    // angle it never chose — past that it belongs to the drift again.
    pull  = clamp(1 - Math.max(0, Math.hypot(dx, dy) - 1) / (FADE / REACH), 0, 1);
    aimRY =  clamp(dx, -1, 1) * MAX_TILT * pull;
    aimRX = -clamp(dy, -1, 1) * MAX_TILT * pull;
  }

  const release = () => { aimRX = 0; aimRY = 0; pull = 0; };

  function integrate(s, target, dt) {
    s.v += ((target - s.x) * K - s.v * C) * dt;
    s.x += s.v * dt;
  }

  function frame(now) {
    // The card only exists inside the dialog. Once that leaves there is nothing
    // to drive, so the loop stops rather than burning frames behind a scrim.
    if (!dialog.classList.contains('is-on')) { floating = false; return; }

    // A backgrounded tab comes back with a huge gap between frames; capping it
    // keeps the spring from being launched by arithmetic.
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    clock += dt;

    integrate(axes.rx, aimRX, dt);
    integrate(axes.ry, aimRY, dt);
    integrate(axes.z,  HOVER, dt);

    // At rest it still has to read as held rather than parked. Two sines per
    // axis on periods that don't divide into each other, so the drift never
    // visibly repeats. It thins out while the pointer is driving — ambient sway
    // under a direct input reads as lag, not life.
    const air = 1 - 0.6 * pull;
    const t   = clock;
    const rx  = axes.rx.x + (Math.sin(t * 0.62)           * 0.85 + Math.sin(t * 0.29 + 1.7) * 0.40) * air;
    const ry  = axes.ry.x + (Math.sin(t * 0.47 + 0.8)     * 1.00 + Math.sin(t * 0.83 + 2.4) * 0.30) * air;
    const rz  = Math.sin(t * 0.36 + 1.2) * 0.55 * air;
    const bob = Math.sin(t * 0.53)       * 3.50 * air;

    const s = preview.style;
    s.setProperty('--float-rx', `${rx.toFixed(3)}deg`);
    s.setProperty('--float-ry', `${ry.toFixed(3)}deg`);
    s.setProperty('--float-rz', `${rz.toFixed(3)}deg`);
    s.setProperty('--float-y',  `${bob.toFixed(2)}px`);
    s.setProperty('--float-z',  `${axes.z.x.toFixed(2)}px`);

    // Cast by a light above and in front, so a card leaning left throws its
    // shadow right. Small numbers: against 60px of blur the offset reads as a
    // direction long before it reads as a distance.
    s.setProperty('--float-sx', `${(-ry * 0.9).toFixed(2)}px`);
    s.setProperty('--float-sy', `${( rx * 0.9).toFixed(2)}px`);

    // The sheen is that same fixed light. The card turns, the light doesn't, so
    // the highlight travels across the surface the other way.
    s.setProperty('--sheen-x', `${(50 - ry * 3.2).toFixed(2)}%`);
    s.setProperty('--sheen-y', `${(18 + rx * 3.2).toFixed(2)}%`);

    requestAnimationFrame(frame);
  }

  // `kick` is the card being let go of rather than found already floating: a
  // nod off the line that the spring then settles out. Reopening the dialog
  // picks the drift back up without repeating that moment.
  function startFloat(kick) {
    if (floating || reduced) return;
    floating = true;
    measureHome();
    preview.classList.add('is-float');
    if (kick) axes.rx.v = -16;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  function resumeFloat() {
    if (preview.classList.contains('is-color')) startFloat(false);
  }

  window.addEventListener('resize', () => { if (floating) measureHome(); });

  // Tracked on the document rather than the card. What makes it read as free is
  // that it answers the cursor from across the dialog, before you reach it.
  document.addEventListener('pointermove', e => {
    if (floating) aimAt(e.clientX, e.clientY);
  });
  document.addEventListener('pointerleave', release);
  window.addEventListener('blur', release);

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
    { el: $('#taskInviteDevelopers'),label: 'Invite your developers',      action: 'workbench' },
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
      guideNext.dataset.action = next.action || '';
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
  // Everything in the guide that is locked, whether a step or a whole group.
  const LOCKED = '.task.is-locked, .guide__row--locked';

  guide.addEventListener('click', e => {
    if (e.target.closest(LOCKED)) {
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
  // A trigger may name its own blocker instead — the Go live group is gated on
  // the verification steps, not on the queue the steps above it share.
  function tipText(el) {
    if (el.dataset.tip) return el.dataset.tip;
    const next = TASKS.find(t => t.el && !t.el.classList.contains('is-done'));
    return next ? `${next.label} first` : '';
  }

  function showTip(el) {
    if (tipFor === el) return;
    const text = tipText(el);
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
      const locked = e.target.closest(LOCKED);
      locked ? showTip(locked) : hideTip();
    });
    guide.addEventListener('mouseleave', hideTip);
  }
  guide.addEventListener('focusin', e => {
    const locked = e.target.closest(LOCKED);
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

  /* ── Workbench sheet ───────────────────── */

  // The last Connect task drives you into Workbench — where your developers
  // will live — so it opens the sheet up out of the taskbar. Getting there is
  // the task: it checks off as the sheet rises, and the guide hands over to
  // the verification group once the sheet is put away again, so the change is
  // something you see rather than something that happened behind the sheet.
  const workbench = $('#workbench');
  const taskInvite = $('#taskInviteDevelopers');
  let handOverOnClose = false;

  const wbIsOpen = () => workbench.classList.contains('is-open');

  function openWorkbench() {
    if (wbIsOpen()) return;
    hideTip();
    workbench.classList.add('is-open');
    workbench.setAttribute('aria-hidden', 'false');
    syncDock(true);
  }

  function closeWorkbench() {
    if (!wbIsOpen()) return;
    workbench.classList.remove('is-open');
    workbench.setAttribute('aria-hidden', 'true');
    syncDock(false);
    if (handOverOnClose) {
      handOverOnClose = false;
      openGroup(guideGroups[1]);
      fadeIn(guide, 200);
    }
  }

  // The step unlocks once the test charge is created (see index.html). The
  // guard stays so reaching it any other way can't tick off earlier steps.
  const priorDone = () => $('#taskTestCharge').classList.contains('is-done');

  function inviteDevelopers() {
    if (priorDone() && !taskInvite.classList.contains('is-done')) {
      completeThrough(3);
      handOverOnClose = true;
    }
    openWorkbench();
    requestAnimationFrame(() =>
      inviteCard.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }));
  }

  // The Developers bar toggles the sheet; its ringed chevron turns to match.
  const taskbarOpen   = $('#taskbarOpen');
  const taskbarToggle = $('#taskbarToggle');
  function syncDock(open) {
    document.body.classList.toggle('wb-open', open);
    taskbarOpen.setAttribute('aria-expanded', String(open));
    taskbarToggle.setAttribute('aria-label', open ? 'Minimise Workbench' : 'Open Workbench');
  }
  const toggleWorkbench = () => (wbIsOpen() ? closeWorkbench() : openWorkbench());
  // The whole bar is the handle — anywhere on it pulls the sheet up or puts
  // it away. One listener, so the buttons inside don't toggle it twice.
  $('#taskbar').addEventListener('click', toggleWorkbench);
  $('#wbClose').addEventListener('click', closeWorkbench);

  // The link icon is the invite itself: the link goes on the clipboard, and
  // the icon takes the action colour for a moment to say so.
  const copyLink = $('#wbCopyLink');
  let copyTimer = null;
  copyLink.addEventListener('click', () => {
    navigator.clipboard?.writeText(location.href.split('#')[0] + '#home').catch(() => {});
    copyLink.classList.add('is-copied');
    copyLink.setAttribute('aria-label', 'Link copied');
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copyLink.classList.remove('is-copied');
      copyLink.setAttribute('aria-label', 'Copy link');
    }, 1600);
  });

  /* ── Workbench · invite developers ───── */

  const inviteCard    = $('#wbInvite');
  const inviteForm    = $('#wbInviteForm');
  const inviteRows    = $('#wbInviteRows');
  const inviteError   = $('#wbInviteError');
  const copyInvite    = $('#wbCopyInvite');
  const inviteRowHTML = inviteRows.firstElementChild.outerHTML;
  let inviteCopyTimer = null;

  // LastPass injects its own three-dot control into email fields even when
  // data-lpignore is present. Remove only those extension-owned hosts, both
  // at boot and whenever it scans a newly added invite row.
  const lastPassUi = '[data-lastpass-icon-root], [data-lastpass-root], [id^="__lpform_"]';
  const removeLastPassUi = root => {
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.matches(lastPassUi)) {
      root.remove();
      return;
    }
    root.querySelectorAll(lastPassUi).forEach(el => el.remove());
  };
  new MutationObserver(changes => {
    changes.forEach(change => change.addedNodes.forEach(removeLastPassUi));
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.querySelectorAll(lastPassUi).forEach(el => el.remove());

  function syncInviteRows() {
    inviteRows.classList.toggle('has-multiple', inviteRows.children.length > 1);
  }

  $('#wbAddInvite').addEventListener('click', () => {
    inviteRows.insertAdjacentHTML('beforeend', inviteRowHTML);
    syncInviteRows();
  });

  inviteRows.addEventListener('click', e => {
    const remove = e.target.closest('.wb__removerow');
    if (!remove || inviteRows.children.length === 1) return;
    remove.closest('.wb__inviterow').remove();
    syncInviteRows();
  });

  inviteRows.addEventListener('input', e => {
    if (!e.target.matches('.wb__email input')) return;
    e.target.closest('.wb__inviterow').classList.remove('is-invalid');
    inviteError.textContent = '';
  });

  copyInvite.addEventListener('click', () => {
    const link = location.href.split('#')[0] + '#connect';
    navigator.clipboard?.writeText(link).catch(() => {});
    copyInvite.classList.add('is-copied');
    copyInvite.querySelector('span').textContent = 'Invite link copied';
    clearTimeout(inviteCopyTimer);
    inviteCopyTimer = setTimeout(() => {
      copyInvite.classList.remove('is-copied');
      copyInvite.querySelector('span').textContent = 'Copy invite link';
    }, 1600);
  });

  inviteForm.addEventListener('submit', e => {
    e.preventDefault();
    const inputs = $$('.wb__email input', inviteRows);
    const isEmail = input => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
    const invalid = inputs.filter(input => !isEmail(input));

    $$('.wb__inviterow', inviteRows).forEach(row => row.classList.remove('is-invalid'));
    if (invalid.length) {
      invalid.forEach(input => input.closest('.wb__inviterow').classList.add('is-invalid'));
      inviteError.textContent = invalid.length === 1
        ? 'Enter a valid email address.'
        : 'Enter a valid email address for each invite.';
      invalid[0].focus();
      return;
    }

    inviteError.textContent = '';
    inviteCard.classList.add('is-sent');
  });

  $('#wbInviteMore').addEventListener('click', () => {
    inviteCard.classList.remove('is-sent');
    inviteRows.innerHTML = inviteRowHTML;
    syncInviteRows();
    inviteForm.reset();
    inviteRows.querySelector('input').focus();
  });

  // Skipping swaps the invite for the full Overview: charts, keys, health
  const wbOverview = $('#wbOverview');
  $('#wbSkipInvite').addEventListener('click', () => {
    $('.wb__empty', workbench).hidden = true;
    wbOverview.hidden = false;
    wbOverview.closest('.wb__panel').scrollTop = 0;
  });

  $('#wboHideTools').addEventListener('click', () => { $('#wboTools').hidden = true; });

  const wboSecret = $('#wboSecret');
  $('#wboReveal').addEventListener('click', e => {
    const shown = wboSecret.classList.toggle('is-masked') === false;
    e.currentTarget.setAttribute('aria-pressed', String(shown));
    e.currentTarget.setAttribute('aria-label', shown ? 'Hide secret key' : 'Reveal secret key');
  });

  $$('[data-copy]', wbOverview).forEach(btn => btn.addEventListener('click', () => {
    navigator.clipboard?.writeText(btn.dataset.copy).catch(() => {});
    btn.classList.add('is-copied');
    setTimeout(() => btn.classList.remove('is-copied'), 1200);
  }));

  /* ── Workbench tabs ──────────────────── */

  // Only tabs with a panel behind them switch; the rest stay put, the way
  // the prototype's other unbuilt controls do.
  const wbTabs   = $$('.wb__tab', workbench);
  const wbPanels = $$('.wb__panel', workbench);

  function showWbTab(name) {
    const panel = wbPanels.find(p => p.dataset.panel === name);
    if (!panel) return;
    wbTabs.forEach(t => {
      const on = t.dataset.tab === name;
      t.classList.toggle('is-current', on);
      t.setAttribute('aria-selected', String(on));
    });
    wbPanels.forEach(p => p.classList.toggle('is-current', p === panel));
    // Shell has its own prompt, so the docked one steps aside there
    workbench.classList.toggle('on-shell', name === 'shell');
  }
  wbTabs.forEach(t => t.addEventListener('click', () => showWbTab(t.dataset.tab)));

  // Inspector's search has nothing to look up yet; keep Enter from reloading
  $('#inSearch').addEventListener('submit', e => e.preventDefault());

  /* ── Workbench · shared ────────────────── */

  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // JSON, one element per line, with a fold toggle on every object and array.
  // IDs read in the action colour, the way an event's own ID does.
  function renderValue(v) {
    if (v === null) return '<span class="z">null</span>';
    if (typeof v === 'boolean') return `<span class="b">${v}</span>`;
    if (typeof v === 'number') return `<span class="n">${v}</span>`;
    const cls = /^(evt|acct|pi|ch|tr|fee|acctsig)_/.test(v) ? 'i' : 's';
    return `<span class="${cls}">"${esc(v)}"</span>`;
  }

  function renderJson(value, depth = 0, key = null, last = true) {
    const label = key === null ? '' : `<span class="k">"${esc(key)}"</span>: `;
    const comma = last ? '' : ',';
    if (value && typeof value === 'object') {
      const isArr = Array.isArray(value);
      const [open, close] = isArr ? ['[', ']'] : ['{', '}'];
      const entries = Object.entries(value);
      const kids = entries.map(([k, v], i) =>
        renderJson(v, depth + 1, isArr ? null : k, i === entries.length - 1)).join('');
      return `<span class="ev__node"><span class="ev__ln" style="--d:${depth}">` +
        `<button class="ev__tog" aria-label="Collapse"></button>${label}${open}<span class="ev__fold">…${close}${comma}</span></span>` +
        `<span class="ev__kids">${kids}</span>` +
        `<span class="ev__ln ev__close" style="--d:${depth}">${close}${comma}</span></span>`;
    }
    return `<span class="ev__ln" style="--d:${depth}">${label}${renderValue(value)}${comma}</span>`;
  }

  // A list + detail pane pair (Events, Logs): selection, folding, search,
  // refresh and copy all behave the same in both.
  function listDetail({ list, search, updated, refresh, json, copy, items, selected, renderList, renderDetail, payload }) {
    const state = { selected };
    list.addEventListener('click', e => {
      const row = e.target.closest('.ev__row');
      if (!row) return;
      state.selected = items[+row.dataset.i];
      $$('.ev__row', list).forEach(r => {
        r.classList.toggle('is-selected', r === row);
        r.setAttribute('aria-selected', String(r === row));
      });
      renderDetail(state.selected);
    });
    json.addEventListener('click', e => {
      const tog = e.target.closest('.ev__tog');
      if (!tog) return;
      const folded = tog.closest('.ev__node').classList.toggle('is-folded');
      tog.setAttribute('aria-label', folded ? 'Expand' : 'Collapse');
    });
    search.addEventListener('input', () => renderList(state.selected));
    // Refresh restamps the header and replays the list's arrival
    refresh.addEventListener('click', () => {
      updated.textContent = new Date().toLocaleTimeString('en-US', { timeZone: 'UTC' });
      list.classList.remove('is-refreshing');
      void list.offsetWidth;
      list.classList.add('is-refreshing');
    });
    copy.addEventListener('click', () => {
      navigator.clipboard?.writeText(JSON.stringify(payload(state.selected), null, 2)).catch(() => {});
      copy.classList.add('is-copied');
      setTimeout(() => copy.classList.remove('is-copied'), 900);
    });
    renderList(state.selected);
    renderDetail(state.selected);
  }

  /* ── Workbench · Events ────────────────── */

  // The Furever account's traffic from the test charge, newest first. v2
  // events carry a thin payload that points at the object; v1 events snapshot
  // the object itself — which is why the two read differently below.
  const ACCT = 'acct_1Uct2JIQXbeqTFVg';
  const EVENTS = [
    { type: 'v2.core.account[requirements].updated', time: '8:31:49 PM', secs: 1794947509,
      id: 'evt_test_65VmH02GuxH95yBy5gS16VkQahPXSQKTDo20rEeP6006sq',
      desc: `The requirements for account with ID ${ACCT} were updated`,
      related: { id: ACCT, type: 'v2.core.account', url: `/v2/core/accounts/${ACCT}` } },
    { type: 'v1.application_fee.created', time: '8:31:49 PM', secs: 1794947509,
      id: 'evt_1Uct2dIQXbeqTFVgk3Hq9Lx2',
      desc: 'An application fee fee_1Uct2cIQXbeqTFVg67cgTuRP was collected',
      object: { id: 'fee_1Uct2cIQXbeqTFVg67cgTuRP', object: 'application_fee', account: ACCT,
                amount: 100, currency: 'usd', charge: 'ch_3Uct2XIQXb8NRkki2NO5zg1B', refunded: false } },
    { type: 'v1.application_fee.created', time: '8:31:47 PM', secs: 1794947507,
      id: 'evt_1Uct2bIQXbeqTFVg0pWm7sAq',
      desc: 'An application fee fee_1Uct2aIQXb3yn4xoP79uFoEW was collected',
      object: { id: 'fee_1Uct2aIQXb3yn4xoP79uFoEW', object: 'application_fee', account: ACCT,
                amount: 100, currency: 'usd', charge: 'ch_3Uct2XIQXb8NRkki2NO5zg1B', refunded: false } },
    { type: 'v1.charge.updated', time: '8:31:45 PM', secs: 1794947505,
      id: 'evt_3Uct2XIQXb8NRkki2Lz4cQ0d',
      desc: 'A payment ch_3Uct2XIQXb8NRkki2NO5zg1B was updated',
      object: { id: 'ch_3Uct2XIQXb8NRkki2NO5zg1B', object: 'charge', amount: 50000, amount_captured: 50000,
                application_fee_amount: 100, currency: 'usd', paid: true, status: 'succeeded',
                payment_intent: 'pi_3Uct2XIQXb8NRkki2Q0bXy1L' } },
    { type: 'v1.transfer.created', time: '8:31:45 PM', secs: 1794947505,
      id: 'evt_3Uct2XIQXb8NRkki2aT7nV5e',
      desc: 'A new transfer tr_3Uct2XIQXb8NRkki20VYgMzJ was created',
      object: { id: 'tr_3Uct2XIQXb8NRkki20VYgMzJ', object: 'transfer', amount: 49818, currency: 'usd',
                destination: ACCT, reversed: false, source_transaction: 'ch_3Uct2XIQXb8NRkki2NO5zg1B' } },
    { type: 'v2.signals.account_signal.fraudulent_merchant_ready', time: '8:31:43 PM', secs: 1794947503,
      id: 'evt_test_65VmH02Fq8sT1nCcd4XS16VkQahPXSQKTDo20rEeP6006sq',
      related: { id: 'acctsig_test_61TmqW3dEo8nB2kPc41', type: 'v2.signals.account_signal',
                 url: '/v2/signals/account_signals/acctsig_test_61TmqW3dEo8nB2kPc41' } },
    { type: 'v2.core.account[configuration.customer].capability_status_updated', time: '8:31:42 PM', secs: 1794947502,
      id: 'evt_test_65VmH02E2kPq7wYbe1SS16VkQahPXSQKTDo20rEeP6006sq',
      desc: `The capability status for customer configuration on account with ID ${ACCT} was updated`,
      related: { id: ACCT, type: 'v2.core.account', url: `/v2/core/accounts/${ACCT}` } },
    { type: 'v1.payment_intent.succeeded', time: '8:31:41 PM', secs: 1794947501,
      id: 'evt_3Uct2XIQXb8NRkki2t0Rk6Wn',
      desc: 'A payment pi_3Uct2XIQXb8NRkki2Q0bXy1L for $500.00 has succeeded',
      object: { id: 'pi_3Uct2XIQXb8NRkki2Q0bXy1L', object: 'payment_intent', amount: 50000,
                amount_received: 50000, application_fee_amount: 100, currency: 'usd',
                latest_charge: 'ch_3Uct2XIQXb8NRkki2NO5zg1B', status: 'succeeded' } },
    { type: 'v1.payment_intent.created', time: '8:31:40 PM', secs: 1794947500,
      id: 'evt_3Uct2XIQXb8NRkki2m8Hd3Ys',
      desc: 'A new payment pi_3Uct2XIQXb8NRkki2Q0bXy1L for $500.00 was created',
      object: { id: 'pi_3Uct2XIQXb8NRkki2Q0bXy1L', object: 'payment_intent', amount: 50000,
                amount_received: 0, application_fee_amount: 100, currency: 'usd',
                status: 'requires_payment_method' } },
    { type: 'v1.account.updated', time: '8:31:38 PM', secs: 1794947498,
      id: 'evt_1Uct2QIQXbeqTFVgwZ2pYc8r',
      desc: `The account ${ACCT} was updated`,
      object: { id: ACCT, object: 'account', business_profile: { name: 'Furever', url: 'furever.dev' },
                charges_enabled: true, payouts_enabled: true, country: 'US' } },
    { type: 'v2.core.account.created', time: '8:31:36 PM', secs: 1794947496,
      id: 'evt_test_65VmH02B7rNx3vQaf9KS16VkQahPXSQKTDo20rEeP6006sq',
      desc: `The account ${ACCT} was created`,
      related: { id: ACCT, type: 'v2.core.account', url: `/v2/core/accounts/${ACCT}` } }
  ];

  // The payload each event would have been delivered with. v2 types keep
  // their version; v1 types are delivered without it.
  function eventPayload(ev) {
    const iso = new Date(ev.secs * 1000).toISOString().replace(/\.\d+Z$/, '.445Z');
    if (ev.related) {
      return { created: iso, id: ev.id, object: 'v2.core.event', type: ev.type,
               livemode: false, reason: null, related_object: ev.related };
    }
    return { id: ev.id, object: 'event', api_version: '2025-10-29.clover', created: ev.secs,
             data: { object: ev.object }, livemode: false, pending_webhooks: 1,
             type: ev.type.slice(3) };
  }

  const evList   = $('#evList');
  const evSearch = $('#evSearch');
  const typeHtml = t => t.startsWith('v1.') ? `<em>v1.</em>${esc(t.slice(3))}` : esc(t);

  listDetail({
    list: evList, search: evSearch, updated: $('#evUpdated'), refresh: $('#evRefresh'),
    json: $('#evJson'), copy: $('#evCopy'), items: EVENTS, selected: EVENTS[0], payload: eventPayload,
    renderList(selected) {
      const q = evSearch.value.trim().toLowerCase();
      const shown = EVENTS.filter(e => !q || e.id.toLowerCase().includes(q) || e.type.toLowerCase().includes(q));
      evList.innerHTML = shown.map(e => `
        <button class="ev__row${e === selected ? ' is-selected' : ''}" role="option"
                aria-selected="${e === selected}" data-i="${EVENTS.indexOf(e)}">
          <span class="ev__rowtext">
            <span class="ev__type">${typeHtml(e.type)}</span>
            ${e.desc ? `<span class="ev__rowdesc">${esc(e.desc)}</span>` : ''}
          </span>
          <span class="ev__time">${e.time}</span>
        </button>`).join('');
      evList.parentElement.classList.toggle('is-empty', !shown.length);
    },
    renderDetail(e) {
      $('#evTitle').textContent = e.type;
      $('#evDesc').textContent = e.desc || '';
      $('#evId').textContent = e.id;
      $('#evDate').textContent = `Nov 17, 2026, ${e.time} UTC`;
      $('#evJson').innerHTML = renderJson(eventPayload(e));
      $('#evDetail').scrollTop = 0;
    }
  });

  /* ── Workbench · Logs ──────────────────── */

  // The API calls behind the test account and charge, newest first. The
  // HTTP method filter in the bar reads "POST, DELETE", so that's all there is.
  const PI = { id: 'pi_3Uct2XIQXb8NRkki2Q0bXy1L', object: 'payment_intent', amount: 50000,
               amount_received: 0, application_fee_amount: 100, currency: 'usd',
               customer: 'cus_L82G0DAIEgLtBf', livemode: false, status: 'requires_confirmation',
               transfer_data: { destination: ACCT } };
  const v2Account = (id, extra = {}) => ({ id, object: 'v2.core.account', applied_configurations: ['customer', 'merchant'],
               contact_email: 'testaccount@example.com', display_name: 'Furever', livemode: false, ...extra });

  const REQUESTS = [
    { method: 'POST', path: '/v1/payment_intents', time: '8:31:42 PM', req: 'req_xWPtR4xwg7wA4z',
      version: '2025-10-29.clover', idem: 'b0b9336a-0e9e-494b-9d0b-8cd146077af9', body: PI },
    { method: 'POST', path: `/v2/core/accounts/${ACCT}`, time: '8:31:33 PM', req: 'req_v2Lm8QeT3nWd5K',
      version: '2026-10-28.endive', idem: '4e1f0c27-9a7b-4f61-b2d5-31c0e8a5f9d2',
      body: v2Account(ACCT, { configuration: { customer: { capabilities: { automatic_indirect_tax: { status: 'active' } } } } }) },
    { method: 'POST', path: '/v2/core/accounts/acct_1Uct2JIQXb3yn4xo', time: '8:31:33 PM', req: 'req_v2Hc4RbN7pXs2A',
      version: '2026-10-28.endive', idem: '9c6a2d18-5e3b-4c0a-8f27-6d1b4e9a03c5',
      body: v2Account('acct_1Uct2JIQXb3yn4xo') },
    { method: 'POST', path: '/v2/core/accounts', time: '8:31:27 PM', req: 'req_v2Qa9ZtY1kFm6E',
      version: '2026-10-28.endive', idem: '1d7e5b93-2c4f-4a86-9b0e-7f3a6c2d8e41',
      body: v2Account(ACCT) },
    { method: 'POST', path: '/v2/core/accounts', time: '8:31:27 PM', req: 'req_v2Wd3JsK8rGh0U',
      version: '2026-10-28.endive', idem: '6b2c8f40-1a9d-4e37-a5c6-0d4f7b9e2a18',
      body: v2Account('acct_1Uct2JIQXb3yn4xo') },
    { method: 'DELETE', path: '/v1/webhook_endpoints/we_1Uct1zIQXb8NRkkiP3aT9sLm', time: '8:30:58 PM', req: 'req_Tq7bN2cXv5mR8p',
      version: '2025-10-29.clover', idem: '—',
      body: { id: 'we_1Uct1zIQXb8NRkkiP3aT9sLm', object: 'webhook_endpoint', deleted: true } }
  ];

  const lgList   = $('#lgList');
  const lgSearch = $('#lgSearch');
  const methodHtml = m => `<span class="lg__method lg__method--${m.toLowerCase()}">${m}</span>`;

  listDetail({
    list: lgList, search: lgSearch, updated: $('#lgUpdated'), refresh: $('#lgRefresh'),
    json: $('#lgJson'), copy: $('#lgCopy'), items: REQUESTS, selected: REQUESTS[0], payload: r => r.body,
    renderList(selected) {
      const q = lgSearch.value.trim().toLowerCase();
      const shown = REQUESTS.filter(r => !q || r.path.toLowerCase().includes(q) || r.req.toLowerCase().includes(q));
      lgList.innerHTML = shown.map(r => `
        <button class="ev__row lg__row${r === selected ? ' is-selected' : ''}" role="option"
                aria-selected="${r === selected}" data-i="${REQUESTS.indexOf(r)}">
          <span class="lg__code"><i class="ev__glyph ev__glyph--check"></i>200</span>
          ${methodHtml(r.method)}
          <span class="ev__rowtext"><span class="ev__type">${esc(r.path)}</span></span>
          <span class="ev__time">${r.time}</span>
        </button>`).join('');
      lgList.parentElement.classList.toggle('is-empty', !shown.length);
    },
    renderDetail(r) {
      $('#lgTitle').innerHTML = `${methodHtml(r.method)}${esc(r.path)}`;
      $('#lgStatus').textContent = '200';
      $('#lgReq').textContent = r.req;
      $('#lgTime').textContent = `Nov 17, 2026, ${r.time} UTC`;
      $('#lgVersion').textContent = r.version;
      $('#lgIdem').textContent = r.idem === '—' ? '—' : `Key — ${r.idem}`;
      $('#lgJson').innerHTML = renderJson(r.body);
      $('#lgDetail').scrollTop = 0;
    }
  });

  /* ── Workbench · Guides ────────────────── */

  // [title, description, steps, API calls, products]. `backticks` in a title
  // set that part in code type.
  const GUIDES = [
    { section: 'Full integrations',
      sub: 'Step through a full integration with the code samples you need to quickly get started.',
      cards: [
        ['Collect payments using Accounts v2 as a marketplace', 'Collect payments then pay out on your marketplace.', 2, 4, 'Connect, Checkout'],
        ['Collect payments as a platform', 'Collect payments directly on your connected accounts and take a fee.', 2, 4, 'Connect, Checkout']
      ] }
  ];

  const bpBody   = $('#bpBody');
  const bpSearch = $('#bpSearch');
  const plural   = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  function renderGuides() {
    const q = bpSearch.value.trim().toLowerCase();
    const html = GUIDES.map(({ section, sub, cards }) => {
      const shown = cards.filter(c => !q || `${c[0].replace(/`/g, '')} ${c[1]} ${c[4]}`.toLowerCase().includes(q));
      if (!shown.length) return '';
      return `<section class="bp__section">
        <h4 class="bp__stitle">${section}</h4>
        <p class="bp__ssub">${sub}</p>
        <div class="bp__grid">${shown.map(([title, desc, steps, calls, products]) => `
          <button class="bp__card">
            <span class="bp__ctitle">${esc(title).replace(/`([^`]+)`/g, '<code>$1</code>')}</span>
            <span class="bp__cdesc">${esc(desc)}</span>
            <span class="bp__meta">${plural(steps, 'step')} · ${plural(calls, 'API call')} · ${esc(products)}</span>
          </button>`).join('')}
        </div>
      </section>`;
    }).join('');
    bpBody.innerHTML = html || '<p class="bp__none">No guides match your search.</p>';
  }
  bpSearch.addEventListener('input', renderGuides);
  renderGuides();

  /* ── Workbench · Shell ─────────────────── */

  // Not a real CLI — a handful of commands that answer the way the Stripe CLI
  // would, with the sandbox's own objects, so the welcome's links all land.
  const shOut     = $('#shOut');
  const shInput   = $('#shInput');
  const shScroll  = $('#shScroll');
  const shHistory = [];
  let shAt = 0;

  // What `stripe <resource> list|retrieve` returns
  const SHELL_OBJECTS = {
    customers:       { id: 'cus_L82G0DAIEgLtBf', object: 'customer', email: 'stacy.wilson@gmail.com', name: 'Stacy Wilson', balance: 0, currency: 'usd', delinquent: false },
    payment_intents: { ...PI, amount_received: 50000, status: 'succeeded' },
    charges:         { id: 'ch_3Uct2XIQXb8NRkki2NO5zg1B', object: 'charge', amount: 50000, application_fee_amount: 100, currency: 'usd', paid: true, status: 'succeeded' },
    accounts:        { id: ACCT, object: 'account', business_profile: { name: 'Furever', url: 'furever.dev' }, charges_enabled: true, payouts_enabled: true, country: 'US' },
    transfers:       { id: 'tr_3Uct2XIQXb8NRkki20VYgMzJ', object: 'transfer', amount: 49818, currency: 'usd', destination: ACCT, reversed: false }
  };

  const line = (text, cls = '') => `<p class="${cls}">${esc(text)}</p>`;

  const SHELL_COMMANDS = {
    help: () => [
      line('Usage:'),
      line('  stripe [command]'),
      line(''),
      line('Commands:'),
      line('  customers, payment_intents, charges, transfers   list | retrieve'),
      line('  accounts   create | update | retrieve | list | delete | capabilities | persons | reject | unreject'),
      line('  listen     Listen for webhook events'),
      line('  trigger    Trigger test webhook events'),
      line('  clear      Clear the screen'),
      line(''),
      line('Use "stripe [command] --help" for more information about a command.', 'is-dim')
    ].join(''),
    listen: () => [
      line('> Ready! You are using Stripe API Version [2025-10-29.clover]. Your webhook signing secret is whsec_8f2c41a9d7e3b6f05c1a2e9d (^C to quit)', 'is-ok'),
      line('2026-11-17 20:32:51   --> payment_intent.succeeded [evt_3Uct2XIQXb8NRkki2t0Rk6Wn]', 'is-dim'),
      line('2026-11-17 20:32:51   --> charge.updated [evt_3Uct2XIQXb8NRkki2Lz4cQ0d]', 'is-dim')
    ].join(''),
    trigger: arg => {
      if (!arg || arg === '[event]') {
        return line('Supported events:') +
          ['payment_intent.succeeded', 'payment_intent.created', 'charge.updated', 'account.updated', 'transfer.created']
            .map(e => line('  ' + e)).join('');
      }
      return line(`Setting up fixture for: ${arg.split('.')[0]}`) +
             line(`Running fixture for: ${arg.split('.')[0]}`) +
             line('Trigger succeeded! Check dashboard for event details.', 'is-ok');
    }
  };

  function runShell(raw) {
    const cmd = raw.trim();
    if (!cmd) return;
    shHistory.push(cmd);
    shAt = shHistory.length;

    if (cmd === 'clear') {
      shOut.innerHTML = '';
      $('#shWelcome').classList.add('is-gone');
      return;
    }

    const [bin, sub, arg] = cmd.split(/\s+/);
    let html;
    if (bin !== 'stripe') {
      html = line(`zsh: command not found: ${bin}`, 'is-err');
    } else if (!sub || sub === 'help' || sub === '--help') {
      html = SHELL_COMMANDS.help();
    } else if (SHELL_COMMANDS[sub]) {
      html = SHELL_COMMANDS[sub](arg);
    } else if (sub === 'accounts' && ['create', 'update', 'delete', 'capabilities', 'persons', 'reject', 'unreject'].includes(arg)) {
      const account = SHELL_OBJECTS.accounts;
      const bodies = {
        create: { ...account, created: Math.floor(Date.now() / 1000), type: 'custom' },
        update: { ...account, metadata: { updated_from: 'api_explorer' } },
        delete: { id: account.id, object: 'account', deleted: true },
        capabilities: { object: 'list', data: [{ id: 'card_payments', object: 'capability', status: 'active' }, { id: 'transfers', object: 'capability', status: 'active' }], has_more: false },
        persons: { object: 'list', data: [{ id: 'person_1Uct2JIQXb8NRkki', object: 'person', first_name: 'Stacy', last_name: 'Wilson' }], has_more: false },
        reject: { ...account, requirements: { disabled_reason: 'rejected.other' } },
        unreject: { ...account, requirements: { disabled_reason: null } }
      };
      html = `<pre class="ev__json">${renderJson(bodies[arg])}</pre>`;
    } else if (SHELL_OBJECTS[sub] && (arg === 'list' || arg === 'retrieve')) {
      const obj = SHELL_OBJECTS[sub];
      const body = arg === 'list'
        ? { object: 'list', data: [obj], has_more: false, url: `/v1/${sub}` }
        : obj;
      html = `<pre class="ev__json">${renderJson(body)}</pre>`;
    } else if (SHELL_OBJECTS[sub]) {
      html = line(`Available operations for ${sub}: list, retrieve`, 'is-dim');
    } else {
      html = line(`unknown command "${sub}" for "stripe"`, 'is-err') +
             line(`Run 'stripe --help' for usage.`, 'is-dim');
    }

    shOut.insertAdjacentHTML('beforeend',
      `<div class="sh__entry">${line(`furever/furever-sandbox $ ${cmd}`, 'is-cmd')}${html}</div>`);
    shScroll.scrollTop = shScroll.scrollHeight;
  }

  shInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      runShell(shInput.value);
      shInput.value = '';
    } else if (e.key === 'ArrowUp' && shAt > 0) {
      e.preventDefault();
      shInput.value = shHistory[--shAt];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      shAt = Math.min(shHistory.length, shAt + 1);
      shInput.value = shHistory[shAt] || '';
    }
  });

  // The welcome's ▷ links run their command as if typed
  $('#shWelcome').addEventListener('click', e => {
    const c = e.target.closest('.sh__cmd');
    if (c) { runShell(c.dataset.cmd); shInput.focus(); }
  });
  $('#shDismiss').addEventListener('click', () => $('#shWelcome').classList.add('is-gone'));

  // A click anywhere in the terminal's empty space lands in the prompt —
  // unless it's a text selection, which the click would otherwise lose.
  $('#shTerm').addEventListener('click', e => {
    if (e.target.closest('button, .sh__explorer') || String(getSelection())) return;
    shInput.focus();
  });

  // The docked prompt under the other tabs: Enter carries the command over
  // to the Shell tab and runs it there; the chevron and expand just go there.
  const wbPrompt  = $('#wbPrompt');
  const openShell = () => { showWbTab('shell'); shInput.focus(); };
  wbPrompt.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const cmd = wbPrompt.value;
    wbPrompt.value = '';
    openShell();
    runShell(cmd);
  });
  $('#wbPromptUp').addEventListener('click', openShell);

  // Webhooks' local-listener link starts `stripe listen` over in the Shell
  $('#whListen').addEventListener('click', () => { openShell(); runShell('stripe listen'); });
  $('#wbPromptExpand').addEventListener('click', openShell);

  /* API Explorer: Accounts has the complete action set and request editor from
     the Workbench references. The other resources keep their compact
     list/retrieve path, so this remains useful beyond the onboarding demo. */
  const shPanel    = $('[data-panel="shell"]');
  const shResource = $('#shResource');
  const shMethod   = $('#shMethod');
  const shRun      = $('#shRun');
  const shResourceBtn = $('#shResourceBtn');
  const shMethodBtn = $('#shMethodBtn');
  const shResourceMenu = $('#shResourceMenu');
  const shMethodMenu = $('#shMethodMenu');
  const shRequest = $('#shRequest');

  const API_RESOURCES = [
    { value: 'accounts', label: 'Accounts' },
    { value: 'activity_logs_v2', label: 'Activity Logs v2', badges: ['Preview'] },
    { value: 'charges', label: 'Charges' },
    { value: 'customers', label: 'Customers' },
    { value: 'payment_intents', label: 'Payment Intents' },
    { value: 'transfers', label: 'Transfers' }
  ];
  const ACCOUNT_METHODS = [
    ['create', 'Create'], ['update', 'Update'], ['retrieve', 'Retrieve'],
    ['list', 'List'], ['delete', 'Delete'], ['capabilities', 'Capabilities'],
    ['persons', 'Persons'], ['reject', 'Reject'], ['unreject', 'Unreject']
  ];
  const DEFAULT_METHODS = [['list', 'List'], ['retrieve', 'Retrieve']];
  const CREATE_PARAMS = [
    ['type', 'Enum'], ['account_token', 'Str'], ['business_profile', 'Hash'],
    ['business_type', 'Enum'], ['capabilities', 'Hash'], ['company', 'Hash'],
    ['controller', 'Hash'], ['country', 'Str'], ['default_currency', 'Str'],
    ['documents', 'Hash'], ['email', 'Str'], ['expand', 'Arr'],
    ['external_account', 'Str'], ['groups', 'Hash'], ['individual', 'Hash'],
    ['metadata', 'Hash'], ['settings', 'Hash'], ['tos_acceptance', 'Hash']
  ];
  const ACTION_PARAMS = {
    create: CREATE_PARAMS,
    update: [['account', 'Str'], ...CREATE_PARAMS],
    retrieve: [['account', 'Str'], ['expand', 'Arr']],
    list: [['created', 'Str'], ['ending_before', 'Str'], ['limit', 'Int'], ['starting_after', 'Str']],
    delete: [['account', 'Str']],
    capabilities: [['account', 'Str'], ['capability', 'Str']],
    persons: [['account', 'Str'], ['person', 'Str'], ['limit', 'Int']],
    reject: [['account', 'Str'], ['reason', 'Enum']],
    unreject: [['account', 'Str']]
  };

  const typeClass = type => `is-${type.toLowerCase()}`;
  function closeExplorerMenus() {
    [
      [shResourceMenu, shResourceBtn],
      [shMethodMenu, shMethodBtn]
    ].forEach(([menu, btn]) => {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function renderResourceOptions(query = '') {
    const q = query.trim().toLowerCase();
    const shown = API_RESOURCES.filter(item => item.label.toLowerCase().includes(q));
    $('#shResourceOptions').innerHTML = shown.map(item => `
      <button class="sh__option${item.value === shResource.value ? ' is-selected' : ''}" type="button" role="option" data-value="${item.value}">
        <span class="sh__optlabel">${esc(item.label)}</span>
        ${item.value === shResource.value ? '<i class="sh__check">✓</i>' : ''}
      </button>`).join('') || '<p class="sh__nooptions">No resources found</p>';
  }

  function methodsForResource() {
    return shResource.value === 'accounts' ? ACCOUNT_METHODS : DEFAULT_METHODS;
  }

  function renderMethodOptions(query = '') {
    const q = query.trim().toLowerCase();
    const shown = methodsForResource().filter(([, label]) => label.toLowerCase().includes(q));
    $('#shMethodOptions').innerHTML = shown.map(([value, label]) => `
      <button class="sh__option${value === shMethod.value ? ' is-selected' : ''}" type="button" role="option" data-value="${value}">
        <span class="sh__optlabel">${label}</span>
        ${value === shMethod.value ? '<i class="sh__check">✓</i>' : ''}
      </button>`).join('') || '<p class="sh__nooptions">No methods found</p>';
  }

  function fieldRow([name, type], section) {
    const composite = type === 'Hash' || type === 'Arr';
    return `<div class="sh__prow">
      <div class="sh__pname"><code>${esc(name)}</code><span class="sh__type ${typeClass(type)}">${type}</span></div>
      <div class="sh__pvalue">
        ${composite
          ? `<button class="sh__addvalue" type="button" data-field="${esc(name)}" data-section="${section}">Add ${type === 'Hash' ? 'hash' : 'array'}</button>`
          : `<input class="sh__pinput" data-field="${esc(name)}" data-section="${section}" placeholder="// ${type === 'Enum' ? 'select value' : 'enter value'}" autocomplete="off" spellcheck="false" />`}
      </div>
    </div>`;
  }

  function renderRequest() {
    if (shResource.value !== 'accounts' || !shMethod.value) {
      shRequest.innerHTML = '';
      return;
    }
    const params = ACTION_PARAMS[shMethod.value] || [];
    shRequest.innerHTML = `
      <section class="sh__requestsection">
        <h4>Headers</h4>
        ${fieldRow(['stripe-account', 'Str'], 'header')}
        ${fieldRow(['stripe-context', 'Str'], 'header')}
      </section>
      <section class="sh__requestsection">
        <h4>Parameters</h4>
        ${params.map(p => fieldRow(p, 'param')).join('') || '<p class="sh__emptyparams">No parameters</p>'}
      </section>`;
  }

  function chooseResource(value) {
    const item = API_RESOURCES.find(resource => resource.value === value);
    shResource.value = value;
    $('#shResourceLabel').textContent = item?.label || 'Select a resource';
    shMethod.value = '';
    $('#shMethodLabel').textContent = 'Select a method';
    $('#shMethodSearch').value = '';
    closeExplorerMenus();
    syncExplorer();
  }

  function chooseMethod(value) {
    const item = methodsForResource().find(([method]) => method === value);
    shMethod.value = value;
    $('#shMethodLabel').textContent = item?.[1] || 'Select a method';
    closeExplorerMenus();
    syncExplorer();
  }

  function toggleMenu(menu, button, input, renderOptions) {
    const opening = menu.hidden;
    closeExplorerMenus();
    if (!opening) return;
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    renderOptions(input.value);
    requestAnimationFrame(() => input.focus());
  }

  shResourceBtn.addEventListener('click', () =>
    toggleMenu(shResourceMenu, shResourceBtn, $('#shResourceSearch'), renderResourceOptions));
  shMethodBtn.addEventListener('click', () =>
    toggleMenu(shMethodMenu, shMethodBtn, $('#shMethodSearch'), renderMethodOptions));
  $('#shResourceSearch').addEventListener('input', e => renderResourceOptions(e.target.value));
  $('#shMethodSearch').addEventListener('input', e => renderMethodOptions(e.target.value));
  $('#shResourceOptions').addEventListener('click', e => {
    const option = e.target.closest('[data-value]');
    if (option) chooseResource(option.dataset.value);
  });
  $('#shMethodOptions').addEventListener('click', e => {
    const option = e.target.closest('[data-value]');
    if (option) chooseMethod(option.dataset.value);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.sh__field')) closeExplorerMenus();
  });

  // Composite values begin as a compact action. Activating one turns it into
  // an editable inline value without making the entire parameter table jump.
  shRequest.addEventListener('click', e => {
    const add = e.target.closest('.sh__addvalue');
    if (!add) return;
    const input = document.createElement('input');
    input.className = 'sh__pinput';
    input.dataset.field = add.dataset.field;
    input.dataset.section = add.dataset.section;
    input.placeholder = add.textContent.includes('hash') ? '// key=value' : '// value, value';
    input.autocomplete = 'off';
    input.spellcheck = false;
    add.replaceWith(input);
    input.focus();
  });

  const shCommand = () => {
    const values = $$('.sh__pinput', shRequest)
      .filter(input => input.value.trim())
      .map(input => `--${input.dataset.field} ${JSON.stringify(input.value.trim())}`);
    return [`stripe ${shResource.value} ${shMethod.value}`, ...values].join(' ');
  };

  function syncExplorer() {
    shMethodBtn.disabled = !shResource.value;
    if (!shResource.value) {
      shMethod.value = '';
      $('#shMethodLabel').textContent = 'Select a method';
    }
    shRun.disabled = !(shResource.value && shMethod.value);
    renderRequest();
  }

  shRun.addEventListener('click', () => runShell(shCommand()));
  $('#shShowCode').addEventListener('click', () => {
    if (!shRun.disabled) { shInput.value = shCommand(); shInput.focus(); }
  });
  $('#shClear').addEventListener('click', () => {
    shResource.value = '';
    shMethod.value = '';
    $('#shResourceLabel').textContent = 'Select a resource';
    $('#shMethodLabel').textContent = 'Select a method';
    $('#shResourceSearch').value = '';
    $('#shMethodSearch').value = '';
    closeExplorerMenus();
    syncExplorer();
  });

  const shExplorerToggle = $('#shExplorerToggle');
  shExplorerToggle.addEventListener('click', () => {
    const hidden = shPanel.classList.toggle('no-explorer');
    shExplorerToggle.classList.toggle('is-on', !hidden);
    shExplorerToggle.setAttribute('aria-pressed', String(!hidden));
  });

  // Esc puts the sheet away — unless a modal is up, which Esc closes first.
  // Capture phase, so this reads `current` before the modal's own Esc handler
  // has cleared it; otherwise one press would close both.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !current) closeWorkbench();
  }, true);

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
    // charge lands. Balance is the charge less the $1.00 platform fee and
    // $1.82 processing fee the payment detail itemises, so the pages agree.
    $('#acctVolume').textContent  = '$10.00';
    $('#acctBalance').textContent = '$7.18';

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

  // Moving on is a commit too. Whatever step one got — a website or just a
  // name — the card prints on the way out of it, so nobody reaches step two
  // still looking at a form's worth of blanks.
  continueIn.addEventListener('click', () => {
    printCard(!siteIn.value.trim());
    dialog.classList.add('is-step2');
  });
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
