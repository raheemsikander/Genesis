# Setting Up S3-Compatible Storage (Cloudflare R2)

This document covers how to set up S3-compatible file storage using **Cloudflare R2** (but any S3-compatible provider works).

> **Optional** — the app runs fully without it. Set it up when your team needs file upload functionality.

---

## Local Development

For local development you don't need R2 — the project uses **MinIO** as a local S3-compatible substitute. See [`LOCAL_ENV.md`](../LOCAL_ENV.md) (Steps 3 and 5) for setup instructions.

---

## Cloudflare R2 (Deployed Environments)

### Step 1 — Create an R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2 Object Storage** (left sidebar)
2. Click **Create bucket**
3. Name it (e.g. `file-uploads`) — this becomes your `S3_BUCKET` value
4. Pick a region or leave **Automatic** → **Create bucket**

---

### Step 2 — Create API Tokens

1. In the R2 page, click **Manage R2 API Tokens** (top right)
2. Click **Create API token**
3. Name it (e.g. `genesis-staging` or `genesis-prod`)
4. Permissions: **Object Read & Write**
5. Scope: apply to your specific bucket or all buckets
6. Click **Create API Token**

> **Important:** Credentials are shown **once** — copy them immediately.

---

### Step 3 — Map Credentials to Environment Variables

| Env Variable | Where to find it |
|---|---|
| `S3_ENDPOINT` | Shown on the token page after creation, format: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY_ID` | **Access Key ID** shown after token creation |
| `S3_SECRET_ACCESS_KEY` | **Secret Access Key** shown after token creation |
| `S3_REGION` | Set to `auto` for R2 |
| `S3_BUCKET` | The bucket name you created in Step 1 (e.g. `file-uploads`) |

Keep these values handy — you'll paste them into the Render environment group when following the environment setup docs (staging / prod / adding a new env). See [`ENV_VARS.md`](../ENV_VARS.md) for the full variable list.
