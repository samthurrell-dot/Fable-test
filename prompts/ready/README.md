# Ready prompts

Paste one into a Claude Code session started inside a clone of this repo, after choosing the model (`/model` → Claude Fable 5.2) and a high effort setting.

Run order (see `plan/viability.md`):
1. `06-lightbulb-fable.txt` – 5 rounds, 80 min cap
2. `15-popup-book-fable.txt` – 4 rounds, 70 min cap
3. `13-tree-seasons-fable.txt` – 4 rounds, 55 min cap
4. Reserve: `03-kintsugi-fable.txt` – 5 rounds, 90 min cap

Each is Nick Saraev's original prompt with three blocks added: house rules (phone, UK English), checkpoints (commit and push every round, so a usage cut-off loses nothing), and the harvest clause (engines as separate modules with notes, so Opus and others can reuse them).

If your Fable allowance is tight, lower the time cap in step 4 of "Process" first. Keep at least 3 rounds.

If a session is cut off: start a new one in the repo and say "Read STATUS.md and carry on with <build>".
