'use client'

import { useState } from 'react'
import type { ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type PasswordFieldProps = ComponentProps<'input'> & {
  showLabel?: string
  hideLabel?: string
}

export function PasswordField({
  className,
  showLabel = 'パスワードを表示',
  hideLabel = 'パスワードを隠す',
  ...props
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        type={isVisible ? 'text' : 'password'}
        className={cn('pr-10', className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute top-1/2 right-1 -translate-y-1/2 text-[#4A4A4A]"
        aria-label={isVisible ? hideLabel : showLabel}
        onClick={() => setIsVisible((current) => !current)}
      >
        {isVisible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  )
}
