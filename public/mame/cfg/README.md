# MAME's settings for the room's machines

MAME reads a machine's settings from `<machine>.cfg` in its `cfg` folder when it starts the machine
(`-cfg_directory /cfg`, machines.js `mameArgs`), and each machine's here is fetched there with its
ROMs.

`vectrex.cfg`: the Vectrex's light pen's crosshair never shown. MAME moves the light pen with the
arrows, as it does the stick, and would draw its crosshair over the picture whenever it moved, though
the light pen isn't plugged in (MAME's default for it) and Mine Storm doesn't read it.

They are the room's own, under its licence (MIT, the repository's `LICENSE`).
