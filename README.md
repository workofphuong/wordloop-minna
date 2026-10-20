# Wordloop - word trainer (stage 1)

Plain HTML, CSS and JavaScript. No build step, no server code, nothing leaves the browser.

## Run it locally

```
python -m http.server 8123 --directory F:\mipu-claude\vocab-trainer
```

Then open http://localhost:8123 (the service worker needs http://localhost or https, not a file:// path).

## Run the tests

```
npm test --prefix F:\mipu-claude\vocab-trainer
```

## Layout

- `js/model.js, store.js` data shapes and localStorage persistence (saved after every answer)
- `js/importer.js` paste and CSV parsing
- `js/schedule.js` fixed calendar presets, due dates, exercise ladder
- `js/exercises.js, engine.js, session.js` cards, round state machine, starting and finishing rounds
- `js/checker.js, romaji.js` typed-answer check and romaji to hiragana
- `js/ui/` screens: `home.js` (Wordloop box, lists, practice), `list.js` (one list: next step, words), `newlist.js` (create/edit a list, check page), `add.js` (paste/CSV), `words.js` (word editor, format help), `round.js`, `practice.js`, `settings.js` (backup only). Units still exist in the data but are hidden from the learner.
- PWA files: `js/pwa.js`, `sw.js`, `manifest.webmanifest` install and offline
- `js/llm-slot.js` empty plug-in point for stage 2 (not wired to anything)

## Before publishing

Bump `VERSION` in `sw.js` if you add or remove files. The app name is Wordloop (index.html, manifest, home screen). The storage key `revisit-vocab-trainer-v1` keeps its old name on purpose, so existing data is not lost.
