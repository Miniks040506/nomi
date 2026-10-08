// The plan (.nomi/plan.md): what the product is, the jobs it must do as runnable flows, its screens, and what "done" means.
import fs from 'node:fs';
import path from 'node:path';
import { parseDna } from './dna.mjs';
import { parseFlows } from './flow.mjs';
import { stateDir } from './runs.mjs';

export const productTypes = () => JSON.parse(fs.readFileSync(new URL('../data/product-types.json', import.meta.url), 'utf8')).types;
export function findPlan(cwd = process.cwd()) {
  const file = path.join(stateDir(cwd), 'plan.md');
  return fs.existsSync(file) ? file : null;
}

// Structure only: whether the plan is a good one is judged by reading it. `uncovered` and `questions` are prompts, not findings.
export function checkPlan(text, types = productTypes()) {
  const findings = [], add = (line, code, message) => findings.push({ line, code, message });
  let parsed;
  try { parsed = parseDna(text); } catch (error) { return { findings: [{ line: 1, code: 'plan.frontmatter', message: error.message }], flows: [], uncovered: [], questions: [] }; }
  const { data, sections } = parsed, section = title => sections.find(s => s.title === title), filled = s => s?.lines.some(l => l.text.trim());
  if (data?.nomi !== 1) add(1, 'plan.version', 'frontmatter must declare "nomi: 1"');
  const type = types.find(t => t.id === data?.type);
  if (!type && data?.type !== 'other') add(1, 'plan.type', `frontmatter "type" must be one of: ${types.map(t => t.id).join(', ')}, other`);
  for (const title of ['Read', 'Screens', 'Done']) if (!filled(section(title))) add(section(title)?.line ?? null, 'plan.section', `"## ${title}" is ${section(title) ? 'empty' : 'missing'}`);
  let flows = [];
  try { flows = parseFlows(text); } catch (error) { add(section('Flows')?.line ?? null, 'plan.flows', error.message); }
  const screens = (section('Screens')?.lines || []).map(l => /^\s*[-*]\s+([^:]+)/.exec(l.text)?.[1].trim().toLowerCase()).filter(Boolean);
  for (const flow of flows) {
    const at = section('Flows').line;
    if (flow.steps.at(-1).do !== 'expect') add(at, 'plan.end-state', `flow "${flow.name}" must end with an expect step: the state on screen that proves the job is done`);
    if (!flow.screen) add(at, 'plan.screen', `flow "${flow.name}" names no "screen"`);
    else if (!screens.includes(flow.screen.toLowerCase())) add(at, 'plan.screen', `screen "${flow.screen}" of flow "${flow.name}" is not a line under "## Screens"`);
  }
  const covered = flows.map(f => f.covers);
  return { findings, flows, type: type?.id ?? data?.type, uncovered: (type?.flows || []).filter(f => !covered.includes(f.id)), questions: type?.questions || [] };
}
