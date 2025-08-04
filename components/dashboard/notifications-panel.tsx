import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bell } from "lucide-react"

interface NotificationsPanelProps {
  notifications: string[]
}

export function NotificationsPanel({ notifications }: NotificationsPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Notificaciones</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[200px]">
          {notifications.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground opacity-20" />
              <p className="mt-2 text-muted-foreground">No hay notificaciones</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification, index) => (
                <div key={index} className="p-3 text-sm hover:bg-slate-50">
                  {notification}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
