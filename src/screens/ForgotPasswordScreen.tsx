import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius } from '../theme';

export function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Top Section */}
        <View style={styles.top}>
          <Text style={styles.logo}>TT PORTAL</Text>
          <View style={styles.iconWrap}>
            <Lucide name="lock" size={36} color={colors.primaryLight} />
          </View>
          <Text style={styles.title}>Reseteaz&#259; parola</Text>
          <Text style={styles.desc}>
            Introdu adresa de email asociat&#259; contului t&#259;u &#537;i &#238;&#539;i vom trimite un link de resetare.
          </Text>
        </View>

        {/* Middle Section */}
        <View style={styles.mid}>
          <View style={styles.inputField}>
            <Lucide name="mail" size={18} color={colors.textFaint} />
            <Text style={styles.inputPlaceholder}>Email</Text>
          </View>

          <TouchableOpacity style={styles.submitBtn}>
            <Text style={styles.submitText}>Trimite link de resetare</Text>
            <Lucide name="send" size={18} color={colors.textOnPrimary} />
          </TouchableOpacity>

          <View style={styles.hintBox}>
            <Lucide name="info" size={16} color={colors.primaryLight} />
            <Text style={styles.hintText}>
              Verific&#259; inbox-ul &#537;i folderul spam. Link-ul expir&#259; &#238;n 60 de minute.
            </Text>
          </View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottom}>
          <TouchableOpacity style={styles.backRow}>
            <Lucide name="arrow-left" size={16} color={colors.primaryDim} />
            <Text style={styles.backText}>&#206;napoi la conectare</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primary,
    },
    content: {
      flex: 1,
      justifyContent: 'space-between',
      paddingTop: 60,
      paddingBottom: Spacing.xxl,
      paddingHorizontal: 28,
    },
    top: {
      alignItems: 'center',
      gap: Spacing.md,
    },
    logo: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.display,
      fontWeight: FontWeight.extrabold,
      color: colors.textOnPrimary,
    },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.authInputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: 22,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    desc: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.primaryDim,
      textAlign: 'center',
      width: 300,
    },
    mid: {
      gap: 14,
    },
    inputField: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.authInputBg,
      borderRadius: Radius.md,
      height: 48,
      paddingHorizontal: 14,
      gap: 10,
    },
    inputPlaceholder: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.textFaint,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      height: 50,
      gap: Spacing.xs,
    },
    submitText: {
      fontFamily: Fonts.body,
      fontSize: 15,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    hintBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.authInputBg,
      borderRadius: Radius.md,
      padding: 14,
      gap: 10,
    },
    hintText: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      color: colors.textFaint,
    },
    bottom: {
      alignItems: 'center',
    },
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    backText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.medium,
      color: colors.primaryDim,
    },
  });
}
