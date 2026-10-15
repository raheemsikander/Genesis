// Inside the VPC the connection is TLS-encrypted; the RDS CA isn't in Node's
// default trust store, so certificate verification is skipped (same trade-off
// as the Render stack's internal URL).
output "database_url" {
  value     = "postgres://${aws_db_instance.main.username}:${random_password.master.result}@${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}?sslmode=no-verify"
  sensitive = true
}

output "endpoint" {
  value = aws_db_instance.main.endpoint
}

output "security_group_id" {
  value = aws_security_group.db.id
}
