export const roles = {
  super_admin: "Super Admin",
  organization_admin: "Admin Organisasi",
  coordinator: "Koordinator Wasit",
  finance: "Staf Keuangan",
  referee: "Wasit",
} as const;

export type Role = keyof typeof roles;
export type Membership = { id: string; name: string; role: Role };
