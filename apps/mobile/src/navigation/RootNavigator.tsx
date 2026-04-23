import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarButtonProps, createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AskAIScreen } from "../screens/AskAIScreen";
import { BrowseScreen } from "../screens/BrowseScreen";
import { FavoritesScreen } from "../screens/FavoritesScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { MyPostsScreen } from "../screens/MyPostsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { PublishScreen } from "../screens/PublishScreen";
import { TryOnResultScreen } from "../screens/TryOnResultScreen";
import { palette } from "../utils/theme";

export type RootStackParamList = {
  MainTabs: undefined;
  Login: undefined;
  MyPosts: undefined;
  TryOnResult: { jobId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.subtext,
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
        name="Favorites"
        component={FavoritesScreen}
        options={{
          title: "收藏",
          tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="AskAI"
        component={AskAIScreen}
        options={{
          title: "Ask AI",
          tabBarButton: (props: BottomTabBarButtonProps) => (
            <Pressable
              onPress={props.onPress}
              accessibilityState={props.accessibilityState}
              accessibilityLabel={props.accessibilityLabel}
              testID={props.testID}
              style={styles.askButton}
            >
              <View style={styles.askButtonInner}>
                <Ionicons name="sparkles" size={24} color="white" />
              </View>
              <Text style={styles.askLabel}>Ask AI</Text>
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
  return (
    <Stack.Navigator>
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: "登录 / 注册" }} />
      <Stack.Screen name="MyPosts" component={MyPostsScreen} options={{ title: "我的发布" }} />
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
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.accent,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  askLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    color: palette.accent,
  },
});
