# monitoreo panama

proyecto freelance - WIP

## local export data

when `official-json` data changes, regenerate the runtime override file used by the app:

```bash
bun run scripts/build-local-export-data.ts --out public/local-export-data.json
```
