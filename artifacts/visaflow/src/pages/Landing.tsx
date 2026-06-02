import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, FileCheck2, Users, ShieldCheck, Globe2, Plane } from "lucide-react";

export function Landing() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-slate-900">VisaFlow</div>
              <div className="text-xs text-slate-500">France</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in">
              <Button variant="ghost" data-testid="link-signin">
                Connexion
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button data-testid="link-signup">Créer un compte</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-6">
          <Globe2 className="w-4 h-4" /> Spécialiste Afrique francophone
        </div>
        <h1 className="text-5xl font-bold text-slate-900 tracking-tight mb-5">
          Votre visa étudiant France,
          <br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            de bout en bout.
          </span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10">
          VisaFlow accompagne les étudiants admis dans une école privée française
          tout au long de leur procédure visa : lettre d&apos;admission, entretien
          de motivation, dossier consulaire TLS/VFS, validation OFII — 15 étapes
          guidées par votre conseiller dédié.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/sign-up">
            <Button size="lg" className="px-8" data-testid="cta-signup">
              Démarrer mon dossier
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" data-testid="cta-signin">
              J'ai déjà un compte
            </Button>
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20 grid md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <FileCheck2 className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="font-semibold text-slate-900 mb-2">Suivi temps réel</h3>
            <p className="text-sm text-slate-600">
              Visualisez l'avancée de votre dossier, vos documents validés, et les prochaines actions.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Users className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="font-semibold text-slate-900 mb-2">Conseiller dédié</h3>
            <p className="text-sm text-slate-600">
              Un expert vous accompagne, valide vos documents et organise vos rendez-vous Campus France.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <ShieldCheck className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="font-semibold text-slate-900 mb-2">Sécurité bancaire</h3>
            <p className="text-sm text-slate-600">
              Vos documents sont chiffrés. Conformité RGPD et hébergement européen.
            </p>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        <Plane className="w-5 h-5 inline mr-2" />
        © {new Date().getFullYear()} VisaFlow France — Procédure visa étudiant simplifiée.
      </footer>
    </div>
  );
}
