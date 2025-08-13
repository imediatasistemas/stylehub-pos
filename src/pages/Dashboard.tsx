
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Package, Users, DollarSign } from 'lucide-react';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [salesToday, setSalesToday] = useState(0);
  const [salesMonth, setSalesMonth] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [customersCount, setCustomersCount] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Vendas de hoje
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      // Vendas Hoje
      const { count: countToday } = await supabase
        .from('sales')
        .select('id', { count: 'exact', head: true })
        .gte('sale_date', startOfDay.toISOString())
        .lt('sale_date', endOfDay.toISOString());
      setSalesToday(countToday || 0);

      // Vendas Mês
      const { count: countMonth } = await supabase
        .from('sales')
        .select('id', { count: 'exact', head: true })
        .gte('sale_date', startOfMonth.toISOString())
        .lt('sale_date', endOfMonth.toISOString());
      setSalesMonth(countMonth || 0);

      // Total de produtos
      const { count: countProducts } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true });
      setProductsCount(countProducts || 0);

      // Total de clientes
      const { count: countCustomers } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true });
      setCustomersCount(countCustomers || 0);

      // Produtos em falta (estoque <= 2)
      const { data: lowStock } = await supabase
        .from('products')
        .select('name, stock_quantity')
        .lte('stock_quantity', 2)
        .order('stock_quantity', { ascending: true })
        .limit(5);
      setLowStockProducts(lowStock || []);

      setLoading(false);
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu negócio</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Hoje</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : salesToday}</div>
            <p className="text-xs text-muted-foreground">Total de vendas realizadas hoje</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : productsCount}</div>
            <p className="text-xs text-muted-foreground">Total de produtos cadastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : customersCount}</div>
            <p className="text-xs text-muted-foreground">Total de clientes cadastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Mês</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : salesMonth}</div>
            <p className="text-xs text-muted-foreground">Total de vendas realizadas neste mês</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Vendas dos Últimos 7 Dias</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Gráfico de vendas será implementado aqui
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Produtos em Falta</CardTitle>
            <CardDescription>Produtos com estoque baixo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                <div>Carregando...</div>
              ) : lowStockProducts.length === 0 ? (
                <div>Nenhum produto com estoque baixo.</div>
              ) : (
                lowStockProducts.map((p: any, idx: number) => (
                  <div className="flex items-center" key={idx}>
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium leading-none">{p.name}</p>
                      <p className="text-sm text-muted-foreground">Estoque: {p.stock_quantity} unidade{p.stock_quantity === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}