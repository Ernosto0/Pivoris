# Bundled fonts

The same unmodified Manrope and Inter variable WOFF2 files the app uses
(`frontend/src/assets/fonts/`, see `frontend/public/fonts/SOURCES.md` for provenance and
checksums). They live in `src/assets/fonts/`; Vite emits content-hashed URLs, so visitors'
browsers make no request to a font CDN. Both fonts use the SIL Open Font License 1.1; the
licences are in this directory.

Instrument Serif (regular and italic, latin and latin-ext subsets) is used only for the hero
headline. The WOFF2 files are unmodified copies from `@fontsource/instrument-serif` 5.3.0
(`files/instrument-serif-{latin,latin-ext}-400-{normal,italic}.woff2`). SIL Open Font
License 1.1: `OFL-instrument-serif.txt`. SHA-256:

- `instrument-serif-latin-400-normal.woff2` 5eb09b5ac0e28b67c2f041c8ba6d244604ca0c0980d65912ab2d47fed84ddc31
- `instrument-serif-latin-400-italic.woff2` 5a51946dfffa82972bc98745359c46761515641fda557c25116459a9f83da4a7
- `instrument-serif-latin-ext-400-normal.woff2` 290e6267dd833bf5f899eba4c29ad0a9b09dbe53f6075b18af38057159e1ff20
- `instrument-serif-latin-ext-400-italic.woff2` d0014821252a8a770bf7551641572f239a8ede83d75652d84fef0c3627751baf
