import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarButtonProps, createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect, useRef, type ComponentType } from "react";
import { Animated, Easing, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { OverlayContent } from "../components/OverlayContent";
import { SlideDirection, SlideOverlayScreen } from "../components/SlideOverlayScreen";
import { WeeklyHotNailsModal } from "../components/WeeklyHotNailsModal";
import { AskAIScreen } from "../screens/AskAIScreen";
import { AuthorProfileScreen } from "../screens/AuthorProfileScreen";
import { BrowseHistoryScreen } from "../screens/BrowseHistoryScreen";
import { BrowseSearchScreen } from "../screens/BrowseSearchScreen";
import { BrowseScreen } from "../screens/BrowseScreen";
import { ConsumerLikesScreen } from "../screens/ConsumerLikesScreen";
import { ConsumerOrdersScreen } from "../screens/ConsumerOrdersScreen";
import { DirectMessageScreen } from "../screens/DirectMessageScreen";
import { HandPhotoManagementScreen } from "../screens/HandPhotoManagementScreen";
import { HashtagScreen } from "../screens/HashtagScreen";
import { FollowListScreen } from "../screens/FollowListScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { LoginHelpScreen } from "../screens/LoginHelpScreen";
import { MarketCityPickerScreen } from "../screens/MarketCityPickerScreen";
import { MarketMapScreen } from "../screens/MarketMapScreen";
import { MarketScreen } from "../screens/MarketScreen";
import { MarketShopDetailScreen } from "../screens/MarketShopDetailScreen";
import { MerchantBookingsScreen } from "../screens/MerchantBookingsScreen";
import { MerchantMarketDataScreen } from "../screens/MerchantMarketDataScreen";
import { MerchantOrdersScreen } from "../screens/MerchantOrdersScreen";
import { MerchantOverviewScreen } from "../screens/MerchantOverviewScreen";
import { MerchantShopScreen } from "../screens/MerchantShopScreen";
import { MessagesInboxScreen } from "../screens/MessagesInboxScreen";
import { MyPostsScreen } from "../screens/MyPostsScreen";
import { ProfileEditScreen } from "../screens/ProfileEditScreen";
import { ProfileInfoScreen } from "../screens/ProfileInfoScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ProfileSettingsScreen } from "../screens/ProfileSettingsScreen";
import { PrivacySettingsScreen } from "../screens/PrivacySettingsScreen";
import { BlockedUsersScreen } from "../screens/BlockedUsersScreen";
import { PublishScreen } from "../screens/PublishScreen";
import { StylePreviewScreen } from "../screens/StylePreviewScreen";
import { StrangerMessagesScreen } from "../screens/StrangerMessagesScreen";
import { TryOnHistoryScreen } from "../screens/TryOnHistoryScreen";
import { TryOnResultScreen } from "../screens/TryOnResultScreen";
import { useAuthStore } from "../store/useAuthStore";
import type { NearbyShop } from "../types/api";
import { useThemeColors } from "../utils/theme";

export type OverlayEntryParams = { entryEdge?: SlideDirection };

export type RootStackParamList = {
  MainTabs: undefined;
  Login: OverlayEntryParams | undefined;
  LoginHelp: OverlayEntryParams | undefined;
  BrowseHistory: OverlayEntryParams | undefined;
  BrowseSearch: (OverlayEntryParams & { initialQuery?: string }) | undefined;
  Hashtag: { tag: string } & OverlayEntryParams;
  ConsumerLikes: OverlayEntryParams | undefined;
  ConsumerOrders: OverlayEntryParams | undefined;
  MessagesInbox: OverlayEntryParams | undefined;
  StrangerMessages: OverlayEntryParams | undefined;
  TryOnHistory: OverlayEntryParams | undefined;
  HandPhotoManagement: OverlayEntryParams | undefined;
  MarketCityPicker: OverlayEntryParams | undefined;
  MarketMap: OverlayEntryParams | undefined;
  MarketShopDetail: ({ shop: NearbyShop } & OverlayEntryParams) | undefined;
  MerchantMarketData: OverlayEntryParams | undefined;
  MerchantOrders: OverlayEntryParams | undefined;
  MerchantShop: OverlayEntryParams | undefined;
  ProfileSettings: OverlayEntryParams | undefined;
  PrivacySettings: OverlayEntryParams | undefined;
  ProfileInfo: OverlayEntryParams | undefined;
  BlockedUsers: OverlayEntryParams | undefined;
  FollowList: { authorId: string; kind: "following" | "followers"; title: string } & OverlayEntryParams;
  ProfileEdit: OverlayEntryParams | undefined;
  MyPosts: OverlayEntryParams | undefined;
  AuthorProfile: { authorId: string; initialTab?: "posts" | "comments" | "liked" } & OverlayEntryParams;
  DirectMessage: { userId: string } & OverlayEntryParams;
  StylePreview: { styleId: string } & OverlayEntryParams;
  TryOnResult: { jobId: string } & OverlayEntryParams;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const overlayOptions = {
  headerShown: false,
  presentation: "containedTransparentModal" as const,
  animation: "none" as const,
  gestureEnabled: false,
  contentStyle: { backgroundColor: "transparent" },
};

function createOverlayComponent(
  Component: ComponentType<any>,
  options: { defaultEdge?: SlideDirection; title?: string; showHeader?: boolean } = {},
) {
  function OverlayComponent(props: any) {
    const colors = useThemeColors();
    const direction = (props.route?.params?.entryEdge ?? options.defaultEdge ?? "right") as SlideDirection;

    return (
      <SlideOverlayScreen backgroundColor={colors.background} direction={direction} onDismiss={() => props.navigation.goBack()}>
        {(dismiss) =>
          options.showHeader ? (
            <SafeAreaView style={[styles.overlayContainer, { backgroundColor: colors.background }]}>
              <OverlayContent.Header title={options.title ?? ""} onBack={dismiss} />
              <View style={styles.overlayBody}>
                <Component {...props} />
              </View>
            </SafeAreaView>
          ) : (
            <Component {...props} />
          )
        }
      </SlideOverlayScreen>
    );
  }
  OverlayComponent.displayName = `Overlay(${Component.displayName ?? Component.name ?? "Screen"})`;
  return OverlayComponent;
}

const LoginOverlayScreen = createOverlayComponent(LoginScreen);
const LoginHelpOverlayScreen = createOverlayComponent(LoginHelpScreen);
const ConsumerLikesOverlayScreen = createOverlayComponent(ConsumerLikesScreen, { showHeader: true, title: "喜爱" });
const ConsumerOrdersOverlayScreen = createOverlayComponent(ConsumerOrdersScreen, { showHeader: true, title: "我的订单" });
const StrangerMessagesOverlayScreen = createOverlayComponent(StrangerMessagesScreen);
const ProfileSettingsOverlayScreen = createOverlayComponent(ProfileSettingsScreen, { showHeader: true, title: "设置" });
const ProfileInfoOverlayScreen = createOverlayComponent(ProfileInfoScreen, { showHeader: true, title: "个人信息" });
const MerchantMarketDataOverlayScreen = createOverlayComponent(MerchantMarketDataScreen, { showHeader: true, title: "市场数据" });
const MerchantOrdersOverlayScreen = createOverlayComponent(MerchantOrdersScreen, { showHeader: true, title: "订单管理" });
const MerchantShopOverlayScreen = createOverlayComponent(MerchantShopScreen, { showHeader: true, title: "店铺资料" });
const PrivacySettingsOverlayScreen = createOverlayComponent(PrivacySettingsScreen, { showHeader: true, title: "隐私设置" });
const BlockedUsersOverlayScreen = createOverlayComponent(BlockedUsersScreen, { showHeader: true, title: "不再看她" });
const FollowListOverlayScreen = createOverlayComponent(FollowListScreen);
const ProfileEditOverlayScreen = createOverlayComponent(ProfileEditScreen, { showHeader: true, title: "编辑商户信息" });
const MyPostsOverlayScreen = createOverlayComponent(MyPostsScreen, { showHeader: true, title: "我的发布" });
const AuthorProfileOverlayScreen = createOverlayComponent(AuthorProfileScreen);
const DirectMessageOverlayScreen = createOverlayComponent(DirectMessageScreen);
const TryOnResultOverlayScreen = createOverlayComponent(TryOnResultScreen, { showHeader: true, title: "试戴结果" });
const MarketMapOverlayScreen = createOverlayComponent(MarketMapScreen);
const MarketShopDetailOverlayScreen = createOverlayComponent(MarketShopDetailScreen);

function CenterTabButton({
  props,
  icon,
  label,
  colors,
}: {
  props: BottomTabBarButtonProps;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const selected = Boolean(props.accessibilityState?.selected);
  const pressScale = useRef(new Animated.Value(1)).current;
  const haloScale = useRef(new Animated.Value(1)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!selected) {
      haloScale.stopAnimation();
      haloOpacity.stopAnimation();
      haloScale.setValue(1);
      haloOpacity.setValue(0);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(haloScale, {
            toValue: 1.32,
            duration: 1100,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(haloOpacity, {
            toValue: 0,
            duration: 1100,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(haloScale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(haloOpacity, {
            toValue: 0.28,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    haloOpacity.setValue(0.28);
    pulse.start();
    return () => pulse.stop();
  }, [haloOpacity, haloScale, selected]);

  const animatePress = (toValue: number) => {
    Animated.spring(pressScale, {
      toValue,
      damping: 12,
      mass: 0.55,
      stiffness: 260,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={props.onPress}
      onPressIn={() => animatePress(0.92)}
      onPressOut={() => animatePress(1)}
      accessibilityState={props.accessibilityState}
      accessibilityLabel={props.accessibilityLabel}
      testID={props.testID}
      style={styles.askButton}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.askHalo,
          {
            backgroundColor: colors.accent,
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          },
        ]}
      />
      <Animated.View style={[styles.askButtonInner, { backgroundColor: colors.accent, shadowColor: colors.accent, transform: [{ scale: pressScale }] }]}>
        <Ionicons name={icon} size={icon === "add" ? 30 : 25} color="white" />
      </Animated.View>
      <Text style={[styles.askLabel, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

function MainTabs() {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);
  const isMerchant = user?.role === "merchant";

  return (
    <>
      <Tab.Navigator
        key={isMerchant ? "merchant-tabs" : "consumer-tabs"}
        screenOptions={{
          headerShown: false,
          tabBarStyle: [styles.tabBar, { backgroundColor: colors.navBackground }],
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.navInactive,
        }}
      >
        <Tab.Screen
          name="Browse"
          component={BrowseScreen}
          options={{
            title: "浏览",
            tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
          }}
        />
        {isMerchant ? (
          <Tab.Screen
            name="MerchantBookings"
            component={MerchantBookingsScreen}
            options={{
              title: "预约",
              tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
            }}
          />
        ) : (
          <Tab.Screen
            name="Market"
            component={MarketScreen}
            options={{
              title: "市场",
              tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color} />,
            }}
          />
        )}
        {isMerchant ? (
          <Tab.Screen
            name="MerchantOverview"
            component={MerchantOverviewScreen}
            options={{
              title: "后台",
              tabBarButton: (props) => <CenterTabButton props={props} icon="analytics-outline" label="后台" colors={colors} />,
            }}
          />
        ) : (
          <Tab.Screen
            name="AskAI"
            component={AskAIScreen}
            options={{
              title: "问问小嘉",
              tabBarButton: (props) => <CenterTabButton props={props} icon="sparkles" label="问问小嘉" colors={colors} />,
            }}
          />
        )}
        <Tab.Screen
          name="Publish"
          component={PublishScreen}
          options={{
            title: "发布",
            tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: "我的",
            tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          }}
        />
      </Tab.Navigator>
      <WeeklyHotNailsModal
        enabled={isMerchant}
        merchantUid={user?.uid}
        onStylePress={(styleId) => {
          navigation.navigate("StylePreview", { styleId });
        }}
      />
    </>
  );
}

export function RootNavigator() {
  const colors = useThemeColors();

  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerBackTitle: "返回",
        headerTitleStyle: { color: colors.text, fontWeight: "700" },
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="LoginHelp" component={LoginHelpOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="BrowseHistory" component={BrowseHistoryScreen} options={overlayOptions} />
      <Stack.Screen name="BrowseSearch" component={BrowseSearchScreen} options={overlayOptions} />
      <Stack.Screen name="Hashtag" component={HashtagScreen} options={overlayOptions} />
      <Stack.Screen name="ConsumerLikes" component={ConsumerLikesOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="ConsumerOrders" component={ConsumerOrdersOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="MessagesInbox" component={MessagesInboxScreen} options={overlayOptions} />
      <Stack.Screen name="StrangerMessages" component={StrangerMessagesOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="TryOnHistory" component={TryOnHistoryScreen} options={overlayOptions} />
      <Stack.Screen name="HandPhotoManagement" component={HandPhotoManagementScreen} options={overlayOptions} />
      <Stack.Screen name="MarketCityPicker" component={MarketCityPickerScreen} options={overlayOptions} />
      <Stack.Screen name="MarketMap" component={MarketMapOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="MarketShopDetail" component={MarketShopDetailOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="MerchantMarketData" component={MerchantMarketDataOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="MerchantOrders" component={MerchantOrdersOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="MerchantShop" component={MerchantShopOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="ProfileSettings" component={ProfileSettingsOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="ProfileInfo" component={ProfileInfoOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="PrivacySettings" component={PrivacySettingsOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="FollowList" component={FollowListOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="MyPosts" component={MyPostsOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="AuthorProfile" component={AuthorProfileOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="DirectMessage" component={DirectMessageOverlayScreen} options={overlayOptions} />
      <Stack.Screen name="StylePreview" component={StylePreviewScreen} options={overlayOptions} />
      <Stack.Screen name="TryOnResult" component={TryOnResultOverlayScreen} options={overlayOptions} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
  },
  overlayBody: {
    flex: 1,
  },
  tabBar: {
    height: 88,
    paddingBottom: 12,
    paddingTop: 8,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopWidth: 0,
  },
  askButton: {
    alignItems: "center",
    marginTop: -18,
    position: "relative",
  },
  askHalo: {
    position: "absolute",
    top: 0,
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  askButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  askLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
  },
});
