import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Loader2, Check } from "lucide-react";

type Installment = Database["public"]["Tables"]["installments"]["Row"];

type InstallmentRow = Installment & { sale_code: string };

export default function Installments() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InstallmentRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const okStatus = status === "all" ? true : (r.status ?? "").toLowerCase() === status;
      const okQuery = q ? r.sale_id.toLowerCase().includes(q) : true;
      return okStatus && okQuery;
    });
  }, [rows, query, status]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("installments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        toast({ title: "Erro", description: "Falha ao carregar parcelas.", variant: "destructive" });
      } else {
        setRows((data ?? []).map((d) => ({ ...d, sale_code: d.sale_id.slice(0, 8) })));
      }
      setLoading(false);
    };
    load();
  }, [toast]);

  const markAsPaid = async (id: string) => {
    const { error } = await supabase
      .from("installments")
      .update({ status: "paid", payment_date: new Date().toISOString().split("T")[0] })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível marcar como paga.", variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "paid", payment_date: new Date().toISOString() } : r)));
    toast({ title: "Parcela marcada como paga" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Carnês (Parcelas)</h1>
        <p className="text-muted-foreground">Gerencie as parcelas de vendas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <Input placeholder="Buscar por nº da venda" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="paid">Pagas</SelectItem>
                  <SelectItem value="overdue">Vencidas</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                    <TableHead>Parcela</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.sale_code}</TableCell>
                      <TableCell>{r.installment_number}x</TableCell>
                      <TableCell>R$ {r.amount.toFixed(2)}</TableCell>
                      <TableCell>{new Date(r.due_date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{r.status ?? "-"}</TableCell>
                      <TableCell>{r.payment_date ? new Date(r.payment_date).toLocaleDateString("pt-BR") : "-"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" disabled={r.status === "paid"} onClick={() => markAsPaid(r.id)}>
                          <Check className="h-4 w-4 mr-1" /> Pagar
                        </Button>
                      </TableCell>
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
