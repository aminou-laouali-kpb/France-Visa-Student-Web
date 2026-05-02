import { SignIn, SignUp } from "@clerk/react";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <SignIn
        path={`${base}/sign-in`}
        signUpUrl={`${base}/sign-up`}
        forceRedirectUrl={`${base}/app`}
        routing="path"
      />
    </div>
  );
}

export function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <SignUp
        path={`${base}/sign-up`}
        signInUrl={`${base}/sign-in`}
        forceRedirectUrl={`${base}/app`}
        routing="path"
      />
    </div>
  );
}
