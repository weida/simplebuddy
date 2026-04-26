# Simple Buddy Allocator

Browser-based buddy memory allocation visualizer, with the original C reference implementation kept in the repository.

**Live demo:** https://weida.github.io/simplebuddy/

![Simple Buddy autoplay demo](assets/simplebuddy-demo.gif)

## Highlights

- Visualizes allocation, splitting, freeing, and coalescing
- Shows contiguous memory, split tree, and `free_area` lists by order
- Supports step-by-step execution, autoplay, and playback speed control
- Displays allocated capacity, internal fragmentation, and the buddy formula
- Pure static HTML, CSS, and JavaScript; no build step required

## Project Layout

```text
simplebuddy/
├── README.md
├── .gitignore
├── index.html              # GitHub Pages root entry, redirects to web/
├── assets/
│   └── simplebuddy-demo.gif
├── c/                      # C reference implementation
│   ├── buddy.c
│   ├── buddy.h
│   ├── buddytest.c
│   ├── list.h
│   └── Makefile
├── scripts/
│   └── capture_demo_gif.py
└── web/                    # Browser visualizer
    ├── index.html
    ├── styles.css
    └── app.js
```

The `c/` and `web/` directories are independent.

## Algorithm In 60 Seconds

- Memory is divided into fixed-size pages. This demo uses `16` pages, `64K` each
- Each order has a free list: `free_area[order]`
- A block at order `i` contains `2^i` pages
- Allocation rounds the request up to the smallest power-of-two block
- If the target order is empty, a larger block is split repeatedly
- Freeing uses `buddy = pfn XOR 2^order` to locate the buddy block
- Coalescing happens only when the buddy is free and has the same order
- Internal fragmentation = allocated capacity - requested capacity

## Run The C Version

```bash
cd c
make
./buddytest
```

Note: the original C code intentionally keeps its older style. Newer GCC versions may fail on implicit function declarations. If compatibility is needed, make that a focused C-only change.

## Run The Web Demo Locally

The Web demo is fully static. A local static server is recommended:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/web/
```

You can also open `web/index.html` directly in a browser.

## Publish To GitHub Pages

The live site is served from the `gh-pages` branch. After changing `web/`, commit to the main branch first:

```bash
git add web/index.html web/styles.css web/app.js
git commit -m "Update web demo"
git push origin master
```

Then publish the `web/` subtree to `gh-pages`:

```bash
COMMIT=$(git subtree split --prefix web)
git push origin $COMMIT:gh-pages
```

GitHub Pages may cache the old version for a few minutes.

## Regenerate The Demo GIF

The README GIF is captured from the live demo via Chromium DevTools:

```bash
python3 scripts/capture_demo_gif.py \
  --url https://weida.github.io/simplebuddy/ \
  --width 1280 \
  --height 860 \
  --scale 0.9 \
  --seconds 13 \
  --fps 12 \
  --jpeg-quality 92 \
  --initial-wait 3
```

## Future Improvements

- Fix C compatibility with newer GCC versions
- Animate splitting and coalescing at a finer frame level
- Explain why certain blocks cannot be merged
- Align C output and Web logs more strictly
- Allow custom page size, page count, and max order
