import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Star } from "lucide-react"

interface Rating {
  chatId: string
  rating: number
  comment: string
  categories: {
    friendliness: number
    helpfulness: number
    responseTime: number
    problemResolution: number
  }
  clientId: string
  timestamp: Date
  ratingStars: string
}

interface RecentRatingsProps {
  ratings: Rating[]
}

export function RecentRatings({ ratings }: RecentRatingsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Calificaciones Recientes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {ratings.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <Star className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
              <p className="mt-2 text-muted-foreground">No hay calificaciones recientes</p>
            </div>
          ) : (
            <div className="divide-y">
              {ratings.map((rating, index) => (
                <div key={index} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <div className="flex text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < rating.rating ? "fill-current" : "opacity-30"}`} />
                        ))}
                      </div>
                      <span className="ml-2 text-sm font-medium">{rating.rating}/5</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {rating.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground mb-2">
                    Cliente: {rating.clientId.substring(0, 8)}... | Chat: {rating.chatId.substring(0, 8)}...
                  </div>

                  {rating.comment && (
                    <p className="text-sm italic border-l-2 border-sky-200 pl-2 my-2">"{rating.comment}"</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Amabilidad:</span>
                      <div className="flex text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i < rating.categories.friendliness ? "fill-current" : "opacity-30"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Utilidad:</span>
                      <div className="flex text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i < rating.categories.helpfulness ? "fill-current" : "opacity-30"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Tiempo:</span>
                      <div className="flex text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i < rating.categories.responseTime ? "fill-current" : "opacity-30"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Resolución:</span>
                      <div className="flex text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i < rating.categories.problemResolution ? "fill-current" : "opacity-30"}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
