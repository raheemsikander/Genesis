// Module outputs.
//
// Schema notes (render-oss/render v1.x):
//   - The provider exposes `render_web_service.main.url` (Computed) but does
//     NOT expose deploy hook URLs as either an attribute or a separate
//     resource. Render's deploy hook URL pattern is documented as
//     `https://api.render.com/deploy/<service-id>?key=<dashboard-issued-key>`,
//     and the `?key=...` suffix is dashboard-only — synthesised hook URLs
//     return 401. Instead of exposing hook URLs, we expose the service IDs;
//     callers (the Deploy workflow) hit the Render REST API
//     `POST /v1/services/{id}/deploys` with `Authorization: Bearer
//     $RENDER_API_KEY`. Service IDs are not secrets — they're already in the
//     Render dashboard URL — so these outputs are non-sensitive.

output "api_url" {
  value = var.service_enabled ? render_web_service.main[0].url : ""
}

output "api_service_id" {
  value = var.service_enabled ? render_web_service.main[0].id : ""
}

output "worker_service_id" {
  value = (var.service_enabled && var.enable_worker) ? render_background_worker.main[0].id : null
}

output "database_external_url" {
  value     = "${render_postgres.main.connection_info.external_connection_string}?sslmode=require"
  sensitive = true
}

output "migrations_hash" {
  value = local.migrations_hash_value
}
