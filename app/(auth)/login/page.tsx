"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
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
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { AuthShell } from "@/app/(auth)/_components/auth-shell";
import {
  requestLoginCode,
  signInWithPassword,
  verifyLoginCode,
} from "@/lib/actions/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const urlError = searchParams.get("error");

  const [mode, setMode] = React.useState<"password" | "otp">("password");
  const [step, setStep] = React.useState<"email" | "code">("email");

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const [countdown, setCountdown] = React.useState(0);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(
    urlError === "invalid_link"
      ? "Verification link is invalid or expired. Please sign in again."
      : null
  );

  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const safeRedirectTarget =
    next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const res = await signInWithPassword({ email, password });
      if (res.ok) {
        toast.success("Welcome back!");
        router.push(safeRedirectTarget);
        router.refresh();
      } else {
        setErrorMsg(res.error.message);
        toast.error(res.error.message);
      }
    });
  };

  const handleSendCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const res = await requestLoginCode({ email });
      if (res.ok) {
        setStep("code");
        setCountdown(60);
        toast.info(res.data.message);
      } else {
        setErrorMsg(res.error.message);
        toast.error(res.error.message);
      }
    });
  };

  const handleVerifyCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (code.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit code.");
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const res = await verifyLoginCode({ email, code });
      if (res.ok) {
        toast.success("Welcome back!");
        router.push(safeRedirectTarget);
        router.refresh();
      } else {
        setErrorMsg(res.error.message);
        toast.error(res.error.message);
      }
    });
  };

  return (
    <AuthShell footerText="EMAIL & PASSWORD OR 6-DIGIT PASSCODE">
      <Card className="rounded-lg border bg-card p-2 shadow-none">
        <CardHeader className="space-y-3 pb-4">
          {/* Mode Switcher: Password vs Email Code */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-secondary border border-border/70">
            <button
              type="button"
              onClick={() => {
                setMode("password");
                setErrorMsg(null);
              }}
              className={`h-7 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
                mode === "password"
                  ? "bg-background text-foreground font-bold border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("otp");
                setStep("email");
                setErrorMsg(null);
              }}
              className={`h-7 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
                mode === "otp"
                  ? "bg-background text-foreground font-bold border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Email Code
            </button>
          </div>

          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-foreground">
              {mode === "otp" && step === "code"
                ? "Enter verification code"
                : "Sign in to your account"}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {mode === "password"
                ? "Enter your email and password to access your studio."
                : step === "email"
                ? "Enter your registered email to receive a 6-digit passcode."
                : `We sent a 6-digit code to ${email}. Code expires in 60 minutes.`}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMsg && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {errorMsg}
            </div>
          )}

          {mode === "password" ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="login-email"
                  className="text-xs font-mono uppercase tracking-wider text-foreground"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-email"
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
                  htmlFor="login-password"
                  className="text-xs font-mono uppercase tracking-wider text-foreground"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="Enter your password"
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

              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-[38px] rounded-control bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              >
                {isPending ? (
                  <Spinner className="size-4 mr-2" />
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="ml-2 size-4" />
                  </>
                )}
              </Button>
            </form>
          ) : step === "email" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="otp-email"
                  className="text-xs font-mono uppercase tracking-wider text-foreground"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="otp-email"
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

              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-[38px] rounded-control bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              >
                {isPending ? (
                  <Spinner className="size-4 mr-2" />
                ) : (
                  <>
                    <span>Send code</span>
                    <ArrowRight className="ml-2 size-4" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div className="space-y-2 flex flex-col items-center">
                <label className="text-xs font-mono uppercase tracking-wider text-foreground self-start">
                  6-digit code
                </label>
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(val) => setCode(val)}
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  disabled={isPending}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                type="submit"
                disabled={isPending || code.length !== 6}
                className="w-full h-[38px] rounded-control bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              >
                {isPending ? (
                  <Spinner className="size-4 mr-2" />
                ) : (
                  <>
                    <KeyRound className="mr-2 size-4" />
                    <span>Verify &amp; Enter</span>
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setErrorMsg(null);
                  }}
                  className="text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  Use different email
                </button>

                <button
                  type="button"
                  disabled={countdown > 0 || isPending}
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
              href={next && next !== "/" ? `/register?next=${encodeURIComponent(next)}` : "/register"}
              className="text-foreground font-semibold underline underline-offset-4 hover:opacity-80"
            >
              Register
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
