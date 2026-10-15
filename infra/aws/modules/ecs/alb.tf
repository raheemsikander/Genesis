// Internal ALB in the private subnets. Nothing on the internet can reach it:
// CloudFront connects through a VPC origin (see modules/edge), and each
// distribution stamps an origin header that picks the target group here.

resource "aws_lb" "main" {
  name               = substr(var.name, 0, 32)
  internal           = true
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.alb_subnet_ids

  drop_invalid_header_fields = true
  idle_timeout               = 60
}

resource "aws_lb_target_group" "api" {
  name        = "${substr(var.name, 0, 27)}-api"
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  deregistration_delay = 30

  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 15
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group" "web" {
  name        = "${substr(var.name, 0, 27)}-web"
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  deregistration_delay = 30

  // The landing page may redirect to sign-in, so 3xx counts as healthy.
  health_check {
    path                = "/"
    matcher             = "200-399"
    interval            = 15
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Not found"
      status_code  = "404"
    }
  }
}

resource "aws_lb_listener_rule" "by_origin" {
  for_each = {
    api = { priority = 10, target_group_arn = aws_lb_target_group.api.arn }
    web = { priority = 20, target_group_arn = aws_lb_target_group.web.arn }
  }

  listener_arn = aws_lb_listener.http.arn
  priority     = each.value.priority

  action {
    type             = "forward"
    target_group_arn = each.value.target_group_arn
  }

  condition {
    http_header {
      http_header_name = var.origin_header_name
      values           = [each.key]
    }
  }
}
