import * as ImagePicker from "expo-image-picker";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { OverlayContent } from "../components/OverlayContent";
import { PrimaryButton } from "../components/PrimaryButton";
import { RequireLogin } from "../components/RequireLogin";
import { useSlideOverlayDismiss } from "../components/SlideOverlayScreen";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";

const defaultAvatar = require("../../assets/profile/default_avatar.png");

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatBirthdayDate(date: Date) {
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

function parseBirthdayValue(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const ddmmyyyy = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!ddmmyyyy) return null;
  const [, dd, mm, yyyy] = ddmmyyyy;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

export function ProfileInfoScreen() {
  const navigation = useNavigation<any>();
  const dismissOverlay = useSlideOverlayDismiss();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [username, setUsername] = useState(user?.username ?? "");
  const [birthday, setBirthday] = useState(user?.birthday ?? "");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [birthdayPickerVisible, setBirthdayPickerVisible] = useState(false);
  const [birthdayDraft, setBirthdayDraft] = useState<Date>(parseBirthdayValue(user?.birthday) ?? new Date(2000, 0, 1));

  const currentUser = user;
  const currentUsernameValue = currentUser?.username?.trim() ?? "";
  const parsedCurrentBirthday = parseBirthdayValue(currentUser?.birthday);
  const effectiveBirthdayValue = parsedCurrentBirthday ? formatBirthdayDate(parsedCurrentBirthday) : "";

  useEffect(() => {
    if (!currentUser) return;
    const parsedBirthday = parseBirthdayValue(currentUser.birthday);
    setUsername(currentUser.username ?? "");
    setBirthday(parsedBirthday ? formatBirthdayDate(parsedBirthday) : "");
    setBirthdayDraft(parsedBirthday ?? new Date(2000, 0, 1));
  }, [currentUser]);

  const isDirty = useMemo(() => {
    if (!currentUser) return false;
    return username.trim() !== currentUsernameValue || birthday.trim() !== effectiveBirthdayValue || Boolean(avatarUri);
  }, [avatarUri, birthday, currentUser, currentUsernameValue, effectiveBirthdayValue, username]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: { username?: string; birthday?: string; avatarUri?: string } = {};
      if (username.trim() !== currentUsernameValue) payload.username = username.trim();
      if (birthday.trim() !== effectiveBirthdayValue) payload.birthday = birthday.trim();
      if (avatarUri) payload.avatarUri = avatarUri;
      return api.updateMe(payload);
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      if (token) queryClient.setQueryData(["me", token], updatedUser);
      void queryClient.invalidateQueries({ queryKey: ["author-profile", updatedUser.id] });
      dismissOverlay?.() ?? navigation.goBack();
    },
  });

  if (!token) {
    return <RequireLogin onLogin={() => navigation.navigate("Login")} message="登录后可编辑个人信息" />;
  }

  const currentAvatar = avatarUri
    ? { uri: avatarUri }
    : currentUser?.avatar_url
      ? { uri: resolveAssetUrl(currentUser.avatar_url) }
      : defaultAvatar;

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const openBirthdayPicker = () => {
    setBirthdayDraft(parseBirthdayValue(birthday) ?? parseBirthdayValue(currentUser?.birthday) ?? new Date(2000, 0, 1));
    setBirthdayPickerVisible(true);
  };

  const applyBirthday = (date: Date) => {
    setBirthday(formatBirthdayDate(date));
    setBirthdayDraft(date);
  };

  const handleAndroidBirthdayChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setBirthdayPickerVisible(false);
    if (event.type === "dismissed" || !selectedDate) return;
    applyBirthday(selectedDate);
  };

  return (
    <>
      <OverlayContent.Scroll keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Pressable style={styles.avatarRow} onPress={pickAvatar}>
            <Image source={currentAvatar} style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]} />
            <View style={styles.avatarText}>
              <Text style={[styles.title, { color: colors.text }]}>头像</Text>
              <Text style={[styles.subtitle, { color: colors.subtext }]}>点击更换头像</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>用户名</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
              value={username}
              onChangeText={setUsername}
              placeholder="请输入用户名"
              placeholderTextColor={colors.subtext}
              maxLength={20}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>生日</Text>
            <Pressable
              style={[styles.input, styles.dateField, { backgroundColor: colors.input, borderColor: colors.border }]}
              onPress={openBirthdayPicker}
            >
              <Text style={{ color: birthday ? colors.text : colors.subtext }}>{birthday || "请选择生日"}</Text>
              <Ionicons name="calendar-outline" size={18} color={colors.subtext} />
            </Pressable>
            <Text style={[styles.hint, { color: colors.subtext }]}>日期格式：dd-mm-yyyy</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.readOnlyRow}>
            <Text style={[styles.label, { color: colors.text }]}>手机号</Text>
            <Text style={[styles.phone, { color: colors.subtext }]}>{currentUser?.phone ?? "未绑定"}</Text>
          </View>
        </View>

        <PrimaryButton
          label={saveMutation.isPending ? "保存中..." : "保存"}
          onPress={() => saveMutation.mutate()}
          loading={saveMutation.isPending}
          disabled={!username.trim() || !isDirty}
        />
      </OverlayContent.Scroll>

      {Platform.OS === "android" && birthdayPickerVisible ? (
        <DateTimePicker
          value={birthdayDraft}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handleAndroidBirthdayChange}
        />
      ) : null}

      {Platform.OS !== "android" ? (
        <Modal visible={birthdayPickerVisible} transparent animationType="fade" onRequestClose={() => setBirthdayPickerVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <View style={styles.modalActions}>
                <Pressable onPress={() => setBirthdayPickerVisible(false)}>
                  <Text style={[styles.modalActionText, { color: colors.subtext }]}>取消</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    applyBirthday(birthdayDraft);
                    setBirthdayPickerVisible(false);
                  }}
                >
                  <Text style={[styles.modalActionText, { color: colors.accent }]}>完成</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={birthdayDraft}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={(_, selectedDate) => {
                  if (selectedDate) setBirthdayDraft(selectedDate);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 16,
    gap: 16,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarText: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 13,
  },
  field: {
    gap: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: "800",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hint: {
    fontSize: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  readOnlyRow: {
    gap: 10,
  },
  phone: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    textAlignVertical: "center",
    lineHeight: 48,
    fontSize: 16,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 28,
    overflow: "hidden",
  },
  modalActions: {
    height: 52,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalActionText: {
    fontSize: 16,
    fontWeight: "800",
  },
});
