"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, KeyRound, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { requestLoginCode, verifyLoginCode } from "@/lib/actions/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [step, setStep] = React.useState<"email" | "code">("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const [countdown, setCountdown] = React.useState(0);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Countdown timer for resend
  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

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
        router.push(next);
        router.refresh();
      } else {
        setErrorMsg(res.error.message);
        toast.error(res.error.message);
      }
    });
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex size-10 items-center justify-center rounded-control bg-primary text-primary-foreground font-mono text-sm font-bold tracking-widest mb-2">
            F
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground font-display">
            Folio
          </h1>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Personal Content System
          </p>
        </div>

        <Card className="rounded-lg border bg-card p-2 shadow-none">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-bold text-foreground">
              {step === "email" ? "Sign in to your account" : "Enter verification code"}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {step === "email"
                ? "Access is restricted to the registered owner email. Enter your email to receive a 6-digit code."
                : `We sent a 6-digit code to ${email}. Code expires in 60 minutes.`}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMsg && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {errorMsg}
              </div>
            )}

            {step === "email" ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-mono uppercase tracking-wider text-foreground">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoFocus
                      required
                      placeholder="owner@domain.com"
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
                      <span>Verify & Enter</span>
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
          </CardContent>
        </Card>

        <p className="text-center text-[11px] font-mono tracking-wider text-muted-foreground">
          SECURE 6-DIGIT PASSCODE · NO PASSWORD REQUIRED
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center bg-background">
          <Spinner className="size-6 text-foreground" />
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
