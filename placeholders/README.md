# Placeholders

This folder ships with neutral placeholder imagery so the app has something
tasteful to show before you add your own photos. **Replace any file with your
own to swap that placeholder.** File names matter — keep them.

## Files

| File | Used for | How to swap |
| ---- | ---- | ---- |
| `photo-01.jpg` … `photo-12.jpg` | The 12 photos seeded into each month's detail-view carousel (one image per month, in order: January → December). | Replace any `photo-NN.jpg` with your own photo for that month. Any image format is fine; the app loads them as files at startup. |
| `calendar-bg.jpg` | The full-bleed background image behind every monthly calendar card on the calendar (Step 3) view. | Drop your own image in at this path. Keep the filename. |

That's it — there's no manifest to edit and no JS to touch. The app reads
these paths directly at startup via `fetch()`. If you want to use different
file names, change `PLACEHOLDER_PHOTOS` and `PLACEHOLDER_BG` near the top of
`app.js`.
