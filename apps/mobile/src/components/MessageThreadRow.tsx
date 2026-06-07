import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MessageInboxThread } from "../types/api";
import type { AppPalette } from "../utils/theme";
import { defaultAvatarSourceFor } from "../constants/imageSources";

function formatConversationTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const isSameYear = date.getFullYear() === now.getFullYear();
  const isSameDay = date.toDateString() === now.toDateString();
  if (isSameDay) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 1) return "昨天";
  if (diff < 7) {
    return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
  }
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return isSameYear ? `${month}-${day}` : `${date.getFullYear()}/${month}-${day}`;
}

function formatUnreadCount(count: number) {
  if (count <= 0) return "";
  if (count > 99) return "99+";
  return String(count);
}

type MessageThreadRowProps = {
  item: MessageInboxThread;
  colors: AppPalette;
  onPress: (item: MessageInboxThread) => void;
};

export function MessageThreadRow({ item, colors, onPress }: MessageThreadRowProps) {
  const unreadLabel = formatUnreadCount(item.unread_count);

  return (
    <Pressable style={styles.row} onPress={() => onPress(item)}>
      <Image
        source={defaultAvatarSourceFor(item.target)}
        style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}
      />
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {item.target.username}
          </Text>
          <Text style={[styles.time, { color: colors.subtext }]}>{formatConversationTime(item.last_message_at)}</Text>
        </View>
        <View style={styles.bottomLine}>
          <Text style={[styles.preview, { color: colors.subtext }]} numberOfLines={1}>
            {item.last_message_preview}
          </Text>
          <View style={styles.trailing}>
            {item.is_muted ? <Ionicons name="volume-mute-outline" size={15} color={colors.subtext} /> : null}
            {unreadLabel ? (
              <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                <Text style={styles.badgeText}>{unreadLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  name: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
  },
  time: {
    fontSize: 14,
  },
  bottomLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  preview: {
    flex: 1,
    fontSize: 15,
  },
  trailing: {
    minWidth: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
});
