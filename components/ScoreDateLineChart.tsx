import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';

export type ScoreDatePoint = {
  score: number;
  dateMs: number;
};

export type ScoreDateLineSeries = {
  id: string;
  label: string;
  color: string;
  points: ScoreDatePoint[];
};

type ScoreDateLineChartProps = {
  width: number;
  height?: number;
  lines: ScoreDateLineSeries[];
  axisColor: string;
  labelColor: string;
};

const DEFAULT_HEIGHT = 280;
const PAD_L = 56;
const PAD_R = 14;
const PAD_T = 22;
const PAD_B = 44;
const STROKE = 2;
const DOT = 8;

type DateScoreBounds = {
  minDate: number;
  maxDate: number;
  minScore: number;
  maxScore: number;
};

function padRange(min: number, max: number, ratio = 0.06): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [0, 1];
  }
  if (min === max) {
    const delta = Math.abs(min) < 1e-12 ? 1 : Math.abs(min) * ratio;
    return [min - delta, max + delta];
  }
  const span = max - min;
  return [min - span * ratio, max + span * ratio];
}

function formatScoreTick(v: number): string {
  if (!Number.isFinite(v)) {
    return '';
  }
  if (Math.abs(v) >= 1000) {
    return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return v.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

function formatDateTick(ms: number): string {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) {
    return '';
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function LineSegment({
  x1,
  y1,
  x2,
  y2,
  color,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 0.5) {
    return null;
  }
  const angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.lineSeg,
        {
          left: x1,
          top: y1 - STROKE / 2,
          width: len,
          height: STROKE,
          backgroundColor: color,
          transform: [{ rotate: `${angleDeg}deg` }],
          transformOrigin: '0% 50%',
        },
      ]}
    />
  );
}

/**
 * X axis = Date (older left, newer right), Y axis = Score (lower bottom, higher top).
 * Points are connected in chronological order within each series.
 */
export function ScoreDateLineChart({
  width,
  height = DEFAULT_HEIGHT,
  lines,
  axisColor,
  labelColor,
}: ScoreDateLineChartProps) {
  const innerW = Math.max(1, width - PAD_L - PAD_R);
  const innerH = Math.max(1, height - PAD_T - PAD_B);

  const { bounds, sortedLines, hasAnyPoint } = useMemo(() => {
    const allPoints = lines.flatMap((l) => l.points);
    if (allPoints.length === 0) {
      const empty: DateScoreBounds = { minDate: 0, maxDate: 1, minScore: 0, maxScore: 1 };
      return {
        bounds: empty,
        sortedLines: lines.map((l) => ({
          ...l,
          points: [...l.points].sort((a, b) => a.dateMs - b.dateMs),
        })),
        hasAnyPoint: false,
      };
    }
    let minDate = Infinity;
    let maxDate = -Infinity;
    let minScore = Infinity;
    let maxScore = -Infinity;
    for (const p of allPoints) {
      minDate = Math.min(minDate, p.dateMs);
      maxDate = Math.max(maxDate, p.dateMs);
      minScore = Math.min(minScore, p.score);
      maxScore = Math.max(maxScore, p.score);
    }
    const [d0, d1] = padRange(minDate, maxDate);
    const [s0, s1] = padRange(minScore, maxScore);
    return {
      bounds: { minDate: d0, maxDate: d1, minScore: s0, maxScore: s1 },
      sortedLines: lines.map((l) => ({
        ...l,
        points: [...l.points].sort((a, b) => a.dateMs - b.dateMs),
      })),
      hasAnyPoint: true,
    };
  }, [lines]);

  const scaleX = (dateMs: number) => {
    const { minDate, maxDate } = bounds;
    if (maxDate === minDate) {
      return PAD_L + innerW / 2;
    }
    return PAD_L + ((dateMs - minDate) / (maxDate - minDate)) * innerW;
  };

  /** Lower scores toward bottom of plot, higher toward top. */
  const scaleY = (score: number) => {
    const { minScore, maxScore } = bounds;
    if (maxScore === minScore) {
      return PAD_T + innerH / 2;
    }
    return PAD_T + innerH - ((score - minScore) / (maxScore - minScore)) * innerH;
  };

  const axisX0 = PAD_L;
  const axisX1 = PAD_L + innerW;
  const axisY0 = PAD_T;
  const axisY1 = PAD_T + innerH;
  const scoreLabelCy = PAD_T + innerH / 2;

  if (!hasAnyPoint) {
    return (
      <View style={[styles.emptyChart, { width, minHeight: height * 0.35 }]}>
        <Text style={styles.emptyChartText}>
          Log this exercise on more days to plot scores. Each point uses the same actual score as Exercise Execution
          Score.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { width }]} accessibilityLabel="Date versus score chart">
      <View style={[styles.chartArea, { width, height }]}>
        <View style={[styles.axisH, { left: axisX0, top: axisY1, width: innerW, backgroundColor: axisColor }]} />
        <View style={[styles.axisV, { left: axisX0, top: axisY0, height: innerH, backgroundColor: axisColor }]} />

        {sortedLines.map((series) => {
          if (series.points.length === 0) {
            return null;
          }
          const segs: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
          for (let i = 0; i < series.points.length - 1; i++) {
            const a = series.points[i];
            const b = series.points[i + 1];
            segs.push({
              x1: scaleX(a.dateMs),
              y1: scaleY(a.score),
              x2: scaleX(b.dateMs),
              y2: scaleY(b.score),
              key: `${series.id}-seg-${i}`,
            });
          }
          return (
            <View key={series.id} style={StyleSheet.absoluteFill} pointerEvents="none">
              {segs.map((s) => (
                <LineSegment key={s.key} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} color={series.color} />
              ))}
              {series.points.map((p) => (
                <View
                  key={`${series.id}-${p.dateMs}-${p.score}`}
                  style={[
                    styles.dot,
                    {
                      left: scaleX(p.dateMs) - DOT / 2,
                      top: scaleY(p.score) - DOT / 2,
                      backgroundColor: series.color,
                      borderColor: axisColor,
                    },
                  ]}
                />
              ))}
            </View>
          );
        })}

        <View
          style={[
            styles.rotatedAxisLabelWrap,
            { top: scoreLabelCy - 40, left: 0, width: PAD_L - 4, height: 80 },
          ]}
          pointerEvents="none">
          <Text style={[styles.axisTitle, { color: labelColor }]}>Score</Text>
        </View>

        <Text
          style={[styles.axisTitle, styles.bottomAxisTitle, { color: labelColor, top: height - 18, left: 0, width }]}
          pointerEvents="none">
          Date
        </Text>

        <Text style={[styles.tick, { color: labelColor, top: height - 32, left: axisX0 }]} pointerEvents="none">
          {formatDateTick(bounds.minDate)}
        </Text>
        <Text
          style={[styles.tick, styles.tickRight, { color: labelColor, top: height - 32, right: PAD_R }]}
          pointerEvents="none">
          {formatDateTick(bounds.maxDate)}
        </Text>

        <Text style={[styles.tick, { color: labelColor, top: axisY1 - 16, left: axisX0 + 2 }]} pointerEvents="none">
          {formatScoreTick(bounds.minScore)}
        </Text>
        <Text style={[styles.tick, { color: labelColor, top: axisY0, left: axisX0 + 2 }]} pointerEvents="none">
          {formatScoreTick(bounds.maxScore)}
        </Text>
      </View>

      {lines.length > 1 ? (
        <View style={styles.legend}>
          {lines.map((series) => (
            <View key={series.id} style={styles.legendRow}>
              <View style={[styles.legendSwatch, { backgroundColor: series.color }]} />
              <Text style={[styles.legendLabel, { color: labelColor }]}>{series.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
  },
  chartArea: {
    position: 'relative',
    overflow: 'hidden',
  },
  axisH: {
    position: 'absolute',
    height: 1,
  },
  axisV: {
    position: 'absolute',
    width: 1,
  },
  rotatedAxisLabelWrap: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-90deg' }],
  },
  axisTitle: {
    position: 'absolute',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomAxisTitle: {
    textAlign: 'center',
  },
  tick: {
    position: 'absolute',
    fontSize: 10,
  },
  tickRight: {
    textAlign: 'right',
    width: 72,
  },
  lineSeg: {
    position: 'absolute',
    borderRadius: 1,
  },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 1,
  },
  emptyChart: {
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  emptyChartText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.75,
    lineHeight: 20,
  },
  legend: {
    marginTop: 8,
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 13,
  },
});
