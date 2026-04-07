import React, { useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { ThemeColors } from '../theme';

const SCREEN_H = Dimensions.get('window').height;

interface EventDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  colors: ThemeColors;
  ms: any;
  insets: { top: number; bottom: number };
  children: React.ReactNode;
}

export function EventDetailSheet({ visible, onClose, colors, ms, insets, children }: EventDetailSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);

  // Snap points: content-fit → 80% → full screen
  const snapPoints = useMemo(
    () => [SCREEN_H * 0.8, SCREEN_H - insets.top],
    [insets.top],
  );

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) onClose();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    [],
  );

  const renderHandle = useCallback(
    () => (
      <View style={ms.handleWrap}>
        <View style={ms.handle} />
      </View>
    ),
    [ms],
  );

  if (!visible) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing
      enablePanDownToClose
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      handleComponent={renderHandle}
      backgroundStyle={{ backgroundColor: colors.bgAlt }}
      topInset={insets.top}
      maxDynamicContentSize={SCREEN_H * 0.6}
      style={styles.sheet}
    >
      <BottomSheetScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator
      >
        {children}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxWidth: 430,
    alignSelf: 'center',
    width: '100%',
  },
  content: {
    paddingHorizontal: 20,
  },
});
