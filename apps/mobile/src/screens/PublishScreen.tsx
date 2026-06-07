import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import {
  ActivityIndicator,
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
const PUBLISH_ROSE = "#ff2d55";

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
  const [metadataHint, setMetadataHint] = useState("");
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

  const metadataMutation = useMutation({
    mutationFn: (uri: string) => api.generatePostMetadata(uri),
    onMutate: () => {
      setMetadataHint("");
    },
    onSuccess: (metadata) => {
      setTitle(metadata.title);
      setDescription(metadata.description);
      setTags(metadata.tags.join("，"));
      setMetadataHint("已根据图片生成标题、正文和标签，可以继续手动调整。");
    },
    onError: (error) => {
      setMetadataHint(error instanceof Error ? error.message : "生成失败，请稍后再试");
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
      setMetadataHint("");
    }
  };

  const generateMetadata = () => {
    if (!imageUri || metadataMutation.isPending) return;
    metadataMutation.mutate(imageUri);
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
              styles.composeCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
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
            {isMerchant && !defaultShop ? (
              <View
                style={[
                  styles.shopNotice,
                  { backgroundColor: colors.background },
                ]}
              >
                <Ionicons name="storefront-outline" size={17} color={colors.accent} />
                <Text style={[styles.shopNoticeText, { color: colors.text }]}>
                  正在准备默认门店
                </Text>
              </View>
            ) : null}
            <Pressable
              style={[
                styles.generateButton,
                {
                  borderColor: imageUri ? colors.accent : colors.border,
                  backgroundColor: imageUri ? colors.accentSoft : colors.background,
                  opacity: imageUri ? 1 : 0.55,
                },
              ]}
              onPress={generateMetadata}
              disabled={!imageUri || metadataMutation.isPending}
            >
              {metadataMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="sparkles-outline" size={17} color={colors.accent} />
              )}
              <Text style={[styles.generateButtonText, { color: colors.accent }]}>
                {metadataMutation.isPending ? "生成中" : "一键生成"}
              </Text>
            </Pressable>
            {metadataHint ? (
              <Text
                style={[
                  styles.metadataHint,
                  {
                    color: metadataMutation.isError ? colors.text : colors.subtext,
                  },
                ]}
              >
                {metadataHint}
              </Text>
            ) : null}
          </View>

          <View
            style={[
              styles.formCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.textInputBox,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <TextInput
                placeholder="添加标题"
                placeholderTextColor={colors.subtext}
                value={title}
                onChangeText={setTitle}
                style={[
                  styles.titleInput,
                  { color: colors.text },
                ]}
              />
            </View>
            <View
              style={[
                styles.textInputBox,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <TextInput
                placeholder="展开说说"
                placeholderTextColor={colors.subtext}
                value={description}
                onChangeText={setDescription}
                style={[
                  styles.descriptionInput,
                  { color: colors.text },
                ]}
                multiline
              />
            </View>
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                标签
              </Text>
              <TextInput
                placeholder="法式，裸粉，显白"
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
                可选。绑定后会展示真实消费标识。
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

          <Pressable
            style={[
              styles.publishButton,
              {
                backgroundColor: PUBLISH_ROSE,
              },
              (!canSubmit || mutation.isPending) && styles.publishButtonDisabled,
            ]}
              onPress={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.publishButtonText}>发布</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 120 },
  composeCard: {
    borderRadius: 26,
    padding: 14,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shopNotice: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  shopNoticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  generateButton: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  generateButtonText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  metadataHint: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  formCard: {
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 18,
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
    width: "100%",
    aspectRatio: 1,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: "dashed",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
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
  titleInput: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  textInputBox: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  descriptionInput: {
    minHeight: 84,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800",
    textAlignVertical: "top",
  },
  tagPreviewRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagPreviewText: { fontSize: 13, fontWeight: "900" },
  publishButton: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  publishButtonDisabled: {
    opacity: 0.55,
  },
  publishButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
});
