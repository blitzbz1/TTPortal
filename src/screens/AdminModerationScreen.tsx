import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';

const STATS = [
  { value: '8', label: '\u00cen a\u0219teptare', bg: Colors.amberPale, color: Colors.orange },
  { value: '156', label: 'Aprobate', bg: Colors.greenPale, color: '#15803d' },
  { value: '3', label: 'Raportate', bg: Colors.redPale, color: Colors.redDeep },
];

export function AdminModerationScreen() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Lucide name="arrow-left" size={24} color={Colors.white} />
        <Text style={styles.headerTitle}>Moderare</Text>
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>Admin</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Stats */}
        <View style={styles.statsRow}>
          {STATS.map((stat) => (
            <View key={stat.label} style={[styles.statCard, { backgroundColor: stat.bg }]}>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Pending Section Label */}
        <View style={styles.secLabel}>
          <Text style={styles.secLabelText}>LOCA&#538;II &#206;N A&#536;TEPTARE</Text>
        </View>

        {/* Moderation Card */}
        <View style={styles.modList}>
          <View style={styles.modCard}>
            <View style={styles.modTop}>
              <Text style={styles.modTitle}>Parcul Floreasca &#8212; Zona Nord</Text>
              <View style={styles.modBadge}>
                <Text style={styles.modBadgeText}>Nou</Text>
              </View>
            </View>
            <Text style={styles.modMeta}>
              Ad&#259;ugat de @radu_c &#183; acum 2 ore &#183; Bucure&#537;ti, Sector 1
            </Text>
            <View style={styles.modActions}>
              <TouchableOpacity style={styles.approveBtn}>
                <Lucide name="check" size={14} color={Colors.white} />
                <Text style={styles.approveBtnText}>Aprob&#259;</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editBtn}>
                <Lucide name="pencil" size={14} color={Colors.inkMuted} />
                <Text style={styles.editBtnText}>Editeaz&#259;</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn}>
                <Lucide name="x" size={14} color={Colors.red} />
                <Text style={styles.rejectBtnText}>Respinge</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Flagged Reviews Section Label */}
        <View style={styles.secLabel}>
          <Text style={styles.secLabelText}>RECENZII RAPORTATE</Text>
        </View>

        {/* Flagged Review Card */}
        <View style={styles.flagList}>
          <View style={styles.flagCard}>
            <View style={styles.flagTop}>
              <View style={styles.flagInfo}>
                <Text style={styles.flagAuthor}>Ion Vasilescu</Text>
                <Text style={styles.flagMeta}>Parcul Titan &#183; acum 1 zi</Text>
              </View>
              <View style={styles.flagBadge}>
                <Text style={styles.flagBadgeText}>2 raport&#259;ri</Text>
              </View>
            </View>
            <Text style={styles.flagText}>
              {'"Mesele sunt oribile, nu merit&#259; nici s&#259; te ui&#539;i la ele. Loc de evitat complet."'}
            </Text>
            <View style={styles.flagActions}>
              <TouchableOpacity style={styles.keepBtn}>
                <Lucide name="check" size={14} color={Colors.inkMuted} />
                <Text style={styles.keepBtnText}>P&#259;streaz&#259;</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn}>
                <Lucide name="trash-2" size={14} color={Colors.white} />
                <Text style={styles.deleteBtnText}>&#536;terge</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.green,
    height: 52,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  adminBadge: {
    backgroundColor: Colors.greenLight,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  adminBadgeText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
  scroll: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingBottom: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: Radius.md,
    padding: 10,
    gap: 2,
  },
  statValue: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
  secLabel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 8,
  },
  secLabelText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.inkFaint,
    letterSpacing: 1,
  },
  modList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  modCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1.5,
    borderColor: Colors.amber,
  },
  modTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modTitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink,
    flex: 1,
  },
  modBadge: {
    backgroundColor: Colors.amberPale,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  modBadgeText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '600',
    color: Colors.orange,
  },
  modMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  modActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.green,
    borderRadius: 8,
    height: 36,
    gap: 6,
  },
  approveBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    height: 36,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    height: 36,
    gap: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.red,
  },
  flagList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  flagCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1.5,
    borderColor: Colors.red,
  },
  flagTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flagInfo: {
    gap: 2,
  },
  flagAuthor: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink,
  },
  flagMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  flagBadge: {
    backgroundColor: Colors.redPale,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  flagBadgeText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '600',
    color: Colors.red,
  },
  flagText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontStyle: 'italic',
    color: Colors.inkMuted,
  },
  flagActions: {
    flexDirection: 'row',
    gap: 8,
  },
  keepBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    height: 36,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  keepBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.redDeep,
    borderRadius: 8,
    height: 36,
    gap: 6,
  },
  deleteBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
});
