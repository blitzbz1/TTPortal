import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';

type AuthTab = 'signup' | 'login';

export function SignupLoginScreen() {
  const [activeTab, setActiveTab] = useState<AuthTab>('signup');

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Top Branding */}
        <View style={styles.branding}>
          <Text style={styles.subtitle}>Mese Tenis Rom&#226;nia</Text>
          <Text style={styles.logo}>TT PORTAL</Text>
          <Text style={styles.tagline}>
            G&#259;se&#537;te o mas&#259; de tenis.{'\n'}Joac&#259; cu prietenii.
          </Text>
        </View>

        {/* Auth Form */}
        <View style={styles.form}>
          {/* Tabs */}
          <View style={styles.authTabs}>
            <TouchableOpacity
              style={[styles.authTab, activeTab === 'signup' && styles.authTabActive]}
              onPress={() => setActiveTab('signup')}
            >
              <Text style={[styles.authTabText, activeTab === 'signup' && styles.authTabTextActive]}>
                &#206;nregistrare
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.authTab, activeTab === 'login' && styles.authTabActive]}
              onPress={() => setActiveTab('login')}
            >
              <Text style={[styles.authTabText, activeTab === 'login' && styles.authTabTextActive]}>
                Conectare
              </Text>
            </TouchableOpacity>
          </View>

          {/* Name Field (signup only) */}
          {activeTab === 'signup' && (
            <View style={styles.inputField}>
              <Lucide name="user" size={18} color={Colors.inkFaint} />
              <Text style={styles.inputPlaceholder}>Nume complet</Text>
            </View>
          )}

          {/* Email Field */}
          <View style={styles.inputField}>
            <Lucide name="mail" size={18} color={Colors.inkFaint} />
            <Text style={styles.inputPlaceholder}>Email</Text>
          </View>

          {/* Password Field */}
          <View style={styles.inputField}>
            <Lucide name="lock" size={18} color={Colors.inkFaint} />
            <Text style={[styles.inputPlaceholder, { flex: 1 }]}>Parol&#259;</Text>
            <Lucide name="eye-off" size={18} color={Colors.inkFaint} />
          </View>

          {/* Submit Button */}
          <TouchableOpacity style={styles.submitBtn}>
            <Text style={styles.submitText}>
              {activeTab === 'signup' ? 'Creeaz&#259; cont' : 'Conectare'}
            </Text>
            <Lucide name="arrow-right" size={20} color={Colors.white} />
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>sau</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Buttons */}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.googleBtn}>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.appleBtn}>
              <Lucide name="apple" size={20} color={Colors.white} />
              <Text style={styles.appleText}>Apple</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottom}>
          <Text style={styles.terms}>
            Prin &#238;nregistrare, accep&#539;i Termenii &#537;i condi&#539;iile{'\n'}
            &#537;i Politica de confiden&#539;ialitate
          </Text>
          <View style={styles.langRow}>
            <TouchableOpacity style={styles.langActive}>
              <Text style={styles.langActiveText}>RO</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.langInactive}>
              <Text style={styles.langInactiveText}>EN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.green,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 28,
  },
  branding: {
    alignItems: 'center',
    gap: 12,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.greenDim,
    opacity: 0.7,
  },
  logo: {
    fontFamily: Fonts.heading,
    fontSize: 42,
    fontWeight: '800',
    color: Colors.white,
  },
  tagline: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.greenDim,
    textAlign: 'center',
    width: 260,
  },
  form: {
    gap: 14,
  },
  authTabs: {
    flexDirection: 'row',
    backgroundColor: '#0f3d22',
    borderRadius: 12,
  },
  authTab: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  authTabActive: {
    backgroundColor: Colors.white,
  },
  authTabText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.greenDim,
  },
  authTabTextActive: {
    color: Colors.green,
    fontWeight: '600',
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f3d22',
    borderRadius: Radius.md,
    height: 48,
    paddingHorizontal: 14,
    gap: 10,
  },
  inputPlaceholder: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkFaint,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.greenLight,
    borderRadius: 12,
    height: 50,
    gap: 8,
  },
  submitText: {
    fontFamily: Fonts.body,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#0f3d22',
  },
  dividerText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.inkFaint,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  googleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    height: 46,
    gap: 8,
  },
  googleIcon: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.green,
  },
  googleText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.green,
  },
  appleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    height: 46,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.greenDim,
  },
  appleText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  bottom: {
    alignItems: 'center',
    gap: 16,
  },
  terms: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
    textAlign: 'center',
    width: 280,
  },
  langRow: {
    flexDirection: 'row',
    gap: 4,
  },
  langActive: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langActiveText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.green,
  },
  langInactive: {
    borderRadius: 14,
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langInactiveText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.inkFaint,
  },
});
