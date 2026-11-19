import { signIn } from "@/auth";
export default function Login() {
  return (
    <main className="login">
      <h1>PM Job Radar</h1>
      <p className="mut">Private. Sign in with an allowed Google account.</p>
      <form action={async () => { "use server"; await signIn("google", { redirectTo: "/" }); }}>
        <button className="pri" type="submit">Continue with Google</button>
      </form>
    </main>
  );
}
