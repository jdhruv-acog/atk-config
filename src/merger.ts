function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deepMerge(target: any, source: any, visited: WeakSet<object> = new WeakSet()): any {
  if (isPlainObject(source) && visited.has(source)) {
    throw new Error('Circular reference detected in configuration');
  }

  const result = { ...target };

  if (isPlainObject(source)) {
    visited.add(source);
  }

  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;

    const sourceValue = source[key];
    const targetValue = result[key];

    if (isPlainObject(sourceValue)) {
      // Catch circular refs regardless of what target looks like
      if (visited.has(sourceValue)) {
        throw new Error('Circular reference detected in configuration');
      }
      // Always recurse into plain objects so visited tracking works correctly
      result[key] = deepMerge(isPlainObject(targetValue) ? targetValue : {}, sourceValue, visited);
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
}
