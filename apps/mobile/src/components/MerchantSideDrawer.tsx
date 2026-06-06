import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "../utils/theme";

const brandLogo = require("../../assets/app/logo.png");

export type MerchantDrawerActionKey =
  | "market-data"
  | "booking-management"
  | "order-management"
  | "support"
  | "settings"
  | "scan";
export type ConsumerDrawerActionKey =
  | "orders"
  | "browse-history"
  | "tryon-history"
  | "hand-photos"
  | "blocked-users"
  | "support"
  | "settings"
  | "scan";

type DrawerIconName = ComponentProps<typeof Ionicons>["name"];
type DrawerActionItem<Key extends string> = {
  key: Key;
  icon: DrawerIconName;
  label: string;
  description?: string;
};
type DrawerActionGroup<Key extends string> = {
  title: string;
  items: Array<DrawerActionItem<Key>>;
};

const merchantDrawerGroups: Array<DrawerActionGroup<MerchantDrawerActionKey>> =
  [
    {
      title: "商家工作台",
      items: [
        {
          key: "market-data",
          icon: "bar-chart-outline",
          label: "市场数据",
          description: "查看商圈趋势和曝光表现",
        },
        {
          key: "booking-management",
          icon: "calendar-outline",
          label: "预约管理",
          description: "处理待确认预约",
        },
        {
          key: "order-management",
          icon: "receipt-outline",
          label: "订单管理",
          description: "跟进服务订单状态",
        },
      ],
    },
  ];

const consumerDrawerGroups: Array<DrawerActionGroup<ConsumerDrawerActionKey>> =
  [
    {
      title: "我的服务",
      items: [
        {
          key: "orders",
          icon: "receipt-outline",
          label: "我的订单",
          description: "预约意向和历史订单",
        },
        {
          key: "browse-history",
          icon: "time-outline",
          label: "浏览记录",
          description: "最近看过的美甲内容",
        },
        {
          key: "tryon-history",
          icon: "sparkles-outline",
          label: "AI 焕甲记录",
          description: "查看试戴生成结果",
        },
        {
          key: "hand-photos",
          icon: "hand-left-outline",
          label: "手图管理",
          description: "管理试戴用手部照片",
        },
        {
          key: "blocked-users",
          icon: "remove-circle-outline",
          label: "不再看她",
          description: "管理屏蔽的用户",
        },
      ],
    },
  ];

const merchantBottomActions: Array<DrawerActionItem<MerchantDrawerActionKey>> =
  [
    { key: "scan", icon: "scan-outline", label: "扫一扫" },
    { key: "support", icon: "headset-outline", label: "帮助与客服" },
    { key: "settings", icon: "settings-outline", label: "设置" },
  ];

const consumerBottomActions: Array<DrawerActionItem<ConsumerDrawerActionKey>> =
  [
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
  groups: Array<DrawerActionGroup<Key>>;
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
      Alert.alert("扫一扫", "扫一扫功能后续补充。");
      return;
    }
    if (key === "support") {
      Alert.alert("帮助与客服", "在线客服功能演示中，后续会接入真实客服。");
      return;
    }
    onAction(key);
  };

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={() => closeWithAction()}
    >
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
        <Pressable
          style={styles.overlayPressable}
          onPress={() => closeWithAction()}
        />
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
            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.drawerHeader}>
                <Image source={brandLogo} style={[styles.brandMark, { borderColor: colors.border }]} resizeMode="contain" />
                <View style={styles.drawerHeaderText}>
                  <Text style={[styles.drawerTitle, { color: colors.text }]}>
                    快捷入口
                  </Text>
                  <Text
                    style={[styles.drawerSubtitle, { color: colors.subtext }]}
                  >
                    管理你的焕甲服务
                  </Text>
                </View>
              </View>

              {groups.map((group) => (
                <View key={group.title} style={styles.group}>
                  <Text style={[styles.groupTitle, { color: colors.subtext }]}>
                    {group.title}
                  </Text>
                  <View
                    style={[
                      styles.groupCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {group.items.map((item, itemIndex) => (
                      <Pressable
                        key={item.key}
                        style={[
                          styles.item,
                          itemIndex < group.items.length - 1 && {
                            borderBottomColor: colors.border,
                            borderBottomWidth: StyleSheet.hairlineWidth,
                          },
                        ]}
                        onPress={() => handleAction(item.key)}
                      >
                        <View
                          style={[
                            styles.itemIconWrap,
                            { backgroundColor: colors.accentSoft },
                          ]}
                        >
                          <Ionicons
                            name={item.icon}
                            size={20}
                            color={colors.accent}
                          />
                        </View>
                        <View style={styles.itemBody}>
                          <Text
                            style={[styles.itemText, { color: colors.text }]}
                          >
                            {item.label}
                          </Text>
                          {item.description ? (
                            <Text
                              style={[
                                styles.itemDescription,
                                { color: colors.subtext },
                              ]}
                              numberOfLines={1}
                            >
                              {item.description}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={colors.subtext}
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.bottomRow}>
              {bottomActions.map((item) => (
                <Pressable
                  key={item.key}
                  style={[
                    styles.bottomButton,
                    { backgroundColor: colors.surface },
                  ]}
                  onPress={() => handleAction(item.key)}
                >
                  <Ionicons name={item.icon} size={24} color={colors.text} />
                  <Text style={[styles.bottomLabel, { color: colors.text }]}>
                    {item.label}
                  </Text>
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
    paddingTop: 26,
    paddingBottom: 24,
    gap: 18,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 18,
    paddingBottom: 10,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "#ffffff",
  },
  drawerHeaderText: {
    flex: 1,
    gap: 4,
  },
  drawerTitle: {
    fontSize: 21,
    fontWeight: "900",
  },
  drawerSubtitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  group: {
    gap: 8,
  },
  groupTitle: {
    paddingHorizontal: 4,
    fontSize: 12,
    fontWeight: "900",
  },
  groupCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  itemIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  itemBody: {
    flex: 1,
    gap: 3,
  },
  itemText: {
    fontSize: 16,
    fontWeight: "900",
  },
  itemDescription: {
    fontSize: 12,
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
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  bottomLabel: {
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
});
