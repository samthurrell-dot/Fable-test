# Parts for the "Your build" block

## Style guard (physical-medium builds only)
This build is stylized on purpose, to stay out of the uncanny valley: nothing that tries to pass for a photograph of a living thing and misses. You have one physical medium. Obey its rules in every pixel. The finish must be extremely high: the picture should look like a photograph of a real handmade object or a real print, not like a filter on a 3D scene. No cookie-cutter look: no low-poly, no voxels, no pixel art, no neon synthwave, no glass UI, no generic cel shading, no default three.js materials. Before you write code, decide the rules of the medium: how an edge looks, how colour is laid down, what the surface is, which flaws the hand or the machine leaves, and how it moves. Hold every frame to those rules.

## Mode contracts (pick one)

**Game**
This is a game. It must be fun for two minutes on camera: a clear goal inside 5 seconds, instant restart, an attract mode that plays until the first input, and strong feedback on every action. The design is your own: do not copy the rules, characters, levels or look of a specific existing game.

**Made object that comes alive**
This is a made object that comes alive. The medium is the star. It starts on load, it loops, and it answers the pointer in the first second.

**Film in the browser**
This is a film that plays live in the browser. It starts on load with no sound and it loops. Space pauses. A thin scrub bar shows at the bottom on hover. Letterbox the picture to the window.

**Film with a deterministic timeline (from build 11)**
This is a film that plays live in the browser. Build a deterministic timeline: every frame is a pure function of time. It starts on load with no sound and it loops. Space pauses. A thin scrub bar shows at the bottom on hover. A 'Play with sound' button restarts the film with its score (WebAudio, written by you, cut to the picture). Letterbox the picture to the window. Nothing covers the picture.

**Website (from build 9)**
This is a complete landing page for an invented brand: hero, four to six sections, a footer. Write real copy with a clear voice. Design it at the level of an Awwwards site of the day: type, spacing, motion and detail must all hold up when I scroll slowly on camera. Smooth scrolling. Every image is drawn in code. Check it at 1920x1080 and at 390 px wide.

**Science explainer (written for this skill, based on build 14)**
This is an explainer that a viewer can scrub. Show the true parts with correct geometry as far as you are sure of it. A scrub bar steps through the stages, drag to orbit, labels that can be turned off. State only science that you are sure of; where something is simplified, say so in the label.

## Medium line pattern
Your medium: [material or craft], in a [kind of photograph: macro photo on a kitchen table / museum catalogue photo / craft-magazine photo / nature-film frame].

## Bar patterns
- Bar: a frozen frame passes for [a real artefact a viewer knows], at 60 fps.
- Bar: a viewer who [has a real experience] knows it in the first second, and [does the thing you want].

## Good mechanics wording (examples from the set)
- "cams of different shapes (eccentric, snail, heart), followers, levers, a pin wheel, a ratchet, strings over pulleys" (automaton)
- "parallel folds, V-folds, floating layers, pull tabs, a wheel, a slider ... nothing stretches and nothing passes through another part" (pop-up book)
- "Cracks start at the impact and run through the wall in a pattern that depends on the place of the hit" (kintsugi)
- "The torque falls as the spring unwinds, so the time of the next wind is the game" (wind-up derby)
- "Draw each possible state as its own segment ... Aim for 250 segments or more" (thermostat)
