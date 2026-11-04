-- Gate 0 (FIN-01): atomic withdrawal claim to prevent concurrent double payouts.
CREATE OR REPLACE FUNCTION public.fn_admin_claim_withdrawal(
  p_request_id uuid,
  p_admin_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req withdrawal_requests%ROWTYPE;
BEGIN
  IF p_request_id IS NULL OR p_admin_id IS NULL OR COALESCE(p_reason, '') = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_ARGUMENT', 'message', 'request_id, admin_id and reason are required');
  END IF;

  -- Atomic conditional transition: only pending/approved requests can be claimed.
  UPDATE withdrawal_requests
  SET status = 'processing',
      reviewer_id = p_admin_id,
      review_reason = p_reason,
      updated_at = now()
  WHERE id = p_request_id
    AND status IN ('pending', 'approved')
  RETURNING * INTO v_req;

  IF NOT FOUND THEN
    SELECT * INTO v_req FROM withdrawal_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Withdrawal request not found');
    ELSE
      RETURN jsonb_build_object('success', false, 'code', 'ALREADY_CLAIMED', 'message', 'Request is already ' || v_req.status, 'status', v_req.status);
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'request', row_to_json(v_req));
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_claim_withdrawal(uuid, uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.fn_admin_claim_withdrawal(uuid, uuid, text) FROM anon, authenticated;