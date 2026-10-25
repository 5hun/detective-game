# Playing Animal Detective

[Back to README](../README.md) · [Play online](https://5hun.github.io/detective-game/)

## Cases and difficulty

- Solve a series of cases to complete the game: three on Easy, five on Normal, or seven on Hard. Select “Next case” to continue with your remaining investigation funds. Statements, notes, and markers reset for each case.
- Select “Start over” to choose the initial difficulty again and restart at case one with five investigation funds. Cancel to continue the current case.
- Later cases feature more animals and culprits, up to ten animals and five culprits.
- Each case begins with a title selected from twelve possibilities and a short introduction. Resuming the same case preserves its introduction. When you solve a case, the results screen and dialog show a short, case-specific epilogue, “After the case.” You can reread it when resuming a solved case.
- The case breakdown, number of culprits found, and remaining investigation funds stay visible at the top while scrolling.

| Initial difficulty | Animals in case one | Culprits in case one |
| --- | ---: | ---: |
| Easy | 4 | 1 |
| Normal | 5 | 2 |
| Hard | 7 | 3 |

Animals are selected from ten species without duplicates. Each species uses a different logical statement format. Any animal can be either innocent or a culprit.

## Statements and identification

- Open “Animal list” to see all ten species and their statement rules.
- Tap “Hear statement” to reveal an animal's statement. On every difficulty, the animals mentioned in a statement are shown before you hear it.
- Each case has a fixed number of culprits and innocents.
- Ordinary innocents always make true statements. A mistaken innocent who believes they are a culprit always makes a false statement.
- Exactly one assignment satisfies all statements and the required culprit count. Hearing only some statements may leave multiple possibilities.
- Select “Identify as culprit” for an animal to reveal its identity immediately. Once you find every culprit, all remaining animals are automatically confirmed innocent; you do not need to identify innocents yourself.
- An animal's portrait changes after identification. An innocent accused by mistake looks sad, without bars. Culprits look troubled behind bars, and innocents automatically confirmed when the case is solved smile.

## Investigation funds

- You start with five investigation funds. Correct identifications do not increase them; incorrect identifications cost two, and solving a case earns one. The investigation ends if your funds fall below zero. Find every culprit with zero or more funds to solve the case. Automatically confirmed innocents do not earn funds.
- From case five on Hard, some statements cost one or two investigation funds. The cost is displayed beforehand. You can hear a statement if you have enough funds, even if paying leaves you with zero. Revealed statements never cost funds again.
- An animal accused by mistake is still marked as identified.

## Mistaken innocents (Hard)

Starting with case four on Hard, one innocent always makes a false statement.
This animal still counts as innocent for culprit counts and statements such as “same role,” and accusing it costs two investigation funds.
A culprit may also claim that this animal is a culprit. From the start, the count is shown as “N innocents (including one mistaken innocent).”
All statements are free in case four, when this role first appears; paid statements begin in case five.
You can use the suspected mistaken innocent marker. Finding every culprit solves the case; identifying the mistaken innocent is unnecessary.

## Notes and markers

Use notes and markers freely: unset, suspected culprit, suspected innocent, needs review, or suspected mistaken innocent. They do not affect identification results.

## Results

- A results dialog appears in the center when a case ends. After you close it, the results and “Next case” remain on the page.
- After a case ends, you can compare each statement with the truth. Completing all cases shows the number of cases solved, the total number of innocents incorrectly accused across all cases, and your remaining investigation funds. A special message celebrates a run with no incorrect accusations. “After the final case” appears at the end of the results text.

## Language, reading guides, and sound

Open the game menu (☰) and select **日本語** or **English** under **Language**. Japanese is the default. Your choice is saved in this browser, independently of game progress. Switching languages keeps the current case, funds, revealed testimony, markers, and notes. Notes stay exactly as typed. Japanese reading guides are available only in Japanese; their setting is retained when switching back.

- Toggle furigana (phonetic readings above kanji) with the “かん／漢” icon at the top of the screen. This preference is saved separately from case progress.
- Kanji have furigana readings; instructions in selection and input fields use kana.
- Correct and incorrect identifications play short sound effects. Toggle sound with the speaker icon; this preference is saved. The statement-reveal sound is generated in the browser.

## Saving

If saved data has a version, format, or contents incompatible with the current specification, the game treats it as missing and starts a new case. Older formats are not migrated.

The current case number, carried-over investigation funds, progress, revealed statements, notes, and markers are automatically saved in the browser's `localStorage`. You can still play when storage is unavailable, but progress is lost when you close the page. Browsers handle storage for local files differently; moving the files or using private browsing may prevent progress from carrying over.

## Audio credits

The identification sounds, “Quiz correct 2” and “Quiz incorrect 2,” come from Sound Effect Lab and are bundled in `assets/sounds/`.

- When you complete all cases, “Cheers and applause 1” plays after the stamp sound finishes. This audio is bundled in `assets/sounds/`. It does not play when sound effects are off, and stops when you close the results screen. Source: [Cheers and applause 1](https://soundeffect-lab.info/sound/search.php?s=%E6%8B%8D%E6%89%8B).
- Audio source: [Sound Effect Lab (identification sounds)](https://soundeffect-lab.info/sound/search.php?s=%E6%AD%A3%E8%A7%A3) ([terms of use](https://soundeffect-lab.info/agreement/)). These recordings are used as game sound effects.
