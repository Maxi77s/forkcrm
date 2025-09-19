"use client";

import type React from "react";
import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const PASSWORD_REGEX = /(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).+/;

export function LoginForm() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // LOGIN (tu back sigue pidiendo email+password para /auth/login)
  const [loginData, setLoginData] = useState({ email: "", password: "" });

  // REGISTER (DTO nuevo)
  const [registerData, setRegisterData] = useState({
    name: "",
    dni: "",
    password: "",
    confirmPassword: "",
    role: "CLIENT" as "CLIENT" | "OPERADOR" | "ADMIN",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(loginData.email, loginData.password);
      toast({ title: "¡Bienvenido!", description: "Has iniciado sesión correctamente" });
    } catch (error: any) {
      toast({
        title: "Error de autenticación",
        description: error?.message || "Credenciales incorrectas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const dniNum = Number(registerData.dni);
    if (!registerData.dni || Number.isNaN(dniNum)) {
      toast({ title: "DNI inválido", description: "Ingresa un número de DNI válido", variant: "destructive" });
      return;
    }
    if (!registerData.password || registerData.password.length < 6) {
      toast({ title: "Contraseña inválida", description: "Debe tener al menos 6 caracteres", variant: "destructive" });
      return;
    }
    if (!PASSWORD_REGEX.test(registerData.password)) {
      toast({
        title: "Contraseña débil",
        description: "Debe incluir mayúscula, minúscula, número y símbolo",
        variant: "destructive",
      });
      return;
    }
    if (registerData.password !== registerData.confirmPassword) {
      toast({ title: "Las contraseñas no coinciden", description: "Verifica los campos", variant: "destructive" });
      return;
    }
    if (!["CLIENT", "OPERADOR", "ADMIN"].includes(registerData.role)) {
      toast({
        title: "Rol inválido",
        description: "El rol debe ser CLIENT, OPERADOR o ADMIN",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await register(dniNum, registerData.password, registerData.role, registerData.name.trim() || undefined);
      toast({ title: "¡Cuenta creada!", description: "Tu cuenta ha sido creada exitosamente" });
    } catch (error: any) {
      const backendMsg = error?.response?.data?.message ?? error?.message ?? "No se pudo crear la cuenta";
      toast({ title: "Error de registro", description: String(backendMsg), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Depilzone</h1>
          <p className="text-gray-600 mt-2">Inicia sesión o crea una cuenta</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
            <TabsTrigger value="register">Registrarse</TabsTrigger>
          </TabsList>

          {/* LOGIN */}
          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Iniciar Sesión</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Iniciando sesión...
                      </>
                    ) : (
                      "Iniciar Sesión"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REGISTER (mismo estilo, campos del DTO) */}
          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Crear Cuenta</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nombre</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Tu nombre (opcional)"
                      value={registerData.name}
                      onChange={(e) => setRegisterData((s) => ({ ...s, name: e.target.value }))}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-dni">DNI</Label>
                    <Input
                      id="register-dni"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="12345678"
                      value={registerData.dni}
                      onChange={(e) => {
                        const onlyNums = e.target.value.replace(/\D+/g, "")
                        setRegisterData((s) => ({ ...s, dni: onlyNums }))
                      }}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password">Contraseña</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Mín. 6 caracteres (Aa1!)"
                      value={registerData.password}
                      onChange={(e) => setRegisterData((s) => ({ ...s, password: e.target.value }))}
                      required
                      disabled={isLoading}
                    />
                    <p className="text-xs text-gray-500">
                      Debe incluir mayúscula, minúscula, número y símbolo.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-confirm">Confirmar contraseña</Label>
                    <Input
                      id="register-confirm"
                      type="password"
                      placeholder="Repite la contraseña"
                      value={registerData.confirmPassword}
                      onChange={(e) => setRegisterData((s) => ({ ...s, confirmPassword: e.target.value }))}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-role">Rol</Label>
                    <select
                      id="register-role"
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={registerData.role}
                      onChange={(e) =>
                        setRegisterData((s) => ({ ...s, role: e.target.value as "CLIENT" | "OPERADOR" | "ADMIN" }))
                      }
                      disabled={isLoading}
                      required
                    >
                      <option value="CLIENT">Cliente</option>
                      <option value="OPERADOR">Operador</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creando cuenta...
                      </>
                    ) : (
                      "Crear Cuenta"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
