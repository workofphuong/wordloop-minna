# Wordloop (vocab trainer): handoff, 2026-10-18

To continue in a new chat, paste: "Continue the vocab trainer in F:\mipu-claude\vocab-trainer. Read HANDOFF.md and the vocab-trainer-spec memory first."

## State
Stage 1 (no LLM) is built and runs. Not published. App name is **Wordloop**. Stage 2 (Cloudflare Worker + LLM) is not started; `js/llm-slot.js` is the plug-in point (it renders on the check page). Full agreed spec: memory `vocab-trainer-spec` (some of it is superseded by this file: units hidden, reading phase, examples flow).

- Dev server: `.claude/launch.json` entry `vocab-trainer` (python http.server, port 8123). Tests: `npm test` in this folder (42 pass).
- `sw.js`: bump VERSION and update FILES when files are added or removed (now v7).
- Internal names that still say "revisit" on purpose so saved data is not lost: localStorage key `revisit-vocab-trainer-v1`, cache prefix `revisit-`, round type `'revisit'`.
- **Preview browser gotchas:** it caches ES modules. After edits run `fetch(path, {cache:'reload'})` for every changed file (including `ui/dom.js`), then reload. A stale `dom.js` gives "does not provide an export" errors and a stuck "Loading...".
- **Never pass `null` to native `append`/`replaceChildren`**: it prints the text "null". Spread `...(cond ? [el] : [])`. `h()` itself skips null.
- Python edits on Windows turn `\n` into `\r\n` unless `newline=''` is used; files are mixed, which is harmless for JS.

## Screens and routes
- `#/` Home (`ui/home.js`): three blocks. (1) Blue Wordloop hero: Resume/Discard a round, or one next step "N revisits due in <list>" + **Start looping** (due before new words) plus "N other lists have something waiting too", or "Loop closed. Practice any time." (2) "Your word lists": one row per list with status, "Manage" (plain text, top right) switches to Edit/Delete per list, "+ Create new list" below. (3) Practice block with a list picker. Backup prompt, install card and a "Backup and restore" link below.
- `#/list/<id>` (`ui/list.js`): next-step card (Start), progress bar, "N words have no meaning" card (links to Edit list), "N words have no example" link, buttons Add words / Practice / Edit list, then words with meanings (tap to edit reading, examples, delete).
- `#/new` and `#/edit/<id>` (`ui/newlist.js`): one form: name, words (format help above the box), "Fill missing meanings with AI (coming soon)" tickbox (`list.wantsAiMeanings`, stage 2 must use it), explanation language, schedule, Japanese typing (romaji to hiragana), strict accents. Words are required. Edit shows words as `term<TAB>meaning (example)`, matches by term so progress and readings survive, warns that renaming restarts progress, reports skipped duplicates, has Delete this list.
- `#/review/<id>` (check page, after create/edit/Add words): all words with meanings (editable), one "Add example sentences?" card (once per list, `list.examplesPrompted`), settings summary, buttons **Done** and **Edit list**.
- `#/examples/<id>` (`ui/examples.js`): one word at a time, example box, Save and next / Skip.
- `#/add` (`ui/add.js`): Paste and CSV tabs only (One word tab removed). Imports go to the check page. Paste has the format help, a 3+ column mapping panel and a "Replace the meaning of words already in this list" option.
- `#/practice/<id>`: exercise + number of cards. Fill the blank only appears when 80% of ready words have an example.
- `#/round`: header shows list name and "Card n of m" (matching: "n words to match"); answer box has a hint inside it; Pause and Done return to the list.
- `#/settings`: only "Backup and restore".
- Deleting always uses an in-page "Yes, delete / Cancel" box (`askFirst` in dom.js) because `confirm()` is blocked in some embedded browsers.

## Behaviour decisions
- **Units are hidden.** A list is one set of words. Data still has `list.units`; new words go into the first unit; every due batch counts as due; no unit screens, pickers or Review option. The sample keeps its two units; the old "Bài 1" Vietnamese words in the preview browser were moved to their own list.
- **Format for words:** `word, meaning (example)`; `-`, `:` and Tab also split word from meaning. A trailing `( )` is the example; an empty `()` keeps brackets that belong to the meaning (importer.js `withParenExample`).
- **Reading phase:** words with a `reading` start with reading exercises (first session: reading multiple choice; revisits and typing practice: kana shown, learner types the romaji; matching pairs word with reading). A correct typed reading (including "I knew it") sets `word.readingKnown`, and the word then gets normal meaning exercises. Dates stay fixed; only exercise content changes (small deviation from the spec ladder). Practice also sets the flag.
- **Examples are optional but encouraged:** paste format, one-time check-page card, "Add an example sentence (optional)" link under a correct answer (max once per round `activeRound.exPrompted`, max 3 times per word `word.exAsked`), toast when Fill the blank unlocks. No "stop asking" setting (deliberately).
- **Wording rule:** "revisit" = a due item (counts, dates, schedule notes); "loop" = the cycle (button "Start looping", first-round title "Start the loop", results "Loop started", schedule names "Steady loop" / "Exam loop"); practice says "Extra review"; round titles say "Review N: <exercise>". Use "word list", not "vocabulary". The end-of-session summary screen layout is to be left alone.
- Buttons have no outlines (soft tint fill); primary buttons stay solid blue.

## Design (done 2026-10-18, single look, no dark mode)
- Palette **Peach + sage**, font **Nunito** bundled in `fonts/` (latin + vietnamese, precached in sw.js). Tokens in `css/app.css` `:root`. Dark-mode block removed on purpose.
- Home: wordmark "Wordloop" with two linked rings for the "oo" (no motion), tagline "Learn it. Loop it. Keep it." Only two blocks: peach hero (one next step) and "Your word lists" (rows show name and a chevron only; status lives on the list page) with "+ Create new list" and "Extra practice" (practice of the last-used list). Backup: only the "Backup and restore" link (opt-in checkbox is in Settings); the opted-in "backup needed" reminder remains.
- `design-sketches.html`, `color-sketches.html` are throwaway mockups; delete when no longer needed.
- Do not give an element class `wrap` unless it is the page wrapper (`.wrap` has max-width and bottom padding).

## Added since the last handoff
- Edit list: **Start this list over** (`resetListProgress` in model.js): clears batches/dates/reading flags, keeps words.
- List page: "N more words come after this batch." and a **Round in progress / Resume** card when an unfinished round belongs to the list.
- Unfinished first sessions that are not the active round release their words (`abandoned` in session.js); starting a new first session discards an unfinished one. "Finished" = round engine reached its end (results shown), not the whole revisit cycle.
- Languages: imports normalised to NFC, full-width comma splits, CSV must be UTF-8 (otherwise a message), typing check maps ß/œ/æ/đ/ø/ł.
- Preview browser: the preview tab on port 8123 works; 8124 is refused. Data there was reset to a first-timer state.

## Open / next ideas
- Not browser-checked: dark mode (hero block, tint buttons), phone width, the CSV tab, the results screen wording, the "Fill the blank unlocked" toast, in-page delete on Edit list / sample / word / restore.
- A one-line explanation of "loop" under the Wordloop title for first-time users was discussed (shown until the first loop is done); not built. Fallback is to use "review" in visible text.
- `exampleShare`/Fill the blank in revisits: review 5 still falls back to typing for words without a usable example.
- Practice sets the reading flag; consider whether it should not.
- Preview browser data has leftover test lists (not in code).
- From the spec, still open: visual style, .docx upload (PDF is out of scope), stage 2 LLM Worker (suggested meanings, examples, daily caps), publishing to GitHub Pages.
