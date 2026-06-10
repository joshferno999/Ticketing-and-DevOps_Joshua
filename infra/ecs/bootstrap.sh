#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

export AWS_DEFAULT_PROFILE="${AWS_DEFAULT_PROFILE:-emergence}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-851725399092}"
export PROJECT="${PROJECT:-emergence-devops}"
export APP_URL="${APP_URL:-https://devops.emsoft.com}"

SUBNET_A="${SUBNET_A:-subnet-01c481068b083b90c}"
SUBNET_B="${SUBNET_B:-subnet-082aececf0f5a2142}"
VPC_ID="${VPC_ID:-vpc-0022185ea407f59f6}"

ECR_FRONTEND="${PROJECT}-frontend"
ECR_BACKEND="${PROJECT}-backend"
CLUSTER="${PROJECT}"
SERVICE_FRONTEND="${PROJECT}-frontend"
SERVICE_BACKEND="${PROJECT}-backend"
SECRET_NAME="${PROJECT}/backend"

EXECUTION_ROLE="${PROJECT}-ecs-task-execution"
TASK_ROLE="${PROJECT}-ecs-task"
GITHUB_ROLE="${PROJECT}-github-actions-deploy"

OUTPUT_FILE="${ROOT_DIR}/infra/ecs/.bootstrap-output.env"

aws_cli() {
  aws --region "$AWS_REGION" "$@"
}

log() {
  echo "[bootstrap] $*"
}

ensure_ecr_repo() {
  local repo="$1"
  if ! aws_cli ecr describe-repositories --repository-names "$repo" >/dev/null 2>&1; then
    log "Creating ECR repository $repo"
    aws_cli ecr create-repository --repository-name "$repo" >/dev/null
  else
    log "ECR repository $repo exists"
  fi
}

ensure_log_group() {
  local group="$1"
  if ! aws_cli logs describe-log-groups --log-group-name-prefix "$group" \
    --query "logGroups[?logGroupName=='$group'] | length(@)" --output text | grep -q '^1$'; then
    log "Creating log group $group"
    aws_cli logs create-log-group --log-group-name "$group" || true
  fi
}

ensure_secret() {
  local secrets_file="${ROOT_DIR}/infra/ecs/secrets.backend.json"
  if [[ ! -f "$secrets_file" ]]; then
    log "No secrets.backend.json — copying example (update values in AWS console before production traffic)"
    cp "${ROOT_DIR}/infra/ecs/secrets.backend.example.json" "$secrets_file"
  fi

  if aws_cli secretsmanager describe-secret --secret-id "$SECRET_NAME" >/dev/null 2>&1; then
    log "Updating secret $SECRET_NAME"
    aws_cli secretsmanager put-secret-value \
      --secret-id "$SECRET_NAME" \
      --secret-string "file://${secrets_file}" >/dev/null
  else
    log "Creating secret $SECRET_NAME"
    aws_cli secretsmanager create-secret \
      --name "$SECRET_NAME" \
      --description "Emergence Devops backend environment" \
      --secret-string "file://${secrets_file}" >/dev/null
  fi
}

ensure_execution_role() {
  local trust='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
  if ! aws_cli iam get-role --role-name "$EXECUTION_ROLE" >/dev/null 2>&1; then
    log "Creating IAM role $EXECUTION_ROLE"
    aws_cli iam create-role \
      --role-name "$EXECUTION_ROLE" \
      --assume-role-policy-document "$trust" >/dev/null
    aws_cli iam attach-role-policy \
      --role-name "$EXECUTION_ROLE" \
      --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
  fi

  local secret_arn
  secret_arn="$(aws_cli secretsmanager describe-secret --secret-id "$SECRET_NAME" --query ARN --output text)"
  local policy
  policy="$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": ["${secret_arn}"]
    }
  ]
}
EOF
)"
  aws_cli iam put-role-policy \
    --role-name "$EXECUTION_ROLE" \
    --policy-name "${PROJECT}-secrets-access" \
    --policy-document "$policy" >/dev/null
}

ensure_task_role() {
  local trust='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
  if ! aws_cli iam get-role --role-name "$TASK_ROLE" >/dev/null 2>&1; then
    log "Creating IAM role $TASK_ROLE"
    aws_cli iam create-role \
      --role-name "$TASK_ROLE" \
      --assume-role-policy-document "$trust" >/dev/null
  fi

  local cw_policy
  cw_policy="$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["cloudwatch:GetMetricStatistics"],
      "Resource": "*"
    }
  ]
}
EOF
)"
  aws_cli iam put-role-policy \
    --role-name "$TASK_ROLE" \
    --policy-name "${PROJECT}-cloudwatch-reachability" \
    --policy-document "$cw_policy" >/dev/null
}

ensure_github_oidc_provider() {
  if ! aws_cli iam list-open-id-connect-providers \
    --query 'OpenIDConnectProviderList[?contains(Arn, `token.actions.githubusercontent.com`)]' \
    --output text | grep -q 'token.actions.githubusercontent.com'; then
    log "Creating GitHub OIDC provider"
    aws_cli iam create-open-id-connect-provider \
      --url https://token.actions.githubusercontent.com \
      --client-id-list sts.amazonaws.com \
      --thumbprint-list 6938fd6d98bab03fa76885b7aa3e9cbacef3c1ef >/dev/null
  fi
}

ensure_github_deploy_role() {
  ensure_github_oidc_provider
  local provider_arn="arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
  local trust
  trust="$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "${provider_arn}" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:Emergence-Mobility/Emergence-Devops:ref:refs/heads/main"
        }
      }
    }
  ]
}
EOF
)"
  if ! aws_cli iam get-role --role-name "$GITHUB_ROLE" >/dev/null 2>&1; then
    log "Creating GitHub Actions deploy role $GITHUB_ROLE"
    aws_cli iam create-role \
      --role-name "$GITHUB_ROLE" \
      --assume-role-policy-document "$trust" >/dev/null
  else
    aws_cli iam update-assume-role-policy \
      --role-name "$GITHUB_ROLE" \
      --policy-document "$trust" >/dev/null
  fi

  local execution_arn task_arn
  execution_arn="$(aws_cli iam get-role --role-name "$EXECUTION_ROLE" --query Role.Arn --output text)"
  task_arn="$(aws_cli iam get-role --role-name "$TASK_ROLE" --query Role.Arn --output text)"

  local policy
  policy="$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService",
        "ecs:DescribeServices"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:DescribeSecret",
        "secretsmanager:GetSecretValue",
        "secretsmanager:PutSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:emergence-devops/backend*"
    },
    {
      "Effect": "Allow",
      "Action": ["iam:GetRole", "iam:PassRole"],
      "Resource": ["${execution_arn}", "${task_arn}"]
    }
  ]
}
EOF
)"
  aws_cli iam put-role-policy \
    --role-name "$GITHUB_ROLE" \
    --policy-name "${PROJECT}-deploy" \
    --policy-document "$policy" >/dev/null
}

get_or_create_security_group() {
  local name="$1"
  local desc="$2"
  local ingress_json="$3"
  local existing
  existing="$(aws_cli ec2 describe-security-groups \
    --filters "Name=group-name,Values=${name}" "Name=vpc-id,Values=${VPC_ID}" \
    --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)"
  if [[ "$existing" != "None" && -n "$existing" ]]; then
    echo "$existing"
    return
  fi
  local sg_id
  sg_id="$(aws_cli ec2 create-security-group \
    --group-name "$name" \
    --description "$desc" \
    --vpc-id "$VPC_ID" \
    --query GroupId --output text)"
  if [[ -n "$ingress_json" && "$ingress_json" != "[]" ]]; then
    aws_cli ec2 authorize-security-group-ingress \
      --group-id "$sg_id" \
      --ip-permissions "$ingress_json" >/dev/null
  fi
  echo "$sg_id"
}

ensure_networking() {
  ALB_SG="$(get_or_create_security_group \
    "${PROJECT}-alb" \
    "ALB for ${PROJECT}" \
    '[{"IpProtocol":"tcp","FromPort":80,"ToPort":80,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]},{"IpProtocol":"tcp","FromPort":443,"ToPort":443,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]}]')"
  log "ALB security group: $ALB_SG"

  ECS_SG="$(get_or_create_security_group \
    "${PROJECT}-ecs" \
    "ECS tasks for ${PROJECT}" \
    "[]")"
  log "ECS security group: $ECS_SG"

  aws_cli ec2 authorize-security-group-ingress \
    --group-id "$ECS_SG" \
    --ip-permissions "[{\"IpProtocol\":\"tcp\",\"FromPort\":80,\"ToPort\":80,\"UserIdGroupPairs\":[{\"GroupId\":\"${ALB_SG}\"}]},{\"IpProtocol\":\"tcp\",\"FromPort\":4000,\"ToPort\":4000,\"UserIdGroupPairs\":[{\"GroupId\":\"${ALB_SG}\"}]}]" \
    >/dev/null 2>&1 || true
}

ensure_target_group() {
  local name="$1"
  local port="$2"
  local health_path="$3"
  local existing
  existing="$(aws_cli elbv2 describe-target-groups --names "$name" \
    --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || true)"
  if [[ "$existing" != "None" && -n "$existing" ]]; then
    echo "$existing"
    return
  fi
  aws_cli elbv2 create-target-group \
    --name "$name" \
    --protocol HTTP \
    --port "$port" \
    --vpc-id "$VPC_ID" \
    --target-type ip \
    --health-check-path "$health_path" \
    --health-check-interval-seconds 30 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --query 'TargetGroups[0].TargetGroupArn' --output text
}

ensure_alb() {
  local alb_name="${PROJECT}-alb"
  local existing
  existing="$(aws_cli elbv2 describe-load-balancers --names "$alb_name" \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || true)"
  if [[ "$existing" != "None" && -n "$existing" ]]; then
    ALB_ARN="$existing"
  else
    ALB_ARN="$(aws_cli elbv2 create-load-balancer \
      --name "$alb_name" \
      --subnets "$SUBNET_A" "$SUBNET_B" \
      --security-groups "$ALB_SG" \
      --scheme internet-facing \
      --type application \
      --query 'LoadBalancers[0].LoadBalancerArn' --output text)"
  fi
  ALB_DNS="$(aws_cli elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" \
    --query 'LoadBalancers[0].DNSName' --output text)"
  log "ALB DNS: $ALB_DNS"
}

ensure_listeners() {
  local listeners
  listeners="$(aws_cli elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" \
    --query 'Listeners[*].Port' --output text)"

  if [[ -n "${CERTIFICATE_ARN:-}" ]]; then
    if ! echo "$listeners" | grep -qw 443; then
      log "Creating HTTPS listener"
      aws_cli elbv2 create-listener \
        --load-balancer-arn "$ALB_ARN" \
        --protocol HTTPS \
        --port 443 \
        --certificates "CertificateArn=${CERTIFICATE_ARN}" \
        --default-actions "Type=forward,TargetGroupArn=${TG_FRONTEND}" >/dev/null
    fi
    local https_listener
    https_listener="$(aws_cli elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" \
      --query 'Listeners[?Port==`443`].ListenerArn' --output text)"
    local rules
    rules="$(aws_cli elbv2 describe-rules --listener-arn "$https_listener" \
      --query 'Rules[?Priority!=`default`].Priority' --output text)"
    if ! echo "$rules" | grep -qw 10; then
      aws_cli elbv2 create-rule \
        --listener-arn "$https_listener" \
        --priority 10 \
        --conditions Field=path-pattern,Values='/api/*' \
        --actions "Type=forward,TargetGroupArn=${TG_BACKEND}" >/dev/null
    fi
    if ! echo "$listeners" | grep -qw 80; then
      aws_cli elbv2 create-listener \
        --load-balancer-arn "$ALB_ARN" \
        --protocol HTTP \
        --port 80 \
        --default-actions "Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}" >/dev/null
    fi
  else
    log "CERTIFICATE_ARN not set — HTTP listener on port 80 only (add cert + re-run for HTTPS)"
    if ! echo "$listeners" | grep -qw 80; then
      aws_cli elbv2 create-listener \
        --load-balancer-arn "$ALB_ARN" \
        --protocol HTTP \
        --port 80 \
        --default-actions "Type=forward,TargetGroupArn=${TG_FRONTEND}" >/dev/null
    fi
    local http_listener
    http_listener="$(aws_cli elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" \
      --query 'Listeners[?Port==`80`].ListenerArn' --output text)"
    local rules
    rules="$(aws_cli elbv2 describe-rules --listener-arn "$http_listener" \
      --query 'Rules[?Priority!=`default`].Priority' --output text)"
    if ! echo "$rules" | grep -qw 10; then
      aws_cli elbv2 create-rule \
        --listener-arn "$http_listener" \
        --priority 10 \
        --conditions Field=path-pattern,Values='/api/*' \
        --actions "Type=forward,TargetGroupArn=${TG_BACKEND}" >/dev/null
    fi
  fi
}

build_secrets_block() {
  local secret_arn="$1"
  local keys=(
    PORT HOST DATABASE_URL FRONTEND_URL APP_AUTH_SECRET
    GITHUB_APP_ID GITHUB_APP_PRIVATE_KEY
    GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET
    ASANA_CLIENT_ID ASANA_CLIENT_SECRET ASANA_REDIRECT_URI
    ROUTE53_HEALTH_CHECK_ID ROUTE53_METRICS_REGION REACHABILITY_CACHE_TTL_SECONDS
    AWS_REGION
  )
  local secret_json
  secret_json="$(aws_cli secretsmanager get-secret-value --secret-id emergence-devops/backend \
    --query 'SecretString' --output text 2>/dev/null || echo '{}')"
  for optional in GITHUB_WEBHOOK_SECRET AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN CLOUDFLARE_API_TOKEN CLOUDFLARE_ZONE_ID CLOUDFLARE_TRAFFIC_CACHE_TTL_SECONDS; do
    if echo "$secret_json" | jq -e --arg k "$optional" 'has($k)' >/dev/null 2>&1; then
      keys+=("$optional")
    fi
  done
  local items=()
  for key in "${keys[@]}"; do
    items+=("{\"name\":\"${key}\",\"valueFrom\":\"${secret_arn}:${key}::\"}")
  done
  local joined
  joined="$(IFS=,; echo "${items[*]}")"
  echo "[${joined}]"
}

register_task_definition() {
  local family="$1"
  local template="$2"
  local image_uri="$3"
  local secrets_block="${4:-}"

  local execution_arn task_arn
  execution_arn="$(aws_cli iam get-role --role-name "$EXECUTION_ROLE" --query Role.Arn --output text)"
  task_arn="$(aws_cli iam get-role --role-name "$TASK_ROLE" --query Role.Arn --output text)"

  local rendered
  rendered="$(sed \
    -e "s|EXECUTION_ROLE_ARN|${execution_arn}|g" \
    -e "s|TASK_ROLE_ARN|${task_arn}|g" \
    -e "s|IMAGE_URI|${image_uri}|g" \
    "$template")"

  if [[ -n "$secrets_block" ]]; then
    rendered="$(echo "$rendered" | sed "s|\"secrets\": \"SECRETS_BLOCK\"|\"secrets\": ${secrets_block}|")"
  else
    rendered="$(echo "$rendered" | sed '/"secrets": "SECRETS_BLOCK",/d')"
  fi

  local tmp
  tmp="$(mktemp)"
  echo "$rendered" >"$tmp"
  aws_cli ecs register-task-definition --cli-input-json "file://${tmp}" \
    --query 'taskDefinition.taskDefinitionArn' --output text
  rm -f "$tmp"
}

ensure_cluster() {
  local status
  status="$(aws_cli ecs describe-clusters --clusters "$CLUSTER" \
    --query 'clusters[0].status' --output text 2>/dev/null || true)"
  if [[ "$status" != "ACTIVE" ]]; then
    log "Creating ECS cluster $CLUSTER"
    aws_cli ecs create-cluster --cluster-name "$CLUSTER" >/dev/null
  fi
}

ensure_service() {
  local service_name="$1"
  local family="$2"
  local tg_arn="$3"
  local container_name="$4"
  local container_port="$5"

  local status
  status="$(aws_cli ecs describe-services --cluster "$CLUSTER" --services "$service_name" \
    --query 'services[0].status' --output text 2>/dev/null || true)"

  local network="awsvpcConfiguration={subnets=[${SUBNET_A},${SUBNET_B}],securityGroups=[${ECS_SG}],assignPublicIp=ENABLED}"
  local lb="targetGroupArn=${tg_arn},containerName=${container_name},containerPort=${container_port}"

  if [[ "$status" == "ACTIVE" ]]; then
    log "Updating ECS service $service_name"
    aws_cli ecs update-service \
      --cluster "$CLUSTER" \
      --service "$service_name" \
      --task-definition "$family" \
      --force-new-deployment >/dev/null
  else
    log "Creating ECS service $service_name"
    aws_cli ecs create-service \
      --cluster "$CLUSTER" \
      --service-name "$service_name" \
      --task-definition "$family" \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "$network" \
      --load-balancers "$lb" \
      --health-check-grace-period-seconds 120 >/dev/null
  fi
}

request_acm_hint() {
  if [[ -n "${CERTIFICATE_ARN:-}" ]]; then
    return
  fi
  log "To enable HTTPS, request ACM cert for devops.emsoft.com and re-run with CERTIFICATE_ARN=arn:aws:acm:..."
  if aws_cli acm list-certificates --query "CertificateSummaryList[?DomainName=='devops.emsoft.com'].CertificateArn" --output text | grep -q 'arn:'; then
    local arn
    arn="$(aws_cli acm list-certificates --query "CertificateSummaryList[?DomainName=='devops.emsoft.com'].CertificateArn" --output text | head -1)"
    log "Found existing cert: $arn (export CERTIFICATE_ARN=$arn and re-run bootstrap)"
  fi
}

main() {
  log "Bootstrapping ${PROJECT} in ${AWS_REGION} (account ${AWS_ACCOUNT_ID})"

  ensure_ecr_repo "$ECR_FRONTEND"
  ensure_ecr_repo "$ECR_BACKEND"
  ensure_log_group "/ecs/${PROJECT}/frontend"
  ensure_log_group "/ecs/${PROJECT}/backend"
  ensure_secret
  ensure_execution_role
  ensure_task_role
  ensure_github_deploy_role
  ensure_networking

  TG_FRONTEND="$(ensure_target_group "${PROJECT}-fe-tg" 80 "/")"
  TG_BACKEND="$(ensure_target_group "${PROJECT}-be-tg" 4000 "/api/health")"
  ensure_alb
  ensure_listeners
  ensure_cluster
  request_acm_hint

  local secret_arn
  secret_arn="$(aws_cli secretsmanager describe-secret --secret-id "$SECRET_NAME" --query ARN --output text)"
  local secrets_block
  secrets_block="$(build_secrets_block "$secret_arn")"

  local fe_image be_image
  fe_image="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_FRONTEND}:latest"
  be_image="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_BACKEND}:latest"

  register_task_definition "$SERVICE_FRONTEND" \
    "${ROOT_DIR}/infra/ecs/task-definition-frontend.json" \
    "$fe_image"
  register_task_definition "$SERVICE_BACKEND" \
    "${ROOT_DIR}/infra/ecs/task-definition-backend.json" \
    "$be_image" \
    "$secrets_block"

  ensure_service "$SERVICE_FRONTEND" "$SERVICE_FRONTEND" "$TG_FRONTEND" "frontend" 80
  ensure_service "$SERVICE_BACKEND" "$SERVICE_BACKEND" "$TG_BACKEND" "backend" 4000

  local github_role_arn
  github_role_arn="$(aws_cli iam get-role --role-name "$GITHUB_ROLE" --query Role.Arn --output text)"

  cat >"$OUTPUT_FILE" <<EOF
AWS_REGION=${AWS_REGION}
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID}
APP_URL=${APP_URL}
ALB_DNS=${ALB_DNS}
ALB_ARN=${ALB_ARN}
ECS_CLUSTER=${CLUSTER}
GITHUB_ROLE_ARN=${github_role_arn}
ECR_FRONTEND=${fe_image}
ECR_BACKEND=${be_image}
EOF

  log "Bootstrap complete. Outputs written to infra/ecs/.bootstrap-output.env"
  log "ALB DNS (use for Cloudflare CNAME devops): ${ALB_DNS}"
  log "GitHub OIDC role ARN: ${github_role_arn}"
}

main "$@"
