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
import { PrimaryButton, SecondaryButton } from "./src/design-system/components";
import { resolveAppGate } from "./src/presentation/appGate";
import { configureLocalNotificationPresentation } from "./src/shared-kernel/notifications/localNotificationBootstrap";

configureNetworkSync();
void configureLocalNotificationPresentation();

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
  const { initialized, configured, user, activePet, petLoadStatus, retryPetLoad, signOut } = useAuth();
  const { initialized: languageInitialized } = useLanguage();
  const gate = resolveAppGate({
    authInitialized: initialized,
    languageInitialized,
    configured,
    userPresent: Boolean(user),
    petLoadStatus,
    activePetPresent: Boolean(activePet),
  });

  if (gate === "loading") {
    return (
      <SafeAreaView style={styles.loadingArea}>
        <View style={styles.loadingWrap}>
          <AppIcon name="shield" size={40} color={colors.orangeDeep} />
          <Text style={styles.loadingText}>{t("ko", "app.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (gate === "preview") return <PawBloomShell />;
  if (gate === "auth") return <AuthScreen />;
  if (gate === "pet-load-error") {
    return (
      <SafeAreaView style={styles.loadingArea}>
        <View style={styles.loadingWrap}>
          <AppIcon name="close" size={40} color={colors.coral} />
          <Text style={styles.loadingText}>{t("ko", "pet.loadFailed")}</Text>
          <View style={styles.retryActions}>
            <PrimaryButton label={t("ko", "pet.retryLoad")} onPress={retryPetLoad} />
            <SecondaryButton label={t("ko", "auth.signOut")} onPress={() => void signOut()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }
  if (gate === "pet-onboarding") return <PetOnboardingScreen />;
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
    textAlign: "center",
  },
  retryActions: {
    width: "80%",
    maxWidth: 320,
    gap: 10,
  },
});
