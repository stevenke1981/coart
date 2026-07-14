interface StatusToastProps {
  message: string
}

export function StatusToast({ message }: StatusToastProps) {
  if (!message) return null
  return <div className="coart-toast" role="status">{message}</div>
}
