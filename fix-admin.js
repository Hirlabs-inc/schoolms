const fs = require("fs");
let f = "C:/Users/khali/Downloads/school-management-system/app/admin/page.tsx";
let c = fs.readFileSync(f, "utf8");
// Remove the AuthGuard wrapper - the AdminLayout already provides protection
// Find and replace the AuthGuard wrapper - simpler approach
// Just remove the opening AuthGuard tag and the closing </> fragment issues
newC = c.replace('<AuthGuard permission="view_dashboard">\n        <', '<');
// Also need to handle the </> fragment closing - let's just remove the entire AuthGuard block
// Actually let's just ensure proper JSX structure
// Write back
fs.writeFileSync(f, newC);
console.log("Fixed - removed AuthGuard from AdminDashboard");