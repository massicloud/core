#!/usr/bin/env bash
# Builds and pushes MassiCloud's Docker images with the correct
# --build-arg / --platform flags baked in, using the domain and image tags
# already set in deploy/helm/massicloud/values.yaml — so the values used to
# build the image and the values used to deploy it can never drift apart.
#
# This exists because a manually-retyped `docker build --build-arg ...`
# command missing a single flag has broken prod three times (the portal
# silently falling back to same-origin API calls). Prefer this script over
# retyping the command by hand.
#
# Usage:
#   ./deploy/build-and-push.sh                 # build + push every image
#   ./deploy/build-and-push.sh api portal       # only these images
#   ./deploy/build-and-push.sh --no-push        # build only, don't push
#

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

VALUES_FILE="deploy/helm/massicloud/values.yaml"
PLATFORM="linux/amd64"

yaml_value() { # $1 = key regex to match a "key: value" line under images:/domain:
  grep -m1 "$1" "$VALUES_FILE" | sed -E 's/^[^:]+:[[:space:]]*"?([^"[:space:]]+)"?.*/\1/'
}

DOMAIN=$(yaml_value '^\s*base:')
API_TAG=$(awk '/^  api:/{f=1} f&&/tag:/{print;exit}' "$VALUES_FILE" | sed -E 's/.*"([^"]+)".*/\1/')
PORTAL_TAG=$(awk '/^  portal:/{f=1} f&&/tag:/{print;exit}' "$VALUES_FILE" | sed -E 's/.*"([^"]+)".*/\1/')
LANDING_TAG=$(awk '/^  landing:/{f=1} f&&/tag:/{print;exit}' "$VALUES_FILE" | sed -E 's/.*"([^"]+)".*/\1/')
DOCS_TAG=$(awk '/^  docs:/{f=1} f&&/tag:/{print;exit}' "$VALUES_FILE" | sed -E 's/.*"([^"]+)".*/\1/')

PUSH=1
TARGETS=()
for arg in "$@"; do
  case "$arg" in
    --no-push) PUSH=0 ;;
    *) TARGETS+=("$arg") ;;
  esac
done
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(api portal landing docs)

echo "Domain: $DOMAIN"
echo "Tags: api=$API_TAG portal=$PORTAL_TAG landing=$LANDING_TAG docs=$DOCS_TAG"
echo

build_push() {
  local image="$1"; shift
  echo "==> Building $image"
  docker build --platform "$PLATFORM" "$@"
  if [ "$PUSH" -eq 1 ]; then
    echo "==> Pushing $image"
    docker push "$image"
  fi
}

for target in "${TARGETS[@]}"; do
  case "$target" in
    api)
      build_push "ghcr.io/massicloud/massicloud-api:$API_TAG" \
        -t "ghcr.io/massicloud/massicloud-api:$API_TAG" ./api
      ;;
    portal)
      build_push "ghcr.io/massicloud/massicloud-portal:$PORTAL_TAG" \
        --build-arg "NEXT_PUBLIC_API_URL=https://api.$DOMAIN" \
        --build-arg "NEXT_PUBLIC_LANDING_URL=https://$DOMAIN" \
        --build-arg "NEXT_PUBLIC_DOCS_URL=https://docs.$DOMAIN" \
        -t "ghcr.io/massicloud/massicloud-portal:$PORTAL_TAG" ./portal
      ;;
    landing)
      build_push "ghcr.io/massicloud/massicloud-landing:$LANDING_TAG" \
        --build-arg "NEXT_PUBLIC_APP_URL=https://app.$DOMAIN" \
        --build-arg "NEXT_PUBLIC_DOCS_URL=https://docs.$DOMAIN" \
        -t "ghcr.io/massicloud/massicloud-landing:$LANDING_TAG" ./landing
      ;;
    docs)
      echo "==> Building docs site (astro build)"
      (cd massicloud-docs && npm run build)
      build_push "ghcr.io/massicloud/massicloud-docs:$DOCS_TAG" \
        -t "ghcr.io/massicloud/massicloud-docs:$DOCS_TAG" ./massicloud-docs
      ;;
    *)
      echo "Unknown target: $target (expected api, portal, landing, or docs)" >&2
      exit 1
      ;;
  esac
done

echo
echo "Done. Deploy with:"
echo "helm upgrade --install massicloud ./deploy/helm/massicloud \
        --namespace massicloud-system \
        -f deploy/helm/massicloud/values.yaml \
        -f deploy/helm/massicloud/values-qa-secrets.yaml"
