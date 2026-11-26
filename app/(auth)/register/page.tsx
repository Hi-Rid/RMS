"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  MailCheck,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { AuthShell } from "@/app/(auth)/_components/auth-shell";
import { registerWithPassword, resendVerificationEmail } from "@/lib/actions/auth";

function buildQueryHref(
  base: string,
  params: { next?: string; email?: string; mode?: string }
): string {
  const qs = new URLSearchParams();
  if (params.next && params.next !== "/home" && params.next !== "/") {
    qs.set("next", params.next);
  }
  if (params.email?.trim()) {
    qs.set("email", params.email.trim());
  }
  if (params.mode) {
    qs.set("mode", params.mode);
  }
  const q = qs.toString();
  return q ? `${base}?${q}` : base;
}

function getPasswordStrength(pw: string): {
  score: 0 | 1 | 2 | 3;
  label: string;
} {
  if (!pw) return { score: 0, label: "" };
  if (pw.length < 8) return { score: 1, label: "Too short" };
  let variety = 0;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) variety += 1;
  if (/\d/.test(pw)) variety += 1;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) variety += 1;
  if (variety >= 2) return { score: 3, label: "Strong" };
  return { score: 2, label: "Fair" };
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/home";
  const urlEmail = searchParams.get("email") || "";

  const [email, setEmail] = React.useState(urlEmail);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isAccountConflict, setIsAccountConflict] = React.useState(false);
  const [verificationSentTo, setVerificationSentTo] = React.useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = React.useState(0);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const safeRedirectTarget =
    next.startsWith("/") && !next.startsWith("//") ? next : "/home";
  const loginHref = buildQueryHref("/login", { next, email });
  const otpLoginHref = buildQueryHref("/login", {
    next,
    email: verificationSentTo || email,
    mode: "otp",
  });

  const hasMinLength = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const strength = getPasswordStrength(password);
  const busy = isPending || isRedirecting;

  const resetError = () => {
    setErrorMsg(null);
    setIsAccountConflict(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (!hasMinLength) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    resetError();
    startTransition(async () => {
      const res = await registerWithPassword({ email: cleanEmail, password });
      if (!res.ok) {
        setErrorMsg(res.error.message);
        setIsAccountConflict(res.error.code === "conflict");
        toast.error(res.error.message);
        return;
      }

      if (res.data.needsEmailVerification) {
        setVerificationSentTo(res.data.email);
        setResendCooldown(60);
        toast.success("Account created! Check your email to verify.");
      } else {
        setIsRedirecting(true);
        toast.success("Account created! Welcome to RMS.");
        window.location.assign(safeRedirectTarget);
      }
    });
  };

  const handleResendLink = () => {
    if (!verificationSentTo || resendCooldown > 0 || busy) return;
    startTransition(async () => {
      const res = await resendVerificationEmail({ email: verificationSentTo });
      if (res.ok) {
        setResendCooldown(60);
        toast.success(res.data.message);
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <AuthShell mode="register" footerText="ENCRYPTED WORKSPACE · EMAIL CONFIRMATION">
      <Card className="rounded-lg border border-border border-t-2 border-t-brand bg-card p-1 sm:p-2 shadow-none">
        {verificationSentTo ? (
          <CardContent className="pt-6 pb-6 px-5 space-y-5">
            <div className="text-center space-y-2.5">
              <div className="size-11 rounded-md bg-success/10 border border-success/30 text-success flex items-center justify-center mx-auto">
                <MailCheck className="size-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-black text-foreground font-display tracking-tight">
                  Check your email inbox
                </h2>
                <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                  We sent a confirmation link to{" "}
                  <span className="text-foreground font-bold">{verificationSentTo}</span>. Open the link to activate your studio access.
                </p>
              </div>
            </div>

            <div className="rounded-md border border-border bg-secondary/40 p-3 text-[11px] font-mono text-muted-foreground space-y-1.5">
              <div className="font-semibold text-foreground">Didn&apos;t see it right away?</div>
              <p className="leading-relaxed">
                Check your Spam or Promotions folder. Links work once; request a new link below if needed.
              </p>
            </div>

            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy || resendCooldown > 0}
                onClick={handleResendLink}
                className="w-full h-9 text-xs font-mono gap-1.5"
              >
                <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
                <span>
                  {resendCooldown > 0
                    ? `Resend link (${resendCooldown}s)`
                    : "Resend verification link"}
                </span>
              </Button>

              <Button
                asChild
                className="w-full h-10 rounded-md bg-brand text-brand-foreground hover:bg-brand/90 text-xs font-mono font-bold uppercase tracking-wider gap-1.5"
              >
                <Link href={loginHref}>
                  <span>Continue to Sign in</span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>

              <div className="flex items-center justify-between pt-2 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => {
                    setVerificationSentTo(null);
                    setPassword("");
                    setConfirmPassword("");
                    resetError();
                  }}
                  className="text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  Use different email
                </button>

                <Link
                  href={otpLoginHref}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 underline underline-offset-4"
                >
                  <KeyRound className="size-3" />
                  <span>Try Email Code</span>
                </Link>
              </div>
            </div>
          </CardContent>
        ) : (
          <>
            <CardHeader className="space-y-1 pb-4 pt-5 px-5">
              <CardTitle className="text-xl font-black font-display tracking-tight text-foreground">
                Create your account
              </CardTitle>
              <CardDescription className="text-xs font-mono text-muted-foreground leading-relaxed">
                Register your email and set a password (8+ characters) to unlock RMS.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 px-5 pb-5">
              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs font-mono text-destructive space-y-2"
                >
                  <div className="flex items-start gap-2 leading-relaxed">
                    <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>

                  {isAccountConflict && (
                    <div className="pt-1 border-t border-destructive/20">
                      <Link
                        href={loginHref}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground underline underline-offset-4 hover:text-brand"
                      >
                        <span>Sign in with {email.trim() || "this email"}</span>
                        <ArrowRight className="size-3" />
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-email"
                    className="label-mono text-foreground block"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      id="reg-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoFocus
                      required
                      placeholder="you@domain.com"
                      value={email}
                      onChange={(e) => {
                        resetError();
                        setEmail(e.target.value);
                      }}
                      className="h-10 rounded-md pl-9 text-xs font-mono"
                      disabled={busy}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-password"
                    className="label-mono text-foreground block"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => {
                        resetError();
                        setPassword(e.target.value);
                      }}
                      className="h-10 rounded-md pl-9 pr-10 text-xs font-mono"
                      disabled={busy}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>

                  {password.length > 0 && (
                    <div className="space-y-1 pt-0.5">
                      <div className="grid grid-cols-3 gap-1">
                        {[1, 2, 3].map((stepIdx) => (
                          <div
                            key={stepIdx}
                            className={`h-1 rounded-sm transition-colors ${
                              strength.score >= stepIdx
                                ? strength.score === 1
                                  ? "bg-brand"
                                  : strength.score === 2
                                  ? "bg-warning"
                                  : "bg-success"
                                : "bg-secondary"
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                        <span>Strength: {strength.label}</span>
                        <span>Mix upper, digits, or 12+ chars</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-confirm"
                    className="label-mono text-foreground block"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      id="reg-confirm"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => {
                        resetError();
                        setConfirmPassword(e.target.value);
                      }}
                      className="h-10 rounded-md pl-9 pr-10 text-xs font-mono"
                      disabled={busy}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {(password.length > 0 || confirmPassword.length > 0) && (
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-0.5">
                    <div
                      className={`flex items-center gap-1.5 ${
                        hasMinLength ? "text-success" : "text-muted-foreground"
                      }`}
                    >
                      <Check className="size-3 shrink-0" />
                      <span>8+ characters</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 ${
                        confirmPassword.length > 0 && passwordsMatch
                          ? "text-success"
                          : confirmPassword.length > 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      <Check className="size-3 shrink-0" />
                      <span>
                        {confirmPassword.length > 0 && !passwordsMatch
                          ? "Passwords mismatch"
                          : "Passwords match"}
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full h-10 rounded-md bg-brand text-brand-foreground hover:bg-brand/90 font-mono text-xs font-bold uppercase tracking-wider"
                >
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="size-4" />
                      <span>{isRedirecting ? "Opening workspace..." : "Creating account..."}</span>
                    </span>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="ml-1.5 size-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="pt-3 border-t border-border/60 text-center text-xs font-mono text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href={loginHref}
                  className="text-foreground font-semibold underline underline-offset-4 hover:text-brand transition-colors"
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
