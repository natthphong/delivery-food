export type Me = {
    id: number;
    email: string | null;
    phone: string | null;
    provider: string | null;
    is_email_verified: boolean;
    is_phone_verified: boolean;
};
