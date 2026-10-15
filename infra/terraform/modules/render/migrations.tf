// Auto-run Drizzle migrations whenever the migration files change OR the
// database is recreated. Uses the Render external connection string because
// `terraform apply` runs on the engineer's laptop (or CI), not on a
// Render-hosted runner, so the DB host must be the public-DNS one. Internal
// hostnames (e.g., dpg-XXX-a) are only reachable from inside Render's
// private network.
//
// Schema notes (render-oss/render v1.8.0):
//   - Connection strings live under the nested `connection_info` attribute,
//     not at the top level: render_postgres.main.connection_info.{internal,external}_connection_string.
//   - external_connection_string is what reaches the DB from outside Render.
//
// External reachability requires `var.postgres_ip_allow_list` to include the
// engineer's / CI runner's IP (or `0.0.0.0/0`); see `database.tf`.
//
// Why we write the URL to a sensitive file instead of passing it via the
// provisioner's `environment` block: Terraform suppresses ALL local-exec
// output when the provisioner directly references a sensitive value (printing
// "(output suppressed due to sensitive value in config)"). Sourcing the URL
// from a file keeps the provisioner free of sensitive interpolation, so any
// migration error stays visible. The URL is still secret on disk:
// file_permission 0600 and `.tmp/` is gitignored.
//
// Why we wait for DB readiness before running drizzle-kit: on a fresh
// `terraform apply` Render's free-tier Postgres reports "create complete"
// while the instance is still booting (~60-90s). drizzle-kit fails fast with
// "Connection terminated unexpectedly" if it hits the DB too early — and
// ora's spinner overwrites the error in non-TTY output, leaving no useful
// signal. We poll a real `SELECT 1` until it succeeds, then migrate once.

locals {
  migrations_dir = "${path.root}/../../../../apps/server/src/db/migrations"

  migrations_hash_value = sha256(join("", [
    for f in fileset(local.migrations_dir, "*.sql") :
    filesha256("${local.migrations_dir}/${f}")
  ]))
}

resource "local_sensitive_file" "migrate_env" {
  content         = "DATABASE_URL=${render_postgres.main.connection_info.external_connection_string}?sslmode=require\n"
  filename        = "${path.module}/.tmp/migrate.env"
  file_permission = "0600"
}

resource "terraform_data" "migrate" {
  triggers_replace = {
    migrations_hash = local.migrations_hash_value
    database_id     = render_postgres.main.id
  }

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    working_dir = "${path.root}/../../../.."
    command     = <<-EOT
      set -euo pipefail
      set -a
      source ${abspath(local_sensitive_file.migrate_env.filename)}
      set +a

      echo "Waiting for database to accept queries..."
      deadline=$(($(date +%s) + 120))
      while [ "$(date +%s)" -lt "$deadline" ]; do
        # Probe runs inside apps/server so node resolves the `pg` module from
        # the workspace's installed dependencies (no separate install needed).
        if (cd apps/server && node -e '
          const { Client } = require("pg");
          const c = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
          c.connect()
            .then(() => c.query("SELECT 1"))
            .then(() => c.end())
            .then(() => process.exit(0))
            .catch(() => { c.end().catch(() => {}); process.exit(1); });
        ') 2>/dev/null; then
          echo "Database is live; running migrations..."
          # apps/server/src/utils/env.ts skips t3-env validation when CI=true;
          # DATABASE_URL is already exported above, and dotenv still loads
          # other vars from apps/server/.env for drizzle.config.ts.
          export CI=true
          # Buffer drizzle-kit output so the spinner spam (~50 frames per
          # second of "[⣷] applying migrations...") doesn't flood the terraform
          # log. On success we print only the final status line; on failure
          # we dump the full buffer for debugging.
          if migrate_output=$(pnpm --filter server db:migrate 2>&1); then
            echo "$migrate_output" | grep -E '✓|migrations applied|No migrations' || echo "Migrations finished."
            exit 0
          else
            echo "Migration command failed. Full output:" >&2
            echo "$migrate_output" >&2
            exit 1
          fi
        fi
        echo "DB not ready, retrying in 5s..." >&2
        sleep 5
      done

      echo "Database did not become ready within 120s." >&2
      echo "Check the Render dashboard and var.postgres_ip_allow_list." >&2
      exit 1
    EOT
  }
}
