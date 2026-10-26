#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Security & business-rule smoke test against a running Supabase instance.
#
#   ./scripts/security-smoke.sh
#
# Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env, creates two
# anonymous (guest) sessions plus uses the operator account, and asserts:
#
#   1  a guest can place an order and gets a unique pickup token
#   2  a retried request with the same idempotency key returns the SAME order
#   3  a sold-out item is rejected server-side
#   4  a negative/oversized quantity is rejected server-side
#   5  a client cannot UPDATE orders.status directly
#   6  guest B cannot read guest A's order
#   7  a guest cannot change their own role
#   8  only the operator can advance the status, and only along the chain
#   9  rejection without a reason is refused
#
# Exits non-zero if any assertion fails.
# ---------------------------------------------------------------------------
set -u

API_URL=$(grep '^VITE_SUPABASE_URL=' .env | cut -d= -f2- | tr -d '"')
ANON_KEY=$(grep '^VITE_SUPABASE_ANON_KEY=' .env | cut -d= -f2- | tr -d '"')
CANTEEN_ID="11111111-1111-4111-8111-111111111111"
SAMOSA="33333333-3333-4333-8333-333333333301"      # available
PANI_PURI="33333333-3333-4333-8333-333333333304"    # seeded as sold out
OPERATOR_EMAIL="operator@canteen.test"
OPERATOR_PASSWORD="Operator123!"

PASS=0
FAIL=0

say() { printf '\n%s\n' "$1"; }
ok()  { PASS=$((PASS+1)); printf '  \342\234\223 %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  \342\234\227 %s\n' "$1"; }
assert() { # assert <label> <expected> <actual>
  if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (expected [$2] got [$3])"; fi
}
assert_contains() { # assert_contains <label> <needle> <haystack>
  case "$3" in *"$2"*) ok "$1" ;; *) bad "$1 (missing [$2] in [$(printf '%s' "$3" | head -c 160)])" ;; esac
}

if [ -z "${API_URL:-}" ] || [ -z "${ANON_KEY:-}" ]; then
  echo "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env" >&2
  exit 2
fi

anon_session() {
  curl -s -X POST "$API_URL/auth/v1/signup" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d '{"data":{},"gotrue_anonymous":true}'
}

signed_get() { # signed_get <token> <path>
  curl -s -H "apikey: $ANON_KEY" -H "Authorization: Bearer $1" "$API_URL/$2"
}
signed_patch() { # signed_patch <token> <path> <body>
  curl -s -w '\n%{http_code}' -X PATCH -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $1" -H "Content-Type: application/json" \
    -H "Prefer: return=representation" -d "$3" "$API_URL/$2"
}
signed_rpc() { # signed_rpc <token> <fn> <body>
  curl -s -w '\n%{http_code}' -X POST -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $1" -H "Content-Type: application/json" \
    -d "$3" "$API_URL/rest/v1/rpc/$2"
}

body_and_code() { BODY="${1%$'\n'*}"; CODE="${1##*$'\n'}"; }

say "== Preparing sessions =="
A_JSON=$(anon_session)
B_JSON=$(anon_session)
A_TOKEN=$(printf '%s' "$A_JSON" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
B_TOKEN=$(printf '%s' "$B_JSON" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
[ -n "$A_TOKEN" ] && ok "guest A signed in anonymously" || bad "guest A sign-in: $A_JSON"
[ -n "$B_TOKEN" ] && ok "guest B signed in anonymously" || bad "guest B sign-in: $B_JSON"

say "== 1. Order creation =="
KEY1="key-$(date +%s)-1"
RESP=$(signed_rpc "$A_TOKEN" create_order "{\"p_canteen_id\":\"$CANTEEN_ID\",\"p_lines\":[{\"menu_item_id\":\"$SAMOSA\",\"quantity\":2}],\"p_customer_note\":\"less spicy\",\"p_idempotency_key\":\"$KEY1\"}")
body_and_code "$RESP"
ORDER_ID=$(printf '%s' "$BODY" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
ORDER_NO=$(printf '%s' "$BODY" | sed -n 's/.*"order_number":"\([^"]*\)".*/\1/p')
TOTAL=$(printf '%s' "$BODY" | sed -n 's/.*"total":\([0-9.]*\).*/\1/p')
assert "order created" "200" "$CODE"
assert "total recomputed server-side (2 x 20.00)" "40.00" "$TOTAL"
assert "pickup token format" "C-" "$(printf '%s' "$ORDER_NO" | cut -c1-2)"
[ -n "$ORDER_ID" ] && ok "order id present" || bad "order id missing"

say "== 2. Idempotent retry =="
RESP=$(signed_rpc "$A_TOKEN" create_order "{\"p_canteen_id\":\"$CANTEEN_ID\",\"p_lines\":[{\"menu_item_id\":\"$SAMOSA\",\"quantity\":2}],\"p_customer_note\":\"less spicy\",\"p_idempotency_key\":\"$KEY1\"}")
body_and_code "$RESP"
RETRY_ID=$(printf '%s' "$BODY" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
assert "retry returns the original order, not a new one" "$ORDER_ID" "$RETRY_ID"

say "== 3. Sold-out item rejected =="
RESP=$(signed_rpc "$A_TOKEN" create_order "{\"p_canteen_id\":\"$CANTEEN_ID\",\"p_lines\":[{\"menu_item_id\":\"$PANI_PURI\",\"quantity\":1}],\"p_customer_note\":\"\",\"p_idempotency_key\":\"key-soldout-$$\"}")
body_and_code "$RESP"
assert_contains "sold-out message" "sold out" "$BODY"
[ "$CODE" != "200" ] && ok "sold-out order refused" || bad "sold-out order was accepted"

say "== 4. Invalid quantity rejected =="
RESP=$(signed_rpc "$A_TOKEN" create_order "{\"p_canteen_id\":\"$CANTEEN_ID\",\"p_lines\":[{\"menu_item_id\":\"$SAMOSA\",\"quantity\":999}],\"p_customer_note\":\"\",\"p_idempotency_key\":\"key-qty-$$\"}")
body_and_code "$RESP"
[ "$CODE" != "200" ] && ok "quantity 999 refused" || bad "quantity 999 accepted"

say "== 5. Client cannot update order status directly =="
RESP=$(signed_patch "$A_TOKEN" "rest/v1/orders?id=eq.$ORDER_ID" '{"status":"COLLECTED"}')
body_and_code "$RESP"
ROWS=$(printf '%s' "$BODY" | tr -d '[:space:]')
assert "direct status UPDATE touches no rows" "[]" "$ROWS"

say "== 6. Guest B cannot read guest A's order =="
BODY=$(signed_get "$B_TOKEN" "rest/v1/orders?id=eq.$ORDER_ID")
assert "foreign order invisible to guest B" "[]" "$(printf '%s' "$BODY" | tr -d '[:space:]')"
BODY=$(signed_get "$B_TOKEN" "rest/v1/orders")
assert "guest B sees no orders at all" "[]" "$(printf '%s' "$BODY" | tr -d '[:space:]')"

say "== 7. Guest cannot change own role =="
RESP=$(signed_patch "$A_TOKEN" "rest/v1/profiles?id=eq.$(printf '%s' "$A_JSON" | sed -n 's/.*"user":{[^}]*"id":"\([^"]*\)".*/\1/p')" '{"role":"operator"}')
body_and_code "$RESP"
case "$BODY" in
  *"roles cannot be changed"*) ok "role escalation blocked by trigger" ;;
  *) bad "role escalation response: $BODY" ;;
esac

say "== 8. Operator status transitions =="
OP_JSON=$(curl -s -X POST "$API_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$OPERATOR_EMAIL\",\"password\":\"$OPERATOR_PASSWORD\"}")
OP_TOKEN=$(printf '%s' "$OP_JSON" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
[ -n "$OP_TOKEN" ] && ok "operator signed in" || bad "operator sign-in: $OP_JSON"

advance() { # advance <status> <reason-json-or-null>
  local reason="$2"
  signed_rpc "$OP_TOKEN" update_order_status \
    "{\"p_order_id\":\"$ORDER_ID\",\"p_new_status\":\"$1\",\"p_reason\":$reason}"
}

RESP=$(advance ACCEPTED 'null'); body_and_code "$RESP"
assert "PLACED -> ACCEPTED allowed for operator" "200" "$CODE"

RESP=$(advance COLLECTED 'null'); body_and_code "$RESP"
[ "$CODE" != "200" ] && ok "ACCEPTED -> COLLECTED (skipping) refused" || bad "stage skip was allowed"
assert_contains "skip message" "Cannot move an order" "$BODY"

RESP=$(advance IN_PROGRESS 'null'); body_and_code "$RESP"
assert "ACCEPTED -> IN_PROGRESS allowed" "200" "$CODE"

RESP=$(advance REJECTED 'null'); body_and_code "$RESP"
[ "$CODE" != "200" ] && ok "REJECTED without a reason refused" || bad "rejection without reason accepted"

RESP=$(advance READY_TO_COLLECT 'null'); body_and_code "$RESP"
assert "IN_PROGRESS -> READY_TO_COLLECT allowed" "200" "$CODE"

RESP=$(advance COLLECTED 'null'); body_and_code "$RESP"
assert "READY_TO_COLLECT -> COLLECTED allowed" "200" "$CODE"

RESP=$(advance ACCEPTED 'null'); body_and_code "$RESP"
[ "$CODE" != "200" ] && ok "terminal COLLECTED cannot move again" || bad "collected order was reopened"

say "== 9. Guest cannot drive the workflow =="
RESP=$(signed_rpc "$A_TOKEN" update_order_status "{\"p_order_id\":\"$ORDER_ID\",\"p_new_status\":\"ACCEPTED\",\"p_reason\":null}")
body_and_code "$RESP"
assert_contains "guest blocked from status changes" "Only the canteen operator" "$BODY"

say "== 10. Audit trail =="
HISTORY=$(signed_get "$A_TOKEN" "rest/v1/order_status_history?order_id=eq.$ORDER_ID&select=new_status,reason")
COUNT=$(printf '%s' "$HISTORY" | grep -o '"new_status"' | wc -l | tr -d ' ')
assert "every transition audited (5 entries)" "5" "$COUNT"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
