import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarButtonProps, createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AskAIScreen } from "../screens/AskAIScreen";
import { AuthorProfileScreen } from "../screens/AuthorProfileScreen";
import { BrowseHistoryScreen } from "../screens/BrowseHistoryScreen";
import { BrowseSearchScreen } from "../screens/BrowseSearchScreen";
import { BrowseScreen } from "../screens/BrowseScreen";
import { DirectMessageScreen } from "../screens/DirectMessageScreen";
import { HandPhotoManagementScreen } from "../screens/HandPhotoManagementScreen";
import { FollowListScreen } from "../screens/FollowListScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { LoginHelpScreen } from "../screens/LoginHelpScreen";
import { MarketCityPickerScreen } from "../screens/MarketCityPickerScreen";
import { MarketScreen } from "../screens/MarketScreen";
import { MessagesInboxScreen } from "../screens/MessagesInboxScreen";
import { MyPostsScreen } from "../screens/MyPostsScreen";
import { ProfileEditScreen } from "../screens/ProfileEditScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ProfileSettingsScreen } from "../screens/ProfileSettingsScreen";
import { PrivacySettingsScreen } from "../screens/PrivacySettingsScreen";
import { BlockedUsersScreen } from "../screens/BlockedUsersScreen";
import { PublishScreen } from "../screens/PublishScreen";
import { StylePreviewScreen } from "../screens/StylePreviewScreen";
import { StrangerMessagesScreen } from "../screens/StrangerMessagesScreen";
import { TryOnHistoryScreen } from "../screens/TryOnHistoryScreen";
import { TryOnResultScreen } from "../screens/TryOnResultScreen";
import { useThemeColors } from "../utils/theme";

export type RootStackParamList = {
  MainTabs: undefined;
  Login: undefined;
  LoginHelp: undefined;
  BrowseHistory: undefined;
  BrowseSearch: undefined;
  MessagesInbox: undefined;
  StrangerMessages: undefined;
  TryOnHistory: undefined;
  HandPhotoManagement: undefined;
  MarketCityPicker: undefined;
  ProfileSettings: undefined;
  PrivacySettings: undefined;
  BlockedUsers: undefined;
  FollowList: { authorId: string; kind: "following" | "followers"; title: string };
  ProfileEdit: undefined;
  MyPosts: undefined;
  AuthorProfile: { authorId: string };
  DirectMessage: { userId: string };
  StylePreview: { styleId: string };
  TryOnResult: { jobId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const colors = useThemeColors();

  return (
    <Tab.Navigator
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
      <Tab.Screen
        name="Market"
        component={MarketScreen}
        options={{
          title: "市场",
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="AskAI"
        component={AskAIScreen}
        options={{
          title: "问问小嘉",
          tabBarButton: (props: BottomTabBarButtonProps) => (
            <Pressable
              onPress={props.onPress}
              accessibilityState={props.accessibilityState}
              accessibilityLabel={props.accessibilityLabel}
              testID={props.testID}
              style={styles.askButton}
            >
              <View style={[styles.askButtonInner, { backgroundColor: colors.accent, shadowColor: colors.accent }]}>
                <Ionicons name="sparkles" size={24} color="white" />
              </View>
              <Text style={[styles.askLabel, { color: colors.accent }]}>问问小嘉</Text>
            </Pressable>
          ),
        }}
      />
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
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="LoginHelp" component={LoginHelpScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="BrowseHistory"
        component={BrowseHistoryScreen}
        options={{
          headerShown: false,
          presentation: "containedTransparentModal",
          animation: "none",
          gestureEnabled: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen
        name="BrowseSearch"
        component={BrowseSearchScreen}
        options={{
          headerShown: false,
          presentation: "containedTransparentModal",
          animation: "none",
          gestureEnabled: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen
        name="MessagesInbox"
        component={MessagesInboxScreen}
        options={{
          headerShown: false,
          presentation: "containedTransparentModal",
          animation: "none",
          gestureEnabled: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen name="StrangerMessages" component={StrangerMessagesScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="TryOnHistory"
        component={TryOnHistoryScreen}
        options={{
          headerShown: false,
          presentation: "containedTransparentModal",
          animation: "none",
          gestureEnabled: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen
        name="HandPhotoManagement"
        component={HandPhotoManagementScreen}
        options={{
          headerShown: false,
          presentation: "containedTransparentModal",
          animation: "none",
          gestureEnabled: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen
        name="MarketCityPicker"
        component={MarketCityPickerScreen}
        options={{
          headerShown: false,
          presentation: "containedTransparentModal",
          animation: "none",
          gestureEnabled: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} options={{ title: "设置" }} />
      <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} options={{ title: "隐私设置" }} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ title: "黑名单" }} />
      <Stack.Screen name="FollowList" component={FollowListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ title: "编辑主页" }} />
      <Stack.Screen name="MyPosts" component={MyPostsScreen} options={{ title: "我的发布" }} />
      <Stack.Screen name="AuthorProfile" component={AuthorProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DirectMessage" component={DirectMessageScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="StylePreview"
        component={StylePreviewScreen}
        options={{
          headerShown: false,
          presentation: "containedTransparentModal",
          animation: "none",
          gestureEnabled: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen name="TryOnResult" component={TryOnResultScreen} options={{ title: "试戴结果" }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
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
