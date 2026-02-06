# Docling Serve (Railway)

This service deploys the upstream Docling Serve container to Railway and exposes it over HTTPS.

## Deploy (CLI)

From this directory:

```bash
cd services/docling-serve
railway up --detach -m "Deploy docling-serve"
```

Then set (or confirm) the runtime env var:

- `PORT=5001`

## App Configuration

Set `DOCLING_SERVE_URL` in the environment where Convex node actions run (and locally in `.env.local` as needed):

- `DOCLING_SERVE_URL=https://<your-service>.up.railway.app`

