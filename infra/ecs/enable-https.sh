#!/usr/bin/env bash
# Add ALB HTTPS listener once ACM cert for devops.emsoft.com is ISSUED.
# Usage: AWS_PROFILE=emergence ./infra/ecs/enable-https.sh
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
CERTIFICATE_ARN="${CERTIFICATE_ARN:-arn:aws:acm:us-east-1:851725399092:certificate/90cb12ac-fa43-48cc-8252-671045365ec2}"

aws_cli() {
  aws --region "$AWS_REGION" ${AWS_PROFILE:+--profile "$AWS_PROFILE"} "$@"
}

status="$(aws_cli acm describe-certificate --certificate-arn "$CERTIFICATE_ARN" \
  --query 'Certificate.Status' --output text)"
if [[ "$status" != "ISSUED" ]]; then
  echo "ACM certificate status is ${status} (need ISSUED)."
  echo ""
  echo "Add this DNS record in Cloudflare (DNS only — grey cloud, not proxied):"
  aws_cli acm describe-certificate --certificate-arn "$CERTIFICATE_ARN" \
    --query 'Certificate.DomainValidationOptions[0].ResourceRecord' --output table
  exit 1
fi

ALB_ARN="$(aws_cli elbv2 describe-load-balancers --names emergence-devops-alb \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)"
TG_FRONTEND="$(aws_cli elbv2 describe-target-groups --names emergence-devops-fe-tg \
  --query 'TargetGroups[0].TargetGroupArn' --output text)"
TG_BACKEND="$(aws_cli elbv2 describe-target-groups --names emergence-devops-be-tg \
  --query 'TargetGroups[0].TargetGroupArn' --output text)"

listeners="$(aws_cli elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" \
  --query 'Listeners[*].Port' --output text)"

if ! echo "$listeners" | grep -qw 443; then
  echo "Creating HTTPS listener on port 443..."
  aws_cli elbv2 create-listener \
    --load-balancer-arn "$ALB_ARN" \
    --protocol HTTPS \
    --port 443 \
    --certificates "CertificateArn=${CERTIFICATE_ARN}" \
    --default-actions "Type=forward,TargetGroupArn=${TG_FRONTEND}"
fi

HTTPS_LISTENER="$(aws_cli elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" \
  --query 'Listeners[?Port==`443`].ListenerArn' --output text)"
rules="$(aws_cli elbv2 describe-rules --listener-arn "$HTTPS_LISTENER" \
  --query 'Rules[?Priority!=`default`].Priority' --output text)"
if ! echo "$rules" | grep -qw 10; then
  echo "Adding /api/* rule on HTTPS listener..."
  aws_cli elbv2 create-rule \
    --listener-arn "$HTTPS_LISTENER" \
    --priority 10 \
    --conditions Field=path-pattern,Values='/api/*' \
    --actions "Type=forward,TargetGroupArn=${TG_BACKEND}"
fi

HTTP_LISTENER="$(aws_cli elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" \
  --query 'Listeners[?Port==`80`].ListenerArn' --output text)"
echo "Updating HTTP listener to redirect to HTTPS..."
aws_cli elbv2 modify-listener \
  --listener-arn "$HTTP_LISTENER" \
  --default-actions "Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}"

echo "HTTPS enabled. Set Cloudflare SSL/TLS to Full (strict)."
