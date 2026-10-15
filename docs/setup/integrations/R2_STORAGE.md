# Cloudflare R2 Storage

> **Optional** — the app runs without it. For local development, MinIO is used instead (see [`LOCAL_ENV.md`](../LOCAL_ENV.md)).

Terraform creates the R2 bucket automatically and injects `S3_ENDPOINT`, `S3_REGION`, and `S3_BUCKET` into the Render env group. Follow the steps below to supply the required credentials.

---

## Step 1 — Cloudflare API token (Terraform provider auth)

> Used by Terraform to create the R2 bucket. Never used by the app.

1. In the [Cloudflare Dashboard](https://dash.cloudflare.com), use the **search bar** and search for **API Tokens** → open the result → **Create Token**
2. Scroll past templates → **Create Custom Token** → fill in:
   - **Token name**: e.g. `genesis-terraform`
   - **Permissions**: Account → **Workers R2 Storage** → **Edit**
   - **Account Resources**: Include → All Accounts
3. **Continue to summary → Create Token** — copy the value; shown only once.
4. Paste into **`shared/.envrc`** as `CLOUDFLARE_API_TOKEN`.

---

## Step 2 — Cloudflare Account ID

Sidebar → **Storage & databases → R2 Object Storage** → copy the **Account ID** from the Account Details panel on the right.

Paste into **`shared/.envrc`** as `TF_VAR_cloudflare_account_id`.

---

## Step 3 — R2 runtime credentials

> Used by the running app to read/write files. Terraform never uses this.

1. Same page → **Account Details → API Tokens → Manage → Create API token**
2. Fill in:
   - **Token name**: e.g. `project_name`
   - **Permissions**: Object Read & Write
   - **Specify bucket**: All buckets
3. **Create API Token** — copy both values; shown only once.

| Value | Where to paste |
|---|---|
| **Access Key ID** | `shared/.envrc` → `TF_VAR_s3_access_key_id` |
| **Secret Access Key** | `shared/.envrc` → `TF_VAR_s3_secret_access_key` |

---

## Disabling R2

Set `enable_r2 = false` in `terraform.tfvars`. No Cloudflare resources will be provisioned and the app runs without file storage.
