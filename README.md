# monitoreo panama

proyecto freelance - WIP

herramientas para monitorear el flujo de dinero en las elecciones de panamá utilizando los datos públicos de transparencia.


## modulos

- `.` - app de convex para validación de datos
- `./embeds` - librería de componentes que muestran los datos para embeber externamente

## local export data

when `official-json` data changes, regenerate the runtime override file used by the app:

```bash
bun run scripts/build-local-export-data.ts --out src/data/local-export-data.json
```
