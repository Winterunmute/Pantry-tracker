import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void
}

const DEBOUNCE_MS = 3000
const SCANNER_DIV_ID = 'html5qr-barcode-scanner'

function playBeep() {
  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(1046, ctx.currentTime) // C6
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.15)
  } catch {
    // AudioContext not available in some environments — silently ignore
  }
}

export default function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const seenRef = useRef<Map<string, number>>(new Map())
  const [flash, setFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_DIV_ID)
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 120 } },
        (decodedText) => {
          const now = Date.now()
          const lastSeen = seenRef.current.get(decodedText)
          if (lastSeen && now - lastSeen < DEBOUNCE_MS) return
          seenRef.current.set(decodedText, now)
          playBeep()
          setFlash(true)
          setTimeout(() => setFlash(false), 300)
          onDetected(decodedText)
        },
        () => {
          // per-frame decode errors are normal — ignore
        },
      )
      .catch((e: unknown) => {
        setError(
          e instanceof Error
            ? e.message
            : 'Camera access denied or not available.',
        )
      })

    return () => {
      scannerRef.current?.stop().catch(() => {})
      scannerRef.current = null
    }
  }, [onDetected])

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-black aspect-[3/4] max-h-[60vh]">
      <div id={SCANNER_DIV_ID} className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />

      {/* Scan-frame overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`w-2/3 h-1/3 rounded-xl border-4 transition-colors duration-100 ${
            flash ? 'border-green-400 bg-green-400/20' : 'border-white/60'
          }`}
        />
      </div>

      {/* Flash overlay */}
      {flash && (
        <div className="absolute inset-0 bg-green-400/30 pointer-events-none rounded-2xl transition-opacity" />
      )}

      {/* Corner decorators */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[33%] left-[16%] w-6 h-6 border-t-4 border-l-4 border-brand-400 rounded-tl-sm" />
        <div className="absolute top-[33%] right-[16%] w-6 h-6 border-t-4 border-r-4 border-brand-400 rounded-tr-sm" />
        <div className="absolute bottom-[33%] left-[16%] w-6 h-6 border-b-4 border-l-4 border-brand-400 rounded-bl-sm" />
        <div className="absolute bottom-[33%] right-[16%] w-6 h-6 border-b-4 border-r-4 border-brand-400 rounded-br-sm" />
      </div>

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-2xl p-6">
          <div className="text-center text-white">
            <p className="text-3xl mb-3">📷</p>
            <p className="text-sm font-medium">{error}</p>
            <p className="text-xs text-white/60 mt-2">
              Allow camera access and reload the page.
            </p>
          </div>
        </div>
      )}

      {/* Hint text */}
      {!error && (
        <p className="absolute bottom-3 left-0 right-0 text-center text-white/70 text-xs pointer-events-none">
          Point camera at a barcode
        </p>
      )}
    </div>
  )
}
