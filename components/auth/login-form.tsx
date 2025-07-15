// "use client"

// import type React from "react"

// import { useState } from "react"
// import { useAuth } from "@/components/providers/auth-provider"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Label } from "@/components/ui/label"
// import { Alert, AlertDescription } from "@/components/ui/alert"
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// import { useToast } from "@/hooks/use-toast"
// import { Loader2, User, Headphones } from "lucide-react"

// export function LoginForm() {
//   const { login, register } = useAuth()
//   const { toast } = useToast()
//   const [isLoading, setIsLoading] = useState(false)
//   const [loginData, setLoginData] = useState({ email: "", password: "" })
//   const [registerData, setRegisterData] = useState({ email: "", password: "", role: "CLIENT" })

//   const handleLogin = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setIsLoading(true)

//     try {
//       console.log("🔐 [LOGIN-FORM] Iniciando login...")
//       await login(loginData.email, loginData.password)
//       console.log("✅ [LOGIN-FORM] Login exitoso")
//       toast({
//         title: "¡Bienvenido!",
//         description: "Has iniciado sesión correctamente",
//       })
//     } catch (error: any) {
//       console.error("❌ [LOGIN-FORM] Error en login:", error)
//       toast({
//         title: "Error de autenticación",
//         description: error.message || "Credenciales incorrectas",
//         variant: "destructive",
//       })
//     } finally {
//       setIsLoading(false)
//     }
//   }

//   const handleRegister = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setIsLoading(true)

//     try {
//       console.log("📝 [LOGIN-FORM] Iniciando registro...")
//       await register(registerData.email, registerData.password, registerData.role)
//       console.log("✅ [LOGIN-FORM] Registro exitoso")
//       toast({
//         title: "¡Cuenta creada!",
//         description: "Tu cuenta ha sido creada exitosamente",
//       })
//     } catch (error: any) {
//       console.error("❌ [LOGIN-FORM] Error en registro:", error)
//       toast({
//         title: "Error de registro",
//         description: error.message || "No se pudo crear la cuenta",
//         variant: "destructive",
//       })
//     } finally {
//       setIsLoading(false)
//     }
//   }

//   const handleQuickLogin = async (email: string, password: string, role: string) => {
//     setIsLoading(true)
//     try {
//       console.log(`🚀 [LOGIN-FORM] Login rápido como ${role}:`, email)
//       await login(email, password)
//       toast({
//         title: `¡Bienvenido ${role}!`,
//         description: "Has iniciado sesión correctamente",
//       })
//     } catch (error: any) {
//       console.error("❌ [LOGIN-FORM] Error en login rápido:", error)
//       toast({
//         title: "Error de autenticación",
//         description: error.message || "Credenciales incorrectas",
//         variant: "destructive",
//       })
//     } finally {
//       setIsLoading(false)
//     }
//   }

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
//       <div className="w-full max-w-md space-y-6">
//         <div className="text-center">
//           <h1 className="text-3xl font-bold">Sistema de Chat</h1>
//           <p className="text-gray-600 mt-2">Inicia sesión o crea una cuenta</p>
//         </div>

//         {/* Botones de acceso rápido */}
//         {/* <Card>
//           <CardHeader>
//             <CardTitle className="text-center">🚀 Acceso Rápido</CardTitle>
//           </CardHeader>
//           <CardContent className="space-y-3">
//             <Button
//               onClick={() => handleQuickLogin("usuario@example.com", "123456", "CLIENTE")}
//               disabled={isLoading}
//               className="w-full"
//               variant="outline"
//             >
//               <User className="mr-2 h-4 w-4" />
//               Entrar como Cliente
//             </Button>
//             <Button
//               onClick={() => handleQuickLogin("operador@example.com", "123456", "OPERADOR")}
//               disabled={isLoading}
//               className="w-full"
//               variant="outline"
//             >
//               <Headphones className="mr-2 h-4 w-4" />
//               Entrar como Operador
//             </Button>
//           </CardContent>
//         </Card> */}

//         <Tabs defaultValue="login" className="w-full">
//           <TabsList className="grid w-full grid-cols-2">
//             <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
//             <TabsTrigger value="register">Registrarse</TabsTrigger>
//           </TabsList>

//           <TabsContent value="login">
//             <Card>
//               <CardHeader>
//                 <CardTitle>Iniciar Sesión</CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <form onSubmit={handleLogin} className="space-y-4">
//                   <div className="space-y-2">
//                     <Label htmlFor="login-email">Email</Label>
//                     <Input
//                       id="login-email"
//                       type="email"
//                       placeholder="tu@email.com"
//                       value={loginData.email}
//                       onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
//                       required
//                       disabled={isLoading}
//                     />
//                   </div>
//                   <div className="space-y-2">
//                     <Label htmlFor="login-password">Contraseña</Label>
//                     <Input
//                       id="login-password"
//                       type="password"
//                       placeholder="••••••••"
//                       value={loginData.password}
//                       onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
//                       required
//                       disabled={isLoading}
//                     />
//                   </div>
//                   <Button type="submit" className="w-full" disabled={isLoading}>
//                     {isLoading ? (
//                       <>
//                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                         Iniciando sesión...
//                       </>
//                     ) : (
//                       "Iniciar Sesión"
//                     )}
//                   </Button>
//                 </form>
//               </CardContent>
//             </Card>
//           </TabsContent>

//           <TabsContent value="register">
//             <Card>
//               <CardHeader>
//                 <CardTitle>Crear Cuenta</CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <form onSubmit={handleRegister} className="space-y-4">
//                   <div className="space-y-2">
//                     <Label htmlFor="register-email">Email</Label>
//                     <Input
//                       id="register-email"
//                       type="email"
//                       placeholder="tu@email.com"
//                       value={registerData.email}
//                       onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
//                       required
//                       disabled={isLoading}
//                     />
//                   </div>
//                   <div className="space-y-2">
//                     <Label htmlFor="register-password">Contraseña</Label>
//                     <Input
//                       id="register-password"
//                       type="password"
//                       placeholder="••••••••"
//                       value={registerData.password}
//                       onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
//                       required
//                       disabled={isLoading}
//                     />
//                   </div>
//                   <div className="space-y-2">
//                     <Label htmlFor="register-role">Rol</Label>
//                     <select
//                       id="register-role"
//                       className="w-full p-2 border border-gray-300 rounded-md"
//                       value={registerData.role}
//                       onChange={(e) => setRegisterData({ ...registerData, role: e.target.value })}
//                       disabled={isLoading}
//                     >
//                       <option value="CLIENT">Cliente</option>
//                       <option value="OPERADOR">Operador</option>
//                     </select>
//                   </div>
//                   <Button type="submit" className="w-full" disabled={isLoading}>
//                     {isLoading ? (
//                       <>
//                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                         Creando cuenta...
//                       </>
//                     ) : (
//                       "Crear Cuenta"
//                     )}
//                   </Button>
//                 </form>
//               </CardContent>
//             </Card>
//           </TabsContent>
//         </Tabs>

//         <Alert>
//           {/* <AlertDescription>
//             <strong>Usuarios de prueba:</strong>
//             <br />
//             Cliente: usuario@example.com / 123456
//             <br />
//             Operador: operador@example.com / 123456
//           </AlertDescription> */}
//         </Alert>
//       </div>
//     </div>
//   )
// }















"use client"

import { useState } from "react"
import type React from "react"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

export function LoginForm() {
  const { login, register } = useAuth()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [loginData, setLoginData] = useState({ email: "", password: "" })
  const [registerData, setRegisterData] = useState({
    email: "",
    password: "",
    role: "CLIENT",
    name: "",
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await login(loginData.email, loginData.password)
      toast({ title: "¡Bienvenido!", description: "Has iniciado sesión correctamente" })
    } catch (error: any) {
      toast({
        title: "Error de autenticación",
        description: error.message || "Credenciales incorrectas",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await register(registerData.email, registerData.password, registerData.role, registerData.name)
      toast({ title: "¡Cuenta creada!", description: "Tu cuenta ha sido creada exitosamente" })
    } catch (error: any) {
      toast({
        title: "Error de registro",
        description: error.message || "No se pudo crear la cuenta",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Sistema de Chat</h1>
          <p className="text-gray-600 mt-2">Inicia sesión o crea una cuenta</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
            <TabsTrigger value="register">Registrarse</TabsTrigger>
          </TabsList>

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

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Crear Cuenta</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Contraseña</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="••••••••"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
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
                      onChange={(e) => setRegisterData({ ...registerData, role: e.target.value })}
                      disabled={isLoading}
                    >
                      <option value="CLIENT">Cliente</option>
                      <option value="OPERADOR">Operador</option>
                    </select>
                  </div>
                  {registerData.role === "OPERADOR" && (
                    <div className="space-y-2">
                      <Label htmlFor="register-name">Nombre</Label>
                      <Input
                        id="register-name"
                        type="text"
                        placeholder="Ej: Juan Pérez"
                        value={registerData.name}
                        onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  )}
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

        <Alert>
          {/* <AlertDescription>
            <strong>Usuarios de prueba:</strong><br />
            Cliente: usuario@example.com / 123456<br />
            Operador: operador@example.com / 123456
          </AlertDescription> */}
        </Alert>
      </div>
    </div>
  )
}
