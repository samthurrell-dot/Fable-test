# Fable 5.2 build prompts

The prompts behind the 15 builds in my video "Insane things you can build with Claude Fable 5.2", in the same order as the video.

Each build has a short note, what my run used, what you need, and the full prompt. Copy the whole prompt and paste it into Claude Code on Claude Fable 5.2. Read `README.md` first.

## 1. Wind-up derby

What it is: Four wind-up tin toys race across a kitchen table. Wind the key, let go, and time the next wind.

What my run used: three.js r186, custom rigid-body sim, Blender Cycles bakes, Poly Haven, WebAudio.

You need: Claude Code on Claude Fable 5.2, and Blender.

Limits in my run: 4 improvement rounds or more, 90 minutes at most.

Prompt:

````
# Wind-up derby

I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs.

## Your build: Wind-up derby

This build is stylized on purpose, to stay out of the uncanny valley: nothing that tries to pass for a photograph of a living thing and misses. You have one physical medium. Obey its rules in every pixel. The finish must be extremely high: the picture should look like a photograph of a real handmade object or a real print, not like a filter on a 3D scene. No cookie-cutter look: no low-poly, no voxels, no pixel art, no neon synthwave, no glass UI, no generic cel shading, no default three.js materials. Before you write code, decide the rules of the medium: how an edge looks, how colour is laid down, what the surface is, which flaws the hand or the machine leaves, and how it moves. Hold every frame to those rules.

This is a game. It must be fun for two minutes on camera: a clear goal inside 5 seconds, instant restart, an attract mode that plays until the first input, and strong feedback on every action. The design is your own: do not copy the rules, characters, levels or look of a specific existing game.

Your medium: lithographed tinplate wind-up toys, in a macro photograph on a kitchen table.

Four tin toys of your own design (for example a beetle car, a hopping bird, a rocket on wheels, a duck on a trike) race around a course made of household things: a ramp of books, a tunnel under a colander, a slalom of salt shakers, a jump over a butter dish, a slow zone of spilled sugar. The player holds a key to wind the spring (a ratchet clicks; too much winding slips the spring) and lets go to run. The torque falls as the spring unwinds, so the time of the next wind is the game. The toys wobble, tip, bump and right themselves by real rigid-body physics. Three bots. Three laps and a photo finish.

Look: tinplate with printed art that is a little off register, embossed lines, folded tabs in slots, bare metal at scratched edges, a visible key. A low camera, shallow depth of field, morning window light across the table.

Light: bake it. Build the table scene in Blender by script. Bake Cycles light and soft shadows into texture atlases. Render the toys live with an environment map that matches, so that they sit in the baked scene with contact shadows and reflections of the table.

Blender jobs: test at small size and few samples first. Check every baked file after a job (a job can be cut short).

Bar: a frozen frame passes for a photograph in a toy collector's book, at 60 fps.

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

## Process

1. Build a complete v1. Check it in the headless browser. Fix every error.
2. Run at least 4 improvement rounds. In each round: take three or more screenshots of different moments, views and input states. Read them. Judge them as a harsh art director who compares the picture with the best work of this kind. Name the three weakest things. Fix them. Check again.
3. Measure the frame rate. Under 50 fps at 1920x1080: make it faster before you add anything.
4. Stop when one more round would not show on camera, or at 90 minutes from your start.
5. Final reply, five lines or fewer: what to do in the first five seconds, the best moment and how to reach it, what you used, any known flaw.
````

## 2. Clay: a stop-motion film made by code

What it is: A lump of plasticine shapes itself on an animator's desk. One Python script made every picture.

What my run used: One Python script: numpy distance fields, Blender Cycles, ffmpeg.

You need: Claude Code on Claude Fable 5.2, and Blender and ffmpeg.

Limits in my run: 4 improvement rounds or more, 100 minutes at most.

Prompt:

````
# Clay: a stop-motion film made by code

I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs.

## Your build: Clay: a stop-motion film made by code

This build is stylized on purpose, to stay out of the uncanny valley: nothing that tries to pass for a photograph of a living thing and misses. You have one physical medium. Obey its rules in every pixel. The finish must be extremely high: the picture should look like a photograph of a real handmade object or a real print, not like a filter on a 3D scene. No cookie-cutter look: no low-poly, no voxels, no pixel art, no neon synthwave, no glass UI, no generic cel shading, no default three.js materials. Before you write code, decide the rules of the medium: how an edge looks, how colour is laid down, what the surface is, which flaws the hand or the machine leaves, and how it moves. Hold every frame to those rules.

This is a film that plays live in the browser. It starts on load with no sound and it loops. Space pauses. A thin scrub bar shows at the bottom on hover. Letterbox the picture to the window.

Your medium: plasticine stop-motion (claymation), rendered with Blender Cycles by one Python script.

About 12 seconds, a loop, 1920x1080, animated on twos (12 pictures a second). A lump of plasticine on an animator's desk shapes itself. It rolls, splits and becomes a run of five or six things. Each one holds for a beat and turns into the next by real clay logic (squash, pinch, pull, roll a coil, press flat). The film ends where it began. Your choice of shapes (for example ball, snail, teapot that pours, whale that dives into the desk, rocket, ball). Two or three colours of clay that marble a little where they mix.

The look is everything: real plasticine. Fingerprints and thumb dents, tool marks, small cracks at tight bends, a soft waxy surface that scatters light, dust and lint, colour that is not uniform. The surface changes a little from picture to picture, as clay that a hand moved. The set: a cutting mat or a wooden desk, wire tools, a spare lump, a desk lamp as key light with a soft shadow, shallow depth of field, a slight exposure flicker between pictures. Render with Cycles and its denoiser. Choose the sample count by test.

Build the shapes so that their topology can change (metaballs, or signed distance fields that you mesh for each picture). Add the hand-made detail with displacement and bump that change with each picture.

The page: the film on the left and the Python script on the right, with the part that drives the current moment marked. Key C hides the code. A "Play with sound" button is optional. Encode with ffmpeg (h264, high quality).

Blender jobs: test at small size and few samples first. Check every baked file after a job (a job can be cut short). Render at half size until the film is right. Then render the final pictures in batches of 15.

Bar: a viewer believes that a person animated real clay by hand.

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

## Process

1. Build a complete v1. Check it in the headless browser. Fix every error.
2. Run at least 4 improvement rounds. In each round: take three or more screenshots of different moments, views and input states. Read them. Judge them as a harsh art director who compares the picture with the best work of this kind. Name the three weakest things. Fix them. Check again.
3. Measure the frame rate. Under 50 fps at 1920x1080: make it faster before you add anything.
4. Stop when one more round would not show on camera, or at 100 minutes from your start.
5. Final reply, five lines or fewer: what to do in the first five seconds, the best moment and how to reach it, what you used, any known flaw.
````

## 3. Kintsugi: break it, mend it with gold

What it is: One tea bowl. Strike it, watch it break for real, then watch gold flow into every seam.

What my run used: three.js r186, code-made Voronoi fracture, own rigid-body physics, one studio HDRI.

You need: Claude Code on Claude Fable 5.2. Nothing extra.

Limits in my run: 5 improvement rounds or more, 90 minutes at most.

Prompt:

````
# Kintsugi: break it, mend it with gold

I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs.

## Your build: Kintsugi: break it, mend it with gold

This build is stylized on purpose, to stay out of the uncanny valley: nothing that tries to pass for a photograph of a living thing and misses. You have one physical medium. Obey its rules in every pixel. The finish must be extremely high: the picture should look like a photograph of a real handmade object or a real print, not like a filter on a 3D scene. No cookie-cutter look: no low-poly, no voxels, no pixel art, no neon synthwave, no glass UI, no generic cel shading, no default three.js materials. Before you write code, decide the rules of the medium: how an edge looks, how colour is laid down, what the surface is, which flaws the hand or the machine leaves, and how it moves. Hold every frame to those rules.

This is a made object that comes alive. The medium is the star. It starts on load, it loops, and it answers the pointer in the first second.

Your medium: a glazed ceramic tea bowl mended with gold lacquer, in a museum catalogue photograph.

One object, rendered as well as it can be done, that reacts.

A hand-thrown bowl with a pale celadon or ash glaze sits on a dark wooden board: throwing rings, a foot ring of bare clay, glaze that pools thick in the well, fine crackle, an iron speck or two. Click the bowl: it is struck at that point and it breaks by real fracture. Cracks start at the impact and run through the wall in a pattern that depends on the place of the hit. The shards have thickness and the colour of bare clay on the broken faces. They fall, spin and settle by rigid-body physics. Then the mend: time runs back with care, the shards return, and gold lacquer flows along each seam and stands a little proud of the surface, with gold fills where chips were lost. Each mend is different. The viewer can break the mended bowl again, and old seams hold or break again.

Inputs: click to strike, drag to orbit, a key to step through break, gather and mend. A shelf at the back keeps the last three bowls. With no input the cycle runs slowly, with a macro camera move over the gold.

Quality: a studio HDRI (CC0, for example from Poly Haven) for the reflections, soft shadows, contact occlusion, depth of field, a glaze with a clear coat over a body that scatters light, gold with a soft hammered surface. Bake what does not move. You may show converged stills for the resting views if you use a progressive renderer.

Bar: a still of the mended bowl passes for a museum catalogue photograph.

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

## Process

1. Build a complete v1. Check it in the headless browser. Fix every error.
2. Run at least 5 improvement rounds. In each round: take three or more screenshots of different moments, views and input states. Read them. Judge them as a harsh art director who compares the picture with the best work of this kind. Name the three weakest things. Fix them. Check again.
3. Measure the frame rate. Under 50 fps at 1920x1080: make it faster before you add anything.
4. Stop when one more round would not show on camera, or at 90 minutes from your start.
5. Final reply, five lines or fewer: what to do in the first five seconds, the best moment and how to reach it, what you used, any known flaw.
````

## 4. The thermostat

What it is: One dial, 0 to 40 degrees. Inside its LCD lives a small world made only of segments.

What my run used: Raw WebGL2 shader, Canvas 2D segment sprites, WebAudio, one CC0 wall texture.

You need: Claude Code on Claude Fable 5.2. Nothing extra.

Limits in my run: 4 improvement rounds or more, 60 minutes at most.

Prompt:

````
# The thermostat

I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs.

## Your build: The thermostat

This build is stylized on purpose, to stay out of the uncanny valley: nothing that tries to pass for a photograph of a living thing and misses. You have one physical medium. Obey its rules in every pixel. The finish must be extremely high: the picture should look like a photograph of a real handmade object or a real print, not like a filter on a 3D scene. No cookie-cutter look: no low-poly, no voxels, no pixel art, no neon synthwave, no glass UI, no generic cel shading, no default three.js materials. Before you write code, decide the rules of the medium: how an edge looks, how colour is laid down, what the surface is, which flaws the hand or the machine leaves, and how it moves. Hold every frame to those rules.

This is a made object that comes alive. The medium is the star. It starts on load, it loops, and it answers the pointer in the first second.

Your medium: the reflective monochrome LCD of 1980s handheld games and calculators: black segments that are only on or off, each a fixed drawn shape in a fixed place.

One round thermostat on a wall. The viewer turns its metal ring (drag around it, scroll, or arrow keys) from 0 to 40 degrees C. The face is the LCD: a grey-green backplane, black segments with a soft offset shadow on the backplane, faint ghosts of the segments that are off, and a slow response (a segment fades in or out in about 100 ms).

The world: a small scene (a house, a tree, a pond, a hill, the sky, a few animals and people as small pictograms) that lives through the range of temperature with segments only. Draw each possible state as its own segment: snowflakes at several places, a sheet of ice, a skater in four poses along a path, icicles, a scarf, buds, leaves, flowers in stages, a bird on each perch, rain lines, a sun with sets of rays, a parasol, an ice cream that melts in five stages, a cactus flower. Motion is a switch from one segment to the next, as those games moved a figure. Aim for 250 segments or more. Draw them in code as crisp shapes with the plain charm of real LCD art. Seven-segment digits show the temperature.

Each degree changes something. Hide eight secrets at exact values, and one more at a combination (for example a fast turn from 40 to 0). A list shows the secrets that the viewer found. With no input the ring turns slowly through the year.

Render the device as a photograph: a brushed ring with fine anisotropic highlights, glass over the LCD with a faint reflection, a colour shift of the polarizer toward the edges, a wall with paint texture and a soft shadow.

Bar: a viewer who owned an LCD game knows it in the first second, and does not stop turning the ring.

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

## Process

1. Build a complete v1. Check it in the headless browser. Fix every error.
2. Run at least 4 improvement rounds. In each round: take three or more screenshots of different moments, views and input states. Read them. Judge them as a harsh art director who compares the picture with the best work of this kind. Name the three weakest things. Fix them. Check again.
3. Measure the frame rate. Under 50 fps at 1920x1080: make it faster before you add anything.
4. Stop when one more round would not show on camera, or at 60 minutes from your start.
5. Final reply, five lines or fewer: what to do in the first five seconds, the best moment and how to reach it, what you used, any known flaw.
````

## 5. My studio: a portfolio you can walk into

What it is: A 3D studio with baked light. The computer switches on, and you can go inside it.

What my run used: Blender Cycles light baked to atlases, three.js unlit room, DOM mini-OS.

You need: Claude Code on Claude Fable 5.2, and Blender.

Limits in my run: 5 improvement rounds or more, 110 minutes at most.

Prompt:

````
# My studio: a portfolio you can walk into

I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs.

## Your build: My studio: a portfolio you can walk into

The request: "a 3d portfolio site in three.js that is my studio with a computer flickering on that you can actually go into, and that computer runs a mini-OS that you can do fun things on (bake in high quality renders so it's fast, and auto-loop to optimize at least 4-5x before presenting)".

This is my portfolio site.

The room: my recording studio at dusk, in three.js. A desk with a wide curved monitor and a laptop, a camera on an arm, a key light with a softbox, a microphone, a chair, shelves with objects, plants, a window with a lake and hills at dusk, a YouTube silver play button on the wall. [Change this list to your own room. If you have a photo of your room, attach it and add: use this photo for the wall colour and the mood.] Do not model me or any person. Do not show an address or a city name.

Baked light: build the room in Blender with Python, light it well (window dusk light, warm practical lamps, the monitor glow), bake the lighting to textures with Cycles, and export glTF plus the baked maps. three.js then draws the baked room with unlit materials, so it looks path-traced and runs at 60 fps. Keep a few live parts on top: the monitor light that flickers on, dust in the light, a plant that moves, reflections on glass.

Blender jobs: keep each job under 10 minutes. Test with small sizes and few samples first.

The visit: a slow camera with limits and a little parallax. Objects on the shelves are my work, and a click opens a small card for each. Facts that you may use: [your name and what you do. Your channels and follower counts. Your products, companies and sites. Your course or video topics.] Use no revenue figures, no email, no phone, and no other numbers.

The computer: a moment after load the monitor flickers on like a tube and then shows a desktop. A click on it flies the camera into the screen until the screen is the whole window. The viewer is now inside a small operating system, drawn sharp at full resolution. Escape, or a button, flies back out to the room.

The mini-OS: a boot animation, a desktop, a dock, windows that drag, resize and stack. Programs that are fun in ten seconds: a terminal with real commands and a few jokes, a paint program, a synth or drum pad (sound only after "Enable sound"), one small game, a notes program with my "about" text, a videos program that lists my course topics, settings with wallpapers. Fast and playful. Everything must work.

Loop and improve at least five times before you show it to me.

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

## Process

1. Build a complete v1. Check it in the headless browser. Fix every error.
2. Run at least 5 improvement rounds. In each round: take three or more screenshots of different moments, views and input states. Read them. Judge them as a harsh art director who compares the picture with the best work of this kind. Name the three weakest things. Fix them. Check again.
3. Measure the frame rate. Under 50 fps at 1920x1080: make it faster before you add anything.
4. Stop when one more round would not show on camera, or at 110 minutes from your start.
5. Final reply, five lines or fewer: what to do in the first five seconds, the best moment and how to reach it, what you used, any known flaw.
````

## 6. The glass lightbulb

What it is: One glass lightbulb, rendered as well as it can be done. Switch it on.

What my run used: Raw WebGL2 path tracer, baked 4K stills, à-trous denoiser, SDF coiled coil.

You need: Claude Code on Claude Fable 5.2, and nothing extra (Blender is optional).

Limits in my run: 5 improvement rounds or more, 80 minutes at most.

Prompt:

````
# The glass lightbulb

I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs.

## Your build: The glass lightbulb

The request: "the absolute highest quality render of a glass lightbulb you have ever seen".

One object: a clear glass filament lightbulb on a dark surface. The goal is the best render of a lightbulb that you can make: a picture that a viewer takes for a studio photograph, and that still reacts.

Physics that the picture needs: glass with real thickness (an inner and an outer surface), correct refraction and Fresnel reflection, light split into colour at thick edges, absorption in the glass, the small flaws that make glass look real (faint dust, a seam, the pinch at the stem). Inside: the glass stem and its mount, the support wires, a tungsten filament as a coiled coil. Below: the threaded metal base with its insulator and contact. Light: soft boxes or a studio HDRI (CC0, for example from Poly Haven) for the reflections, a floor that takes the shadow and the caustics of the bulb. Depth of field, glare around the hot filament, a film tone curve.

A switch turns it on: the filament warms from dull red to white over a moment, the glare grows, and its light falls on the floor through the glass. Drag to orbit.

Method: yours to choose. A strong option is a progressive path tracer in a WebGL2 fragment shader (signed distance shapes or analytic surfaces, many light bounces, spectral sampling) that gathers samples while the view rests and shows a fast preview while it moves. You may also render a still with Blender Cycles to compare against, or to use as the first frame. Compare your picture with what a real photograph of a bulb looks like and close the gap.

Blender jobs: keep each job under 10 minutes. Test with small sizes and few samples first.

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

## Process

1. Build a complete v1. Check it in the headless browser. Fix every error.
2. Run at least 5 improvement rounds. In each round: take three or more screenshots of different moments, views and input states. Read them. Judge them as a harsh art director who compares the picture with the best work of this kind. Name the three weakest things. Fix them. Check again.
3. Measure the frame rate. Under 50 fps at 1920x1080: make it faster before you add anything.
4. Stop when one more round would not show on camera, or at 80 minutes from your start.
5. Final reply, five lines or fewer: what to do in the first five seconds, the best moment and how to reach it, what you used, any known flaw.
````

## 7. The hand-cranked automaton

What it is: A wooden mechanical toy. Turn the crank and watch each cam drive the scene on top.

What my run used: three.js, Blender Cycles baked lightmaps, Python geometry, solved cam kinematics.

You need: Claude Code on Claude Fable 5.2, and Blender.

Limits in my run: 5 improvement rounds or more, 100 minutes at most.

Prompt:

````
# The hand-cranked automaton

I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs.

## Your build: The hand-cranked automaton

This build is stylized on purpose, to stay out of the uncanny valley: nothing that tries to pass for a photograph of a living thing and misses. You have one physical medium. Obey its rules in every pixel. The finish must be extremely high: the picture should look like a photograph of a real handmade object or a real print, not like a filter on a 3D scene. No cookie-cutter look: no low-poly, no voxels, no pixel art, no neon synthwave, no glass UI, no generic cel shading, no default three.js materials. Before you write code, decide the rules of the medium: how an edge looks, how colour is laid down, what the surface is, which flaws the hand or the machine leaves, and how it moves. Hold every frame to those rules.

This is a made object that comes alive. The medium is the star. It starts on load, it loops, and it answers the pointer in the first second.

Your medium: the hand-made wooden automaton (limewood, plywood, brass wire, milk paint), photographed on a bench.

A box with an open front stands on a workbench. Inside: a crankshaft with cams of different shapes (eccentric, snail, heart), followers, levers, a pin wheel, a ratchet, strings over pulleys. On top: a scene of your design that the mechanism drives, with five linked motions or more (for example a small boat that rocks on turned wooden waves, a whale that surfaces and blows, gulls that flap on wires, a lighthouse lamp that turns). Each motion on top comes from the solved mechanism below. Turn the crank slowly and each follower rides its cam correctly. Turn it backward and the ratchet clicks, or the snail cam drops.

Inputs: drag the crank at any speed. A key fades the box walls so that the mechanism shows. Click a part to light it and name it with a short label. A key gives an exploded view. With no input an unseen hand turns the crank with an uneven, human rhythm.

Look: real grain, tool marks, pencil lines left on parts, brass pins and wire, a little glue at joints, and a top scene in matte paint with brush strokes.

Light: bake it. Build the scene in Blender by script and bake Cycles light (soft window light, bounce inside the box, ambient occlusion in the joints) into atlases for the static parts. For the moving parts, bake the light that does not depend on position, and add a live soft shadow.

Blender jobs: test at small size and few samples first. Check every baked file after a job (a job can be cut short).

Bar: a frozen frame passes for a photograph in a craft magazine. A maker could build the mechanism from it.

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

## Process

1. Build a complete v1. Check it in the headless browser. Fix every error.
2. Run at least 5 improvement rounds. In each round: take three or more screenshots of different moments, views and input states. Read them. Judge them as a harsh art director who compares the picture with the best work of this kind. Name the three weakest things. Fix them. Check again.
3. Measure the frame rate. Under 50 fps at 1920x1080: make it faster before you add anything.
4. Stop when one more round would not show on camera, or at 100 minutes from your start.
5. Final reply, five lines or fewer: what to do in the first five seconds, the best moment and how to reach it, what you used, any known flaw.
````

## 8. Whale breach, made in Blender by code

What it is: A humpback breaches at sunrise. Every object, light and frame comes from one Python script.

What my run used: One Python script drives Blender 5.2 (bpy, Eevee), encoded with ffmpeg.

You need: Claude Code on Claude Fable 5.2, and Blender and ffmpeg.

Limits in my run: 3 improvement rounds or more, 70 minutes at most.

Prompt:

````
# Whale breach, made in Blender by code

I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs.

## Your build: Whale breach, made in Blender by code

The subject: the sea. An 8 to 10 second shot at 1920x1080, 24 fps: a humpback whale breaches at sunrise, turns in the air and falls back in a wall of spray. Everything comes from Python that drives Blender (bpy): the whale's body (build and shape it in code), the ocean, the spray and mist, the sun and sky, the camera move, the colour grade. Use Eevee, or Cycles with few samples and denoising, so the whole clip renders in two or three jobs. Encode it to H.264 with ffmpeg as `whale.mp4`. The page plays the clip in a loop (muted), and beside it shows the Python script as it scrolls, with its line count, so a viewer sees that code made the film. Look at single test frames (read them) and fix the shot before the full render: anatomy, scale, water.

Blender jobs: keep each job under 10 minutes. Test with small sizes and few samples first.

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

## Process

1. Build a complete v1. Check it in the headless browser. Fix every error.
2. Run at least 3 improvement rounds. In each round: take three or more screenshots of different moments, views and input states. Read them. Judge them as a harsh art director who compares the picture with the best work of this kind. Name the three weakest things. Fix them. Check again.
3. Measure the frame rate. Under 50 fps at 1920x1080: make it faster before you add anything.
4. Stop when one more round would not show on camera, or at 70 minutes from your start.
5. Final reply, five lines or fewer: what to do in the first five seconds, the best moment and how to reach it, what you used, any known flaw.
````

## 9. Pale: liquid glass in daylight

What it is: A bright glass landing page for an invented water brand: clear drops merge, and light throws caustics on white.

What my run used: three.js, custom GLSL: metaball refraction, analytic caustics, ray-traced glass bottle.

You need: Claude Code on Claude Fable 5.2. Nothing extra.

Limits in my run: 4 improvement rounds or more, 45 minutes at most.

Prompt:

````
# Pale: liquid glass in daylight

I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs.

## Your build: Pale: liquid glass in daylight

The request: an extremely sleek, otherworldly landing page inspired by glassmorphism.

Brand (invented): Pale, mineral water drawn from under a glacier. The opposite of a dark glass page: white on white, full daylight. Clear liquid-glass drops drift, merge and split (metaballs with real refraction), and throw moving caustic light on the white ground. The bottle is the hero: thick clear glass, drawn in code, lit like a studio product shot, turning with the scroll. Glass labels, glass buttons that bend what is under them, type seen through water that distorts and then sharpens. Clinical, calm, costly. A source section, a mineral table, a subscription section, a footer.

This is a complete landing page for an invented brand: hero, four to six sections, a footer. Write real copy with a clear voice. Design it at the level of an Awwwards site of the day: type, spacing, motion and detail must all hold up when I scroll slowly on camera. Smooth scrolling. Every image is drawn in code. Check it at 1920x1080 and at 390 px wide.

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

## Process

1. Build a complete v1. Check it in the headless browser. Fix every error.
2. Run at least 4 improvement rounds. In each round: take three or more screenshots of different moments, views and input states. Read them. Judge them as a harsh art director who compares the picture with the best work of this kind. Name the three weakest things. Fix them. Check again.
3. Measure the frame rate. Under 50 fps at 1920x1080: make it faster before you add anything.
4. Stop when one more round would not show on camera, or at 45 minutes from your start.
5. Final reply, five lines or fewer: what to do in the first five seconds, the best moment and how to reach it, what you used, any known flaw.
````

## 10. The fox knight

What it is: A third-person adventure on a floating meadow: cut grass, fight, solve the shrine puzzle.

What my run used: three.js WebGL, procedural geometry, instanced grass shader, depth outlines, no assets.

You need: Claude Code on Claude Fable 5.2. Nothing extra.

Limits in my run: 3 improvement rounds or more, 45 minutes at most.

Prompt:

````
# The fox knight

I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs.

## Your build: The fox knight

A third-person fantasy adventure with tall grass, a sword and hearts.

An original adventure slice with your own hero, a small fox knight, on a floating meadow island. Thick grass that moves in the wind and that the sword cuts (cut grass stays cut and sometimes drops a gem). Three or four enemies of your own design with clear tells. One puzzle (push blocks, or turn mirrors to route a light beam) that opens a shrine door. A chest with a real reveal moment. Hearts and a gem counter. Light that moves from afternoon to dusk. A stylised look of your own with soft outlines. Movement must feel good: acceleration, turn speed, sword timing, camera follow. No resemblance to the characters, UI, music or world of any existing game.

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

## Process

1. Build a complete v1. Check it in the headless browser. Fix every error.
2. Run at least 3 improvement rounds. In each round: take three or more screenshots of different moments, views and input states. Read them. Judge them as a harsh art director who compares the picture with the best work of this kind. Name the three weakest things. Fix them. Check again.
3. Measure the frame rate. Under 50 fps at 1920x1080: make it faster before you add anything.
4. Stop when one more round would not show on camera, or at 45 minutes from your start.
5. Final reply, five lines or fewer: what to do in the first five seconds, the best moment and how to reach it, what you used, any known flaw.
````

## 11. Embroidery comes to life

What it is: A needle stitches a scene on linen. Then the stitches start to move.

What my run used: raw WebGL2, instanced stitch shader, WebAudio score, one table texture.

You need: Claude Code on Claude Fable 5.2. Nothing extra.

Limits in my run: 3 improvement rounds or more, 45 minutes at most.

Prompt:

````
# Embroidery comes to life

I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs.

## Your build: Embroidery comes to life

The medium is thread. A wooden hoop holds linen with a visible weave. An unseen needle stitches a small scene: a fox, a bird, a child with a kite, grass, a sun. The thread must look like thread: satin stitch with a sheen that follows the stitch direction, chain-stitch outlines, small shadows on the cloth, loose ends. Then the stitched figures move in stitches, about 12 steps a second like stop motion: the fox trots, the wind bends the grass, the kite pulls its own thread loose and the needle sews it back. A 30-second loop. A click on the cloth stitches a flower at that point.

This is a film that plays live in the browser. Build a deterministic timeline: every frame is a pure function of time. It starts on load with no sound and it loops. Space pauses. A thin scrub bar shows at the bottom on hover. A 'Play with sound' button restarts the film with its score (WebAudio, written by you, cut to the picture). Letterbox the picture to the window. Nothing covers the picture.

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

## Process

1. Build a complete v1. Check it in the headless browser. Fix every error.
2. Run at least 3 improvement rounds. In each round: take three or more screenshots of different moments, views and input states. Read them. Judge them as a harsh art director who compares the picture with the best work of this kind. Name the three weakest things. Fix them. Check again.
3. Measure the frame rate. Under 50 fps at 1920x1080: make it faster before you add anything.
4. Stop when one more round would not show on camera, or at 45 minutes from your start.
5. Final reply, five lines or fewer: what to do in the first five seconds, the best moment and how to reach it, what you used, any known flaw.
````

## 12. Mammoth at dawn

What it is: A woolly mammoth drinks at a frozen river. A nature-film shot, made in code.

What my run used: three.js WebGL2: code-built SDF mammoth, 99K fur locks, planar reflection, DOF.

You need: Claude Code on Claude Fable 5.2. Nothing extra.

Limits in my run: 4 improvement rounds or more, 55 minutes at most.

Prompt:

````
# Mammoth at dawn

I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs.

## Your build: Mammoth at dawn

A nature documentary frame from the ice age. One cinematic shot of a woolly mammoth at a half-frozen river at dawn. Aim for a frame that a viewer takes for film: long-lens depth of field, frosted grass in the foreground that moves in the wind, breath vapour in the cold light, fur with real depth (shells and fins, or hair cards) and a warm rim light, a slow weight shift, the trunk that reaches down to drink. A slow dolly, fine film grain, soft bloom. The mouse gives a small parallax. Keys 1 to 3 change the shot (wide, portrait, detail). Anatomy and motion must hold up: study how an elephant stands and moves. Photoreal is the goal.

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

## Process

1. Build a complete v1. Check it in the headless browser. Fix every error.
2. Run at least 4 improvement rounds. In each round: take three or more screenshots of different moments, views and input states. Read them. Judge them as a harsh art director who compares the picture with the best work of this kind. Name the three weakest things. Fix them. Check again.
3. Measure the frame rate. Under 50 fps at 1920x1080: make it faster before you add anything.
4. Stop when one more round would not show on camera, or at 55 minutes from your start.
5. Final reply, five lines or fewer: what to do in the first five seconds, the best moment and how to reach it, what you used, any known flaw.
````

## 13. A tree through the seasons

What it is: One near-photoreal tree through a full year. Scrub the seasons.

What my run used: three.js, space colonisation tree, instanced leaves, custom shaders, Poly Haven bark.

You need: Claude Code on Claude Fable 5.2. Nothing extra.

Limits in my run: 4 improvement rounds or more, 55 minutes at most.

Prompt:

````
# A tree through the seasons

I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs.

## Your build: A tree through the seasons

One hero tree, near-photoreal, through the four seasons. Grow a real branch structure in code (space colonisation or a careful L-system: taper, bark ridges, twigs). Many thousands of instanced leaves that light passes through. A season slider and an automatic cycle: spring buds and blossom, the full summer crown, the autumn turn where leaves change one by one, fall in the wind and gather on the ground, a bare winter tree where snow builds up on the branches and later melts. The light, sky, grass and ground follow the season. A long lens with depth of field and a slow orbit. CC0 bark and ground textures (for example from Poly Haven) are allowed. Each season must make its own good still.

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

## Process

1. Build a complete v1. Check it in the headless browser. Fix every error.
2. Run at least 4 improvement rounds. In each round: take three or more screenshots of different moments, views and input states. Read them. Judge them as a harsh art director who compares the picture with the best work of this kind. Name the three weakest things. Fix them. Check again.
3. Measure the frame rate. Under 50 fps at 1920x1080: make it faster before you add anything.
4. Stop when one more round would not show on camera, or at 55 minutes from your start.
5. Final reply, five lines or fewer: what to do in the first five seconds, the best moment and how to reach it, what you used, any known flaw.
````

## 14. A virus builds itself

What it is: A T4 bacteriophage assembles part by part, lands on a cell and injects its DNA.

What my run used: raw WebGL2, one HTML file, no library, no assets.

You need: Claude Code on Claude Fable 5.2. Nothing extra.

Limits in my run: 3 improvement rounds or more, 45 minutes at most.

Prompt:

````
# A virus builds itself

I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs.

## Your build: A virus builds itself

A whole machine, not only a shell: bacteriophage T4, in one HTML file with no library and no assets. Show the true parts with correct geometry as far as you are sure of it: the elongated icosahedral head built from subunits, the neck and collar, the contractile tail sheath made of stacked rings, the baseplate, six long tail fibres. The sequence: subunits fly in and dock in order, the DNA is packed into the head, the tail joins, the fibres attach. Then it lands on a bacterium, the fibres pin, the sheath contracts and the DNA goes in. A scrub bar, drag to orbit, labels that can be turned off. The look: electron microscope meets studio light, with depth haze and soft shadows. State only biology that you are sure of.

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

## Process

1. Build a complete v1. Check it in the headless browser. Fix every error.
2. Run at least 3 improvement rounds. In each round: take three or more screenshots of different moments, views and input states. Read them. Judge them as a harsh art director who compares the picture with the best work of this kind. Name the three weakest things. Fix them. Check again.
3. Measure the frame rate. Under 50 fps at 1920x1080: make it faster before you add anything.
4. Stop when one more round would not show on camera, or at 45 minutes from your start.
5. Final reply, five lines or fewer: what to do in the first five seconds, the best moment and how to reach it, what you used, any known flaw.
````

## 15. The pop-up book

What it is: Turn the pages of a pop-up book with real paper engineering. Stop half way and look.

What my run used: three.js r186, custom GLSL paper shaders, solved fold kinematics, plywood texture.

You need: Claude Code on Claude Fable 5.2. Nothing extra.

Limits in my run: 4 improvement rounds or more, 70 minutes at most.

Prompt:

````
# The pop-up book

I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs.

## Your build: The pop-up book

This build is stylized on purpose, to stay out of the uncanny valley: nothing that tries to pass for a photograph of a living thing and misses. You have one physical medium. Obey its rules in every pixel. The finish must be extremely high: the picture should look like a photograph of a real handmade object or a real print, not like a filter on a 3D scene. No cookie-cutter look: no low-poly, no voxels, no pixel art, no neon synthwave, no glass UI, no generic cel shading, no default three.js materials. Before you write code, decide the rules of the medium: how an edge looks, how colour is laid down, what the surface is, which flaws the hand or the machine leaves, and how it moves. Hold every frame to those rules.

This is a made object that comes alive. The medium is the star. It starts on load, it loops, and it answers the pointer in the first second.

Your medium: cut and folded card: a pop-up book, photographed in soft daylight.

A large book lies on a table. Each spread is a scene that rises as the pages open. Build it from real pop-up mechanisms and solve their motion from the page angle: parallel folds, V-folds, floating layers, pull tabs, a wheel, a slider. Each piece is a flat card part with fold lines, glue tabs and thickness. A person could build it in paper: nothing stretches and nothing passes through another part. Five spreads tell one small story with a strong last spread (your story).

The viewer drags a page corner to turn it at any speed and can stop half way. Pull tabs and wheels work under the pointer. A key shows the engineer's view (fold lines, glue tabs, part count). With no input the book turns its own pages slowly.

Look: matte coloured card with a faint tooth, white cut edges, folds that are slightly round, soft contact shadows and colour that bounces between layers (real-time soft shadows and ambient occlusion). Paper that looks like plastic fails. Printed detail on the card in a small palette of flat inks.

Bar: a spread that is paused half open passes for a photograph of a real handmade pop-up.

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

## Process

1. Build a complete v1. Check it in the headless browser. Fix every error.
2. Run at least 4 improvement rounds. In each round: take three or more screenshots of different moments, views and input states. Read them. Judge them as a harsh art director who compares the picture with the best work of this kind. Name the three weakest things. Fix them. Check again.
3. Measure the frame rate. Under 50 fps at 1920x1080: make it faster before you add anything.
4. Stop when one more round would not show on camera, or at 70 minutes from your start.
5. Final reply, five lines or fewer: what to do in the first five seconds, the best moment and how to reach it, what you used, any known flaw.
````
