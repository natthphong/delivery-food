import type { AdminSession } from "@/types/admin";

export function hasAdminPermission(session: AdminSession | null, permission: string) {
    return !!session?.permissions?.includes(permission);
}

export function hasAnyAdminPermission(session: AdminSession | null, permissions: string[]) {
    return permissions.some((permission) => hasAdminPermission(session, permission));
}

export function hasAdminRole(session: AdminSession | null, role: string) {
    return !!session?.roles?.includes(role);
}
