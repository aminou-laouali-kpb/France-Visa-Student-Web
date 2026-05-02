import { useAuth } from "@clerk/react";
import { useEffect } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

let getter: (() => Promise<string | null>) | null = null;

export function useApiAuthSetup() {
  const { getToken, isLoaded } = useAuth();
  useEffect(() => {
    if (!isLoaded) return;
    getter = async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    };
    setAuthTokenGetter(() => (getter ? getter() : null));
    return () => {
      setAuthTokenGetter(null);
    };
  }, [getToken, isLoaded]);
}
