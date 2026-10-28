# Red Alert 1 PNG to INI [PreviewPack] Generator

A web tool for Command & Conquer: Red Alert 1 and Tiberian Sun map makers. Convert any PNG or screenshot into authentic `[Preview]` and `[PreviewPack]` INI sections ready to paste directly into `.mpr` and `.ini` map files.

Compatible with **xna-cncnet-client**, **XCC Mixer**, and classic 1996 Westwood engines.

---

## Features

- **CnCNet XNA Client Standard**: Generates truecolor 24-bit RGB pixel data partitioned into 8192-byte chunks and compressed with LZO1X (100% compatible with `xna-cncnet-client`'s `MapPreviewExtractor.cs`).
- **Classic Westwood LCW (Format80)**: Supports original 1996 DOS / EDWIN 8-bit palette-indexed mode with Temperate, Snow, and Interior theater palettes.
- **Smart Auto-Scaling & Line Budget Control**: Automatically resizes uploaded screenshots to the recommended `< 257px` standard (~800–1,100 lines) to avoid massive 23,000+ line map files and eliminate lobby lag.
- **Interactive Line Budget Slider**: Set a target line count (e.g. 500, 1000, 2000 lines) and the app dynamically calculates the optimal pixel grid.
- **LZO Noise Filter Boost**: Truncates microscopic sensor/photo noise in 24-bit RGB to increase repeating byte runs for LZO, shrinking line counts by up to 35% with zero perceptible visual loss.
- **Prepare Maps Batch Workflow**: Batch process collections of RA1 maps (`.mpr`, `.ini`, `.map`) with non-destructive `[Basic]` metadata editing (`Name`, `Author`, `GameMode`, `MaxPlayer`, `MinPlayer`), Windows-safe filename sanitization, automatic author extraction (`Map Name by Author`), category prefixing (`1v1` 2_ / [2], `2v2` 4_ / [4], `3v3` 6_ / [6], `4v4` 8_ / [8]), collision prevention, optional preview injection, untouched original backups in `backup/originals/`, companion previews in `previews/`, and download all in a single structured ZIP with `summary.json`.
- **Batch Map Studio**: Batch render full-resolution PNG maps with original Westwood 24×24 assets or tactical vector rendering, batch inject authentic previews, or batch strip bloated 23k-line blocks.
- **Map File Injector**: Upload an existing `.mpr` or `.ini` map file and inject or update the preview block with 1 click.
- **Reverse Preview Decoder**: Paste any existing `[PreviewPack]` INI snippet to reconstruct and inspect the preview image.

---

## Hosting on GitHub Pages (Free)

This project is a 100% client-side Single Page Application (SPA). All compression, quantization, and rendering happen locally in the browser — no backend server is needed.

### Quick Setup:
1. Push this repository to GitHub.
2. In your GitHub repository, navigate to **Settings** → **Pages**.
3. Under **Build and deployment** → **Source**, select **GitHub Actions**.
4. The included `.github/workflows/deploy.yml` workflow will automatically build and publish your site to `https://<your-username>.github.io/<repo-name>/`!

---

## Local Development

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Build for production
npm run build
```
