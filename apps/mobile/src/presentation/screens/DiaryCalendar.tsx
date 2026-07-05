import { Pressable, StyleSheet, Text, View } from "react-native";
import { SegmentedControl, SurfaceCard } from "../../design-system/components";
import { colors, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";

export type DiaryFilter = "day" | "week";

type CalendarDay = {
  dateKey: string;
  dayLabel: string;
  inMonth: boolean;
  isToday: boolean;
};

export function DiaryCalendar({
  selectedDateKey,
  filter,
  onSelectDate,
  onFilterChange,
}: {
  selectedDateKey: string;
  filter: DiaryFilter;
  onSelectDate: (dateKey: string) => void;
  onFilterChange: (filter: DiaryFilter) => void;
}) {
  const selectedDate = parseDateKey(selectedDateKey);
  const weeks = createMonthWeeks(selectedDate);

  return (
    <SurfaceCard>
      <View style={styles.header}>
        <Pressable style={styles.monthButton} onPress={() => onSelectDate(monthOffsetKey(selectedDate, -1))}>
          <Text style={styles.monthButtonText}>{t("ko", "diary.prevMonth")}</Text>
        </Pressable>
        <Text style={styles.monthTitle}>{formatMonth(selectedDate)}</Text>
        <Pressable style={styles.monthButton} onPress={() => onSelectDate(monthOffsetKey(selectedDate, 1))}>
          <Text style={styles.monthButtonText}>{t("ko", "diary.nextMonth")}</Text>
        </Pressable>
      </View>

      <View style={styles.weekHeader}>
        {["월", "화", "수", "목", "금", "토", "일"].map((label) => (
          <Text key={label} style={styles.weekLabel}>{label}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {weeks.map((week) => (
          <View key={week.map((day) => day.dateKey).join("-")} style={styles.weekRow}>
            {week.map((day) => {
              const selected = day.dateKey === selectedDateKey;
              return (
                <Pressable key={day.dateKey} style={[styles.day, selected && styles.daySelected, day.isToday && styles.dayToday]} onPress={() => onSelectDate(day.dateKey)}>
                  <Text style={[styles.dayText, !day.inMonth && styles.dayMuted, selected && styles.dayTextSelected]}>{day.dayLabel}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <SegmentedControl
        value={filter}
        onChange={onFilterChange}
        items={[
          { label: t("ko", "diary.filter.day"), value: "day" },
          { label: t("ko", "diary.filter.week"), value: "week" },
        ]}
      />
    </SurfaceCard>
  );
}

export function createMonthWeeks(date: Date): CalendarDay[][] {
  const days = createMonthDays(date);
  return Array.from({ length: 6 }, (_, index) => days.slice(index * 7, index * 7 + 7));
}

function createMonthDays(date: Date): CalendarDay[] {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - offset);
  const todayKey = toDateKey(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const dateKey = toDateKey(current);
    return {
      dateKey,
      dayLabel: String(current.getDate()),
      inMonth: current.getMonth() === date.getMonth(),
      isToday: dateKey === todayKey,
    };
  });
}

function monthOffsetKey(date: Date, offset: number) {
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + offset, 1));
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(date);
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  monthTitle: {
    ...type.sectionTitle,
  },
  monthButton: {
    minHeight: 34,
    minWidth: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  monthButtonText: {
    ...type.caption,
    color: colors.orangeDeep,
    fontWeight: "600",
  },
  weekHeader: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  weekLabel: {
    ...type.tiny,
    flex: 1,
    textAlign: "center",
  },
  grid: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  weekRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  day: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: colors.mint,
  },
  daySelected: {
    backgroundColor: colors.orange,
  },
  dayText: {
    ...type.caption,
    color: colors.text,
    fontWeight: "600",
  },
  dayMuted: {
    color: colors.textSoft,
  },
  dayTextSelected: {
    color: colors.white,
  },
});
