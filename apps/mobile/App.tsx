import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppIcon } from "./src/design-system/iconography";
import { AuthProvider, useAuth } from "./src/contexts/identity/application/authContext";
import { PawBloomShell } from "./src/presentation/PawBloomShell";
import { AuthScreen } from "./src/contexts/identity/ui/AuthScreen";
import { PasswordRecoveryScreen } from "./src/contexts/identity/ui/PasswordRecoveryScreen";
import { PetOnboardingScreen } from "./src/presentation/screens/PetOnboardingScreen";
import { configureNetworkSync } from "./src/contexts/sync/application/syncStatus";
import { colors, type as typeStyle } from "./src/design-system/tokens";
import { LanguageProvider, useLanguage } from "./src/i18n/languageContext";
import { t } from "./src/i18n/translations";
import { NoticeBanner, PrimaryButton, SecondaryButton } from "./src/design-system/components";
import { confirmAndSignOut } from "./src/contexts/identity/ui/signOutConfirm";
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
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AuthProvider>
            <AppBody />
          </AuthProvider>
        </LanguageProvider>
        <StatusBar style="dark" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function AppBody() {
  const { initialized, configured, user, activePet, petLoadStatus, passwordRecoveryActive, retryPetLoad, signOut, error } = useAuth();
  const { initialized: languageInitialized } = useLanguage();
  const gate = resolveAppGate({
    authInitialized: initialized,
    languageInitialized,
    configured,
    userPresent: Boolean(user),
    passwordRecoveryActive,
    petLoadStatus,
    activePetPresent: Boolean(activePet),
  });

  if (gate === "loading") {
    return (
      <SafeAreaView style={styles.loadingArea}>
        <View style={styles.loadingWrap}>
          <AppIcon name="shield" size={40} color={colors.orangeDeep} />
          <Text style={styles.loadingText}>{t("app.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (gate === "preview") return <PawBloomShell />;
  if (gate === "auth") return <AuthScreen />;
  if (gate === "password-recovery") return <PasswordRecoveryScreen />;
  if (gate === "pet-load-error") {
    return (
      <SafeAreaView style={styles.loadingArea}>
        <View style={styles.loadingWrap}>
          <AppIcon name="close" size={40} color={colors.coral} />
          <Text style={styles.loadingText}>{t("pet.loadFailed")}</Text>
          {error ? <NoticeBanner text={t(error)} icon="close" tone="error" /> : null}
          <View style={styles.retryActions}>
            <PrimaryButton label={t("pet.retryLoad")} onPress={retryPetLoad} />
            <SecondaryButton label={t("auth.signOut")} onPress={() => void confirmAndSignOut(signOut)} />
          </View>
        </View>
      </SafeAreaView>
    );
  }
  if (gate === "pet-onboarding") {
    return (
      <SafeAreaView style={styles.loadingArea}>
        <PetOnboardingScreen />
      </SafeAreaView>
    );
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
    textAlign: "center",
  },
  retryActions: {
    width: "80%",
    maxWidth: 320,
    gap: 10,
  },
});
