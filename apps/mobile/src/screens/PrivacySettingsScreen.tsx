import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { OverlayContent } from "../components/OverlayContent";
import { useThemeColors } from "../utils/theme";

export function PrivacySettingsScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();

  return (
    <OverlayContent.Scroll>
      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>黑名单</Text>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Pressable style={styles.blockRow} onPress={() => navigation.navigate("BlockedUsers")}>
          <View style={styles.blockLeft}>
            <View style={[styles.blockIcon, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="ban-outline" size={20} color={colors.text} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>查看黑名单用户</Text>
              <Text style={[styles.rowSubtitle, { color: colors.subtext }]}>管理你已拉黑的用户</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
        </Pressable>
      </View>
    </OverlayContent.Scroll>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: 22,
    overflow: "hidden",
  },
  row: {
    minHeight: 86,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 6,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  rowSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  blockRow: {
    minHeight: 78,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  blockLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  blockIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
