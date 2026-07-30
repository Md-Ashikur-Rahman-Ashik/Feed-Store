const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    let depth = 0;
    let inString = false;
    let stringChar = null;
    let inTemplate = false;
    let inLineComment = false;
    let inBlockComment = false;
    let templateBraceDepth = 0;

    for (let i = 0; i < code.length; i++) {
        const c = code[i];
        const next = i < code.length - 1 ? code[i+1] : '';

        // Handle comments
        if (inLineComment) {
            if (c === '\n') inLineComment = false;
            continue;
        }
        if (inBlockComment) {
            if (c === '*' && next === '/') { inBlockComment = false; i++; }
            continue;
        }
        if (c === '/' && next === '/') { inLineComment = true; i++; continue; }
        if (c === '/' && next === '*') { inBlockComment = true; i++; continue; }

        // Handle strings
        if (inString) {
            if (c === '\\') { i++; continue; }
            if (c === stringChar) inString = false;
            continue;
        }
        if (c === '"' || c === "'") {
            inString = true;
            stringChar = c;
            continue;
        }

        // Handle template literals
        if (inTemplate) {
            if (c === '`') { inTemplate = false; continue; }
            if (c === '\\') { i++; continue; }
            if (c === '$' && next === '{') {
                templateBraceDepth++;
                i++;
                continue;
            }
            if (c === '}' && templateBraceDepth > 0) {
                // Check if we're closing a template expression
                let lookahead = i + 1;
                let isTemplateExp = false;
                // We need to track this properly, but for now skip
                templateBraceDepth--;
                continue;
            }
            continue;
        }
        if (c === '`') {
            inTemplate = true;
            templateBraceDepth = 0;
            continue;
        }

        // Count braces
        if (c === '{') depth++;
        else if (c === '}') depth--;
    }

    return {
        file: filePath,
        balanced: depth === 0,
        finalDepth: depth
    };
}

function checkNestedFunctions(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    const lines = code.split('\n');
    const issues = [];
    let braceDepth = 0;
    let lastFunctionLine = -1;
    let lastFunctionDepth = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Track brace depth (simplified - just counting on actual lines)
        for (const c of line) {
            if (c === '{') braceDepth++;
            else if (c === '}') braceDepth--;
        }

        // Detect function declarations at module level
        if ((trimmed.startsWith('function ') || trimmed.startsWith('async function ') || 
             trimmed.startsWith('export function ') || trimmed.startsWith('export async function ')) &&
            !trimmed.includes('=>')) {
            
            if (lastFunctionLine >= 0 && braceDepth > 0) {
                // Previous function was not closed properly (still inside something)
                issues.push({
                    line: i + 1,
                    currentFunction: trimmed,
                    depth: braceDepth
                });
            }
            lastFunctionLine = i;
            lastFunctionDepth = braceDepth;
        }
    }

    return issues;
}

// Collect all JS files
const dirs = ['js/views', 'js/services', 'js/utils', 'js/db', 'js'];
let allFiles = [];
dirs.forEach(d => {
    const fullPath = path.join(__dirname, d);
    if (fs.existsSync(fullPath)) {
        const entries = fs.readdirSync(fullPath);
        entries.forEach(f => {
            const filePath = path.join(fullPath, f);
            if (f.endsWith('.js') && fs.statSync(filePath).isFile()) {
                allFiles.push(filePath);
            }
        });
    }
});

console.log('=== BRACE BALANCE CHECK ===\n');
let balanced = true;
allFiles.forEach(f => {
    const relPath = path.relative(__dirname, f);
    const result = checkFile(f);
    if (!result.balanced) {
        console.log(`❌ UNBALANCED: ${relPath} (final depth=${result.finalDepth})`);
        balanced = false;
    } else {
        console.log(`✅ ${relPath}`);
    }
});

if (balanced) {
    console.log('\n✅ All files have balanced braces!');
} else {
    process.exit(1);
}
