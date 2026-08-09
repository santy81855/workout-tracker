"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="login-form">
      <div className="field-group">
        <label htmlFor="email">Email</label>
        <input autoComplete="email" id="email" name="email" type="email" required />
        {state.fieldErrors?.email?.map((error) => <p className="field-error" key={error}>{error}</p>)}
      </div>
      <div className="field-group">
        <label htmlFor="password">Password</label>
        <input autoComplete="current-password" id="password" name="password" type="password" required />
        {state.fieldErrors?.password?.map((error) => <p className="field-error" key={error}>{error}</p>)}
      </div>
      {state.message ? <p className="form-message" role="status">{state.message}</p> : null}
      <button className="primary-button" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
