"use client";

import PasswordResetForm from "@/components/PasswordResetForm";

export default function ClientResetPage() {
  return <PasswordResetForm apiBase="/api/client" loginHref="/compte/login" />;
}
