import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import type { Database } from "@/integrations/supabase/types";
import { Loader2, Plus, Pencil, Trash2, Lock } from "lucide-react";
import { formatCEP, formatCpfCnpj, formatPhoneBR, onlyDigits } from "@/lib/masks";

type Customer = Database["public"]["Tables"]["customers"]["Row"];

type CustomerForm = Partial<Pick<Customer, "name" | "cpf_cnpj" | "phone" | "email" | "address" | "city" | "state" | "zip_code">>;

export default function Customers() {
  const { toast } = useToast();
  const { role, isAdminOrManager, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>({
    name: "",
    cpf_cnpj: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.cpf_cnpj ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        toast({ title: "Erro", description: "Falha ao carregar clientes.", variant: "destructive" });
      } else {
        setItems(data ?? []);
      }
      setLoading(false);
    };
    load();
  }, [toast]);

  const resetForm = () => {
    setEditing(null);
    setForm({
      name: "",
      cpf_cnpj: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      zip_code: "",
    });
  };

  const openCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      cpf_cnpj: c.cpf_cnpj ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
      zip_code: c.zip_code ?? "",
    });
    setIsDialogOpen(true);
  };

  const save = async () => {
    if (!isAdminOrManager) {
      toast({ 
        title: "Acesso negado", 
        description: "Apenas administradores e gerentes podem cadastrar/editar clientes.", 
        variant: "destructive" 
      });
      return;
    }

    if (!form.name?.trim()) {
      toast({ 
        title: "Nome obrigatório", 
        description: "Por favor, informe o nome do cliente.", 
        variant: "destructive" 
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name!.trim(),
        cpf_cnpj: onlyDigits(form.cpf_cnpj || ""),
        zip_code: onlyDigits(form.zip_code || ""),
        phone: onlyDigits(form.phone || ""),
        email: form.email?.trim() || null,
        address: form.address?.trim() || null,
        city: form.city?.trim() || null,
        state: form.state?.trim() || null,
      };

      if (editing) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Cliente atualizado" });
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
        toast({ title: "Cliente criado" });
      }
      const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
      setItems(data ?? []);
      setIsDialogOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao salvar", description: "Verifique suas permissões e tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!isAdminOrManager) {
      toast({ 
        title: "Acesso negado", 
        description: "Apenas administradores e gerentes podem excluir clientes.", 
        variant: "destructive" 
      });
      return;
    }

    if (!confirm("Excluir este cliente?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: "Verifique suas permissões e tente novamente.", variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Cliente excluído" });
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Gerencie os clientes</span>
            {role && <Badge variant="outline">{role}</Badge>}
          </div>
        </div>
        <Button onClick={openCreate} disabled={!isAdminOrManager}>
          {!isAdminOrManager && <Lock className="h-4 w-4 mr-2" />}
          <Plus className="h-4 w-4 mr-2" /> Novo Cliente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Buscar por nome, CPF/CNPJ ou email" value={query} onChange={(e) => setQuery(e.target.value)} />
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
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{formatCpfCnpj(c.cpf_cnpj ?? "")}</TableCell>
                      <TableCell>{c.email ?? "-"}</TableCell>
                      <TableCell>{formatPhoneBR(c.phone ?? "")}</TableCell>
                      <TableCell>{[c.city, c.state].filter(Boolean).join("/") || "-"}</TableCell>
                      <TableCell className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => openEdit(c)}
                          disabled={!isAdminOrManager}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-destructive" 
                          onClick={() => remove(c.id)}
                          disabled={!isAdminOrManager}
                        >
                          <Trash2 className="h-4 w-4" />
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent aria-describedby="dialog-description">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <div id="dialog-description" className="sr-only">
            Formulário para {editing ? "editar dados do" : "cadastrar novo"} cliente
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>CPF/CNPJ</Label>
                <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: formatCpfCnpj(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhoneBR(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Endereço</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <Label>UF</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>CEP</Label>
              <Input value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: formatCEP(e.target.value) })} />
            </div>
            <Separator />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>) : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
