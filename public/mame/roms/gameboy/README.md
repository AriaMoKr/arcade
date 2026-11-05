# The Game Boy's boot ROM

`dmg_boot.bin`: the program a Game Boy runs as it is switched on, before the cartridge's (256
bytes): SameBoy's, written by Lior Halphon for his Game Boy emulator SameBoy
(https://sameboy.github.io/) in place of Nintendo's, which can't be passed on. It is the one built in
SameBoy's release v1.0.5, as `sameboy_winsdl_v1.0.5.zip` holds it
(https://github.com/LIJI32/SameBoy/releases/tag/v1.0.5, the zip's SHA-256
`5aa92fb376b53b57361b15c29a6ff5a4494f7ae6f4ba7cbdfa6ef8375765b655` as the release's `SHA2-256SUMS`
gives it; the ROM's SHA-1 `1db57a1e8b6e4096f811587f9eab0c6675fd9755`), from its source
`BootROMs/dmg_boot.asm` in SameBoy's repository at that tag.

As Nintendo's does, it scrolls the logo from the cartridge's header down the screen, chimes twice,
and starts the cartridge with the processor's registers as Nintendo's leaves them; unlike Nintendo's,
it checks neither the logo nor the header. MAME knows Nintendo's by its checksum, so it notes in its
log that this one differs, and runs it.

Its licence, as the release's zip holds it, [`LICENSE.txt`](LICENSE.txt):

> Expat License
>
> Copyright (c) 2015-2026 Lior Halphon
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.
