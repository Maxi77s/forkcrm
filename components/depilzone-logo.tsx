import Image from "next/image"

interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function DepilZoneLogo({ className, size = "md" }: LogoProps) {
  const sizes = {
    sm: { width: 100, height: 24 },
    md: { width: 130, height: 32 },
    lg: { width: 160, height: 40 },
  }

  return (
    <div className={className}>
      <Image
        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logoDepilz-XwRlbnaol25aBWqBNnEbsbxXzoHZeB.png"
        alt="DepilZONE"
        width={sizes[size].width}
        height={sizes[size].height}
        priority
      />
    </div>
  )
}
