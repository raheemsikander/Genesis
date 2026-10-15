# Destroying a Deployed Environment

`terraform destroy` tears down everything Terraform owns in an env — services, Postgres, Redis, secrets, R2 bucket, Vercel env vars, GitHub secrets.

> **Irreversible.** Drops the database, wipes Redis, deletes the R2 bucket. Snapshot anything you want back first. Use [`PAUSE_SERVICES.md`](PAUSE_SERVICES.md) instead if you just want to stop billing.

---

## Procedure

Four resources have `lifecycle.prevent_destroy = true` so destroy fails by default:

- `render_postgres.main` — `infra/terraform/modules/render/database.tf`
- `render_keyvalue.main` — `infra/terraform/modules/render/redis.tf`
- `render_env_group.main` — `infra/terraform/modules/render/project.tf`
- `cloudflare_r2_bucket.main` — `infra/terraform/modules/cloudflare/main.tf`

To destroy on purpose:

1. In all four files, flip `prevent_destroy` to `false`.
2. Run destroy:

   ```bash
   cd infra/terraform/envs/<staging|production>
   source ../shared/.envrc && source .envrc
   terraform destroy
   ```

3. Revert all four back to `prevent_destroy = true` and commit — the guard is module-wide, so leaving it off weakens every other env.

The shared workspace (Render + Vercel project shells) is not touched — destroy it separately from `envs/shared/` if you want the whole project gone.
