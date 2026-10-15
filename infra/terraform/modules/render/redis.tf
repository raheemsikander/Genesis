// Render Key Value (Redis-compatible) instance.
//
// Schema notes (render-oss/render v1.8.0):
//   - The Redis-equivalent resource is `render_keyvalue` (not `render_redis`
//     and not `render_key_value`). Confirmed against the provider source:
//     `resp.TypeName = req.ProviderTypeName + "_keyvalue"`.
//   - Like `render_postgres`, this resource does NOT accept `project_id`. It
//     binds to the project indirectly via `environment_id`, which points at
//     the environment nested under `render_project.main.environments`.
//   - Unlike `render_postgres`, no `version` argument exists for key value.
//   - `max_memory_policy` is required. We pin to "noeviction" so the cache
//     never silently drops keys (jobs/sessions break loudly instead).
//   - `ip_allow_list` is a Set of objects shaped `{ cidr_block, description }`
//     (not a list of strings). Setting it to `[]` blocks all public-internet
//     ingress; the instance is still reachable over Render's private network.
//   - Connection details are exposed under the nested `connection_info`
//     attribute: `connection_info.internal_connection_string` (in-Render),
//     `connection_info.external_connection_string` (outside), and
//     `connection_info.cli_command`. All computed and sensitive.
//   - `lifecycle.prevent_destroy` guards against accidental cache wipe; the
//     resource must be removed manually (or the lifecycle block edited)
//     before `terraform destroy` will succeed.

resource "render_keyvalue" "main" {
  environment_id    = var.environment_id
  name              = "${local.resource_prefix}-redis"
  plan              = var.redis_plan
  region            = var.region
  max_memory_policy = "noeviction"
  ip_allow_list     = []

  lifecycle {
    prevent_destroy = true
  }
}
