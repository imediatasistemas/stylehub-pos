import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import Dashboard from './Dashboard';
import PDV from './PDV';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-pulse">
            <h1 className="text-2xl font-bold mb-4">Carregando...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Sistema da Loja</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Gerencie sua loja de roupas de forma eficiente
          </p>
          <Button onClick={() => navigate('/auth')}>
            Fazer Login
          </Button>
        </div>
      </div>
    );
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'pdv':
        return <PDV />;
      case 'products':
        return <div>Gestão de Produtos (em desenvolvimento)</div>;
      case 'customers':
        return <div>Gestão de Clientes (em desenvolvimento)</div>;
      case 'sales':
        return <div>Relatório de Vendas (em desenvolvimento)</div>;
      case 'installments':
        return <div>Gestão de Carnês (em desenvolvimento)</div>;
      case 'settings':
        return <div>Configurações (em desenvolvimento)</div>;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6">
          {renderCurrentPage()}
        </main>
      </div>
    </div>
  );
};

export default Index;
