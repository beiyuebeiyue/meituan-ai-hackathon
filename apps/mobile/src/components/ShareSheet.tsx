import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../utils/theme";

type ShareSheetProps = {
  visible: boolean;
  onClose: () => void;
};

const SHARE_TARGETS = [
  { key: "wechat", label: "微信", mark: "微", background: "#1aad19" },
  { key: "douyin", label: "抖音", mark: "抖", background: "#111216" },
  { key: "xiaohongshu", label: "小红书", mark: "书", background: "#ff2442" },
] as const;

export function ShareSheet({ visible, onClose }: ShareSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, 12) + 10,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>分享到</Text>
          <View style={styles.targetRow}>
            {SHARE_TARGETS.map((target) => (
              <Pressable key={target.key} style={styles.target} onPress={onClose}>
                <View style={[styles.targetIcon, { backgroundColor: target.background }]}>
                  <Text style={styles.targetMark}>{target.mark}</Text>
                </View>
                <Text style={[styles.targetLabel, { color: colors.text }]}>{target.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
    gap: 14,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 999,
  },
  title: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
  },
  targetRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 2,
  },
  target: {
    width: 82,
    alignItems: "center",
    gap: 8,
  },
  targetIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  targetMark: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },
  targetLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
});
