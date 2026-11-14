# GO/NO-GO: The Space Mission Design Game

> Every choice has a cost. Can your team still launch?

Prototype for the **NASA Space Apps Challenge 2026: Space Mission Design Game**.
Players design a complete space mission (objective → requirements → instruments → orbit → spacecraft → launch → ground segment), call a Go/No-Go poll, fly the mission through random events, and get a report that explains *why* the mission succeeded or failed.

## Run it

No build step and no dependencies: it is plain HTML, CSS and JavaScript modules.

```bash
python serve.py
```

Then open http://localhost:5173. (`serve.py` is a tiny static server with caching disabled. Any static server works, but ES modules do not load from `file://`.)

Engine tests (Node 18+):

```bash
node tests/engine.test.js
```

## Deploy (public link for judges)

Upload this folder to any static host: GitHub Pages, Netlify, Vercel or Cloudflare Pages. There is no build command; the output directory is the folder itself. Then:

1. Open the public URL in a private window to confirm it works without a login.
2. Optional, but recommended by the Space Apps submission guide: request a FortiGuard Web Filter classification for the domain.

## What's in the game

| Feature | Where |
|---|---|
| 4 scenarios × 2–3 mission priorities (priorities set the requirements) | `src/data/scenarios.js` |
| 4 roles = NASA's 4 mission segments (Science/User, Orbit & Launch, Spacecraft, Ground & Comms) | `src/ui/screens/design.js` |
| ~60 components: buses, 17 instruments, arrays, batteries, ADCS, propulsion, radios, networks, ops teams, launchers, 7 orbits | `src/data/catalog.js` |
| Live budgets for mass, power, budget, data, comms, time and delta-v, with hover previews | `src/engine/mission.js` |
| Explained issues ("Flight Director's notes") with codex links | `src/engine/mission.js` |
| Go/No-Go poll (solo override, or a team vote) | `src/ui/screens/gonogo.js` |
| Flight simulation with seeded random events and decisions | `src/engine/sim.js`, `src/data/events.js` |
| Scoring, post-mission analysis, real NASA imagery, analog missions, local leaderboard | `src/engine/score.js`, `src/ui/screens/report.js` |
| Mission Codex: 29 concepts in plain language | `src/data/codex.js` |
| Difficulty: Cadet / Engineer / Flight Director | `src/data/scenarios.js` (`DIFFICULTIES`) |
| Shareable design links (`#mission=...`) | `src/state.js` |
| English / Bahasa Indonesia toggle (EN default, saved per browser) | `src/i18n.js`, `src/data/i18n-id.js`, `idn` fields in scenarios, `CODEX_ID` |
| Synthesized sound: countdown beeps, liftoff rumble, alert klaxon, Apollo "Quindar" tones, radio static (mute button) | `src/ui/audio.js` |
| Beginner help: auto guided tour on first visit, "Start here" badge, plain-language section subtitles, Cadet "Suggested" options | `src/ui/tour.js`, `guide` designs in scenarios |

### Bahasa Indonesia

The submission language is English, so English is the default. The EN | ID switch in the top bar translates everything: screens, scenarios, component descriptions, Flight Director notes, events, the Codex and the report. Strings live next to their English version as `tx('English', 'Indonesia')`; catalog text lives in `src/data/i18n-id.js`. The language is locked during a flight and can be changed again on the report.

### Physics models (simplified, explainable)

Kepler's third law (period), cylindrical-shadow eclipse geometry, solar-array sizing with battery recharge (SMAD), Tsiolkovsky rocket equation, a Li-ion cycle-life curve, swath/revisit geometry, and inverse-square link scaling. Component numbers are rounded game values that keep real-world proportions; they are not engineering data.

### Tuning the balance

* Science targets per priority: `target` in `src/data/scenarios.js`.
* Budgets and deadlines: `budget` and `deadline` per scenario.
* Scoring weights and grade thresholds: `src/engine/score.js`.
* After any change, run `node tests/engine.test.js`.

## NASA data and resources used

**Shaped the design** (from the challenge resources list):

* *Design and Develop Science Missions* (NASA): the four mission segments → the four player roles.
* *Concept Maturity Levels* (NASA JPL): objective → requirements → trade studies → point design → review.
* *Mission Design Lab* (NASA GSFC): subsystem breakdown and the live trade-study approach.
* *General Mission Analysis Tool (GMAT)*: the same Kepler physics for periods and eclipses (simplified).
* *CubeSat 101* (NASA CSLI): CubeSat buses, rideshares and small-mission risks.
* *A Learning Game About Telescopes* (NASA Webb): matching objectives to instruments, and showing similar real missions.
* *NASA Mission Viz* and the 2023 VR challenge: inspiration for the orbit views.

**Shown live in the game:**

* NASA Blue Marble (Earth globe texture) via NASA GIBS
* NASA Aqua MODIS Corrected Reflectance (East Java, 20 July 2023) via GIBS / Worldview
* NASA Black Marble (Suomi NPP VIIRS night lights) via GIBS
* NASA SDO AIA 193 Å "latest" image (live Sun)
* NASA SVS CGI Moon Kit color map (from LRO LROC), also used as the Moon texture

**Partner agencies referenced:** ISRO (PSLV, NISAR, Aditya-L1), ESA (SOHO, SMART-1, Ariane 6), JAXA (H3), KASA (Danuri/KPLO with NASA ShadowCam), Indonesia (LAPAN-A2, SATRIA-1).

## Use of AI (SI disclosure)

Parts of this prototype's code and in-game text, including the Bahasa Indonesia translation, were drafted with an AI coding assistant and then reviewed and tested by the team. The game contains no AI-generated images, audio or video (all sounds are synthesized by code at runtime). **Team: review this statement before submission and update it to match exactly how you used AI.**

No NASA logos, insignia or mission identifiers are used. This is not an official NASA product.

## Project structure

```
index.html, styles.css      app shell and visual design
serve.py                    no-cache dev server
src/main.js                 state, routing, events
src/state.js                share links, leaderboard
src/i18n.js                 English / Bahasa Indonesia helpers
src/engine/                 physics, mission model, simulation, scoring (pure JS, testable in Node)
src/data/                   catalog, scenarios, events, codex
src/ui/                     screens, components, canvas renderer, overlays
tests/engine.test.js        engine smoke tests
```
