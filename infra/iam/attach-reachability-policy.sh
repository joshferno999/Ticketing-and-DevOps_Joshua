#!/usr/bin/env bash
# Attach CloudWatch read policy for Route53 health-check latency (local dev or ECS task role).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
POLICY_FILE="${ROOT_DIR}/infra/iam/reachability-cloudwatch-read.json"
export AWS_DEFAULT_PROFILE="${AWS_DEFAULT_PROFILE:-emergence}"
export AWS_REGION="${AWS_REGION:-us-east-1}"

TARGET="${1:-task-role}"
PROJECT="${PROJECT:-emergence-devops}"
TASK_ROLE="${PROJECT}-ecs-task"
POLICY_NAME="${PROJECT}-cloudwatch-reachability"

usage() {
  echo "Usage: $0 [task-role|user <iam-user-name>]"
  echo ""
  echo "  task-role              Attach inline policy to ${TASK_ROLE} (default, idempotent)"
  echo "  user <iam-user-name>   Attach inline policy to an IAM user (local npm run dev)"
  exit 1
}

if [[ ! -f "$POLICY_FILE" ]]; then
  echo "Missing policy file: $POLICY_FILE" >&2
  exit 1
fi

case "$TARGET" in
  task-role)
    echo "Attaching ${POLICY_NAME} to role ${TASK_ROLE} (profile=${AWS_DEFAULT_PROFILE})..."
    aws iam put-role-policy \
      --role-name "$TASK_ROLE" \
      --policy-name "$POLICY_NAME" \
      --policy-document "file://${POLICY_FILE}"
    echo "Done. Redeploy the backend ECS service if it is already running."
    ;;
  user)
    USER_NAME="${2:-}"
    if [[ -z "$USER_NAME" ]]; then
      usage
    fi
    echo "Attaching ${POLICY_NAME} to user ${USER_NAME}..."
    if ! aws iam get-user --user-name "$USER_NAME" >/dev/null 2>&1; then
      echo "Error: IAM user '${USER_NAME}' not found in this account." >&2
      exit 1
    fi
    aws iam put-user-policy \
      --user-name "$USER_NAME" \
      --policy-name "$POLICY_NAME" \
      --policy-document "file://${POLICY_FILE}"
    echo "Done. Set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY for that user in backend/.env."
    ;;
  *)
    usage
    ;;
esac

echo ""
echo "Caller identity:"
aws sts get-caller-identity
