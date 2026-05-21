import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";
import { trackEvent } from "../utils/analytics";

type BookingSheetProps = {
  visible: boolean;
  shopId?: string | null;
  shopName?: string | null;
  shopCity?: string | null;
  styleId?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
};

const OPEN_HOUR = 10;
const CLOSE_HOUR = 22;
const MIN_ADVANCE_HOURS = 1;
const SERVICE_DURATION_HOURS = 1;
const DATE_OPTION_DAYS = 21;
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const hourSlots = Array.from({ length: CLOSE_HOUR - SERVICE_DURATION_HOURS - OPEN_HOUR + 1 }, (_, index) => OPEN_HOUR + index);

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatAppointmentTime(date: Date, hour: number) {
  return `${formatDateKey(date)} ${String(hour).padStart(2, "0")}:00`;
}

function formatMonthTitle(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function formatDateLabel(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatWeekLabel(date: Date) {
  return `周${WEEKDAYS[date.getDay()]}`;
}

function defaultSelection() {
  const now = new Date();
  const earliest = new Date(now.getTime() + MIN_ADVANCE_HOURS * 60 * 60 * 1000);
  const earliestHour = earliest.getMinutes() > 0 || earliest.getSeconds() > 0 || earliest.getMilliseconds() > 0 ? earliest.getHours() + 1 : earliest.getHours();
  const latestStartHour = CLOSE_HOUR - SERVICE_DURATION_HOURS;
  const hasTodaySlot = startOfDay(earliest).getTime() === startOfDay(now).getTime() && earliestHour <= latestStartHour;
  const date = hasTodaySlot ? startOfDay(now) : addDays(startOfDay(now), 1);
  const hour = hasTodaySlot ? Math.max(earliestHour, OPEN_HOUR) : OPEN_HOUR;
  return { date, hour };
}

function earliestSelectableDate() {
  return defaultSelection().date;
}

function isHourDisabled(date: Date | null, hour: number) {
  if (!date) return false;
  const now = new Date();
  const earliest = new Date(now.getTime() + MIN_ADVANCE_HOURS * 60 * 60 * 1000);
  const slot = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0, 0);
  return slot < earliest || hour + SERVICE_DURATION_HOURS > CLOSE_HOUR;
}

export function BookingSheet({ visible, shopId, shopName, shopCity, styleId, onClose, onSuccess }: BookingSheetProps) {
  const colors = useThemeColors();
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [contactPhone, setContactPhone] = useState("");
  const [note, setNote] = useState("");
  const appointmentTime = selectedDate && selectedHour != null ? formatAppointmentTime(selectedDate, selectedHour) : "";
  const today = startOfDay(new Date());
  const minSelectableDate = earliestSelectableDate();

  useEffect(() => {
    if (!visible) return;
    void trackEvent("booking_start_clicked", {
      styleId: styleId ?? null,
      shopId: shopId ?? null,
      source: "booking_sheet",
      screen: "booking",
    });
    const selection = defaultSelection();
    setSelectedDate((value) => value || selection.date);
    setSelectedHour((value) => value ?? selection.hour);
    setContactPhone((value) => value || currentUser?.phone || "");
  }, [currentUser?.phone, shopId, styleId, visible]);

  const mutation = useMutation({
    mutationFn: () =>
      api.createBooking({
        shop_id: shopId ?? "",
        style_id: styleId ?? null,
        appointment_time: appointmentTime.trim(),
        contact_phone: contactPhone.trim(),
        note: note.trim() || null,
      }),
    onSuccess: () => {
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["merchant-bookings"] });
      onSuccess?.();
      onClose();
    },
  });

  const canSubmit = Boolean(shopId && appointmentTime && contactPhone.trim() && !mutation.isPending);
  const dateOptions = useMemo(
    () => Array.from({ length: DATE_OPTION_DAYS }, (_, index) => addDays(minSelectableDate, index)),
    [minSelectableDate.getTime()],
  );
  const selectedDateKey = selectedDate ? formatDateKey(selectedDate) : "";
  const visibleHourSlots = selectedDate ? hourSlots.filter((hour) => !isHourDisabled(selectedDate, hour)) : [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: colors.text }]}>预约门店</Text>
              <Text style={[styles.meta, { color: colors.subtext }]}>
                {shopName || "美甲门店"} · {shopCity || "同城"}
              </Text>
            </View>
            <Pressable style={[styles.closeButton, { backgroundColor: colors.input }]} onPress={onClose}>
              <Text style={[styles.closeText, { color: colors.text }]}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>选择日期</Text>
                <Text style={[styles.sectionMeta, { color: colors.subtext }]}>
                  {selectedDate ? formatMonthTitle(selectedDate) : "请选择日期"}
                </Text>
              </View>
              <Text style={[styles.sectionMeta, { color: colors.subtext }]}>提前1小时预约 · 服务约1小时</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
              {dateOptions.map((date) => {
                const dateKey = formatDateKey(date);
                const selected = selectedDateKey === dateKey;
                return (
                  <Pressable
                    key={dateKey}
                    style={[
                      styles.dateChip,
                      { backgroundColor: selected ? colors.accent : colors.input, borderColor: selected ? colors.accent : colors.border },
                    ]}
                    onPress={() => {
                      setSelectedDate(date);
                      if (selectedHour != null && isHourDisabled(date, selectedHour)) {
                        const nextHour = hourSlots.find((hour) => !isHourDisabled(date, hour));
                        setSelectedHour(nextHour ?? null);
                      }
                    }}
                  >
                    <Text style={[styles.dateWeekText, { color: selected ? "#fff" : colors.subtext }]}>{formatWeekLabel(date)}</Text>
                    <Text style={[styles.dateDayText, { color: selected ? "#fff" : colors.text }]}>{formatDateLabel(date)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>选择时间</Text>
              <Text style={[styles.sectionMeta, { color: colors.subtext }]}>每小时仅开放 1 个名额</Text>
            </View>
            <View style={styles.slotGrid}>
              {visibleHourSlots.map((hour) => {
                const selected = selectedHour === hour;
                return (
                  <Pressable
                    key={hour}
                    style={[
                      styles.slotButton,
                      { backgroundColor: selected ? colors.accent : colors.input, borderColor: selected ? colors.accent : colors.border },
                    ]}
                    onPress={() => setSelectedHour(hour)}
                  >
                    <Text style={[styles.slotText, { color: selected ? "#fff" : colors.text }]}>
                      {String(hour).padStart(2, "0")}:00
                    </Text>
                  </Pressable>
                );
              })}
              {visibleHourSlots.length === 0 ? (
                <Text style={[styles.noSlotsText, { color: colors.subtext }]}>当天已无可预约时段，请选择其他日期</Text>
              ) : null}
            </View>

            <TextInput
              value={contactPhone}
              onChangeText={setContactPhone}
              placeholder="联系电话"
              keyboardType="phone-pad"
              placeholderTextColor={colors.subtext}
              style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="备注，可选"
              placeholderTextColor={colors.subtext}
              multiline
              style={[styles.input, styles.textarea, { backgroundColor: colors.input, color: colors.text }]}
            />
          </ScrollView>

          <View style={[styles.stickyFooter, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.footerSummary}>
              <Text style={[styles.footerLabel, { color: colors.subtext }]}>已选</Text>
              <Text style={[styles.footerTime, { color: colors.text }]} numberOfLines={1}>
                {appointmentTime || "请选择预约时间"}
              </Text>
            </View>
            <Pressable
              style={[styles.submitButton, { backgroundColor: colors.accent }, !canSubmit && styles.disabled]}
              disabled={!canSubmit}
              onPress={() => {
                void trackEvent("booking_submit_clicked", {
                  styleId: styleId ?? null,
                  shopId: shopId ?? null,
                  source: "booking_sheet",
                  screen: "booking",
                  properties: { appointment_date: appointmentTime.slice(0, 10) },
                });
                mutation.mutate();
              }}
            >
              {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>提交预约</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  sheet: {
    marginHorizontal: 4,
    borderRadius: 24,
    overflow: "hidden",
    maxHeight: "86%",
  },
  dragHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeader: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    marginTop: -2,
    fontSize: 28,
    fontWeight: "500",
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
  },
  meta: {
    fontSize: 13,
    lineHeight: 19,
  },
  scrollBody: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 12,
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textarea: {
    minHeight: 64,
    textAlignVertical: "top",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  sectionMeta: {
    fontSize: 12,
    fontWeight: "700",
  },
  dateStrip: {
    gap: 10,
    paddingRight: 18,
  },
  dateChip: {
    width: 74,
    height: 70,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dateWeekText: {
    fontSize: 12,
    fontWeight: "800",
  },
  dateDayText: {
    fontSize: 18,
    fontWeight: "900",
  },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotButton: {
    borderWidth: 1,
    borderRadius: 14,
    width: "23%",
    minWidth: 68,
    paddingVertical: 9,
    alignItems: "center",
  },
  slotText: {
    fontSize: 13,
    fontWeight: "900",
  },
  noSlotsText: {
    width: "100%",
    paddingVertical: 12,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "800",
  },
  selectedSummary: {
    fontSize: 12,
    fontWeight: "800",
  },
  stickyFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  footerSummary: {
    flex: 1,
    gap: 2,
  },
  footerLabel: {
    fontSize: 11,
    fontWeight: "800",
  },
  footerTime: {
    fontSize: 13,
    fontWeight: "900",
  },
  submitButton: {
    minWidth: 128,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.72,
  },
  submitText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
});
