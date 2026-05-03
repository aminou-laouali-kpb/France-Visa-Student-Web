import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { billingApi, tenantApi, type Plan } from "@/lib/billing";
import { Check, ExternalLink, AlertCircle } from "lucide-react";

export function AdminBilling() {
  const { data: plansResp, isLoading: loadingPlans } = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: () => billingApi.plans(),
  });
  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["tenant", "settings"],
    queryFn: () => tenantApi.settings(),
  });

  const stripeConfigured = !!plansResp?.stripeConfigured;

  const onSubscribe = async (priceId: string | null) => {
    if (!priceId) return;
    try {
      const { url } = await billingApi.checkout(priceId);
      if (url) window.location.href = url;
    } catch (err) {
      alert(`Erreur de paiement: ${(err as Error).message}`);
    }
  };

  const onPortal = async () => {
    try {
      const { url } = await billingApi.portal();
      if (url) window.location.href = url;
    } catch (err) {
      alert(`Erreur portail: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Facturation</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gérez votre abonnement, vos plafonds de places et de dossiers, et
          votre crédit IA mensuel.
        </p>
      </div>

      {!stripeConfigured ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              Stripe n'est pas encore configuré pour cet espace. Définissez
              <code className="px-1 bg-white rounded mx-1">STRIPE_SECRET_KEY</code>
              et
              <code className="px-1 bg-white rounded mx-1">STRIPE_WEBHOOK_SECRET</code>
              dans les variables d'environnement, puis renseignez les
              identifiants de prix
              <code className="px-1 bg-white rounded mx-1">STRIPE_PRICE_PRO</code>
              et
              <code className="px-1 bg-white rounded mx-1">STRIPE_PRICE_AGENCY</code>.
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loadingSettings ? (
        <div className="text-sm text-slate-500">Chargement…</div>
      ) : settings ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Abonnement actuel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Formule</span>
              <Badge variant="outline" className="uppercase">
                {settings.planTier}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Statut</span>
              <span>{settings.subscriptionStatus ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Renouvellement</span>
              <span>
                {settings.currentPeriodEnd
                  ? new Date(settings.currentPeriodEnd).toLocaleDateString("fr-FR")
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Places conseillers</span>
              <span>{settings.seatLimit ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Dossiers étudiants max</span>
              <span>{settings.studentLimit ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Crédit IA mensuel</span>
              <span>{settings.aiMonthlyBudgetUsd ?? "0"} USD</span>
            </div>
            {settings.stripeCustomerId ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={onPortal}
                data-testid="btn-portal"
              >
                Gérer dans le portail Stripe
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {loadingPlans
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse h-72" />
            ))
          : plansResp?.plans.map((plan: Plan) => {
              const isCurrent = settings?.planTier === plan.tier;
              return (
                <Card
                  key={plan.tier}
                  className={isCurrent ? "border-blue-400 ring-1 ring-blue-200" : ""}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{plan.name}</span>
                      {isCurrent ? (
                        <Badge className="bg-blue-600">Actif</Badge>
                      ) : null}
                    </CardTitle>
                    <div className="text-3xl font-bold text-slate-900">
                      {plan.priceEur}€
                      <span className="text-sm font-normal text-slate-500">
                        /mois
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ul className="space-y-1.5 text-sm">
                      {plan.features.map((f: string) => (
                        <li key={f} className="flex gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    {!isCurrent && plan.tier !== "free" ? (
                      <Button
                        className="w-full"
                        disabled={!stripeConfigured || !plan.priceId}
                        onClick={() => onSubscribe(plan.priceId)}
                        data-testid={`btn-subscribe-${plan.tier}`}
                      >
                        {plan.priceId ? "Choisir cette formule" : "Prix non configuré"}
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
}
