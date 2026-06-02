import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
export function AdminPlaybooks() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [source, setSource] = useState("static");
  const [items, setItems] = useState<{ slug: string; title: string }[]>([]);
  const load = useCallback(async () => {
    const token = await getToken();
    const r = await fetch("/api/playbooks", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!r.ok) throw new Error("load");
    const d = await r.json();
    setSource(d.source); setItems(d.playbooks);
  }, [getToken]);
  useEffect(() => { void load().catch((e) => toast({ title: "Erreur", description: String(e), variant: "destructive" })); }, [load, toast]);
  return (<div className="space-y-6" data-testid="admin-playbooks"><h1 className="text-3xl font-bold">Playbooks</h1><Badge>{source}</Badge><Card><CardHeader><CardTitle>Catalogue</CardTitle></CardHeader><CardContent>{items.map((p) => <div key={p.slug} className="py-2 border-b">{p.title}</div>)}</CardContent></Card></div>);
}
