import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

// Extensão da tabela: adicionamos campo "image_url" no formulário (se a tabela não tiver, armazena-se somente localmente)
// Para produção, crie uma coluna opcional image_url na tabela products.

type Product = Database["public"]["Tables"]["products"]["Row"] & { image_url?: string | null };

type ProductFormData = {
  code: string;
  name: string;
  description?: string;
  size?: string;
  color?: string;
  category_id?: string | null;
  stock_quantity: number;
  sale_price: number;
  cost_price: number;
  active: boolean;
  image_url?: string;
};

export default function Products() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Product[]>([]);
  const [query, setQuery] = useState("");

  // paginação simples
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormData>({
    code: "",
    name: "",
    description: "",
    size: "",
    color: "",
    category_id: null,
    stock_quantity: 0,
    sale_price: 0,
    cost_price: 0,
    active: true,
    image_url: "",
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q)
    );
  }, [items, query]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        toast({ title: "Erro", description: "Falha ao carregar produtos.", variant: "destructive" });
      } else {
        setItems((data ?? []) as Product[]);
      }
      setLoading(false);
    };
    load();
  }, [toast]);

  const resetForm = () => {
    setEditing(null);
    setForm({
      code: "",
      name: "",
      description: "",
      size: "",
      color: "",
      category_id: null,
      stock_quantity: 0,
      sale_price: 0,
      cost_price: 0,
      active: true,
      image_url: "",
    });
  };

  const openCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      code: p.code,
      name: p.name,
      description: p.description ?? "",
      size: p.size ?? "",
      color: p.color ?? "",
      category_id: p.category_id,
      stock_quantity: p.stock_quantity,
      sale_price: p.sale_price,
      cost_price: p.cost_price,
      active: p.active ?? true,
      image_url: (p as any).image_url ?? "",
    });
    setIsDialogOpen(true);
  };

  const onImageSelected = async (file?: File) => {
    if (!file) return;
    // Upload simples para Supabase Storage se existir bucket "products"
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from("products").upload(fileName, file);
      if (error) throw error;
      const { data: publicUrl } = supabase.storage.from("products").getPublicUrl(data.path);
      setForm((f) => ({ ...f, image_url: publicUrl.publicUrl }));
      toast({ title: "Imagem enviada" });
    } catch (e) {
      console.error(e);
      toast({ title: "Falha no upload", description: "Verifique o bucket 'products' no Supabase Storage.", variant: "destructive" });
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form } as any;
      if (!payload.image_url) delete payload.image_url;

      if (editing) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Produto atualizado" });
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast({ title: "Produto criado" });
      }
      // refresh
      const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      setItems((data ?? []) as Product[]);
      setIsDialogOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((p) => p.id !== id));
    toast({ title: "Produto excluído" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">Gerencie o catálogo de produtos</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Novo Produto
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Input placeholder="Buscar por código ou nome" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
            <div className="text-sm text-muted-foreground">{filtered.length} itens</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : (
            <>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imagem</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tam/Cor</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          {((p as any).image_url) ? (
                            <img src={(p as any).image_url} alt={p.name} className="h-10 w-10 object-cover rounded" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted" />
                          )}
                        </TableCell>
                        <TableCell>{p.code}</TableCell>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>{[p.size, p.color].filter(Boolean).join(" / ")}</TableCell>
                        <TableCell>R$ {p.sale_price.toFixed(2)}</TableCell>
                        <TableCell>{p.stock_quantity}</TableCell>
                        <TableCell className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* paginação */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Código</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tamanho</Label>
                <Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
              </div>
              <div>
                <Label>Cor</Label>
                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
              <div>
                <Label>Estoque</Label>
                <Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preço de Venda (R$)</Label>
                <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Preço de Custo (R$)</Label>
                <Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label>Imagem (URL automática ao enviar)</Label>
              <Input type="file" accept="image/*" onChange={(e) => onImageSelected(e.target.files?.[0])} />
              {form.image_url ? (
                <img src={form.image_url} alt="Prévia" className="mt-2 h-20 w-20 object-cover rounded" />
              ) : null}
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
