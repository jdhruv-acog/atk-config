export function substituteVariables(content: string, filePath?: string): string {
  const regex = /\$\{([A-Z0-9_]+)(?::(-|\?)([^}]*))?\}/g;

  return content.replace(regex, (match, varName, op, arg) => {
    const envValue = process.env[varName];

    if (envValue !== undefined && envValue !== '') {
      return envValue;
    }

    if (op === '-') {
      return arg || '';
    }

    if (op === '?') {
      const location = filePath ? ` in ${filePath}` : '';
      const message = arg || `Required environment variable ${varName} is not set`;
      throw new Error(`${message}${location}`);
    }

    return match;
  });
}
