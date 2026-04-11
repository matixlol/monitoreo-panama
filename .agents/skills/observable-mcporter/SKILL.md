---
name: observable-mcporter
description: Access Observable notebooks through MCPorter. Use when reading or editing Observable notebooks for this project, especially @rusosnith/visualizaciones-panama.
---

# Observable via MCPorter

Use `bash` with MCPorter for Observable notebook work.

## Config

This project registers the Observable MCP server in `config/mcporter.json` under the name `observablehq` using the git-hosted `matixlol/agents` package, so it is not tied to a local filesystem path.

Always pass the project config explicitly:

```bash
npx -y mcporter --config config/mcporter.json ...
```

## Workflow

1. Inspect the server and tool schemas first:

```bash
npx -y mcporter --config config/mcporter.json list observablehq --schema
```

2. Read notebook metadata:

```bash
npx -y mcporter --config config/mcporter.json call observablehq.observable_get_notebook notebook=@rusosnith/visualizaciones-panama
```

3. Explore cells:

```bash
npx -y mcporter --config config/mcporter.json call observablehq.observable_list_cells notebook=@rusosnith/visualizaciones-panama includeCode=true
npx -y mcporter --config config/mcporter.json call observablehq.observable_find_cells notebook=@rusosnith/visualizaciones-panama query=embeds
npx -y mcporter --config config/mcporter.json call observablehq.observable_get_cell notebook=@rusosnith/visualizaciones-panama name=embeds
```

4. Prefer targeted edits over full rewrites:

```bash
npx -y mcporter --config config/mcporter.json call observablehq.observable_replace_in_cell --args '{"notebook":"@rusosnith/visualizaciones-panama","name":"embeds","oldText":"OLD","newText":"NEW"}'
```

Use `observable_set_cell` only when replacing a whole cell.

## Notes

- Read operations work on public or unlisted notebooks.
- Write operations require `OBSERVABLE_COOKIE` in the shell environment before calling MCPorter.
- The server command comes from `npx -y github:matixlol/agents`, so any machine with Node/npm and Bun available can run the same config.
- For complex payloads like `selectors` or multi-line replacements, use `--args '<json>'`.
- Preserve the embed integration contract: when editing embed-related notebook code, do not remove `window.documentosIngresos` or `window.documentosEgresos` unless the integration is updated too.
