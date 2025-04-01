/**
 * Object utility functions
 */

/**
 * Deep clone an object
 * @param obj Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T
  }
  
  if (obj instanceof Object) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, deepClone(value)])
    ) as unknown as T
  }
  
  return obj
}

/**
 * Check if two objects are deeply equal
 * @param a First object
 * @param b Second object
 * @returns True if objects are deeply equal
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true
  }
  
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false
  }
  
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false
    }
    
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false
      }
    }
    
    return true
  }
  
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  
  if (keysA.length !== keysB.length) {
    return false
  }
  
  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
      return false
    }
  }
  
  return true
}

/**
 * Pick specific keys from an object
 * @param obj Source object
 * @param keys Keys to pick
 * @returns New object with only the picked keys
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  return keys.reduce((result, key) => {
    if (key in obj) {
      result[key] = obj[key]
    }
    return result
  }, {} as Pick<T, K>)
}

/**
 * Omit specific keys from an object
 * @param obj Source object
 * @param keys Keys to omit
 * @returns New object without the omitted keys
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj }
  keys.forEach(key => {
    delete result[key]
  })
  return result as Omit<T, K>
}

/**
 * Merge objects deeply
 * @param target Target object
 * @param sources Source objects
 * @returns Merged object
 */
export function deepMerge<T>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target
  
  const source = sources.shift()
  if (source === undefined) return target
  
  if (isMergeableObject(target) && isMergeableObject(source)) {
    Object.keys(source).forEach(key => {
      const sourceKey = key as keyof typeof source
      const targetKey = key as keyof T
      
      if (isMergeableObject(source[sourceKey])) {
        if (!target[targetKey]) {
          Object.assign(target, { [key]: {} })
        }
        
        deepMerge(
          target[targetKey] as any,
          source[sourceKey] as any
        )
      } else {
        Object.assign(target, { [key]: source[sourceKey] })
      }
    })
  }
  
  return deepMerge(target, ...sources)
}

/**
 * Check if an object is mergeable
 * @param item Item to check
 * @returns True if the item is a mergeable object
 */
function isMergeableObject(item: any): item is Record<string, any> {
  return item && typeof item === 'object' && !Array.isArray(item) && !(item instanceof Date)
}

/**
 * Flatten a nested object
 * @param obj Object to flatten
 * @param prefix Prefix for keys
 * @returns Flattened object
 */
export function flattenObject(
  obj: Record<string, any>,
  prefix = ''
): Record<string, any> {
  return Object.keys(obj).reduce((acc, key) => {
    const prefixedKey = prefix ? `${prefix}.${key}` : key
    
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
      Object.assign(acc, flattenObject(obj[key], prefixedKey))
    } else {
      acc[prefixedKey] = obj[key]
    }
    
    return acc
  }, {} as Record<string, any>)
}

/**
 * Unflatten a flattened object
 * @param obj Flattened object
 * @returns Nested object
 */
export function unflattenObject(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  
  Object.keys(obj).forEach(key => {
    const parts = key.split('.')
    let current = result
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      
      if (isLast) {
        current[part] = obj[key]
      } else {
        current[part] = current[part] || {}
        current = current[part]
      }
    }
  })
  
  return result
}
