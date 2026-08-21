# RIN consistency video: R2 object moved (2026-08-21)

official_actors/actor-3-beauty-cf/consistency_i2v.mp4 -> official_actors/rin/consistency_i2v.mp4
When: 2026-08-21
Why: old object key/URL contained "beauty-cf" (public r2.dev URL, no signing) -- a leak vector for the
  main-round theme, which must stay hidden until 11/9. Moved off the public path under that name.
ETag: 9e98b694e40e8334ee0a8af823ca4473 (matched on source and destination before delete -- same bytes, path only changed)
Size: 13992842 bytes

official_actors.provenance.motion_consistency.clip in the DB deliberately still reads the OLD path
(official_actors/actor-3-beauty-cf/consistency_i2v.mp4). That field is NOT a serving URL -- it is an
archival record of how the video was produced, and it is inside the CryptoBind-signed provenance hash
(see scripts/actor-rename-plan.mjs). Editing it would change provHash and invalidate the existing
cryptobind_signature. Left untouched intentionally, same call already made for the 2026-08-08 image
slug rename.

If anyone follows that provenance string later, it will 404 (source object deleted 2026-08-21). This
file is the trail: same content (etag match), new key is official_actors/rin/consistency_i2v.mp4.
