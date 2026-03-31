"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignalsPageRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin?step=signals");
  }, [router]);
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <p className="text-sm text-gray-500">Redirecting to workbench…</p>
    </div>
  );
}
