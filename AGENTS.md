# Project Notes for Agents

- PDFs we scan are either printed tables or printed templates that have been filled out by handwriting.
- `z.toJSONSchema` is a function that converts a Zod schema to a JSON schema. It's integrated into Zod 4.0. Don't install `zod-to-json-schema`.
- Observable notebook for dashboard work: https://observablehq.com/@rusosnith/visualizaciones-panama
- Observable integration contract: when using the embeds module in the notebook, the notebook must set `window.documentosIngresos` and `window.documentosEgresos`. Treat those globals as required API surface; don't remove them unless the embed integration is updated too.

## Sitio

- Don't run a build unless you're instructed to.
