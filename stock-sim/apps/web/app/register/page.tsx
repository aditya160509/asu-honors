import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthShell>
      <div className="mb-7 flex flex-col gap-1">
        <h1 className="text-mkt-text-hero text-h1 font-semibold">Create An Account</h1>
        <p className="text-small text-mkt-text-muted">Start trading in the simulated market.</p>
      </div>
      <RegisterForm />
    </AuthShell>
  );
}
