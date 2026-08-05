# Onboarding prototype

A **working prototype** of the Stripe sandbox onboarding flow — a clickable, browser-native build of the Figma designs, not a static mockup or a set of exported images.

Every screen is real HTML and CSS, every transition is real motion, and the flow holds state: fill in the onboarding form and the card preview fills in with you; create a test account and the empty state becomes a populated table; create a test charge and the account's money-movement panel and API log rewrite themselves in place. The Setup guide tracks progress across all six tasks no matter what order you drive them in.

It is a prototype in the honest sense — it is a front end only. There is no backend, no persistence, and no real Stripe integration; data is fixed and resets on reload. What it is built to do is let you *drive* the flow end to end and feel the interaction design, at a fidelity screenshots can't carry.

## Running it

```
open index.html
```

That's it — no build step, no dependencies, no server required. (If you'd rather serve it: `python3 -m http.server 8000`, then visit `localhost:8000`.)

Tested in Chrome and Safari on macOS. Desktop viewports only — the design is full-bleed and assumes roughly 1280px or wider.

## Source of truth

Built from Figma → **Portfolio-presentation-scratch**

| Screen | Node |
| --- | --- |
| Landing (sandbox dashboard) | `295:54853` |
| Connect overview | `297:56237` |
| Setup guide, collapsed | `105:25795` / `298:61874` |
| Business model modal | `298:63550` (resting) / `298:66484` (selected) |
| Connect overview, saved | `304:97049` |
| Connect overview, Account status | `316:121474` / `316:122374` |
| Connected accounts, empty | `304:98123` |
| Connected accounts, populated | `306:58864` |
| Connected account, no charges | `304:98889` / `314:99100` |
| Test charge modal | `312:92005` |
| Identity verification modal | `314:98271` |
| Connected account, charged | `314:100161` |
| Payment detail | `312:90172` |
| Onboarding, step 1 | `295:53767` / `295:51969` (in context) |
| Onboarding, card in colour | `295:53835` |
| Onboarding callout, above the CTA | `295:54774` |
| Onboarding, step 2 | `295:51892` |

All icons, the Stripe card vector, and the colour wash are the **exported Figma assets** in `assets/` — nothing is hand-drawn. Colours and type in `styles.css` map 1:1 to the design tokens returned with the design context (`Text/Default #353A44`, `Background/Action Primary #675DFF`, `SF Pro Display` / `SF Pro Text`, etc.).

## What's here

**The demo opens on the onboarding dialog** — it rises over the sandbox home page on load. `Continue` moves to *How do you want to start?*, and `Go to Dashboard` hands over to the Setup guide. `Back` returns to step one with the entries intact. Deep links (`#connect`, `#connected`, …) skip the dialog, so any page stays directly reachable.

Motion lives in the interaction:

- **Onboarding modal** — scale + rise on open, dim backdrop, reverse on close.
- **Committing anything** — every CTA that commits works under a spinner for a beat before the modal leaves: *Save* on the business model, *Continue* on the test account, *Create test charge*, and *Go to Dashboard*. The label goes transparent rather than being replaced, so the button holds its size and nothing shifts. Dismissing the modal mid-spinner (`Esc`, backdrop) abandons the commit rather than letting it land after the fact.
- **Modal to page** — a commit holds the page white while its modal leaves, so the state you were just looking at never reads through behind it. The new state fades up from white once it's in place. Every modal-to-page transition uses the same path.
- **Landing in the sandbox** — the account tile in the top-left is the default grey through onboarding and only takes Furever's mark — the same green, the same white initial as the card — once `Go to Dashboard` lands you in the sandbox. Deep links skip onboarding, so they start already branded.
- **Live card preview** — the Stripe card on the right fills in as you type. The logo tile takes the first initial and flips to Furever green (`#27AE60`, the brand accent from [furever.dev](https://www.furever.dev/)), the name and URL chip go from placeholder grey to live, and the chip bumps on each keystroke.
- **Colour on commit** (Figma `295:53835`) — blurring the website field settles the card into its printed state: the panel takes its colour wash, the card takes its printed art, the tile shifts to the design's `#15BE53` and picks up two initials, and the URL becomes a translucent pill with a brand dot. Typing alone doesn't trigger it — it waits until you click out.
- **Choosing how to start** — the card carries over from step one untouched. All three options start unchecked and `Go to Dashboard` stays disabled until one is ticked. Ticking *Platform or marketplace payments* brands the card with the Connect mark (Figma `297:56887`), bottom-left, under the logo tile and opposite the Stripe wordmark.
- **Handing over to the dashboard** — `Go to Dashboard` runs as separate beats rather than one cut: after its spinner, the dialog leaves as the whole page fades in behind it — top nav, sidebar and content as one piece — and the Setup guide follows a beat later. The arrival is a straight opacity fade with no movement, so nothing drifts as it lands. The guide is held out of the scrim for the whole dialog, so it never reads through it. The arrival rides `.surface`, not `.content`: the nav sits outside `.content`, and `.content` already owns `route-in`, so overriding its animation would re-fire that animation on the way back out.
- **Creating the test account** — `Continue` in the test-account modal checks off *Create a test account* and swaps the Connected accounts empty state for the account table (status filters, the `Furever` row, pagination).
- **Creating the test charge** — `Create test charge` in the charge modal checks off *Create a test charge*, unlocks the last task, and fills in the account's Money movement section in place: payment tabs and the charge row. The API log below rewrites itself at the same time, so it reads as traffic that just happened.

## Driving it

| | |
| --- | --- |
| Go to Connect overview | Click **Choose your business model** in the Setup guide, or **Connect** in the nav |
| Open the account detail | Click the **Furever** row, or **Create a test charge** in the Setup guide |
| Open the charge modal | **Create test charge** in the account's Money movement panel |
| Open the payment detail | Click the `$500.00` row, or **Payments** in the account's left rail |
| Move within the account | **Activity** / **Payments** in its left rail |
| Leave the account detail | The back arrow in its header, or browser back |
| Back to home | Browser back, or **Home** in the nav |
| Collapse / expand the Setup guide | The diagonal-arrows icon in its header |
| Open a Setup guide group | Click its header — the open one closes |
| Finish the Connect track | **View your integration guide** — opens the Stripe docs in a new tab |
| Identity verification | **Verify your identity** under *Verify your business* — opens over any page |
| Reopen the onboarding dialog | Click **Verify your business** in the banner |
| Close the modal | `Esc`, or click the backdrop |

The Setup guide has two variants. Expanded shows the step list; collapsed is 80px tall — header, progress bar, and a `Next: …` line. It follows you to the Connect page in the collapsed form, and the `Next:` line tracks the first incomplete task.

Routing is hash-based (`#home` / `#connect` / `#connected` / `#account` / `#payment`), so browser back/forward walks the flow and you can deep-link any page. Switching pages also swaps the sidebar state (Connect expands to Overview / Connected Accounts) and the top-nav toolbar, both per the designs.

The account pages (`#account` / `#payment`) take the sidebar's place: a full-bleed account header with its own left rail, per the design. Both share that shell — only the main pane and the rail's current item change.

The Setup guide is an accordion — opening a group closes the others — and its progress bar moves proportionally across the six tasks (four under *Test Connect*, two under *Verify your business*). The design frames all draw the bar at its resting width; the proportional fill is a deliberate departure.

Two other deliberate departures on the Connect overview: the *Resources* heading is dropped so the card aligns with the top of the *Payments volume* label, and *Payments volume* carries *Account status*'s Bold rather than the design's Semibold, so the two section titles read as peers. Pages taller than the viewport now scroll, which the Connect overview needs once *Account status* is in place.

Completing a task implies every task before it, so the guide stays coherent no matter which order you drive it in.

Timing is not hardcoded — every transition derives from the `--speed` and `--ease` custom properties at the top of `styles.css`. Set `--speed: 0.25` to review the modal choreography in slow motion.

## Layout notes

Full-bleed: the design fills the viewport rather than sitting in a fixed frame.

- **Sidebar** holds 240px; the content column takes the remaining width.
- **Setup guide** is pinned 24px off the right edge and 24px above the workbench bar.
- **Colour wash** is bottom-anchored and stretches with the content column.
- **Modal** centres itself and caps at the design's 960 × 640.

`prefers-reduced-motion` is honoured throughout.

## Files

```
index.html      markup
styles.css      design tokens + layout + motion
app.js          routing, modals, live preview, task completion
assets/
  wave-wall.png     colour wash (blurred 80px @ 40%, per the design)
  preview-wash.png  onboarding panel wash, once the website is committed
  preview-card.png  printed card art for the same state
  receipt-card.png  scalloped receipt art for the charge modal
  icons/            exported Figma SVGs
```
