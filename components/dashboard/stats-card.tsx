import { Card, CardContent } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

const statsCardVariants = cva("", {
  variants: {
    variant: {
      default: "bg-white",
      blue: "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200",
      green: "bg-gradient-to-br from-green-50 to-green-100 border-green-200",
      amber: "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200",
      purple: "bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200",
      sky: "bg-gradient-to-br from-sky-50 to-sky-100 border-sky-200",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

interface StatsCardProps extends VariantProps<typeof statsCardVariants> {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  iconColor?: string
}

export function StatsCard({ title, value, icon: Icon, trend, variant, iconColor = "text-sky-500" }: StatsCardProps) {
  return (
    <Card className={statsCardVariants({ variant })}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <h3 className="text-2xl font-bold">{value}</h3>

            {trend && (
              <div className={`flex items-center mt-2 text-xs ${trend.isPositive ? "text-green-600" : "text-red-600"}`}>
                <span>
                  {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
                </span>
                <span className="ml-1 text-muted-foreground">vs. ayer</span>
              </div>
            )}
          </div>

          <div className={`p-3 rounded-full bg-opacity-10 ${iconColor.replace("text-", "bg-")}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
