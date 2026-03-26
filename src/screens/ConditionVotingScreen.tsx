import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';

type ConditionOption = 'good' | 'acceptable' | 'damaged';

const OPTIONS: { key: ConditionOption; color: string; label: string; desc: string }[] = [
  { key: 'good', color: Colors.greenLight, label: 'Bun\u0103', desc: 'Masa e \u00een stare bun\u0103, se poate juca f\u0103r\u0103 probleme' },
  { key: 'acceptable', color: Colors.amber, label: 'Acceptabil\u0103', desc: 'Se poate juca, dar are unele defecte minore' },
  { key: 'damaged', color: Colors.red, label: 'Deteriorat\u0103', desc: 'Masa necesit\u0103 repara\u021Bii, nu se poate juca confortabil' },
];

export function ConditionVotingScreen() {
  const [selected, setSelected] = useState<ConditionOption>('good');

  return (
    <View style={styles.container}>
      {/* Map bg placeholder */}
      <View style={styles.mapBg} />

      {/* Voting Sheet */}
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handleWrap}>
          <View style={styles.handleBar} />
        </View>

        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Starea mesei</Text>
          <TouchableOpacity style={styles.closeBtn}>
            <Lucide name="x" size={16} color={Colors.inkMuted} />
          </TouchableOpacity>
        </View>

        {/* Venue Context */}
        <View style={styles.venueCtx}>
          <View style={styles.venueIcon}>
            <Lucide name="map-pin" size={20} color={Colors.greenLight} />
          </View>
          <View style={styles.venueInfo}>
            <Text style={styles.venueName}>Parcul Her&#259;str&#259;u &#8212; Masa 3</Text>
            <Text style={styles.venueSub}>Ultima evaluare: acum 14 zile</Text>
          </View>
        </View>

        <ScrollView style={styles.voteForm}>
          {/* Options */}
          <Text style={styles.label}>Cum evaluezi starea mesei?</Text>
          <View style={styles.optGrid}>
            {OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.optCard,
                  selected === opt.key && { borderColor: opt.color, borderWidth: 2, backgroundColor: opt.key === 'good' ? Colors.greenPale : undefined },
                ]}
                onPress={() => setSelected(opt.key)}
              >
                <View style={[styles.optDot, { backgroundColor: opt.color }]} />
                <View style={styles.optInfo}>
                  <Text style={styles.optLabel}>{opt.label}</Text>
                  <Text style={styles.optDesc}>{opt.desc}</Text>
                </View>
                {selected === opt.key && (
                  <Lucide name="check-circle" size={22} color={opt.color} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Photo */}
          <Text style={styles.label}>Adaug&#259; o fotografie (op&#539;ional)</Text>
          <TouchableOpacity style={styles.photoBtn}>
            <Lucide name="camera" size={20} color={Colors.inkFaint} />
            <Text style={styles.photoBtnText}>Fotografiaz&#259; masa</Text>
          </TouchableOpacity>

          {/* Vote Stats */}
          <View style={styles.voteStats}>
            <Lucide name="bar-chart-3" size={16} color={Colors.inkMuted} />
            <Text style={styles.voteStatsText}>
              {'23 evalu&#259;ri · ultima: acum 14 zile · 78% "Bun&#259;"'}
            </Text>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Anuleaz&#259;</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.submitBtn}>
            <Text style={styles.submitText}>Trimite vot</Text>
            <Lucide name="send" size={16} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#e8e8e4',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 620,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 10,
  },
  handleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sheetTitle: {
    fontFamily: Fonts.heading,
    fontSize: 19,
    fontWeight: '700',
    color: Colors.ink,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueCtx: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
  },
  venueIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.greenPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueInfo: {
    flex: 1,
    gap: 2,
  },
  venueName: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink,
  },
  venueSub: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  voteForm: {
    flex: 1,
    paddingHorizontal: 20,
  },
  label: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.inkMuted,
    marginBottom: 8,
    marginTop: 16,
  },
  optGrid: {
    gap: 8,
  },
  optCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  optInfo: {
    flex: 1,
    gap: 2,
  },
  optLabel: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink,
  },
  optDesc: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    height: 60,
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  photoBtnText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.inkFaint,
  },
  voteStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgDark,
    borderRadius: Radius.md,
    padding: 12,
    gap: 8,
    marginTop: 16,
    marginBottom: 16,
  },
  voteStatsText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkMuted,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.green,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 20,
    gap: 6,
  },
  submitText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
});
