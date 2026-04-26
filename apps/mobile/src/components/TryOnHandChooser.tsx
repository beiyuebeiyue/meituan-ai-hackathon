import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "./PrimaryButton";
import { resolveAssetUrl } from "../api/client";
import { UserHandPhoto } from "../types/api";
import { useThemeColors } from "../utils/theme";

type TryOnHandChooserProps = {
  title: string;
  description: string;
  recentHandPhotos: UserHandPhoto[];
  selectedHandPhotoId?: string | null;
  loading?: boolean;
  busy?: boolean;
  onSelectSavedHand: (item: UserHandPhoto) => void;
  onTakePhoto: () => void;
  onPickFromLibrary: () => void;
};

function HandSelectionCard({
  item,
  selected,
  disabled,
  onPress,
}: {
  item: UserHandPhoto;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();

  return (
    <Pressable
      style={[
        styles.handSelectionCard,
        { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
        selected && { borderColor: colors.accent, backgroundColor: `${colors.accent}18` },
        disabled && styles.cardDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Image source={{ uri: resolveAssetUrl(item.image_url) }} style={styles.handSelectionImage} />
      <Text style={[styles.handSelectionLabel, { color: selected ? colors.accent : colors.text }]} numberOfLines={1}>
        {selected ? "当前使用" : "最近上传"}
      </Text>
      <Text style={[styles.handSelectionMeta, { color: colors.subtext }]}>{selected ? "已选中" : "点此使用"}</Text>
    </Pressable>
  );
}

export function TryOnHandChooser({
  title,
  description,
  recentHandPhotos,
  selectedHandPhotoId,
  loading,
  busy,
  onSelectSavedHand,
  onTakePhoto,
  onPickFromLibrary,
}: TryOnHandChooserProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.subtext }]}>{description}</Text>

      {loading ? (
        <View style={styles.loadingInline}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.loadingInlineText, { color: colors.subtext }]}>正在读取你最近的手图</Text>
        </View>
      ) : null}

      {recentHandPhotos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.handList}>
          {recentHandPhotos.map((item) => (
            <HandSelectionCard
              key={item.id}
              item={item}
              selected={item.id === selectedHandPhotoId}
              disabled={busy}
              onPress={() => onSelectSavedHand(item)}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.handActions}>
        <PrimaryButton label="即刻拍照" onPress={onTakePhoto} disabled={busy} style={{ flex: 1 }} />
        <PrimaryButton label="上传照片" onPress={onPickFromLibrary} disabled={busy} variant="ghost" style={{ flex: 1 }} />
      </View>

      <View style={[styles.tipRow, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
        <Text style={[styles.tipText, { color: colors.subtext }]}>选好手图后，我会直接拿当前这款美甲开始焕甲试戴。</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 28,
    padding: 18,
    gap: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
  },
  loadingInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingInlineText: {
    fontSize: 13,
  },
  handList: {
    gap: 12,
    paddingRight: 4,
  },
  handSelectionCard: {
    width: 134,
    borderRadius: 22,
    padding: 10,
    borderWidth: 1,
    gap: 8,
  },
  handSelectionImage: {
    width: "100%",
    aspectRatio: 0.82,
    borderRadius: 16,
  },
  handSelectionLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  handSelectionMeta: {
    fontSize: 12,
  },
  handActions: {
    flexDirection: "row",
    gap: 12,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  cardDisabled: {
    opacity: 0.6,
  },
});
