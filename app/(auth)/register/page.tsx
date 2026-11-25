"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { AuthShell } from "@/app/(auth)/_components/auth-shell";
import { registerWithPassword } from "@/lib/actions/auth";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [verificationSentTo, setVerificationSentTo] = React.useState<string | null>(null);

  const safeRedirectTarget =
    next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const res = await registerWithPassword({ email, password });
      if (!res.ok) {
        setErrorMsg(res.error.message);
        toast.error(res.error.message);
        return;
      }

      if (res.data.needsEmailVerification) {
        setVerificationSentTo(res.data.email);
        toast.success("Account created! Check your email to verify.");
      } else {
        toast.success("Account created! Welcome to RMS.");
        router.push(safeRedirectTarget);
        router.refresh();
      }
    });
  };

  return (
    <AuthShell>
      <Card className="rounded-lg border bg-card p-2 shadow-none">
        {verificationSentTo ? (
          <CardContent className="pt-6 pb-6 space-y-4 text-center">
            <div className="size-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground font-display">
                Check your email
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We sent a verification link to{" "}
                <span className="font-mono text-foreground font-semibold">
                  {verificationSentTo}
                </span>
                . Confirm your email address to sign in.
              </p>
            </div>
            <Link href="/login" className="block pt-1">
              <Button
                type="button"
                variant="outline"
                className="w-full h-[38px] text-xs font-mono"
              >
                Back to Sign in
              </Button>
            </Link>
          </CardContent>
        ) : (
          <>
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-lg font-bold text-foreground">
                Create your account
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Register with your email and a strong password to get started.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {errorMsg && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-email"
                    className="text-xs font-mono uppercase tracking-wider text-foreground"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reg-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoFocus
                      required
                      placeholder="you@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-[38px] rounded-control pl-9 text-sm"
                      disabled={isPending}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-password"
                    className="text-xs font-mono uppercase tracking-wider text-foreground"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-[38px] rounded-control pl-9 pr-9 text-sm"
                      disabled={isPending}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-confirm"
                    className="text-xs font-mono uppercase tracking-wider text-foreground"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reg-confirm"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-[38px] rounded-control pl-9 text-sm"
                      disabled={isPending}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full h-[38px] rounded-control bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                >
                  {isPending ? (
                    <Spinner className="size-4 mr-2" />
                  ) : (
                    <>
                      <span>Create account</span>
                      <ArrowRight className="ml-2 size-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="pt-3 border-t border-border/60 text-center text-xs font-mono text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href={next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login"}
                  className="text-foreground font-semibold underline underline-offset-4 hover:opacity-80"
                >
                  Sign in
                </Link>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-dvh w-full items-center justify-center bg-background">
          <Spinner className="size-6 text-foreground" />
        </div>
      }
    >
      <RegisterForm />
    </React.Suspense>
  );
}
