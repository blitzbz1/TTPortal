import { StyleSheet } from 'react-native';
import { Colors, Fonts, Radius } from '../theme';

const INPUT_BG = '#0f3d22';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.green,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 28,
  },
  branding: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  brandSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.greenDim,
    opacity: 0.7,
  },
  brandLogo: {
    fontFamily: Fonts.heading,
    fontSize: 42,
    fontWeight: '800',
    color: Colors.white,
  },
  brandTagline: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.greenDim,
    textAlign: 'center',
    maxWidth: 260,
  },
  form: {
    gap: 14,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: INPUT_BG,
    borderRadius: 12,
  },
  tab: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: Colors.white,
  },
  tabText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.greenDim,
  },
  tabTextActive: {
    color: Colors.green,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderRadius: Radius.md,
    height: 48,
    paddingHorizontal: 14,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.white,
    height: 48,
    paddingVertical: 0,
  },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.red,
    textAlign: 'center',
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
  submitBtnDisabled: {
    opacity: 0.6,
  },
  socialBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontFamily: Fonts.body,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  termsText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.greenDim,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    textDecorationLine: 'underline',
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
    backgroundColor: INPUT_BG,
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
});
