export default function HomePage(): React.ReactNode {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Yield Tokenization Protocol</h1>
        <p className="mt-4 text-lg text-muted">
          Split yield-bearing assets into Principal and Yield Tokens
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <div className="rounded-lg border border-border bg-surface p-6">
            <h2 className="text-xl font-semibold">Coming Soon</h2>
            <p className="mt-2 text-sm text-muted">Connect your wallet to get started</p>
          </div>
        </div>
      </div>
    </main>
  );
}
