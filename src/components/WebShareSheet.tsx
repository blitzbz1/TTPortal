import React, { useMemo, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../hooks/useI18n';
import { useTheme } from '../hooks/useTheme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';
import { Lucide } from './Icon';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  url: string;
  onClose: () => void;
}

function shareText(message: string, url: string): string {
  return `${message}\n${url}`.trim();
}

async function copyText(text: string): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  const nav = globalThis.navigator;
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(text);
      return true;
    } catch {
      // Continue to the old textarea fallback below.
    }
  }

  const doc = globalThis.document;
  if (!doc?.body) return false;
  const textarea = doc.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  doc.body.appendChild(textarea);
  textarea.select();
  try {
    return doc.execCommand('copy');
  } finally {
    doc.body.removeChild(textarea);
  }
}

export function WebShareSheet({ visible, title, message, url, onClose }: Props) {
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(message);
  const fullText = shareText(message, url);

  const actions = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: 'message-circle',
      tone: '#25D366',
      bg: '#e9fbf0',
      url: `https://wa.me/?text=${encodeURIComponent(fullText)}`,
    },
    {
      id: 'telegram',
      label: 'Telegram',
      icon: 'send',
      tone: '#229ED9',
      bg: colors.bluePale,
      url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    },
    {
      id: 'email',
      label: 'Email',
      icon: 'mail',
      tone: colors.text,
      bg: colors.bgMuted,
      url: `mailto:?subject=${encodedText}&body=${encodeURIComponent(fullText)}`,
    },
    {
      id: 'open',
      label: s('shareOpenLink'),
      icon: 'external-link',
      tone: colors.primaryMid,
      bg: colors.primaryPale,
      url,
    },
  ] as const;

  const open = async (target: string) => {
    onClose();
    await Linking.openURL(target);
  };

  const copy = async () => {
    const ok = await copyText(fullText);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Lucide name="share-2" size={22} color={colors.textOnPrimary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.kicker}>{s('shareCard')}</Text>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{url}</Text>
            </View>
          </View>
          <View style={styles.grid}>
            {actions.map((action) => (
              <Pressable key={action.id} style={styles.action} onPress={() => void open(action.url)}>
                <View style={[styles.actionIcon, { backgroundColor: action.bg, borderColor: action.tone + '33' }]}>
                  <Lucide name={action.icon} size={18} color={action.tone} />
                </View>
                <Text style={styles.actionText}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.copy} onPress={() => void copy()} testID="web-share-copy">
            <Lucide name={copied ? 'check-circle' : 'clipboard-pen-line'} size={18} color={colors.primaryMid} />
            <Text style={styles.copyText}>{copied ? s('shareCopied') : s('shareCopyLink')}</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>{s('cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: Spacing.lg,
      backgroundColor: 'rgba(0,0,0,0.62)',
    },
    card: {
      width: '100%',
      maxWidth: 390,
      padding: Spacing.md,
      borderRadius: Radius.xl,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Shadows.lg,
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border,
      marginBottom: Spacing.md,
    },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: Radius.lg,
      backgroundColor: colors.primaryPale,
      borderWidth: 1,
      borderColor: colors.primaryDim,
      marginBottom: Spacing.md,
    },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      ...Shadows.sm,
    },
    heroCopy: { flex: 1, minWidth: 0 },
    kicker: {
      fontFamily: Fonts.body,
      fontSize: 10,
      fontWeight: FontWeight.bold,
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      color: colors.primaryMid,
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    subtitle: {
      marginTop: 2,
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textMuted,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 9,
    },
    action: {
      width: '48.5%',
      minHeight: 76,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      padding: 10,
      borderRadius: Radius.lg,
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    actionIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    actionText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    copy: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: Radius.lg,
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: colors.primaryDim,
    },
    copyText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.primaryMid,
    },
    cancel: { alignItems: 'center', paddingTop: 14 },
    cancelText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
  });
}
