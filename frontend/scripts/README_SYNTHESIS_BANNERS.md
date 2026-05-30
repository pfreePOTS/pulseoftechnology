# Recommended Path — synthesis card banners

Cards in **Recommended Path → Our Process** (`SynthesisCardBandImages`) composite:

1. **Industry wash** — `public/images/industry-synthesis/{slug}-v{N}.jpg` where **N ∈ 1…6** (deterministic variant per card slot — see `synthesisBannerVariants.ts`)
2. **Topic / focus strip** — `public/images/synthesis-focus/{slug}-v{N}.jpg` (**N** as above — independent lane from industry so a row rarely repeats the same pair)

Layers use `object-fit: cover` inside a fixed-height band (~148–172px tall by breakpoints). Targets below minimize ugly side cropping on typical desktop card widths (~250–285px).

## Raster spec (hand-off to design / Midjourney / stock)

| Property | Target |
|---------|--------|
| **Aspect** | **8:5** (e.g. **1600 × 1000 px**) |
| Format | JPEG, sRGB |
| Orientation | Landscape; **composition centered** — important subject in **middle vertical third** |
| Highlights | Enough contrast for a **bottom white gradient** (~35% overlay) |
| Naming | Base slug (ASCII, lowercase, hyphens) + ``-v1`` … ``-v6`` — ship every variant listed in ``generate_synthesis_banner_placeholders.py`` so the picker always hits a valid file. |

Industry slugs map from `ExecutiveIntakeForm` / `INDUSTRY_OPTIONS` via `slugifyIndustryLabel`:

`healthcare`, `financial-services`, `technology`, … and **`default`** — ship ``default-v1.jpg`` … ``default-v6.jpg`` alongside other industries.

When normalizing photographs, rename outputs to `{slug}-v{N}.jpg` (you can duplicate one crop across several slots if supply is thin).

Focus bands (`ISSUES[].value`): `cybersecurity`, `ai`, `compliance`, `cloud`, `it-management`, `strategy`, `other`.

Avoid ultra-wide panorama formats (≤2:1 landscape); tall narrow crops look “letterboxed.”

Older single-file layout ``{slug}.jpg`` without ``-vN`` is obsolete — the generator prunes those on rerun.

## Regenerate procedural placeholders

If you swap in real photography, optionally delete old JPEGs then:

```bash
cd frontend/scripts
pip install -r requirements-banner.txt
python generate_synthesis_banner_placeholders.py
```

Commits should include updated `frontend/public/images/**/*.jpg` when assets change.

## Normalize arbitrary photos into the spec

```bash
python normalize_synthesis_banner_images.py ~/Downloads/raw-shots/*.jpg output-dir/
```

Outputs `*-1600x1000.jpg` at the standard size (cover crop, center weighted). Rename or copy into `{slug}-v{N}.jpg` (N ∈ 1…6) under `public/images/industry-synthesis/` or `public/images/synthesis-focus/`.
