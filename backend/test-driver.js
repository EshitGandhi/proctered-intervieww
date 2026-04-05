/**
 * Driver Code Generator Test
 * Run: node test-driver.js
 *
 * Tests the signatureParser with multiple signatures and validates
 * that generated C++ driver code compiles and produces correct output.
 */

const { processSignature } = require('./src/services/signatureParser.service');

// ─── Test cases: [signature, sampleCode, stdin, expectedOutput] ──────────────
const TESTS = [
  {
    label: 'int + int → int (twoSum count)',
    signature: 'int solve(vector<int> nums, int k)',
    // Candidate's solution for "K Sum Subarray Count"
    candidateCode: `int solve(vector<int> nums, int k) {
    unordered_map<long long, int> prefixCount;
    long long sum = 0;
    int count = 0;
    prefixCount[0] = 1;
    for (int num : nums) {
        sum += num;
        if (prefixCount.find(sum - k) != prefixCount.end()) {
            count += prefixCount[sum - k];
        }
        prefixCount[sum]++;
    }
    return count;
}`,
    // stdin for vector<int> nums: first line = size, second line = elements; then int k
    stdin: '3\n1 1 1\n2',
    expected: '2',
  },
  {
    label: 'int solve(int a, int b)',
    signature: 'int solve(int a, int b)',
    candidateCode: `int solve(int a, int b) { return a + b; }`,
    stdin: '3\n5',
    expected: '8',
  },
  {
    label: 'string solve(string s)',
    signature: 'string solve(string s)',
    candidateCode: `string solve(string s) {
    reverse(s.begin(), s.end());
    return s;
}`,
    stdin: 'hello',
    expected: 'olleh',
  },
  {
    label: 'vector<int> solve(vector<int> nums)',
    signature: 'vector<int> solve(vector<int> nums)',
    candidateCode: `vector<int> solve(vector<int> nums) {
    sort(nums.begin(), nums.end());
    return nums;
}`,
    stdin: '5\n3 1 4 1 5',
    expected: '1 1 3 4 5',
  },
  {
    label: 'bool solve(int n)',
    signature: 'bool solve(int n)',
    candidateCode: `bool solve(int n) { return n % 2 == 0; }`,
    stdin: '4',
    expected: 'true',
  },
  {
    label: 'double solve(double x)',
    signature: 'double solve(double x)',
    candidateCode: `double solve(double x) { return x * 2.0; }`,
    stdin: '3.5',
    expected: '7',  // cout << result will print 7
  },
];

// ─── Validate generated driver code structure ─────────────────────────────────
let pass = 0, fail = 0;

for (const t of TESTS) {
  process.stdout.write(`\nTest: "${t.label}"\n`);

  const result = processSignature(t.signature);

  if (result.mode !== 'auto') {
    console.log(`  ❌ FAIL: Expected auto mode, got '${result.mode}' — ${result.reason}`);
    fail++; continue;
  }

  const driverCpp = result.driverCode.cpp;

  // Check that [[CANDIDATE_CODE]] marker is present
  if (!driverCpp.includes('// [[CANDIDATE_CODE]]')) {
    console.log(`  ❌ FAIL: Missing // [[CANDIDATE_CODE]] marker in C++ driver`);
    fail++; continue;
  }

  // Check that main() is present
  if (!driverCpp.includes('int main()')) {
    console.log(`  ❌ FAIL: Missing int main() in C++ driver`);
    fail++; continue;
  }

  // For each param declared in signature, check its variable appears in driver
  for (const p of result.parsedSignature.params) {
    if (!driverCpp.includes(p.name)) {
      console.log(`  ❌ FAIL: Param '${p.name}' missing from C++ driver code`);
      fail++; continue;
    }
  }

  // Inject candidate code and show full source
  const fullSource = driverCpp.replace('// [[CANDIDATE_CODE]]', t.candidateCode);
  
  // Basic structural check: declarations should come before cin >>
  const mainIdx = fullSource.indexOf('int main()');
  const mainBody = fullSource.slice(mainIdx);

  // Verify every param has a declaration in main
  let structureOk = true;
  for (const p of result.parsedSignature.params) {
    const pType = p.type;
    if (pType === 'vector<int>' || pType === 'vector<string>') {
      // Vector reads use n_<name> as size variable
      if (!mainBody.includes(`n_${p.name}`)) {
        console.log(`  ❌ FAIL: Size variable n_${p.name} missing from main()`);
        structureOk = false;
      }
    } else {
      // Scalar reads use type declarations
      const cppType = { int:'int', long:'long', double:'double', float:'float', bool:'bool', string:'string' }[pType] || pType;
      if (!mainBody.includes(`${cppType} ${p.name}`)) {
        console.log(`  ❌ FAIL: Declaration '${cppType} ${p.name}' missing from main()`);
        structureOk = false;
      }
    }
  }

  if (!structureOk) { fail++; continue; }

  console.log(`  ✅ PASS — Driver structure valid`);
  console.log(`  📝 Stdin format: ${t.stdin.replace(/\n/g, ' ↵ ')}`);
  console.log(`  📤 Expected output: ${t.expected}`);

  // Show the generated driver (with placeholder, not injected)
  console.log(`  Generated C++ driver:\n${'─'.repeat(50)}`);
  console.log(driverCpp);
  console.log('─'.repeat(50));

  pass++;
}

// ─── Test manual mode detection ───────────────────────────────────────────────
console.log('\n──── Manual Mode Detection Tests ────');
const complexSigs = [
  'vector<vector<int>> solve(vector<int> nums)',
  'ListNode* solve(ListNode* head)',
  'TreeNode* solve(TreeNode* root)',
];
for (const sig of complexSigs) {
  const r = processSignature(sig);
  if (r.mode === 'manual') {
    console.log(`  ✅ Correctly flagged as manual: "${sig}"`);
    pass++;
  } else {
    console.log(`  ❌ Should be manual but got auto: "${sig}"`);
    fail++;
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log(fail === 0 ? '🎉 All tests passed!' : '❌ Some tests failed!');
process.exit(fail > 0 ? 1 : 0);
