export const ROLE_PERMS: Record<string, string[]> = {
  admin: ['*'],
  gerente: ['dashboard','pedidos','pdv','mesas','caixa','cardapio','clientes','entregas','relatorios','promocoes','estoque','cozinha','config'],
  caixa: ['dashboard','pedidos','pdv','mesas','caixa','clientes'],
  cozinha: ['cozinha','pedidos'],
  entregador: ['entregas'],
};

export function can(role: string, area: string) {
  const p = ROLE_PERMS[role] || [];
  return p.includes('*') || p.includes(area);
}

const AREA_BY_PATH: [string, string][] = [
  ['/admin/pedidos', 'pedidos'],
  ['/admin/pdv', 'pdv'],
  ['/admin/mesas', 'mesas'],
  ['/admin/cozinha', 'cozinha'],
  ['/admin/caixa', 'caixa'],
  ['/admin/notas', 'caixa'],
  ['/admin/produtos', 'cardapio'],
  ['/admin/categorias', 'cardapio'],
  ['/admin/adicionais', 'cardapio'],
  ['/admin/clientes', 'clientes'],
  ['/admin/entregas', 'entregas'],
  ['/admin/estoque', 'estoque'],
  ['/admin/relatorios', 'relatorios'],
  ['/admin/promocoes', 'promocoes'],
  ['/admin/equipe', 'config'],
  ['/admin/configuracoes', 'config'],
];

export function areaForPath(path: string): string {
  if (path === '/admin' || path.startsWith('/admin/')) {
    for (const [prefix, area] of AREA_BY_PATH) {
      if (path.startsWith(prefix)) return area;
    }
    return 'dashboard';
  }
  return 'dashboard';
}

export const ROLE_HOME: Record<string, string> = {
  admin: '/admin',
  gerente: '/admin',
  caixa: '/admin',
  cozinha: '/admin/cozinha',
  entregador: '/admin/entregas',
};
