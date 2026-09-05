import { useEffect, useRef, useState } from "react";
import { Linking } from "react-native";

export function usePolicyLinks() {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  async function openExternalUrl(url: string) {
    const id = ++request.current;
    setFailedUrl(null);
    try {
      await Linking.openURL(url);
    } catch {
      // Older failures must not replace the latest successful attempt.
      if (request.current === id) setFailedUrl(url);
    }
  }
  return { failedUrl, openExternalUrl };
}
