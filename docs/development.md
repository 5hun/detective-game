# Development and distribution

[Back to README](../README.md)

## Local setup

Use Node.js 20.19 or later (22.13 or later for the 22.x series, or 24 or later). Install dependencies and build the TypeScript on your first run:

```sh
npm ci
npm run build
```

After building, **open `index.html` in your browser to play.** No server is required. To distribute the game, include `index.html`, `styles.css`, the `assets/` folder, and `i18n.js`, `engine.js`, `portraits.js`, `ruby.js`, `sound.js`, and `app.js` from `dist/`, preserving the folder structure. No external network access is required at runtime.

On a desktop, double-click `index.html` or drag it into your browser. The layout also supports mobile screen widths. Some mobile operating systems or file managers restrict JavaScript in local HTML files. In that case, upload the same files and the `assets/` and `dist/` folders to a static host and access them there; no application backend is needed.

## Setting funds for debugging

Open `index.html?debugMoney=100` to set investigation funds to 100. This also works on a static host. The hidden parameter accepts integers from -1,000,000,000 to 1,000,000,000; invalid values are ignored. Zero allows testing insufficient funds, and negative values put the game into the lost state.

For an existing save, the value is applied when the page loads. Without a save, it is applied when you start a game. It applies once per page load, so normal spending and rewards continue afterward. Reloading with the parameter sets the funds again; remove the parameter to resume with the saved balance. Changes use the ordinary save slot and persist without the parameter, preserving testimony, judgments, and notes. Starting over resets funds normally. Setting a nonnegative amount can resume a lost investigation; a solved case remains solved.

This is a convenience for debugging, not an access restriction. It is available in the published game to anyone who knows the parameter.

## Checks

Run type checks, lint, and independent exhaustive verification of 3,000 puzzles across the three difficulties, plus tests for investigation funds, win/loss conditions, and reproducibility:

```sh
npm run typecheck
npm run lint
npm test
```

ESLint and typescript-eslint's `recommendedTypeChecked` configuration check the application, shared type declarations, and tests using type information. Type analysis uses `tsconfig.tests.json`, which includes all checked files. Warnings fail CI, and generated output in `dist/` and `_site/` is excluded. Limited exceptions allow browser global declarations and CommonJS imports. Promises returned by Node.js test registration are handled with `void test(...)`, since the test runner manages the results.

### Browser tests

Browser tests (install Chromium before the first run):

```sh
npx playwright install chromium
npm run test:browser
```

To use an existing installation, set `PLAYWRIGHT_MODULE` to the Playwright package path and `CHROMIUM_PATH` to the Chromium executable path. Tests open the game over `file://` and check note and marker persistence, wins and losses, difficulty, dialogs, layouts at 320px and 390px widths, and behavior when storage is unavailable. Screenshots are saved to `/tmp/beast-detective-desktop.png` and `/tmp/beast-detective-mobile.png`.

## Implementation

The game is built with HTML, CSS, and TypeScript, with no runtime library dependencies. TypeScript checks the code in `strict` mode and outputs JavaScript to `dist/`. Types for game state, difficulty, statements, and browser APIs are shared in `types.d.ts`. Generated files and `node_modules/` are excluded from Git. Run `npm run build` again after changing the source.

Original animal pixel art is drawn with SVG rectangles.

### Puzzle generation

The generator selects a true assignment from combinations satisfying the count constraints, then randomly selects statements consistent with each animal's role. It searches every assignment and accepts only puzzles with a unique solution. If none is accepted after 32 attempts, it uses a fixed-seed fallback puzzle whose uniqueness has been verified for that animal and culprit count, and verifies it again at runtime. Statement costs are assigned after a puzzle is accepted, so the generator does not guarantee that you can afford all necessary statements. The saved random seed reproduces the same puzzle.

Puzzle generation and solution searches verify that every culprit's statement is false and that the number of innocents making false statements matches the specified count.
Once the culprit assignment is known, the innocent making a false statement is determined to be the mistaken innocent, so a unique culprit assignment also guarantees unique identities for everyone.
Fixed-seed fallback puzzles are available for every configuration featuring a mistaken innocent.

### Translations

Translations for menus, testimony, all twelve stories, rules, results, and accessibility labels live in `i18n.ts`. Tagged templates preserve dynamic values while allowing English word order. Add `data-i18n` to static text and `data-i18n-aria-label` (or the matching attribute name) to translated attributes.

## GitHub Pages deployment

Updates to the `main` branch run type checks, lint, tests, and a build through GitHub Actions, then automatically deploy to GitHub Pages.
The published files include HTML, CSS, the game's JavaScript, and image and audio assets. In the repository's Settings → Pages → Source, select `GitHub Actions`.
