// Quick script to fix useSearchParams Suspense issues
const fs = require('fs');

const filesToFix = [
  '/Users/manuel/Documents/github/vence/app/landing/premium-ads-2/page.js',
  '/Users/manuel/Documents/github/vence/app/landing/premium-edu/page.js',
  '/Users/manuel/Documents/github/vence/app/premium/page.js',
  '/Users/manuel/Documents/github/vence/app/perfil/page.js',
  '/Users/manuel/Documents/github/vence/app/unsubscribe/page.js'
];

filesToFix.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Only modify if it has useSearchParams and no Suspense already
    if (content.includes('useSearchParams') && !content.includes('Suspense')) {
      console.log(`Fixing ${filePath}`);
      
      // Add Suspense import if it doesn't exist
      if (!content.includes("import { Suspense }")) {
        content = content.replace(
          "import { useState, useEffect } from 'react'",
          "import { useState, useEffect, Suspense } from 'react'"
        );
      }
      
      // Find the main component function
      const exportMatch = content.match(/export default function (\w+)\(\)/);
      if (exportMatch) {
        const componentName = exportMatch[1];
        const contentComponentName = componentName + 'Content';
        
        // Replace the export default function with internal function
        content = content.replace(
          `export default function ${componentName}()`,
          `function ${contentComponentName}()`
        );
        
        // Add the new export wrapper at the end
        content += `\n\nexport default function ${componentName}() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            🔄 Cargando página...
          </h2>
        </div>
      </div>
    }>
      <${contentComponentName} />
    </Suspense>
  )
}`;
        
        fs.writeFileSync(filePath, content);
        console.log(`Fixed ${filePath}`);
      }
    }
  }
});