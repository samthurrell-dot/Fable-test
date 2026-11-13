# Prompt snippet: card mesher and print atlas

Paste this into a prompt for any build made of cut card, paper or other flat sheet with visible thickness.

> Use the card mesher and print atlas in `knowledge/card-mesh-atlas/engine/` (`cardmesh.js`, `atlas.js`). Read its CARD.md first and open `demo.html`, including its "what each triangle is" view. Every flat piece is an outline in centimetres passed to `mesh.addPart`; do not hand-build triangles for card and do not put silhouettes in a texture with alpha. Mark every edge that is a fold into a glue tab with `foldEdge`. Draw print with the Canvas 2D API through `buildAtlas`, in the same centimetres as the outline. Take the vertex shader from the demo (or use the paper renderer card, which already has it); keep the vertex layout as it is. Do not edit the engine files. Frames can come from the fold engine (`rig.pack()`) or from any code that writes 12 floats a panel. After the first build, look at one close-up of an edge, one of a fold and one of a foot before going further.

Goes with `knowledge/paper-fold-kinematics` (where the frames come from) and `knowledge/paper-renderer` (which draws this mesh with soft light).
