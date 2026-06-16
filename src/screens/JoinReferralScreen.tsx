import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useI18n } from '../hooks/useI18n';
import { useSession } from '../hooks/useSession';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts } from '../theme';
import { showAlert } from '../lib/dialogs';
import { claimReferral } from '../services/referrals';
import { joinClubByCode } from '../services/clubs';
import {
  clearPendingReferralCode,
  readPendingReferralCode,
  stashPendingReferralCode,
} from '../lib/referralStash';
import { invalidateFriendsCache } from '../lib/friendsCache';

interface Props {
  /** The 6-char code from /join/<code>; falls back to a stashed code. */
  code?: string;
}

/**
 * F041 deep-link landing for /join/<code>.
 * - No session: stash the code and round-trip through /sign-in (returnTo carries
 *   the same /join/<code> so the user lands back here once authenticated).
 * - Session: claim the referral (auto-friends the inviter). If the code isn't a
 *   referral code, fall back to joining a club by the same code (F040 shares the
 *   /join path), then route to the appropriate screen.
 */
export function JoinReferralScreen({ code: codeProp }: Props) {
  const router = useRouter();
  const { s } = useI18n();
  const { user, isLoading } = useSession();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [status, setStatus] = useState<'working' | 'done'>('working');
  const ranRef = useRef(false);

  const code = (codeProp ?? readPendingReferralCode() ?? '').trim().toUpperCase();

  useEffect(() => {
    if (isLoading) return;
    if (ranRef.current) return;

    // Missing/garbage code → nowhere to go.
    if (!code) {
      ranRef.current = true;
      router.replace('/(tabs)');
      return;
    }

    // Pre-auth: stash + send to sign-in, returnTo brings us back here.
    if (!user) {
      ranRef.current = true;
      stashPendingReferralCode(code);
      router.replace({ pathname: '/sign-in', params: { returnTo: `/join/${code}` } });
      return;
    }

    ranRef.current = true;
    void (async () => {
      const { data: referrerId, error } = await claimReferral(code);

      if (!error && referrerId) {
        clearPendingReferralCode();
        invalidateFriendsCache(user.id);
        setStatus('done');
        showAlert(s('referralClaimedTitle'), s('referralClaimedBody'));
        router.replace('/(protected)/friends');
        return;
      }

      // Not a referral code (or a guard tripped) — try a club join with the
      // same code so F040 club links keep working through /join.
      const { data: clubId, error: clubError } = await joinClubByCode(code);
      if (!clubError && clubId) {
        clearPendingReferralCode();
        setStatus('done');
        router.replace({ pathname: '/(protected)/clubs/[id]', params: { id: String(clubId) } });
        return;
      }

      // Neither path worked — surface a friendly message and leave.
      clearPendingReferralCode();
      setStatus('done');
      const message = referralErrorMessage(s, error);
      showAlert(s('referralInvalidTitle'), message);
      router.replace('/(tabs)');
    })();
  }, [isLoading, user, code, router, s]);

  return (
    <View style={styles.container} testID="join-referral-screen">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.message}>
        {status === 'working' ? s('referralClaiming') : s('referralDone')}
      </Text>
    </View>
  );
}

/** Map a claim_referral RPC error to a localized message. */
function referralErrorMessage(
  s: (key: string, ...args: string[]) => string,
  error: { message?: string } | null,
): string {
  const msg = error?.message ?? '';
  if (msg.includes('self_referral')) return s('referralSelfError');
  if (msg.includes('already_referred')) return s('referralAlreadyError');
  if (msg.includes('referrer_not_found')) return s('referralNotFoundError');
  return s('referralGenericError');
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      paddingHorizontal: 28,
      backgroundColor: colors.bg,
    },
    message: {
      fontFamily: Fonts.body,
      fontSize: 15,
      textAlign: 'center',
      color: colors.text,
    },
  });
}
