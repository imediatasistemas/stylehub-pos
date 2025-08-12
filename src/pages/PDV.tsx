import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";
import { Loader2, Minus, Plus, Printer, Search, ShoppingCart, Trash2, UserPlus } from "lucide-react";
import { formatCpfCnpj, onlyDigits } from "@/lib/masks";

// Tipos do banco (Supabase)
type Product = Database["public"]["Tables"]["products"]["Row"];
type Customer = Database["public"]["Tables"]["customers"]["Row"];

type CustomerLite = Pick<Customer, "id" | "name" | "cpf_cnpj">;

interface CartItem {
  product: Product;
  quantity: number;
}

export default function PDV() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Produtos e filtro
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [productQuery, setProductQuery] = useState<string>("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Clientes e CPF avulso
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [customersLoading, setCustomersLoading] = useState<boolean>(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [cpfAvulso, setCpfAvulso] = useState<string>("");

  // Carrinho e pagamento
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [installments, setInstallments] = useState<number>(1);
  const [finalizing, setFinalizing] = useState<boolean>(false);

  // Carregar produtos/clientes
  useEffect(() => {
    const loadInitial = async () => {
      setProductsLoading(true);
      setCustomersLoading(true);
      try {
        const [{ data: prodData, error: prodErr }, { data: custData, error: custErr }] = await Promise.all([
          supabase.from("products").select("*").eq("active", true).gt("stock_quantity", 0).order("name"),
          supabase.from("customers").select("id, name, cpf_cnpj").order("name"),
        ]);

        if (prodErr) throw prodErr;
        if (custErr) throw custErr;

        setProducts(prodData ?? []);
        setCustomers((custData ?? []) as CustomerLite[]);
      } catch (error) {
        console.error(error);
        toast({ title: "Erro", description: "Falha ao carregar dados do PDV.", variant: "destructive" });
      } finally {
        setProductsLoading(false);
        setCustomersLoading(false);
      }
    };

    loadInitial();
  }, [toast]);

  // Foco automático no campo de código de barras
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Lista de produtos filtrada por código ou nome
  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q))
    );
  }, [productQuery, products]);

  // Totais
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.product.sale_price * item.quantity, 0), [cart]);
  const total = Math.max(0, subtotal - (isFinite(discount) ? discount : 0));

  // Helpers carrinho
  const addProductToCart = (product: Product, qty: number = 1) => {
    if (qty <= 0) return;
    const existing = cart.find((c) => c.product.id === product.id);
    if (existing) {
      if (existing.quantity + qty > product.stock_quantity) {
        toast({ title: "Estoque insuficiente", description: `Disponível: ${product.stock_quantity}`, variant: "destructive" });
        return;
      }
      setCart((prev) => prev.map((c) => (c.product.id === product.id ? { ...c, quantity: c.quantity + qty } : c)));
    } else {
      if (qty > product.stock_quantity) {
        toast({ title: "Estoque insuficiente", description: `Disponível: ${product.stock_quantity}`, variant: "destructive" });
        return;
      }
      setCart((prev) => [...prev, { product, quantity: qty }]);
    }
    toast({ title: "Adicionado", description: `${product.name} adicionado ao carrinho.` });
  };

  const updateItemQty = (productId: string, newQty: number) => {
    setCart((prev) => {
      if (newQty <= 0) return prev.filter((c) => c.product.id !== productId);
      const prod = products.find((p) => p.id === productId);
      if (prod && newQty > prod.stock_quantity) {
        toast({ title: "Estoque insuficiente", description: `Disponível: ${prod.stock_quantity}`, variant: "destructive" });
        return prev;
      }
      return prev.map((c) => (c.product.id === productId ? { ...c, quantity: newQty } : c));
    });
  };

  const removeItem = (productId: string) => setCart((prev) => prev.filter((c) => c.product.id !== productId));

  // Leitura por código de barras ou busca manual
  const handleBarcodeEnter = () => {
    const q = productQuery.trim();
    if (!q) {
      toast({ title: "Informe o código ou nome", description: "Digite e pressione Enter para adicionar.", variant: "destructive" });
      return;
    }
    // Tenta código exato primeiro; se não, pega o primeiro do filtro
    const exact = products.find((p) => p.code?.toLowerCase() === q.toLowerCase());
    const chosen = exact ?? filteredProducts[0];
    if (chosen) {
      addProductToCart(chosen, 1);
      setProductQuery("");
      barcodeInputRef.current?.focus();
    } else {
      toast({ title: "Produto não encontrado", description: `Não encontramos "${q}".`, variant: "destructive" });
    }
  };

  // Cadastrar CPF avulso como cliente (opcional)
  const handleCreateCustomerFromCPF = async () => {
    const cpf = onlyDigits(cpfAvulso.trim());
    if (!cpf) {
      toast({ title: "CPF/CNPJ inválido", description: "Informe um CPF ou CNPJ válido.", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({ name: "Consumidor Final", cpf_cnpj: cpf })
        .select("id, name, cpf_cnpj")
        .single();
      if (error) throw error;
      setCustomers((prev) => [...prev, data as CustomerLite]);
      setSelectedCustomerId(data.id);
      setCpfAvulso(""); // Limpa o campo após criar
      toast({ title: "Cliente criado", description: `CPF/CNPJ ${formatCpfCnpj(cpf)} vinculado.` });
    } catch (error) {
      console.error(error);
      toast({ title: "Erro", description: "Não foi possível criar o cliente.", variant: "destructive" });
    }
  };

  // Finalizar venda
  const finalizeSale = async () => {
    if (cart.length === 0) {
      toast({ title: "Carrinho vazio", description: "Adicione itens antes de finalizar.", variant: "destructive" });
      return;
    }

    if (!user) {
      toast({ title: "Usuário não autenticado", description: "Faça login para finalizar a venda.", variant: "destructive" });
      return;
    }

    setFinalizing(true);
    try {
      // Cria venda
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          customer_id: selectedCustomerId || null,
          user_id: user.id,
          total_amount: total,
          discount: discount || 0,
          payment_method: paymentMethod,
          installments: paymentMethod === "installment" ? installments : 1,
          status: "completed",
        })
        .select()
        .single();
      if (saleError) throw saleError;

      // Itens da venda
      const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.sale_price,
        total_price: item.product.sale_price * item.quantity,
      }));
      const { error: itemsError } = await supabase.from("sale_items").insert(saleItems);
      if (itemsError) throw itemsError;

      // Atualiza estoque em sequência (poderia ser RPC/batch para otimizar)
      for (const item of cart) {
        const newQty = item.product.stock_quantity - item.quantity;
        const { error: stockError } = await supabase
          .from("products")
          .update({ stock_quantity: newQty })
          .eq("id", item.product.id);
        if (stockError) throw stockError;
      }

      // Parcelas (opcional)
      if (paymentMethod === "installment" && installments > 1) {
        const installmentAmount = Number((total / installments).toFixed(2));
        const rows = Array.from({ length: installments }).map((_, idx) => {
          const dueDate = new Date();
          dueDate.setMonth(dueDate.getMonth() + (idx + 1));
          return {
            sale_id: sale.id,
            installment_number: idx + 1,
            amount: installmentAmount,
            due_date: dueDate.toISOString().split("T")[0],
            status: "pending" as const,
          };
        });
        const { error: instError } = await supabase.from("installments").insert(rows);
        if (instError) throw instError;
      }

      toast({ title: "Venda finalizada", description: `#${sale.id.slice(0, 8)} concluída.` });

      // Imprime cupom
      printReceipt({
        saleId: sale.id,
        items: cart,
        subtotal,
        discount: discount || 0,
        total,
        paymentMethod,
        installments,
        customer: customers.find((c) => c.id === selectedCustomerId) || null,
        cpfAvulso: selectedCustomerId ? "" : cpfAvulso,
      });

      // Limpa estado e recarrega produtos para refletir estoque
      setCart([]);
      setDiscount(0);
      setPaymentMethod("cash");
      setInstallments(1);
      setSelectedCustomerId("");
      setCpfAvulso("");

      // Recarrega produtos
      const { data: prodData } = await supabase.from("products").select("*").eq("active", true).gt("stock_quantity", 0).order("name");
      setProducts(prodData ?? []);
    } catch (error) {
      console.error(error);
      toast({ title: "Erro", description: "Falha ao finalizar venda.", variant: "destructive" });
    } finally {
      setFinalizing(false);
    }
  };

  // Impressão do cupom
  function printReceipt(args: {
    saleId: string;
    items: CartItem[];
    subtotal: number;
    discount: number;
    total: number;
    paymentMethod: string;
    installments: number;
    customer: CustomerLite | null;
    cpfAvulso: string;
  }) {
    const methodLabel = args.paymentMethod === "cash" ? "Dinheiro" : args.paymentMethod === "card" ? "Cartão" : args.paymentMethod === "pix" ? "PIX" : "Parcelado";
    const lines = args.items
      .map(
        (i) => `
      <div style="margin: 6px 0;">
        <strong>${i.product.name}</strong><br/>
        ${i.quantity}x R$ ${i.product.sale_price.toFixed(2)} = R$ ${(i.product.sale_price * i.quantity).toFixed(2)}
      </div>`
      )
      .join("");

    const customerLine = args.customer
      ? `${args.customer.name}${args.customer.cpf_cnpj ? ` - CPF/CNPJ: ${formatCpfCnpj(args.customer.cpf_cnpj)}` : ""}`
      : args.cpfAvulso
      ? `CPF/CNPJ: ${formatCpfCnpj(args.cpfAvulso)}`
      : "Consumidor Final";

    const html = `<!DOCTYPE html>
        <html>
  <head>
    <meta charset="utf-8" />
    <title>Cupom Fiscal</title>
  </head>
  <body style="font-family: monospace; max-width: 300px; margin: 0 auto; padding: 12px;">
    <div style="text-align: center; margin-bottom: 12px;">
      <h2 style="margin: 4px 0;">STYLEHUB - PDV</h2>
      <small>${new Date().toLocaleString("pt-BR")}</small>
            </div>
    <hr/>
    <div style="margin: 6px 0;">
      <strong>Cliente:</strong> ${customerLine}
              </div>
    <hr/>
    ${lines}
    <hr/>
    <div style="text-align: right; margin-top: 8px;">
      <div>Subtotal: R$ ${args.subtotal.toFixed(2)}</div>
      <div>Desconto: R$ ${args.discount.toFixed(2)}</div>
      <div><strong>Total: R$ ${args.total.toFixed(2)}</strong></div>
      <div>Método: ${methodLabel}${args.paymentMethod === "installment" ? ` (${args.installments}x)` : ""}</div>
      <div style="margin-top:8px;">Venda: #${args.saleId.slice(0, 8)}</div>
            </div>
          </body>
</html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">PDV - Ponto de Venda</h1>
        <p className="text-muted-foreground">Leia o código de barras, pesquise por nome/código, selecione o cliente ou informe CPF e finalize a venda.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Coluna esquerda: Produtos */}
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                ref={barcodeInputRef}
                placeholder="Escaneie o código de barras ou pesquise nome/código"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleBarcodeEnter();
                }}
              />
              <Button onClick={handleBarcodeEnter} title="Adicionar">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="max-h-96 overflow-y-auto space-y-2">
              {productsLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando produtos...
                </div>
              ) : filteredProducts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum produto encontrado.</p>
              ) : (
                filteredProducts.slice(0, 50).map((p) => (
                  <div
                    key={p.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => addProductToCart(p, 1)}
                >
                  <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-muted-foreground">{p.code} {p.size ? `| ${p.size}` : ""} {p.color ? `| ${p.color}` : ""}</p>
                      <p className="text-sm">Estoque: {p.stock_quantity}</p>
                  </div>
                  <div className="text-right">
                      <p className="font-bold">R$ {p.sale_price.toFixed(2)}</p>
                  </div>
                </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Coluna direita: Carrinho e pagamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> Carrinho
              {cart.length > 0 && <Badge variant="secondary">{cart.length} item(s)</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Itens do carrinho */}
            <div className="max-h-64 overflow-y-auto space-y-2">
              {cart.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Carrinho vazio</p>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex-1">
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-sm text-muted-foreground">R$ {item.product.sale_price.toFixed(2)} cada</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateItemQty(item.product.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateItemQty(item.product.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removeItem(item.product.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Separator />

            {/* Cliente */}
            <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
                <label className="text-sm font-medium">Cliente cadastrado</label>
                <Select
                  disabled={customersLoading}
                  value={selectedCustomerId}
                  onValueChange={(v) => {
                    setSelectedCustomerId(v);
                    if (v) setCpfAvulso("");
                  }}
                >
                <SelectTrigger>
                    <SelectValue placeholder={customersLoading ? "Carregando..." : "Selecionar cliente"} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value=",">(Sem cliente)</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.cpf_cnpj ? ` (${c.cpf_cnpj})` : ""}
                     </SelectItem>
                   ))}
                </SelectContent>
              </Select>
            </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">CPF/CNPJ (avulso)</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite o CPF ou CNPJ"
                    value={cpfAvulso}
                    onChange={(e) => setCpfAvulso(formatCpfCnpj(e.target.value))}
                    disabled={!!selectedCustomerId}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    title="Cadastrar CPF/CNPJ como cliente"
                    onClick={handleCreateCustomerFromCPF}
                    disabled={!cpfAvulso.trim() || !!selectedCustomerId || customersLoading}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Pagamento */}
            <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-2">
                <label className="text-sm font-medium">Forma de pagamento</label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="card">Cartão</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="installment">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Parcelas</label>
                <Select
                  disabled={paymentMethod !== "installment"}
                  value={installments.toString()}
                  onValueChange={(v) => setInstallments(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Desconto (R$)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                  value={Number.isNaN(discount) ? 0 : discount}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              />
              </div>
            </div>

            <Separator />

            {/* Totalização */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Desconto</span>
                <span>R$ {(discount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
            </div>

            {/* Ações */}
            <div className="space-y-2">
              <Button className="w-full" onClick={finalizeSale} disabled={cart.length === 0 || finalizing}>
                {finalizing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  "Finalizar Venda"
                )}
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                disabled={cart.length === 0}
                onClick={() =>
                  printReceipt({
                    saleId: "PREVIEW" + Math.random().toString(36).slice(2, 6),
                    items: cart,
                    subtotal,
                    discount: discount || 0,
                    total,
                    paymentMethod,
                    installments,
                    customer: customers.find((c) => c.id === selectedCustomerId) || null,
                    cpfAvulso: selectedCustomerId ? "" : cpfAvulso,
                  })
                }
              >
                <Printer className="h-4 w-4 mr-2" /> Imprimir Prévia do Cupom
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}