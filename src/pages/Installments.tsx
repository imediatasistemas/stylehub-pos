import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Loader2, Check, Printer, Download, AlertTriangle } from "lucide-react";

type Installment = Database["public"]["Tables"]["installments"]["Row"];
type Sale = Database["public"]["Tables"]["sales"]["Row"];
type Customer = Database["public"]["Tables"]["customers"]["Row"];

type InstallmentRow = Installment & { 
  sale_code: string;
  customer_name?: string;
  total_amount?: number;
  is_overdue?: boolean;
};

export default function Installments() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InstallmentRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const today = new Date();
    
    return rows.filter((r) => {
      // Verifica se está vencida
      const dueDate = new Date(r.due_date);
      r.is_overdue = r.status === "pending" && dueDate < today;
      
      // Filtro por status
      let statusMatch = true;
      if (status === "pending") statusMatch = r.status === "pending";
      else if (status === "paid") statusMatch = r.status === "paid";
      else if (status === "overdue") statusMatch = r.is_overdue === true;
      
      // Filtro por busca
      const queryMatch = !q || 
        r.sale_code.toLowerCase().includes(q) ||
        (r.customer_name || "").toLowerCase().includes(q);
      
      return statusMatch && queryMatch;
    });
  }, [rows, query, status]);

  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter(r => r.status === "pending").length;
    const paid = rows.filter(r => r.status === "paid").length;
    const overdue = rows.filter(r => {
      const dueDate = new Date(r.due_date);
      const today = new Date();
      return r.status === "pending" && dueDate < today;
    }).length;
    
    const totalValue = rows.reduce((sum, r) => sum + Number(r.amount), 0);
    const pendingValue = rows
      .filter(r => r.status === "pending")
      .reduce((sum, r) => sum + Number(r.amount), 0);
    
    return { total, pending, paid, overdue, totalValue, pendingValue };
  }, [rows]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Buscar parcelas com dados de vendas e clientes
        const { data: installments, error: instError } = await supabase
          .from("installments")
          .select("*")
          .order("due_date", { ascending: true });
        
        if (instError) throw instError;

        // Buscar vendas para obter customer_id
        const saleIds = [...new Set(installments?.map(i => i.sale_id) || [])];
        const { data: sales, error: salesError } = await supabase
          .from("sales")
          .select("id, customer_id, total_amount")
          .in("id", saleIds);
        
        if (salesError) throw salesError;

        // Buscar clientes
        const customerIds = [...new Set(sales?.map(s => s.customer_id).filter(Boolean) || [])];
        const { data: customers, error: customersError } = await supabase
          .from("customers")
          .select("id, name")
          .in("id", customerIds);
        
        if (customersError) throw customersError;

        // Mapear dados
        const enhancedRows: InstallmentRow[] = (installments || []).map(inst => {
          const sale = sales?.find(s => s.id === inst.sale_id);
          const customer = customers?.find(c => c.id === sale?.customer_id);
          
          return {
            ...inst,
            sale_code: inst.sale_id.slice(0, 8),
            customer_name: customer?.name || "Cliente não identificado",
            total_amount: sale?.total_amount || 0
          };
        });

        setRows(enhancedRows);
      } catch (error) {
        console.error(error);
        toast({ title: "Erro", description: "Falha ao carregar parcelas.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    
    load();
  }, [toast]);

  const markAsPaid = async (id: string) => {
    try {
      const { error } = await supabase
        .from("installments")
        .update({ 
          status: "paid", 
          payment_date: new Date().toISOString().split("T")[0] 
        })
        .eq("id", id);
      
      if (error) throw error;
      
      setRows(prev => prev.map(r => 
        r.id === id 
          ? { ...r, status: "paid", payment_date: new Date().toISOString() }
          : r
      ));
      
      toast({ title: "Parcela marcada como paga" });
    } catch (error) {
      console.error(error);
      toast({ title: "Erro", description: "Não foi possível marcar como paga.", variant: "destructive" });
    }
  };

  const generateCarnet = (installmentId?: string) => {
    const itemsToPrint = installmentId 
      ? filtered.filter(r => r.id === installmentId)
      : filtered.filter(r => r.status === "pending");
    
    if (itemsToPrint.length === 0) {
      toast({ title: "Nenhuma parcela", description: "Não há parcelas para imprimir.", variant: "destructive" });
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Carnê de Pagamento</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .carnet-item { 
              border: 2px solid #000; 
              margin: 10px 0; 
              padding: 15px; 
              page-break-inside: avoid; 
            }
            .header { text-align: center; font-weight: bold; margin-bottom: 15px; }
            .info { display: flex; justify-content: space-between; margin: 5px 0; }
            .amount { font-size: 18px; font-weight: bold; }
            @media print { .carnet-item { margin: 5px 0; } }
          </style>
        </head>
        <body>
          ${itemsToPrint.map(item => `
            <div class="carnet-item">
              <div class="header">STYLEHUB - CARNÊ DE PAGAMENTO</div>
              <div class="info">
                <span><strong>Cliente:</strong> ${item.customer_name}</span>
                <span><strong>Venda:</strong> #${item.sale_code}</span>
              </div>
              <div class="info">
                <span><strong>Parcela:</strong> ${item.installment_number}</span>
                <span><strong>Vencimento:</strong> ${new Date(item.due_date).toLocaleDateString("pt-BR")}</span>
              </div>
              <div class="info">
                <span class="amount"><strong>Valor:</strong> R$ ${Number(item.amount).toFixed(2)}</span>
                <span><strong>Status:</strong> ${item.status === "paid" ? "Pago" : "Pendente"}</span>
              </div>
              <div style="margin-top: 15px; border-top: 1px solid #000; padding-top: 10px;">
                <small>Assinatura: _________________________ Data: ___/___/_____</small>
              </div>
            </div>
          `).join("")}
        </body>
      </html>
    `;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    }
  };

  const getStatusBadge = (row: InstallmentRow) => {
    if (row.status === "paid") {
      return <Badge variant="secondary">Pago</Badge>;
    }
    if (row.is_overdue) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    return <Badge variant="outline">Pendente</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carnês (Parcelas)</h1>
          <p className="text-muted-foreground">Gerencie e imprima parcelas de vendas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => generateCarnet()}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir Pendentes
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total de Parcelas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">Vencidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">R$ {stats.pendingValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">A Receber</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <Input 
              placeholder="Buscar por venda ou cliente" 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
            />
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
            <div className="text-sm text-muted-foreground flex items-center">
              {filtered.length} de {rows.length} parcelas
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
                    <TableHead>Cliente</TableHead>
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
                      <TableCell>{r.customer_name}</TableCell>
                      <TableCell>{r.sale_code}</TableCell>
                      <TableCell>{r.installment_number}x</TableCell>
                      <TableCell>R$ {Number(r.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {r.is_overdue && <AlertTriangle className="h-4 w-4 text-red-600" />}
                          {new Date(r.due_date).toLocaleDateString("pt-BR")}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(r)}</TableCell>
                      <TableCell>
                        {r.payment_date ? new Date(r.payment_date).toLocaleDateString("pt-BR") : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            disabled={r.status === "paid"} 
                            onClick={() => markAsPaid(r.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => generateCarnet(r.id)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
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
