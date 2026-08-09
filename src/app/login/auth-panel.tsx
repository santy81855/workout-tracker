"use client";

import { useState } from "react";
import { LoginForm, SignupForm } from "./login-form";

export function AuthPanel() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const signup = mode === "signup";
  return <>
    <p className="eyebrow">{signup ? "Create your account" : "Private access"}</p>
    <h1>{signup ? "Start training" : "Welcome back"}</h1>
    <p className="muted-copy auth-copy">{signup ? "Create a private account for your plans, workouts, and progress." : "Sign in to access your training data."}</p>
    {signup ? <SignupForm /> : <LoginForm />}
    <div className="auth-switch"><span>{signup ? "Already have an account?" : "New to Workout Tracker?"}</span><button onClick={() => setMode(signup ? "login" : "signup")} type="button">{signup ? "Sign in instead" : "Create an account"}</button></div>
  </>;
}
