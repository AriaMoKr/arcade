// The page around the 3D view (not shown in a headset), as outside's and the hallway's. The card is
// the page's <nav>: the room's name, the way back to the hallway as a real link (for keyboards,
// screen readers and browsers without WebGL), its description, what hangs on its walls (each one
// that leads somewhere a link there, the rest buttons that walk up to them), the machines (each a
// button that walks up to it and plays it, and while it runs its own buttons, Reset and Stop; Sound;
// MAME's licence and source), Start / Leave shared session (and,
// in one, how it's going), and Settings, the control panel's choices: motion (common/access.js, for
// a screen too), how to move and turn in VR, the comfort vignette and seated mode. The view is the
// page's <main>, with a hint on how to move (or to play the machine running), the Wave, Copy invite
// link, Fullscreen and Enter VR buttons, the dot a gamepad aims with, and short messages, said
// politely. So everything the room offers in 3D is a control here too: the doorway is the link, the
// panel's buttons are Settings, the session's button and Enter VR, the pieces on the walls are On
// the walls, and a machine and the panel beside it are its buttons in Machines. In a shared session the card also has the visitor's name.
// On a TV (common's tv.js) the remote reaches only the card, so Wave is in it, and there is nothing
// to copy a link to: the invite link is shown to type on another device. Fullscreen and Enter VR
// are not offered there (main.js).
import { keyByCode } from './keyboards.js';
import { buttonName, machineButtons, oneButton } from './machines.js';

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) e.append(c);
  return e;
}

// tv: walking with a remote, and a line for TalkBack, which keeps the arrows (the view is described
// by the hint); tv-card: in the card. The hallway's.
const HINTS = {
  touch: 'Drag to look · tap the floor to walk there · tap the doorway to go back',
  mouse: 'Drag to look around · WASD or arrows to walk · click the floor to walk there',
  gamepad: 'Right stick to look · left stick to walk · A on the doorway goes back',
  tv: 'Arrows: walk and turn · OK: the doorway or the panel in the middle · Menu or hold Back: settings and the shared session\nWith TalkBack: channel up and down walk, rewind and fast-forward turn',
  'tv-card': 'Up, down: from control to control · left, right: a choice · OK: choose · Back: walk again',
};
// With something on the walls (config.js's pieces), each names the pictures too.
const PIECE_HINTS = {
  ...HINTS,
  touch: 'Drag to look · tap the floor to walk there, or a picture · tap the doorway to go back',
  mouse: 'Drag to look around · WASD or arrows to walk · click the floor to walk there, or a picture',
  gamepad: 'Right stick to look · left stick to walk · A on a picture goes to it, on the doorway goes back',
  tv: 'Arrows: walk and turn · OK: the doorway, a picture or the panel in the middle · Menu or hold Back: settings and the shared session\nWith TalkBack: channel up and down walk, rewind and fast-forward turn',
};
// With machines on their stands (stands.js), each names them.
const MACHINE_HINTS = {
  ...HINTS,
  touch: 'Drag to look · tap the floor to walk there, or a machine to play it · tap the doorway to go back',
  mouse: 'Drag to look around · WASD or arrows to walk · click the floor to walk there, or a machine to play it',
  gamepad: 'Right stick to look · left stick to walk · A on a machine plays it, on the doorway goes back',
  tv: 'Arrows: walk and turn · OK: the doorway, a machine or the panel in the middle · Menu or hold Back: the machines, settings and the shared session\nWith TalkBack: channel up and down walk, rewind and fast-forward turn',
};
/** Names in a list: "A, B and C". @param {string[]} names */
const list = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join(''));
/**
 * A machine running, on a screen (play.js): how to play it with what was used last, its buttons by
 * its own names for them (machines.js buttonName: the Vectrex's numbered, the Atari 2600's its
 * switches' and its Fire, a gamepad's A or B where they are one button); a computer's, how to type
 * on it, on its keys under its picture too (screen-keys.js). On a TV the card (Menu) has what the
 * remote's keys don't.
 * @param {import('./machines.js').Machine} m
 */
const playHints = (m) => {
  const kb = m.keyboard;
  if (!kb) {
    const name = (/** @type {string} */ id) => buttonName(m, id);
    const way = m.stick ? 'stick' : 'pad';
    const menu = machineButtons(m, true).filter((id) => id !== 'a').map(name);
    const ab = oneButton(m) ? `A or B: its ${name('a')}` : `A, B: its ${name('a')} and ${name('b')}`;
    return {
      mouse: `${m.help} · Esc: stop`,
      touch: `Play with its ${way} and buttons on the screen · Stop is in the card`,
      gamepad: `D-pad or left stick: its ${way} · ${ab} · Start, Back: its ${name('start')} and ${name('select')} · LB or RB: stop`,
      tv: `Arrows: its ${way} · OK: its ${name('a')} · Menu: ${list(menu)} · Back: stop`,
      'tv-card': 'Up, down: from button to button · OK: press it · Back: play again',
    };
  }
  const [one, other] = kb.shifts.map((code) => keyByCode(kb, code)?.label ?? code);
  return {
    mouse: `${m.help} · Esc: stop`,
    touch: `Type on its keys on the screen · ${one} and ${other} stay down for the next key · Stop is in the card`,
    gamepad: `D-pad or left stick: from key to key · A: press it · X, Y: ${one}, ${other} · B: DELETE · Start: ENTER · LB or RB: stop`,
    tv: 'Arrows: from key to key · OK: press it · Menu: Reset and Stop · Back: stop',
    'tv-card': 'Up, down: from button to button · OK: press it · Back: type again',
  };
};
/** Where MAME's source is, at the tag it was built from (tools/build-mame.sh). */
const MAME_SOURCE = 'https://github.com/mamedev/mame/tree/mame0289';

export class Overlay {
  /**
   * @param {{ title: string, description: string, pieces?: import('./config.js').Piece[] }} room config.js's ROOM
   * @param {{ url: string, label: string, title: string }} way the way back (common/door.js wayBack)
   * @param {object} [o]
   * @param {() => string} [o.href] the address the way back opens now (it carries the shared session)
   * @param {(i: number) => string} [o.pieceHref] the address piece i's link opens now (likewise)
   * @param {(i: number) => void} [o.onLeave] called when a link is followed: the way back's (-1), or piece i's
   * @param {boolean} [o.tv] the TV app's page (common's tv.js tvMode)
   * @param {{ title: string, about: string, buttons: { id: string, name: string }[] }[]} [o.machines] the machines on their stands
   *   (stands.js), each one's name, what runs on it, and its buttons while it runs (machines.js
   *   machineButtons), each by play.js's name for it and its own (buttonName)
   */
  constructor(room, way, { href = () => way.url, pieceHref = () => '#', onLeave = () => {}, tv = false, machines = [] } = {}) {
    this.root = document.getElementById('overlay');
    this.view = document.getElementById('view-overlay');
    this.tv = tv;
    this.href = href;
    this.pieceHref = pieceHref;
    this.back = el('a', { class: 'way-back', href: href(), title: way.title }, way.label);
    this.back.addEventListener('click', () => onLeave(-1));
    /** (i) a piece without a link chosen in On the walls: walk up to it. @type {(i: number) => void} */
    this.onPiece = () => {};
    // What hangs on the walls, with what each is: a link where it leads, else a button.
    /** @type {[number, HTMLAnchorElement][]} */
    this.pieceLinks = [];
    const pieces = room.pieces ?? [];
    this.walls = pieces.length ? el('section', { class: 'walls', 'aria-labelledby': 'walls-heading' },
      el('h2', { id: 'walls-heading' }, 'On the walls'),
      el('ul', {}, ...pieces.map((p, i) => {
        const about = `piece-${p.id}-about`;
        let use;
        if (p.link) {
          use = el('a', { class: 'piece', href: pieceHref(i), 'aria-describedby': about }, p.title);
          use.addEventListener('click', () => onLeave(i));
          this.pieceLinks.push([i, use]);
        } else {
          use = el('button', { class: 'piece', type: 'button', title: 'Walk up to it', 'aria-describedby': about }, p.title);
          use.addEventListener('click', () => this.onPiece(i));
        }
        return el('li', {}, use, el('span', { class: 'about', id: about }, p.description));
      }))) : null;
    // The machines: a button for each, which walks up to it and starts it, and while it runs, in its
    // place, its buttons (as on the panel beside it on the wall, but a computer's keys, which are under
    // its picture; on a TV a console's A and B too).
    /** (i) machine i chosen in the card. @type {(i: number) => void} */
    this.onMachine = () => {};
    /** (i, id) a button of machine i, running, by play.js's name for it (machines.js machineButtons). @type {(i: number, id: string) => void} */
    this.onMachineButton = () => {};
    /** (on) Sound, for every machine. @type {(on: boolean) => void} */
    this.onSound = () => {};
    /** @type {HTMLButtonElement[]} */
    this.machineButtons = [];
    /** The buttons of each machine, while it runs. @type {HTMLElement[]} */
    this.machineControls = [];
    /** Each one's name over them, while it runs. @type {HTMLElement[]} */
    this.machineNames = [];
    /** Each one's place in the list: `current` while it runs (on a small screen the others leave, style.css). @type {HTMLElement[]} */
    this.machineItems = [];
    this.sound = el('input', { type: 'checkbox', name: 'sound' });
    this.sound.checked = true;
    this.sound.addEventListener('change', () => this.onSound(this.sound.checked));
    this.machines = machines.length ? el('section', { class: 'machines', 'aria-labelledby': 'machines-heading' },
      el('h2', { id: 'machines-heading' }, 'Machines'),
      el('ul', {}, ...machines.map((m, i) => {
        const about = `machine-${i}-about`;
        const play = el('button', { class: 'piece machine', type: 'button', title: 'Walk up to it and play it', 'aria-describedby': about }, m.title);
        play.addEventListener('click', () => this.onMachine(i));
        const controls = el('div', { class: 'actions machine-controls', role: 'group', 'aria-label': `The ${m.title}'s buttons`, hidden: '' }, ...m.buttons.map(({ id, name }) => {
          const b = el('button', { class: 'chip', type: 'button', 'data-button': id }, name);
          b.addEventListener('click', () => this.onMachineButton(i, id));
          return b;
        }));
        const name = el('span', { class: 'machine-name', hidden: '' }, m.title);
        this.machineButtons.push(play);
        this.machineControls.push(controls);
        this.machineNames.push(name);
        const item = el('li', {}, play, name, el('span', { class: 'about', id: about }, m.about), controls);
        this.machineItems.push(item);
        return item;
      })),
      this.soundLabel = el('label', { class: 'sound' }, this.sound, 'Sound'),
      el('p', { class: 'mame-note' }, 'They run in MAME 0.289: ', el('a', { href: 'mame/COPYING.txt' }, 'its licence'), ', ', el('a', { href: MAME_SOURCE }, 'its source'), '.')) : null;
    this.playing = -1; // the machine running (setPlaying)
    this.onSession = () => {};
    /** (key, value) a movement choice for VR: 'move' 'smooth' or 'teleport', 'turn' 'snap' or 'smooth'. @type {(key: string, value: string) => void} */
    this.onNav = () => {};
    /** (change) accessibility settings changed (common/access.js), such as { motion: 'reduce' } or { seated: true }. @type {(change: Partial<import('common/access.js').Access>) => void} */
    this.onAccess = () => {};
    this.onWave = () => {};
    /** (name) when the visitor renames themself; returns the name kept. */
    this.onName = (name) => name;
    this.session = el('button', { class: 'chip', type: 'button' }, 'Start shared session');
    this.session.addEventListener('click', () => this.onSession());
    // Wave: a pill at the foot of the view, or on a TV in the card, beside the session's button.
    this.wave = el('button', { class: tv ? 'chip' : 'pill', type: 'button', hidden: '' }, 'Wave');
    this.wave.addEventListener('click', () => this.onWave());
    this.settingsToggle = el('button', { class: 'chip', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'settings' }, 'Settings');
    this.choices = new Map(); // 'move:smooth' → its radio button, 'vignette' → its checkbox
    const choice = (key, legend, options, apply) => el('fieldset', {}, el('legend', {}, legend), ...options.map(([value, label]) => {
      const input = el('input', { type: 'radio', name: key, value });
      input.addEventListener('change', () => {
        if (input.checked) apply(key, value);
      });
      this.choices.set(`${key}:${value}`, input);
      return el('label', {}, input, label);
    }));
    const toggle = (key, label) => {
      const input = el('input', { type: 'checkbox', name: key });
      input.addEventListener('change', () => this.onAccess({ [key]: input.checked }));
      this.choices.set(key, input);
      return el('label', {}, input, label);
    };
    this.settings = el('div', { class: 'settings', id: 'settings', hidden: '' },
      choice('motion', 'Motion', [['system', 'System'], ['reduce', 'Less'], ['full', 'Full']], (key, value) => this.onAccess({ [key]: value })),
      choice('move', 'Move in VR', [['smooth', 'Smooth'], ['teleport', 'Teleport']], (key, value) => this.onNav(key, value)),
      choice('turn', 'Turn in VR', [['snap', 'Snap'], ['smooth', 'Smooth']], (key, value) => this.onNav(key, value)),
      el('fieldset', {}, el('legend', {}, 'In VR'), toggle('vignette', 'Comfort vignette'), toggle('seated', 'Seated mode')));
    this.settingsToggle.addEventListener('click', () => {
      const open = this.settings.hidden;
      this.settings.hidden = !open;
      this.settingsToggle.setAttribute('aria-expanded', String(open));
    });
    // In a shared session: how it's going, the visitor's name in it, and on a TV the invite link.
    this.status = el('p', { class: 'together-status' });
    this.myName = el('input', { class: 'my-name', type: 'text', maxlength: '24', autocomplete: 'off', spellcheck: 'false' });
    this.myName.addEventListener('change', () => {
      this.myName.value = this.onName(this.myName.value);
    });
    this.myName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.myName.blur();
    });
    this.inviteText = tv ? el('p', { class: 'invite-text' }) : null;
    this.together = el('div', { class: 'together', hidden: '' },
      this.status,
      el('label', { class: 'me' }, el('span', {}, 'Your name'), this.myName),
      ...(this.inviteText ? [this.inviteText] : []));
    this.card = el('nav', { class: 'card', 'aria-label': room.title },
      el('header', {}, el('h1', { class: 'brand' }, room.title), this.back),
      el('p', { class: 'tagline' }, room.description),
      ...(this.walls ? [this.walls] : []),
      ...(this.machines ? [this.machines] : []),
      this.inRoom = el('section', { class: 'in-room', 'aria-label': 'In the room' },
        el('div', { class: 'actions' }, this.session, ...(tv ? [this.wave] : []), this.settingsToggle),
        this.together,
        this.settings));
    this.hint = el('p', { class: 'hint', id: 'hint' });
    this.fullscreen = el('button', { class: 'pill', type: 'button', hidden: '' }, 'Fullscreen');
    this.vr = el('button', { class: 'pill vr', type: 'button', hidden: '' }, 'Enter VR');
    this.invite = el('button', { class: 'pill invite', type: 'button', hidden: '' }, 'Copy invite link');
    this.invite.addEventListener('click', () => this._copyInvite());
    this._inviteLink = '';
    this.buttons = el('div', { class: 'buttons' }, ...(tv ? [] : [this.wave]), this.invite, this.fullscreen, this.vr);
    this.dot = el('div', { class: 'aim', hidden: '', 'aria-hidden': 'true' });
    this.toasts = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    this.root.append(this.card);
    this.view.append(this.hint, this.buttons, this.dot, this.toasts);
    // The card stops above the buttons, however many rows they wrap to (style.css, --buttons).
    new ResizeObserver(() => {
      document.documentElement.style.setProperty('--buttons', `${this.buttons.offsetHeight}px`);
      this._placeHint();
    }).observe(this.buttons);
    /** @type {'mouse'|'touch'|'gamepad'|'tv'|'tv-card'} */
    this._how = 'mouse';
    this.pieces = pieces;
    this._roomHints = pieces.length ? PIECE_HINTS : machines.length ? MACHINE_HINTS : HINTS;
    this._hints = this._roomHints;
    this._aimed = -1; // the piece a TV's dot is on (setAimed)
    this._aimShown = false; // the hint shown again for it, to fade when the dot leaves
    /** What else the hint keeps clear of (play.js: a machine's pad on a touch screen). @type {Element[]} */
    this.hintClear = [];
    addEventListener('resize', () => this._placeHint());
  }

  /** @param {'mouse'|'touch'|'gamepad'|'tv'|'tv-card'} how */
  setHint(how, seconds = 12) {
    this._how = how;
    this._aimShown = false;
    this.hint.classList.remove('gone');
    this.hint.removeAttribute('aria-hidden');
    this.hint.textContent = this._hintText();
    this._placeHint();
    clearTimeout(this._hintTimer);
    if (seconds) this._hintTimer = setTimeout(() => this.hideHint(), seconds * 1000);
  }

  /** The hint's words: on a TV with the dot on a piece, its OK says what OK does there, as music's does on the gramophone. */
  _hintText() {
    const text = this._hints[this._how];
    if (this._how !== 'tv' || this._aimed < 0) return text;
    const p = this.pieces[this._aimed];
    return text.replace(/OK: [^·]*? · /, `OK: ${p.link ? p.title : `walk up to ${p.title}`} · `);
  }

  /**
   * On a TV, walking: the piece the dot is on (its index in config.js's pieces), else -1. The hint
   * says what OK does there ("OK: <its title>" for one with a link), shown again if it had faded,
   * and faded again when the dot leaves.
   */
  setAimed(i) {
    if (i === this._aimed) return;
    this._aimed = i;
    if (this._how !== 'tv') return;
    if (i >= 0) {
      const faded = this._aimShown || this.hint.classList.contains('gone');
      this.setHint('tv');
      this._aimShown = faded;
      return;
    }
    this.hint.textContent = this._hintText();
    this._placeHint();
    if (this._aimShown) {
      clearTimeout(this._hintTimer);
      this.hideHint();
    }
  }

  /**
   * Keeps the hint clear of the buttons at the foot: in the middle where it fits beside them, else
   * in the space beside them (wrapping within it), else above them (a narrow screen). Outside's.
   * Then, in the middle again, above what else it would cover (hintClear), and beside the card if
   * it would cover that there (a phone on its side).
   */
  _placeHint() {
    const s = this.hint.style;
    s.left = s.bottom = s.maxWidth = '';
    let left = Infinity, top = Infinity;
    for (const b of this.buttons.children) {
      if (b.hidden) continue;
      const r = b.getBoundingClientRect();
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
    }
    let h = this.hint.getBoundingClientRect();
    const gap = 12, margin = 16;
    if (left !== Infinity && h.right > left - gap && h.bottom > top - 4) {
      const room = left - gap - margin;
      if (room >= 260) {
        s.left = `${margin + room / 2}px`;
        s.maxWidth = `${room}px`;
      } else s.bottom = `${innerHeight - top + 8}px`;
      h = this.hint.getBoundingClientRect();
    }
    let over = Infinity;
    for (const e of this.hintClear) {
      const r = e.getBoundingClientRect();
      if (r.width && r.left < h.right && r.right > h.left && r.top < h.bottom && r.bottom > h.top) over = Math.min(over, r.top);
    }
    if (over === Infinity) return;
    s.left = s.maxWidth = '';
    s.bottom = `${innerHeight - over + 8}px`;
    if (this.tv) return; // there beside the card already (style.css)
    const c = this.card.getBoundingClientRect();
    h = this.hint.getBoundingClientRect();
    const room = innerWidth - c.right - gap - margin;
    if (c.right > h.left && c.left < h.right && c.bottom > h.top && c.top < h.bottom && room >= 200) {
      s.left = `${c.right + gap + room / 2}px`;
      s.maxWidth = `${room}px`;
    }
  }

  /**
   * The hint fades. On a TV it also leaves the reading order, or TalkBack would stop on an empty
   * spot; it stays the view's description (main.js: aria-describedby), which a hidden element
   * named that way still gives.
   */
  hideHint() {
    this.hint.classList.add('gone');
    if (this.tv) this.hint.setAttribute('aria-hidden', 'true');
  }

  /**
   * Machine i runs (play.js), or none (-1): in Machines, its buttons in place of the one that
   * started it (the focus with them, if it was on that one, or to `focus`, and back again), and the
   * hint says how to play it (machine: machines.js's), or again how to walk.
   * @param {number} i
   * @param {import('./machines.js').Machine | null} [machine]
   * @param {HTMLElement | null} [focus] where the focus goes from the button that started it, if not
   *   to its buttons: a computer's screen, or the Atari 2600's, so that Enter and Space are the
   *   machine's
   */
  setPlaying(i, machine = null, focus = null) {
    const was = this.playing;
    if (i === was) return;
    const focused = document.activeElement;
    this.playing = i;
    this.machines?.classList.toggle('running', i >= 0);
    this.machineButtons.forEach((b, j) => {
      b.hidden = j === i;
    });
    this.machineControls.forEach((g, j) => {
      g.hidden = j !== i;
    });
    this.machineNames.forEach((n, j) => {
      n.hidden = j !== i;
    });
    this.machineItems.forEach((item, j) => item.classList.toggle('current', j === i));
    if (i >= 0 && focused === this.machineButtons[i]) (focus ?? /** @type {HTMLElement | undefined} */ (this.machineControls[i].children[0]))?.focus?.();
    else if (was >= 0 && focused && this.machineControls[was]?.contains?.(focused)) this.machineButtons[was]?.focus?.();
    this._scrollToButtons();
    this._hints = i >= 0 && machine ? playHints(machine) : this._roomHints;
    this.setHint(this._how);
  }

  /**
   * While one runs, its buttons in the card's view where the card scrolls (a low phone on its side,
   * or one with the browser's bar showing, the card ending above the pad: style.css): all of them
   * where they fit, else down to the last, Stop.
   */
  _scrollToButtons() {
    const g = this.machineControls[this.playing];
    if (!g || this.card.scrollHeight <= this.card.clientHeight) return;
    g.scrollIntoView?.({ block: 'nearest' });
    g.lastElementChild?.scrollIntoView?.({ block: 'nearest' });
  }

  /** In a shared session (or paused in one, going through the door), or not: its button leaves, or starts one. */
  setSession(on) {
    const label = on ? 'Leave shared session' : 'Start shared session';
    if (this.session.textContent !== label) this.session.textContent = label;
  }

  /** The settings as they are now: the VR movement choices (common/nav.js) and the accessibility settings (common/access.js). */
  setChoices({ move, turn }, { motion, vignette, seated }) {
    const on = new Set([`move:${move}`, `turn:${turn}`, `motion:${motion}`]);
    if (vignette) on.add('vignette');
    if (seated) on.add('seated');
    for (const [id, input] of this.choices) if (input.checked !== on.has(id)) input.checked = on.has(id);
  }

  /**
   * In a shared session (together.js active), or not: how it's going (presence.js statusText), the
   * visitor's name (together.js self), and the Wave button.
   */
  setTogether(active, status = '', self = null) {
    this.wave.hidden = this.together.hidden = !active;
    const text = active ? `Together: ${status}` : '';
    if (this.status.textContent !== text) this.status.textContent = text;
    // Not while it is being typed in.
    if (self && document.activeElement !== this.myName && this.myName.value !== self.name) this.myName.value = self.name;
    this._placeHint();
  }

  /** The shared session's invite link (together.js), or '' when not in one: hides the button. On a TV, the link to type elsewhere. */
  setInvite(link) {
    this._inviteLink = link;
    if (this.inviteText) {
      if (link) this.inviteText.replaceChildren('To join from a phone or a computer, open ', el('span', { class: 'invite-link' }, link.replace(/^https?:\/\//, '')));
      return;
    }
    this.invite.hidden = !link;
    this._placeHint();
  }

  /** Works out the way back's link again, and the pieces' (they carry the shared session's room). */
  refreshLinks() {
    const href = this.href();
    if (this.back.getAttribute('href') !== href) this.back.setAttribute('href', href);
    for (const [i, a] of this.pieceLinks) {
      const h = this.pieceHref(i);
      if (a.getAttribute('href') !== h) a.setAttribute('href', h);
    }
  }

  showVR(onClick) {
    this.vr.hidden = false;
    this._placeHint();
    this.vr.addEventListener('click', onClick);
  }

  /** In VR, or not: the button's words. */
  setVR(on) {
    this.vr.textContent = on ? 'Exit VR' : 'Enter VR';
  }

  async _copyInvite() {
    const link = this._inviteLink;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.toast('Invite link copied: anyone who opens it joins you here');
    } catch {
      prompt('Copy this link to invite others:', link);
    }
  }

  showFullscreen(onClick) {
    this.fullscreen.hidden = false;
    this._placeHint();
    this.fullscreen.addEventListener('click', onClick);
  }

  setFullscreen(on) {
    this.fullscreen.textContent = on ? '✕ Exit fullscreen' : 'Fullscreen';
    this.fullscreen.classList.toggle('on', on);
    this._placeHint();
  }

  /** The dot in the middle of the view that a gamepad aims with; larger and filled on something A would use. */
  setAim(on, hover = false) {
    if (this.dot.hidden !== !on) this.dot.hidden = !on;
    if (this.dot.classList.contains('hover') !== hover) this.dot.classList.toggle('hover', hover);
  }

  toast(text, seconds = 3.5) {
    const t = el('div', { class: 'toast' }, text);
    this.toasts.append(t);
    setTimeout(() => t.remove(), seconds * 1000);
  }

  /** No 3D view: the way back is all there is, and where the pieces lead (the rest are just named). */
  noWebGL(message) {
    this.card.classList.add('alone');
    this.inRoom.remove();
    for (const b of this.walls?.querySelectorAll('button.piece') ?? []) b.replaceWith(el('span', { class: 'piece-title' }, b.textContent));
    // Nor are the machines, which need it: their names stay.
    for (const b of this.machineButtons) b.replaceWith(el('span', { class: 'piece-title' }, b.textContent));
    for (const g of this.machineControls) g.remove();
    this.soundLabel?.remove();
    this.card.append(el('p', { class: 'no-webgl' }, message));
    this.hint.remove();
  }
}
