import * as ImagePicker from "expo-image-picker";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, resolveAssetUrl } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { RequireLogin } from "../components/RequireLogin";
import { useSlideOverlayDismiss } from "../components/SlideOverlayScreen";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";
import { DEFAULT_AVATAR_SOURCE } from "../constants/imageSources";

const defaultAvatar = DEFAULT_AVATAR_SOURCE;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatBirthdayDate(date: Date) {
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

function parseBirthdayValue(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const normalized = value.trim();
  const ddmmyyyy = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }
  return null;
}

export function ProfileEditScreen() {
  const navigation = useNavigation<any>();
  const dismissOverlay = useSlideOverlayDismiss();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const colors = useThemeColors();
  const [username, setUsername] = useState(user?.username ?? "");
  const [birthday, setBirthday] = useState(user?.birthday ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [birthdayPickerVisible, setBirthdayPickerVisible] = useState(false);
  const [birthdayDraft, setBirthdayDraft] = useState<Date>(
    parseBirthdayValue(user?.birthday) ?? new Date(2000, 0, 1),
  );

  const currentUser = user;
  const isMerchant = currentUser?.role === "merchant";
  const currentUsernameValue = currentUser?.username?.trim() ?? "";
  const parsedCurrentBirthday = parseBirthdayValue(currentUser?.birthday);
  const effectiveBirthdayValue = parsedCurrentBirthday
    ? formatBirthdayDate(parsedCurrentBirthday)
    : "";
  const effectiveBioValue = currentUser?.bio?.trim() ?? "";

  useEffect(() => {
    if (!user) return;
    const parsedBirthday = parseBirthdayValue(user.birthday);
    setUsername(user.username ?? "");
    setBirthday(parsedBirthday ? formatBirthdayDate(parsedBirthday) : "");
    setBirthdayDraft(parsedBirthday ?? new Date(2000, 0, 1));
    setBio(user.bio?.trim() ?? "");
  }, [user]);

  const isDirty = useMemo(() => {
    if (!currentUser) return false;
    return (
      username.trim() !== currentUsernameValue ||
      (!isMerchant && birthday.trim() !== effectiveBirthdayValue) ||
      bio.trim() !== effectiveBioValue ||
      Boolean(avatarUri)
    );
  }, [
    avatarUri,
    bio,
    birthday,
    currentUser,
    currentUsernameValue,
    effectiveBirthdayValue,
    effectiveBioValue,
    isMerchant,
    username,
  ]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: {
        username?: string;
        birthday?: string;
        bio?: string;
        avatarUri?: string;
      } = {};
      if (username.trim() !== currentUsernameValue)
        payload.username = username.trim();
      if (!isMerchant && birthday.trim() !== effectiveBirthdayValue)
        payload.birthday = birthday.trim();
      if (bio.trim() !== effectiveBioValue) payload.bio = bio.trim();
      if (avatarUri) payload.avatarUri = avatarUri;
      return api.updateMe(payload);
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      if (token) queryClient.setQueryData(["me", token], updatedUser);
      void queryClient.invalidateQueries({
        queryKey: ["profile-author", updatedUser.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["author-profile", updatedUser.id],
      });
      dismissOverlay?.() ?? navigation.goBack();
    },
  });

  if (!token) {
    return (
      <RequireLogin
        onLogin={() => navigation.navigate("Login")}
        message="登录后可编辑主页资料"
      />
    );
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
    setBirthdayDraft(
      parseBirthdayValue(birthday) ??
        parseBirthdayValue(currentUser?.birthday) ??
        new Date(2000, 0, 1),
    );
    setBirthdayPickerVisible(true);
  };

  const applyBirthday = (date: Date) => {
    setBirthday(formatBirthdayDate(date));
    setBirthdayDraft(date);
  };

  const handleAndroidBirthdayChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setBirthdayPickerVisible(false);
    if (event.type === "dismissed" || !selectedDate) return;
    applyBirthday(selectedDate);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.surfaceAlt }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[styles.previewCard, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.previewEyebrow, { color: colors.accent }]}>
              {isMerchant ? "商户信息" : "焕甲主页"}
            </Text>
            <Text style={[styles.previewTitle, { color: colors.text }]}>
              {isMerchant ? "编辑商户信息" : "编辑你的主页形象"}
            </Text>
            <Text style={[styles.previewSubtitle, { color: colors.subtext }]}>
              {isMerchant
                ? "头像、商户名和简介会展示在店铺作品与消息中。"
                : "头像、昵称和简介会展示在作者页顶部。"}
            </Text>

            <View
              style={[
                styles.previewHero,
                { backgroundColor: colors.accentSoft },
              ]}
            >
              <Image source={currentAvatar} style={styles.previewAvatar} />
              <View style={styles.previewMeta}>
                <Text
                  style={[styles.previewName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {username.trim() || "点击设置你的昵称"}
                </Text>
                <Text style={[styles.previewHandle, { color: colors.subtext }]}>
                  焕甲号：{currentUser?.uid ?? 0}
                </Text>
                {bio.trim() ? (
                  <Text
                    style={[styles.previewBio, { color: colors.subtext }]}
                    numberOfLines={2}
                  >
                    {bio.trim()}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          <View
            style={[styles.sectionCard, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              基础资料
            </Text>

            <Pressable style={styles.avatarRow} onPress={pickAvatar}>
              <View style={styles.avatarRowLeft}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  头像
                </Text>
                <Text style={[styles.rowHint, { color: colors.subtext }]}>
                  建议使用清晰的正方形图片
                </Text>
              </View>
              <View style={styles.avatarRowRight}>
                <Image
                  source={currentAvatar}
                  style={[
                    styles.inlineAvatar,
                    { backgroundColor: colors.input },
                  ]}
                />
                <View
                  style={[
                    styles.inlinePill,
                    { backgroundColor: colors.accentSoft },
                  ]}
                >
                  <Ionicons
                    name="image-outline"
                    size={14}
                    color={colors.accent}
                  />
                  <Text
                    style={[styles.inlinePillText, { color: colors.accent }]}
                  >
                    更换
                  </Text>
                </View>
              </View>
            </Pressable>

            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            <View style={styles.field}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>
                昵称
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.input,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                value={username}
                onChangeText={setUsername}
                placeholder="设置一个让人记住的昵称"
                placeholderTextColor={colors.subtext}
                maxLength={20}
              />
            </View>

            {!isMerchant ? (
              <View style={styles.field}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  生日
                </Text>
                <Pressable
                  style={[
                    styles.input,
                    styles.dateField,
                    {
                      backgroundColor: colors.input,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={openBirthdayPicker}
                >
                  <Text
                    style={[
                      styles.dateFieldText,
                      { color: birthday ? colors.text : colors.subtext },
                    ]}
                  >
                    {birthday || "请选择生日"}
                  </Text>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={colors.subtext}
                  />
                </Pressable>
                <Text style={[styles.dateHint, { color: colors.subtext }]}>
                  日期格式：dd-mm-yyyy
                </Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>
                简介
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textarea,
                  {
                    backgroundColor: colors.input,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                value={bio}
                onChangeText={setBio}
                placeholder="请输入简介..."
                placeholderTextColor={colors.subtext}
                multiline
                maxLength={128}
              />
              <Text style={[styles.characterCount, { color: colors.subtext }]}>
                {bio.length}/128
              </Text>
            </View>
          </View>

          <PrimaryButton
            label={
              saveMutation.isPending
                ? "保存中..."
                : isMerchant
                  ? "保存商户信息"
                  : "保存主页"
            }
            onPress={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={!username.trim() || !isDirty}
            style={styles.saveButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {!isMerchant && Platform.OS === "android" && birthdayPickerVisible ? (
        <DateTimePicker
          value={birthdayDraft}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handleAndroidBirthdayChange}
        />
      ) : null}

      {!isMerchant && Platform.OS === "ios" ? (
        <Modal
          visible={birthdayPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setBirthdayPickerVisible(false)}
        >
          <View style={styles.pickerOverlay}>
            <Pressable
              style={styles.pickerBackdrop}
              onPress={() => setBirthdayPickerVisible(false)}
            />
            <View
              style={[styles.pickerSheet, { backgroundColor: colors.surface }]}
            >
              <View
                style={[
                  styles.pickerHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Pressable onPress={() => setBirthdayPickerVisible(false)}>
                  <Text
                    style={[
                      styles.pickerHeaderAction,
                      { color: colors.subtext },
                    ]}
                  >
                    取消
                  </Text>
                </Pressable>
                <Text
                  style={[styles.pickerHeaderTitle, { color: colors.text }]}
                >
                  选择生日
                </Text>
                <Pressable
                  onPress={() => {
                    applyBirthday(birthdayDraft);
                    setBirthdayPickerVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerHeaderAction,
                      { color: colors.accent },
                    ]}
                  >
                    完成
                  </Text>
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
                style={styles.picker}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  previewCard: {
    borderRadius: 28,
    padding: 20,
    gap: 10,
  },
  previewEyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  previewTitle: {
    fontSize: 26,
    fontWeight: "800",
  },
  previewSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  previewHero: {
    marginTop: 6,
    borderRadius: 22,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  previewAvatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
  },
  previewMeta: {
    flex: 1,
    gap: 4,
  },
  previewName: {
    fontSize: 22,
    fontWeight: "800",
  },
  previewHandle: {
    fontSize: 13,
    fontWeight: "600",
  },
  previewBio: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  sectionCard: {
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  avatarRowLeft: {
    flex: 1,
    gap: 4,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  rowHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  avatarRowRight: {
    alignItems: "center",
    gap: 8,
  },
  inlineAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  inlinePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  inlinePillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  field: {
    gap: 8,
  },
  input: {
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    fontSize: 16,
  },
  textarea: {
    minHeight: 116,
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: "top",
  },
  characterCount: {
    fontSize: 12,
    textAlign: "right",
  },
  readOnlyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  readOnlyLabel: {
    fontSize: 14,
  },
  readOnlyValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  footerTip: {
    fontSize: 13,
    lineHeight: 18,
  },
  saveButton: {
    marginTop: 4,
  },
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateFieldText: {
    fontSize: 16,
  },
  dateHint: {
    fontSize: 12,
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(8, 10, 16, 0.32)",
  },
  pickerBackdrop: {
    flex: 1,
  },
  pickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 18,
  },
  pickerHeader: {
    height: 54,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerHeaderAction: {
    fontSize: 16,
    fontWeight: "600",
  },
  pickerHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  picker: {
    height: 220,
  },
});
