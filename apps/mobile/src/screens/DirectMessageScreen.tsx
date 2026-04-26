import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { useSlideOverlayDismiss } from "../components/SlideOverlayScreen";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useThemeColors } from "../utils/theme";

const defaultAvatar = require("../../assets/profile/default_avatar.png");

type ScreenRoute = RouteProp<RootStackParamList, "DirectMessage">;

function formatMessageTime(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function DirectMessageScreen() {
  const navigation = useNavigation<any>();
  const dismissOverlay = useSlideOverlayDismiss();
  const route = useRoute<ScreenRoute>();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const [message, setMessage] = useState("");

  const query = useQuery({
    queryKey: ["conversation", route.params.userId],
    queryFn: () => api.getConversation(route.params.userId),
  });

  useEffect(() => {
    if (!query.dataUpdatedAt) return;
    void queryClient.invalidateQueries({ queryKey: ["message-inbox"] });
    void queryClient.invalidateQueries({ queryKey: ["stranger-messages"] });
  }, [query.dataUpdatedAt, queryClient]);

  const sendMutation = useMutation({
    mutationFn: () => api.sendMessage(route.params.userId, message),
    onSuccess: async () => {
      setMessage("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["conversation", route.params.userId] }),
        queryClient.invalidateQueries({ queryKey: ["message-inbox"] }),
        queryClient.invalidateQueries({ queryKey: ["stranger-messages"] }),
      ]);
    },
    onError: (error: Error) => {
      let detail = error.message;
      try {
        const parsed = JSON.parse(error.message) as { detail?: string };
        detail = parsed.detail ?? detail;
      } catch {
        // ignore parse failures
      }
      Alert.alert("发送失败", detail);
    },
  });

  const thread = query.data;
  const canSend = Boolean(thread?.can_send && !sendMutation.isPending && message.trim());

  const bubbleBorderColor = useMemo(() => colors.border, [colors.border]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <Pressable style={styles.headerAction} onPress={() => dismissOverlay?.() ?? navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <Pressable
            style={styles.headerCenter}
            disabled={!thread || thread.target.role !== "merchant"}
            onPress={() => {
              if (thread?.target.role === "merchant") {
                navigation.navigate("AuthorProfile", { authorId: thread.target.id });
              }
            }}
          >
            <Image
              source={thread?.target.avatar_url ? { uri: resolveAssetUrl(thread.target.avatar_url) } : defaultAvatar}
              style={[styles.headerAvatar, { backgroundColor: colors.surfaceAlt }]}
            />
            <Text style={[styles.headerName, { color: colors.text }]}>{thread?.target.username ?? "私信"}</Text>
          </Pressable>
          <Pressable
            style={styles.headerAction}
            onPress={() => Alert.alert("更多", "黑名单操作请在作者主页右上角中完成。")}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
          </Pressable>
        </View>

        {thread?.notice ? <Text style={[styles.notice, { color: colors.subtext }]}>{thread.notice}</Text> : null}

        <FlatList
          data={thread?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyText, { color: colors.subtext }]}>发一条消息，开始这段对话。</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.messageRow, item.is_mine ? styles.mineRow : styles.otherRow]}>
              {!item.is_mine ? (
                <Image
                  source={thread?.target.avatar_url ? { uri: resolveAssetUrl(thread.target.avatar_url) } : defaultAvatar}
                  style={[styles.messageAvatar, { backgroundColor: colors.surfaceAlt }]}
                />
              ) : null}
              <View style={styles.messageContent}>
                <View
                  style={[
                    styles.messageBubble,
                    {
                      backgroundColor: item.is_mine ? "#2d82ff" : colors.surface,
                      borderColor: item.is_mine ? "#2d82ff" : bubbleBorderColor,
                    },
                  ]}
                >
                  <Text style={[styles.messageText, { color: item.is_mine ? "#ffffff" : colors.text }]}>{item.content}</Text>
                </View>
                <Text style={[styles.messageTime, { color: colors.subtext }]}>{formatMessageTime(item.created_at)}</Text>
              </View>
            </View>
          )}
        />

        <View style={[styles.composerWrap, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <View style={[styles.inputShell, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Pressable style={styles.iconButton} onPress={() => Alert.alert("语音", "语音私信后续补充。")}>
              <Ionicons name="mic-outline" size={22} color={colors.subtext} />
            </Pressable>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="发消息..."
              placeholderTextColor={colors.subtext}
              style={[styles.input, { color: colors.text }]}
              editable={Boolean(thread?.can_send)}
            />
            <Pressable style={styles.iconButton} onPress={() => Alert.alert("表情", "表情私信后续补充。")}>
              <Ionicons name="happy-outline" size={22} color={colors.subtext} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={() => Alert.alert("更多", "图片和更多功能后续补充。")}>
              <Ionicons name="add-circle-outline" size={24} color={colors.subtext} />
            </Pressable>
          </View>
          <Pressable
            style={[
              styles.sendButton,
              {
                borderColor: canSend ? colors.accent : colors.border,
                backgroundColor: canSend ? colors.accentSoft : colors.surfaceAlt,
              },
            ]}
            disabled={!canSend}
            onPress={() => sendMutation.mutate()}
          >
            <Text style={[styles.sendButtonText, { color: canSend ? colors.accent : colors.subtext }]}>发送</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerAction: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerName: {
    fontSize: 18,
    fontWeight: "700",
  },
  notice: {
    textAlign: "center",
    paddingHorizontal: 28,
    paddingTop: 18,
    lineHeight: 24,
    fontSize: 15,
  },
  messageList: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 18,
    gap: 16,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 15,
  },
  messageRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
  },
  mineRow: {
    justifyContent: "flex-end",
    alignSelf: "flex-end",
  },
  otherRow: {
    justifyContent: "flex-start",
    alignSelf: "flex-start",
  },
  messageAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  messageContent: {
    gap: 6,
    maxWidth: "78%",
  },
  messageBubble: {
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTime: {
    fontSize: 12,
  },
  composerWrap: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
  },
  inputShell: {
    minHeight: 54,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
    fontSize: 16,
  },
  sendButton: {
    alignSelf: "flex-end",
    minWidth: 96,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
