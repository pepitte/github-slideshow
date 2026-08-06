"use client";

import PasswordResetForm from "@/components/PasswordResetForm";

export default function ProResetPage() {
  return <PasswordResetForm apiBase="/api/pro" loginHref="/pro/login" />;
}
