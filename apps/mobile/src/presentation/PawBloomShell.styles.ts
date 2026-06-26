import { StyleSheet } from "react-native";
import { colors, layout } from "../design-system/tokens";

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  appFrame: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    backgroundColor: colors.appBackground,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.bottomNavHeight + 24,
  },
  homeScrollContent: {
    paddingTop: 0,
  },
});
