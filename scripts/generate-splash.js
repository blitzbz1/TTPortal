#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

// Source the native splash from pin-white.svg (not lockup-vertical.svg) so the
// instant the OS-level splash shows, the user sees the same small pin that the
// JS overlay's animation starts with — no lockup flash before the animation.
const SRC = path.join(__dirname, '..', 'design', 'pin-white.svg');
const OUT = path.join(__dirname, '..', 'assets', 'images', 'splash-icon.png');

const svg = fs.readFileSync(SRC, 'utf8');

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1024 },
  background: 'rgba(0,0,0,0)',
});

const png = resvg.render().asPng();
fs.writeFileSync(OUT, png);
console.log(`Wrote ${OUT} (${png.length} bytes)`);
