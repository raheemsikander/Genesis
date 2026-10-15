check "postgres_plan_for_production" {
  assert {
    condition     = !(var.environment == "production" && var.postgres_plan == "free")
    error_message = "Free Postgres expires after 30 days; production must use a paid plan (e.g., basic_256mb)."
  }
}
