import * as vscode from 'vscode';
import { classifyDependency, DependencyLicenseResult } from './licenseClassifier';
import { recordHit } from './reviewPrompt';

let diagnostics: vscode.DiagnosticCollection;

async function readJsonIfExists(uri: vscode.Uri): Promise<unknown> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    return null;
  }
}

function dependencyNames(rootPackageJson: unknown): string[] {
  if (typeof rootPackageJson !== 'object' || rootPackageJson === null) return [];
  const obj = rootPackageJson as Record<string, unknown>;
  const names = new Set<string>();
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const section = obj[field];
    if (typeof section === 'object' && section !== null) {
      for (const name of Object.keys(section)) names.add(name);
    }
  }
  return [...names];
}

/** Finds the line where `"<name>":` is declared inside a
 * dependencies/devDependencies/optionalDependencies block. A plain
 * text search rather than a real JSON-position parser (JSON.parse
 * discards positions) -- good enough for the common one-name-per-line
 * formatting every package manager writes. */
function lineOfDependency(packageJsonText: string, name: string): number {
  const lines = packageJsonText.split('\n');
  const needle = `"${name}"`;
  const index = lines.findIndex((line) => line.trimStart().startsWith(needle));
  return index === -1 ? 0 : index;
}

async function refreshWorkspace(context: vscode.ExtensionContext): Promise<void> {
  diagnostics.clear();

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return;
  const root = folders[0].uri;

  const packageJsonUri = vscode.Uri.joinPath(root, 'package.json');
  let packageJsonText: string;
  try {
    const bytes = await vscode.workspace.fs.readFile(packageJsonUri);
    packageJsonText = Buffer.from(bytes).toString('utf8');
  } catch {
    return; // no package.json at the workspace root -- nothing to check
  }

  let rootPackageJson: unknown;
  try {
    rootPackageJson = JSON.parse(packageJsonText);
  } catch {
    return;
  }

  const names = dependencyNames(rootPackageJson);
  if (names.length === 0) return;

  const results: DependencyLicenseResult[] = [];
  for (const name of names) {
    const depPackageJsonUri = vscode.Uri.joinPath(root, 'node_modules', ...name.split('/'), 'package.json');
    const depPackageJson = await readJsonIfExists(depPackageJsonUri);
    if (depPackageJson === null) continue; // not installed (yet) -- nothing to classify
    results.push(classifyDependency(name, depPackageJson));
  }

  const flagged = results.filter((r) => r.category !== 'permissive');
  const diags = flagged.map((result) => {
    const line = lineOfDependency(packageJsonText, result.name);
    const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
    const licenseText = result.licenses.length > 0 ? result.licenses.join(' / ') : 'no license field found';
    const severity =
      result.category === 'strong-copyleft' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
    const diagnostic = new vscode.Diagnostic(
      range,
      `"${result.name}" license: ${licenseText} (${result.category}).`,
      severity,
    );
    diagnostic.source = 'Dependency License Companion';
    diagnostic.code = result.category;
    recordHit(context, `${packageJsonUri.toString()}:${line}`);
    return diagnostic;
  });

  diagnostics.set(packageJsonUri, diags);
}

export function activate(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection('dependencyLicenseCompanion');
  context.subscriptions.push(diagnostics);

  void refreshWorkspace(context);

  const watcher = vscode.workspace.createFileSystemWatcher('**/package.json');
  context.subscriptions.push(
    watcher,
    watcher.onDidChange(() => void refreshWorkspace(context)),
    watcher.onDidCreate(() => void refreshWorkspace(context)),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dependencyLicenseCompanion.rescan', () => void refreshWorkspace(context)),
  );
}

export function deactivate(): void {
  diagnostics?.dispose();
}
