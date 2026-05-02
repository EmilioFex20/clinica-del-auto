import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-100 px-4">
      <form
        action={loginAction}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow text-black"
      >
        <h1 className="text-2xl font-bold">Clínica del Auto</h1>
        <p className="mt-1 text-sm text-black">
          Inicia sesión para crear registros.
        </p>

        {params.error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {params.error}
          </div>
        )}

        <label className="mt-5 block text-sm font-medium">Correo</label>
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-lg border px-3 py-2"
        />

        <label className="mt-4 block text-sm font-medium">Contraseña</label>
        <input
          name="password"
          type="password"
          required
          className="mt-1 w-full rounded-lg border px-3 py-2"
        />

        <button className="mt-6 w-full rounded-lg bg-black px-4 py-2 font-medium text-white">
          Entrar
        </button>
      </form>
    </main>
  );
}
