// Keep auth token strictly in JS memory (never localStorage or sessionStorage)
let ownerTokenInMemory: string | null = null;
let adminTokenInMemory: string | null = null;

export function getOwnerToken(): string | null {
  return ownerTokenInMemory;
}

export function setOwnerToken(token: string | null): void {
  ownerTokenInMemory = token;
}

export function getAdminToken(): string | null {
  return adminTokenInMemory;
}

export function setAdminToken(token: string | null): void {
  adminTokenInMemory = token;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { authMode?: 'owner' | 'admin' | 'none' } = {},
): Promise<T> {
  const { authMode = 'owner', headers, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  if (authMode === 'owner' && ownerTokenInMemory) {
    finalHeaders.Authorization = `Bearer ${ownerTokenInMemory}`;
  } else if (authMode === 'admin' && adminTokenInMemory) {
    finalHeaders.Authorization = `Bearer ${adminTokenInMemory}`;
  }

  const res = await fetch(path, {
    ...rest,
    headers: finalHeaders,
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new ApiError(data?.error || 'Erro ao comunicar com o servidor.', res.status);
  }
  return data as T;
}
