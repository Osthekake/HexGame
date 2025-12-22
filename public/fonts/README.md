# Font Setup for Three.js Renderer

The Three.js renderer requires a typeface font file for text rendering.

## Required Font File

Place the font file at: `public/fonts/helvetiker_regular.typeface.json`

## How to Obtain the Font

You can get the font file from the Three.js repository:
- URL: https://github.com/mrdoob/three.js/tree/dev/examples/fonts
- Download `helvetiker_regular.typeface.json` from the examples/fonts directory

Alternatively, you can use any other Three.js compatible typeface.json file and update the font path in `src/threejs/threejs-renderer.ts` (line 79).

## Alternative Fonts

Other font options from the Three.js repository:
- `helvetiker_bold.typeface.json`
- `optimer_regular.typeface.json`
- `gentilis_regular.typeface.json`
- `droid_sans_regular.typeface.json`

## Without Font

If the font file is not present, text rendering will be disabled and a warning will appear in the console. The game will still function, but score animations won't display text.
