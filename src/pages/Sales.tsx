import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Loader2 } from "lucide-react";

type Sale = Database["public"]["Tables"]["sales"]["Row"];

type SaleWithCustomer = Sale & { customer_name?: string | null; customer_cpf?: string | null };

export default function Sales() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SaleWithCustomer[]>([]);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) =>
      (s.customer_name ?? "").toLowerCase().includes(q) ||
      (s.customer_cpf ?? "").toLowerCase().includes(q) ||
      (s.id ?? "").toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("sales")
        .select("*, customers(name, cpf_cnpj)")
        .order("created_at", { ascending: false }) as unknown as { data: (Sale & { customers: { name: string | null; cpf_cnpj: string | null } | null })[] | null, error: any };

      if (error) {
        toast({ title: "Erro", description: "Falha ao carregar vendas.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const rows: SaleWithCustomer[] = (data ?? []).map((row) => ({
        ...row,
        customer_name: row.customers?.name ?? null,
        customer_cpf: row.customers?.cpf_cnpj ?? null,
      }));
      setItems(rows);
      setLoading(false);
    };
    load();
  }, [toast]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Vendas</h1>
        <p className="text-muted-foreground">Listagem de vendas realizadas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Buscar por cliente, CPF ou nº da venda" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead># Venda</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.id.slice(0, 8)}</TableCell>
                      <TableCell>{s.customer_name ?? "-"}</TableCell>
                      <TableCell>{s.customer_cpf ?? "-"}</TableCell>
                      <TableCell>{s.payment_method ?? "-"}</TableCell>
                      <TableCell>R$ {s.total_amount.toFixed(2)}</TableCell>
                      <TableCell>{s.status ?? "-"}</TableCell>
                      <TableCell>{new Date(s.created_at).toLocaleString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
