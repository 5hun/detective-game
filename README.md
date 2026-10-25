# Animal Detective

A Japanese and English logic puzzle game where you read animals' statements and identify the innocents and culprits.

## Live version

[Play Animal Detective](https://5hun.github.io/detective-game/)

Play in your browser without installing anything or signing in.
Updates to the `main` branch run type checks, lint, tests, and a build through GitHub Actions, then automatically deploy to GitHub Pages.
Only HTML, CSS, and the game's JavaScript files are published. In the repository's Settings → Pages → Source, select `GitHub Actions`.

## Getting started

Use Node.js 20.19 or later (22.13 or later for the 22.x series, or 24 or later). Install dependencies and build the TypeScript on your first run:

```sh
npm ci
npm run build
```

After building, **open `index.html` in your browser to play.** No server is required. To distribute the game, include `index.html`, `styles.css`, and `i18n.js`, `engine.js`, `portraits.js`, `ruby.js`, `sound.js`, and `app.js` from `dist/`, preserving the folder structure. No external network access is required at runtime.

On a desktop, double-click `index.html` or drag it into your browser. The layout also supports mobile screen widths. Some mobile operating systems or file managers restrict JavaScript in local HTML files. In that case, upload the same files and the `dist/` folder to a static host and access them there; no application backend is needed.

## Language

Open the game menu (☰) and select **日本語** or **English** under **Language**. Japanese is the default. Your choice is saved in this browser, independently of game progress. Switching languages keeps the current case, funds, revealed testimony, markers, and notes. Notes stay exactly as typed. Japanese reading guides are available only in Japanese; their setting is retained when switching back.

Translations for menus, testimony, all twelve stories, rules, results, and accessibility labels live in `i18n.ts`. Tagged templates preserve dynamic values while allowing English word order. Add `data-i18n` to static text and `data-i18n-aria-label` (or the matching attribute name) to translated attributes.

## How to play

- Solve a series of cases to complete the game: three on Easy, five on Normal, or seven on Hard. Select “Next case” to continue with your remaining investigation funds. Statements, notes, and markers reset for each case.
- Select “Start over” to choose the initial difficulty again and restart at case one with five investigation funds. Cancel to continue the current case.
- Later cases feature more animals and culprits, up to ten animals and five culprits.
- Open “Animal list” to see all ten species and their statement rules.
- Tap “Hear statement” to reveal an animal's statement. On every difficulty, the animals mentioned in a statement are shown before you hear it.
- From case five on Hard, some statements cost one or two investigation funds. The cost is displayed beforehand. You can hear a statement if you have enough funds, even if paying leaves you with zero. Revealed statements never cost funds again.
- Toggle furigana (phonetic readings above kanji) with the “かん／漢” icon at the top of the screen. This preference is saved separately from case progress.
- Kanji have furigana readings; instructions in selection and input fields use kana.
- Each case begins with a title selected from twelve possibilities and a short introduction. Resuming the same case preserves its introduction. When you solve a case, the results screen and dialog show a short, case-specific epilogue, “After the case.” You can reread it when resuming a solved case.
- The case breakdown, number of culprits found, and remaining investigation funds stay visible at the top while scrolling.
- Each case has a fixed number of culprits and innocents.
- Ordinary innocents always make true statements. A mistaken innocent who believes they are a culprit always makes a false statement.
- Exactly one assignment satisfies all statements and the required culprit count. Hearing only some statements may leave multiple possibilities.
- Select “Identify as culprit” for an animal to reveal its identity immediately. Once you find every culprit, all remaining animals are automatically confirmed innocent; you do not need to identify innocents yourself.
- An animal's portrait changes after identification. An innocent accused by mistake looks sad, without bars. Culprits look troubled behind bars, and innocents automatically confirmed when the case is solved smile.
- Correct and incorrect identifications play short sound effects. Toggle sound with the speaker icon; this preference is saved. The identification sounds, “Quiz correct 2” and “Quiz incorrect 2,” come from Sound Effect Lab and are bundled in `assets/sounds/`. The statement-reveal sound is generated in the browser.
  - When you complete all cases, “Cheers and applause 1” plays after the stamp sound finishes. This audio is bundled in `assets/sounds/`. It does not play when sound effects are off, and stops when you close the results screen. Source: [Cheers and applause 1](https://soundeffect-lab.info/sound/search.php?s=%E6%8B%8D%E6%89%8B).
  - Audio source: [Sound Effect Lab (identification sounds)](https://soundeffect-lab.info/sound/search.php?s=%E6%AD%A3%E8%A7%A3) ([terms of use](https://soundeffect-lab.info/agreement/)). These recordings are used as game sound effects.
- An incorrect identification costs two investigation funds. The accused animal is still marked as identified.
- You start with five investigation funds. Correct identifications do not increase them; incorrect identifications cost two, and solving a case earns one. The investigation ends if your funds fall below zero. Find every culprit with zero or more funds to solve the case. Automatically confirmed innocents do not earn funds.
- Use notes and markers freely: unset, suspected culprit, suspected innocent, needs review, or suspected mistaken innocent. They do not affect identification results.
- A results dialog appears in the center when a case ends. After you close it, the results and “Next case” remain on the page.
- After a case ends, you can compare each statement with the truth. Completing all cases shows the number of cases solved, the total number of innocents incorrectly accused across all cases, and your remaining investigation funds. A special message celebrates a run with no incorrect accusations. “After the final case” appears at the end of the results text.

| Initial difficulty | Animals in case one | Culprits in case one |
| --- | ---: | ---: |
| Easy | 4 | 1 |
| Normal | 5 | 2 |
| Hard | 7 | 3 |

Animals are selected from ten species without duplicates. Each species uses a different logical statement format. Any animal can be either innocent or a culprit.

## Saving

If saved data has a version, format, or contents incompatible with the current specification, the game treats it as missing and starts a new case. Older formats are not migrated. Save format version 13 supports the total number of incorrect accusations across all cases. Earlier saves do not contain past accusation counts, so start a new investigation.

The current case number, carried-over investigation funds, progress, revealed statements, notes, and markers are automatically saved in the browser's `localStorage`. You can still play when storage is unavailable, but progress is lost when you close the page. Browsers handle storage for local files differently; moving the files or using private browsing may prevent progress from carrying over.

## Implementation and verification

The game is built with HTML, CSS, and TypeScript, with no runtime library dependencies. TypeScript checks the code in `strict` mode and outputs JavaScript to `dist/`. Types for game state, difficulty, statements, and browser APIs are shared in `types.d.ts`. Generated files and `node_modules/` are excluded from Git. Run `npm run build` again after changing the source. Original animal pixel art is drawn with SVG rectangles. The generator selects a true assignment from combinations satisfying the count constraints, then randomly selects statements consistent with each animal's role. It searches every assignment and accepts only puzzles with a unique solution. If none is accepted after 32 attempts, it uses a fixed-seed fallback puzzle whose uniqueness has been verified for that animal and culprit count, and verifies it again at runtime. Statement costs are assigned after a puzzle is accepted, so the generator does not guarantee that you can afford all necessary statements. The saved random seed reproduces the same puzzle.

With Node.js 20.19 or later (22.13 or later for the 22.x series, or 24 or later), run independent exhaustive verification of 3,000 puzzles across the three difficulties, plus tests for investigation funds, win/loss conditions, and reproducibility:

```sh
npm run typecheck
npm run lint
npm test
```

Run static analysis with `npm run lint`. ESLint and typescript-eslint's `recommendedTypeChecked` configuration check the application, shared type declarations, and tests using type information. Type analysis uses `tsconfig.tests.json`, which includes all checked files. Warnings fail CI, and generated output in `dist/` and `_site/` is excluded. Limited exceptions allow browser global declarations and CommonJS imports. Promises returned by Node.js test registration are handled with `void test(...)`, since the test runner manages the results.

Browser tests (install Chromium before the first run):

```sh
npx playwright install chromium
npm run test:browser
```

To use an existing installation, set `PLAYWRIGHT_MODULE` to the Playwright package path and `CHROMIUM_PATH` to the Chromium executable path. Tests open the game over `file://` and check note and marker persistence, wins and losses, difficulty, dialogs, layouts at 320px and 390px widths, and behavior when storage is unavailable. Screenshots are saved to `/tmp/beast-detective-desktop.png` and `/tmp/beast-detective-mobile.png`.

## Mistaken innocents

Starting with case four on Hard, one innocent always makes a false statement.
This animal still counts as innocent for culprit counts and statements such as “same role,” and accusing it costs two investigation funds.
A culprit may also claim that this animal is a culprit. From the start, the count is shown as “N innocents (including one mistaken innocent).”
All statements are free in case four, when this role first appears; paid statements begin in case five.
You can use the suspected mistaken innocent marker. Finding every culprit solves the case; identifying the mistaken innocent is unnecessary.

Puzzle generation and solution searches verify that every culprit's statement is false and that the number of innocents making false statements matches the specified count.
Once the culprit assignment is known, the innocent making a false statement is determined to be the mistaken innocent, so a unique culprit assignment also guarantees unique identities for everyone.
Fixed-seed fallback puzzles are available for every configuration featuring a mistaken innocent. This feature uses save format version 12.
