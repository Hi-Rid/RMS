"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { AuthShell } from "@/app/(auth)/_components/auth-shell";
import {
  requestLoginCode,
  resendVerificationEmail,
  signInWithPassword,
  verifyLoginCode,
} from "@/lib/actions/auth";

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

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/home";
  const urlError = searchParams.get("error");
  const urlMode = searchParams.get("mode");
  const urlEmail = searchParams.get("email") || "";

  const [mode, setMode] = React.useState<"password" | "otp">(
    urlMode === "otp" ? "otp" : "password"
  );
  const [step, setStep] = React.useState<"email" | "code">("email");

  const [email, setEmail] = React.useState(urlEmail);
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [countdown, setCountdown] = React.useState(0);
  const [verifyCooldown, setVerifyCooldown] = React.useState(0);
  const [needsEmailConfirm, setNeedsEmailConfirm] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(
    urlError === "invalid_link"
      ? "Verification link is invalid or expired. Sign in or request a 6-digit code below."
      : null
  );

  const lastAutoSubmittedCodeRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (countdown <= 0 && verifyCooldown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      setVerifyCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown, verifyCooldown]);

  const safeRedirectTarget =
    next.startsWith("/") && !next.startsWith("//") ? next : "/home";

  const resetError = () => {
    setErrorMsg(null);
    setNeedsEmailConfirm(false);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }

    resetError();
    startTransition(async () => {
      const res = await signInWithPassword({ email: cleanEmail, password });
      if (res.ok) {
        setIsRedirecting(true);
        toast.success("Signed in! Opening workspace...");
        window.location.assign(safeRedirectTarget);
      } else {
        setErrorMsg(res.error.message);
        setNeedsEmailConfirm(res.error.fieldErrors?.reason === "email_unconfirmed");
        toast.error(res.error.message);
      }
    });
  };

  const handleResendConfirmEmail = () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@") || verifyCooldown > 0) return;

    startTransition(async () => {
      const res = await resendVerificationEmail({ email: cleanEmail });
      if (res.ok) {
        setVerifyCooldown(60);
        toast.success(res.data.message);
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleSendCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    resetError();
    lastAutoSubmittedCodeRef.current = null;
    startTransition(async () => {
      const res = await requestLoginCode({ email: cleanEmail });
      if (res.ok) {
        setEmail(cleanEmail);
        setCode("");
        setStep("code");
        setCountdown(60);
        toast.info(res.data.message);
      } else {
        setErrorMsg(res.error.message);
        toast.error(res.error.message);
      }
    });
  };

  const submitOtpCode = (codeToVerify: string) => {
    const cleanEmail = email.trim();
    if (codeToVerify.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit code.");
      return;
    }

    setErrorMsg(null);
    setNeedsEmailConfirm(false);
    startTransition(async () => {
      const res = await verifyLoginCode({ email: cleanEmail, code: codeToVerify });
      if (res.ok) {
        setIsRedirecting(true);
        toast.success("Signed in! Opening workspace...");
        window.location.assign(safeRedirectTarget);
      } else {
        setErrorMsg(res.error.message);
        toast.error(res.error.message);
      }
    });
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    submitOtpCode(code);
  };

  const busy = isPending || isRedirecting;
  const registerHref = buildQueryHref("/register", { next, email });

  return (
    <AuthShell mode="login" footerText="PASSWORD OR 6-DIGIT PASSCODE ACCESS">
      <Card className="rounded-lg border border-border border-t-2 border-t-brand bg-card p-1 sm:p-2 shadow-none">
        <CardHeader className="space-y-4 pb-4 pt-4 px-5">
          {/* Mode Switcher: Password vs Email Code */}
          <div
            role="tablist"
            aria-label="Sign in method"
            className="grid grid-cols-2 gap-1 p-1 rounded-md bg-secondary border border-border"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "password"}
              disabled={busy}
              onClick={() => {
                setMode("password");
                resetError();
              }}
              className={`h-8 rounded text-xs font-mono uppercase tracking-wider inline-flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                mode === "password"
                  ? "bg-card text-foreground font-bold border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Lock className="size-3" />
              <span>Password</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "otp"}
              disabled={busy}
              onClick={() => {
                setMode("otp");
                setStep("email");
                setCode("");
                lastAutoSubmittedCodeRef.current = null;
                resetError();
              }}
              className={`h-8 rounded text-xs font-mono uppercase tracking-wider inline-flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                mode === "otp"
                  ? "bg-card text-foreground font-bold border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <KeyRound className="size-3" />
              <span>Email Code</span>
            </button>
          </div>

          <div className="space-y-1">
            <CardTitle className="text-xl font-black font-display tracking-tight text-foreground">
              {mode === "otp" && step === "code"
                ? "Enter verification code"
                : "Sign in to RMS"}
            </CardTitle>
            <CardDescription className="text-xs font-mono text-muted-foreground leading-relaxed">
              {mode === "password"
                ? "Enter your email and password to open your studio."
                : step === "email"
                ? "No password needed — get a one-time 6-digit login code via email."
                : `If ${email.trim()} is registered, a 6-digit passcode was sent (valid 60 mins).`}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-5 pb-5">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs font-mono text-destructive space-y-2.5"
            >
              <div className="flex items-start gap-2 leading-relaxed">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>

              {needsEmailConfirm && (
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-destructive/20">
                  <button
                    type="button"
                    disabled={busy || verifyCooldown > 0}
                    onClick={handleResendConfirmEmail}
                    className="text-[11px] font-semibold underline underline-offset-4 text-foreground hover:text-brand disabled:opacity-50"
                  >
                    {verifyCooldown > 0
                      ? `Verification sent (${verifyCooldown}s)`
                      : "Resend verification email"}
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setMode("otp");
                      setStep("email");
                      resetError();
                    }}
                    className="text-[11px] font-semibold underline underline-offset-4 text-foreground hover:text-brand"
                  >
                    Use 6-digit code
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === "password" ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="login-email"
                  className="label-mono text-foreground block"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="login-email"
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
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="login-password"
                    className="label-mono text-foreground"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setMode("otp");
                      setStep("email");
                      resetError();
                    }}
                    className="text-[11px] font-mono text-brand hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded"
                  >
                    Forgot password? Use code
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="Enter your password"
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
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={busy}
                className="w-full h-10 rounded-md bg-brand text-brand-foreground hover:bg-brand/90 font-mono text-xs font-bold uppercase tracking-wider"
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="size-4" />
                    <span>{isRedirecting ? "Opening workspace..." : "Signing in..."}</span>
                  </span>
                ) : (
                  <>
                    <span>Sign in to Studio</span>
                    <ArrowRight className="ml-1.5 size-4" />
                  </>
                )}
              </Button>
            </form>
          ) : step === "email" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="otp-email"
                  className="label-mono text-foreground block"
                >
                  Registered Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="otp-email"
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

              <Button
                type="submit"
                disabled={busy}
                className="w-full h-10 rounded-md bg-brand text-brand-foreground hover:bg-brand/90 font-mono text-xs font-bold uppercase tracking-wider"
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="size-4" />
                    <span>Sending code...</span>
                  </span>
                ) : (
                  <>
                    <span>Send 6-Digit Code</span>
                    <ArrowRight className="ml-1.5 size-4" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="rounded-md border border-border bg-secondary/50 px-3 py-2 flex items-center justify-between gap-2 text-xs font-mono">
                <span className="text-muted-foreground truncate">
                  Code to: <strong className="text-foreground">{email.trim()}</strong>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    lastAutoSubmittedCodeRef.current = null;
                    resetError();
                  }}
                  className="text-[11px] text-brand hover:underline underline-offset-4 shrink-0 font-semibold"
                >
                  Change
                </button>
              </div>

              <div className="space-y-2 flex flex-col items-center">
                <label
                  htmlFor="otp-code"
                  className="label-mono text-foreground self-start"
                >
                  6-digit passcode
                </label>
                <InputOTP
                  id="otp-code"
                  aria-label="6-digit verification code"
                  maxLength={6}
                  value={code}
                  onChange={(val) => {
                    const digits = val.replace(/\D/g, "").slice(0, 6);
                    setErrorMsg(null);
                    setCode(digits);
                    if (
                      digits.length === 6 &&
                      lastAutoSubmittedCodeRef.current !== digits &&
                      !busy
                    ) {
                      lastAutoSubmittedCodeRef.current = digits;
                      submitOtpCode(digits);
                    }
                  }}
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  disabled={busy}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <p className="text-[11px] font-mono text-muted-foreground self-start">
                  Auto-verifies once all 6 digits are entered. Check spam if missing.
                </p>
              </div>

              <Button
                type="submit"
                disabled={busy || code.length !== 6}
                className="w-full h-10 rounded-md bg-brand text-brand-foreground hover:bg-brand/90 font-mono text-xs font-bold uppercase tracking-wider"
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="size-4" />
                    <span>{isRedirecting ? "Opening workspace..." : "Verifying..."}</span>
                  </span>
                ) : (
                  <>
                    <KeyRound className="mr-1.5 size-4" />
                    <span>Verify &amp; Enter</span>
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between pt-1 text-xs font-mono">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    lastAutoSubmittedCodeRef.current = null;
                    resetError();
                  }}
                  className="text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  Use different email
                </button>

                <button
                  type="button"
                  disabled={countdown > 0 || busy}
                  onClick={() => handleSendCode()}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <RefreshCw className={`size-3 ${isPending ? "animate-spin" : ""}`} />
                  {countdown > 0 ? `Resend (${countdown}s)` : "Resend code"}
                </button>
              </div>
            </form>
          )}

          <div className="pt-3 border-t border-border/60 text-center text-xs font-mono text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href={registerHref}
              className="text-foreground font-semibold underline underline-offset-4 hover:text-brand transition-colors"
            >
              Create account
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-dvh w-full items-center justify-center bg-background">
          <Spinner className="size-6 text-foreground" />
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
