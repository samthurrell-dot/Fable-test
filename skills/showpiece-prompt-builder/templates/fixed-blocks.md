# Fixed blocks (copy as-is)

Source: Nick Saraev, Maker Skool "Fable 5.2 build prompts" (the text he shared publicly). Kept word for word so it behaves the same.
Replace [N] (improvement rounds) and [T] (minutes). See SKILL.md section 3.

---

# [Build title]

I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs.

## Your build: [Build title]

[Write this with SKILL.md section 2 and templates/build-block-parts.md]

## Tools and files

- Work in the current folder. The entry file is `index.html`. Put your other files (modules, shaders, baked images, textures, video) in a subfolder beside it.
- Use three.js or raw WebGL2, whichever gives the better picture. Keep a local copy of three.js in the folder (my builds used r186). No CDN. The only network request that the finished page may make is Google Fonts.
- CC0 assets from Poly Haven (HDRI skies, PBR textures) are allowed when they clearly raise realism. The subject of your build must be geometry that you make in code, unless the build section names a model.
- Use Blender only if the build section tells you to.
- Check your work in a headless browser on the real GPU (for example Playwright with Chrome): load the page, send input steps (move, click, drag, key, wheel), take screenshots and measure the frame rate. Read every screenshot that you take.

## Hard rules

- The page looks alive at load with no input: motion or an attract mode from the first frame. It reacts to the mouse or the keyboard in the first second of input.
- It fills the window. Target 60 fps at 1920x1080 on a recent laptop GPU. Cap the device pixel ratio at 2, and lower the internal resolution when a frame takes too long.
- Games, scenes and experiments: a quiet title and one hint line at the top left. Websites and videos: no HUD. The build is the picture.
- Sound: start muted. Show a clear "Enable sound" control and make no sound before a click on it. Make all sound in code (WebAudio). The build must look complete with the sound off.
- Make time controllable: `?t=<seconds>` freezes the animation at that time, and `?view=<name>` selects a camera or a state where that helps. Use them to look at exact moments.
- Original work only. No copy of a specific existing game, film, brand, character, logo or site. Genres, techniques, real places and public buildings are fine.
- Copy: real words for the subject, sentence case, no lorem ipsum, no emoji as icons. State only facts that you are sure of.

[Optional: ## House rules (Sam) – see SKILL.md section 5]

[Optional: harvest clause – below]

## Process

1. Build a complete v1. Check it in the headless browser. Fix every error.
2. Run at least [N] improvement rounds. In each round: take three or more screenshots of different moments, views and input states. Read them. Judge them as a harsh art director who compares the picture with the best work of this kind. Name the three weakest things. Fix them. Check again.
3. Measure the frame rate. Under 50 fps at 1920x1080: make it faster before you add anything.
4. Stop when one more round would not show on camera, or at [T] minutes from your start.
5. Final reply, five lines or fewer: what to do in the first five seconds, the best moment and how to reach it, what you used, any known flaw.

---

## Make it reusable (harvest clause)
This code will be reused by other models and projects. While you build:
- Put each engine in its own ES module with a small, documented API (for example `engine/fold.js`, `engine/pathtrace.js`). Keep scene content, UI and engine apart.
- Name every magic number as a constant with a one-line comment on what it changes.
- Keep a `TECHNIQUES.md` in the repo root. For each technique: what it does, why you chose it over the alternatives, key parameters and safe ranges, performance cost measured, and the mistakes you made and fixed during the improvement rounds.
- Keep a `ROUNDS.md`: for each improvement round, the three weakest things you named and what you changed.
- Add `demo/<engine>.html` pages that show each engine alone with sliders for its main parameters.
This must not lower the quality of the build itself.
