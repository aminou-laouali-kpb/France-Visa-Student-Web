import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import { dark } from "@clerk/themes";
import App from "./App";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider
    publishableKey={PUBLISHABLE_KEY}
    {...(import.meta.env.PROD ? { proxyUrl: "/api/__clerk" } : {})}
    appearance={{
      variables: {
        colorPrimary: "#1e40af",
        borderRadius: "0.5rem",
      },
      elements: {
        formButtonPrimary: "bg-blue-700 hover:bg-blue-800",
      },
    }}
    localization={{
      signIn: { start: { title: "Connexion à VisaFlow", subtitle: "Bienvenue, connectez-vous pour continuer" } },
      signUp: { start: { title: "Créer votre compte VisaFlow", subtitle: "Démarrez votre dossier visa étudiant" } },
    }}
  >
    <App />
  </ClerkProvider>,
);
