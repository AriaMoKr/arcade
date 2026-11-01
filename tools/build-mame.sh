#!/bin/sh
# MAME for the web, holding only this room's machines, into public/mame/ (README, "The machines"):
#   arcade.js, arcade.wasm  MAME built with Emscripten: GPL-2.0-or-later, as MAME is
#   COPYING.txt, legal/     MAME's licence and notices, and the licences' full texts, served beside it
# from MAME's source at $TAG, cloned once into a cache outside the repository ($MAME_SRC). The
# machines are the drivers in $DRIVERS. Needs git, make, Python 3, a C compiler for MAME's project
# generator (GENie, built for this computer) and Emscripten (emcc on the PATH, as MSYS2's
# emscripten package puts it, or emsdk's emsdk_env sourced). On Windows, run it under MSYS2 UCRT64.
#   sh tools/build-mame.sh [jobs]
set -eu

TAG=mame0289
DRIVERS=src/mame/nintendo/nes.cpp,src/mame/sinclair/spectrum.cpp
JOBS=${1:-$(nproc 2>/dev/null || echo 4)}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=$ROOT/public/mame
MAME_SRC=${MAME_SRC:-${XDG_CACHE_HOME:-$HOME/.cache}/arcade/$TAG}

command -v emcc >/dev/null || { echo "emcc is not on the PATH: install Emscripten (MSYS2: mingw-w64-ucrt-x86_64-emscripten) or source emsdk_env.sh" >&2; exit 1; }
EMSCRIPTEN=${EMSCRIPTEN:-$(em-config EMSCRIPTEN_ROOT | tail -n 1)}
export EMSCRIPTEN

if [ ! -d "$MAME_SRC/.git" ]; then
  mkdir -p "$(dirname "$MAME_SRC")"
  git -c advice.detachedHead=false clone --depth 1 --branch "$TAG" https://github.com/mamedev/mame.git "$MAME_SRC"
fi
cd "$MAME_SRC"
[ "$(git describe --tags --exact-match HEAD)" = "$TAG" ] || { echo "$MAME_SRC is not at $TAG" >&2; exit 1; }

# GENIE, the project generator, runs on this computer: built with its compiler, not emcc.
env -u CC -u CXX -u AR -u LD make genie
# The SDL 3 ports MAME's Emscripten build links (docs.mamedev.org, "Compiling MAME").
embuilder build sdl3 sdl3_ttf
# emar with the objects to archive in a response file: on Windows a program's command line holds
# at most 32 767 characters, fewer than MAME's larger libraries take.
EMAR=$MAME_SRC/build/emar-rsp.sh
mkdir -p "$MAME_SRC/build"
cat > "$EMAR" <<'EOF'
#!/bin/sh
# emar OPERATION ARCHIVE OBJECT... (tools/build-mame.sh in arcade)
op=$1 archive=$2
shift 2
rsp=$(mktemp)
printf '%s\n' "$@" > "$rsp"
emar "$op" "$archive" "@$rsp"
status=$?
rm -f "$rsp"
exit $status
EOF
# What `emmake make` does, but with this make (on Windows emmake runs mingw32-make), the Clang
# version inside emcc given as the makefile reads it elsewhere (on Windows it finds none), emar
# through the response file, and the link's libraries without -lGL: Emscripten links WebGL's
# library by default, and on Windows -lGL adds it a second time under another spelling of its path.
CLANG_VERSION=$(emcc -v 2>&1 >/dev/null | sed -n 's/^clang version \([0-9][0-9.]*\).*/\1/p' | head -n 1)
# Binaryen (wasm-opt, which optimises the link's output) on one thread on Windows: there, with
# more, it writes its output and then never exits, and can't be stopped (MSYS2's emscripten
# 6.0.12, wasm-opt 133).
case $(uname -s) in MINGW* | MSYS* | CYGWIN*) export BINARYEN_CORES="${BINARYEN_CORES:-1}" ;; esac
# REGENIE=1 makes the project files again each time: MAME's makefile doesn't see a change of
# SOURCES, and would build the drivers it was first given.
CC=emcc CXX=em++ LD=emcc NM=emnm RANLIB=emranlib \
  make SUBTARGET=arcade SOURCES="$DRIVERS" REGENIE=1 SYMBOLS=0 PYTHON_EXECUTABLE=python3 \
  CLANG_VERSION="$CLANG_VERSION" AR="sh $EMAR" LIBS='$(LDDEPS) -lm -lpthread' -j"$JOBS"

mkdir -p "$OUT"
cp arcade.js arcade.wasm "$OUT/"
# MAME's licence and its parts' notices, and the full texts they name, which go with binaries too:
# as .txt, which a browser shows rather than downloads.
cp COPYING "$OUT/COPYING.txt"
rm -rf "$OUT/legal"
mkdir "$OUT/legal"
for f in docs/legal/*; do cp "$f" "$OUT/legal/$(basename "$f").txt"; done
# And what Emscripten adds to it, its runtime and the ports MAME links, with their licences.
CACHE=$(em-config CACHE | tail -n 1)
notice() {
  printf '==== %s ====\n\n' "$1"
  shift
  cat "$@"
  printf '\n\n'
}
FT_YEAR=$(sed -n 's/.*Copyright (C) 1996-\([0-9]*\).*/\1/p' "$CACHE"/ports/freetype/*/include/freetype/freetype.h | head -n 1)
{
  echo "Besides MAME (COPYING.txt), MAME's build for the web (tools/build-mame.sh in AriaMoKr/arcade)"
  echo "holds these, each under its own licence. Portions of this software are copyright (C) $FT_YEAR"
  echo "The FreeType Project (www.freetype.org). All rights reserved."
  echo
  notice "Emscripten's runtime (emcc $(emcc --version | head -n 1 | sed 's/.*) //'))" "$EMSCRIPTEN/LICENSE"
  notice "SDL 3" "$CACHE"/ports/sdl3/*/LICENSE.txt
  notice "SDL_ttf 3" "$CACHE"/ports/sdl3_ttf/*/LICENSE.txt
  notice "FreeType" "$CACHE"/ports/freetype/*/LICENSE.TXT "$CACHE"/ports/freetype/*/docs/FTL.TXT
  notice "HarfBuzz" "$CACHE"/ports/harfbuzz/*/COPYING
  notice "zlib" "$CACHE"/ports/zlib/*/LICENSE
} > "$OUT/legal/emscripten.txt"
echo "MAME $TAG ($(git rev-parse --short HEAD)), emcc $(emcc --version | head -n 1 | sed 's/.*) //'):"
ls -l "$OUT"
