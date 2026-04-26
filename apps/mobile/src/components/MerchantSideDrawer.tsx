import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Dimensions, Easing, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../utils/theme";

export type MerchantDrawerActionKey = "market-data" | "booking-management" | "order-management" | "support" | "settings" | "scan";
export type ConsumerDrawerActionKey = "orders" | "browse-history" | "likes" | "tryon-history" | "hand-photos" | "support" | "settings" | "scan";

type DrawerIconName = ComponentProps<typeof Ionicons>["name"];
type DrawerActionItem<Key extends string> = { key: Key; icon: DrawerIconName; label: string };

const merchantDrawerGroups: Array<Array<DrawerActionItem<MerchantDrawerActionKey>>> = [
  [
    { key: "market-data", icon: "bar-chart-outline", label: "市场数据" },
    { key: "booking-management", icon: "calendar-outline", label: "预约管理" },
    { key: "order-management", icon: "receipt-outline", label: "订单管理" },
  ],
];

const consumerDrawerGroups: Array<Array<DrawerActionItem<ConsumerDrawerActionKey>>> = [
  [
    { key: "orders", icon: "receipt-outline", label: "我的订单" },
    { key: "browse-history", icon: "time-outline", label: "浏览记录" },
    { key: "likes", icon: "heart-outline", label: "喜爱" },
    { key: "tryon-history", icon: "sparkles-outline", label: "AI 焕甲记录" },
    { key: "hand-photos", icon: "hand-left-outline", label: "手图管理" },
  ],
];

const merchantBottomActions: Array<DrawerActionItem<MerchantDrawerActionKey>> = [
  { key: "scan", icon: "scan-outline", label: "扫一扫" },
  { key: "support", icon: "headset-outline", label: "帮助与客服" },
  { key: "settings", icon: "settings-outline", label: "设置" },
];

const consumerBottomActions: Array<DrawerActionItem<ConsumerDrawerActionKey>> = [
  { key: "scan", icon: "scan-outline", label: "扫一扫" },
  { key: "support", icon: "headset-outline", label: "帮助与客服" },
  { key: "settings", icon: "settings-outline", label: "设置" },
];

export function MerchantSideDrawer({
  visible,
  onClose,
  onAction,
}: {
  visible: boolean;
  onClose: () => void;
  onAction: (key: MerchantDrawerActionKey) => void;
}) {
  return (
    <AppSideDrawer
      visible={visible}
      onClose={onClose}
      onAction={onAction}
      groups={merchantDrawerGroups}
      bottomActions={merchantBottomActions}
    />
  );
}

export function ConsumerSideDrawer({
  visible,
  onClose,
  onAction,
}: {
  visible: boolean;
  onClose: () => void;
  onAction: (key: ConsumerDrawerActionKey) => void;
}) {
  return (
    <AppSideDrawer
      visible={visible}
      onClose={onClose}
      onAction={onAction}
      groups={consumerDrawerGroups}
      bottomActions={consumerBottomActions}
    />
  );
}

function AppSideDrawer<Key extends string>({
  visible,
  onClose,
  onAction,
  groups,
  bottomActions,
}: {
  visible: boolean;
  onClose: () => void;
  onAction: (key: Key) => void;
  groups: Array<Array<DrawerActionItem<Key>>>;
  bottomActions: Array<DrawerActionItem<Key>>;
}) {
  const colors = useThemeColors();
  const [mounted, setMounted] = useState(visible);
  const drawerWidth = Math.min(Dimensions.get("window").width * 0.82, 360);
  const progress = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      closingRef.current = false;
      setMounted(true);
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    if (!mounted || closingRef.current) return;
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [mounted, progress, visible]);

  const closeWithAction = (action?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setMounted(false);
      onClose();
      action?.();
    });
  };

  const handleAction = (key: Key) => {
    if (key === "scan") {
      closeWithAction(() => Alert.alert("扫一扫", "扫一扫功能后续补充。"));
      return;
    }
    if (key === "support") {
      closeWithAction(() => Alert.alert("帮助与客服", "在线客服功能演示中，后续会接入真实客服。"));
      return;
    }
    closeWithAction(() => onAction(key));
  };

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={() => closeWithAction()}>
      <View style={styles.root}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.overlay,
            {
              opacity: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        />
        <Pressable style={styles.overlayPressable} onPress={() => closeWithAction()} />
        <Animated.View
          style={[
            styles.panel,
            {
              width: drawerWidth,
              backgroundColor: colors.navBackground,
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-drawerWidth, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              {groups.map((group, index) => (
                <View key={`group-${index}`} style={[styles.group, { backgroundColor: colors.surface }]}>
                  {group.map((item) => (
                    <Pressable key={item.key} style={styles.item} onPress={() => handleAction(item.key)}>
                      <Ionicons name={item.icon} size={24} color={colors.text} style={styles.itemIcon} />
                      <Text style={[styles.itemText, { color: colors.text }]}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>

            <View style={styles.bottomRow}>
              {bottomActions.map((item) => (
                <Pressable key={item.key} style={[styles.bottomButton, { backgroundColor: colors.surface }]} onPress={() => handleAction(item.key)}>
                  <Ionicons name={item.icon} size={24} color={colors.text} />
                  <Text style={[styles.bottomLabel, { color: colors.text }]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-start",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 7, 11, 0.55)",
  },
  overlayPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    paddingRight: 14,
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 72,
    paddingBottom: 24,
    gap: 14,
  },
  group: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 18,
  },
  itemIcon: {
    width: 26,
    textAlign: "center",
  },
  itemText: {
    fontSize: 18,
    fontWeight: "600",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 18,
    gap: 12,
  },
  bottomButton: {
    flex: 1,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  bottomLabel: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
