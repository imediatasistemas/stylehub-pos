import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Plus, Minus, ShoppingCart, Printer } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Product {
  id: string;
  code: string;
  name: string;
  size: string;
  color: string;
  sale_price: number;
  stock_quantity: number;
}

interface CartItem extends Product {
  quantity: number;
}

interface Customer {
  id: string;
  name: string;
  cpf_cnpj: string;
}

export default function PDV() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [installments, setInstallments] = useState(1);
  const [discount, setDiscount] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .gt('stock_quantity', 0);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar produtos',
        variant: 'destructive',
      });
    } else {
      setProducts(data || []);
    }
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, cpf_cnpj')
      .order('name');

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar clientes',
        variant: 'destructive',
      });
    } else {
      setCustomers(data || []);
    }
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock_quantity) {
        toast({
          title: 'Estoque insuficiente',
          description: `Apenas ${product.stock_quantity} unidades disponíveis`,
          variant: 'destructive',
        });
        return;
      }
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    
    toast({
      title: 'Produto adicionado',
      description: `${product.name} adicionado ao carrinho`,
    });
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(cart.filter(item => item.id !== productId));
      return;
    }

    const product = products.find(p => p.id === productId);
    if (product && newQuantity > product.stock_quantity) {
      toast({
        title: 'Estoque insuficiente',
        description: `Apenas ${product.stock_quantity} unidades disponíveis`,
        variant: 'destructive',
      });
      return;
    }

    setCart(cart.map(item =>
      item.id === productId
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const searchProductByCode = () => {
    const product = products.find(p => p.code === searchCode);
    if (product) {
      addToCart(product);
      setSearchCode('');
    } else {
      toast({
        title: 'Produto não encontrado',
        description: 'Código do produto não encontrado',
        variant: 'destructive',
      });
    }
  };

  const getTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.sale_price * item.quantity, 0);
    return subtotal - discount;
  };

  const finalizeSale = async () => {
    if (cart.length === 0) {
      toast({
        title: 'Carrinho vazio',
        description: 'Adicione produtos ao carrinho',
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      toast({
        title: 'Erro',
        description: 'Usuário não autenticado',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          customer_id: selectedCustomer || null,
          user_id: user.id,
          total_amount: getTotal(),
          discount: discount,
          payment_method: paymentMethod,
          installments: paymentMethod === 'installment' ? installments : 1,
          status: 'completed',
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.sale_price,
        total_price: item.sale_price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Update stock
      for (const item of cart) {
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock_quantity: item.stock_quantity - item.quantity })
          .eq('id', item.id);

        if (stockError) throw stockError;
      }

      // Create installments if payment is installment
      if (paymentMethod === 'installment' && installments > 1) {
        const installmentAmount = getTotal() / installments;
        const installmentData = [];
        
        for (let i = 1; i <= installments; i++) {
          const dueDate = new Date();
          dueDate.setMonth(dueDate.getMonth() + i);
          
          installmentData.push({
            sale_id: sale.id,
            installment_number: i,
            amount: installmentAmount,
            due_date: dueDate.toISOString().split('T')[0],
            status: 'pending',
          });
        }

        const { error: installmentError } = await supabase
          .from('installments')
          .insert(installmentData);

        if (installmentError) throw installmentError;
      }

      toast({
        title: 'Venda finalizada!',
        description: `Venda #${sale.id.slice(0, 8)} realizada com sucesso`,
      });

      // Clear cart and reset form
      setCart([]);
      setSelectedCustomer('');
      setPaymentMethod('cash');
      setInstallments(1);
      setDiscount(0);
      
      // Refresh products to update stock
      fetchProducts();

    } catch (error) {
      console.error('Error finalizing sale:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao finalizar venda',
        variant: 'destructive',
      });
    }
  };

  const printReceipt = () => {
    // Simple receipt print simulation
    const receiptWindow = window.open('', '_blank');
    if (receiptWindow) {
      receiptWindow.document.write(`
        <html>
          <head><title>Cupom Fiscal</title></head>
          <body style="font-family: monospace; max-width: 300px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2>LOJA SISTEMA</h2>
              <p>Data: ${new Date().toLocaleString('pt-BR')}</p>
            </div>
            <hr>
            ${cart.map(item => `
              <div style="margin: 10px 0;">
                <strong>${item.name}</strong><br>
                ${item.quantity}x R$ ${item.sale_price.toFixed(2)} = R$ ${(item.quantity * item.sale_price).toFixed(2)}
              </div>
            `).join('')}
            <hr>
            <div style="text-align: right; margin-top: 20px;">
              <p><strong>Desconto: R$ ${discount.toFixed(2)}</strong></p>
              <p><strong>Total: R$ ${getTotal().toFixed(2)}</strong></p>
              <p>Pagamento: ${paymentMethod === 'cash' ? 'Dinheiro' : 
                              paymentMethod === 'card' ? 'Cartão' :
                              paymentMethod === 'pix' ? 'PIX' : 'Parcelado'}</p>
            </div>
          </body>
        </html>
      `);
      receiptWindow.document.close();
      receiptWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">PDV - Ponto de Venda</h1>
        <p className="text-muted-foreground">
          Realize vendas e gerencie transações
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Products Section */}
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Digite o código do produto"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchProductByCode()}
              />
              <Button onClick={searchProductByCode}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="max-h-96 overflow-y-auto space-y-2">
              {products.map(product => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => addToCart(product)}
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.code} | {product.size} | {product.color}
                    </p>
                    <p className="text-sm">Estoque: {product.stock_quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">R$ {product.sale_price.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cart Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Carrinho de Compras
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-64 overflow-y-auto space-y-2">
              {cart.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Carrinho vazio
                </p>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        R$ {item.sale_price.toFixed(2)} cada
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Separator />

            {/* Customer Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Cliente (opcional)</label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Venda sem cliente</SelectItem>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} ({customer.cpf_cnpj})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Forma de Pagamento</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
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

            {/* Installments */}
            {paymentMethod === 'installment' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Número de Parcelas</label>
                <Select value={installments.toString()} onValueChange={(value) => setInstallments(Number(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                      <SelectItem key={num} value={num.toString()}>{num}x</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Discount */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Desconto (R$)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </div>

            <Separator />

            {/* Total */}
            <div className="space-y-2">
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>R$ {getTotal().toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button 
                className="w-full" 
                onClick={finalizeSale}
                disabled={cart.length === 0}
              >
                Finalizar Venda
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={printReceipt}
                disabled={cart.length === 0}
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Cupom
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}