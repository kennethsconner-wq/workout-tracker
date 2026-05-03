import Ionicons from '@expo/vector-icons/Ionicons';

import { type WorkoutIconId, workoutIoniconName } from '@/lib/workoutIcons';

type Props = {
  iconId: WorkoutIconId;
  size: number;
  color: string;
};

export function WorkoutIconGlyph({ iconId, size, color }: Props) {
  return <Ionicons name={workoutIoniconName(iconId)} size={size} color={color} />;
}
