output "server_url" {
  description = "Public URL of the backend web service, or null when service_enabled is false."
  value       = var.service_enabled ? render_web_service.backend[0].url : null
}

output "server_service_id" {
  description = "Render service ID for the backend, or null when service_enabled is false."
  value       = var.service_enabled ? render_web_service.backend[0].id : null
}

output "worker_service_id" {
  description = "Render service ID for the worker, or null when disabled."
  value       = var.service_enabled && var.enable_worker ? render_background_worker.worker[0].id : null
}

output "database_connection_string" {
  description = "Postgres external connection string."
  value       = render_postgres.main.connection_info.external_connection_string
  sensitive   = true
}

output "redis_connection_string" {
  description = "Key Value external connection string."
  value       = render_keyvalue.main.connection_info.external_connection_string
  sensitive   = true
}
