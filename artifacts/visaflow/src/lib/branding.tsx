import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { tenantApi, type BrandingPublic } from "./billing";

export function useBranding() {
  return useQuery<BrandingPublic | null>({
    queryKey: ["tenant", "branding"],
    queryFn: () => tenantApi.branding(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Applies the tenant's primary colour as a CSS custom property on <html> so
 * Tailwind utility classes that reference `--brand-primary` (e.g. badge
 * highlights, the sidebar logo background) re-tint themselves automatically.
 */
export function BrandingTheme({ children }: { children: React.ReactNode }) {
  const { data } = useBranding();
  useEffect(() => {
    const root = document.documentElement;
    if (data?.primaryColor) {
      root.style.setProperty("--brand-primary", data.primaryColor);
    } else {
      root.style.removeProperty("--brand-primary");
    }
    if (data?.name) {
      const title = `${data.name} — VisaFlow France`;
      if (document.title !== title) document.title = title;
    }
  }, [data?.primaryColor, data?.name]);
  return <>{children}</>;
}
