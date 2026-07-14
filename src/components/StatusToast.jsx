export function StatusToast({ message }) {
  if (!message) return null
  return <div className="coart-toast" role="status">{message}</div>
}
