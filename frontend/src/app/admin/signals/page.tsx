import Link from "next/link";

export default function SignalsMergedPage() {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-6">
      <p className="text-center text-gray-300">
        Signals have been merged into Trend Discovery.
      </p>
      <Link
        href="/admin"
        className="text-blue-400 underline hover:text-blue-300"
      >
        Go to admin
      </Link>
    </div>
  );
}
