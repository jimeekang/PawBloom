import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { PawBloomShell } from "./src/presentation/PawBloomShell";
import { configureNetworkSync } from "./src/contexts/sync/application/syncStatus";

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
      <PawBloomShell />
      <StatusBar style="dark" />
    </QueryClientProvider>
  );
}
