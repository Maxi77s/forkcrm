"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useState } from "react"

// Datos de ejemplo
const hourlyData = [
  { time: "9:00", chats: 4, messages: 12 },
  { time: "10:00", chats: 7, messages: 24 },
  { time: "11:00", chats: 5, messages: 18 },
  { time: "12:00", chats: 6, messages: 22 },
  { time: "13:00", chats: 8, messages: 30 },
  { time: "14:00", chats: 9, messages: 34 },
  { time: "15:00", chats: 7, messages: 28 },
  { time: "16:00", chats: 5, messages: 20 },
  { time: "17:00", chats: 4, messages: 15 },
]

const dailyData = [
  { time: "Lun", chats: 24, messages: 86 },
  { time: "Mar", chats: 28, messages: 102 },
  { time: "Mié", chats: 32, messages: 118 },
  { time: "Jue", chats: 30, messages: 110 },
  { time: "Vie", chats: 35, messages: 130 },
  { time: "Sáb", chats: 22, messages: 78 },
  { time: "Dom", chats: 18, messages: 64 },
]

const weeklyData = [
  { time: "Sem 1", chats: 145, messages: 520 },
  { time: "Sem 2", chats: 162, messages: 580 },
  { time: "Sem 3", chats: 158, messages: 560 },
  { time: "Sem 4", chats: 175, messages: 620 },
]

// Definir el tipo correcto para el tooltip
const CustomTooltip = (props: any) => {
  const { active, payload, label } = props

  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-md shadow-sm">
        <p className="font-medium">{label}</p>
        <p className="text-sky-600">Chats: {payload[0]?.value}</p>
        <p className="text-emerald-600">Mensajes: {payload[1]?.value}</p>
      </div>
    )
  }

  return null
}

export function ActivityChart() {
  const [timeRange, setTimeRange] = useState("daily")

  const data = {
    hourly: hourlyData,
    daily: dailyData,
    weekly: weeklyData,
  }[timeRange]

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Actividad de Chats</CardTitle>
          <Tabs defaultValue="daily" value={timeRange} onValueChange={setTimeRange}>
            <TabsList>
              <TabsTrigger value="hourly">Hoy</TabsTrigger>
              <TabsTrigger value="daily">Semana</TabsTrigger>
              <TabsTrigger value="weekly">Mes</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="chats" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="messages" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
