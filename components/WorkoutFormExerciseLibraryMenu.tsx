import { Ionicons } from '@expo/vector-icons';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';

const ACTION_SHEET_SLIDE = 320;

type Props = {
  navigation: NavigationProp<ParamListBase>;
  activeScheme: 'light' | 'dark';
  /** Invoked after the sheet finishes closing. */
  onExerciseLibrary: () => void;
};

/**
 * Header ⋮ + bottom action sheet (same look as Workouts list) with a single
 * "Exercise Library" action for Create / Edit workout screens.
 */
export function WorkoutFormExerciseLibraryMenu({ navigation, activeScheme, onExerciseLibrary }: Props) {
  const insets = useSafeAreaInsets();
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const sheetTranslateY = useRef(new Animated.Value(ACTION_SHEET_SLIDE)).current;

  const closeActionSheet = useCallback(
    (afterClose?: () => void) => {
      Animated.timing(sheetTranslateY, {
        toValue: ACTION_SHEET_SLIDE,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setIsActionSheetOpen(false);
          afterClose?.();
        }
      });
    },
    [sheetTranslateY],
  );

  const openActionSheet = useCallback(() => {
    setIsActionSheetOpen(true);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={openActionSheet}
          accessibilityRole="button"
          accessibilityLabel="Workout menu"
          hitSlop={10}
          style={{ marginRight: 15 }}>
          {({ pressed }) => (
            <Ionicons
              name="ellipsis-vertical"
              size={22}
              color={Colors[activeScheme].tint}
              style={{ opacity: pressed ? 0.55 : 1 }}
            />
          )}
        </Pressable>
      ),
    });
    return () => {
      navigation.setOptions({ headerRight: undefined });
    };
  }, [navigation, activeScheme, openActionSheet]);

  useEffect(() => {
    if (!isActionSheetOpen) {
      return;
    }
    sheetTranslateY.setValue(ACTION_SHEET_SLIDE);
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      damping: 22,
      stiffness: 220,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  }, [isActionSheetOpen, sheetTranslateY]);

  useEffect(() => {
    if (!isActionSheetOpen) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeActionSheet();
      return true;
    });
    return () => sub.remove();
  }, [isActionSheetOpen, closeActionSheet]);

  const sheetBackground = activeScheme === 'dark' ? '#1e1a2e' : '#ffffff';
  const sheetBorder = activeScheme === 'dark' ? '#3d3558' : '#e5e5e5';

  if (!isActionSheetOpen) {
    return null;
  }

  return (
    <View
      style={styles.actionOverlay}
      pointerEvents="box-none"
      lightColor="transparent"
      darkColor="transparent">
      <Pressable style={styles.actionSheetBackdrop} onPress={() => closeActionSheet()} accessibilityRole="button" />
      <Animated.View
        style={[
          styles.actionSheet,
          {
            backgroundColor: sheetBackground,
            borderTopColor: sheetBorder,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            transform: [{ translateY: sheetTranslateY }],
          },
        ]}>
        <View style={[styles.actionSheetHandle, { backgroundColor: activeScheme === 'dark' ? '#5b5378' : '#d4d4d4' }]} />
        <Pressable
          style={({ pressed }) => [styles.actionSheetRow, pressed && styles.actionSheetRowPressed]}
          accessibilityRole="button"
          accessibilityLabel="Exercise Library"
          onPress={() => {
            closeActionSheet(() => {
              onExerciseLibrary();
            });
          }}>
          <Ionicons name="library-outline" size={22} color="#D40078" style={styles.actionSheetIcon} />
          <Text style={[styles.actionSheetLabel, styles.rowMagenta]}>Exercise Library</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
    justifyContent: 'flex-end',
  },
  actionSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  actionSheet: {
    width: '100%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  actionSheetHandle: {
    alignSelf: 'flex-start',
    marginLeft: 20,
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  actionSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  actionSheetIcon: {
    width: 28,
  },
  actionSheetRowPressed: {
    opacity: 0.75,
  },
  actionSheetLabel: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'left',
  },
  rowMagenta: {
    color: '#D40078',
    fontWeight: '600',
  },
});
