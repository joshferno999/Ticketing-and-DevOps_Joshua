#!/usr/bin/env bash
# Grant GitHub Actions deploy role permission to patch emergence-devops/backend (Cloudflare keys).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
POLICY_TEMPLATE="${ROOT_DIR}/infra/iam/github-actions-secrets-write.json"
export AWS_DEFAULT_PROFILE="${AWS_DEFAULT_PROFILE:-emergence}"
export AWS_REGION="${AWS_REGION:-us-east-1}"

PROJECT="${PROJECT:-emergence-devops}"
GITHUB_ROLE="${PROJECT}-github-actions-deploy"
POLICY_NAME="${PROJECT}-secrets-write"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
POLICY_DOC="$(sed \
  -e "s/REGION/${AWS_REGION}/g" \
  -e "s/ACCOUNT_ID/${ACCOUNT_ID}/g" \
  "$POLICY_TEMPLATE")"

echo "Attaching ${POLICY_NAME} to role ${GITHUB_ROLE} (profile=${AWS_DEFAULT_PROFILE})..."
aws iam put-role-policy \
  --role-name "$GITHUB_ROLE" \
  --policy-name "$POLICY_NAME" \
  --policy-document "$POLICY_DOC"
echo "Done. Re-run the failed GitHub Actions deploy (or push to main)."
