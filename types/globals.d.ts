// What the pages use that TypeScript's DOM library leaves out, for tsconfig.json's check of
// public/js/ (it is never served): the older WebKit names for fullscreen, and what is put on window
// and on a machine's frame.

interface Document {
  readonly webkitFullscreenElement?: Element | null;
  readonly webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?(): Promise<void> | void;
}

interface HTMLElement {
  webkitRequestFullscreen?(): Promise<void> | void;
}

interface Window {
  /** index.html's inline script: a VR session was granted (sessiongranted) before main.js ran. */
  roomXrGranted?: boolean;
  /** main.js: the room, for scripted testing and tools/preview.mjs (CLAUDE.md, "Conventions"). */
  __room?: Record<string, unknown>;
  /** mame-frame.js, in a machine's frame: the machine, for the page that shows it (emulator.js). */
  mame?: import('../public/js/mame-frame.js').MameFrame;
  /** mame-frame.js: Emscripten's settings for MAME (arcade.js reads them as it loads). */
  Module?: Record<string, unknown>;
  /** mame-test.js: the test page, for tools/measure-machines.mjs. */
  test?: Record<string, unknown>;
}

interface HTMLIFrameElement {
  /** emulator.js: the page's sound for the machine in the frame (mame-frame.js). */
  machineAudio?: import('../public/js/mame-frame.js').MachineAudio;
}
