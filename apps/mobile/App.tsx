import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "./src/design-system/iconography";
import { AuthProvider, useAuth } from "./src/contexts/identity/application/authContext";
import { PawBloomShell } from "./src/presentation/PawBloomShell";
import { AuthScreen } from "./src/contexts/identity/ui/AuthScreen";
import { PetOnboardingScreen } from "./src/presentation/screens/PetOnboardingScreen";
import { configureNetworkSync } from "./src/contexts/sync/application/syncStatus";
import { colors, type as typeStyle } from "./src/design-system/tokens";
import { LanguageProvider, useLanguage } from "./src/i18n/languageContext";
import { t } from "./src/i18n/translations";

configureNetworkSync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <AppBody />
        </AuthProvider>
      </LanguageProvider>
      <StatusBar style="dark" />
    </QueryClientProvider>
  );
}

function AppBody() {
  const { initialized, configured, user, activePet } = useAuth();
  const { initialized: languageInitialized } = useLanguage();

  if (!initialized || !languageInitialized) {
    return (
      <SafeAreaView style={styles.loadingArea}>
        <View style={styles.loadingWrap}>
          <AppIcon name="shield" size={40} color={colors.orangeDeep} />
          <Text style={styles.loadingText}>{t("ko", "app.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!configured) {
    return <PawBloomShell />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!activePet) {
    return <PetOnboardingScreen />;
  }

  return <PawBloomShell />;
}

const styles = StyleSheet.create({
  loadingArea: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    ...typeStyle.sectionTitle,
    color: colors.text,
  },
});
