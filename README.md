# Animal Detective

A logic puzzle game where you read animals' statements and identify the innocents and culprits.

**[Play Animal Detective](https://5hun.github.io/detective-game/)** — play in your browser without installing anything or signing in.

## How to play

1. Choose Easy (three cases), Normal (five cases), or Hard (seven cases).
2. Read animals' statements and use notes and markers to work out who the culprits are. Ordinary innocents tell the truth; culprits lie. Later Hard cases introduce a mistaken innocent who also lies.
3. Select “Identify as culprit” to check your deduction. Find every culprit to solve the case.

You start with three investigation funds. An incorrect accusation costs one; solving a case always earns one. All statements are displayed from the start. The investigation ends if your funds fall below zero.

Progress is saved automatically in your browser. Use the game menu (☰) to switch between Japanese and English.

See the [full gameplay guide](docs/gameplay.md) for difficulty details, mistaken innocents, controls, saving, and audio credits.

## Run locally

Use Node.js 20.19+, 22.13+ for the 22.x series, or 24+.

```sh
npm ci
npm run build
```

Open **`index.html`** in your browser after building. No server is required. The game uses HTML, CSS, and TypeScript with no runtime library dependencies or external network access.

## Development

```sh
npm run format:check
npm run typecheck
npm run lint
npm test
```

Run `npm run format` to format source and documentation. After `npm ci`, a Git pre-commit hook automatically formats staged files with Prettier.

See [development and distribution](docs/development.md) for browser tests, implementation details, translations, offline distribution, and GitHub Pages deployment.
