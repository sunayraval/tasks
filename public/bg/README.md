# TaskIt Video Background Presets (`/public/bg/`)

Place optimized looping `.webm` files here if you want static asset video loops in addition to the built-in 60fps procedural particle/rain/cyber/lofi canvas and IndexedDB custom uploader:
- `/public/bg/rain.webm`
- `/public/bg/cyber.webm`
- `/public/bg/lofi.webm`
- `/public/bg/particles.webm`

When a user uploads any custom `.mp4` or `.webm` video in **Settings → Appearance & Video**, `VideoBackground.tsx` stores the `Blob` directly inside browser IndexedDB via `idb-keyval` (`set('custom_video_bg', fileBlob)`) and plays it via `URL.createObjectURL()` with **zero server or Vercel bandwidth usage**.

