// The site as published: the page, its modules and imports, the view as a picture for a screen
// reader, every control of the 3D view also on the page, the room's two pictures, and what a
// shared link shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOM, hallwayDoor } from '../public/js/config.js';
import { PANEL_BUTTONS } from '../public/js/room.js';
import { STANDS, panelLayout } from '../public/js/stands.js';
import { buttonName, machineButtons, machineById, oneButton } from '../public/js/machines.js';
import { installDom } from './helpers/dom.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const meta = (p) => html.match(new RegExp(`<meta (?:property|name)="${p}" content="([^"]*)">`))?.[1];

test('the page uses relative URLs only, so it works under any path (GitHub Pages: /<repo>/)', () => {
  const urls = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|data:)/.test(u));
  const map = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]);
  urls.push(...Object.values(map.imports));
  for (const u of urls) assert.ok(!u.startsWith('/'), `root-relative URL ${u}`);
});

test("the view and what is over it are the page's main landmark, and the card is outside it", () => {
  const main = html.slice(html.indexOf('<main>'), html.indexOf('</main>'));
  assert.ok(main.length > 0, 'no <main>');
  assert.ok(main.includes('id="app"') && main.includes('id="view-overlay"'));
  assert.ok(!main.includes('id="overlay"'));
  assert.equal(html.match(/<main\b/g).length, 1);
});

test('the view is a picture to a screen reader, with words for what it shows', () => {
  const src = readFileSync(join(root, 'js', 'main.js'), 'utf8');
  assert.ok(src.includes("renderer.domElement.setAttribute('role', 'img')"));
  assert.ok(src.includes("renderer.domElement.setAttribute('aria-label', "));
});

test('every client module parses', () => {
  for (const f of readdirSync(join(root, 'js'))) {
    if (!f.endsWith('.js')) continue;
    const r = spawnSync(process.execPath, ['--check', join(root, 'js', f)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f}: ${r.stderr}`);
  }
});

test('client modules import only three, the shared packages and each other', () => {
  const shared = /^(common|layersharedsession)\/[a-z-]+\.js$/; // not common/tools/…: those are Node's
  const { imports } = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]);
  const installed = existsSync(join(root, 'vendor'));
  for (const f of readdirSync(join(root, 'js'))) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(join(root, 'js', f), 'utf8');
    for (const m of src.matchAll(/(?:^import\s.*?from\s+|import\()'([^']+)'/gms)) {
      assert.ok(m[1] === 'three' || shared.test(m[1]) || m[1].startsWith('./'), `${f} imports ${m[1]}`);
      if (shared.test(m[1]) && installed) {
        const [name, file] = m[1].split('/');
        assert.ok(existsSync(join(root, imports[`${name}/`], file)), `${f} imports ${m[1]}, which is not in vendor/`);
      }
      if (m[1].startsWith('./')) assert.ok(existsSync(join(root, 'js', m[1])), `${f} imports ${m[1]}, which is not there`);
    }
  }
});

test('the import map maps what the page and the shared session load to their copies in vendor/', () => {
  const { imports } = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]);
  assert.deepEqual(Object.keys(imports).sort(), ['@noble/secp256k1', '@trystero-p2p/core', 'common/', 'layersharedsession/', 'three', 'trystero']);
  for (const url of Object.values(imports)) assert.match(url, /^\.\/vendor\//);
  if (!existsSync(join(root, 'vendor'))) return; // not installed yet
  for (const [name, url] of Object.entries(imports)) assert.ok(existsSync(join(root, url)), `${name}: ${url} missing (npm install)`);
});

test('every button of the control panel in 3D is a control on the page too, doing the same', async () => {
  const remove = installDom();
  try {
    const { Overlay } = await import('../public/js/overlay.js');
    const way = { url: 'https://ariamokr.github.io/hallway/?from=x', label: '← Hallway', title: 'Back to the Hallway' };
    const o = new Overlay(ROOM, way);
    const did = [];
    o.onNav = (k, v) => did.push(`${k}:${v}`);
    o.onAccess = (change) => {
      for (const [k, v] of Object.entries(change)) did.push(typeof v === 'boolean' ? `${k}:${v ? 'on' : 'off'}` : `${k}:${v}`);
    };
    o.onSession = () => did.push('session');
    let vr = false;
    o.showVR(() => (vr = true));
    for (const [id] of PANEL_BUTTONS) {
      did.length = 0;
      if (id === 'vr') {
        o.vr.fire('click');
        assert.ok(vr, 'Enter VR');
        continue;
      }
      if (id === 'session') {
        o.session.fire('click');
        assert.deepEqual(did, ['session']);
        continue;
      }
      const [group, value] = id.split(':');
      const input = o.choices.get(id) ?? o.choices.get(group);
      assert.ok(input, `no control on the page for the panel's ${id}`);
      input.checked = input.attributes.get('type') === 'checkbox' ? value === 'on' : true;
      input.fire('change');
      assert.deepEqual(did, [id], id);
    }
    // The doorway is the way back, a real link; the card is the page's navigation.
    assert.equal(o.back.tagName, 'A');
    assert.equal(o.back.getAttribute('href'), way.url);
    assert.equal(o.back.textContent, '← Hallway');
    assert.equal(o.card.tagName, 'NAV');
    assert.ok(o.card.textContent.includes(ROOM.title) && o.card.textContent.includes(ROOM.description));
    assert.equal(o.toasts.getAttribute('role'), 'status');
    assert.equal(o.toasts.getAttribute('aria-live'), 'polite');
  } finally {
    remove();
  }
});

test("every button of a machine's panel on the wall is a control on the page too, doing the same, and Sound is there", async () => {
  for (const tv of [false, true]) {
    const remove = installDom();
    try {
      const { Overlay } = await import('../public/js/overlay.js');
      const { ScreenKeys } = await import('../public/js/screen-keys.js');
      const machines = STANDS.map((s) => {
        const m = machineById(s.machine);
        return { title: m.title, about: s.about, buttons: machineButtons(m, tv).map((id) => ({ id, name: buttonName(m, id) })) };
      });
      const o = new Overlay(ROOM, { url: 'https://ariamokr.github.io/hallway/', label: '← Hallway', title: 'Back to the Hallway' }, { tv, machines });
      const did = [];
      o.onMachine = (i) => did.push(`play:${i}`);
      o.onMachineButton = (i, id) => did.push(`${id}:${i}`);
      const inCard = (e) => o.card.findAll((c) => c === e).length === 1;
      for (let i = 0; i < STANDS.length; i++) {
        const m = machineById(STANDS[i].machine);
        const panel = panelLayout(m);
        // Stopped: Play is the machine's button, which says what it is.
        assert.ok(inCard(o.machineButtons[i]) && !o.machineButtons[i].hidden);
        assert.equal(o.machineButtons[i].textContent, m.title);
        assert.ok(o.machineControls[i].hidden);
        for (const [id] of panel.stopped) {
          did.length = 0;
          assert.equal(id, 'play');
          o.machineButtons[i].fire('click');
          assert.deepEqual(did, [`play:${i}`]);
        }
        // Running: its buttons in place of that one, each as on the panel; on a TV a console's A and B
        // too, where they are two (not the Atari 2600's one fire button). A computer's keys are under
        // its picture (screen-keys.js), each pressing the same key.
        o.setPlaying(i, m);
        assert.ok(o.machineButtons[i].hidden && !o.machineControls[i].hidden && inCard(o.machineControls[i]));
        // Named over them, so that they are told from another machine's button.
        assert.ok(!o.machineNames[i].hidden && o.machineNames[i].textContent === m.title);
        assert.ok(o.machineNames.every((n, j) => n.hidden === (j !== i)));
        // Marked as the one running, so that on a small screen the others leave the card (style.css).
        assert.ok(o.machineItems.every((item, j) => item.classList.contains('current') === (j === i)));
        const chips = new Map(o.machineControls[i].children.map((b) => [b.getAttribute('data-button'), b]));
        // Each named as the machine names it, as on its panel: a Nintendo's Start, the Vectrex's 1.
        for (const [id, b] of chips) assert.equal(b.textContent, buttonName(m, id), `${m.id}: ${id}`);
        const keys = m.keyboard ? new ScreenKeys(m.keyboard, `The ${m.title}'s keyboard`) : null;
        // Each key is named by what it shows (WCAG 2.5.3, Label in Name): no aria-label over it. A key
        // with a short legend holds both, of which style.css shows one, the other not read.
        for (const [j, k] of (keys?.keys ?? []).entries()) {
          const b = keys.buttons[j];
          assert.equal(b.getAttribute('aria-label'), null, `${k.label} is named over what it shows`);
          if (k.short) assert.deepEqual(b.children.filter((c) => c.className.startsWith('k-label')).map((c) => c.textContent), [k.label, k.short]);
        }
        /** @type {string[]} */
        const pressed = [];
        if (keys) keys.onKey = (key, down) => pressed.push(`key:${key.code}:${down}`);
        for (const [id] of panel.running) {
          if (id.startsWith('key:')) {
            const b = keys?.buttons[keys.keys.findIndex((k) => `key:${k.code}` === id)];
            assert.ok(b, `no ${id} on the screen`);
            pressed.length = 0;
            b.fire('click', { detail: 0 }); // a press that isn't a finger's or the mouse's: Enter, a screen reader
            assert.deepEqual(pressed, [`${id}:null`]);
            continue;
          }
          did.length = 0;
          assert.ok(chips.has(id), `no ${id} in the card`);
          chips.get(id).fire('click');
          assert.deepEqual(did, [`${id}:${i}`]);
        }
        assert.equal(keys?.keys.length ?? 0, panel.running.filter(([id]) => id.startsWith('key:')).length);
        assert.deepEqual([...chips.keys()].filter((id) => id !== 'a' && id !== 'b').sort(), panel.running.map(([id]) => id).filter((id) => !id.startsWith('key:')).sort());
        assert.equal(chips.has('a') && chips.has('b'), tv && !!m.pad && !oneButton(m));
        // And how to play it, then how to walk again.
        o.setHint(tv ? 'tv' : 'mouse');
        const ok = `Arrows: its ${m.stick ? 'stick' : 'pad'} · OK: its ${buttonName(m, 'a')} · `;
        if (!tv) assert.match(o.hint.textContent, /Esc: stop$/);
        else if (m.keyboard) assert.match(o.hint.textContent, /^Arrows: from key to key · OK: press it/);
        else assert.ok(o.hint.textContent.startsWith(ok), o.hint.textContent);
        o.setPlaying(-1);
        assert.ok(!o.machineButtons[i].hidden && o.machineControls[i].hidden);
        assert.match(o.hint.textContent, /a machine/);
      }
      let sound = null;
      o.onSound = (on) => (sound = on);
      assert.ok(inCard(o.sound) && o.sound.checked);
      o.sound.checked = false;
      o.sound.fire('change');
      assert.equal(sound, false);
    } finally {
      remove();
    }
  }
});

test("on a TV the remote reaches it all in the card: the session, Wave and the name in one, and Settings; the invite is text", async () => {
  const remove = installDom();
  try {
    const { Overlay } = await import('../public/js/overlay.js');
    const way = { url: 'https://ariamokr.github.io/hallway/?from=x', label: '← Hallway', title: 'Back to the Hallway' };
    const o = new Overlay(ROOM, way, { tv: true });
    const inCard = (e) => o.card.findAll((c) => c === e).length === 1;
    // common's tv.js Remote has the card (#overlay) for its root: everything is in it, nothing at the foot of the view.
    assert.equal(o.root, document.getElementById('overlay'));
    assert.ok(inCard(o.session) && inCard(o.wave) && inCard(o.settingsToggle) && inCard(o.myName));
    for (const input of o.choices.values()) assert.ok(inCard(input));
    assert.ok(!o.buttons.children.includes(o.wave));
    // In a session: Wave and the name, which is the one the session keeps.
    o.setTogether(true, 'just you here', { name: 'Fox', color: '#ffaa00' });
    assert.equal(o.wave.hidden, false);
    assert.equal(o.together.hidden, false);
    assert.equal(o.myName.value, 'Fox');
    o.onName = (name) => name.trim() || 'Fox';
    o.myName.value = '  Otter ';
    o.myName.fire('change');
    assert.equal(o.myName.value, 'Otter');
    // Nothing to copy a link to: it is shown, to open on another device.
    o.setInvite('https://ariamokr.github.io/RoomTemplateEmpty/?room=k3vd-q8hn');
    assert.equal(o.invite.hidden, true);
    assert.ok(inCard(o.inviteText));
    assert.equal(o.inviteText.textContent, 'To join from a phone or a computer, open ariamokr.github.io/RoomTemplateEmpty/?room=k3vd-q8hn');
    o.setTogether(false);
    assert.equal(o.wave.hidden, true);
    assert.equal(o.together.hidden, true);
    // The hint, which describes the view to TalkBack (main.js: aria-describedby).
    assert.equal(o.hint.getAttribute('id'), 'hint');
    o.setHint('tv');
    assert.match(o.hint.textContent, /^Arrows: walk and turn · OK: .* · Menu or hold Back: /);
    o.setHint('tv-card');
    assert.match(o.hint.textContent, /Back: walk again$/);
    // Faded, it leaves the reading order (TalkBack would stop on an empty spot), keeping its words
    // for the view's description; shown again, it is back in it.
    o.hideHint();
    assert.ok(o.hint.classList.contains('gone'));
    assert.equal(o.hint.getAttribute('aria-hidden'), 'true');
    assert.match(o.hint.textContent, /Back: walk again$/);
    o.setHint('tv');
    assert.equal(o.hint.getAttribute('aria-hidden'), null);
  } finally {
    remove();
  }
  // Not on a TV: Wave and Copy invite link are pills at the foot of the view, and there is no invite text.
  const again = installDom();
  try {
    const { Overlay } = await import('../public/js/overlay.js');
    const o = new Overlay(ROOM, { url: 'https://ariamokr.github.io/hallway/', label: '← Hallway', title: 'Back to the Hallway' });
    assert.ok(o.buttons.children.includes(o.wave) && o.buttons.children.includes(o.invite));
    assert.equal(o.inviteText, null);
    o.setInvite('https://ariamokr.github.io/RoomTemplateEmpty/?room=k3vd-q8hn');
    assert.equal(o.invite.hidden, false);
    // Off a TV, a faded hint stays in the reading order: a screen reader can still find the keys.
    o.setHint('mouse');
    o.hideHint();
    assert.equal(o.hint.getAttribute('aria-hidden'), null);
  } finally {
    again();
  }
});

/** A JPEG's width and height, from its start-of-frame marker. */
function jpegSize(file) {
  const b = readFileSync(file);
  for (let i = 2; i < b.length;) {
    const marker = b[i + 1], length = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
    i += 2 + length;
  }
  return null;
}

test("the room's pictures: the Hallway's doorway's, 2:1, and the link previews', 1280 × 640", () => {
  const door = hallwayDoor();
  const preview = join(root, door.preview.slice(door.url.length));
  assert.ok(existsSync(preview), `${door.preview} is not in public/ (npm run preview)`);
  assert.deepEqual(jpegSize(preview), { width: 2048, height: 1024 });
  assert.deepEqual(jpegSize(join(root, 'social.jpg')), { width: 1280, height: 640 });
});

test('a shared link shows the room: its address and its picture, absolute, at the size the page says', () => {
  for (const p of ['og:url', 'og:image', 'twitter:image']) assert.equal(new URL(meta(p)).protocol, 'https:', p);
  assert.equal(meta('og:url'), ROOM.url);
  assert.equal(meta('og:image'), `${ROOM.url}social.jpg`);
  assert.equal(meta('twitter:image'), meta('og:image'));
  const size = jpegSize(join(root, 'social.jpg'));
  assert.equal(Number(meta('og:image:width')), size.width);
  assert.equal(Number(meta('og:image:height')), size.height);
  assert.equal(meta('twitter:card'), 'summary_large_image');
  for (const p of ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:image:alt', 'twitter:title', 'twitter:description', 'twitter:image:alt']) assert.ok(meta(p), `no ${p}`);
});
