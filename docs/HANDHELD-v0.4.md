# Hand-held study · v0.4

This is a separate comparison candidate. The liked v0.3 glass-and-plinth exhibit was fully backed up before this directory was created, and its private Site is preserved independently.

## Visual construction

The actual supplied metal-card GLB and original card faces are retained. The relief and original-face fallback layers are registered CPU renders of that geometry, not image-generated artwork. A new hand animation is built from one licensed, weighted mesh and one skeletal action. Its poses are sampled into transparent images; they are not unrelated generated hands or image dissolves. The hand begins partially curled and opens while descending. Only then does the card lift and turn before the five original fronts expand into the catalogue.

Hand surface detail is an authored derivative. Any generated skin texture is used as a fixed surface on the unchanged animated mesh, not as a new pose per frame. Geometry, source license, prompts, texture provenance, sample poses and output hashes are retained with the source project.

The scene is synthetic. Its overlap is visually registered; the generous card/hand clearance is not a measured zero-gap physical grasp. It is not a photograph of an actual person holding a manufactured card.

## Playback

Native scroll determines absolute progress. The hand opening occupies progress 0–0.30; withdrawal 0.30–0.50; card lift 0.32–0.54; rotation 0.42–0.78; catalogue expansion follows. Reverse scroll selects the same pose at the same position.

A demand-driven controller decodes both hand layers before switching either. Its decoded cache is bounded to five pose pairs. Optional same-origin HTTP-cache warming uses at most two downloads, does not decode all frames, and is disabled for reduced motion and Save-Data. Hidden pages and disposal cancel background work. Failed frames preserve the previous successfully decoded pose. No wheel interception, scroll hijacking or continuous render loop is used.

Reduced motion keeps the starting scene static and provides the catalogue below without the pinned animation. The five original work pages, five previews and five scan entry points remain available. Preview does not count toward collection.

## Validation

See `QA-STATUS.md` for the actual current results and remaining limitations. Automated geometry/state checks and rendered fallback browser checks do not prove live WebGL quality or physical iPhone card recognition.

## Screen registration

The final hand raster is presented at scale 1.28 around the common (50%, 73%) contact reference, with an opening-dependent screen-height offset from -6.6% to -0.6%. This presentation adjustment closes the initial visible gap, initially occludes part of the lower card, and gives the palm a more natural scale next to the card. As the fingers unfold the hand descends and reveals that lower area. It affects both hand layers equally and does not invent alternate poses or change the source artwork. The model-space clearance report applies to the rendered rig before this display registration; it is not a physical-contact measurement for the webpage composite.
