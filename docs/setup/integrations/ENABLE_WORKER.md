# Enabling the BullMQ Worker

The worker runs background and scheduled BullMQ jobs in a separate process from the API.

- **Locally** — runs automatically as part of `pnpm dev` alongside the web + server processes. Redis from `pnpm infra:up` is its only requirement.
- **On Render** — **disabled by default**. Workers don't have a free tier; the smallest plan (`starter`) is ~$7/mo, so we don't provision one until it's wanted.

The rest of this doc covers enabling the worker on Render.

---

## On Render

### 1. Flip the toggle in tfvars

Edit the env's `terraform.tfvars`:

```diff
- enable_worker    = false
+ enable_worker    = true
```

Do this for whichever env you're enabling (`staging`, `production`, etc.).

### 2. Apply

```bash
cd /path/to/project/infra/terraform/envs/<env>
source .envrc
terraform apply
```

Plan should show **4 resources to add**:

- `module.render.render_background_worker.main[0]` — the worker service
- `module.render.terraform_data.worker_redeploy_on_env_change[0]` — the auto-redeploy hook
- `module.github.github_actions_environment_secret.render_worker_service_id[0]` — adds `RENDER_WORKER_SERVICE_ID` to the GitHub Environment
- The existing `render_env_group_link.main` updates to add the worker to its `service_ids` list

After apply, the worker is running and reachable via Render's dashboard.

### 3. Uncomment the worker deploy step in `.github/workflows/deploy.yml`

The workflow has a worker-deploy step but it's commented out. Uncomment it so day-2 merges redeploy the worker too:

```yaml
- name: Trigger Render worker deploy
  run: |
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST \
      -H "Authorization: Bearer ${{ secrets.RENDER_API_KEY }}" \
      "https://api.render.com/v1/services/${{ secrets.RENDER_WORKER_SERVICE_ID }}/deploys")
    if [[ ! "$http_code" =~ ^2[0-9][0-9]$ ]]; then
      echo "::error::Render worker deploy failed with HTTP $http_code"
      exit 1
    fi
    echo "Worker deploy triggered (HTTP $http_code)"
```

The `RENDER_WORKER_SERVICE_ID` secret is already populated by Terraform from Step 2, so the workflow just needs the step uncommented.

Commit, merge — next deploy redeploys both API and worker.

## Disabling later

Flip `enable_worker = false` and `terraform apply`. Plan shows 4 resources to destroy (worker + redeploy + GitHub secret + the env_group_link's service_ids list shrinks). Comment out the worker deploy step in `deploy.yml` again.
