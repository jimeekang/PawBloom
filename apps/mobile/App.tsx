import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { PetBloomShell } from "./src/presentation/PetBloomShell";
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
      <PetBloomShell />
      <StatusBar style="dark" />
    </QueryClientProvider>
  );
}
