export function mixedValue<T>(values: T[]): T | 'mixed' {
  if (!values.length) return 'mixed'
  return values.every((value) => value === values[0]) ? values[0] : 'mixed'
}
