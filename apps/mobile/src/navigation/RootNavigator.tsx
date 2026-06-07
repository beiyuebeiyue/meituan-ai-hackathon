import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigatorScreenParams, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { type ComponentType } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AIButton } from "../components/navigation/AIButton";
import { OverlayContent } from "../components/OverlayContent";
import {
  SlideDirection,
  SlideOverlayScreen,
} from "../components/SlideOverlayScreen";
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
import { MerchantMarketDataScreen } from "../screens/MerchantMarketDataScreen";
import { MerchantOrdersScreen } from "../screens/MerchantOrdersScreen";
import { MerchantShopScreen } from "../screens/MerchantShopScreen";
import { MerchantTrendNotificationsScreen } from "../screens/MerchantTrendNotificationsScreen";
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
import { WearableOrderScreen } from "../screens/WearableOrderScreen";
import { WearableStoreScreen } from "../screens/WearableStoreScreen";
import { useAuthStore } from "../store/useAuthStore";
import type { NearbyShop } from "../types/api";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

export type OverlayEntryParams = { entryEdge?: SlideDirection };

export type MainTabParamList = {
  Browse: undefined;
  Market: undefined;
  MerchantBookings: undefined;
  Publish: undefined;
  AskAI: undefined;
  MerchantOverview: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
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
  MerchantTrendNotifications: OverlayEntryParams | undefined;
  ProfileSettings: OverlayEntryParams | undefined;
  PrivacySettings: OverlayEntryParams | undefined;
  ProfileInfo: OverlayEntryParams | undefined;
  BlockedUsers: OverlayEntryParams | undefined;
  FollowList: {
    authorId: string;
    kind: "following" | "followers";
    title: string;
  } & OverlayEntryParams;
  ProfileEdit: OverlayEntryParams | undefined;
  MyPosts: OverlayEntryParams | undefined;
  AuthorProfile: {
    authorId: string;
    initialTab?: "posts" | "comments" | "liked";
  } & OverlayEntryParams;
  DirectMessage: {
    userId: string;
    initialStyleId?: string;
    initialTryOnJobId?: string;
    initialMessage?: string;
  } & OverlayEntryParams;
  StylePreview: { styleId: string } & OverlayEntryParams;
  TryOnResult: { jobId: string } & OverlayEntryParams;
  WearableStore: { styleId: string } & OverlayEntryParams;
  WearableOrder: { styleId: string } & OverlayEntryParams;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();
const TAB_BG = "#111116";
const TAB_TEXT = "#f2f2f4";
const TAB_MUTED = "#8f8f98";
const TAB_LIGHT_BG = "#ffffff";
const TAB_LIGHT_TEXT = "#111111";
const TAB_LIGHT_MUTED = "#777777";
const TAB_LIGHT_BORDER = "#eeeeee";

const overlayOptions = {
  headerShown: false,
  presentation: "containedTransparentModal" as const,
  animation: "none" as const,
  gestureEnabled: false,
  contentStyle: { backgroundColor: "transparent" },
};

function createOverlayComponent(
  Component: ComponentType<any>,
  options: {
    defaultEdge?: SlideDirection;
    title?: string;
    showHeader?: boolean;
  } = {},
) {
  function OverlayComponent(props: any) {
    const colors = useThemeColors();
    const direction = (props.route?.params?.entryEdge ??
      options.defaultEdge ??
      "right") as SlideDirection;

    return (
      <SlideOverlayScreen
        backgroundColor={colors.background}
        direction={direction}
        onDismiss={() => props.navigation.goBack()}
      >
        {(dismiss) =>
          options.showHeader ? (
            <SafeAreaView
              style={[
                styles.overlayContainer,
                { backgroundColor: colors.background },
              ]}
            >
              <OverlayContent.Header
                title={options.title ?? ""}
                onBack={dismiss}
              />
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
const ConsumerLikesOverlayScreen = createOverlayComponent(ConsumerLikesScreen, {
  showHeader: true,
  title: "喜爱",
});
const ConsumerOrdersOverlayScreen = createOverlayComponent(
  ConsumerOrdersScreen,
  { showHeader: true, title: "我的订单" },
);
const StrangerMessagesOverlayScreen = createOverlayComponent(
  StrangerMessagesScreen,
);
const ProfileSettingsOverlayScreen = createOverlayComponent(
  ProfileSettingsScreen,
  { showHeader: true, title: "设置" },
);
const ProfileInfoOverlayScreen = createOverlayComponent(ProfileInfoScreen, {
  showHeader: true,
  title: "个人信息",
});
const MerchantMarketDataOverlayScreen = createOverlayComponent(
  MerchantMarketDataScreen,
  { showHeader: true, title: "市场数据" },
);
const MerchantOrdersOverlayScreen = createOverlayComponent(
  MerchantOrdersScreen,
  { showHeader: true, title: "订单管理" },
);
const MerchantShopOverlayScreen = createOverlayComponent(MerchantShopScreen, {
  showHeader: true,
  title: "店铺资料",
});
const MerchantTrendNotificationsOverlayScreen = createOverlayComponent(
  MerchantTrendNotificationsScreen,
  { showHeader: true, title: "热门手工甲" },
);
const PrivacySettingsOverlayScreen = createOverlayComponent(
  PrivacySettingsScreen,
  { showHeader: true, title: "隐私设置" },
);
const BlockedUsersOverlayScreen = createOverlayComponent(BlockedUsersScreen, {
  showHeader: true,
  title: "不再看她",
});
const FollowListOverlayScreen = createOverlayComponent(FollowListScreen);
const ProfileEditOverlayScreen = createOverlayComponent(ProfileEditScreen, {
  showHeader: true,
  title: "编辑商户信息",
});
const MyPostsOverlayScreen = createOverlayComponent(MyPostsScreen, {
  showHeader: true,
  title: "我的发布",
});
const AuthorProfileOverlayScreen = createOverlayComponent(AuthorProfileScreen);
const DirectMessageOverlayScreen = createOverlayComponent(DirectMessageScreen);
const TryOnResultOverlayScreen = createOverlayComponent(TryOnResultScreen, {
  showHeader: true,
  title: "试戴结果",
});
const WearableStoreOverlayScreen = createOverlayComponent(WearableStoreScreen, {
  showHeader: true,
  title: "焕甲生活超市",
});
const WearableOrderOverlayScreen = createOverlayComponent(WearableOrderScreen, {
  showHeader: true,
  title: "确认下单",
});
const MarketMapOverlayScreen = createOverlayComponent(MarketMapScreen);
const MarketShopDetailOverlayScreen = createOverlayComponent(
  MarketShopDetailScreen,
);

function MainTabs() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const isDarkMode = useIsDarkMode();
  const user = useAuthStore((state) => state.user);
  const isMerchant = user?.role === "merchant";
  const tabBackground = isDarkMode ? TAB_BG : TAB_LIGHT_BG;
  const tabActiveColor = isDarkMode ? TAB_TEXT : TAB_LIGHT_TEXT;
  const tabInactiveColor = isDarkMode ? TAB_MUTED : TAB_LIGHT_MUTED;
  const tabBorderColor = isDarkMode ? "transparent" : TAB_LIGHT_BORDER;

  return (
    <>
      <Tab.Navigator
        key={isMerchant ? "merchant-tabs" : "consumer-tabs"}
        screenOptions={{
          headerShown: false,
          tabBarStyle: [
            styles.tabBar,
            {
              height: 64 + insets.bottom,
              paddingBottom: Math.max(insets.bottom, 8),
              backgroundColor: tabBackground,
              borderTopColor: tabBorderColor,
            },
          ],
          tabBarActiveTintColor: tabActiveColor,
          tabBarInactiveTintColor: tabInactiveColor,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarItemStyle: styles.tabBarItem,
        }}
      >
        <Tab.Screen
          name="Browse"
          component={BrowseScreen}
          options={{
            title: "首页",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Market"
          component={MarketScreen}
          options={{
            title: "店铺",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="storefront-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="AskAI"
          component={AskAIScreen}
          options={{
            title: "问问小嘉",
            tabBarButton: (props) => (
              <AIButton
                label="问问小嘉"
                focused={Boolean(props.accessibilityState?.selected)}
                status="idle"
                onPress={props.onPress ?? undefined}
                onLongPress={props.onLongPress ?? undefined}
                accessibilityLabel={props.accessibilityLabel}
                testID={props.testID}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Publish"
          component={PublishScreen}
          options={{
            title: "发布",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="add-circle-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: "我的",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
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
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Login"
        component={LoginOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="LoginHelp"
        component={LoginHelpOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="BrowseHistory"
        component={BrowseHistoryScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="BrowseSearch"
        component={BrowseSearchScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="Hashtag"
        component={HashtagScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="ConsumerLikes"
        component={ConsumerLikesOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="ConsumerOrders"
        component={ConsumerOrdersOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="MessagesInbox"
        component={MessagesInboxScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="StrangerMessages"
        component={StrangerMessagesOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="TryOnHistory"
        component={TryOnHistoryScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="HandPhotoManagement"
        component={HandPhotoManagementScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="MarketCityPicker"
        component={MarketCityPickerScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="MarketMap"
        component={MarketMapOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="MarketShopDetail"
        component={MarketShopDetailOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="MerchantMarketData"
        component={MerchantMarketDataOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="MerchantOrders"
        component={MerchantOrdersOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="MerchantShop"
        component={MerchantShopOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="MerchantTrendNotifications"
        component={MerchantTrendNotificationsOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="ProfileSettings"
        component={ProfileSettingsOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="ProfileInfo"
        component={ProfileInfoOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="PrivacySettings"
        component={PrivacySettingsOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="BlockedUsers"
        component={BlockedUsersOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="FollowList"
        component={FollowListOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="ProfileEdit"
        component={ProfileEditOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="MyPosts"
        component={MyPostsOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="AuthorProfile"
        component={AuthorProfileOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="DirectMessage"
        component={DirectMessageOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="StylePreview"
        component={StylePreviewScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="TryOnResult"
        component={TryOnResultOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="WearableStore"
        component={WearableStoreOverlayScreen}
        options={overlayOptions}
      />
      <Stack.Screen
        name="WearableOrder"
        component={WearableOrderOverlayScreen}
        options={overlayOptions}
      />
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
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: "visible",
  },
  tabBarItem: {
    paddingTop: 3,
  },
  tabBarLabel: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
});
