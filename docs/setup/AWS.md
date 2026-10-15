# Deploying to AWS with Terraform

This guide runs the whole platform on AWS: API, web app, database, Redis, file storage and CDN, all provisioned from `infra/aws/` and deployed by `.github/workflows/deploy-aws.yml`.

It is an **alternative** to the Render + Vercel stack ([`STAGING.md`](STAGING.md)). The two stacks share nothing (code, state, accounts or secrets), so a project picks one. The repo variable `DEPLOY_TARGET` decides which deploy workflow runs: `aws` runs `deploy-aws.yml`; anything else (or unset) runs the Render + Vercel `deploy.yml`.

---

## What gets created

```
                  ┌──────────────── CloudFront ────────────────┐
  browser ──────▶ │  web distribution      api distribution    │  HTTPS (*.cloudfront.net or your domains)
                  └──────────┬────────────────────┬────────────┘
                             │  VPC origin (no public ALB)
                  ┌──────────▼────────────────────▼────────────┐
                  │  internal ALB  (X-Origin-Target: web|api)  │  private subnets
                  └──────────┬────────────────────┬────────────┘
                     ECS Fargate: web        ECS Fargate: api  (+ optional worker)
                             │                    │
                             └──── RDS Postgres ──┤  private subnets
                                   ElastiCache ───┘
                                   S3 uploads bucket
```

| Root | Applied | Creates |
|------|---------|---------|
| `infra/aws/bootstrap` | once per AWS account | S3 bucket for Terraform state; writes `infra/aws/backend.hcl` |
| `infra/aws/envs/shared` | once per AWS account | ECR repos (`<project>/api`, `/web`, `/migrate`), GitHub OIDC provider |
| `infra/aws/envs/staging`, `envs/production` | per environment | VPC, RDS, ElastiCache, S3, Secrets Manager, ECS cluster + services, internal ALB, CloudFront, GitHub deploy role, SSM deploy config |

**Images:**
- **API:** the root `Dockerfile`, the same image Render runs.
- **Web and migration images:** `infra/aws/docker/Dockerfile` (targets `web` and `migrate`).
- **Web build:** Next.js `output: "standalone"`, switched on by `NEXT_OUTPUT=standalone`, which only that Dockerfile sets. Vercel builds are unchanged.

### Network modes

Set `network_mode` in each environment's `terraform.tfvars`:

| Mode | ECS tasks run in | NAT gateway | Notes |
|------|------------------|-------------|-------|
| `public` (default) | public subnets, with public IPs | none | Cheapest. The task security group only admits the ALB, so nothing else can reach the tasks. |
| `private` | private subnets | 1 (or one per AZ with `nat_gateway_per_az = true`) | Tasks have no public address. NAT costs about $32/mo each, plus data processing. |

RDS, ElastiCache and the ALB are in private subnets in both modes. You can switch modes later with `terraform apply`; ECS replaces the tasks.

### Rough monthly cost (us-east-1, before traffic)

| Environment | Main items | ≈ / month |
|-------------|------------|-----------|
| Staging (tfvars as shipped) | 2 small Fargate tasks, `db.t4g.micro`, `cache.t4g.micro`, ALB, 2 public IPs | $75–90 |
| Production (tfvars as shipped) | 4 Fargate tasks, Multi-AZ `db.t4g.small`, 2× `cache.t4g.small`, ALB | $200–240 |
| `private` network mode | + NAT gateway(s) | +$35 each |

These are list prices; check the AWS Pricing Calculator for your region.

---

## Prerequisites

- **An AWS account** where you can create IAM roles, VPCs, RDS, ECS and CloudFront. AdministratorAccess is simplest for the first apply.
- **AWS credentials in your shell.** An `AWS_PROFILE` (SSO or access keys) works; `aws sts get-caller-identity` must succeed.
- **Terraform 1.10 or later**, which is needed for S3 native state locking: `brew install hashicorp/tap/terraform`
- **The `gh` CLI**, signed in to an account with admin on the repo.
- **Clerk keys:** test keys for staging, live keys for production. A production Clerk instance also needs a custom domain (see [Custom domains](#custom-domains)).

> Use the client-owned dev identity (see Step 1 of [`STAGING.md`](STAGING.md)) for the AWS account as well, so access survives engineer rotation.

---

## Step 1: Bootstrap the state bucket (once per account)

Check `project_name` and `region` in `infra/aws/bootstrap/terraform.tfvars`, then:

```bash
cd infra/aws/bootstrap
terraform init
terraform apply
```

This creates a versioned, encrypted bucket `<project>-tfstate-<account-id>` and writes `infra/aws/backend.hcl`. **Commit `backend.hcl`**: every other root reads it. The bootstrap's own state stays in the local `terraform.tfstate` (gitignored). If that file is ever lost, re-import the bucket with `terraform import aws_s3_bucket.state <bucket>`.

Commit the `.terraform.lock.hcl` file each root creates on its first `terraform init`, so every engineer and CI resolve the same provider versions.

## Step 2: Shared resources (once per account)

```bash
cd ../envs/shared
terraform init -backend-config=../../backend.hcl
terraform apply
```

If the account already has a GitHub OIDC provider (`token.actions.githubusercontent.com`), the apply fails with `EntityAlreadyExists`. Set `create_github_oidc_provider = false` in `terraform.tfvars` and apply again.

## Step 3: Configure the environment

```bash
cd ../staging
cp .envrc.example .envrc     # gitignored
```

1. **Fill in `.envrc`:** `AWS_PROFILE`, the Clerk keys and any optional integrations.
2. **Review `terraform.tfvars`:**
   - `github_repository`: the `owner/repo` that may deploy
   - `network_mode`
   - instance sizes
   - `domains`

## Step 4: Apply the environment

```bash
source .envrc
terraform init -backend-config=../../backend.hcl
terraform plan -out=staging.tfplan
terraform apply staging.tfplan
```

The first apply takes about 15–25 minutes; CloudFront VPC origins and RDS are the slow parts. When it finishes, the outputs show `web_url`, `api_url` and a `github_setup` block.

The ECS services exist now but have no images yet, so their tasks fail to start until the first deploy (Step 6). That's expected.

## Step 5: Connect GitHub

Run the commands from the `github_setup` output. They set:

| Variable | Scope | Purpose |
|----------|-------|---------|
| `AWS_DEPLOY_ROLE_ARN` | `staging` environment | IAM role the workflow assumes over OIDC (no AWS keys stored in GitHub) |
| `AWS_DEPLOY_CONFIG_PARAMETER` | `staging` environment | SSM parameter holding cluster, service, subnet and ECR details |
| `AWS_REGION` | repository | Region for the AWS CLI |
| `DEPLOY_TARGET` | repository | `aws` switches deploys from `deploy.yml` to `deploy-aws.yml` |

The deploy role only trusts jobs running in the matching GitHub Environment. For the `production` environment, add a deployment branch rule limiting it to `main` (repo **Settings → Environments → production**).

## Step 6: First deploy

Actions → **Deploy (AWS)** → **Run workflow** on `develop`. You can also merge anything into `develop`.

The workflow:
1. Builds the api, migrate and web images and pushes them under their commit SHA. The web image is built per environment because `NEXT_PUBLIC_*` values are baked in.
2. Runs Drizzle migrations as a one-off Fargate task inside the VPC, and stops if they fail.
3. Moves the `:staging` tag to the new api and web images.
4. Forces a new ECS deployment and waits until the services are stable. If the new tasks fail health checks, the deployment circuit breaker rolls back automatically.

## Step 7: Verify

- Open `web_url`, sign up through Clerk and land on `/portal`.
- `curl <api_url>/health` → `{"ok":true}`
- `curl <api_url>/health/detailed` → Postgres, Redis and S3 all `ok`.

---

## Production

Repeat Steps 3–7 in `infra/aws/envs/production`, using live Clerk keys in `.envrc`. Its `main.tf`, `variables.tf`, `outputs.tf` and `versions.tf` are symlinks to staging's, so the environments differ only in `backend.tf`, `terraform.tfvars` and `.envrc`.

As shipped, production's `terraform.tfvars` sets:
- Multi-AZ RDS with 14-day backups and deletion protection
- a 2-node Redis with automatic failover
- 2–6 autoscaled tasks per service
- S3 versioning
- 90-day log retention

Consider `network_mode = "private"` with `nat_gateway_per_az = true`.

Pushes to `main` deploy production once `AWS_DEPLOY_ROLE_ARN` and `AWS_DEPLOY_CONFIG_PARAMETER` are set on the `production` GitHub Environment.

## Custom domains

The domains must live in a Route 53 hosted zone in the same AWS account. In `terraform.tfvars`:

```hcl
domains = {
  zone_name = "example.com"
  web       = "app.example.com"
  api       = "api.example.com"
}
```

On apply, Terraform:
- requests an ACM certificate in us-east-1 for both names
- validates it through DNS
- attaches it to the distributions
- creates the A and AAAA alias records

`CORS_ORIGIN` and `NEXT_PUBLIC_SERVER_URL` follow automatically. Run the deploy workflow afterwards so the web image picks up the new API URL.

---

## Day-2 operations

### Change an environment variable

Edit `.envrc` or `terraform.tfvars`, then `terraform apply`. What happens next depends on the variable:

| Kind of change | What to do next |
|----------------|-----------------|
| **Server-side** (Clerk secret, Resend, Rollbar server token, `CORS_ORIGIN`) | Nothing. The values land in Secrets Manager or the task definition, and ECS rolls the services when the task definition changes. |
| **Only a secret's value changed** (same keys as before) | Run the deploy workflow, or `aws ecs update-service --cluster <cluster> --service api --force-new-deployment`. The task definition doesn't change, so containers keep the old value until they restart. |
| **`NEXT_PUBLIC_*`** | Run the deploy workflow; these values are baked into the web image. |

Adding a brand-new app variable: see the AWS section of `.claude/skills/cl-adding-environment-variable/references/env-vars.md`.

### Enable the BullMQ worker

Set `worker = { enabled = true }` in `terraform.tfvars` and apply. The worker runs the api image with the worker entrypoint, and the deploy workflow rolls it alongside the other services.

### Shell into a running task

```bash
aws ecs execute-command --cluster <cluster> --task <task-id> --container api --interactive --command sh
```

This needs the Session Manager plugin for the AWS CLI.

### Logs

CloudWatch log groups `/ecs/<project>-<env>/{api,web,worker,migrate}`. Tail one with:

```bash
aws logs tail /ecs/<project>-<env>/api --follow
```

### Roll back

Every image keeps its commit-SHA tag. To roll back:

1. Point the environment tag at an earlier commit:
   ```bash
   docker buildx imagetools create --tag <repo>:<env> <repo>:<sha>
   ```
   For web, the source tag is `<env>-<sha>`.
2. Force a new deployment.

Revert migrations by hand if the schema changed.

### Tear down an environment

1. Set `deletion_protection = false` and apply.
2. Run `terraform destroy`.

RDS takes a final snapshot unless deletion protection was already off. The uploads bucket must be empty before Terraform can delete it. Leave the shared root and the state bucket in place while any environment exists.

---

## Known limitations

- **Storage credentials:** the server's storage client takes static S3 keys, so Terraform mints a bucket-scoped IAM access key. Its secret lives in Terraform state (an encrypted, private bucket) and in Secrets Manager. Supporting the ECS task role in `apps/server/src/storage/client.ts` would remove the key.
- **RDS certificate checks:** the database URL uses `sslmode=no-verify`. Traffic is TLS-encrypted inside the VPC, but the RDS certificate isn't verified, which is the same trade-off as Render's internal URL.
- **Apps see `http` as the protocol:** CloudFront reaches the internal ALB over plain HTTP inside the VPC, so the ALB sets `X-Forwarded-Proto: http`. Absolute redirects the app builds itself (Next.js middleware, Clerk handshakes) go through one extra hop, which CloudFront upgrades to HTTPS with a 301. Fixing this would mean an HTTPS listener on the ALB, which needs a certificate for a custom domain.
- **No WAF or alarms:** a WAF on the CloudFront distributions and CloudWatch alarms (5xx rate, CPU, RDS storage) are not set up yet.
- **x86 only:** images build for `linux/amd64`. Switching to Graviton (ARM) Fargate would cut compute cost by about 20%, but needs ARM builds.
