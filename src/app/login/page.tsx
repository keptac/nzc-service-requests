import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="auth-page">
      <div className="angel-field" aria-hidden="true">
        <span className="angel-hologram angel-one" />
        <span className="angel-hologram angel-two" />
        <span className="angel-hologram angel-three" />
      </div>
      <section className="auth-panel">
        <div className="auth-panel-content">
          <Brand tone="light" />
          <div className="auth-copy">
            <span className="auth-eyebrow">Approval workflow</span>
            <h1>North Zimbabwe Conference</h1>
            <p>
              Track local church requests through pastor, conference, and union review with comments,
              notifications, and a complete audit trail.
            </p>
          </div>
          <div className="auth-metrics" aria-label="System highlights">
            <div>
              <strong>4</strong>
              <span>Hierarchy levels</span>
            </div>
            <div>
              <strong>14</strong>
              <span>Supported roles</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>Action history</span>
            </div>
          </div>
        </div>
      </section>
      <section className="login-card" aria-label="Sign in">
        <div className="login-card-header">
          <span className="auth-eyebrow">Secure access</span>
          <h2>Welcome back</h2>
          <p>Sign in to review, approve, and monitor service requests.</p>
        </div>
        <LoginForm />
        <div className="demo-list">
          <strong>Seed credentials</strong>
          <span>super.admin@zeuc.local / Password123!</span>
          <span>arcadia@ezc.adventist.org / Password123!</span>
          <span>banket@nzc.adventist.org / Password123!</span>
          <span>sibandab@nzc.adventist.org / Password123!</span>
        </div>
      </section>
    </main>
  );
}
