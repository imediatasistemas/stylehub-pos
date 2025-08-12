# Sistema da Loja - POS

Sistema de gestão e ponto de venda para lojas de roupas, desenvolvido com React, TypeScript e Supabase.

## Funcionalidades

- **Dashboard**: Visão geral do negócio com métricas importantes
- **PDV (Ponto de Venda)**: Sistema completo de vendas com carrinho de compras
- **Gestão de Produtos**: Cadastro e controle de estoque
- **Gestão de Clientes**: Cadastro e histórico de clientes
- **Relatórios de Vendas**: Análise de vendas e performance
- **Gestão de Carnês**: Controle de vendas parceladas
- **Autenticação**: Sistema de login seguro com Supabase

## Tecnologias Utilizadas

- **Frontend**: React 18 + TypeScript
- **UI**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **Build Tool**: Vite
- **Roteamento**: React Router DOM
- **Estado**: React Query (TanStack Query)

## Como Executar o Projeto

### Pré-requisitos

- Node.js 18+ 
- npm ou yarn

### Instalação

```bash
# Clone o repositório
git clone <URL_DO_REPOSITORIO>

# Entre no diretório
cd stylehub-pos

# Instale as dependências
npm install

# Configure as variáveis de ambiente
# Crie um arquivo .env.local com suas credenciais do Supabase
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase

# Execute o projeto
npm run dev
```

### Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Gera build de produção
- `npm run preview` - Visualiza o build de produção
- `npm run lint` - Executa o linter

## Estrutura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
│   ├── layout/         # Componentes de layout (Header, Sidebar)
│   └── ui/            # Componentes UI do shadcn/ui
├── hooks/             # Hooks customizados
├── integrations/      # Integrações externas (Supabase)
├── lib/              # Utilitários e configurações
├── pages/            # Páginas da aplicação
└── main.tsx          # Ponto de entrada
```

## Configuração do Supabase

O projeto utiliza Supabase como backend. Para configurar:

1. Crie uma conta no [Supabase](https://supabase.com)
2. Crie um novo projeto
3. Configure as tabelas conforme as migrações em `supabase/migrations/`
4. Configure as variáveis de ambiente com suas credenciais

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.
