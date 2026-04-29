import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable, Linking } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Lucide } from '../../components/Icon';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../hooks/useI18n';
import type { AmaturEvent } from '../../services/amatur';
import { createStyles } from '../EventSchedulingScreen.styles';

interface Props {
  event: AmaturEvent | null;
  bottomInset: number;
  onClose: () => void;
}

export function AmaturDetailSheet({ event, bottomInset, onClose }: Props) {
  const { s, lang } = useI18n();
  const { colors, isDark } = useTheme();
  const { styles, ms } = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const locale = lang === 'en' ? 'en-GB' : 'ro-RO';

  return (
    <Modal
      visible={event !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={ms.overlay} onPress={onClose}>
        <Pressable style={[ms.sheet, { paddingBottom: bottomInset + 16 }]} onPress={() => {}}>
          {event && (
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View style={ms.handleWrap}>
                <View style={ms.handle} />
              </View>

              <View style={ms.titleRow}>
                <Text style={ms.title} numberOfLines={2}>
                  {event.name || event.city}
                </Text>
                {event.tables != null && (
                  <View style={[styles.eventBadge, { backgroundColor: colors.bluePale }]}>
                    <Text style={[styles.eventBadgeText, { color: colors.blue }]}>
                      {event.tables} {s('tables')}
                    </Text>
                  </View>
                )}
              </View>

              <View style={ms.infoBlock}>
                <View style={ms.infoRow}>
                  <Lucide name="calendar" size={16} color={colors.accentBright} />
                  <Text style={ms.infoText}>
                    {event.startDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>

                <View style={ms.infoRow}>
                  <Lucide name="map-pin" size={16} color={colors.primaryMid} />
                  <Text style={ms.infoText}>{event.city}</Text>
                </View>

                {event.address && (
                  <View style={ms.infoRow}>
                    <Lucide name="home" size={16} color={colors.textFaint} />
                    <Text style={ms.infoText}>{event.address}</Text>
                  </View>
                )}

                {event.categories.length > 0 && (
                  <View style={ms.infoRow}>
                    <Lucide name="list" size={16} color={colors.blue} />
                    <Text style={ms.infoText}>
                      {event.categories.join('  /  ')}
                    </Text>
                  </View>
                )}
              </View>

              {event.categorySpots.length > 0 && (
                <View style={styles.amaturSpotsDetail}>
                  {event.categorySpots.map((cs) => (
                    <View key={cs.category} style={styles.amaturSpotDetailRow}>
                      <Text style={styles.amaturSpotDetailLabel}>{cs.category}</Text>
                      <Text style={styles.amaturSpotDetailValue}>{cs.spots} {s('spots')}</Text>
                    </View>
                  ))}
                </View>
              )}

              {event.latitude != null && event.longitude != null && (
                <View style={styles.amaturMapWrap}>
                  <MapView
                    style={styles.amaturMap}
                    initialRegion={{
                      latitude: event.latitude,
                      longitude: event.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                  >
                    <Marker
                      coordinate={{ latitude: event.latitude, longitude: event.longitude }}
                      title={event.city}
                      description={event.address ?? undefined}
                    />
                  </MapView>
                </View>
              )}

              {event.latitude != null && event.longitude != null && (
                <View style={styles.amaturNavSection}>
                  <View style={styles.amaturNavRow}>
                    <TouchableOpacity style={styles.amaturNavBtn} onPress={() => Linking.openURL(`https://maps.google.com/?q=${event.latitude},${event.longitude}`)}>
                      <Lucide name="navigation" size={14} color={colors.textMuted} />
                      <Text style={styles.amaturNavBtnText}>Google</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.amaturNavBtn} onPress={() => Linking.openURL(`https://maps.apple.com/?q=${event.latitude},${event.longitude}`)}>
                      <Lucide name="navigation" size={14} color={colors.textMuted} />
                      <Text style={styles.amaturNavBtnText}>Apple</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.amaturNavBtn} onPress={() => Linking.openURL(`https://waze.com/ul?ll=${event.latitude},${event.longitude}&navigate=yes`)}>
                      <Lucide name="navigation" size={14} color={colors.textMuted} />
                      <Text style={styles.amaturNavBtnText}>Waze</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={ms.actions}>
                {event.forumUrl && (
                  <TouchableOpacity
                    style={[ms.actionBtn, ms.actionJoin]}
                    onPress={() => Linking.openURL(event.forumUrl!)}
                  >
                    <Lucide name="external-link" size={16} color={colors.textOnPrimary} />
                    <Text style={[ms.actionText, ms.actionJoinText]}>
                      {s('ampiForumThread')}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={ms.closeBtn} onPress={onClose}>
                  <Text style={ms.closeBtnText}>{s('close')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
