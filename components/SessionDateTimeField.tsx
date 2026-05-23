import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View as RNView } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';

type SessionDateTimeFieldProps = {
  value: Date;
  onChange: (date: Date) => void;
  activeScheme: 'light' | 'dark';
  borderColor: string;
  inputBackground: string;
  textColor: string;
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function formatSessionDate(date: Date): string {
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function startWeekdaySunday0(year: number, monthIndex: number): number {
  return new Date(year, monthIndex, 1).getDay();
}

function dateKeyFromParts(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function localDateKey(date: Date): string {
  return dateKeyFromParts(date.getFullYear(), date.getMonth(), date.getDate());
}

function clampToNow(date: Date): Date {
  const now = new Date();
  return date.getTime() > now.getTime() ? now : date;
}

function withDatePart(base: Date, year: number, monthIndex: number, day: number): Date {
  const next = new Date(base);
  next.setFullYear(year, monthIndex, day);
  return clampToNow(next);
}

function withTimePart(base: Date, hours: number, minutes: number): Date {
  const next = new Date(base);
  next.setHours(hours, minutes, 0, 0);
  return clampToNow(next);
}

function isFutureDay(year: number, monthIndex: number, day: number): boolean {
  const today = new Date();
  const candidate = new Date(year, monthIndex, day, 23, 59, 59, 999);
  return candidate.getTime() > today.getTime();
}

type CalendarCell = {
  key: string;
  day: number | null;
  dateKey: string | null;
};

function buildCalendarCells(year: number, monthIndex: number): CalendarCell[] {
  const totalDays = daysInMonth(year, monthIndex);
  const leadingBlanks = startWeekdaySunday0(year, monthIndex);
  const cells: CalendarCell[] = [];

  for (let i = 0; i < leadingBlanks; i++) {
    cells.push({ key: `blank-start-${i}`, day: null, dateKey: null });
  }

  for (let day = 1; day <= totalDays; day++) {
    cells.push({
      key: `${year}-${monthIndex}-${day}`,
      day,
      dateKey: dateKeyFromParts(year, monthIndex, day),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `blank-end-${cells.length}`, day: null, dateKey: null });
  }

  return cells;
}

function TimeStepper({
  label,
  value,
  min,
  max,
  onChange,
  textColor,
  tint,
  borderColor,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  textColor: string;
  tint: string;
  borderColor: string;
}) {
  const decrement = () => onChange(value <= min ? max : value - 1);
  const increment = () => onChange(value >= max ? min : value + 1);

  return (
    <View style={styles.timeStepper} lightColor="transparent" darkColor="transparent">
      <Text style={[styles.timeStepperLabel, { color: textColor }]}>{label}</Text>
      <View style={styles.timeStepperControls} lightColor="transparent" darkColor="transparent">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          onPress={decrement}
          hitSlop={8}
          style={({ pressed }) => [styles.timeStepperButton, { borderColor }, pressed && styles.fieldPressed]}>
          <Ionicons name="remove" size={18} color={tint} />
        </Pressable>
        <Text style={[styles.timeStepperValue, { color: textColor }]}>{String(value).padStart(2, '0')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          onPress={increment}
          hitSlop={8}
          style={({ pressed }) => [styles.timeStepperButton, { borderColor }, pressed && styles.fieldPressed]}>
          <Ionicons name="add" size={18} color={tint} />
        </Pressable>
      </View>
    </View>
  );
}

export function SessionDateTimeField({
  value,
  onChange,
  activeScheme,
  borderColor,
  inputBackground,
  textColor,
}: SessionDateTimeFieldProps) {
  const tint = Colors[activeScheme].tint;
  const [showPicker, setShowPicker] = useState(false);
  const [draft, setDraft] = useState(value);
  const [calendarYear, setCalendarYear] = useState(() => value.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => value.getMonth());

  useEffect(() => {
    if (!showPicker) {
      setDraft(value);
      setCalendarYear(value.getFullYear());
      setCalendarMonth(value.getMonth());
    }
  }, [showPicker, value]);

  const openPicker = () => {
    setDraft(value);
    setCalendarYear(value.getFullYear());
    setCalendarMonth(value.getMonth());
    setShowPicker(true);
  };

  const closePicker = () => {
    setShowPicker(false);
  };

  const confirm = () => {
    onChange(clampToNow(draft));
    closePicker();
  };

  const calendarCells = useMemo(
    () => buildCalendarCells(calendarYear, calendarMonth),
    [calendarYear, calendarMonth],
  );

  const monthTitle = new Date(calendarYear, calendarMonth, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const todayKey = localDateKey(new Date());
  const selectedDateKey = localDateKey(draft);
  const isTodaySelected = selectedDateKey === todayKey;
  const now = new Date();
  const maxHour = isTodaySelected ? now.getHours() : 23;
  const maxMinute = isTodaySelected && draft.getHours() === now.getHours() ? now.getMinutes() : 59;

  const goPrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarYear((y) => y - 1);
      setCalendarMonth(11);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    const nextMonth = calendarMonth === 11 ? 0 : calendarMonth + 1;
    const nextYear = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
    const firstOfNext = new Date(nextYear, nextMonth, 1);
    if (firstOfNext.getTime() > new Date().getTime()) {
      return;
    }
    if (calendarMonth === 11) {
      setCalendarYear((y) => y + 1);
      setCalendarMonth(0);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const selectDay = (day: number) => {
    if (isFutureDay(calendarYear, calendarMonth, day)) {
      return;
    }
    setDraft((prev) => withDatePart(prev, calendarYear, calendarMonth, day));
  };

  const setHour = (hour: number) => {
    setDraft((prev) => {
      let next = withTimePart(prev, hour, prev.getMinutes());
      if (isTodaySelected && hour === now.getHours() && next.getMinutes() > now.getMinutes()) {
        next = withTimePart(next, hour, now.getMinutes());
      }
      return next;
    });
  };

  const setMinute = (minute: number) => {
    setDraft((prev) => withTimePart(prev, prev.getHours(), minute));
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Workout date and time"
        accessibilityHint="Opens date and time picker"
        onPress={openPicker}
        style={({ pressed }) => [
          styles.field,
          { borderColor, backgroundColor: inputBackground },
          pressed && styles.fieldPressed,
        ]}>
        <Ionicons name="calendar-outline" size={18} color={tint} />
        <Text style={[styles.fieldText, { color: textColor }]}>{formatSessionDate(value)}</Text>
      </Pressable>

      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={closePicker}>
        <Pressable style={styles.modalBackdrop} onPress={closePicker}>
          <Pressable
            style={[styles.sheet, { backgroundColor: activeScheme === 'dark' ? '#171717' : '#fff', borderColor }]}
            onPress={(event) => event.stopPropagation()}>
            <View style={styles.toolbar} lightColor="transparent" darkColor="transparent">
              <Pressable onPress={closePicker} hitSlop={8}>
                <Text style={[styles.toolbarButton, { color: tint }]}>Cancel</Text>
              </Pressable>
              <Text style={[styles.toolbarTitle, { color: textColor }]}>Date & time</Text>
              <Pressable onPress={confirm} hitSlop={8}>
                <Text style={[styles.toolbarButton, styles.toolbarDone, { color: tint }]}>Done</Text>
              </Pressable>
            </View>

            <View style={[styles.calendarCard, { borderColor }]} lightColor="transparent" darkColor="transparent">
              <View style={styles.monthNav} lightColor="transparent" darkColor="transparent">
                <Pressable onPress={goPrevMonth} hitSlop={12} style={({ pressed }) => [styles.monthNavBtn, pressed && styles.fieldPressed]}>
                  <Ionicons name="chevron-back" size={22} color={tint} />
                </Pressable>
                <Text style={[styles.monthTitle, { color: textColor }]}>{monthTitle}</Text>
                <Pressable onPress={goNextMonth} hitSlop={12} style={({ pressed }) => [styles.monthNavBtn, pressed && styles.fieldPressed]}>
                  <Ionicons name="chevron-forward" size={22} color={tint} />
                </Pressable>
              </View>

              <View style={styles.weekdayRow} lightColor="transparent" darkColor="transparent">
                {WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={[styles.weekdayCell, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>
                    {label}
                  </Text>
                ))}
              </View>

              <View style={styles.grid} lightColor="transparent" darkColor="transparent">
                {Array.from({ length: Math.ceil(calendarCells.length / 7) }, (_, row) => (
                  <View key={`row-${row}`} style={styles.calendarRow} lightColor="transparent" darkColor="transparent">
                    {calendarCells.slice(row * 7, row * 7 + 7).map((cell) => {
                      if (cell.day === null || cell.dateKey === null) {
                        return <View key={cell.key} style={styles.dayCell} lightColor="transparent" darkColor="transparent" />;
                      }

                      const disabled = isFutureDay(calendarYear, calendarMonth, cell.day);
                      const isSelected = selectedDateKey === cell.dateKey;
                      const isToday = cell.dateKey === todayKey;

                      return (
                        <Pressable
                          key={cell.key}
                          accessibilityRole="button"
                          accessibilityLabel={`${cell.day}, ${monthTitle}`}
                          disabled={disabled}
                          onPress={() => selectDay(cell.day!)}
                          style={({ pressed }) => [
                            styles.dayCell,
                            styles.dayCellInner,
                            isSelected && { borderWidth: 2, borderColor: tint, backgroundColor: activeScheme === 'dark' ? 'rgba(35, 213, 213, 0.15)' : 'rgba(57, 170, 170, 0.12)' },
                            isToday && !isSelected && { borderWidth: 1, borderColor: activeScheme === 'dark' ? 'rgba(35, 213, 213, 0.35)' : 'rgba(57, 170, 170, 0.35)' },
                            disabled && styles.dayCellDisabled,
                            pressed && !disabled && styles.fieldPressed,
                          ]}>
                          <Text style={[styles.dayNum, { color: textColor }, disabled && styles.dayNumDisabled]}>{cell.day}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.timeRow} lightColor="transparent" darkColor="transparent">
              <TimeStepper
                label="Hour"
                value={draft.getHours()}
                min={0}
                max={maxHour}
                onChange={setHour}
                textColor={textColor}
                tint={tint}
                borderColor={borderColor}
              />
              <Text style={[styles.timeSeparator, { color: textColor }]}>:</Text>
              <TimeStepper
                label="Minute"
                value={draft.getMinutes()}
                min={0}
                max={maxMinute}
                onChange={setMinute}
                textColor={textColor}
                tint={tint}
                borderColor={borderColor}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fieldPressed: {
    opacity: 0.75,
  },
  fieldText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 4,
  },
  toolbarTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  toolbarButton: {
    fontSize: 16,
  },
  toolbarDone: {
    fontWeight: '600',
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthNavBtn: {
    padding: 4,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    gap: 4,
  },
  calendarRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellInner: {
    borderRadius: 999,
    margin: 2,
  },
  dayCellDisabled: {
    opacity: 0.35,
  },
  dayNum: {
    fontSize: 14,
    fontWeight: '600',
  },
  dayNumDisabled: {
    opacity: 0.6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 4,
  },
  timeSeparator: {
    fontSize: 28,
    fontWeight: '700',
    paddingBottom: 18,
  },
  timeStepper: {
    alignItems: 'center',
    gap: 6,
    minWidth: 96,
  },
  timeStepperLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  timeStepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeStepperButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 6,
  },
  timeStepperValue: {
    fontSize: 24,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'center',
  },
});
