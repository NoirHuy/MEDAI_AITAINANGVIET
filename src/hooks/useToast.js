import { useCallback, useRef, useState } from 'react'

export function useToast() {
  const [message, setMessage] = useState(null)
  const timerRef = useRef(null)

  const showToast = useCallback((text, duration = 2600) => {
    clearTimeout(timerRef.current)
    setMessage(text)
    timerRef.current = setTimeout(() => setMessage(null), duration)
  }, [])

  return { message, showToast }
}
