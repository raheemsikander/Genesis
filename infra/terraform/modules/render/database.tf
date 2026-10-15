// Render Postgres instance.
//
// Schema notes (render-oss/render v1.8.0):
//   - `render_postgres` does NOT accept `project_id`. The instance is bound
//     to the project indirectly via `environment_id`, which points at the
//     environment nested under `render_project.main.environments`.
//   - `version` is required. We pin to "16" for a recent stable major.
//   - Connection strings are exposed under the nested `connection_info`
//     attribute (sensitive): `connection_info.internal_connection_string`
//     for in-Render-network access and `connection_info.external_connection_string`
//     for outside access. Both are computed and sensitive.
//   - `lifecycle.prevent_destroy` guards against accidental data loss; the
//     database must be removed manually (or the lifecycle block edited)
//     before `terraform destroy` will succeed.

resource "render_postgres" "main" {
  environment_id = var.environment_id
  name           = "${local.resource_prefix}-postgres"
  database_name  = var.project_name
  database_user  = var.project_name
  plan           = var.postgres_plan
  region         = var.region
  version        = "16"
  ip_allow_list  = var.postgres_ip_allow_list

  lifecycle {
    prevent_destroy = true
  }
}
