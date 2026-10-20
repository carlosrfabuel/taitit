import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { supabase, throwawayClient } from '@/lib/supabase';
import { AppText, Button, Icon } from '@/ui';
import { useAuth, type Profile } from './AuthProvider';

// Shown after sign-up (and when someone signs in before confirming): waits for the email to be
// confirmed, wherever the link is opened (this phone or a computer). It tries to sign in with the
// email and password just typed: Supabase refuses with "email not confirmed" until the link has been
// opened, then signs in. The password stays in memory only while this screen is open.
// Every 15 s (sign-in attempts are rate-limited) and right away when the app comes back to the
// front (the usual moment: back from the email app); it stops after 15 minutes.
// A sign-up with an email that already has a confirmed account sends no email (Supabase): then it
// tries the password right away and says so, instead of "check your email".

const FIRST = 3_000;
const EVERY = 15_000;
const GIVE_UP = 15 * 60_000;
const RESEND_WAIT = 60_000;

type State = 'waiting' | 'confirmed' | 'gave_up' | 'wrong_password';
/** Why this screen is shown: a new sign-up (email just sent), a sign-up with an email that already
 * has an account (no email sent), or a sign-in before the email was confirmed. */
export type WaitReason = 'signed_up' | 'existing_account' | 'not_confirmed';

/** What the account can do, said once signed in. */
function accountLine(profile: Profile | null, failed: boolean): string {
  if (!profile) return failed ? 'You are signed in.' : 'You are signed in. Checking your account…';
  if (profile.role === 'admin' || profile.status === 'approved')
    return 'You are signed in and can send orders.';
  if (profile.status === 'rejected')
    return "You are signed in, but this account can't send orders. Contact TAITIT if you think this is a mistake; you can still browse the collection.";
  return 'You are signed in. TAITIT reviews new accounts before they can send orders; meanwhile you can browse the collection and save designs.';
}

export function WaitingForConfirmation({
  email,
  password,
  reason,
  onContinue,
  onSignIn,
  onForgotPassword,
}: {
  email: string;
  password: string;
  reason: WaitReason;
  /** After the confirmation (already signed in): leave the auth screens. */
  onContinue: () => void;
  /** Stop waiting and use the normal sign-in screen. */
  onSignIn: () => void;
  onForgotPassword: () => void;
}) {
  const { resendConfirmation, profile, profileFailed } = useAuth();
  const existing = reason === 'existing_account';
  const [state, setState] = useState<State>('waiting');
  const [resent, setResent] = useState<string | null>(null);
  const [resendLocked, setResendLocked] = useState(false);
  const checking = useRef(false);
  const waiting = useRef(true); // false once this screen stops waiting (left, confirmed, gave up)
  const resendTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const started = useRef(0); // set when waiting starts (not during render)
  const delay = useRef(existing ? 0 : FIRST);
  const address = email.trim();

  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      // Tried on a client that keeps nothing: an answer that comes after the user left this screen
      // (e.g. "Sign in with another account") is just dropped and can't touch the app's sign-in.
      const { data, error } = await throwawayClient().auth.signInWithPassword({ email: address, password });
      if (!waiting.current) return;
      if (!error && data.session) {
        const { access_token, refresh_token } = data.session;
        const { error: setError } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!setError) setState('confirmed'); // else (e.g. connection lost): the next check tries again
      } else if (error?.code === 'invalid_credentials') setState('wrong_password');
      else if (error?.code === 'over_request_rate_limit' || error?.status === 429) delay.current *= 2;
      // email_not_confirmed (or no connection): keep waiting
    } finally {
      checking.current = false;
    }
  }, [address, password]);

  useEffect(() => {
    if (state !== 'waiting') return;
    waiting.current = true;
    if (!started.current) started.current = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false; // a check still running at cleanup must not schedule the next one
    const tick = () => {
      if (stopped) return;
      if (Date.now() - started.current > GIVE_UP) return setState('gave_up');
      timer = setTimeout(() => void check().then(tick), delay.current);
      delay.current = Math.max(delay.current, EVERY);
    };
    tick();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void check());
    return () => {
      stopped = true;
      waiting.current = false;
      clearTimeout(timer);
      sub.remove();
    };
  }, [state, check]);

  // Tell screen-reader users the wait is over.
  useEffect(() => {
    if (state === 'confirmed')
      AccessibilityInfo.announceForAccessibility(existing ? 'Signed in' : 'Email confirmed');
  }, [state, existing]);
  useEffect(() => () => clearTimeout(resendTimer.current), []);

  // One resend per minute (the email service is rate-limited).
  const resend = async () => {
    setResendLocked(true);
    resendTimer.current = setTimeout(() => setResendLocked(false), RESEND_WAIT);
    const { error } = await resendConfirmation(address);
    setResent(error ?? 'A new email is on its way. Use the newest link.');
  };

  if (state === 'confirmed')
    return (
      <View style={styles.box}>
        <Icon name="checkmark-circle" size={56} color={tokens.colors.success} />
        <AppText variant="heading" align="center">
          {existing ? 'You already have an account' : 'Email confirmed'}
        </AppText>
        {existing ? (
          <AppText align="center" color={tokens.colors.muted}>
            {`${address} already had a TAITIT account; we signed you in to it.`}
          </AppText>
        ) : null}
        <AppText align="center" color={tokens.colors.muted}>
          {accountLine(profile, profileFailed)}
        </AppText>
        <Button title="Continue" fullWidth onPress={onContinue} />
      </View>
    );

  if (existing)
    return (
      <View style={styles.box}>
        <Icon name="person-circle-outline" size={56} color={tokens.colors.primary} />
        <AppText variant="heading" align="center">
          You already have an account
        </AppText>
        {state === 'wrong_password' ? (
          <>
            <AppText align="center" color={tokens.colors.muted}>
              {`${address} already has a TAITIT account, with another password. Sign in with that password, or reset it.`}
            </AppText>
            <Button title="Sign in" fullWidth onPress={onSignIn} />
            <Button title="Forgot my password" variant="ghost" onPress={onForgotPassword} />
          </>
        ) : state === 'waiting' ? (
          <>
            <AppText align="center" color={tokens.colors.muted}>
              {`${address} already has a TAITIT account. Signing you in…`}
            </AppText>
            <Button title="Signing in…" fullWidth loading />
            <Button title="Sign in with another account" variant="ghost" onPress={onSignIn} />
          </>
        ) : (
          <>
            <AppText align="center" color={tokens.colors.muted}>
              {`${address} already has a TAITIT account. Sign in to continue.`}
            </AppText>
            <Button title="Sign in" fullWidth onPress={onSignIn} />
          </>
        )}
      </View>
    );

  return (
    <View style={styles.box}>
      <Icon name="mail-unread-outline" size={48} color={tokens.colors.primary} />
      <AppText variant="heading" align="center">
        Check your email
      </AppText>
      <AppText align="center" color={tokens.colors.muted}>
        {reason === 'signed_up'
          ? `We have sent a link to ${address}. Open it on this phone or on a computer to confirm your email.`
          : `${address} is not confirmed yet. Open the link we sent you, on this phone or on a computer. Can't find it, or did it expire? Tap “Resend email”.`}
      </AppText>
      {state === 'waiting' ? (
        <>
          <AppText variant="small" align="center">
            This screen continues by itself once the email is confirmed.
          </AppText>
          <Button title="Waiting for confirmation…" fullWidth disabled loading={false} />
        </>
      ) : state === 'wrong_password' ? (
        <>
          <AppText variant="small" align="center" color={tokens.colors.danger}>
            This email already has an account with another password. Sign in with that password, or reset it.
          </AppText>
          <Button title="Sign in" fullWidth onPress={onSignIn} />
          <Button title="Forgot my password" variant="ghost" onPress={onForgotPassword} />
        </>
      ) : (
        <>
          <AppText variant="small" align="center">
            Confirmed the email? Sign in to continue.
          </AppText>
          <Button title="Sign in" fullWidth onPress={onSignIn} />
        </>
      )}
      <Button
        title="Resend email"
        variant="ghost"
        icon="refresh-outline"
        disabled={resendLocked}
        onPress={() => void resend()}
      />
      {resent ? (
        <AppText variant="small" align="center">
          {resent}
        </AppText>
      ) : null}
      {state === 'waiting' ? (
        <Button title="Sign in with another account" variant="ghost" onPress={onSignIn} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: tokens.spacing.md, paddingTop: tokens.spacing.xl },
});
