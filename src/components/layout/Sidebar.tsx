import { useState } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  CreditCard, 
  FileText, 
  Settings,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pdv', label: 'PDV', icon: ShoppingCart },
  { id: 'products', label: 'Produtos', icon: Package },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'sales', label: 'Vendas', icon: CreditCard },
  { id: 'installments', label: 'Carnês', icon: FileText },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={cn(
      "bg-sidebar border-r border-sidebar-border h-screen transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-8">
          {!isCollapsed && (
            <h1 className="text-xl font-bold text-sidebar-primary">Loja Sistema</h1>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>
        
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={currentPage === item.id ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start text-sidebar-foreground",
                  currentPage === item.id 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isCollapsed && "px-2"
                )}
                onClick={() => onPageChange(item.id)}
              >
                <Icon className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                {!isCollapsed && <span>{item.label}</span>}
              </Button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}