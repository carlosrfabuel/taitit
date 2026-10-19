import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { supabase } from '@/lib/supabase';
import { AppText, Button, Icon } from '@/ui';
import { useAuth } from './AuthProvider';

// Shown after sign-up (and when someone signs in before confirming): waits for the email to be
// confirmed, wherever the link is opened (this phone or a computer). It tries to sign in with the
// email and password just typed: Supabase refuses with "email not confirmed" until the link has been
// opened, then signs in. The password stays in memory only while this screen is open.
// Every 15 s (sign-in attempts are rate-limited) and right away when the app comes back to the
// front (the usual moment: back from the email app); it stops after 15 minutes.

const FIRST = 3_000; // e.g. a repeated sign-up of an already confirmed email: no need to wait 15 s
const EVERY = 15_000;
const GIVE_UP = 15 * 60_000;
const RESEND_WAIT = 60_000;

type State = 'waiting' | 'confirmed' | 'gave_up' | 'wrong_password';

export function WaitingForConfirmation({
  email,
  password,
  justSent,
  onContinue,
  onSignIn,
}: {
  email: string;
  password: string;
  /** True right after sign-up (an email was just sent); false when coming from a sign-in attempt. */
  justSent: boolean;
  /** After the confirmation (already signed in): leave the auth screens. */
  onContinue: () => void;
  /** Stop waiting and use the normal sign-in screen. */
  onSignIn: () => void;
}) {
  const { resendConfirmation } = useAuth();
  const [state, setState] = useState<State>('waiting');
  const [resent, setResent] = useState<string | null>(null);
  const [resendLocked, setResendLocked] = useState(false);
  const checking = useRef(false);
  const waiting = useRef(true); // false once this screen stops waiting (left, confirmed, gave up)
  const resendTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const started = useRef(0); // set when waiting starts (not during render)
  const delay = useRef(FIRST);
  const address = email.trim();

  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: address, password });
      // Answer to a request sent before the user left this screen (e.g. "Sign in with another
      // account"): don't stay signed in to this account behind their back.
      if (!waiting.current) {
        if (!error) await supabase.auth.signOut({ scope: 'local' });
        return;
      }
      if (!error) setState('confirmed');
      else if (error.code === 'invalid_credentials') setState('wrong_password');
      else if (error.code === 'over_request_rate_limit' || error.status === 429) delay.current *= 2;
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
    if (state === 'confirmed') AccessibilityInfo.announceForAccessibility('Email confirmed');
  }, [state]);
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
          Email confirmed
        </AppText>
        <AppText align="center" color={tokens.colors.muted}>
          You are signed in. TAITIT reviews new accounts before they can send orders; meanwhile you can browse
          the collection and save designs.
        </AppText>
        <Button title="Continue" fullWidth onPress={onContinue} />
      </View>
    );

  return (
    <View style={styles.box}>
      <Icon name="mail-unread-outline" size={48} color={tokens.colors.primary} />
      <AppText variant="heading" align="center">
        Check your email
      </AppText>
      <AppText align="center" color={tokens.colors.muted}>
        {justSent
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
            This email already has an account with another password. Sign in with that password.
          </AppText>
          <Button title="Sign in" fullWidth onPress={onSignIn} />
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
