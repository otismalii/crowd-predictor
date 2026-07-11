-- Ensure wallet trigger is attached (creates wallet when user signs up)
DROP TRIGGER IF EXISTS on_auth_user_created_wallet ON auth.users;
CREATE TRIGGER on_auth_user_created_wallet
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_wallet_creation();

-- Add explicit service role policies for transactions table
CREATE POLICY "Service role can insert transactions"
  ON public.transactions FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Add explicit service role policy for wallets (for mpesa-callback to credit)
CREATE POLICY "Service role can manage wallets"
  ON public.wallets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role policy for notifications (for edge functions to send notifications)
CREATE POLICY "Service role can manage notifications"
  ON public.notifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);