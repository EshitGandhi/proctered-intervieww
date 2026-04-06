/**
 * Signature Parser & Code Generation Service
 *
 * Parses a C++-style function signature and generates:
 *  - Starter code (function stub shown to candidate) per language
 *  - Driver code (hidden I/O wrapper) per language
 *
 * Supported (Auto Mode) types:
 *   int, long, double, float, bool, string,
 *   vector<int>, vector<string>
 *
 * Complex / unsupported types (fall back to Manual Mode):
 *   vector<vector<int>>, ListNode, TreeNode, graph types, etc.
 */

// ─── Supported type set ────────────────────────────────────────────────────────
const SUPPORTED_TYPES = new Set([
  'int', 'long', 'double', 'float', 'bool', 'string',
  'vector<int>', 'vector<string>',
]);

const COMPLEX_TYPES = [
  'vector<vector', 'ListNode', 'TreeNode', 'Node', 'Graph',
  'map<', 'unordered_map', 'set<', 'pair<', 'deque<', 'queue<', 'stack<',
];

// ─── Type mapping table ────────────────────────────────────────────────────────
const TYPE_MAP = {
  // [cppType]: { java, python, javascript, c, php, cppRead, javaRead, pyRead, jsRead, cRead, phpRead }
  'int': {
    java: 'int', python: 'int', javascript: 'number', c: 'int', php: 'int',
    cppRead: (n) => `int ${n}; cin >> ${n};`,
    javaRead: (n) => `int ${n} = sc.nextInt();`,
    pyRead: (n) => `${n} = int(tokens[idx]); idx += 1`,
    jsRead: (n) => `const ${n} = parseInt(tokens[idx++], 10);`,
    cRead: (n) => `int ${n}; scanf("%d", &${n});`,
    phpRead: (n) => `$${n} = (int)$tokens[$idx++];`,
    javaParam: 'int', pyParam: '', jsParam: '', cParam: 'int',
    phpParam: '$',
  },
  'long': {
    java: 'long', python: 'int', javascript: 'number', c: 'long long', php: 'int',
    cppRead: (n) => `long ${n}; cin >> ${n};`,
    javaRead: (n) => `long ${n} = sc.nextLong();`,
    pyRead: (n) => `${n} = int(tokens[idx]); idx += 1`,
    jsRead: (n) => `const ${n} = parseInt(tokens[idx++], 10);`,
    cRead: (n) => `long long ${n}; scanf("%lld", &${n});`,
    phpRead: (n) => `$${n} = (int)$tokens[$idx++];`,
    javaParam: 'long', pyParam: '', jsParam: '', cParam: 'long long',
    phpParam: '$',
  },
  'double': {
    java: 'double', python: 'float', javascript: 'number', c: 'double', php: 'float',
    cppRead: (n) => `double ${n}; cin >> ${n};`,
    javaRead: (n) => `double ${n} = sc.nextDouble();`,
    pyRead: (n) => `${n} = float(tokens[idx]); idx += 1`,
    jsRead: (n) => `const ${n} = parseFloat(tokens[idx++]);`,
    cRead: (n) => `double ${n}; scanf("%lf", &${n});`,
    phpRead: (n) => `$${n} = (float)$tokens[$idx++];`,
    javaParam: 'double', pyParam: '', jsParam: '', cParam: 'double',
    phpParam: '$',
  },
  'float': {
    java: 'float', python: 'float', javascript: 'number', c: 'float', php: 'float',
    cppRead: (n) => `float ${n}; cin >> ${n};`,
    javaRead: (n) => `float ${n} = sc.nextFloat();`,
    pyRead: (n) => `${n} = float(tokens[idx]); idx += 1`,
    jsRead: (n) => `const ${n} = parseFloat(tokens[idx++]);`,
    cRead: (n) => `float ${n}; scanf("%f", &${n});`,
    phpRead: (n) => `$${n} = (float)$tokens[$idx++];`,
    javaParam: 'float', pyParam: '', jsParam: '', cParam: 'float',
    phpParam: '$',
  },
  'bool': {
    java: 'boolean', python: 'bool', javascript: 'boolean', c: 'int', php: 'bool',
    cppRead: (n) => `bool ${n}; cin >> ${n};`,
    javaRead: (n) => `boolean ${n} = sc.nextBoolean();`,
    pyRead: (n) => `${n} = (tokens[idx] == "true"); idx += 1`,
    jsRead: (n) => `const ${n} = tokens[idx++] === "true";`,
    cRead: (n) => `int ${n}; scanf("%d", &${n});`,
    phpRead: (n) => `$${n} = ($tokens[$idx++] === "true");`,
    javaParam: 'boolean', pyParam: '', jsParam: '', cParam: 'int',
    phpParam: '$',
  },
  'string': {
    java: 'String', python: 'str', javascript: 'string', c: 'char*', php: 'string',
    cppRead: (n) => `string ${n}; cin >> ${n};`,
    javaRead: (n) => `String ${n} = sc.next();`,
    pyRead: (n) => `${n} = tokens[idx]; idx += 1`,
    jsRead: (n) => `const ${n} = tokens[idx++];`,
    cRead: (n) => `char ${n}[1000]; scanf("%s", ${n});`,
    phpRead: (n) => `$${n} = $tokens[$idx++];`,
    javaParam: 'String', pyParam: '', jsParam: '', cParam: 'char*',
    phpParam: '$',
  },
  'vector<int>': {
    java: 'int[]', python: 'list', javascript: 'number[]', c: 'int[]', php: 'array',
    cppRead: (n) => `int n_${n}; cin >> n_${n};\nvector<int> ${n}(n_${n});\nfor(int i=0;i<n_${n};i++) cin >> ${n}[i];`,
    javaRead: (n) => `int n_${n} = sc.nextInt();\nint[] ${n} = new int[n_${n}];\nfor(int i=0;i<n_${n};i++) ${n}[i] = sc.nextInt();`,
    pyRead: (n) => `n_${n} = int(tokens[idx]); idx += 1\n${n} = [int(tokens[i]) for i in range(idx, idx + n_${n})]\nidx += n_${n}`,
    jsRead: (n) => `const n_${n} = parseInt(tokens[idx++], 10);\nconst ${n} = [];\nfor(let i=0; i<n_${n}; i++) ${n}.push(parseInt(tokens[idx++], 10));`,
    cRead: (n) => `int n_${n}; scanf("%d", &n_${n});\nint ${n}[n_${n}];\nfor(int i=0;i<n_${n};i++) scanf("%d", &${n}[i]);`,
    phpRead: (n) => `$n_${n} = (int)$tokens[$idx++];\n$${n} = [];\nfor($i=0; $i<$n_${n}; $i++) $${n}[] = (int)$tokens[$idx++];`,
    javaParam: 'int[]', pyParam: '', jsParam: '', cParam: 'int*, int',
    phpParam: '$',
  },
  'vector<string>': {
    java: 'String[]', python: 'list', javascript: 'string[]', c: 'char**', php: 'array',
    cppRead: (n) => `int n_${n}; cin >> n_${n};\nvector<string> ${n}(n_${n});\nfor(int i=0;i<n_${n};i++) cin >> ${n}[i];`,
    javaRead: (n) => `int n_${n} = sc.nextInt();\nString[] ${n} = new String[n_${n}];\nfor(int i=0;i<n_${n};i++) ${n}[i] = sc.next();`,
    pyRead: (n) => `n_${n} = int(tokens[idx]); idx += 1\n${n} = tokens[idx : idx + n_${n}]\nidx += n_${n}`,
    jsRead: (n) => `const n_${n} = parseInt(tokens[idx++], 10);\nconst ${n} = [];\nfor(let i=0; i<n_${n}; i++) ${n}.push(tokens[idx++]);`,
    cRead: (n) => `// vector<string> not directly supported in C — using manual mode`,
    phpRead: (n) => `$n_${n} = (int)$tokens[$idx++];\n$${n} = [];\nfor($i=0; $i<$n_${n}; $i++) $${n}[] = $tokens[$idx++];`,
    javaParam: 'String[]', pyParam: '', jsParam: '', cParam: 'char**',
    phpParam: '$',
  },
};

// ─── Return type output generators ────────────────────────────────────────────
const RETURN_OUTPUT = {
  'int':    { cpp: 'cout << result;', java: 'System.out.println(result);', py: 'print(result)', js: 'console.log(result);', c: 'printf("%d", result);', php: 'echo $result;' },
  'long':   { cpp: 'cout << result;', java: 'System.out.println(result);', py: 'print(result)', js: 'console.log(result);', c: 'printf("%lld", result);', php: 'echo $result;' },
  'double': { cpp: 'cout << fixed << setprecision(5) << result;', java: 'System.out.println(result);', py: 'print(result)', js: 'console.log(result);', c: 'printf("%g", result);', php: 'echo $result;' },
  'float':  { cpp: 'cout << fixed << setprecision(5) << result;', java: 'System.out.println(result);', py: 'print(result)', js: 'console.log(result);', c: 'printf("%g", result);', php: 'echo $result;' },
  'bool':   { cpp: 'cout << (result ? "true" : "false");', java: 'System.out.println(result);', py: 'print(str(result).lower())', js: 'console.log(result);', c: 'printf("%s", result ? "true" : "false");', php: 'echo $result ? "true" : "false";' },
  'string': { cpp: 'cout << result;', java: 'System.out.println(result);', py: 'print(result)', js: 'console.log(result);', c: 'printf("%s", result);', php: 'echo $result;' },
  'vector<int>': {
    cpp: 'for(int i=0;i<(int)result.size();i++){if(i)cout<<" ";cout<<result[i];}cout<<endl;',
    java: 'StringBuilder sb=new StringBuilder();\nfor(int i=0;i<result.length;i++){if(i>0)sb.append(" ");sb.append(result[i]);}\nSystem.out.println(sb);',
    py: 'print(" ".join(map(str, result)))',
    js: 'console.log(result.join(" "));',
    c: '// vector<int> return not supported in C',
    php: 'echo implode(" ", $result);',
  },
  'vector<string>': {
    cpp: 'for(int i=0;i<(int)result.size();i++){if(i)cout<<" ";cout<<result[i];}cout<<endl;',
    java: 'System.out.println(String.join(" ", result));',
    py: 'print(" ".join(result))',
    js: 'console.log(result.join(" "));',
    c: '// vector<string> return not supported in C',
    php: 'echo implode(" ", $result);',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Checks whether the given type requires Manual Mode.
 */
const isComplexType = (type) => COMPLEX_TYPES.some(ct => type.includes(ct));

/**
 * Parses "int solve(vector<int> nums, int k)" into structured object.
 * Returns null if parsing fails.
 */
const parseSignature = (sig) => {
  if (!sig || typeof sig !== 'string') return null;
  sig = sig.trim();

  // Match: returnType funcName(params)
  const match = sig.match(/^([^(]+?)\s+(\w+)\s*\(([^)]*)\)\s*$/);
  if (!match) return null;

  const returnType = match[1].trim();
  const functionName = match[2].trim();
  const rawParams = match[3].trim();

  const params = [];
  if (rawParams) {
    // Split on commas that are NOT inside angle brackets
    const paramList = [];
    let depth = 0, current = '';
    for (const ch of rawParams) {
      if (ch === '<') depth++;
      else if (ch === '>') depth--;
      if (ch === ',' && depth === 0) {
        paramList.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) paramList.push(current.trim());

    for (const p of paramList) {
      // e.g. "vector<int> nums" or "int k"
      const lastSpace = p.lastIndexOf(' ');
      if (lastSpace === -1) return null;
      const type = p.slice(0, lastSpace).trim();
      const name = p.slice(lastSpace + 1).trim();
      params.push({ type, name });
    }
  }

  return { returnType, functionName, params };
};

/**
 * Returns true if any param or return type is complex / unsupported.
 */
const requiresManualMode = (parsed) => {
  if (!parsed) return true;
  if (!SUPPORTED_TYPES.has(parsed.returnType)) return true;
  return parsed.params.some(p => !SUPPORTED_TYPES.has(p.type) || isComplexType(p.type));
};

// ─── Starter Code generators ──────────────────────────────────────────────────

const getJavaCppType = (cppType) => TYPE_MAP[cppType]?.java || cppType;
const getCType = (cppType, name) => {
  if (cppType === 'vector<int>') return `int* ${name}, int n_${name}`;
  if (cppType === 'vector<string>') return `char** ${name}, int n_${name}`;
  return `${TYPE_MAP[cppType]?.c || cppType} ${name}`;
};
const getPhpParam = (cppType, name) => `$${name}`;

const generateStarterCode = (parsed) => {
  const { returnType, functionName, params } = parsed;

  // C++ — same as signature
  const cppParams = params.map(p => `${p.type} ${p.name}`).join(', ');
  const cpp =
`${returnType} ${functionName}(${cppParams}) {
    // Write your code here
}`;

  // Java
  const javaParams = params.map(p => `${getJavaCppType(p.type)} ${p.name}`).join(', ');
  const javaReturn = getJavaCppType(returnType);
  const java =
`class Solution {
    public ${javaReturn} ${functionName}(${javaParams}) {
        // Write your code here
    }
}`;

  // Python
  const pyParams = params.map(p => p.name).join(', ');
  const python =
`def ${functionName}(${pyParams}):
    # Write your code here
    pass`;

  // JavaScript
  const jsParams = params.map(p => p.name).join(', ');
  const javascript =
`function ${functionName}(${jsParams}) {
    // Write your code here
}`;

  // C
  const cParamParts = [];
  for (const p of params) {
    if (p.type === 'vector<int>') cParamParts.push(`int* ${p.name}`, `int n_${p.name}`);
    else if (p.type === 'vector<string>') cParamParts.push(`char** ${p.name}`, `int n_${p.name}`);
    else cParamParts.push(`${TYPE_MAP[p.type]?.c || p.type} ${p.name}`);
  }
  const cReturnType = TYPE_MAP[returnType]?.c || returnType;
  const c =
`${cReturnType} ${functionName}(${cParamParts.join(', ')}) {
    // Write your code here
}`;

  // PHP
  const phpParams = params.map(p => `$${p.name}`).join(', ');
  const php =
`function ${functionName}(${phpParams}) {
    // Write your code here
}`;

  return { cpp, java, python, javascript, c, php };
};

// ─── Driver Code generators ───────────────────────────────────────────────────

const generateDriverCode = (parsed) => {
  const { returnType, functionName, params } = parsed;
  const out = RETURN_OUTPUT[returnType] || {
    cpp: 'cout << result;', java: 'System.out.println(result);',
    py: 'print(result)', js: 'console.log(result);',
    c: 'printf("%s", result);', php: 'echo $result;',
  };

  // ── C++ ──────────────────────────────────────────────────────────────────
  const CPP_INDENT = '\n    ';
  const cppReads = params.map(p => {
    const raw = (TYPE_MAP[p.type]?.cppRead || ((n) => `cin >> ${n};`))(p.name);
    // normalize embedded newlines to include the same 4-space indent
    return raw.split('\n').join(CPP_INDENT);
  }).join(CPP_INDENT);
  const cppCallArgs = params.map(p => p.name).join(', ');
  const cpp =
`#include <bits/stdc++.h>
using namespace std;

// [[CANDIDATE_CODE]]

int main() {
    ${cppReads}
    auto result = ${functionName}(${cppCallArgs});
    ${out.cpp}
    return 0;
}`;

  // ── Java ─────────────────────────────────────────────────────────────────
  const javaReads = params.map(p => {
    return (TYPE_MAP[p.type]?.javaRead || ((n) => `// read ${n}`))(p.name);
  }).join('\n        ');
  const javaCallArgs = params.map(p => p.name).join(', ');
  const javaReturn = getJavaCppType(returnType);
  const java =
`import java.util.*;

// [[CANDIDATE_CODE]]

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        ${javaReads}
        Solution sol = new Solution();
        ${javaReturn} result = sol.${functionName}(${javaCallArgs});
        ${out.java}
    }
}`;

  // ── Python ───────────────────────────────────────────────────────────────
  const pyReads = params.map(p => {
    return (TYPE_MAP[p.type]?.pyRead || ((n) => `${n} = tokens[idx]; idx += 1`))(p.name);
  }).join('\n');
  const pyCallArgs = params.map(p => p.name).join(', ');
  const python =
`# [[CANDIDATE_CODE]]

import sys
tokens = sys.stdin.read().split()
idx = 0
${pyReads}
result = ${functionName}(${pyCallArgs})
${out.py}`;

  // ── JavaScript ───────────────────────────────────────────────────────────
  const jsReads = params.map(p => {
    return (TYPE_MAP[p.type]?.jsRead || ((n) => `const ${n} = tokens[idx++];`))(p.name);
  }).join('\n');
  const jsCallArgs = params.map(p => p.name).join(', ');
  const javascript =
`// [[CANDIDATE_CODE]]

const input = require('fs').readFileSync('/dev/stdin','utf8');
const tokens = input.trim().split(/\\s+/);
let idx = 0;
${jsReads}
const result = ${functionName}(${jsCallArgs});
${out.js}`;

  // ── C ────────────────────────────────────────────────────────────────────
  const cReads = params.map(p => {
    return (TYPE_MAP[p.type]?.cRead || ((n) => `// read ${n}`))(p.name);
  }).join('\n    ');
  const cCallArgParts = [];
  for (const p of params) {
    if (p.type === 'vector<int>' || p.type === 'vector<string>') {
      cCallArgParts.push(p.name, `n_${p.name}`);
    } else {
      cCallArgParts.push(p.name);
    }
  }
  const cReturnType = TYPE_MAP[returnType]?.c || returnType;
  const c =
`#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// [[CANDIDATE_CODE]]

int main() {
    ${cReads}
    ${cReturnType} result = ${functionName}(${cCallArgParts.join(', ')});
    ${out.c}
    return 0;
}`;

  // ── PHP ──────────────────────────────────────────────────────────────────
  const phpReads = params.map(p => {
    return (TYPE_MAP[p.type]?.phpRead || ((n) => `$${n} = $tokens[$idx++];`))(p.name);
  }).join('\n');
  const phpCallArgs = params.map(p => `$${p.name}`).join(', ');
  const php =
`<?php
// [[CANDIDATE_CODE]]

$input = trim(stream_get_contents(STDIN));
$tokens = preg_split('/\\s+/', $input, -1, PREG_SPLIT_NO_EMPTY);
if ($tokens === false || (count($tokens) === 1 && $tokens[0] === '')) {
    $tokens = [];
}
$idx = 0;
${phpReads}
$result = ${functionName}(${phpCallArgs});
${out.php}
?>`;

  return { cpp, java, python, javascript, c, php };
};

// ─── Main exported functions ──────────────────────────────────────────────────

/**
 * Full pipeline: parse signature → validate → generate all code.
 *
 * Returns:
 * {
 *   mode: 'auto' | 'manual',
 *   reason: string | null,        // why manual was chosen
 *   parsedSignature: object | null,
 *   starterCode: { cpp, java, python, javascript, c, php },
 *   driverCode:  { cpp, java, python, javascript, c, php },
 * }
 */
const processSignature = (signature) => {
  const blank = { cpp: '', java: '', python: '', javascript: '', c: '', php: '' };

  if (!signature || !signature.trim()) {
    return { mode: 'manual', reason: 'No function signature provided.', parsedSignature: null, starterCode: blank, driverCode: blank };
  }

  const parsed = parseSignature(signature.trim());
  if (!parsed) {
    return { mode: 'manual', reason: 'Could not parse the function signature. Check the format: returnType funcName(type1 param1, type2 param2)', parsedSignature: null, starterCode: blank, driverCode: blank };
  }

  if (requiresManualMode(parsed)) {
    return { mode: 'manual', reason: 'Complex data structures detected. Please write starter and driver code manually.', parsedSignature: parsed, starterCode: blank, driverCode: blank };
  }

  return {
    mode: 'auto',
    reason: null,
    parsedSignature: parsed,
    starterCode: generateStarterCode(parsed),
    driverCode: generateDriverCode(parsed),
  };
};

module.exports = {
  parseSignature,
  requiresManualMode,
  generateStarterCode,
  generateDriverCode,
  processSignature,
  SUPPORTED_TYPES,
};
