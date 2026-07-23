import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SegmentedControl, SurfaceCard } from "../../../design-system/components";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { useLanguage } from "../../../i18n/languageContext";
import { styles } from "./DiaryCalendar.styles";

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
  const { language } = useLanguage();
  const locale = language === "ko" ? "ko-KR" : "en-AU";
  const selectedDate = parseDateKey(selectedDateKey);
  const weeks = createMonthWeeks(selectedDate);
  const [expanded, setExpanded] = useState(false);
  const selectedDateLabel = formatSelectedDate(selectedDate, locale);

  return (
    <SurfaceCard>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t("ko", "diary.selectedDateLabel")}: ${selectedDateLabel}. ${t("ko", expanded ? "diary.calendar.close" : "diary.calendar.open")}`}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        style={({ pressed }) => [styles.selectedDateButton, pressed && styles.selectedDateButtonPressed]}
        onPress={() => setExpanded((current) => !current)}
      >
        <View style={styles.selectedDateBody}>
          <AppIcon name="calendar" size={iconSize.md} color={colors.orangeDeep} />
          <Text style={styles.selectedDateText}>{selectedDateLabel}</Text>
        </View>
        <View style={[styles.chevron, expanded && styles.chevronExpanded]}>
          <AppIcon name="chevronDown" size={iconSize.sm} color={colors.textMuted} />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.calendarBody}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ko", "diary.prevMonth")}
              style={styles.monthButton}
              onPress={() => onSelectDate(monthOffsetKey(selectedDate, -1))}
            >
              <Text style={styles.monthButtonText}>{t("ko", "diary.prevMonth")}</Text>
            </Pressable>
            <Text style={styles.monthTitle} accessibilityRole="header">{formatMonth(selectedDate, locale)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ko", "diary.nextMonth")}
              style={styles.monthButton}
              onPress={() => onSelectDate(monthOffsetKey(selectedDate, 1))}
            >
              <Text style={styles.monthButtonText}>{t("ko", "diary.nextMonth")}</Text>
            </Pressable>
          </View>

          <View style={styles.weekHeader}>
            {weekdayLabels(locale).map((label) => (
              <Text key={label} style={styles.weekLabel}>{label}</Text>
            ))}
          </View>
          <View style={styles.grid}>
            {weeks.map((week) => (
              <View key={week.map((day) => day.dateKey).join("-")} style={styles.weekRow}>
                {week.map((day) => {
                  const selected = day.dateKey === selectedDateKey;
                  return (
                    <Pressable
                      key={day.dateKey}
                      accessibilityRole="button"
                      accessibilityLabel={formatDayA11yLabel(day.dateKey, locale)}
                      accessibilityState={{ selected }}
                      style={[styles.day, selected && styles.daySelected, day.isToday && styles.dayToday]}
                      onPress={() => {
                        onSelectDate(day.dateKey);
                        setExpanded(false);
                      }}
                    >
                      <Text style={[styles.dayText, !day.inMonth && styles.dayMuted, selected && styles.dayTextSelected]}>{day.dayLabel}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      ) : null}

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

function formatMonth(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(date);
}

export function formatSelectedDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", weekday: "short" }).format(date);
}

function formatDayA11yLabel(dateKey: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", weekday: "long" }).format(parseDateKey(dateKey));
}

function weekdayLabels(locale: string) {
  return Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2026, 0, 5 + index)));
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
