import { Ionicons } from '@expo/vector-icons';

import { Pressable, StyleSheet, View as RNView, type StyleProp, type TextStyle } from 'react-native';



import { CardioDistanceUnitPicker } from '@/components/CardioDistanceUnitPicker';

import { DurationUnitPicker } from '@/components/DurationUnitPicker';

import { NumericTextInput } from '@/components/NumericTextInput';

import { Text, View } from '@/components/Themed';

import Colors from '@/constants/Colors';

import type { CardioDistanceUnit } from '@/lib/cardioDistanceUnits';

import {

  CARDIO_DISTANCE_TRACKING_LABELS,

  CARDIO_DISTANCE_TRACKING_OPTIONS,

  CARDIO_DURATION_TRACKING_LABELS,

  CARDIO_DURATION_TRACKING_OPTIONS,

  CARDIO_OBJECTIVE_LABELS,

  CARDIO_OBJECTIVES,

  type CardioDistanceTracking,

  type CardioDurationTracking,

  type CardioObjective,

} from '@/lib/cardioPlan';

import { CARDIO_DURATION_UNITS, type DurationUnit } from '@/lib/durationUnits';



type Props = {

  objective: CardioObjective;

  durationTracking: CardioDurationTracking;

  distanceTracking: CardioDistanceTracking;

  duration: string;

  durationUnit: DurationUnit;

  distance: string;

  distanceUnit: CardioDistanceUnit;

  paceDuration: string;

  paceDurationUnit: DurationUnit;

  paceDistance: string;

  paceDistanceUnit: CardioDistanceUnit;

  disabled?: boolean;

  activeScheme: 'light' | 'dark';

  borderColor: string;

  textColor: string;

  setRowInputStyle: object;

  lockedFieldStyle?: object;

  onObjectiveChange: (objective: CardioObjective) => void;

  onDurationTrackingChange: (tracking: CardioDurationTracking) => void;

  onDistanceTrackingChange: (tracking: CardioDistanceTracking) => void;

  onDurationChange: (value: string) => void;

  onDurationUnitChange: (unit: DurationUnit) => void;

  onDistanceChange: (value: string) => void;

  onDistanceUnitChange: (unit: CardioDistanceUnit) => void;

  onPaceDurationChange: (value: string) => void;

  onPaceDurationUnitChange: (unit: DurationUnit) => void;

  onPaceDistanceChange: (value: string) => void;

  onPaceDistanceUnitChange: (unit: CardioDistanceUnit) => void;

};



function RadioGroup<T extends string>({

  label,

  options,

  labels,

  value,

  onChange,

  disabled,

  textColor,

  borderColor,

  tint,

}: {

  label: string;

  options: readonly T[];

  labels: Record<T, string>;

  value: T;

  onChange: (next: T) => void;

  disabled?: boolean;

  textColor: string;

  borderColor: string;

  tint: string;

}) {

  return (

    <View style={styles.radioSection} lightColor="transparent" darkColor="transparent">

      <Text style={[styles.sectionLabel, { color: textColor }]}>{label}</Text>

      {options.map((option) => {

        const selected = option === value;

        return (

          <Pressable

            key={option}

            accessibilityRole="radio"

            accessibilityState={{ selected, disabled }}

            accessibilityLabel={labels[option]}

            disabled={disabled}

            onPress={() => onChange(option)}

            style={({ pressed }) => [

              styles.radioRow,

              { borderColor },

              selected && { borderColor: tint, backgroundColor: `${tint}18` },

              pressed && !disabled && styles.radioRowPressed,

              disabled && styles.radioRowDisabled,

            ]}>

            <Ionicons

              name={selected ? 'radio-button-on' : 'radio-button-off'}

              size={22}

              color={selected ? tint : textColor}

            />

            <Text style={[styles.radioLabel, { color: textColor }]}>{labels[option]}</Text>

          </Pressable>

        );

      })}

    </View>

  );

}



function PaceRow({

  paceDuration,

  paceDurationUnit,

  paceDistance,

  paceDistanceUnit,

  disabled,

  placeholderColor,

  inputStyle,

  textColor,

  borderColor,

  onPaceDurationChange,

  onPaceDurationUnitChange,

  onPaceDistanceChange,

  onPaceDistanceUnitChange,

}: {

  paceDuration: string;

  paceDurationUnit: DurationUnit;

  paceDistance: string;

  paceDistanceUnit: CardioDistanceUnit;

  disabled?: boolean;

  placeholderColor: string;

  inputStyle: StyleProp<TextStyle>;

  textColor: string;

  borderColor: string;

  onPaceDurationChange: (value: string) => void;

  onPaceDurationUnitChange: (unit: DurationUnit) => void;

  onPaceDistanceChange: (value: string) => void;

  onPaceDistanceUnitChange: (unit: CardioDistanceUnit) => void;

}) {

  return (

    <View style={styles.metricRow} lightColor="transparent" darkColor="transparent">

      <Text style={[styles.fieldLabel, { color: textColor }]}>Pace</Text>

      <RNView style={styles.metricInputs}>

        <NumericTextInput

          value={paceDuration}

          onChangeText={onPaceDurationChange}

          placeholder="Duration"

          placeholderTextColor={placeholderColor}

          editable={!disabled}

          style={inputStyle}

        />

        <DurationUnitPicker

          value={paceDurationUnit}

          onChange={onPaceDurationUnitChange}

          units={CARDIO_DURATION_UNITS}

          disabled={disabled}

          borderColor={borderColor}

          textColor={textColor}

        />

        <Text style={[styles.pacePerText, { color: textColor }]}>per</Text>

        <NumericTextInput

          value={paceDistance}

          onChangeText={onPaceDistanceChange}

          placeholder="Distance"

          placeholderTextColor={placeholderColor}

          editable={!disabled}

          style={inputStyle}

        />

        <CardioDistanceUnitPicker

          value={paceDistanceUnit}

          onChange={onPaceDistanceUnitChange}

          disabled={disabled}

          borderColor={borderColor}

          textColor={textColor}

        />

      </RNView>

    </View>

  );

}



export function CardioPlanEditor({

  objective,

  durationTracking,

  distanceTracking,

  duration,

  durationUnit,

  distance,

  distanceUnit,

  paceDuration,

  paceDurationUnit,

  paceDistance,

  paceDistanceUnit,

  disabled = false,

  activeScheme,

  borderColor,

  textColor,

  setRowInputStyle,

  lockedFieldStyle,

  onObjectiveChange,

  onDurationTrackingChange,

  onDistanceTrackingChange,

  onDurationChange,

  onDurationUnitChange,

  onDistanceChange,

  onDistanceUnitChange,

  onPaceDurationChange,

  onPaceDurationUnitChange,

  onPaceDistanceChange,

  onPaceDistanceUnitChange,

}: Props) {

  const tint = Colors[activeScheme].tint;

  const placeholderColor = activeScheme === 'dark' ? '#737373' : '#a3a3a3';

  const inputBackground = activeScheme === 'dark' ? '#171717' : '#fafafa';

  const inputStyle = [

    setRowInputStyle,

    lockedFieldStyle,

    styles.valueInput,

    { color: textColor, borderColor, backgroundColor: inputBackground },

  ];



  const showDurationTotal = objective === 'distance' && durationTracking === 'total';

  const showPace =

    (objective === 'distance' && durationTracking === 'per_distance_unit') ||

    (objective === 'duration' && distanceTracking === 'per_duration_unit');

  const showDistanceTotal = objective === 'duration' && distanceTracking === 'total';



  return (

    <View style={styles.root} lightColor="transparent" darkColor="transparent">

      <RadioGroup

        label="Objective"

        options={CARDIO_OBJECTIVES}

        labels={CARDIO_OBJECTIVE_LABELS}

        value={objective}

        onChange={onObjectiveChange}

        disabled={disabled}

        textColor={textColor}

        borderColor={borderColor}

        tint={tint}

      />



      {objective === 'distance' ? (

        <>

          <View style={styles.metricRow} lightColor="transparent" darkColor="transparent">

            <Text style={[styles.fieldLabel, { color: textColor }]}>Distance</Text>

            <RNView style={styles.metricInputs}>

              <NumericTextInput

                value={distance}

                onChangeText={onDistanceChange}

                placeholder="Distance"

                placeholderTextColor={placeholderColor}

                editable={!disabled}

                style={inputStyle}

              />

              <CardioDistanceUnitPicker

                value={distanceUnit}

                onChange={onDistanceUnitChange}

                disabled={disabled}

                borderColor={borderColor}

                textColor={textColor}

              />

            </RNView>

          </View>



          <RadioGroup

            label="Duration tracking"

            options={CARDIO_DURATION_TRACKING_OPTIONS}

            labels={CARDIO_DURATION_TRACKING_LABELS}

            value={durationTracking}

            onChange={onDurationTrackingChange}

            disabled={disabled}

            textColor={textColor}

            borderColor={borderColor}

            tint={tint}

          />



          {showDurationTotal ? (

            <View style={styles.metricRow} lightColor="transparent" darkColor="transparent">

              <Text style={[styles.fieldLabel, { color: textColor }]}>Duration</Text>

              <RNView style={styles.metricInputs}>

                <NumericTextInput

                  value={duration}

                  onChangeText={onDurationChange}

                  placeholder="Duration"

                  placeholderTextColor={placeholderColor}

                  editable={!disabled}

                  style={inputStyle}

                />

                <DurationUnitPicker

                  value={durationUnit}

                  onChange={onDurationUnitChange}

                  units={CARDIO_DURATION_UNITS}

                  disabled={disabled}

                  borderColor={borderColor}

                  textColor={textColor}

                />

              </RNView>

            </View>

          ) : null}



          {showPace ? (

            <PaceRow

              paceDuration={paceDuration}

              paceDurationUnit={paceDurationUnit}

              paceDistance={paceDistance}

              paceDistanceUnit={paceDistanceUnit}

              disabled={disabled}

              placeholderColor={placeholderColor}

              inputStyle={inputStyle}

              textColor={textColor}

              borderColor={borderColor}

              onPaceDurationChange={onPaceDurationChange}

              onPaceDurationUnitChange={onPaceDurationUnitChange}

              onPaceDistanceChange={onPaceDistanceChange}

              onPaceDistanceUnitChange={onPaceDistanceUnitChange}

            />

          ) : null}

        </>

      ) : (

        <>

          <View style={styles.metricRow} lightColor="transparent" darkColor="transparent">

            <Text style={[styles.fieldLabel, { color: textColor }]}>Duration</Text>

            <RNView style={styles.metricInputs}>

              <NumericTextInput

                value={duration}

                onChangeText={onDurationChange}

                placeholder="Duration"

                placeholderTextColor={placeholderColor}

                editable={!disabled}

                style={inputStyle}

              />

              <DurationUnitPicker

                value={durationUnit}

                onChange={onDurationUnitChange}

                units={CARDIO_DURATION_UNITS}

                disabled={disabled}

                borderColor={borderColor}

                textColor={textColor}

              />

            </RNView>

          </View>



          <RadioGroup

            label="Distance tracking"

            options={CARDIO_DISTANCE_TRACKING_OPTIONS}

            labels={CARDIO_DISTANCE_TRACKING_LABELS}

            value={distanceTracking}

            onChange={onDistanceTrackingChange}

            disabled={disabled}

            textColor={textColor}

            borderColor={borderColor}

            tint={tint}

          />



          {showDistanceTotal ? (

            <View style={styles.metricRow} lightColor="transparent" darkColor="transparent">

              <Text style={[styles.fieldLabel, { color: textColor }]}>Distance</Text>

              <RNView style={styles.metricInputs}>

                <NumericTextInput

                  value={distance}

                  onChangeText={onDistanceChange}

                  placeholder="Distance"

                  placeholderTextColor={placeholderColor}

                  editable={!disabled}

                  style={inputStyle}

                />

                <CardioDistanceUnitPicker

                  value={distanceUnit}

                  onChange={onDistanceUnitChange}

                  disabled={disabled}

                  borderColor={borderColor}

                  textColor={textColor}

                />

              </RNView>

            </View>

          ) : null}



          {showPace ? (

            <PaceRow

              paceDuration={paceDuration}

              paceDurationUnit={paceDurationUnit}

              paceDistance={paceDistance}

              paceDistanceUnit={paceDistanceUnit}

              disabled={disabled}

              placeholderColor={placeholderColor}

              inputStyle={inputStyle}

              textColor={textColor}

              borderColor={borderColor}

              onPaceDurationChange={onPaceDurationChange}

              onPaceDurationUnitChange={onPaceDurationUnitChange}

              onPaceDistanceChange={onPaceDistanceChange}

              onPaceDistanceUnitChange={onPaceDistanceUnitChange}

            />

          ) : null}

        </>

      )}

    </View>

  );

}



const styles = StyleSheet.create({

  root: {

    gap: 14,

    marginTop: 4,

  },

  radioSection: {

    gap: 8,

  },

  sectionLabel: {

    fontSize: 14,

    fontWeight: '700',

  },

  radioRow: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: 10,

    borderWidth: 1,

    borderRadius: 10,

    paddingHorizontal: 12,

    paddingVertical: 10,

  },

  radioRowPressed: {

    opacity: 0.75,

  },

  radioRowDisabled: {

    opacity: 0.62,

  },

  radioLabel: {

    flex: 1,

    fontSize: 14,

    fontWeight: '500',

  },

  metricRow: {

    gap: 8,

  },

  fieldLabel: {

    fontSize: 14,

    fontWeight: '600',

  },

  metricInputs: {

    flexDirection: 'row',

    flexWrap: 'wrap',

    alignItems: 'center',

    gap: 8,

  },

  valueInput: {

    minWidth: 72,

    flexGrow: 1,

    flexShrink: 1,

  },

  pacePerText: {

    fontSize: 14,

    fontWeight: '600',

  },

});


