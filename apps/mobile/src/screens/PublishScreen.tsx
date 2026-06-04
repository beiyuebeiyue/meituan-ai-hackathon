import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { RequireLogin } from "../components/RequireLogin";
import { useAuthStore } from "../store/useAuthStore";
import { Booking } from "../types/api";
import { useThemeColors } from "../utils/theme";

const bookingStatusLabel: Record<Booking["status"], string> = {
  pending: "预约请求",
  accepted: "预约成功",
  rejected: "预约失败",
  completed: "订单完成",
  cancelled: "订单取消",
};

export function PublishScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const colors = useThemeColors();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [verifiedBookingId, setVerifiedBookingId] = useState<string | null>(
    null,
  );

  const shopsQuery = useQuery({
    queryKey: ["merchant-shops"],
    queryFn: api.getMyMerchantShops,
    enabled: Boolean(token && user?.role === "merchant"),
  });
  const defaultShop = shopsQuery.data?.items[0] ?? null;
  const isMerchant = user?.role === "merchant";
  const requiresShop = Boolean(isMerchant);
  const bookingsQuery = useQuery({
    queryKey: ["my-bookings", "completed-for-publish"],
    queryFn: api.getMyBookings,
    enabled: Boolean(token && !isMerchant),
  });
  const completedBookings = (bookingsQuery.data?.items ?? []).filter(
    (item) => item.status === "completed",
  );
  const selectedBooking =
    completedBookings.find((item) => item.id === verifiedBookingId) ?? null;

  const mutation = useMutation({
    mutationFn: () =>
      api.createPost({
        title,
        description,
        tags,
        imageUri: imageUri!,
        shopId: isMerchant
          ? defaultShop?.id
          : (selectedBooking?.shop_id ?? null),
        verifiedBookingId: isMerchant ? null : verifiedBookingId,
      }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setTags("");
      setImageUri(null);
      setVerifiedBookingId(null);
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
      void queryClient.invalidateQueries({ queryKey: ["author-profile"] });
    },
  });

  if (!token) {
    return (
      <RequireLogin
        onLogin={() => navigation.navigate("Login" as never)}
        message="登录后才能发布内容"
      />
    );
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const tagPreview = tags
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  const canSubmit = Boolean(
    title && imageUri && (!requiresShop || defaultShop),
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.hero,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.heroTop}>
              <View>
                <Text style={[styles.eyebrow, { color: colors.accent }]}>
                  {isMerchant ? "商家作品" : "个人作品"}
                </Text>
                <Text style={[styles.title, { color: colors.text }]}>
                  发布美甲灵感
                </Text>
              </View>
              <View
                style={[
                  styles.heroBadge,
                  { backgroundColor: colors.accentSoft },
                ]}
              >
                <Ionicons
                  name={isMerchant ? "storefront-outline" : "sparkles-outline"}
                  size={16}
                  color={colors.accent}
                />
                <Text style={[styles.heroBadgeText, { color: colors.accent }]}>
                  {isMerchant ? "店铺展示" : "社区分享"}
                </Text>
              </View>
            </View>
            <Text style={[styles.heroCopy, { color: colors.subtext }]}>
              {isMerchant
                ? "发布后会自动关联你的默认门店，并进入店铺作品与同城内容。"
                : "上传你的美甲实拍或灵感图，写下标题、文案和标签。"}
            </Text>
          </View>

          <View
            style={[
              styles.composeCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.composeHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                作品封面
              </Text>
              <Text style={[styles.sectionHint, { color: colors.subtext }]}>
                建议选择清晰手部图
              </Text>
            </View>
            <View style={styles.coverRow}>
              <Pressable
                style={[
                  styles.uploadCard,
                  {
                    borderColor: imageUri ? colors.border : colors.accent,
                    backgroundColor: imageUri
                      ? colors.background
                      : colors.accentSoft,
                  },
                ]}
                onPress={pickImage}
              >
                {imageUri ? (
                  <>
                    <Image
                      source={{ uri: imageUri }}
                      style={[
                        styles.preview,
                        { backgroundColor: colors.accentSoft },
                      ]}
                    />
                    <View
                      style={[
                        styles.previewOverlay,
                        { backgroundColor: colors.overlay },
                      ]}
                    >
                      <Ionicons name="refresh" size={14} color="#ffffff" />
                      <Text style={styles.previewOverlayText}>更换</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Ionicons
                      name="image-outline"
                      size={30}
                      color={colors.accent}
                    />
                    <Text style={[styles.uploadTitle, { color: colors.text }]}>
                      上传图片
                    </Text>
                  </View>
                )}
              </Pressable>
              <View style={styles.coverTips}>
                <View
                  style={[
                    styles.tipPill,
                    { backgroundColor: colors.background },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={15}
                    color={colors.accent}
                  />
                  <Text style={[styles.tipPillText, { color: colors.subtext }]}>
                    竖图更适合首页瀑布流
                  </Text>
                </View>
                <View
                  style={[
                    styles.tipPill,
                    { backgroundColor: colors.background },
                  ]}
                >
                  <Ionicons
                    name="text-outline"
                    size={15}
                    color={colors.accent}
                  />
                  <Text style={[styles.tipPillText, { color: colors.subtext }]}>
                    标题尽量短且有记忆点
                  </Text>
                </View>
                <View
                  style={[
                    styles.publishTarget,
                    { backgroundColor: colors.background },
                  ]}
                >
                  <Ionicons
                    name={
                      isMerchant
                        ? "storefront-outline"
                        : selectedBooking
                          ? "shield-checkmark-outline"
                          : "person-circle-outline"
                    }
                    size={17}
                    color={colors.accent}
                  />
                  <Text
                    style={[styles.publishTargetText, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {isMerchant
                      ? defaultShop
                        ? `${defaultShop.name} · ${defaultShop.city}`
                        : "正在准备默认门店"
                      : selectedBooking
                        ? `真实消费 · ${selectedBooking.shop_name}`
                        : "发布到个人主页"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.formCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                标题
              </Text>
              <TextInput
                placeholder="比如：这款裸粉猫眼真的太显白"
                placeholderTextColor={colors.subtext}
                value={title}
                onChangeText={setTitle}
                style={[
                  styles.input,
                  { backgroundColor: colors.background, color: colors.text },
                ]}
              />
            </View>
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                正文
              </Text>
              <TextInput
                placeholder="分享上手感受、适合场景、显白程度..."
                placeholderTextColor={colors.subtext}
                value={description}
                onChangeText={setDescription}
                style={[
                  styles.input,
                  styles.textarea,
                  { backgroundColor: colors.background, color: colors.text },
                ]}
                multiline
              />
            </View>
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                标签
              </Text>
              <TextInput
                placeholder="法式，裸粉，显白，通勤"
                placeholderTextColor={colors.subtext}
                value={tags}
                onChangeText={setTags}
                style={[
                  styles.input,
                  { backgroundColor: colors.background, color: colors.text },
                ]}
              />
              {tagPreview.length ? (
                <View style={styles.tagPreviewRow}>
                  {tagPreview.map((item) => (
                    <Text
                      key={item}
                      style={[styles.tagPreviewText, { color: colors.accent }]}
                    >
                      #{item}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          {!isMerchant ? (
            <View
              style={[
                styles.verifiedSection,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.verifiedTitleRow}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={colors.accent}
                />
                <Text style={[styles.verifiedTitle, { color: colors.text }]}>
                  绑定真实消费
                </Text>
              </View>
              <Text style={[styles.verifiedHint, { color: colors.subtext }]}>
                只有已完成订单可以绑定，绑定后详情页会展示“真实消费”和店铺信息。
              </Text>
              {completedBookings.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.bookingChoices}
                >
                  {completedBookings.map((item) => {
                    const selected = item.id === verifiedBookingId;
                    return (
                      <Pressable
                        key={item.id}
                        style={[
                          styles.bookingChoice,
                          {
                            borderColor: selected
                              ? colors.accent
                              : colors.border,
                            backgroundColor: selected
                              ? colors.accentSoft
                              : colors.background,
                          },
                        ]}
                        onPress={() =>
                          setVerifiedBookingId((current) =>
                            current === item.id ? null : item.id,
                          )
                        }
                      >
                        <View style={styles.bookingChoiceHeader}>
                          <Text
                            style={[
                              styles.bookingChoiceTitle,
                              { color: colors.text },
                            ]}
                            numberOfLines={1}
                          >
                            {item.style_title}
                          </Text>
                          {selected ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={16}
                              color={colors.accent}
                            />
                          ) : null}
                        </View>
                        <Text
                          style={[
                            styles.bookingChoiceMeta,
                            { color: colors.subtext },
                          ]}
                          numberOfLines={1}
                        >
                          {item.shop_name} · {bookingStatusLabel[item.status]}
                        </Text>
                        <Text
                          style={[
                            styles.bookingChoiceMeta,
                            { color: colors.subtext },
                          ]}
                          numberOfLines={1}
                        >
                          {item.created_at.slice(0, 10)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={[styles.verifiedEmpty, { color: colors.subtext }]}>
                  暂无已完成订单，也可以直接发布普通个人作品。
                </Text>
              )}
            </View>
          ) : null}

          <View
            style={[
              styles.submitCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.submitCopy}>
              <Text style={[styles.submitTitle, { color: colors.text }]}>
                准备发布
              </Text>
              <Text style={[styles.submitHint, { color: colors.subtext }]}>
                至少需要一张图片和标题
              </Text>
            </View>
            <PrimaryButton
              label="提交发布"
              onPress={() => mutation.mutate()}
              loading={mutation.isPending}
              disabled={!canSubmit}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 120 },
  hero: {
    borderRadius: 28,
    padding: 18,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: { fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: "900", letterSpacing: -0.8 },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroBadgeText: { fontSize: 12, fontWeight: "900" },
  heroCopy: { fontSize: 13, lineHeight: 20, fontWeight: "600" },
  composeCard: {
    borderRadius: 26,
    padding: 14,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  composeHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: "900" },
  sectionHint: { fontSize: 12, fontWeight: "700" },
  coverRow: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  coverTips: { flex: 1, gap: 8 },
  tipPill: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  tipPillText: { flex: 1, fontSize: 12, fontWeight: "700" },
  publishTarget: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  publishTargetText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  formCard: {
    borderRadius: 26,
    padding: 14,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fieldBlock: { gap: 8 },
  fieldLabel: { fontSize: 14, fontWeight: "900" },
  verifiedSection: {
    borderRadius: 24,
    padding: 14,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  verifiedTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  verifiedTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  verifiedHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  bookingChoices: {
    gap: 10,
    paddingRight: 4,
  },
  bookingChoice: {
    width: 180,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  bookingChoiceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bookingChoiceTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  bookingChoiceMeta: {
    fontSize: 12,
    fontWeight: "600",
  },
  verifiedEmpty: {
    fontSize: 12,
    lineHeight: 18,
  },
  uploadCard: {
    width: 128,
    height: 128,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: "dashed",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadCardFilled: {
    borderStyle: "solid",
  },
  uploadPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  preview: {
    width: "100%",
    height: "100%",
  },
  previewOverlay: {
    position: "absolute",
    right: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(36, 26, 21, 0.58)",
  },
  previewOverlayText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  input: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: "700",
  },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  tagPreviewRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagPreviewText: { fontSize: 13, fontWeight: "900" },
  submitCard: {
    borderRadius: 26,
    padding: 14,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  submitCopy: { gap: 4 },
  submitTitle: { fontSize: 16, fontWeight: "900" },
  submitHint: { fontSize: 12, fontWeight: "700" },
});
