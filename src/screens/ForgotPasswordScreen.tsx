import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';

export function ForgotPasswordScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Top Section */}
        <View style={styles.top}>
          <Text style={styles.logo}>TT PORTAL</Text>
          <View style={styles.iconWrap}>
            <Lucide name="lock" size={36} color={Colors.greenLight} />
          </View>
          <Text style={styles.title}>Reseteaz&#259; parola</Text>
          <Text style={styles.desc}>
            Introdu adresa de email asociat&#259; contului t&#259;u &#537;i &#238;&#539;i vom trimite un link de resetare.
          </Text>
        </View>

        {/* Middle Section */}
        <View style={styles.mid}>
          <View style={styles.inputField}>
            <Lucide name="mail" size={18} color={Colors.inkFaint} />
            <Text style={styles.inputPlaceholder}>Email</Text>
          </View>

          <TouchableOpacity style={styles.submitBtn}>
            <Text style={styles.submitText}>Trimite link de resetare</Text>
            <Lucide name="send" size={18} color={Colors.white} />
          </TouchableOpacity>

          <View style={styles.hintBox}>
            <Lucide name="info" size={16} color={Colors.greenLight} />
            <Text style={styles.hintText}>
              Verific&#259; inbox-ul &#537;i folderul spam. Link-ul expir&#259; &#238;n 60 de minute.
            </Text>
          </View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottom}>
          <TouchableOpacity style={styles.backRow}>
            <Lucide name="arrow-left" size={16} color={Colors.greenDim} />
            <Text style={styles.backText}>&#206;napoi la conectare</Text>
          </TouchableOpacity>
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
  top: {
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    fontFamily: Fonts.heading,
    fontSize: 24,
    fontWeight: '800',
    color: Colors.white,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0f3d22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.white,
  },
  desc: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.greenDim,
    textAlign: 'center',
    width: 300,
  },
  mid: {
    gap: 14,
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
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f3d22',
    borderRadius: Radius.md,
    padding: 14,
    gap: 10,
  },
  hintText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
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
    fontSize: 14,
    fontWeight: '500',
    color: Colors.greenDim,
  },
});
