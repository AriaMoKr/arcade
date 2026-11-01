# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

arcade: a WebXR room behind one of the Hallway's doors, becoming an arcade of old computers, game
consoles and arcade machines (three.js 0.186, plain ES modules, no bundler or build step). It is the
room AriaMoKr/RoomTemplateEmpty makes (a checkout at `../RoomTemplateEmpty`): a floor, four walls, a
ceiling with lamps, a window in the right-hand wall onto common's afternoon sky, the doorway back to
the Hallway, and the control panel beside it; and so far four machines: the NES with Concentration
Room, on its stand against the right-hand wall past the window; across from it, on a desk against
the left-hand wall, the ZX Spectrum 48K with its BASIC; between them, against the far wall facing
the doorway, an arcade cabinet with an NES inside running Thwaite; and across from the window, on a
plinth against the left-hand wall, the Vectrex with Mine Storm. Its own are `public/js/config.js`
(7 × 9 m, violet walls, a dark ceiling, the magenta glow), the page's title and link-preview tags,
package.json, `main.js`'s opening comment, the pictures, these docs and the machines (below); the
rest is the template's code, which follows the Hallway (https://ariamokr.github.io/hallway/,
AriaMoKr/hallway, a checkout at `../hallway`) and outside (AriaMoKr/outside, `../outside`), said
so at the top of each such file. The machines (README, "The machines"), agreed with the user: MAME
0.289 built for the web (`public/mame/`, by `tools/build-mame.sh`) runs them, on the bare test page
`public/mame/test.html` and in the room, played on a screen (its picture over the view) or in VR (on
its own screen) with the keyboard, a phone's touch pad (a console's) or its keys on the screen (the
Spectrum's, on every screen), a gamepad, the VR controllers (and the Spectrum's keys on the panel
beside it) or the TV's remote. They came into the room a step at a time, each checked and pushed:
the NES, the Spectrum with its keyboard, then the arcade cabinet holding an NES running Thwaite, the
user's choice, as Breakout couldn't keep up on the web (README, "How fast"); Breakout's driver has
left MAME's build. Then the Vectrex, the user's choice of another machine, measured first. What
comes next is the user's to say. `public/` is the whole site. The user asked for the hallway to be left alone, so change `../hallway` only when
asked; its door to here comes in the Hallway's own round (README, "The Hallway's door", is the
entry to give it).

Published at https://ariamokr.github.io/arcade/ from `main` of AriaMoKr/arcade by
`.github/workflows/pages.yml`.

## Commands

```bash
npm install          # postinstall: common's tools/vendor.mjs copies what vendor.json lists into public/vendor/ (gitignored)
npm start            # tools/serve.mjs (common's) on config.js's port, 8102
npm test             # node --test "test/*.test.js", tsc's check among them (test/types.test.js)
npm run types        # tsc -p tsconfig.json, then -p tsconfig.strict.json, alone
npm run preview      # tools/preview.mjs: public/hallway-preview.jpg and public/social.jpg (headless Chrome)
npm run measure      # tools/measure-machines.mjs: each machine's speed on the test page, CPU ÷1/4/6 and emulated VR (headless Chrome)
sh tools/build-mame.sh   # MAME into public/mame/ (Emscripten; MSYS2 UCRT64 here), from a clone in ~/.cache/arcade/mame0289
```

Node 22 or newer; CI runs Node 24 (common's Pages workflow). It runs under MSYS2 UCRT64 here
(`MSYSTEM=UCRT64 /c/msys64/usr/bin/bash -lc 'cd /c/git/my/claude/arcade && …'`). `npm start` listens
on `localhost` only: open http://localhost:8102/, not 127.0.0.1 (or pass `--host 127.0.0.1`).

## Layout

- `config.js`: the one module a copy of the template changes (`ROOM`: id `arcade`, title,
  description, sign `Arcade`, url, size 7 × 9 × 3.2 m, colors, window `right`, skyYaw -π/2, port
  8102, glow `#d36fd8`, pieces, none here, each a `Piece`) and `hallwayDoor()`, the Hallway's door
  entry it implies.
  `index.html` and `package.json` repeat some of it; `test/config.test.js` keeps them the same.
  The `@satisfies` line above `ROOM` (the template's, outside it, so merges leave it be) checks the
  window's wall for tsc.
- `room.js`: pure (no three, tested in Node). The layout from the config (`layoutRoom`: the doorway,
  shrunk to fit the link's size, the window, the panel, the lamps, the spawn), `doorSpawn`,
  `clampWalk` (the walls, `MARGIN` from them; the doorway between its jambs to its back),
  `doorCrossed`, `standable`, `castRay` (the box's planes: door, panel with u/v, a piece with
  `piece` and u/v on its picture, window, wall, floor with `walkable`, ceiling), and the panel's
  buttons (`PANEL_BUTTONS`, `panelButtonAt`). What hangs on the walls: `PIECE` (frame, label),
  `PIECE_WALLS`, the layout's `pieces` (each where it hangs: `along`, its middle, the wall's normal
  `nx`/`nz`, its right `rx`/`rz`, its label), `pieceFront` (where to stand to look),
  `pieceSpawn` (back from its link) and `pieceProblems` (what is wrong, in words). Its types:
  `Layout` (layoutRoom's, which the rest take) and `RoomHit` (what castRay writes: common's `Hit`
  with `u`, `v` and `piece`).
  Coordinates: metres, the doorway's wall at z = 0, the room along -z, the doorway at x = 0, yaw 0
  faces -z, left is -x.
- `scene.js` builds the room as a few merged meshes with light baked into vertex colours (`bake.js`
  and `builder.js`, the hallway's): the lamps, the window's daylight and the doorway's glow. The
  window's glass is common's `sky.js` (`skyMaterial`, turned by `skyYaw`); the doorway is common's
  `portal.js`, showing the Hallway's view of this door from its views.json (`loadView`), else
  `textures.js` `previewFallback`. The pieces: their frames in the trim, a mesh per picture
  (`loadPictures`, its title from `pictureFallback` until loaded), and the labels as one mesh on
  `labelAtlas`. It hands out its light (`lit`, `lightColor`) for the stands. `textures.js`: canvas
  textures, seeded, nearly white so the config's colours are the room's.
- `controls.js`: a subclass of common's `Controls` (`common/controls.js`) for a `RoomHit`. Common's
  is the walking on every device: drag to look, keys through `tv.js` `keyOf` (a TV remote's come
  with no `code`; a key a page control has used, or one in a form control or a `data-own-keys`
  element, is the page's), click or tap (two fingers neither look nor tap), a gamepad
  (`gamepad.js`), and in VR the trigger, a grip (`onSqueeze`) and the sticks per `nav.js` (move
  smooth/teleport, turn snap/smooth); `walkTo(x, z, { face, then })` on the floor,
  `onDoor(how, hit)` on the doorway, `reduceMotion` (a walk jumps to its end), `setEyeLift`
  (seated), `moveSpeed`/`turnRate` (the vignette), `aimMiddle` and `useMiddle()` (a gamepad's A,
  the remote's OK); nothing allocated per frame. The room's: `layout` (set after `super()`),
  `castRay` and `clampWalk` (room.js's on it; the hit's `u`, `v` and `piece` through the `hit`
  option), the panel (`onPanel`, `hoverPanel`, `_press`) and the pieces (`onPiece`, `hoverPiece`,
  a reticle at 1.3) in `usable`, `use`, `_setHover` and `reticleScale`, then `super`'s; `walkInto`
  (`_startWalk` with `turn` false: facing the doorway from the first step) and `walkUpTo(i, done)`
  (a teleport in VR). The stands (stands.js's on it, `stands`; the hit's `stand`, an `ArcadeHit`):
  walked round (`clampStands`), a machine chosen (`onMachine(i, how)`, kind `machine`, a reticle at
  1.3) or its panel's button (`onStandButton(i, id)`, kind `stand-panel`, which buttons by
  `running(i)`), `hoverStand`/`hoverStandButton`, `walkUpToStand(i, done)` (looking down at the
  screen, `PLAY_PITCH`; in VR a teleport, `done` after its move), `stand()` (any move away:
  `onStand`, which stops the machine), `takeHand` (`onHand` first: the machine's in VR) and
  `resume()` (walking again after playing: no key held, A/B not pressed).
- `panel.js`: the control panel on the wall (outside's), redrawn only on a change. `overlay.js`: the
  card (the page's `<nav>`: the title, ← Hallway, the description, On the walls (a link to where
  each piece leads, `pieceHref`, else a button, `onPiece`), Start / Leave shared session, in
  a session its status and the visitor's name (`onName`), and Settings with the panel's choices as
  radio buttons and checkboxes), the hint (`#hint`, kept clear of the buttons and of `hintClear`,
  `_placeHint`), Wave, Copy invite link, Fullscreen, Enter VR, the aiming dot, and toasts
  (`role="status"`, polite). With `machines`, the card's Machines (a button per machine, `onMachine`;
  while it runs, its name, `machineNames`, and its buttons instead, machines.js's `machineButtons`
  each by its `buttonName` (`data-button` its id), `onMachineButton`; Sound, `onSound`; MAME's licence and source,
  `MAME_SOURCE`), `setPlaying(i, machine, focus)` (the card, the focus, to `focus` (a computer's
  picture, for its keys) or the first button, and the hints, `playHints`, a console's (its buttons
  by their names, its stick or pad) or a computer's, while one runs; `.machines.running`, and its list item `current` among `machineItems`,
  so that on a small screen the others leave the card), and the room's hints `MACHINE_HINTS`. Outside a
  TV, a hint the card would cover moves beside it when there is room (`_placeHint`, a phone held
  sideways). With
  `tv`, Wave is in the card and the invite is text there (`inviteText`), and the hints are the
  remote's (`tv`, `tv-card`). With pieces, the hints name the pictures (`PIECE_HINTS`, else an
  empty room's `HINTS`), and on a TV `setAimed(i)` (main.js's frame loop, the piece under the dot)
  makes the hint's OK say what OK does there, as music's does on the gramophone. On a TV, a faded
  hint is `aria-hidden` (out of TalkBack's reading order) but stays the canvas's description
  (`aria-describedby`). `presence.js`: the session's status and notices in words.
- `preview.js`: the two pictures (`renderPreview`, hung as the hallway hangs its doorways', and
  `renderSocial`, from `socialView`; with `also`, main.js's the stands' screens, from just inside
  the doorway looking down the room at the machines and the window, as two face each other near the
  far wall and no view takes them in with the doorway).
- `main.js`: the visit and the way back (common's `door.js`; `<id>.visit` in sessionStorage),
  arrival (at the doorway, or back from a piece's link, `?from=<piece id>` with no `back`, in front
  of it with the kept way back), `go(piece)` (fade, then `location.assign`: the way back, or the
  piece's link, `pieceUrl`, common's `hallLink`), `leftBy` (where `pageshow` arrives), fullscreen, VR (`sessiongranted`, noted as
  `window.roomXrGranted` by the inline script in index.html), the panel, the shared session
  (layersharedsession's `createTogether`, page `ROOM.id`), the accessibility settings (common's
  `access.js`: `applyAccess`, `setAccess`, re-read on `storage` and `pageshow`; the `reduce-motion`
  class on `<html>`), the TV (common's `tv.js`: `tvMode()`, the `tv` class on `<html>`, a `Remote`
  over the card and the canvas with `use` = `controls.useMiddle()`, `step` = `stepBack` (the room's
  own step back for Back: the machine running stops) and `first` = `play.first()` (Menu while one
  runs goes to its buttons); `TV_PITCH`, the view's rest a little down as the remote can't pitch;
  `answerApp`; no fullscreen or XR), the stands (`layoutStands`, `buildStands`) and `Play`, made
  before the `Remote` so its keys come first, and the frame loop, which neither walks nor draws the
  room while a machine plays on a screen (`play.onScreen`).
- `style.css`: the page over the view, and the 10-foot view under `html.tv` (the hallway's: 960 × 540
  at a pixel ratio of 2, 18 px text, 4 px focus rings, the TV's safe margins, the hint and toasts
  beside the card). While a machine plays on a screen, `html.playing`: `#play` over the view (its
  picture pixelated, a vector screen's smoothed, `.vector`; `.machine-host` for MAME's frame, 0 × 0), the card narrower and holding only
  the way back and the machine's buttons, and on a touch screen `.touch-pad` (two rows, one from
  561 px wide). A computer's keys on the screen, `.machine-keys` (a grid of `--cols`, sized by
  `--pitch`; `.tight` shows a key's own legend alone, `.roomy` the E-mode ones too), a key held or a
  shift down lit, and with a gamepad or the remote the current key ringed (`.nav .current`).
- The machines. `machines.js`: pure, `MACHINES` (each a `Machine`: MAME's driver, the files it
  reads, fetched into its file system, its screen in pixels and the aspect it is shown at, the
  visitor's keys and MAME's they press (a key or keys together: the Spectrum's Backspace is CAPS
  SHIFT and 0), never one of MAME's UI keys, tested; a console's `pad`, its controls by name, and
  where its buttons aren't a Nintendo's, `names` (the Vectrex's 1 to 4, in the card's order), with
  `stick` and a vector screen's `vector`; a computer's `keyboard`; the cabinet's `thwaite` is a
  Nintendo, `NES_KEYS` and `NES_PAD` as the NES's), `RESET` (MAME's soft reset, F3, the room's Reset
  button's alone), `machineById`, `codesOf`, `machineCodes` (every key of MAME's a machine takes),
  `buttonName(m, id)` (what a button is called on m, else `BUTTON_NAMES`, a Nintendo's), `machineButtons`
  (the card's while it runs), `mameArgs` (MAME's command line: `-video accel -renderdriver software`, as MAME's
  web build has no `soft` video; `-cfg_directory /cfg`, where a machine's settings go, among its files;
  `-nothrottle`, as the page paces it; `-sound js` at the page's
  sample rate). `emulator.js`: `Emulator`, one machine at a time in an iframe of its own
  (`public/mame/machine.html`), `step(now)` from the page's frame loop (`pace`: 60 steps a second at
  any display rate, at most 3 owed, so it keeps time down to 20 page frames a second),
  `key(code, down)` (a KeyboardEvent made in the frame, on MAME's canvas), `tap(code, steps)`
  (pressed, then let go after that many steps, 6 unless said), the page's one AudioContext (a master gain for Sound, a gain per machine; `prime()` from
  the gesture that chose a machine, else it starts at the next pointerdown or keydown, as a
  gamepad's press is no gesture), `stop()` (disconnects the sound, removes the frame).
  `mame-frame.js`, in the frame: holds MAME's `requestAnimationFrame` calls until the page steps it
  (`window.mame`), counts the pictures SDL puts on the canvas (`putImageData`), drops keys pressed
  in the frame itself, and gives MAME's js_sound.js the page's context (its watchdog's new
  ScriptProcessor each half second while the context waits is the same one, so none pile up).
  `mame-test.js`: the test page (`?m=`, `?view=3d`, `?xr=emulate`; `window.test` for
  `tools/measure-machines.mjs`). `public/mame/`: MAME's build (`arcade.js`, `arcade.wasm`, its
  licence `COPYING.txt` and `legal/`, with `emscripten.txt` for what Emscripten adds),
  `roms/<machine>/` and `software/<name>/`, each with a README giving its source and licence, and
  `cfg/`, the room's own settings for a machine in MAME (`vectrex.cfg`: the light pen's crosshair,
  which the arrows would otherwise show, off).
- `keyboards.js`: pure. `SPECTRUM`, a `Keyboard`: its forty keys in four rows, each a `Key` (MAME's
  `code`, its `label`, `short` where keys are small, and what it types in the other modes: `word`
  in K mode or with CAPS SHIFT, `symbol` with SYMBOL SHIFT, `ext` and `extSymbol` in E mode,
  checked against the ROM's own tables by `test/keyboards.test.js`), its `shifts`, and `chords`
  (what a gamepad's and a VR controller's buttons press: the shifts, ENTER, DELETE); `keyByCode`.
  `screen-keys.js`: `ScreenKeys`, a computer's keyboard on the screen (a button per key, pressed
  with the pointer as a key held, `onKey`; `place(r)` sets `--pitch` and `.tight`/`.roomy`;
  `move(dx, dy)` and `current` for a gamepad or the remote, `setNav` showing the ring; `setHeld`,
  `setLatched`, `reset`), and `keysIn` (where it goes, at the foot of the picture's space and in its
  middle: as wide as it goes up to 72 px a key, no higher than a third of the space, its rows taller
  from `ROOMY` on for E mode's legends, and never under 28 px).
- `stands.js`: pure, as room.js is. `STANDS` (each a `Stand`: its machine, its wall and `at` along
  it, its parts as boxes, its screen, its panel on the wall, a computer's `keys` on its top, an
  arcade cabinet's `marquee`, how far in front one plays, `about`), laid out in the wall's terms (`a` along, `y` up, `d` out;
  `wallTerms`), `layoutStands` (in the room's: the boxes, the footprint, the screen, `front`, where
  one plays), `castStands` (kind `machine` on a box, `stand-panel` with u/v on its panel, nearer
  than room.js's hit), `clampStands`, the panel's buttons (`panelLayout(m)`: a console's, Play
  stopped, Select, Start, Reset and Stop running; a computer's, 1024 × 640, Play stopped, Reset,
  Stop and its keys running, `key:<code>`, `PANEL_KEYS`; `standButtonAt`), and `standProblems`
  (tested: a machine there is, inside the room and off the doorway's wall, under the ceiling, clear
  of the window and of the others, its screen and marquee on a part's face, its panel behind none,
  and somewhere to stand in front). `stands-scene.js`: `buildStands` (the parts as one mesh in the
  room's baked light, a computer's keys drawn on its top, a cabinet's marquee lit (`marqueeArt`),
  each screen a mesh of its own (a vector screen's texture smoothed),
  `live(i, canvas)` while it runs in VR and `still(i, canvas)` once it stops, and `panels`, a
  `StandPanel` each, redrawn only on a change: a console's buttons by `buttonName` and how to play
  it in VR (`vrPad`); a computer's its keyboard, the legends fitted to
  each key (`legends`), the shifts down lit and the key pointed at).
- `play.js`: `Play`, the machines played (README, "Playing the Nintendo", "Typing on the
  Spectrum", "Playing the arcade cabinet", "Playing the Vectrex"). `choose(i)` (prime the sound, walk up, `start(i)`), `stop()` (the focus back to the
  machine's button in the card if it was on the picture or its keys), `stepBack()`, `button(i, id)`
  (the card's and the panel's, a computer's keys `key:<code>` among them), `first()` (the TV's
  Menu), `hand()` (VR: a console's left stick the pad, Y/X Start/Select, the right hand's A/B; a
  computer's left X/Y its shifts, the right's A/B ENTER and DELETE), and `frame()`, each frame:
  steps the emulator, copies a new picture to `canvas` (in VR, onto its screen), reads a gamepad,
  and presses what any way of playing holds (`keys`, `padHeld`, `screenHeld`, `handHeld`; a
  gamepad's buttons held at the start not until let go). A computer's keys: a shift pressed on the
  screen or a panel stays down for the next key (`latched`, `latchBits` for the panels; pressed
  again it comes up, the other one with it is E mode), a key pressed is held `TAP` steps
  (`#press`), and one let go `AFTER` more (`#letGoAfter`), so the machine sees the quickest press;
  the keyboard on the screen (`ScreenKeys`, made for the first computer played), where a gamepad
  (`#padKeys`: the D-pad or stick from key to key, again and again while held, A presses, X/Y the
  shifts, B DELETE, Start ENTER) and the TV's arrows and OK go. On a screen (`onScreen`), `#play`
  over the view: the picture at the machine's aspect beside the card or under it, clear of the
  buttons, the touch pad and the keys (`fitIn`, `#fit`, `keysIn`), MAME's frame kept at its own
  size; its keys from a capture listener on window that comes before the Remote's and walking's
  (on a TV, OK is A, or presses the key ringed; not while the remote is in the card, nor a form
  control's or a button's Enter or Space); Escape, LB/RB and Back stop it. On a touch screen a
  console's pad (`dpadDirections`, pointer capture, `DPAD`; its buttons named for the machine,
  `#namePad`), shown for a finger and hidden for the mouse.

## Conventions

- Client URLs stay relative (tested). Quest 3 is the target: few draw calls, light baked,
  `MeshBasicMaterial`, nothing allocated per frame.
- Types, with no build: `tsconfig.json` checks `public/js/` from its JSDoc (`allowJs`, `checkJs`,
  `noEmit`, bundler resolution: three's types from `@types/three`, common's and
  layersharedsession's from their `.d.ts`), and the page is served as it is, the import map
  unchanged. `test/types.test.js` runs tsc, so `npm test` and the Pages workflow do, and fails
  rather than skips without TypeScript. What TypeScript's DOM library leaves out (WebKit's
  fullscreen names, `window.__room`, `window.roomXrGranted`, and the machines' `window.mame`,
  `window.Module`, `window.test` and an iframe's `machineAudio`) is in `types/globals.d.ts`, never
  served. `strict` comes a file at a time: `tsconfig.strict.json` (it, with `strict` on) includes
  only the files that pass it, `config.js`, `presence.js`, `room.js`, `controls.js`, `stands.js`,
  `machines.js`, `keyboards.js`, `screen-keys.js`, `emulator.js` and `mame-frame.js` so far, and
  `test/types.test.js` runs it too. A
  file joins its `include` when a change makes it pass; what an included file imports is checked
  strictly with it, which keeps `play.js` and `stands-scene.js` out while `overlay.js` and
  `builder.js` don't pass. The rest has a few hundred errors with it, mostly untyped parameters and
  values that may be null (a canvas's 2D context). `tools/` and `test/` wait for `@types/node`.
- Scripted testing: `window.__room` (THREE, renderer, scene, camera, rig, room, layout, stands (the
  laid-out stands), play (`Play`: `at`, `machine`, `emulator` with its `state` and `held`, `canvas`,
  `frames`, `onScreen`, `screenKeys`, `latched`), controls, overlay, fade, vignette, xrDevice, go, enterVR, together, remote,
  tv, way, visit, setAccess, access, `preview()`, `social()`, `tick(dt, n)`, `ready`, true once the
  pieces' pictures have loaded or failed). A hidden browser pane gets no animation frames: drive it
  with `tick()`. XR frames under `?xr=emulate` need frames too; headless Chrome (below) has them. A
  machine runs only on frames, so check it in headless Chrome (common's `launchChrome`), with keys
  sent by CDP's `Input.dispatchKeyEvent` (the page's own capture listener, as a visitor's).
- Headless Chrome is common's `tools/chrome.mjs` (`launchChrome`): it writes the fresh profile's
  `Local State` first, so Windows sees no failed logon. Start Chrome for a tool through it, never by
  hand on a new profile.
- Accessibility, as the other sites pass it: every 3D control also on the page, 2 px focus rings,
  targets at least 24 px, text over the view at 4.5:1 (the card and pills nearly opaque), the card
  scrolling at 320×568 and 667×375, state shown under forced colours, and less motion stilling the
  page's transitions. Check with axe (wcag2a/aa, wcag21a/aa, wcag22aa, best-practice) at a desktop
  size and at 320×568, and with `?tv=emulate` at 960×540, with a machine running and stopped.
  `wcag21a` holds Label in Name (`label-content-name-mismatch`): a control is named by what it
  shows, so no `aria-label` over a key's legend, which where keys are small is its short one.
- The TV (README, "On a TV"; common's README, "The TV app"): test with `?tv=emulate` and real key
  presses (OK is Enter with no `code`; `hallwayTV.menu()` / `.back()` for Menu and Back; Escape is
  Back in the card). On the TV, HallwayApp's `tools/tv-check.mjs --url <url>` needs its debug build
  (a localhost URL goes over adb reverse); the empty room holds 60 fps at 1080p at a pixel ratio of
  2, the budget a room's contents can spend. Other sessions may use the same TV: don't restart its
  app under them.
- Shared packages, pinned by tag in package.json: AriaMoKr/common (`v0.7.1`: the door contract,
  nav, access with the vignette, fade, gamepad, portal, sky, tv, controls, and the tools
  `serve.mjs`, `vendor.mjs`, `chrome.mjs`, and the Pages workflow) and AriaMoKr/layersharedsession
  (`v0.3.0`). Change them there, then move the tag here and `npm install`.
- `.claude/launch.json`: `room` (8102) and `hallway` (`../hallway/public` on 8088).
- The template's fixes come by merge: the remote `template` (AriaMoKr/RoomTemplateEmpty, push
  disabled), whose history joins this one at `df35b83`, which the first commit copies (README,
  "Made from RoomTemplateEmpty", says what a merge keeps).
- GitHub: the user runs any `gh` command (repository settings, Pages, the social preview by hand).
  Don't run gh; write the command out and ask. Git itself goes over the `github-custom-remote` SSH
  alias, as `origin` does.
- What runs on the machines is only what its licence lets be served from Pages (public domain,
  freely licensed, homebrew whose authors allow it, or a ROM whose owner lets it be passed on, as
  Amstrad does the Spectrum's with emulators and Smith Engineering the Vectrex's, never for
  profit), BIOS and system ROMs included, each listed in the
  README with its licence. MAME is GPL-2.0-or-later: its licence and notices are served beside it
  (`COPYING.txt`, `legal/`), and the README, the card and the test page link its source at the tag.
  What its build links goes under GPL-2.0 with it (FreeType under its GPL option, not the FTL). A
  GPL game is served with its source beside it (Thwaite's zip in `software/thwaite/`, as GPLv3
  §6(d) allows), unless its licence lets exact copies go without (Concentration Room's).
- MAME's build is committed, never edited: change `tools/build-mame.sh` (its tag, `DRIVERS`) and
  build again; it passes `REGENIE=1`, as MAME's makefile misses a change of `SOURCES` and would build
  the drivers it was first given. Its Windows workarounds (MSYS make, not emmake's mingw32-make; `CLANG_VERSION`; emar
  through a response file; no `-lGL`; wasm-opt on one thread) are said where they are, in the
  script.
