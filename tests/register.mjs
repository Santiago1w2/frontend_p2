import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context) }
    catch (error) {
      if (specifier.startsWith('.') && context.parentURL) {
        for (const extension of ['.ts', '.tsx']) {
          const candidate = new URL(specifier + extension, context.parentURL)
          if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context)
        }
      }
      throw error
    }
  },
  load(url, context, nextLoad) {
    if (/\.tsx?$/.test(url)) {
      const source = readFileSync(fileURLToPath(url), 'utf8')
      const result = ts.transpileModule(source, { fileName: fileURLToPath(url), compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } })
      return { format: 'module', source: result.outputText.replaceAll('import.meta.env', '(globalThis.__testEnv ?? {})'), shortCircuit: true }
    }
    if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }
    return nextLoad(url, context)
  },
})
