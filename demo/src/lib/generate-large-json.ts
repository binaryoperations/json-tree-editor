/**
 * Deterministic large-JSON generator for stress-testing the tree editor.
 *
 * ## Node counting
 * Every JSON value counts as **one node**:
 * - primitives (`string` | `number` | `boolean` | `null`) → 1
 * - array → 1 + sum of elements
 * - object → 1 + sum of property values
 *
 * Target defaults to **5000** nodes (± a few for structure rounding).
 */

export type GenerateLargeJsonOptions = {
  /** Approximate total node count (default 5000). */
  targetNodes?: number;
  /** Seed for the PRNG (default 42). Same seed → same document. */
  seed?: number;
};

export type GenerateLargeJsonResult = {
  value: unknown;
  /** Nodes counted with {@link countJsonNodes}. */
  nodeCount: number;
  /** Wall-clock generation time in milliseconds. */
  generationMs: number;
  seed: number;
  targetNodes: number;
};

/** Count every JSON value as one tree node (containers + leaves). */
export function countJsonNodes(value: unknown): number {
  if (value === null || typeof value !== 'object') return 1;
  if (Array.isArray(value)) {
    let n = 1;
    for (const item of value) n += countJsonNodes(item);
    return n;
  }
  let n = 1;
  for (const v of Object.values(value as Record<string, unknown>)) {
    n += countJsonNodes(v);
  }
  return n;
}

/** Mulberry32 — small seeded 32-bit PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a JSON document with approximately `targetNodes` nodes.
 *
 * Shape:
 * ```
 * {
 *   meta: { title, seed, targetNodes, generatedAt },
 *   departments: [
 *     {
 *       id, name, budget, active,
 *       tags: string[],
 *       employees: [
 *         { id, name, role, level, remote, skills: string[], metrics: { … } }
 *       ]
 *     }
 *   ]
 * }
 * ```
 *
 * Employees are added until the running estimate reaches the target.
 */
export function generateLargeJson(
  options: GenerateLargeJsonOptions = {},
): GenerateLargeJsonResult {
  const targetNodes = options.targetNodes ?? 5000;
  const seed = options.seed ?? 42;
  const rand = mulberry32(seed);
  const t0 =
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  const pick = <T,>(arr: readonly T[]): T =>
    arr[Math.floor(rand() * arr.length)]!;

  const ROLES = [
    'engineer',
    'designer',
    'pm',
    'analyst',
    'support',
    'ops',
  ] as const;
  const SKILLS = [
    'ts',
    'rust',
    'go',
    'sql',
    'ux',
    'ml',
    'k8s',
    'aws',
    'figma',
    'react',
  ] as const;
  const DEPTS = [
    'Platform',
    'Product',
    'Growth',
    'Data',
    'Security',
    'Infra',
    'Design',
    'Support',
  ] as const;

  /**
   * Estimated nodes for one employee object:
   * 1 (obj) + id + name + role + level + remote
   * + skills array (1 + k strings) + metrics obj (1 + 4 numbers) = 1+5+1+k+1+4 = 12+k
   * with k≈3 → ~15
   */
  const employeeNodeEstimate = (skillCount: number) => 12 + skillCount;

  const makeEmployee = (globalIndex: number) => {
    const skillCount = 2 + Math.floor(rand() * 3); // 2–4
    const skills: string[] = [];
    for (let i = 0; i < skillCount; i++) {
      skills.push(pick(SKILLS));
    }
    return {
      id: `emp_${String(globalIndex).padStart(4, '0')}`,
      name: `Employee ${globalIndex}`,
      role: pick(ROLES),
      level: 1 + Math.floor(rand() * 8),
      remote: rand() > 0.45,
      skills,
      metrics: {
        commits: Math.floor(rand() * 400),
        prs: Math.floor(rand() * 80),
        score: Math.round(rand() * 1000) / 10,
        latencyMs: Math.floor(rand() * 250),
      },
    };
  };

  /**
   * Meta object: 1 + 4 string/number leaves = 5
   * Root: 1 + meta + departments array container
   * We'll recount exactly at the end.
   */
  const departments: Array<Record<string, unknown>> = [];
  let estimated =
    1 /* root */ +
    5 /* meta obj + 4 leaves */ +
    1; /* departments array shell */

  let empIndex = 0;
  let deptIndex = 0;

  while (estimated < targetNodes && deptIndex < 200) {
    const tags = [pick(SKILLS), pick(SKILLS)];
    // dept shell: 1 + id + name + budget + active + tags(1+2) + employees(1) = 1+4+3+1 = 9
    const employees: ReturnType<typeof makeEmployee>[] = [];
    let deptEstimate = 9;

    // Fill department until we'd overshoot slightly or hit a soft cap per dept
    const perDeptCap = 40 + Math.floor(rand() * 30); // 40–69 employees
    while (
      estimated + deptEstimate < targetNodes &&
      employees.length < perDeptCap
    ) {
      const skillCount = 2 + Math.floor(rand() * 3);
      const need = employeeNodeEstimate(skillCount);
      if (
        estimated + deptEstimate + need > targetNodes + 40 &&
        employees.length > 0
      ) {
        break;
      }
      employees.push(makeEmployee(empIndex++));
      // re-roll skillCount already baked into makeEmployee — use actual length
      const last = employees[employees.length - 1]!;
      deptEstimate += employeeNodeEstimate(last.skills.length);
    }

    departments.push({
      id: `dept_${String(deptIndex).padStart(2, '0')}`,
      name: `${pick(DEPTS)} ${deptIndex + 1}`,
      budget: Math.floor(50_000 + rand() * 950_000),
      active: rand() > 0.1,
      tags,
      employees,
    });
    estimated += deptEstimate;
    deptIndex += 1;

    // Safety: if a department added no employees and we're still short, force one
    if (employees.length === 0 && estimated < targetNodes) {
      const e = makeEmployee(empIndex++);
      employees.push(e);
      estimated += employeeNodeEstimate(e.skills.length);
    }
  }

  const value = {
    meta: {
      title: 'Large tree stress document',
      seed,
      targetNodes,
      generatedAt: new Date(0).toISOString(), // fixed for determinism
    },
    departments,
  };

  const nodeCount = countJsonNodes(value);
  const t1 =
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    value,
    nodeCount,
    generationMs: Math.round((t1 - t0) * 100) / 100,
    seed,
    targetNodes,
  };
}

/** Pretty-print generated value (2-space indent + trailing newline). */
export function stringifyGenerated(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}
