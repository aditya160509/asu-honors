import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-mkt-bg-void flex flex-col items-center justify-center gap-6 px-6">
      <Link href="/" className="text-mkt-text-hero text-h2 font-semibold tracking-tight">
        Stock Sim
      </Link>
      <RegisterForm />
      <p className="text-small text-mkt-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-text-link">
          Sign in
        </Link>
      </p>
    </main>
  );
}
