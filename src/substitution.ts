export function substituteVariables(content: string, filePath?: string): string {
  // Matches ${VAR}, ${VAR:-default}, ${VAR:?error} — supports upper and lowercase names
  const regex = /\$\{([A-Za-z0-9_]+)(?::(-|\?)([^}]*))?\}/g;

  return content.replace(regex, (match, varName, op, arg) => {
    const envValue = process.env[varName];
    const hasValue = envValue !== undefined && envValue !== '';

    if (hasValue) {
      return envValue as string;
    }

    if (op === '-') {
      return arg || '';
    }

    if (op === '?') {
      const location = filePath ? ` in ${filePath}` : '';
      const message = arg || `Required environment variable ${varName} is not set`;
      throw new Error(`${message}${location}`);
    }

    // Bare ${VAR} with no operator — unset → empty string (bash convention)
    return '';
  });
}
