import {
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { ActivityTypePicker } from '@/components/ActivityTypePicker';
import { CardioPlanEditor } from '@/components/CardioPlanEditor';
import { DurationUnitPicker } from '@/components/DurationUnitPicker';
import { NumericTextInput } from '@/components/NumericTextInput';
import { ScoreUnitPicker } from '@/components/ScoreUnitPicker';
import { WeightUnitPicker } from '@/components/WeightUnitPicker';
import { Text, View } from '@/components/Themed';
import type { ActivityType } from '@/lib/activityTypes';
import type { CardioDistanceUnit } from '@/lib/cardioDistanceUnits';
import type { CardioDistanceTracking, CardioDurationTracking, CardioObjective } from '@/lib/cardioPlan';
import { SPORT_DURATION_UNITS, STRETCH_DURATION_UNITS, type DurationUnit } from '@/lib/durationUnits';
import { INTEGER_DECIMAL_PLACES } from '@/lib/numericInput';
import type { ScoreUnit } from '@/lib/scoreUnits';
import type { WeightUnit } from '@/lib/weightUnits';
import type { ExerciseDraftRow } from '@/lib/exerciseDraft';

type NumericDraftField = 'sets' | 'reps' | 'weight' | 'duration' | 'distance' | 'paceDuration' | 'paceDistance';
type TextDraftField = 'score';
export type ExerciseDraftField = NumericDraftField | TextDraftField;

type Props = {
  draft: ExerciseDraftRow;
  disabled?: boolean;
  activeScheme: 'light' | 'dark';
  borderColor: string;
  textColor: string;
  exerciseNameInputStyle: StyleProp<TextStyle>;
  setRowInputStyle: StyleProp<TextStyle>;
  lockedFieldStyle?: StyleProp<TextStyle>;
  onActivityTypeChange: (activityType: ActivityType) => void;
  onNameChange: (name: string) => void;
  onFieldChange: (field: ExerciseDraftField, value: string) => void;
  onDistanceUnitChange: (unit: CardioDistanceUnit) => void;
  onCardioObjectiveChange: (objective: CardioObjective) => void;
  onCardioDurationTrackingChange: (tracking: CardioDurationTracking) => void;
  onCardioDistanceTrackingChange: (tracking: CardioDistanceTracking) => void;
  onDurationUnitChange: (unit: DurationUnit) => void;
  onPaceDurationUnitChange: (unit: DurationUnit) => void;
  onPaceDistanceUnitChange: (unit: CardioDistanceUnit) => void;
  onScoreUnitChange: (unit: ScoreUnit) => void;
  onWeightUnitChange: (unit: WeightUnit) => void;
};

function UnitField({
  value,
  onChangeText,
  placeholder,
  suffix,
  maxDecimalPlaces,
  editable,
  setRowInputStyle,
  suffixColor,
  wrapStyle,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  suffix: string;
  maxDecimalPlaces: number;
  editable: boolean;
  setRowInputStyle: StyleProp<TextStyle>;
  suffixColor: string;
  wrapStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.unitInputWrap, wrapStyle]}>
      <NumericTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        maxDecimalPlaces={maxDecimalPlaces}
        placeholderTextColor="#a3a3a3"
        editable={editable}
        style={setRowInputStyle}
      />
      <Text style={[styles.unitSuffix, { color: suffixColor }]}>{suffix}</Text>
    </View>
  );
}

export function ExerciseDraftFieldsEditor({
  draft,
  disabled = false,
  activeScheme,
  borderColor,
  textColor,
  exerciseNameInputStyle,
  setRowInputStyle,
  lockedFieldStyle,
  onActivityTypeChange,
  onNameChange,
  onFieldChange,
  onDistanceUnitChange,
  onCardioObjectiveChange,
  onCardioDurationTrackingChange,
  onCardioDistanceTrackingChange,
  onDurationUnitChange,
  onPaceDurationUnitChange,
  onPaceDistanceUnitChange,
  onScoreUnitChange,
  onWeightUnitChange,
}: Props) {
  const suffixColor = activeScheme === 'dark' ? '#a3a3a3' : '#737373';
  const fieldStyle = lockedFieldStyle ? [setRowInputStyle, lockedFieldStyle] : setRowInputStyle;

  return (
    <>
      <ActivityTypePicker value={draft.activityType} onChange={onActivityTypeChange} disabled={disabled} />

      <TextInput
        value={draft.name}
        onChangeText={onNameChange}
        placeholder="Exercise name"
        placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
        editable={!disabled}
        style={[exerciseNameInputStyle, lockedFieldStyle]}
      />

      {draft.activityType === 'strength' ? (
        <View style={styles.strengthFieldsColumn}>
          <View style={styles.setRow}>
            <UnitField
              value={draft.sets}
              onChangeText={(value) => onFieldChange('sets', value)}
              placeholder="0"
              suffix="sets"
              maxDecimalPlaces={INTEGER_DECIMAL_PLACES}
              editable={!disabled}
              setRowInputStyle={fieldStyle}
              suffixColor={suffixColor}
            />
            <UnitField
              value={draft.reps}
              onChangeText={(value) => onFieldChange('reps', value)}
              placeholder="0"
              suffix="reps"
              maxDecimalPlaces={INTEGER_DECIMAL_PLACES}
              editable={!disabled}
              setRowInputStyle={fieldStyle}
              suffixColor={suffixColor}
            />
          </View>
          <View style={styles.strengthWeightWrap}>
            <NumericTextInput
              value={draft.weight}
              onChangeText={(value) => onFieldChange('weight', value)}
              placeholder="Weight"
              placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
              editable={!disabled}
              style={[fieldStyle, styles.strengthWeightInput]}
            />
            <WeightUnitPicker
              value={draft.weightUnit}
              onChange={onWeightUnitChange}
              disabled={disabled}
              borderColor={borderColor}
              textColor={textColor}
            />
          </View>
        </View>
      ) : null}

      {draft.activityType === 'cardio' ? (
        <CardioPlanEditor
          objective={draft.cardioObjective}
          durationTracking={draft.cardioDurationTracking}
          distanceTracking={draft.cardioDistanceTracking}
          duration={draft.duration}
          durationUnit={draft.durationUnit}
          distance={draft.distance}
          distanceUnit={draft.distanceUnit}
          paceDuration={draft.paceDuration}
          paceDurationUnit={draft.paceDurationUnit}
          paceDistance={draft.paceDistance}
          paceDistanceUnit={draft.paceDistanceUnit}
          disabled={disabled}
          activeScheme={activeScheme}
          borderColor={borderColor}
          textColor={textColor}
          setRowInputStyle={setRowInputStyle as object}
          lockedFieldStyle={lockedFieldStyle as object | undefined}
          onObjectiveChange={onCardioObjectiveChange}
          onDurationTrackingChange={onCardioDurationTrackingChange}
          onDistanceTrackingChange={onCardioDistanceTrackingChange}
          onDurationChange={(value) => onFieldChange('duration', value)}
          onDurationUnitChange={onDurationUnitChange}
          onDistanceChange={(value) => onFieldChange('distance', value)}
          onDistanceUnitChange={onDistanceUnitChange}
          onPaceDurationChange={(value) => onFieldChange('paceDuration', value)}
          onPaceDurationUnitChange={onPaceDurationUnitChange}
          onPaceDistanceChange={(value) => onFieldChange('paceDistance', value)}
          onPaceDistanceUnitChange={onPaceDistanceUnitChange}
        />
      ) : null}

      {draft.activityType === 'sport' ? (
        <View style={styles.cardioFieldsColumn}>
          <View style={styles.cardioDurationWrap}>
            <NumericTextInput
              value={draft.duration}
              onChangeText={(value) => onFieldChange('duration', value)}
              placeholder="Duration (Optional)"
              placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
              editable={!disabled}
              style={[fieldStyle, styles.cardioDurationInput]}
            />
            <DurationUnitPicker
              value={draft.durationUnit}
              onChange={onDurationUnitChange}
              units={SPORT_DURATION_UNITS}
              disabled={disabled}
              borderColor={borderColor}
              textColor={textColor}
            />
          </View>
          <View style={styles.sportScoreRow}>
            <NumericTextInput
              value={draft.score}
              onChangeText={(value) => onFieldChange('score', value)}
              placeholder="Score (Optional)"
              placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
              editable={!disabled}
              style={[fieldStyle, styles.sportScoreInput]}
            />
            <ScoreUnitPicker
              value={draft.scoreUnit}
              onChange={onScoreUnitChange}
              disabled={disabled}
              borderColor={borderColor}
              textColor={textColor}
            />
          </View>
        </View>
      ) : null}

      {draft.activityType === 'stretch' ? (
        <View style={styles.stretchRow}>
          <UnitField
            value={draft.sets}
            onChangeText={(value) => onFieldChange('sets', value)}
            placeholder="0"
            suffix="sets"
            maxDecimalPlaces={INTEGER_DECIMAL_PLACES}
            editable={!disabled}
            setRowInputStyle={fieldStyle}
            suffixColor={suffixColor}
            wrapStyle={styles.stretchSetsWrap}
          />
          <View style={styles.stretchDurationWrap}>
            <NumericTextInput
              value={draft.duration}
              onChangeText={(value) => onFieldChange('duration', value)}
              placeholder="Duration"
              placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
              editable={!disabled}
              style={[fieldStyle, styles.stretchDurationInput]}
            />
            <DurationUnitPicker
              value={draft.durationUnit}
              onChange={onDurationUnitChange}
              units={STRETCH_DURATION_UNITS}
              disabled={disabled}
              borderColor={borderColor}
              textColor={textColor}
            />
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  stretchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  stretchSetsWrap: {
    flexGrow: 0,
    flexShrink: 0,
    width: 108,
    minWidth: 108,
    maxWidth: 108,
  },
  stretchDurationWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stretchDurationInput: {
    flex: 1,
    minWidth: 0,
  },
  strengthFieldsColumn: {
    gap: 8,
    alignSelf: 'stretch',
  },
  strengthWeightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  strengthWeightInput: {
    flex: 1,
    minWidth: 0,
  },
  cardioFieldsColumn: {
    gap: 8,
    alignSelf: 'stretch',
  },
  cardioDurationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  cardioDurationInput: {
    flex: 1,
    minWidth: 0,
  },
  sportScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  sportScoreInput: {
    flex: 1,
    minWidth: 0,
  },
  unitInputWrap: {
    flexGrow: 1,
    minWidth: 80,
    position: 'relative',
  },
  unitSuffix: {
    position: 'absolute',
    right: 12,
    top: 10,
    fontSize: 16,
    fontWeight: '600',
  },
});
