import Image from "next/image"
import { cn } from "@/lib/utils"

type HoneyPotLogoProps = {
  className?: string
  iconClassName?: string
}

export function HoneyPotLogo({ className, iconClassName }: HoneyPotLogoProps) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-lg bg-black/20 shadow-lg shadow-bitcoin-500/20",
        className,
      )}
      aria-hidden="true"
    >
      <Image
        src="/logo.webp"
        alt=""
        fill
        sizes="(max-width: 768px) 24px, 36px"
        className={cn("object-contain p-1", iconClassName)}
        priority
      />
    </div>
  )
}
